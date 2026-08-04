import type { KnowledgeUnit } from "@/lib/knowledge/schema";
import type {
  ConversationProvider,
  EvaluationProvider,
  EvaluationStreamChunk,
  LiveRiskProvider,
} from "./providers";
import type {
  LiveRiskAlert,
  ScenarioEvaluationReport,
  ScenarioMode,
  ScenarioSession,
  ScenarioTemplate,
} from "./schema";
import type {
  ScenarioSessionStore,
  ScenarioProgressSummary,
  SessionIdentity,
} from "./session-store";
import { summarizeScenarioProgress } from "./session-store";
import type { ScenarioTemplateStore } from "./template-store";

export type KnowledgeUnitLoader = (
  scenario: ScenarioTemplate,
) => Promise<KnowledgeUnit[]>;

export class ScenarioTrainingService {
  private readonly store: ScenarioSessionStore;
  private readonly templates: ScenarioTemplateStore;
  private readonly conversationProvider: ConversationProvider;
  private readonly evaluationProvider: EvaluationProvider;
  private readonly liveRiskProvider?: LiveRiskProvider;
  private readonly knowledgeUnitLoader?: KnowledgeUnitLoader;
  private readonly mode: ScenarioMode;

  constructor(input: {
    store: ScenarioSessionStore;
    templates: ScenarioTemplateStore;
    conversationProvider: ConversationProvider;
    evaluationProvider: EvaluationProvider;
    liveRiskProvider?: LiveRiskProvider;
    knowledgeUnitLoader?: KnowledgeUnitLoader;
    mode?: ScenarioMode;
  }) {
    this.store = input.store;
    this.templates = input.templates;
    this.conversationProvider = input.conversationProvider;
    this.evaluationProvider = input.evaluationProvider;
    this.liveRiskProvider = input.liveRiskProvider;
    this.knowledgeUnitLoader = input.knowledgeUnitLoader;
    this.mode = input.mode ?? "mock";
  }

  async start(input: {
    learnerId: string;
    scenarioId: string;
    assignmentId?: string;
  }): Promise<ScenarioSession> {
    const scenario = await this.templates.getPublishedById(
      input.scenarioId,
    );
    if (!scenario || scenario.status !== "published") {
      throw new Error("场景不存在或未发布。");
    }
    return this.store.startSession({
      learnerId: input.learnerId,
      scenario,
      mode: this.mode,
      assignmentId: input.assignmentId,
    });
  }

  async load(input: SessionIdentity): Promise<ScenarioSession> {
    const { session } = await this.loadWithScenario(input);
    return session;
  }

  async getProgress(input: {
    learnerId: string;
    publishedScenarioCount: number;
    publishedScenarioIds?: string[];
    includeDetails?: boolean;
  }): Promise<ScenarioProgressSummary> {
    const sessions = await this.store.listSessions({
      learnerId: input.learnerId,
    });
    return summarizeScenarioProgress(
      sessions,
      input.publishedScenarioCount,
      20,
      input.publishedScenarioIds
        ? new Set(input.publishedScenarioIds)
        : undefined,
      input.includeDetails !== false,
    );
  }

  private async loadWithScenario(
    input: SessionIdentity,
  ): Promise<{ session: ScenarioSession; scenario: ScenarioTemplate }> {
    const session = await this.store.loadSession(input);
    const scenario = await this.templateForSession(session);
    return { session, scenario };
  }

  async sendMessage(
    input: SessionIdentity & { content: string },
  ): Promise<{
    session: ScenarioSession;
    customerChunks: string[];
    riskAlert: LiveRiskAlert | null;
  }> {
    const { session, scenario } = await this.loadWithScenario(input);
    if (session.status === "completed") {
      throw new Error("已完成的训练不能继续发送消息。");
    }
    const customerChunks: string[] = [];
    const messages = [
      ...session.messages.map(({ role, content }) => ({ role, content })),
      { role: "learner" as const, content: input.content },
    ];
    const knowledgeUnits = this.knowledgeUnitLoader
      ? await this.knowledgeUnitLoader(scenario)
      : [];

    const streamCustomer = (async () => {
      for await (const chunk of this.conversationProvider.streamCustomerReply({
        scenario,
        learnerTurnCount: session.learnerTurnCount,
        messages,
        knowledgeUnits,
      })) {
        customerChunks.push(chunk);
      }
    })();
    const detectRisk = this.liveRiskProvider
      ? this.liveRiskProvider
          .detectRisk({ scenario, learnerMessage: input.content })
          .catch(() => null)
      : Promise.resolve(null);

    const [, riskAlert] = await Promise.all([streamCustomer, detectRisk]);

    const updated = await this.store.appendExchange({
      learnerId: input.learnerId,
      sessionId: input.sessionId,
      expectedTurnCount: session.learnerTurnCount,
      learnerMessage: input.content,
      customerReply: customerChunks.join(""),
      riskAlert,
    });
    return { session: updated, customerChunks, riskAlert };
  }

  async complete(input: SessionIdentity): Promise<ScenarioSession> {
    const { session, scenario } = await this.loadWithScenario(input);
    if (session.status === "completed") {
      return session;
    }
    const report = await this.evaluationProvider.evaluate({
      scenario,
      learnerMessages: session.messages
        .filter((message) => message.role === "learner")
        .map((message) => message.content),
    });
    return this.store.completeSession({ ...input, report });
  }

  async *completeStream(
    input: SessionIdentity,
  ): AsyncIterable<EvaluationStreamChunk | { session: ScenarioSession }> {
    const { session, scenario } = await this.loadWithScenario(input);
    if (session.status === "completed" && session.report) {
      yield { report: session.report };
      yield { session };
      return;
    }
    const learnerMessages = session.messages
      .filter((message) => message.role === "learner")
      .map((message) => message.content);
    yield { phase: "analyzing" };
    let report: ScenarioEvaluationReport | undefined;
    let scoringStarted = false;
    for await (const chunk of this.evaluationProvider.evaluateStream({
      scenario,
      learnerMessages,
    })) {
      if (!scoringStarted) {
        scoringStarted = true;
        yield { phase: "scoring" };
      }
      if ("report" in chunk) {
        report = chunk.report;
      } else if ("delta" in chunk) {
        yield chunk;
      }
    }
    if (!report) {
      throw new Error("AI 评测结果解析失败，请稍后重试。");
    }
    yield { phase: "saving" };
    const completed = await this.store.completeSession({ ...input, report });
    yield { report };
    yield { session: completed };
  }

  async restart(input: SessionIdentity): Promise<ScenarioSession> {
    const session = await this.load(input);
    return this.start({
      learnerId: input.learnerId,
      scenarioId: session.scenarioId,
    });
  }

  private async templateForSession(
    session: ScenarioSession,
  ): Promise<ScenarioTemplate> {
    const scenario = await this.templates.getPublishedById(
      session.scenarioId,
    );
    if (
      !scenario ||
      scenario.versionId !== session.scenarioVersionId ||
      scenario.status !== "published"
    ) {
      throw new Error("场景版本不存在或已失效。");
    }
    return scenario;
  }
}

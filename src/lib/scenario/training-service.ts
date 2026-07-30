import type {
  ConversationProvider,
  EvaluationProvider,
} from "./providers";
import type { ScenarioSession, ScenarioTemplate } from "./schema";
import type {
  ScenarioSessionStore,
  SessionIdentity,
} from "./session-store";
import type { ScenarioTemplateStore } from "./template-store";

export class ScenarioTrainingService {
  private readonly store: ScenarioSessionStore;
  private readonly templates: ScenarioTemplateStore;
  private readonly conversationProvider: ConversationProvider;
  private readonly evaluationProvider: EvaluationProvider;

  constructor(input: {
    store: ScenarioSessionStore;
    templates: ScenarioTemplateStore;
    conversationProvider: ConversationProvider;
    evaluationProvider: EvaluationProvider;
  }) {
    this.store = input.store;
    this.templates = input.templates;
    this.conversationProvider = input.conversationProvider;
    this.evaluationProvider = input.evaluationProvider;
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
      assignmentId: input.assignmentId,
    });
  }

  async load(input: SessionIdentity): Promise<ScenarioSession> {
    const session = await this.store.loadSession(input);
    await this.templateForSession(session);
    return session;
  }

  async sendMessage(
    input: SessionIdentity & { content: string },
  ): Promise<{
    session: ScenarioSession;
    customerChunks: string[];
  }> {
    const session = await this.load(input);
    if (session.status === "completed") {
      throw new Error("已完成的训练不能继续发送消息。");
    }
    const scenario = await this.templateForSession(session);
    const customerChunks: string[] = [];
    const messages = [
      ...session.messages.map(({ role, content }) => ({ role, content })),
      { role: "learner" as const, content: input.content },
    ];

    for await (const chunk of this.conversationProvider.streamCustomerReply({
      scenario,
      learnerTurnCount: session.learnerTurnCount,
      messages,
    })) {
      customerChunks.push(chunk);
    }

    let updated = await this.store.appendExchange({
      learnerId: input.learnerId,
      sessionId: input.sessionId,
      expectedTurnCount: session.learnerTurnCount,
      learnerMessage: input.content,
      customerReply: customerChunks.join(""),
    });
    if (updated.learnerTurnCount >= updated.maxTurns) {
      updated = await this.complete({
        learnerId: input.learnerId,
        sessionId: input.sessionId,
      });
    }
    return { session: updated, customerChunks };
  }

  async complete(input: SessionIdentity): Promise<ScenarioSession> {
    const session = await this.load(input);
    if (session.status === "completed") {
      return session;
    }
    const scenario = await this.templateForSession(session);
    const report = await this.evaluationProvider.evaluate({
      scenario,
      learnerMessages: session.messages
        .filter((message) => message.role === "learner")
        .map((message) => message.content),
    });
    return this.store.completeSession({ ...input, report });
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

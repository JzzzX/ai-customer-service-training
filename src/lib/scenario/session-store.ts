import type {
  ScenarioEvaluationReport,
  ScenarioSession,
  ScenarioTemplate,
} from "./schema";

export type SessionIdentity = {
  learnerId: string;
  sessionId: string;
};

export type StartScenarioSessionInput = {
  learnerId: string;
  scenario: ScenarioTemplate;
  assignmentId?: string;
  startedAt?: string;
};

export type AppendScenarioExchangeInput = SessionIdentity & {
  expectedTurnCount: number;
  learnerMessage: string;
  customerReply: string;
  updatedAt?: string;
};

export type CompleteScenarioSessionInput = SessionIdentity & {
  report: ScenarioEvaluationReport;
  completedAt?: string;
};

export interface ScenarioSessionStore {
  startSession(input: StartScenarioSessionInput): Promise<ScenarioSession>;
  loadSession(input: SessionIdentity): Promise<ScenarioSession>;
  appendExchange(
    input: AppendScenarioExchangeInput,
  ): Promise<ScenarioSession>;
  completeSession(
    input: CompleteScenarioSessionInput,
  ): Promise<ScenarioSession>;
}

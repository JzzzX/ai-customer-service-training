import type {
  LiveRiskAlert,
  ScenarioEvaluationReport,
  ScenarioMode,
  ScenarioCategory,
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
  mode: ScenarioMode;
  assignmentId?: string;
  startedAt?: string;
};

export type AppendScenarioExchangeInput = SessionIdentity & {
  expectedTurnCount: number;
  learnerMessage: string;
  customerReply: string;
  riskAlert?: LiveRiskAlert | null;
  updatedAt?: string;
};

export type CompleteScenarioSessionInput = SessionIdentity & {
  report: ScenarioEvaluationReport;
  completedAt?: string;
};

export type ScenarioSessionSummary = {
  id: string;
  learnerId: string;
  scenarioId: string;
  scenarioVersionId: string;
  title: string;
  category: ScenarioCategory;
  status: "active" | "completed";
  mode: ScenarioMode;
  learnerTurnCount: number;
  maxTurns: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  score?: number;
  verdict?: "passed" | "needs_retry";
};

export type ScenarioProgressSummary = {
  publishedScenarioCount: number;
  completedScenarioCount: number;
  completedSessionCount: number;
  recentAverageScore: number;
  activeSessions: ScenarioSessionSummary[];
  completedSessions: ScenarioSessionSummary[];
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
  listSessions(input: {
    learnerId: string;
    limit?: number;
  }): Promise<ScenarioSessionSummary[]>;
}

export function summarizeScenarioProgress(
  sessions: ScenarioSessionSummary[],
  publishedScenarioCount: number,
  completedLimit = 20,
  publishedScenarioIds?: ReadonlySet<string>,
  includeDetails = true,
): ScenarioProgressSummary {
  const completed = sessions
    .filter((session) => session.status === "completed")
    .sort(compareSessionsDescending);
  const activeSessions = sessions
    .filter((session) => session.status === "active")
    .sort(compareSessionsDescending);
  const completedScenarioIds = new Set(
    completed
      .filter(
        (session) =>
          !publishedScenarioIds || publishedScenarioIds.has(session.scenarioId),
      )
      .map((session) => session.scenarioId),
  );
  const recentScores = completed
    .map((session) => session.score)
    .filter((score): score is number => score !== undefined)
    .slice(0, 5);

  return {
    publishedScenarioCount,
    completedScenarioCount: completedScenarioIds.size,
    completedSessionCount: completed.length,
    recentAverageScore:
      recentScores.length > 0
        ? Math.round(
            recentScores.reduce((total, score) => total + score, 0) /
              recentScores.length,
          )
        : 0,
    activeSessions: includeDetails ? activeSessions : [],
    completedSessions: includeDetails ? completed.slice(0, completedLimit) : [],
  };
}

function compareSessionsDescending(
  left: ScenarioSessionSummary,
  right: ScenarioSessionSummary,
): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.id.localeCompare(left.id)
  );
}

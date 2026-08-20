import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { SourceLocator } from "@/lib/knowledge/schema";
import type {
  ScenarioEvaluationReport,
  ScenarioRecommendation,
  ScenarioTemplate,
} from "@/lib/scenario/schema";

const lifecycleStatus = ["draft", "published", "disabled", "archived"] as const;
export const userRoles = ["learner", "admin"] as const;
export type UserRole = (typeof userRoles)[number];
export const quizSetKinds = ["formal", "topic", "remediation"] as const;
export type QuizSetKind = (typeof quizSetKinds)[number];
const questionTypes = ["single_choice", "true_false"] as const;
const difficulties = ["easy", "medium", "hard"] as const;
const quizAttemptStatuses = ["in_progress", "passed", "needs_retry"] as const;
const trainingSessionStatuses = [
  "in_progress",
  "completed",
  "needs_review",
  "failed",
] as const;
const messageSenders = ["customer", "learner", "coach", "system"] as const;
const evaluationVerdicts = ["passed", "needs_retry"] as const;

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`);
const bool = (name: string) => integer(name, { mode: "boolean" });
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: userRoles }).default("learner").notNull(),
    isActive: bool("is_active").default(true).notNull(),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    ...auditTimestamps(),
  },
  (table) => [
    unique("users_email_unique").on(table.email),
    check("users_role_check", sql`${table.role} in ('learner', 'admin')`),
  ],
);

export const feishuIdentities = sqliteTable(
  "feishu_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    unionId: text("union_id").notNull(),
    openId: text("open_id").notNull(),
    ...auditTimestamps(),
  },
  (table) => [
    unique("feishu_identities_user_unique").on(table.userId),
    unique("feishu_identities_union_unique").on(table.unionId),
    index("feishu_identities_open_idx").on(table.openId),
  ],
);

export const knowledgeVersions = sqliteTable(
  "knowledge_versions",
  {
    id: text("id").primaryKey(),
    versionHash: text("version_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    sourceRoot: text("source_root").notNull(),
    publicationSource: text("publication_source").default("cli").notNull(),
    status: text("status", { enum: lifecycleStatus }).default("draft").notNull(),
    isActive: bool("is_active").default(false).notNull(),
    coverage: json<Record<string, number>>("coverage").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    unique("knowledge_versions_hash_unique").on(table.versionHash),
    uniqueIndex("knowledge_versions_single_active_idx")
      .on(table.isActive)
      .where(sql`${table.isActive} = 1`),
    check(
      "knowledge_versions_publication_source_check",
      sql`${table.publicationSource} = 'cli'`,
    ),
    check(
      "knowledge_versions_status_check",
      sql`${table.status} in ('draft', 'published', 'disabled', 'archived')`,
    ),
  ],
);

export const knowledgeSources = sqliteTable(
  "knowledge_sources",
  {
    id: text("id").primaryKey(),
    knowledgeVersionId: text("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    sourcePath: text("source_path").notNull(),
    kind: text("kind", { enum: ["markdown", "excel", "mindmap"] }).notNull(),
    sourceHash: text("source_hash").notNull(),
    bytes: integer("bytes").notNull(),
    stats: json<Record<string, number>>("stats").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    unique("knowledge_sources_version_path_unique").on(
      table.knowledgeVersionId,
      table.sourcePath,
    ),
    check(
      "knowledge_sources_kind_check",
      sql`${table.kind} in ('markdown', 'excel', 'mindmap')`,
    ),
  ],
);

export const knowledgeUnits = sqliteTable(
  "knowledge_units",
  {
    id: text("id").primaryKey(),
    knowledgeVersionId: text("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    unitKey: text("unit_key").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    categoryPath: json<string[]>("category_path").notNull(),
    semanticKey: text("semantic_key"),
    contentHash: text("content_hash").notNull(),
    sources: json<SourceLocator[]>("sources").notNull(),
    hasConflict: bool("has_conflict").default(false).notNull(),
    canUseForQuiz: bool("can_use_for_quiz").default(true).notNull(),
    canUseForScenario: bool("can_use_for_scenario").default(true).notNull(),
    canUseForEvaluation: bool("can_use_for_evaluation")
      .default(true)
      .notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    unique("knowledge_units_version_key_unique").on(
      table.knowledgeVersionId,
      table.unitKey,
    ),
    index("knowledge_units_semantic_key_idx").on(table.semanticKey),
  ],
);

export const quizSets = sqliteTable(
  "quiz_sets",
  {
    id: text("id").primaryKey(),
    knowledgeVersionId: text("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    quizHash: text("quiz_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    sourceQuizHash: text("source_quiz_hash"),
    title: text("title").notNull(),
    description: text("description"),
    kind: text("kind", { enum: quizSetKinds }).default("formal").notNull(),
    topicId: text("topic_id"),
    publicationSource: text("publication_source").default("cli").notNull(),
    status: text("status", { enum: lifecycleStatus }).default("draft").notNull(),
    passingScore: integer("passing_score").default(80).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    ...auditTimestamps(),
  },
  (table) => [
    unique("quiz_sets_hash_unique").on(table.quizHash),
    check(
      "quiz_sets_passing_score_check",
      sql`${table.passingScore} between 0 and 100`,
    ),
    check(
      "quiz_sets_publication_source_check",
      sql`${table.publicationSource} = 'cli'`,
    ),
    check(
      "quiz_sets_status_check",
      sql`${table.status} in ('draft', 'published', 'disabled', 'archived')`,
    ),
    check(
      "quiz_sets_kind_check",
      sql`${table.kind} in ('formal', 'topic', 'remediation')`,
    ),
    check(
      "quiz_sets_topic_check",
      sql`(${table.kind} = 'topic' and ${table.topicId} is not null) or (${table.kind} <> 'topic' and ${table.topicId} is null)`,
    ),
    index("quiz_sets_kind_topic_status_idx").on(
      table.kind,
      table.topicId,
      table.status,
    ),
  ],
);

export const questionCatalogs = sqliteTable(
  "question_catalogs",
  {
    id: text("id").primaryKey(),
    stableKey: text("stable_key").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    unique("question_catalogs_stable_key_unique").on(table.stableKey),
  ],
);

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    questionCatalogId: text("question_catalog_id")
      .notNull()
      .references(() => questionCatalogs.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    contentHash: text("content_hash").notNull(),
    knowledgeVersionId: text("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    knowledgeUnitId: text("knowledge_unit_id")
      .references(() => knowledgeUnits.id, { onDelete: "restrict" }),
    knowledgeUnitKey: text("knowledge_unit_key").notNull(),
    questionKey: text("question_key").notNull(),
    type: text("type", { enum: questionTypes }).notNull(),
    prompt: text("prompt").notNull(),
    options: json<string[]>("options").notNull(),
    correctAnswers: json<string[]>("correct_answers").notNull(),
    explanation: text("explanation").notNull(),
    category: text("category").notNull(),
    difficulty: text("difficulty", { enum: difficulties }).default("easy").notNull(),
    sources: json<SourceLocator[]>("sources").notNull(),
    status: text("status", { enum: lifecycleStatus }).default("draft").notNull(),
    ...auditTimestamps(),
  },
  (table) => [
    unique("questions_catalog_revision_unique").on(
      table.questionCatalogId,
      table.revision,
    ),
    unique("questions_catalog_content_unique").on(
      table.questionCatalogId,
      table.contentHash,
    ),
    index("questions_question_key_idx").on(table.questionKey),
    index("questions_catalog_idx").on(table.questionCatalogId),
    index("questions_knowledge_unit_idx").on(table.knowledgeUnitId),
    index("questions_status_category_idx").on(table.status, table.category),
    check(
      "questions_type_check",
      sql`${table.type} in ('single_choice', 'true_false')`,
    ),
    check(
      "questions_difficulty_check",
      sql`${table.difficulty} in ('easy', 'medium', 'hard')`,
    ),
    check(
      "questions_status_check",
      sql`${table.status} in ('draft', 'published', 'disabled', 'archived')`,
    ),
    check("questions_revision_check", sql`${table.revision} >= 1`),
  ],
);

export const quizSetQuestions = sqliteTable(
  "quiz_set_questions",
  {
    quizSetId: text("quiz_set_id")
      .notNull()
      .references(() => quizSets.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    points: integer("points").default(1).notNull(),
  },
  (table) => [
    primaryKey({
      name: "quiz_set_questions_pk",
      columns: [table.quizSetId, table.questionId],
    }),
    unique("quiz_set_questions_position_unique").on(
      table.quizSetId,
      table.position,
    ),
  ],
);

export const quizAttempts = sqliteTable(
  "quiz_attempts",
  {
    id: text("id").primaryKey(),
    quizSetId: text("quiz_set_id")
      .notNull()
      .references(() => quizSets.id, { onDelete: "restrict" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    knowledgeVersionId: text("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    status: text("status", { enum: quizAttemptStatuses })
      .default("in_progress")
      .notNull(),
    correctCount: integer("correct_count").default(0).notNull(),
    totalQuestions: integer("total_questions").notNull(),
    score: integer("score"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("quiz_attempts_learner_started_idx").on(
      table.learnerId,
      table.startedAt,
    ),
    check(
      "quiz_attempts_score_check",
      sql`${table.score} is null or ${table.score} between 0 and 100`,
    ),
    check(
      "quiz_attempts_status_check",
      sql`${table.status} in ('in_progress', 'passed', 'needs_retry')`,
    ),
  ],
);

export const quizAnswers = sqliteTable(
  "quiz_answers",
  {
    id: text("id").primaryKey(),
    quizAttemptId: text("quiz_attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    selectedAnswers: json<string[]>("selected_answers").notNull(),
    isCorrect: bool("is_correct").notNull(),
    answeredAt: timestamp("answered_at").notNull(),
  },
  (table) => [
    unique("quiz_answers_attempt_question_unique").on(
      table.quizAttemptId,
      table.questionId,
    ),
  ],
);

export const topicQuizAttempts = sqliteTable(
  "topic_quiz_attempts",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    topicId: text("topic_id").notNull(),
    quizHash: text("quiz_hash").notNull(),
    status: text("status", { enum: quizAttemptStatuses }).notNull(),
    correctCount: integer("correct_count").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    score: integer("score").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("topic_quiz_attempts_learner_completed_idx").on(
      table.learnerId,
      table.completedAt,
    ),
    check(
      "topic_quiz_attempts_score_check",
      sql`${table.score} between 0 and 100`,
    ),
    check(
      "topic_quiz_attempts_status_check",
      sql`${table.status} in ('in_progress', 'passed', 'needs_retry')`,
    ),
  ],
);

export const topicQuizAnswers = sqliteTable(
  "topic_quiz_answers",
  {
    id: text("id").primaryKey(),
    topicQuizAttemptId: text("topic_quiz_attempt_id")
      .notNull()
      .references(() => topicQuizAttempts.id, { onDelete: "cascade" }),
    questionKey: text("question_key").notNull(),
    selectedAnswers: json<string[]>("selected_answers").notNull(),
    isCorrect: bool("is_correct").notNull(),
    answeredAt: timestamp("answered_at").notNull(),
  },
  (table) => [
    unique("topic_quiz_answers_attempt_question_unique").on(
      table.topicQuizAttemptId,
      table.questionKey,
    ),
  ],
);

export const scenarios = sqliteTable(
  "scenarios",
  {
    id: text("id").primaryKey(),
    scenarioKey: text("scenario_key").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    status: text("status", { enum: lifecycleStatus }).default("draft").notNull(),
    ...auditTimestamps(),
  },
  (table) => [
    unique("scenarios_key_unique").on(table.scenarioKey),
    check(
      "scenarios_status_check",
      sql`${table.status} in ('draft', 'published', 'disabled', 'archived')`,
    ),
  ],
);

export const scenarioVersions = sqliteTable(
  "scenario_versions",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "restrict" }),
    versionKey: text("version_key").notNull(),
    version: integer("version").notNull(),
    knowledgeVersionId: text("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    contentHash: text("content_hash").notNull(),
    publicationSource: text("publication_source").default("cli").notNull(),
    background: text("background").notNull(),
    summary: text("summary").notNull(),
    firstCustomerMessage: text("first_customer_message").notNull(),
    controlledVariables: json<Record<string, unknown>>("controlled_variables").notNull(),
    hiddenFacts: json<string[]>("hidden_facts").notNull(),
    customerTurns: json<string[]>("customer_turns").notNull(),
    checkpoints: json<string[]>("checkpoints").notNull(),
    prohibitions: json<string[]>("prohibitions").notNull(),
    scoringWeights: json<Record<string, number>>("scoring_weights").notNull(),
    scoringDimensions: json<ScenarioTemplate["scoringDimensions"]>("scoring_dimensions").notNull(),
    criticalRisks: json<ScenarioTemplate["criticalRisks"]>("critical_risks").notNull(),
    referenceFlow: json<string[]>("reference_flow").notNull(),
    referenceReply: text("reference_reply").notNull(),
    sources: json<SourceLocator[]>("sources").notNull(),
    maxTurns: integer("max_turns").default(12).notNull(),
    mockMode: bool("mock_mode").default(true).notNull(),
    customerPersona: json<ScenarioTemplate["customerPersona"]>("customer_persona"),
    difficulty: text("difficulty", { enum: difficulties }).default("medium"),
    status: text("status", { enum: lifecycleStatus }).default("draft").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    unique("scenario_versions_key_unique").on(table.versionKey),
    unique("scenario_versions_number_unique").on(table.scenarioId, table.version),
    check(
      "scenario_versions_max_turns_check",
      sql`${table.maxTurns} between 8 and 16`,
    ),
    check(
      "scenario_versions_publication_source_check",
      sql`${table.publicationSource} = 'cli'`,
    ),
    check(
      "scenario_versions_difficulty_check",
      sql`${table.difficulty} in ('easy', 'medium', 'hard')`,
    ),
    check(
      "scenario_versions_status_check",
      sql`${table.status} in ('draft', 'published', 'disabled', 'archived')`,
    ),
  ],
);

export const trainingSessions = sqliteTable(
  "training_sessions",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    knowledgeVersionId: text("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    scenarioVersionId: text("scenario_version_id")
      .notNull()
      .references(() => scenarioVersions.id, { onDelete: "restrict" }),
    status: text("status", { enum: trainingSessionStatuses })
      .default("in_progress")
      .notNull(),
    mode: text("mode").default("mock").notNull(),
    turnCount: integer("turn_count").default(0).notNull(),
    lastError: text("last_error"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("training_sessions_learner_started_idx").on(
      table.learnerId,
      table.startedAt,
    ),
    check("training_sessions_mode_check", sql`${table.mode} in ('mock', 'real')`),
    check(
      "training_sessions_status_check",
      sql`${table.status} in ('in_progress', 'completed', 'needs_review', 'failed')`,
    ),
  ],
);

export const trainingMessages = sqliteTable(
  "training_messages",
  {
    id: text("id").primaryKey(),
    trainingSessionId: text("training_session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    sender: text("sender", { enum: messageSenders }).notNull(),
    content: text("content").notNull(),
    metadata: json<Record<string, unknown>>("metadata"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    unique("training_messages_session_position_unique").on(
      table.trainingSessionId,
      table.position,
    ),
    check(
      "training_messages_sender_check",
      sql`${table.sender} in ('customer', 'learner', 'coach', 'system')`,
    ),
  ],
);

export const evaluationReports = sqliteTable(
  "evaluation_reports",
  {
    id: text("id").primaryKey(),
    trainingSessionId: text("training_session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "restrict" }),
    knowledgeVersionId: text("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    totalScore: integer("total_score").notNull(),
    verdict: text("verdict", { enum: evaluationVerdicts }).notNull(),
    dimensions: json<ScenarioEvaluationReport["dimensions"]>("dimensions").notNull(),
    strengths: json<string[]>("strengths").notNull(),
    omissions: json<string[]>("omissions").notNull(),
    risks: json<string[]>("risks").notNull(),
    recommendations: json<ScenarioRecommendation[]>("recommendations").notNull(),
    turnFeedback: json<Array<Record<string, unknown>>>("turn_feedback").notNull(),
    recommendedFlow: json<string[]>("recommended_flow").notNull(),
    sampleReply: text("sample_reply").notNull(),
    evidence: json<Array<Record<string, unknown>>>("evidence").notNull(),
    confidence: real("confidence").notNull(),
    lowConfidence: bool("low_confidence").default(false).notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    unique("evaluation_reports_session_unique").on(table.trainingSessionId),
    check(
      "evaluation_reports_score_check",
      sql`${table.totalScore} between 0 and 100`,
    ),
    check(
      "evaluation_reports_confidence_check",
      sql`${table.confidence} between 0 and 1`,
    ),
    check(
      "evaluation_reports_verdict_check",
      sql`${table.verdict} in ('passed', 'needs_retry')`,
    ),
  ],
);

export const mvpTables = {
  users,
  feishuIdentities,
  knowledgeVersions,
  knowledgeSources,
  knowledgeUnits,
  quizSets,
  questionCatalogs,
  questions,
  quizSetQuestions,
  quizAttempts,
  quizAnswers,
  topicQuizAttempts,
  topicQuizAnswers,
  scenarios,
  scenarioVersions,
  trainingSessions,
  trainingMessages,
  evaluationReports,
};

function auditTimestamps() {
  return {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  };
}

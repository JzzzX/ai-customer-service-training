import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { SourceLocator } from "@/lib/knowledge/schema";
import type { QuizQuestionDraft } from "@/lib/quiz/schema";
import type {
  ScenarioEvaluationReport,
  ScenarioTemplate,
} from "@/lib/scenario/schema";

export const userRoleEnum = pgEnum("user_role", ["admin", "learner"]);
export const knowledgeSourceKindEnum = pgEnum("knowledge_source_kind", [
  "markdown",
  "excel",
  "mindmap",
]);
export const lifecycleStatusEnum = pgEnum("lifecycle_status", [
  "draft",
  "published",
  "disabled",
  "archived",
]);
export const questionTypeEnum = pgEnum("question_type", [
  "single_choice",
  "true_false",
]);
export const difficultyEnum = pgEnum("difficulty", [
  "easy",
  "medium",
  "hard",
]);
export const quizAttemptStatusEnum = pgEnum("quiz_attempt_status", [
  "in_progress",
  "passed",
  "needs_retry",
]);
export const assignmentTypeEnum = pgEnum("assignment_type", [
  "quiz",
  "scenario",
]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "assigned",
  "in_progress",
  "completed",
]);
export const trainingSessionStatusEnum = pgEnum("training_session_status", [
  "in_progress",
  "completed",
  "needs_review",
  "failed",
]);
export const messageSenderEnum = pgEnum("message_sender", [
  "customer",
  "learner",
  "coach",
  "system",
]);
export const evaluationVerdictEnum = pgEnum("evaluation_verdict", [
  "passed",
  "needs_retry",
]);
export const reviewTriggerEnum = pgEnum("review_trigger", [
  "failed",
  "critical_risk",
  "low_confidence",
  "random_sample",
]);
export const reviewDecisionStatusEnum = pgEnum("review_decision_status", [
  "confirmed",
  "adjusted",
  "dismissed",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").default("learner").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...auditTimestamps(),
  },
  (table) => [unique("users_email_unique").on(table.email)],
);

export const knowledgeVersions = pgTable(
  "knowledge_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    versionHash: text("version_hash").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    sourceRoot: text("source_root").notNull(),
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    coverage: jsonb("coverage").$type<Record<string, number>>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("knowledge_versions_hash_unique").on(table.versionHash),
    uniqueIndex("knowledge_versions_single_active_idx")
      .on(table.isActive)
      .where(sql`${table.isActive} = true`),
  ],
);

export const knowledgeSources = pgTable(
  "knowledge_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    knowledgeVersionId: uuid("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    sourcePath: text("source_path").notNull(),
    kind: knowledgeSourceKindEnum("kind").notNull(),
    sourceHash: text("source_hash").notNull(),
    bytes: integer("bytes").notNull(),
    stats: jsonb("stats").$type<Record<string, number>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("knowledge_sources_version_path_unique").on(
      table.knowledgeVersionId,
      table.sourcePath,
    ),
  ],
);

export const knowledgeUnits = pgTable(
  "knowledge_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    knowledgeVersionId: uuid("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    unitKey: text("unit_key").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    categoryPath: jsonb("category_path").$type<string[]>().notNull(),
    semanticKey: text("semantic_key"),
    contentHash: text("content_hash").notNull(),
    sources: jsonb("sources").$type<SourceLocator[]>().notNull(),
    hasConflict: boolean("has_conflict").default(false).notNull(),
    canUseForQuiz: boolean("can_use_for_quiz").default(true).notNull(),
    canUseForScenario: boolean("can_use_for_scenario").default(true).notNull(),
    canUseForEvaluation: boolean("can_use_for_evaluation")
      .default(true)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("knowledge_units_version_key_unique").on(
      table.knowledgeVersionId,
      table.unitKey,
    ),
    index("knowledge_units_semantic_key_idx").on(table.semanticKey),
  ],
);

export const quizSets = pgTable(
  "quiz_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    knowledgeVersionId: uuid("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    quizHash: text("quiz_hash").notNull(),
    sourceQuizHash: text("source_quiz_hash"),
    title: text("title").notNull(),
    description: text("description"),
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    passingScore: integer("passing_score").default(80).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...auditTimestamps(),
  },
  (table) => [
    unique("quiz_sets_hash_unique").on(table.quizHash),
    check(
      "quiz_sets_passing_score_check",
      sql`${table.passingScore} between 0 and 100`,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    knowledgeVersionId: uuid("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    knowledgeUnitId: uuid("knowledge_unit_id")
      .notNull()
      .references(() => knowledgeUnits.id, { onDelete: "restrict" }),
    questionKey: text("question_key").notNull(),
    type: questionTypeEnum("type").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctAnswers: jsonb("correct_answers").$type<string[]>().notNull(),
    explanation: text("explanation").notNull(),
    category: text("category").notNull(),
    difficulty: difficultyEnum("difficulty").default("easy").notNull(),
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...auditTimestamps(),
  },
  (table) => [
    unique("questions_version_key_unique").on(
      table.knowledgeVersionId,
      table.questionKey,
    ),
    index("questions_knowledge_unit_idx").on(table.knowledgeUnitId),
    index("questions_status_category_idx").on(table.status, table.category),
  ],
);

export const questionReviews = pgTable(
  "question_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    contentHash: text("content_hash").notNull(),
    snapshot: jsonb("snapshot").$type<QuizQuestionDraft>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("question_reviews_question_hash_unique").on(
      table.questionId,
      table.contentHash,
    ),
    index("question_reviews_reviewer_created_idx").on(
      table.reviewerId,
      table.createdAt,
    ),
  ],
);

export const quizSetQuestions = pgTable(
  "quiz_set_questions",
  {
    quizSetId: uuid("quiz_set_id")
      .notNull()
      .references(() => quizSets.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
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

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id").references(
      (): AnyPgColumn => assignments.id,
      { onDelete: "set null" },
    ),
    quizSetId: uuid("quiz_set_id")
      .notNull()
      .references(() => quizSets.id, { onDelete: "restrict" }),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    knowledgeVersionId: uuid("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    status: quizAttemptStatusEnum("status").default("in_progress").notNull(),
    correctCount: integer("correct_count").default(0).notNull(),
    totalQuestions: integer("total_questions").notNull(),
    score: integer("score"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
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
  ],
);

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizAttemptId: uuid("quiz_attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    selectedAnswers: jsonb("selected_answers").$type<string[]>().notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("quiz_answers_attempt_question_unique").on(
      table.quizAttemptId,
      table.questionId,
    ),
  ],
);

export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scenarioKey: text("scenario_key").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...auditTimestamps(),
  },
  (table) => [
    unique("scenarios_key_unique").on(table.scenarioKey),
  ],
);

export const scenarioVersions = pgTable(
  "scenario_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "restrict" }),
    versionKey: text("version_key").notNull(),
    version: integer("version").notNull(),
    knowledgeVersionId: uuid("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    background: text("background").notNull(),
    summary: text("summary").notNull(),
    firstCustomerMessage: text("first_customer_message").notNull(),
    controlledVariables: jsonb("controlled_variables")
      .$type<Record<string, unknown>>()
      .notNull(),
    hiddenFacts: jsonb("hidden_facts").$type<string[]>().notNull(),
    customerTurns: jsonb("customer_turns").$type<string[]>().notNull(),
    checkpoints: jsonb("checkpoints").$type<string[]>().notNull(),
    prohibitions: jsonb("prohibitions").$type<string[]>().notNull(),
    scoringWeights: jsonb("scoring_weights")
      .$type<Record<string, number>>()
      .notNull(),
    scoringDimensions: jsonb("scoring_dimensions")
      .$type<ScenarioTemplate["scoringDimensions"]>()
      .notNull(),
    criticalRisks: jsonb("critical_risks")
      .$type<ScenarioTemplate["criticalRisks"]>()
      .notNull(),
    referenceFlow: jsonb("reference_flow").$type<string[]>().notNull(),
    referenceReply: text("reference_reply").notNull(),
    sources: jsonb("sources").$type<SourceLocator[]>().notNull(),
    maxTurns: integer("max_turns").default(12).notNull(),
    mockMode: boolean("mock_mode").default(true).notNull(),
    status: lifecycleStatusEnum("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("scenario_versions_key_unique").on(table.versionKey),
    unique("scenario_versions_number_unique").on(
      table.scenarioId,
      table.version,
    ),
    check(
      "scenario_versions_max_turns_check",
      sql`${table.maxTurns} between 8 and 16`,
    ),
    check(
      "scenario_versions_mock_mode_check",
      sql`${table.mockMode} = true`,
    ),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedById: uuid("assigned_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignmentType: assignmentTypeEnum("assignment_type").notNull(),
    quizSetId: uuid("quiz_set_id").references(() => quizSets.id, {
      onDelete: "restrict",
    }),
    scenarioVersionId: uuid("scenario_version_id").references(
      () => scenarioVersions.id,
      { onDelete: "restrict" },
    ),
    status: assignmentStatusEnum("status").default("assigned").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("assignments_learner_status_idx").on(
      table.learnerId,
      table.status,
    ),
    check(
      "assignments_target_check",
      sql`(
        (${table.assignmentType} = 'quiz' and ${table.quizSetId} is not null and ${table.scenarioVersionId} is null)
        or
        (${table.assignmentType} = 'scenario' and ${table.quizSetId} is null and ${table.scenarioVersionId} is not null)
      )`,
    ),
  ],
);

export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id").references(() => assignments.id, {
      onDelete: "set null",
    }),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    knowledgeVersionId: uuid("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    scenarioVersionId: uuid("scenario_version_id")
      .notNull()
      .references(() => scenarioVersions.id, { onDelete: "restrict" }),
    status: trainingSessionStatusEnum("status")
      .default("in_progress")
      .notNull(),
    mode: text("mode").default("mock").notNull(),
    turnCount: integer("turn_count").default(0).notNull(),
    lastError: text("last_error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("training_sessions_learner_started_idx").on(
      table.learnerId,
      table.startedAt,
    ),
    check(
      "training_sessions_mock_mode_check",
      sql`${table.mode} = 'mock'`,
    ),
  ],
);

export const trainingMessages = pgTable(
  "training_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trainingSessionId: uuid("training_session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    sender: messageSenderEnum("sender").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("training_messages_session_position_unique").on(
      table.trainingSessionId,
      table.position,
    ),
  ],
);

export const evaluationReports = pgTable(
  "evaluation_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trainingSessionId: uuid("training_session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "restrict" }),
    knowledgeVersionId: uuid("knowledge_version_id")
      .notNull()
      .references(() => knowledgeVersions.id, { onDelete: "restrict" }),
    totalScore: integer("total_score").notNull(),
    verdict: evaluationVerdictEnum("verdict").notNull(),
    dimensions: jsonb("dimensions")
      .$type<ScenarioEvaluationReport["dimensions"]>()
      .notNull(),
    strengths: jsonb("strengths").$type<string[]>().notNull(),
    omissions: jsonb("omissions").$type<string[]>().notNull(),
    risks: jsonb("risks").$type<string[]>().notNull(),
    recommendations: jsonb("recommendations").$type<string[]>().notNull(),
    turnFeedback: jsonb("turn_feedback")
      .$type<Array<Record<string, unknown>>>()
      .notNull(),
    recommendedFlow: jsonb("recommended_flow").$type<string[]>().notNull(),
    sampleReply: text("sample_reply").notNull(),
    evidence: jsonb("evidence")
      .$type<Array<Record<string, unknown>>>()
      .notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    needsReview: boolean("needs_review").default(false).notNull(),
    reviewTrigger: reviewTriggerEnum("review_trigger"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
  ],
);

export const reviewDecisions = pgTable(
  "review_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    evaluationReportId: uuid("evaluation_report_id")
      .notNull()
      .references(() => evaluationReports.id, { onDelete: "restrict" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: reviewDecisionStatusEnum("status").notNull(),
    correctedVerdict: evaluationVerdictEnum("corrected_verdict"),
    correctedScore: integer("corrected_score"),
    comment: text("comment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("review_decisions_report_unique").on(
      table.evaluationReportId,
    ),
    index("review_decisions_report_created_idx").on(
      table.evaluationReportId,
      table.createdAt,
    ),
    check(
      "review_decisions_corrected_score_check",
      sql`${table.correctedScore} is null or ${table.correctedScore} between 0 and 100`,
    ),
  ],
);

export const mvpTables = {
  users,
  knowledgeVersions,
  knowledgeSources,
  knowledgeUnits,
  quizSets,
  questions,
  questionReviews,
  quizSetQuestions,
  quizAttempts,
  quizAnswers,
  scenarios,
  scenarioVersions,
  assignments,
  trainingSessions,
  trainingMessages,
  evaluationReports,
  reviewDecisions,
};

function auditTimestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  };
}

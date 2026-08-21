import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import {
  evaluationReports,
  feishuIdentities,
  knowledgeUnits,
  knowledgeVersions,
  mvpTables,
  questionCatalogs,
  questionCatalogPublications,
  questions,
  quizAttempts,
  quizAttemptQuestions,
  quizSets,
  remediationExams,
  remediationExamTargets,
  scenarios,
  scenarioVersions,
  trainingSessions,
  users,
} from "./schema";

function columnNames(
  table: Parameters<typeof getTableConfig>[0],
): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

describe("MVP database schema", () => {
  it("declares every durable entity required by the training workflow", () => {
    expect(
      Object.values(mvpTables)
        .map((table) => getTableConfig(table).name)
        .sort(),
    ).toEqual(
      [
        "evaluation_reports",
        "feishu_identities",
        "knowledge_sources",
        "knowledge_units",
        "knowledge_versions",
        "question_catalogs",
        "question_catalog_publications",
        "questions",
        "quiz_answers",
        "quiz_attempt_questions",
        "quiz_attempts",
        "quiz_set_questions",
        "quiz_sets",
        "remediation_exams",
        "remediation_exam_targets",
        "scenario_versions",
        "scenarios",
        "training_messages",
        "training_sessions",
        "users",
        "topic_quiz_answers",
        "topic_quiz_attempts",
      ].sort(),
    );
  });

  it("stores remediation metadata separately from immutable attempt snapshots", () => {
    expect(columnNames(remediationExams)).toEqual(expect.arrayContaining(["learner_id", "quiz_set_id", "attempt_id", "weakness_fingerprint", "report_data_cutoff_at", "status"]));
    expect(columnNames(remediationExamTargets)).toEqual(expect.arrayContaining(["exam_id", "category", "position", "question_count"]));
  });

  it("binds mutable authoring rows to stable external identities", () => {
    expect(columnNames(questions)).toEqual(
      expect.arrayContaining(["knowledge_version_id", "question_key"]),
    );
    expect(columnNames(quizSets)).toEqual(
      expect.arrayContaining([
        "knowledge_version_id",
        "quiz_hash",
        "source_quiz_hash",
        "published_at",
      ]),
    );
    expect(columnNames(scenarios)).toContain("scenario_key");
    expect(columnNames(scenarioVersions)).toEqual(
      expect.arrayContaining([
        "version_key",
        "summary",
        "customer_turns",
        "scoring_dimensions",
        "critical_risks",
        "reference_flow",
        "sources",
        "mock_mode",
      ]),
    );
  });

  it("models RBAC and immutable question revisions explicitly", () => {
    expect(columnNames(users)).toContain("role");
    expect(columnNames(questionCatalogs)).toEqual(
      expect.arrayContaining(["stable_key", "created_at"]),
    );
    expect(columnNames(questionCatalogPublications)).toEqual(
      expect.arrayContaining(["catalog_id", "current_question_id", "published_by_id"]),
    );
    expect(columnNames(questions)).toEqual(
      expect.arrayContaining([
        "question_catalog_id",
        "revision",
        "content_hash",
        "knowledge_unit_key",
        "sources",
        "created_by_id",
      ]),
    );
    expect(columnNames(quizSets)).toEqual(
      expect.arrayContaining(["kind", "topic_id"]),
    );
  });

  it("uses text IDs, JSON text and millisecond timestamps for SQLite", () => {
    const questionConfig = getTableConfig(questions);
    expect(
      questionConfig.uniqueConstraints.map((item) => item.name),
    ).toEqual(
      expect.arrayContaining([
        "questions_catalog_revision_unique",
        "questions_catalog_content_unique",
      ]),
    );
    expect(users.id.getSQLType()).toBe("text");
    expect(questions.options.getSQLType()).toBe("text");
    expect(quizAttempts.startedAt.getSQLType()).toBe("integer");
    expect(evaluationReports.confidence.getSQLType()).toBe("real");
  });

  it("links attempts and mock sessions to durable workflow state", () => {
    expect(columnNames(quizAttempts)).not.toContain("assignment_id");
    expect(columnNames(quizAttemptQuestions)).toEqual(
      expect.arrayContaining(["quiz_attempt_id", "question_id", "position"]),
    );
    expect(columnNames(trainingSessions)).toContain("mode");
    expect(columnNames(evaluationReports)).toContain("recommendations");

    expect(
      getTableConfig(quizSets).uniqueConstraints.map((item) => item.name),
    ).toContain("quiz_sets_hash_unique");
    expect(
      getTableConfig(scenarios).uniqueConstraints.map(
        (item) => item.name,
      ),
    ).toContain("scenarios_key_unique");
    expect(
      getTableConfig(scenarioVersions).uniqueConstraints.map(
        (item) => item.name,
      ),
    ).toContain("scenario_versions_key_unique");
  });

  it("keeps learner account compatibility and traceable version bindings explicit", () => {
    expect(columnNames(users)).toEqual(
      expect.arrayContaining([
        "email",
        "password_hash",
        "is_active",
      ]),
    );
    expect(columnNames(knowledgeVersions)).toEqual(
      expect.arrayContaining([
        "version_hash",
        "status",
        "is_active",
        "published_at",
      ]),
    );
    expect(columnNames(knowledgeUnits)).toEqual(
      expect.arrayContaining([
        "knowledge_version_id",
        "unit_key",
        "content_hash",
        "sources",
      ]),
    );
    expect(columnNames(trainingSessions)).toEqual(
      expect.arrayContaining([
        "learner_id",
        "knowledge_version_id",
        "scenario_version_id",
        "status",
      ]),
    );
    expect(columnNames(evaluationReports)).toEqual(
      expect.arrayContaining([
        "training_session_id",
        "knowledge_version_id",
        "verdict",
        "confidence",
      ]),
    );
  });

  it("enforces one Feishu identity per user and unique union id", () => {
    const identityConfig = getTableConfig(feishuIdentities);

    expect(
      identityConfig.uniqueConstraints.map((item) => item.name),
    ).toEqual(
      expect.arrayContaining([
        "feishu_identities_user_unique",
        "feishu_identities_union_unique",
      ]),
    );
  });

  it("enforces one active knowledge version and unique user email", () => {
    const userConfig = getTableConfig(users);
    const versionConfig = getTableConfig(knowledgeVersions);

    expect(userConfig.uniqueConstraints.map((item) => item.name)).toContain(
      "users_email_unique",
    );
    expect(versionConfig.indexes.map((item) => item.config.name)).toContain(
      "knowledge_versions_single_active_idx",
    );
  });
});

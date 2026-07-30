import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  assignments,
  evaluationReports,
  knowledgeUnits,
  knowledgeVersions,
  mvpTables,
  questions,
  questionReviews,
  quizAttempts,
  quizSets,
  reviewDecisions,
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
        "assignments",
        "evaluation_reports",
        "knowledge_sources",
        "knowledge_units",
        "knowledge_versions",
        "questions",
        "question_reviews",
        "quiz_answers",
        "quiz_attempts",
        "quiz_set_questions",
        "quiz_sets",
        "review_decisions",
        "scenario_versions",
        "scenarios",
        "training_messages",
        "training_sessions",
        "users",
      ].sort(),
    );
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

  it("records content-hash approvals instead of mutating audit history", () => {
    expect(mvpTables.questionReviews).toBe(questionReviews);
    expect(columnNames(questionReviews)).toEqual(
      expect.arrayContaining([
        "question_id",
        "reviewer_id",
        "content_hash",
        "snapshot",
        "created_at",
      ]),
    );

    const questionConfig = getTableConfig(questions);
    const reviewConfig = getTableConfig(questionReviews);
    expect(
      questionConfig.uniqueConstraints.map((item) => item.name),
    ).toContain("questions_version_key_unique");
    expect(
      reviewConfig.uniqueConstraints.map((item) => item.name),
    ).toContain("question_reviews_question_hash_unique");
  });

  it("links attempts and mock sessions to durable workflow state", () => {
    expect(columnNames(quizAttempts)).toContain("assignment_id");
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

  it("allows only one final review decision per evaluation report", () => {
    expect(
      getTableConfig(reviewDecisions).uniqueConstraints.map(
        (item) => item.name,
      ),
    ).toContain("review_decisions_report_unique");
  });

  it("keeps credentials, roles and traceable version bindings explicit", () => {
    expect(columnNames(users)).toEqual(
      expect.arrayContaining([
        "email",
        "password_hash",
        "role",
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
        "needs_review",
      ]),
    );
    expect(columnNames(assignments)).toEqual(
      expect.arrayContaining([
        "learner_id",
        "assigned_by_id",
        "assignment_type",
        "quiz_set_id",
        "scenario_version_id",
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

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseClient } from "../client";
import { createTestDatabase } from "../test-support/create-test-database";
import { DbLearningQuizReportStore } from "./db-learning-quiz-report-store";

describe("DbLearningQuizReportStore", () => {
  let database: DatabaseClient;
  let client: DatabaseClient["$client"];
  let store: DbLearningQuizReportStore;

  beforeEach(async () => {
    ({ database, client } = await createTestDatabase());
    seedReportFixture(database);
    store = new DbLearningQuizReportStore(database);
  });

  afterEach(() => client.close());

  it("aggregates completed standard and legacy knowledge attempts without regrading history", async () => {
    const report = await store.getReport("learner-1", {
      preset: "custom", startDate: "2026-08-20", endDate: "2026-08-21",
    });

    expect(report.summary).toEqual({
      completedAttempts: 3,
      answeredCount: 5,
      correctCount: 2,
      accuracy: 40,
      passedAttempts: 1,
      passRate: 33,
    });
    expect(report.trend.map((item) => item.date)).toEqual(["2026-08-20", "2026-08-21"]);
    expect(report.categories[0]).toMatchObject({
      category: "产品属性及卖点", answeredCount: 3, wrongCount: 3, errorRate: 100,
    });
    expect(report.questionWeaknesses[0]).toMatchObject({
      stableKey: "q-product", classification: "high_frequency", wrongCount: 2,
    });
    expect(report.questionWeaknesses[0]?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        revisionId: "question-v1",
        prompt: "历史题干",
        selectedAnswers: ["错误选项"],
        correctAnswers: ["正确选项"],
        explanation: "历史解析",
        source: "standard",
      }),
      expect.objectContaining({ source: "legacy", isCorrect: false }),
    ]));
    expect(report.questionWeaknesses[1]).toMatchObject({
      stableKey: "missing-legacy-key", classification: "period_mistake", wrongCount: 1,
    });
    expect(report.questionWeaknesses[1]?.evidence[0]).toMatchObject({
      revisionId: null, prompt: null, correctAnswers: null, explanation: null,
    });
  });

  it("uses Beijing boundaries, excludes in-progress and other learners, and returns an empty report", async () => {
    const today = await store.getReport("learner-1", { preset: "today" }, new Date("2026-08-21T12:00:00Z"));
    expect(today.summary.completedAttempts).toBe(2);
    expect(today.summary.answeredCount).toBe(3);
    expect(today.trend).toHaveLength(1);
    expect(today.trend[0]?.date).toBe("2026-08-21");

    const empty = await store.getReport("learner-empty", { preset: "today" }, new Date("2026-08-21T12:00:00Z"));
    expect(empty.summary).toEqual({
      completedAttempts: 0, answeredCount: 0, correctCount: 0, accuracy: 0,
      passedAttempts: 0, passRate: 0,
    });
    expect(empty.categories).toEqual([]);
    expect(empty.questionWeaknesses).toEqual([]);
  });
});

function seedReportFixture(database: DatabaseClient) {
  const sql = database.$client;
  sql.exec(`
    INSERT INTO users (id, email, name, password_hash, role) VALUES
      ('learner-1', 'lou@example.test', '娄伊娜', 'disabled', 'learner'),
      ('learner-2', 'other@example.test', '其他学员', 'disabled', 'learner'),
      ('learner-empty', 'empty@example.test', '空记录学员', 'disabled', 'learner');
    INSERT INTO knowledge_versions
      (id, version_hash, content_hash, schema_version, source_root, status, is_active, coverage)
    VALUES ('kv-1', '${"a".repeat(64)}', '${"b".repeat(64)}', 1, '/fixture', 'published', 1, '{}');
    INSERT INTO question_catalogs (id, stable_key) VALUES
      ('catalog-product', 'q-product'), ('catalog-service', 'q-service');
    INSERT INTO questions
      (id, question_catalog_id, revision, content_hash, knowledge_version_id, knowledge_unit_key,
       question_key, type, prompt, options, correct_answers, explanation, category, difficulty, sources, status,
       created_at, updated_at)
    VALUES
      ('question-v1', 'catalog-product', 1, '${"c".repeat(64)}', 'kv-1', 'ku-1', 'q-product',
       'single_choice', '历史题干', '["正确选项","错误选项"]', '["正确选项"]', '历史解析',
       '产品属性及卖点', 'easy', '[]', 'published', 1700000000000, 1700000000000),
      ('question-service', 'catalog-service', 1, '${"d".repeat(64)}', 'kv-1', 'ku-2', 'q-service',
       'single_choice', '服务题干', '["对","错"]', '["对"]', '服务解析',
       '服务流程与规则', 'easy', '[]', 'published', 1700000000000, 1700000000000);
    INSERT INTO quiz_sets
      (id, knowledge_version_id, quiz_hash, content_hash, title, kind, topic_id, status, passing_score)
    VALUES
      ('formal-set', 'kv-1', '${"e".repeat(64)}', '${"f".repeat(64)}', '正式题', 'formal', NULL, 'published', 80),
      ('topic-set', 'kv-1', '${"1".repeat(64)}', '${"2".repeat(64)}', '专题题', 'topic', '服务流程与规则', 'published', 80),
      ('remediation-set', 'kv-1', '${"3".repeat(64)}', '${"4".repeat(64)}', '改善题', 'remediation', NULL, 'published', 80);
    INSERT INTO quiz_attempts
      (id, quiz_set_id, learner_id, knowledge_version_id, status, correct_count, total_questions, score, started_at, completed_at)
    VALUES
      ('attempt-old', 'formal-set', 'learner-1', 'kv-1', 'needs_retry', 1, 2, 50, 1787155200000, 1787155200000),
      ('attempt-today', 'remediation-set', 'learner-1', 'kv-1', 'passed', 1, 1, 100, 1787241600000, 1787241600000),
      ('attempt-progress', 'formal-set', 'learner-1', 'kv-1', 'in_progress', 0, 1, NULL, 1787241600000, NULL),
      ('attempt-other', 'formal-set', 'learner-2', 'kv-1', 'passed', 1, 1, 100, 1787241600000, 1787241600000);
    INSERT INTO quiz_answers
      (id, quiz_attempt_id, question_id, selected_answers, is_correct, answered_at)
    VALUES
      ('answer-1', 'attempt-old', 'question-v1', '["错误选项"]', 0, 1787155200000),
      ('answer-2', 'attempt-old', 'question-service', '["对"]', 1, 1787155200000),
      ('answer-3', 'attempt-today', 'question-service', '["对"]', 1, 1787241600000),
      ('answer-other', 'attempt-other', 'question-service', '["对"]', 1, 1787241600000);
    INSERT INTO topic_quiz_attempts
      (id, learner_id, topic_id, quiz_hash, status, correct_count, total_questions, score, completed_at)
    VALUES
      ('legacy-today', 'learner-1', '产品属性及卖点', '${"5".repeat(64)}', 'needs_retry', 0, 2, 0, 1787245200000),
      ('legacy-progress', 'learner-1', '产品属性及卖点', '${"6".repeat(64)}', 'in_progress', 0, 1, 0, 1787245200000);
    INSERT INTO topic_quiz_answers
      (id, topic_quiz_attempt_id, question_key, selected_answers, is_correct, answered_at)
    VALUES
      ('legacy-answer-1', 'legacy-today', 'q-product', '["旧错误"]', 0, 1787245200000),
      ('legacy-answer-2', 'legacy-today', 'missing-legacy-key', '["未知"]', 0, 1787245200000),
      ('legacy-progress-answer', 'legacy-progress', 'q-product', '["错误选项"]', 0, 1787245200000);
  `);
}

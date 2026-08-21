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

  it("does not map a legacy answer to a revision created after the answer", async () => {
    const answeredAt = Date.parse("2026-08-21T01:00:00.000Z");
    client.exec(`
      INSERT INTO question_catalogs (id, stable_key) VALUES ('catalog-future', 'future-only-key');
      INSERT INTO questions
        (id, question_catalog_id, revision, content_hash, knowledge_version_id, knowledge_unit_key,
         question_key, type, prompt, options, correct_answers, explanation, category, difficulty, sources, status,
         created_at, updated_at)
      VALUES
        ('question-future', 'catalog-future', 1, '${"7".repeat(64)}', 'kv-1', 'ku-future', 'future-only-key',
         'single_choice', '未来题干', '["正确","错误"]', '["正确"]', '未来解析',
         '产品属性及卖点', 'easy', '[]', 'published', ${answeredAt + 60_000}, ${answeredAt + 60_000});
      INSERT INTO topic_quiz_attempts
        (id, learner_id, topic_id, quiz_hash, status, correct_count, total_questions, score, completed_at)
      VALUES
        ('legacy-future', 'learner-1', '产品属性及卖点', '${"8".repeat(64)}', 'needs_retry', 0, 1, 0, ${answeredAt});
      INSERT INTO topic_quiz_answers
        (id, topic_quiz_attempt_id, question_key, selected_answers, is_correct, answered_at)
      VALUES
        ('legacy-future-answer', 'legacy-future', 'future-only-key', '["错误"]', 0, ${answeredAt});
    `);

    const report = await store.getReport("learner-1", {
      preset: "custom", startDate: "2026-08-21", endDate: "2026-08-21",
    });
    const weakness = report.questionWeaknesses.find((item) => item.stableKey === "future-only-key");

    expect(weakness?.evidence[0]).toMatchObject({
      revisionId: null, prompt: null, correctAnswers: null, explanation: null, isCorrect: false,
    });
  });

  it("assigns standard and legacy answers to the Beijing completion date in trend", async () => {
    const answeredAt = Date.parse("2026-08-20T15:59:00.000Z");
    const completedAt = Date.parse("2026-08-20T16:01:00.000Z");
    client.exec(`
      INSERT INTO quiz_attempts
        (id, quiz_set_id, learner_id, knowledge_version_id, status, correct_count, total_questions, score, started_at, completed_at)
      VALUES
        ('attempt-cross-midnight', 'formal-set', 'learner-1', 'kv-1', 'passed', 1, 1, 100, ${answeredAt}, ${completedAt});
      INSERT INTO quiz_answers
        (id, quiz_attempt_id, question_id, selected_answers, is_correct, answered_at)
      VALUES
        ('answer-cross-midnight', 'attempt-cross-midnight', 'question-service', '["对"]', 1, ${answeredAt});
      INSERT INTO topic_quiz_attempts
        (id, learner_id, topic_id, quiz_hash, status, correct_count, total_questions, score, completed_at)
      VALUES
        ('legacy-cross-midnight', 'learner-1', '产品属性及卖点', '${"9".repeat(64)}', 'needs_retry', 0, 1, 0, ${completedAt});
      INSERT INTO topic_quiz_answers
        (id, topic_quiz_attempt_id, question_key, selected_answers, is_correct, answered_at)
      VALUES
        ('legacy-answer-cross-midnight', 'legacy-cross-midnight', 'q-product', '["错误选项"]', 0, ${answeredAt});
    `);

    const report = await store.getReport("learner-1", {
      preset: "custom", startDate: "2026-08-21", endDate: "2026-08-21",
    });

    expect(report.trend.map((item) => item.date)).toEqual(["2026-08-21"]);
    expect(report.trend.reduce((sum, item) => sum + item.completedAttempts, 0)).toBe(report.summary.completedAttempts);
    expect(report.trend.reduce((sum, item) => sum + item.answeredCount, 0)).toBe(report.summary.answeredCount);
    expect(report.questionWeaknesses.find((item) => item.stableKey === "q-product")?.evidence)
      .toEqual(expect.arrayContaining([expect.objectContaining({
        answeredAt: new Date(answeredAt).toISOString(),
      })]));
  });

  it("sorts equal-rounded weakness rates by their raw ratios before recency", async () => {
    client.prepare("INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, 'disabled', 'learner')")
      .run("learner-ratio", "ratio@example.test", "比例测试学员");
    seedRatioFixture(database, { key: "ratio-rank-1", category: "比例排名一", answeredCount: 2, wrongAt: 1787245100000 });
    seedRatioFixture(database, { key: "ratio-rank-2", category: "比例排名二", answeredCount: 3, wrongAt: 1787245100000 });
    seedRatioFixture(database, { key: "ratio-rank-3", category: "比例排名三", answeredCount: 4, wrongAt: 1787245100000 });
    seedRatioFixture(database, { key: "ratio-rank-4", category: "比例排名四", answeredCount: 5, wrongAt: 1787245100000 });
    seedRatioFixture(database, { key: "ratio-higher", category: "比例较高", answeredCount: 101, wrongAt: 1787155200000 });
    seedRatioFixture(database, { key: "ratio-lower", category: "比例较低", answeredCount: 149, wrongAt: 1787245200000 });

    const report = await store.getReport("learner-ratio", {
      preset: "custom", startDate: "2026-08-20", endDate: "2026-08-21",
    });
    const questionKeys = report.questionWeaknesses.map((item) => item.stableKey);
    const categoryKeys = report.categories.map((item) => item.category);

    expect(report.questionWeaknesses.find((item) => item.stableKey === "ratio-higher")?.errorRate).toBe(1);
    expect(report.questionWeaknesses.find((item) => item.stableKey === "ratio-lower")?.errorRate).toBe(1);
    expect(questionKeys.indexOf("ratio-higher")).toBeLessThan(questionKeys.indexOf("ratio-lower"));
    expect(categoryKeys.indexOf("比例较高")).toBeLessThan(categoryKeys.indexOf("比例较低"));
    expect(questionKeys.slice(0, 5)).toContain("ratio-higher");
    expect(questionKeys.slice(0, 5)).not.toContain("ratio-lower");
    expect(categoryKeys.slice(0, 5)).toContain("比例较高");
    expect(categoryKeys.slice(0, 5)).not.toContain("比例较低");
  });
});

function seedRatioFixture(
  database: DatabaseClient,
  input: { key: string; category: string; answeredCount: number; wrongAt: number },
) {
  const sql = database.$client;
  const catalogId = `catalog-${input.key}`;
  const questionId = `question-${input.key}`;
  sql.prepare("INSERT INTO question_catalogs (id, stable_key) VALUES (?, ?)").run(catalogId, input.key);
  sql.prepare(`
    INSERT INTO questions
      (id, question_catalog_id, revision, content_hash, knowledge_version_id, knowledge_unit_key,
       question_key, type, prompt, options, correct_answers, explanation, category, difficulty, sources, status,
       created_at, updated_at)
    VALUES (?, ?, 1, ?, 'kv-1', ?, ?, 'single_choice', ?, '["对","错"]', '["对"]', ?, ?, 'easy', '[]', 'published', 1700000000000, 1700000000000)
  `).run(questionId, catalogId, input.key.repeat(64).slice(0, 64), `ku-${input.key}`, input.key, input.key, input.key, input.category);
  const insertAttempt = sql.prepare(`
    INSERT INTO quiz_attempts
      (id, quiz_set_id, learner_id, knowledge_version_id, status, correct_count, total_questions, score, started_at, completed_at)
    VALUES (?, 'formal-set', 'learner-ratio', 'kv-1', ?, ?, 1, ?, ?, ?)
  `);
  const insertAnswer = sql.prepare(`
    INSERT INTO quiz_answers (id, quiz_attempt_id, question_id, selected_answers, is_correct, answered_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (let index = 0; index < input.answeredCount; index += 1) {
    const isCorrect = index !== 0;
    const attemptId = `attempt-${input.key}-${index}`;
    const completedAt = isCorrect ? input.wrongAt + index + 1 : input.wrongAt;
    insertAttempt.run(attemptId, isCorrect ? "passed" : "needs_retry", isCorrect ? 1 : 0, isCorrect ? 100 : 0, completedAt, completedAt);
    insertAnswer.run(
      `answer-${input.key}-${index}`,
      attemptId,
      questionId,
      isCorrect ? '["对"]' : '["错"]',
      isCorrect ? 1 : 0,
      completedAt,
    );
  }
}

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

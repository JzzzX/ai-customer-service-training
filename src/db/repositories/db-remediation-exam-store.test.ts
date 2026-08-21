import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseClient, type DatabaseClient } from "../client";
import { initializeDemoDatabase } from "../demo-fixture";
import { DbQuizAttemptStore } from "./db-quiz-attempt-store";
import { DbRemediationExamStore } from "./db-remediation-exam-store";
import { DbLearningQuizReportStore } from "./db-learning-quiz-report-store";
import { quizSets } from "../schema";
import { eq } from "drizzle-orm";
import { topicQuizQuestions } from "@/lib/quiz/question-bank";
import { DEMO_USER_ID } from "@/lib/runtime/demo-identity";

const range = { preset: "custom" as const, startDate: "2026-08-20", endDate: "2026-08-22" };

describe("DbRemediationExamStore", () => {
  let database: DatabaseClient;
  let attempts: DbQuizAttemptStore;
  let store: DbRemediationExamStore;

  beforeEach(() => {
    database = createDatabaseClient(":memory:");
    initializeDemoDatabase(database);
    attempts = new DbQuizAttemptStore(database);
    store = new DbRemediationExamStore(database);
  });

  afterEach(() => database.$client.close());

  it("does not create an exam when the report has no wrong answers", () => {
    expect(store.generate(DEMO_USER_ID, range)).toEqual({ status: "no_weakness" });
    expect(database.$client.prepare("select count(*) as count from remediation_exams").get()).toEqual({ count: 0 });
  });

  it("creates one immutable ten-question exam and returns it for the same fingerprint", async () => {
    const missed = topicQuizQuestions.filter((question) => question.category === "产品属性及卖点").slice(0, 6);
    await completeTopic("产品属性及卖点", missed.map((question) => question.id), false, "2026-08-21T02:00:00.000Z");

    const first = store.generate(DEMO_USER_ID, range);
    expect(first.status).toBe("created");
    if (first.status !== "created") return;
    expect(first.exam.targets).toEqual([{ category: "产品属性及卖点", questionCount: 10 }]);
    expect(first.exam.questions).toHaveLength(10);
    expect(new Set(first.exam.questions.map((question) => question.stableKey))).toHaveLength(10);
    expect(first.exam.questions.filter((question) => missed.some((item) => item.id === question.stableKey))).toHaveLength(4);

    const repeated = store.generate(DEMO_USER_ID, range);
    expect(repeated).toMatchObject({ status: "existing", exam: { id: first.exam.id, weaknessFingerprint: first.exam.weaknessFingerprint } });
    expect(database.$client.prepare("select count(*) as count from remediation_exams").get()).toEqual({ count: 1 });
  });

  it("reuses one exam for today and an equivalent custom range", async () => {
    const question = topicQuizQuestions.find((item) => item.category === "产品属性及卖点")!;
    await completeTopic("产品属性及卖点", [question.id], false, "2026-08-21T02:00:00.000Z");
    const first = store.generate(DEMO_USER_ID, { preset: "today" }, new Date("2026-08-21T08:00:00.000Z"));
    const equivalent = store.generate(DEMO_USER_ID, { preset: "custom", startDate: "2026-08-21", endDate: "2026-08-21" });
    expect(first.status).toBe("created");
    expect(equivalent).toMatchObject({ status: "existing", exam: { id: first.status === "created" ? first.exam.id : "missing" } });
  });

  it("splits two target categories five-five and applies double eighty grading", async () => {
    await completeTopic("产品属性及卖点", [topicQuizQuestions.find((q) => q.category === "产品属性及卖点")!.id], false, "2026-08-21T01:00:00.000Z");
    await completeTopic("日常问答", [topicQuizQuestions.find((q) => q.category === "日常问答")!.id], false, "2026-08-21T02:00:00.000Z");
    const generated = store.generate(DEMO_USER_ID, range);
    expect(generated.status).toBe("created");
    if (generated.status !== "created") return;
    expect(generated.exam.targets.map((target) => target.questionCount)).toEqual([5, 5]);

    const snapshot = await attempts.loadSnapshot(DEMO_USER_ID, generated.exam.attemptId);
    const answers = snapshot.questions.map((question, index) => ({
      questionId: question.id,
      selectedAnswers: index < 2 ? [question.options.find((option) => !question.correctAnswers.includes(option))!] : question.correctAnswers,
      isCorrect: true,
    }));
    await attempts.saveAttempt({ attemptId: snapshot.attemptId, learnerId: DEMO_USER_ID, quizHash: snapshot.quizHash, passingScore: 80, answers, completedAt: "2026-08-21T03:00:00.000Z" });
    const completed = store.loadForLearner(DEMO_USER_ID, generated.exam.id);
    expect(completed.result).toMatchObject({ totalScore: 80, overallPassed: true, improved: false });
    expect(completed.result?.categories.map((item) => item.accuracy)).toEqual([60, 100]);
    expect(new DbLearningQuizReportStore(database).getReport(DEMO_USER_ID, range).remediationExams[0]?.result?.improved).toBe(false);
    const next = store.generate(DEMO_USER_ID, range);
    expect(next.status).toBe("created");
    if (next.status === "created") expect(next.exam.weaknessFingerprint).not.toBe(generated.exam.weaknessFingerprint);
  });

  it("returns insufficient-bank without persisting a partial exam", async () => {
    const category = "产品属性及卖点";
    const categoryQuestions = topicQuizQuestions.filter((question) => question.category === category);
    await completeTopic(category, [categoryQuestions[0]!.id], false, "2026-08-21T02:00:00.000Z");
    const keep = categoryQuestions.slice(0, 9).map((question) => `'${question.id}'`).join(",");
    database.$client.exec(`DELETE FROM question_catalog_publications WHERE catalog_id IN (
      SELECT c.id FROM question_catalogs c JOIN questions q ON q.question_catalog_id=c.id WHERE q.category='${category}' AND c.stable_key NOT IN (${keep})
    )`);
    expect(store.generate(DEMO_USER_ID, range)).toEqual({ status: "insufficient_bank", category, required: 10, available: 9 });
    expect(database.$client.prepare("select count(*) as count from remediation_exams").get()).toEqual({ count: 0 });
  });

  it("rolls back attempt, answers, and remediation completion together when the final status update fails", async () => {
    const question = topicQuizQuestions.find((item) => item.category === "产品属性及卖点")!;
    await completeTopic(question.category, [question.id], false, "2026-08-21T02:00:00.000Z");
    const generated = store.generate(DEMO_USER_ID, range);
    expect(generated.status).toBe("created");
    if (generated.status !== "created") return;
    const snapshot = await attempts.loadSnapshot(DEMO_USER_ID, generated.exam.attemptId);
    database.$client.exec(`CREATE TRIGGER reject_remediation_completion BEFORE UPDATE OF status ON remediation_exams
      WHEN NEW.status='completed' BEGIN SELECT RAISE(ABORT, 'forced remediation rollback'); END;`);

    await expect(attempts.saveAttempt({
      attemptId: snapshot.attemptId,
      learnerId: DEMO_USER_ID,
      quizHash: snapshot.quizHash,
      passingScore: 80,
      answers: snapshot.questions.map((item) => ({ questionId: item.id, selectedAnswers: item.correctAnswers, isCorrect: true })),
    })).rejects.toThrow(/forced remediation rollback/);
    expect(database.$client.prepare("SELECT status,completed_at AS completedAt FROM quiz_attempts WHERE id=?").get(snapshot.attemptId)).toEqual({ status: "in_progress", completedAt: null });
    expect(database.$client.prepare("SELECT COUNT(*) AS count FROM quiz_answers WHERE quiz_attempt_id=?").get(snapshot.attemptId)).toEqual({ count: 0 });
    expect(database.$client.prepare("SELECT status,completed_at AS completedAt FROM remediation_exams WHERE id=?").get(generated.exam.id)).toEqual({ status: "in_progress", completedAt: null });
  });

  async function completeTopic(category: string, questionIds: string[], correct: boolean, completedAt: string) {
    const set = database.select({ quizHash: quizSets.quizHash }).from(quizSets).where(eq(quizSets.topicId, category)).get()!;
    const attemptId = crypto.randomUUID();
    const snapshot = await attempts.startAttempt({ attemptId, learnerId: DEMO_USER_ID, quizHash: set.quizHash, topicId: category, questionIds, startedAt: completedAt });
    await attempts.saveAttempt({
      attemptId, learnerId: DEMO_USER_ID, quizHash: set.quizHash, topicId: category, passingScore: 80, completedAt,
      answers: snapshot.questions.map((question) => ({ questionId: question.id, selectedAnswers: correct ? question.correctAnswers : [question.options.find((option) => !question.correctAnswers.includes(option))!], isCorrect: correct })),
    });
  }
});

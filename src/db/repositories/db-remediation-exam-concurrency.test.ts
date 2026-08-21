// @vitest-environment node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../client";
import { initializeDemoDatabase } from "../demo-fixture";
import { DbQuizAttemptStore } from "./db-quiz-attempt-store";
import { DEMO_USER_ID } from "@/lib/runtime/demo-identity";
import { topicQuizQuestions } from "@/lib/quiz/question-bank";

describe("remediation generation concurrency", () => {
  const temporaryDirectories: string[] = [];
  afterEach(() => temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

  it("returns created and existing from two independent SQLite connections for one fingerprint", async () => {
    const directory = mkdtempSync(join(tmpdir(), "remediation-concurrency-"));
    temporaryDirectories.push(directory);
    const sqlitePath = join(directory, "training.sqlite");
    const seed = createDatabaseClient(sqlitePath);
    initializeDemoDatabase(seed);
    const question = topicQuizQuestions.find((item) => item.category === "产品属性及卖点")!;
    const quiz = seed.$client.prepare("SELECT quiz_hash AS quizHash FROM quiz_sets WHERE kind='topic' AND topic_id=?").get(question.category) as { quizHash: string };
    const attemptId = crypto.randomUUID();
    const attempts = new DbQuizAttemptStore(seed);
    const snapshot = await attempts.startAttempt({ attemptId, learnerId: DEMO_USER_ID, quizHash: quiz.quizHash, topicId: question.category, questionIds: [question.id], startedAt: "2026-08-21T02:00:00.000Z" });
    await attempts.saveAttempt({ attemptId, learnerId: DEMO_USER_ID, quizHash: quiz.quizHash, topicId: question.category, passingScore: 80, completedAt: "2026-08-21T02:00:00.000Z", answers: [{ questionId: question.id, selectedAnswers: [snapshot.questions[0]!.options.find((option) => !snapshot.questions[0]!.correctAnswers.includes(option))!], isCorrect: false }] });
    seed.$client.close();

    const gate = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
    const workerUrl = pathToFileURL(resolve(process.cwd(), "tests/load/remediation-generate-worker.ts"));
    const workers = [0, 1].map(() => new Worker(workerUrl, { execArgv: ["--import", "tsx"], workerData: { sqlitePath, learnerId: DEMO_USER_ID, startGate: gate } }));
    let outcomes: Array<{ status: string; examId: string }> = [];
    try {
      const results = workers.map(waitForWorker);
      const state = new Int32Array(gate);
      const deadline = Date.now() + 10_000;
      while (Atomics.load(state, 1) < 2 && Date.now() < deadline) Atomics.wait(state, 1, Atomics.load(state, 1), 100);
      expect(Atomics.load(state, 1)).toBe(2);
      Atomics.store(state, 0, 1);
      Atomics.notify(state, 0, 2);
      outcomes = await Promise.all(results);
    } finally {
      Atomics.store(new Int32Array(gate), 0, 1);
      Atomics.notify(new Int32Array(gate), 0, 2);
      await Promise.all(workers.map((worker) => worker.terminate()));
    }

    expect(outcomes.map((item) => item.status).sort()).toEqual(["created", "existing"]);
    expect(new Set(outcomes.map((item) => item.examId))).toHaveLength(1);
    const verify = createDatabaseClient(sqlitePath);
    expect(verify.$client.prepare("SELECT COUNT(*) AS count FROM remediation_exams WHERE status='in_progress'").get()).toEqual({ count: 1 });
    verify.$client.close();
  }, 20_000);
});

function waitForWorker(worker: Worker): Promise<{ status: string; examId: string }> {
  return new Promise((resolveResult, reject) => {
    worker.once("message", (message: { status?: string; examId?: string; error?: string }) => message.error ? reject(new Error(message.error)) : resolveResult({ status: message.status!, examId: message.examId! }));
    worker.once("error", reject);
  });
}

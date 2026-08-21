import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";

import { and, eq, inArray, sql } from "drizzle-orm";

import { createDatabaseClient } from "../../src/db/client";
import { quizAttempts, quizSets, users } from "../../src/db/schema";

const sqlitePath = process.env.SQLITE_PATH ?? ".tmp/learner-lite-e2e.sqlite";
const clientCount = Number(process.env.SQLITE_LOAD_CLIENTS ?? "30");
const durationMs = Number(process.env.SQLITE_LOAD_DURATION_MS ?? "3000");
const maxWrites = Number(process.env.SQLITE_LOAD_MAX_WRITES ?? "50");
const topicId = "产品属性及卖点";

async function main(): Promise<void> {
  const admin = createDatabaseClient(sqlitePath);
  const learnerIds = Array.from({ length: clientCount }, () => randomUUID());
  try {
    const publishedTopic = admin.select({ quizHash: quizSets.quizHash })
      .from(quizSets)
      .where(and(eq(quizSets.topicId, topicId), eq(quizSets.status, "published")))
      .get();
    if (!publishedTopic) throw new Error(`并发烟测专题未发布：${topicId}`);
    admin.transaction((transaction) => {
      for (const learnerId of learnerIds) {
        transaction.insert(users).values({
          id: learnerId,
          email: `load-${learnerId}@example.test`,
          name: "并发烟测学员",
          passwordHash: "not-used-by-load-test",
          isActive: true,
        }).run();
      }
    });

    const gate = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
    const workers = learnerIds.map((learnerId) => new Worker(
      new URL("./sqlite-concurrency-worker.ts", import.meta.url),
      {
        execArgv: ["--import", "tsx"],
        workerData: { sqlitePath, learnerId, quizHash: publishedTopic.quizHash, startGate: gate, durationMs, maxWrites },
      },
    ));
    const results = workers.map((worker) => waitForWorker(worker));
    const state = new Int32Array(gate);
    const readyDeadline = Date.now() + 10_000;
    while (Atomics.load(state, 1) !== clientCount && Date.now() < readyDeadline) {
      Atomics.wait(state, 1, Atomics.load(state, 1), 100);
    }
    if (Atomics.load(state, 1) !== clientCount) {
      throw new Error(`并发 worker 未全部就绪：${Atomics.load(state, 1)}/${clientCount}`);
    }
    Atomics.store(state, 0, 1);
    Atomics.notify(state, 0, clientCount);
    const writes = await Promise.all(results);
    await Promise.all(workers.map((worker) => worker.terminate()));
    const expected = writes.reduce((total, result) => total + result.writes, 0);
    const failed = writes.filter((result) => result.error).length;
    const [attemptCount] = admin.select({ count: sql<number>`count(*)` })
      .from(quizAttempts)
      .innerJoin(quizSets, eq(quizSets.id, quizAttempts.quizSetId))
      .where(and(eq(quizSets.topicId, topicId), inArray(quizAttempts.learnerId, learnerIds)))
      .all();
    const duplicateScores = admin.$client.prepare("SELECT count(*) AS count FROM (SELECT learner_id, id, count(*) AS duplicates FROM quiz_attempts GROUP BY learner_id, id HAVING duplicates > 1)").get() as { count: number };
    const duplicateMessages = admin.$client.prepare("SELECT count(*) AS count FROM (SELECT training_session_id, position, count(*) AS duplicates FROM training_messages GROUP BY training_session_id, position HAVING duplicates > 1)").get() as { count: number };
    const duplicateRemediation = admin.$client.prepare("SELECT count(*) AS count FROM (SELECT learner_id, weakness_fingerprint, count(*) AS duplicates FROM remediation_exams WHERE status='in_progress' GROUP BY learner_id, weakness_fingerprint HAVING duplicates > 1)").get() as { count: number };
    const foreignKeyViolations = admin.$client.pragma("foreign_key_check") as unknown[];
    if (failed || attemptCount?.count !== expected || duplicateScores.count || duplicateMessages.count || duplicateRemediation.count || foreignKeyViolations.length) {
      throw new Error(JSON.stringify({ expected, actual: attemptCount?.count, failed, duplicateScores: duplicateScores.count, duplicateMessages: duplicateMessages.count, duplicateRemediation: duplicateRemediation.count, foreignKeyViolations: foreignKeyViolations.length }));
    }
    console.log(`SQLite 并发烟测通过：${clientCount} workers，${expected} 条真实并发写入，无锁失败、重复成绩/消息或外键损坏。`);
  } finally {
    admin.$client.close();
  }
}

function waitForWorker(worker: Worker): Promise<{ writes: number; error?: string }> {
  return new Promise((resolve, reject) => {
    worker.once("message", (result: { writes?: number; error?: string }) => {
      if (result.error) reject(new Error(result.error));
      else resolve({ writes: result.writes ?? 0 });
    });
    worker.once("error", reject);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

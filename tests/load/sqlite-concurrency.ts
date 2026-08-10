import { randomUUID } from "node:crypto";

import { hash } from "bcryptjs";
import { and, eq, inArray, sql } from "drizzle-orm";

import { createDatabaseClient } from "../../src/db/client";
import { DbQuizAttemptStore } from "../../src/db/repositories/db-quiz-attempt-store";
import { topicQuizAttempts, users } from "../../src/db/schema";
import { topicQuizQuestions } from "../../src/lib/quiz/question-bank";
import { createTopicQuizHash } from "../../src/lib/quiz/topic-hash";

const sqlitePath = process.env.SQLITE_PATH ?? ".tmp/learner-lite-e2e.sqlite";
const clientCount = Number(process.env.SQLITE_LOAD_CLIENTS ?? "30");
const rounds = Number(process.env.SQLITE_LOAD_ROUNDS ?? "5");
const topicId = "产品属性及卖点";

async function main(): Promise<void> {
  const admin = createDatabaseClient(sqlitePath);
  const passwordHash = await hash("load-test-password", 12);
  const learnerIds = Array.from({ length: clientCount }, () => randomUUID());
  try {
    admin.transaction((transaction) => {
      for (const learnerId of learnerIds) {
        transaction.insert(users).values({
          id: learnerId,
          email: `load-${learnerId}@example.test`,
          name: "并发烟测学员",
          passwordHash,
          isActive: true,
        }).run();
      }
    });

    const questions = topicQuizQuestions
      .filter((question) => question.category === topicId)
      .slice(0, 10);
    const writes = await Promise.allSettled(
      learnerIds.flatMap((learnerId) =>
        Array.from({ length: rounds }, async () => {
          const database = createDatabaseClient(sqlitePath);
          try {
            const store = new DbQuizAttemptStore(database);
            const attemptId = randomUUID();
            await store.saveAttempt({
              attemptId,
              learnerId,
              quizHash: createTopicQuizHash(topicId),
              topicId,
              passingScore: 80,
              answers: questions.map((question) => ({
                questionId: question.id,
                selectedAnswers: [question.correctAnswers[0]!],
                isCorrect: true,
              })),
            });
            // A repeated submit must remain one score, never a duplicate record.
            await store.saveAttempt({
              attemptId,
              learnerId,
              quizHash: createTopicQuizHash(topicId),
              topicId,
              passingScore: 80,
              answers: questions.map((question) => ({
                questionId: question.id,
                selectedAnswers: [question.correctAnswers[0]!],
                isCorrect: true,
              })),
            });
          } finally {
            database.$client.close();
          }
        }),
      ),
    );
    const failed = writes.filter((result) => result.status === "rejected");
    const [attemptCount] = admin
      .select({ count: sql<number>`count(*)` })
      .from(topicQuizAttempts)
      .where(and(
        eq(topicQuizAttempts.topicId, topicId),
        inArray(topicQuizAttempts.learnerId, learnerIds),
      ))
      .all();
    const foreignKeyViolations = admin.$client.pragma("foreign_key_check") as unknown[];
    const expected = clientCount * rounds;
    if (failed.length || attemptCount?.count !== expected || foreignKeyViolations.length) {
      throw new Error(JSON.stringify({ expected, actual: attemptCount?.count, failed: failed.length, foreignKeyViolations: foreignKeyViolations.length }));
    }
    console.log(`SQLite 并发烟测通过：${clientCount} 学员 × ${rounds} 次，${expected} 条无重复成绩写入，外键完整。`);
  } finally {
    admin.$client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import { parentPort, workerData } from "node:worker_threads";
import { randomUUID } from "node:crypto";

import { createDatabaseClient } from "../../src/db/client";
import { DbQuizAttemptStore } from "../../src/db/repositories/db-quiz-attempt-store";
import { topicQuizQuestions } from "../../src/lib/quiz/question-bank";
import { createTopicQuizHash } from "../../src/lib/quiz/topic-hash";

type WorkerInput = {
  sqlitePath: string;
  learnerId: string;
  startGate: SharedArrayBuffer;
  durationMs: number;
  maxWrites: number;
};

const input = workerData as WorkerInput;
const gate = new Int32Array(input.startGate);
const topicId = "产品属性及卖点";

async function run(): Promise<void> {
  const database = createDatabaseClient(input.sqlitePath);
  try {
    const store = new DbQuizAttemptStore(database);
    const answers = topicQuizQuestions
      .filter((question) => question.category === topicId)
      .slice(0, 10)
      .map((question) => ({
        questionId: question.id,
        selectedAnswers: [question.correctAnswers[0]!],
        isCorrect: true,
      }));
    Atomics.add(gate, 1, 1);
    Atomics.notify(gate, 1);
    Atomics.wait(gate, 0, 0);
    const deadline = Date.now() + input.durationMs;
    let writes = 0;
    while (Date.now() < deadline && writes < input.maxWrites) {
      const attemptId = randomUUID();
      await store.saveAttempt({
        attemptId,
        learnerId: input.learnerId,
        quizHash: createTopicQuizHash(topicId),
        topicId,
        passingScore: 80,
        answers,
      });
      // Deliberately race a repeated submit through the same worker connection.
      await store.saveAttempt({
        attemptId,
        learnerId: input.learnerId,
        quizHash: createTopicQuizHash(topicId),
        topicId,
        passingScore: 80,
        answers,
      });
      writes += 1;
    }
    parentPort?.postMessage({ writes });
  } finally {
    database.$client.close();
  }
}

run().catch((error: unknown) => {
  parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) });
});

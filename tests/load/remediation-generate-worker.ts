import { parentPort, workerData } from "node:worker_threads";

import { createDatabaseClient } from "../../src/db/client";
import { DbRemediationExamStore } from "../../src/db/repositories/db-remediation-exam-store";

type Input = {
  sqlitePath: string;
  learnerId: string;
  startGate: SharedArrayBuffer;
};

const input = workerData as Input;
const gate = new Int32Array(input.startGate);
const database = createDatabaseClient(input.sqlitePath);

try {
  Atomics.add(gate, 1, 1);
  Atomics.notify(gate, 1);
  Atomics.wait(gate, 0, 0);
  const result = new DbRemediationExamStore(database).generate(input.learnerId, {
    preset: "custom",
    startDate: "2026-08-21",
    endDate: "2026-08-21",
  });
  parentPort?.postMessage({
    status: result.status,
    examId: result.status === "created" || result.status === "existing" ? result.exam.id : null,
  });
} catch (error) {
  parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) });
} finally {
  database.$client.close();
}

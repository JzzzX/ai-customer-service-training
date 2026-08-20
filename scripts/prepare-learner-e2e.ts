import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { hash } from "bcryptjs";

import { createDatabaseClient } from "../src/db/client";
import { publishTopicQuizCatalog } from "../src/db/topic-quiz-publication";

const sqlitePath = resolve(
  process.env.SQLITE_PATH ?? ".tmp/learner-lite-e2e.sqlite",
);
const now = Date.now();
const knowledgeId = randomUUID();
const scenarioId = randomUUID();
const scenarioVersionId = randomUUID();

async function main(): Promise<void> {
  await mkdir(dirname(sqlitePath), { recursive: true });
  await rm(sqlitePath, { force: true });
  // WAL mode owns these sidecars; remove the complete known test database set
  // before creating a fresh isolated E2E fixture.
  await rm(`${sqlitePath}-wal`, { force: true });
  await rm(`${sqlitePath}-shm`, { force: true });
  const database = createDatabaseClient(sqlitePath);
  try {
    const migrationDirectory = resolve(process.cwd(), "drizzle");
    for (const migration of (await readdir(migrationDirectory))
      .filter((file) => /^\d{4}_.*\.sql$/.test(file))
      .sort()) {
      database.$client.exec(await readFile(resolve(migrationDirectory, migration), "utf8"));
    }
    await seedLearners(database.$client);
    seedPublishedScenario(database.$client);
    publishTopicQuizCatalog(database);
  } finally {
    database.$client.close();
  }
}

async function seedLearners(client: ReturnType<typeof createDatabaseClient>["$client"]) {
  const insert = client.prepare(
    "INSERT INTO users (id, email, name, password_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const [email, name, password, isActive] of [
    ["learner.one@example.test", "学员一", "learner-pass-1", 1],
    ["learner.two@example.test", "学员二", "learner-pass-2", 1],
    ["disabled@example.test", "停用学员", "learner-pass-3", 0],
  ] as const) {
    insert.run(randomUUID(), email, name, await hash(password, 12), isActive, now, now);
  }
}

function seedPublishedScenario(client: ReturnType<typeof createDatabaseClient>["$client"]) {
  const source = JSON.stringify([{ sourcePath: "e2e.md", kind: "markdown", anchor: "# mock", line: 1, path: ["E2E", "Mock"] }]);
  client.prepare("INSERT INTO knowledge_versions (id, version_hash, content_hash, schema_version, source_root, publication_source, status, is_active, coverage, published_at, created_at) VALUES (?, ?, ?, 1, 'e2e', 'cli', 'published', 1, ?, ?, ?)")
    .run(knowledgeId, "e2e-knowledge", "a".repeat(64), JSON.stringify({}), now, now);
  client.prepare("INSERT INTO knowledge_units (id, knowledge_version_id, unit_key, title, content, category_path, content_hash, sources, has_conflict, can_use_for_quiz, can_use_for_scenario, can_use_for_evaluation, created_at) VALUES (?, ?, 'e2e-unit', 'E2E 知识', '用于模拟情景的知识。', ?, ?, ?, 0, 1, 1, 1, ?)")
    .run(randomUUID(), knowledgeId, JSON.stringify(["e2e"]), "b".repeat(64), source, now);
  client.prepare("INSERT INTO scenarios (id, scenario_key, title, category, status, created_at, updated_at) VALUES (?, 'st_000000000000000000000001', 'E2E 模拟接待', 'presale', 'published', ?, ?)")
    .run(scenarioId, now, now);
  client.prepare("INSERT INTO scenario_versions (id, scenario_id, version_key, version, knowledge_version_id, content_hash, publication_source, background, summary, first_customer_message, controlled_variables, hidden_facts, customer_turns, checkpoints, prohibitions, scoring_weights, scoring_dimensions, critical_risks, reference_flow, reference_reply, sources, max_turns, mock_mode, difficulty, status, published_at, created_at) VALUES (?, ?, 'sv_000000000000000000000001', 1, ?, 'e2e-scenario-content', 'cli', 'E2E', '用于端到端 Mock AI 验收。', '您好，我想咨询一款适合宠物的产品。', '{}', ?, ?, ?, ?, '{}', ?, ?, ?, '您好，我会先确认宠物信息，再给出建议。', ?, 12, 1, 'medium', 'published', ?, ?)")
    .run(
      scenarioVersionId,
      scenarioId,
      knowledgeId,
      JSON.stringify(["年龄", "体重", "饮食"]),
      JSON.stringify(["请先确认宠物信息。", "我还关心换粮。", "谢谢你的建议。"]),
      JSON.stringify(["确认信息", "给出下一步", "说明注意事项", "邀请继续沟通"]),
      JSON.stringify(["不要承诺疗效", "不要忽略顾客问题"]),
      JSON.stringify([{ name: "需求确认", weight: 20, signals: ["确认", "信息"] }, { name: "建议", weight: 20, signals: ["建议", "方案"] }, { name: "表达", weight: 20, signals: ["您好", "谢谢"] }, { name: "风险", weight: 20, signals: ["注意", "不要"] }, { name: "跟进", weight: 20, signals: ["继续", "后续"] }]),
      JSON.stringify([{ label: "疗效承诺", patterns: ["保证治愈"] }, { label: "忽略信息", patterns: ["不需要了解"] }]),
      JSON.stringify(["确认信息", "了解需求", "给出建议", "跟进"]),
      source,
      now,
      now,
    );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

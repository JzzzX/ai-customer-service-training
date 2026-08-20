// @vitest-environment node

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseClient, DATABASE_SCHEMA_VERSION } from "../client";

describe("RBAC and unified quiz catalog migration", () => {
  const clients: Array<{ close(): void }> = [];

  afterEach(() => {
    clients.splice(0).forEach((client) => client.close());
  });

  it("upgrades a v1 database without changing question IDs or losing attempts", async () => {
    const database = createDatabaseClient(":memory:");
    clients.push(database.$client);
    const migrations = await migrationFiles();

    for (const migration of migrations.slice(0, 3)) {
      database.$client.exec(await readFile(migration, "utf8"));
    }
    seedV1History(database.$client);

    for (const migration of migrations.slice(3)) {
      database.$client.exec(await readFile(migration, "utf8"));
    }

    expect(DATABASE_SCHEMA_VERSION).toBe(2);
    expect(
      database.$client.prepare("SELECT version FROM app_schema_marker").get(),
    ).toEqual({ version: 2 });
    expect(
      database.$client
        .prepare("SELECT role FROM users WHERE id = 'learner-1'")
        .get(),
    ).toEqual({ role: "learner" });
    expect(
      database.$client
        .prepare(
          "SELECT stable_key AS stableKey FROM question_catalogs ORDER BY stable_key",
        )
        .all(),
    ).toEqual([{ stableKey: "qq_111111111111111111111111" }]);
    expect(
      database.$client
        .prepare(
          `SELECT id, question_catalog_id AS catalogId, revision,
                  knowledge_unit_id AS knowledgeUnitId,
                  knowledge_unit_key AS knowledgeUnitKey, sources
             FROM questions`,
        )
        .get(),
    ).toMatchObject({
      id: "question-physical-1",
      revision: 1,
      knowledgeUnitId: "unit-1",
      knowledgeUnitKey: "ku_111111111111111111111111",
      sources: JSON.stringify([{ sourcePath: "legacy.md", kind: "markdown", anchor: "legacy", path: ["legacy"] }]),
    });
    expect(
      database.$client
        .prepare("SELECT question_id AS questionId FROM quiz_set_questions")
        .get(),
    ).toEqual({ questionId: "question-physical-1" });
    expect(
      database.$client
        .prepare("SELECT question_id AS questionId FROM quiz_answers")
        .get(),
    ).toEqual({ questionId: "question-physical-1" });
    expect(count(database.$client, "quiz_attempts")).toBe(1);
    expect(count(database.$client, "quiz_answers")).toBe(1);
    expect(count(database.$client, "topic_quiz_attempts")).toBe(1);
    expect(count(database.$client, "topic_quiz_answers")).toBe(1);
    expect(database.$client.pragma("foreign_key_check")).toEqual([]);
  });

  it("supports Drizzle's transactional migration runner with foreign keys enabled", async () => {
    const database = createDatabaseClient(":memory:");
    clients.push(database.$client);
    const migrations = await migrationFiles();
    for (const migration of migrations.slice(0, 3)) {
      database.$client.exec(await readFile(migration, "utf8"));
    }
    seedV1History(database.$client);
    const migration = await readFile(migrations[3]!, "utf8");

    expect(() =>
      database.$client.transaction(() => {
        for (const [index, statement] of migration
          .split("--> statement-breakpoint")
          .entries()) {
          try {
            database.$client.exec(statement);
          } catch (error) {
            throw new Error(`migration statement ${index + 1} failed`, {
              cause: error,
            });
          }
        }
        expect(database.$client.pragma("foreign_key_check")).toEqual([]);
      })(),
    ).not.toThrow();
    expect(database.$client.pragma("foreign_key_check")).toEqual([]);
    expect(count(database.$client, "quiz_attempts")).toBe(1);
    expect(count(database.$client, "topic_quiz_attempts")).toBe(1);
  });
});

async function migrationFiles(): Promise<string[]> {
  const directory = resolve(process.cwd(), "drizzle");
  return (await readdir(directory))
    .filter((file) => /^\d{4}_.*\.sql$/.test(file))
    .sort()
    .map((file) => resolve(directory, file));
}

function count(client: { prepare(sql: string): { get(): unknown } }, table: string) {
  return (client.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get() as { value: number }).value;
}

function seedV1History(client: ReturnType<typeof createDatabaseClient>["$client"]): void {
  const source = JSON.stringify([
    { sourcePath: "legacy.md", kind: "markdown", anchor: "legacy", path: ["legacy"] },
  ]);
  client.exec(`
    INSERT INTO users (id, email, name, password_hash, is_active)
    VALUES ('learner-1', 'learner@example.test', '学员', 'hash', 1);
    INSERT INTO knowledge_versions
      (id, version_hash, content_hash, schema_version, source_root, status, is_active, coverage)
    VALUES ('knowledge-1', '${"a".repeat(64)}', '${"b".repeat(64)}', 1, 'legacy', 'published', 1, '{}');
    INSERT INTO knowledge_units
      (id, knowledge_version_id, unit_key, title, content, category_path, content_hash, sources)
    VALUES
      ('unit-1', 'knowledge-1', 'ku_111111111111111111111111', '旧知识', '内容', '["旧知识"]', '${"c".repeat(64)}', '${source.replaceAll("'", "''")}');
    INSERT INTO quiz_sets
      (id, knowledge_version_id, quiz_hash, content_hash, title, status, passing_score)
    VALUES ('set-1', 'knowledge-1', '${"d".repeat(64)}', '${"e".repeat(64)}', '旧正式题组', 'published', 80);
    INSERT INTO questions
      (id, knowledge_version_id, knowledge_unit_id, question_key, type, prompt, options,
       correct_answers, explanation, category, difficulty, status)
    VALUES
      ('question-physical-1', 'knowledge-1', 'unit-1', 'qq_111111111111111111111111',
       'single_choice', '旧问题', '["A","B"]', '["A"]', '旧说明', '旧分类', 'easy', 'published');
    INSERT INTO quiz_set_questions (quiz_set_id, question_id, position, points)
    VALUES ('set-1', 'question-physical-1', 0, 1);
    INSERT INTO quiz_attempts
      (id, quiz_set_id, learner_id, knowledge_version_id, status, correct_count,
       total_questions, score, completed_at)
    VALUES ('attempt-1', 'set-1', 'learner-1', 'knowledge-1', 'passed', 1, 1, 100, 1000);
    INSERT INTO quiz_answers
      (id, quiz_attempt_id, question_id, selected_answers, is_correct, answered_at)
    VALUES ('answer-1', 'attempt-1', 'question-physical-1', '["A"]', 1, 1000);
    INSERT INTO topic_quiz_attempts
      (id, learner_id, topic_id, quiz_hash, status, correct_count, total_questions,
       score, completed_at)
    VALUES ('legacy-topic-attempt-1', 'learner-1', '日常问答', '${"f".repeat(64)}',
            'passed', 1, 1, 100, 1000);
    INSERT INTO topic_quiz_answers
      (id, topic_quiz_attempt_id, question_key, selected_answers, is_correct, answered_at)
    VALUES ('legacy-topic-answer-1', 'legacy-topic-attempt-1',
            'qq_111111111111111111111111', '["A"]', 1, 1000);
  `);
}

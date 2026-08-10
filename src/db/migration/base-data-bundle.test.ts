import { describe, expect, it } from "vitest";

import {
  createBaseDataBundle,
  exportBaseDataBundle,
  importBaseDataBundle,
  parseBaseDataBundle,
  sha256,
} from "./base-data-bundle";
import { createTestDatabase } from "../test-support/create-test-database";

function fixtureBundle() {
  const version = {
    id: "knowledge-1", versionHash: "knowledge-version-hash", schemaVersion: 1,
    sourceRoot: "knowledge", status: "published", isActive: true,
    coverage: { service: 1 }, publishedAt: 1000, createdAt: 1000,
  };
  const sources = [{ id: "source-1", knowledgeVersionId: "knowledge-1", sourcePath: "guide.md", kind: "markdown", sourceHash: "source-hash", bytes: 10, stats: { units: 1 }, createdAt: 1000 }];
  const units = [{ id: "unit-1", knowledgeVersionId: "knowledge-1", unitKey: "unit", title: "知识", content: "内容", categoryPath: ["售前"], semanticKey: null, contentHash: "unit-hash", sources: [], hasConflict: false, canUseForQuiz: true, canUseForScenario: true, canUseForEvaluation: true, createdAt: 1000 }];
  const knowledge = { ...version, contentHash: sha256({ version, sources, units }) };
  const set = { id: "set-1", knowledgeVersionId: "knowledge-1", quizHash: "quiz-hash", sourceQuizHash: null, title: "正式题", description: null, status: "published", passingScore: 80, publishedAt: 1000, createdAt: 1000, updatedAt: 1000 };
  const questions = [{ id: "question-1", knowledgeVersionId: "knowledge-1", knowledgeUnitId: "unit-1", questionKey: "question", type: "single_choice", prompt: "问题", options: ["A", "B"], correctAnswers: ["A"], explanation: "说明", category: "售前", difficulty: "easy", status: "published", createdAt: 1000, updatedAt: 1000 }];
  const links = [{ quizSetId: "set-1", questionId: "question-1", position: 1, points: 1 }];
  const quiz = { ...set, contentHash: sha256({ set, questions, links }) };
  const scenario = { id: "scenario-1", scenarioKey: "scenario", title: "情景", category: "售前", status: "published", createdAt: 1000, updatedAt: 1000 };
  const scenarioVersion = { id: "scenario-version-1", scenarioId: "scenario-1", versionKey: "scenario-v1", version: 1, knowledgeVersionId: "knowledge-1", publicationSource: "cli", background: "背景", summary: "摘要", firstCustomerMessage: "你好", controlledVariables: {}, hiddenFacts: [], customerTurns: ["继续"], checkpoints: [], prohibitions: [], scoringWeights: { service: 1 }, scoringDimensions: [], criticalRisks: [], referenceFlow: [], referenceReply: "回复", sources: [], maxTurns: 12, mockMode: true, customerPersona: null, difficulty: "medium", status: "published", publishedAt: 1000, createdAt: 1000 };
  const publishedScenarioVersion = { ...scenarioVersion, contentHash: sha256({ scenario, version: scenarioVersion }) };
  return createBaseDataBundle({
    exportedAt: "2026-08-10T00:00:00.000Z",
    source: { kind: "neon-postgres", database: "fixture" },
    learners: [{ id: "learner-1", email: "learner@example.com", name: "学员", passwordHash: "$2b$12$preservedHash", isActive: true, lastLoginAt: null, createdAt: 1000, updatedAt: 1000 }],
    activeKnowledge: { version: knowledge, sources, units },
    publishedQuiz: { sets: [quiz], questions, links },
    publishedScenarios: { scenarios: [scenario], versions: [publishedScenarioVersion] },
  });
}

describe("BaseDataBundleV1", () => {
  it("validates a deterministic schema and checksum", () => {
    const bundle = fixtureBundle();
    expect(parseBaseDataBundle(JSON.parse(JSON.stringify(bundle)))).toEqual(bundle);
    expect(fixtureBundle()).toEqual(bundle);
  });

  it("rejects checksum mismatches before any SQLite write", async () => {
    const { database, client } = await createTestDatabase();
    const bundle = fixtureBundle();
    bundle.checksum = "0".repeat(64);
    expect(() => importBaseDataBundle(bundle, database)).toThrow(/checksum/i);
    expect(client.prepare("select count(*) as count from users").get()).toEqual({ count: 0 });
  });

  it("imports only base data into an empty target and preserves password hashes", async () => {
    const { database, client } = await createTestDatabase();
    importBaseDataBundle(fixtureBundle(), database);
    expect(client.prepare("select password_hash as passwordHash from users").get()).toEqual({ passwordHash: "$2b$12$preservedHash" });
    expect(client.prepare("select count(*) as count from quiz_attempts").get()).toEqual({ count: 0 });
    expect(client.prepare("select count(*) as count from training_messages").get()).toEqual({ count: 0 });
    expect(client.prepare("select count(*) as count from evaluation_reports").get()).toEqual({ count: 0 });
  });

  it("rejects a non-empty SQLite target without changing its records", async () => {
    const { database, client } = await createTestDatabase();
    client.prepare("insert into users (id, email, name, password_hash, is_active, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)").run("existing", "existing@example.com", "已有", "hash", 1, 1, 1);
    expect(() => importBaseDataBundle(fixtureBundle(), database)).toThrow(/empty/i);
    expect(client.prepare("select count(*) as count from users").get()).toEqual({ count: 1 });
  });

  it("exports a deterministic read-only PostgreSQL fixture without historical queries", async () => {
    const rows = [
      [{ id: "learner-1", email: "learner@example.com", name: "学员", passwordHash: "$2b$12$preservedHash", isActive: true, lastLoginAt: null, createdAt: new Date(1000), updatedAt: new Date(1000) }],
      [{ id: "knowledge-1", versionHash: "knowledge-version-hash", schemaVersion: 1, sourceRoot: "knowledge", status: "published", isActive: true, coverage: { service: 1 }, publishedAt: new Date(1000), createdAt: new Date(1000) }],
      [{ id: "source-1", knowledgeVersionId: "knowledge-1", sourcePath: "guide.md", kind: "markdown", sourceHash: "source-hash", bytes: 10, stats: { units: 1 }, createdAt: new Date(1000) }],
      [{ id: "unit-1", knowledgeVersionId: "knowledge-1", unitKey: "unit", title: "知识", content: "内容", categoryPath: ["售前"], semanticKey: null, contentHash: "unit-hash", sources: [], hasConflict: false, canUseForQuiz: true, canUseForScenario: true, canUseForEvaluation: true, createdAt: new Date(1000) }],
      [{ id: "set-1", knowledgeVersionId: "knowledge-1", quizHash: "quiz-hash", sourceQuizHash: null, title: "正式题", description: null, status: "published", passingScore: 80, publishedAt: new Date(1000), createdAt: new Date(1000), updatedAt: new Date(1000) }],
      [{ id: "question-1", knowledgeVersionId: "knowledge-1", knowledgeUnitId: "unit-1", questionKey: "question", type: "single_choice", prompt: "问题", options: ["A", "B"], correctAnswers: ["A"], explanation: "说明", category: "售前", difficulty: "easy", status: "published", createdAt: new Date(1000), updatedAt: new Date(1000) }],
      [{ quizSetId: "set-1", questionId: "question-1", position: 1, points: 1 }],
      [{ id: "scenario-1", scenarioKey: "scenario", title: "情景", category: "售前", status: "published", createdAt: new Date(1000), updatedAt: new Date(1000) }],
      [{ id: "scenario-version-1", scenarioId: "scenario-1", versionKey: "scenario-v1", version: 1, knowledgeVersionId: "knowledge-1", background: "背景", summary: "摘要", firstCustomerMessage: "你好", controlledVariables: {}, hiddenFacts: [], customerTurns: ["继续"], checkpoints: [], prohibitions: [], scoringWeights: { service: 1 }, scoringDimensions: [], criticalRisks: [], referenceFlow: [], referenceReply: "回复", sources: [], maxTurns: 12, mockMode: true, customerPersona: null, difficulty: "medium", status: "published", publishedAt: new Date(1000), createdAt: new Date(1000) }],
    ];
    const queries: string[] = [];
    const reader = { query: async (query: string) => { queries.push(query); return rows.shift() ?? []; } };
    const bundle = await exportBaseDataBundle(reader, "fixture", "2026-08-10T00:00:00.000Z");
    expect(bundle.counts).toMatchObject({ users: 1, knowledgeVersions: 1, questions: 1, scenarioVersions: 1 });
    expect(bundle.learners[0].passwordHash).toBe("$2b$12$preservedHash");
    expect(queries.join(" ")).toContain("SELECT DISTINCT q.id");
    expect(queries.join(" ")).not.toMatch(/quiz_attempts|training_messages|evaluation_reports|assignments|review/i);
  });
});

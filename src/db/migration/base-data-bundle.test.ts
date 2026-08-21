import { describe, expect, it } from "vitest";
import { compareSync, hashSync } from "bcryptjs";

import {
  createBaseDataBundle,
  exportBaseDataBundle,
  importBaseDataBundle,
  parseBaseDataBundle,
  sha256,
} from "./base-data-bundle";
import { createTestDatabase } from "../test-support/create-test-database";

function fixtureBundle() {
  const passwordHash = hashSync("original-password", "$2b$10$N9qo8uLOickgx2ZMRZoMye");
  const version = {
    id: "knowledge-1", versionHash: "knowledge-version-hash", schemaVersion: 1,
    sourceRoot: "knowledge", status: "published", isActive: true,
    coverage: { service: 1 }, publishedAt: 1000, createdAt: 1000,
  };
  const sources = [{ id: "source-1", knowledgeVersionId: "knowledge-1", sourcePath: "guide.md", kind: "markdown", sourceHash: "source-hash", bytes: 10, stats: { units: 1 }, createdAt: 1000 }];
  const units = [{ id: "unit-1", knowledgeVersionId: "knowledge-1", unitKey: "unit", title: "知识", content: "内容", categoryPath: ["售前"], semanticKey: null, contentHash: "unit-hash", sources: [], hasConflict: false, canUseForQuiz: true, canUseForScenario: true, canUseForEvaluation: true, createdAt: 1000 }];
  const knowledge = { ...version, contentHash: sha256({ version, sources, units }) };
  const set = { id: "set-1", knowledgeVersionId: "knowledge-1", quizHash: "quiz-hash", sourceQuizHash: null, title: "正式题", description: null, kind: "formal", topicId: null, status: "published", passingScore: 80, publishedAt: 1000, createdAt: 1000, updatedAt: 1000 };
  const catalogs = [{ id: "catalog-1", stableKey: "question", createdAt: 1000 }];
  const questions = [{ id: "question-1", questionCatalogId: "catalog-1", revision: 1, contentHash: "question-content-hash", knowledgeVersionId: "knowledge-1", knowledgeUnitId: "unit-1", knowledgeUnitKey: "unit", questionKey: "question", type: "single_choice", prompt: "问题", options: ["A", "B"], correctAnswers: ["A"], explanation: "说明", category: "售前", difficulty: "easy", sources: [], status: "published", createdAt: 1000, updatedAt: 1000 }];
  const links = [{ quizSetId: "set-1", questionId: "question-1", position: 1, points: 1 }];
  const quiz = { ...set, contentHash: sha256({ set, questions, links }) };
  const scenario = { id: "scenario-1", scenarioKey: "scenario", title: "情景", category: "售前", status: "published", createdAt: 1000, updatedAt: 1000 };
  const scenarioVersion = { id: "scenario-version-1", scenarioId: "scenario-1", versionKey: "scenario-v1", version: 1, knowledgeVersionId: "knowledge-1", publicationSource: "cli", background: "背景", summary: "摘要", firstCustomerMessage: "你好", controlledVariables: {}, hiddenFacts: [], customerTurns: ["继续"], checkpoints: [], prohibitions: [], scoringWeights: { service: 1 }, scoringDimensions: [], criticalRisks: [], referenceFlow: [], referenceReply: "回复", sources: [], maxTurns: 12, mockMode: true, customerPersona: null, difficulty: "medium", status: "published", publishedAt: 1000, createdAt: 1000 };
  const publishedScenarioVersion = { ...scenarioVersion, contentHash: sha256({ scenario, version: scenarioVersion }) };
  return createBaseDataBundle({
    exportedAt: "2026-08-10T00:00:00.000Z",
    source: { kind: "neon-postgres", database: "fixture" },
    learners: [{ id: "learner-1", email: "learner@example.com", name: "学员", passwordHash, role: "admin", isActive: true, lastLoginAt: null, createdAt: 1000, updatedAt: 1000 }],
    activeKnowledge: { version: knowledge, sources, units },
    publishedQuiz: { catalogs, sets: [quiz], questions, links },
    publishedScenarios: { scenarios: [scenario], versions: [publishedScenarioVersion] },
  });
}

describe("BaseDataBundleV2", () => {
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
    const row = client.prepare("select password_hash as passwordHash from users").get() as { passwordHash: string };
    expect(compareSync("original-password", row.passwordHash)).toBe(true);
    expect(client.prepare("select role from users").get()).toEqual({ role: "admin" });
    expect(client.prepare("select count(*) as count from question_catalogs").get()).toEqual({ count: 1 });
    expect(client.prepare("select catalog_id as catalogId, current_question_id as questionId from question_catalog_publications").get()).toEqual({ catalogId: "catalog-1", questionId: "question-1" });
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

  it("rejects plaintext or malformed learner password values before writing", async () => {
    const { database, client } = await createTestDatabase();
    const bundle = fixtureBundle();
    bundle.learners[0].passwordHash = "plain-text-password";
    bundle.checksum = sha256({ ...bundle, checksum: undefined });
    expect(() => importBaseDataBundle(bundle, database)).toThrow(/passwordHash|checksum/i);
    expect(client.prepare("select count(*) as count from users").get()).toEqual({ count: 0 });
  });

  it("rolls back every write when a post-check SQLite foreign key fails", async () => {
    const { database, client } = await createTestDatabase();
    const bundle = fixtureBundle();
    bundle.activeKnowledge.sources[0].knowledgeVersionId = "missing-version";
    const version = { ...bundle.activeKnowledge.version };
    delete version.contentHash;
    bundle.activeKnowledge.version.contentHash = sha256({ version, sources: bundle.activeKnowledge.sources, units: bundle.activeKnowledge.units });
    const payload = { ...bundle } as { checksum?: string };
    delete payload.checksum;
    bundle.checksum = sha256(payload);
    expect(() => importBaseDataBundle(bundle, database)).toThrow();
    expect(client.prepare("select count(*) as count from users").get()).toEqual({ count: 0 });
    expect(client.prepare("select count(*) as count from knowledge_versions").get()).toEqual({ count: 0 });
  });

  it("exports a deterministic read-only PostgreSQL fixture without historical queries", async () => {
    const rows = [
      [{ id: "learner-1", email: "learner@example.com", name: "学员", passwordHash: hashSync("original-password", "$2b$10$N9qo8uLOickgx2ZMRZoMye"), role: "learner", isActive: true, lastLoginAt: null, createdAt: new Date(1000), updatedAt: new Date(1000) }],
      [{ id: "knowledge-1", versionHash: "knowledge-version-hash", schemaVersion: 1, sourceRoot: "knowledge", status: "published", isActive: true, coverage: { service: 1 }, publishedAt: new Date(1000), createdAt: new Date(1000) }],
      [{ id: "source-1", knowledgeVersionId: "knowledge-1", sourcePath: "guide.md", kind: "markdown", sourceHash: "source-hash", bytes: 10, stats: { units: 1 }, createdAt: new Date(1000) }],
      [{ id: "unit-1", knowledgeVersionId: "knowledge-1", unitKey: "unit", title: "知识", content: "内容", categoryPath: ["售前"], semanticKey: null, contentHash: "unit-hash", sources: [], hasConflict: false, canUseForQuiz: true, canUseForScenario: true, canUseForEvaluation: true, createdAt: new Date(1000) }],
      [{ id: "set-1", knowledgeVersionId: "knowledge-1", quizHash: "quiz-hash", sourceQuizHash: null, title: "正式题", description: null, kind: "formal", topicId: null, status: "published", passingScore: 80, publishedAt: new Date(1000), createdAt: new Date(1000), updatedAt: new Date(1000) }],
      [{ id: "catalog-1", stableKey: "question", createdAt: new Date(1000) }],
      [{ id: "question-1", questionCatalogId: "catalog-1", revision: 1, contentHash: "question-content-hash", knowledgeVersionId: "knowledge-1", knowledgeUnitId: "unit-1", knowledgeUnitKey: "unit", questionKey: "question", type: "single_choice", prompt: "问题", options: ["A", "B"], correctAnswers: ["A"], explanation: "说明", category: "售前", difficulty: "easy", sources: [], status: "published", createdAt: new Date(1000), updatedAt: new Date(1000) }],
      [{ quizSetId: "set-1", questionId: "question-1", position: 1, points: 1 }],
      [{ id: "scenario-version-1", scenarioId: "scenario-1", versionKey: "scenario-v1", version: 1, knowledgeVersionId: "knowledge-1", background: "背景", summary: "摘要", firstCustomerMessage: "你好", controlledVariables: {}, hiddenFacts: [], customerTurns: ["继续"], checkpoints: [], prohibitions: [], scoringWeights: { service: 1 }, scoringDimensions: [], criticalRisks: [], referenceFlow: [], referenceReply: "回复", sources: [], maxTurns: 12, mockMode: true, customerPersona: null, difficulty: "medium", status: "published", publishedAt: new Date(1000), createdAt: new Date(1000) }],
      [{ id: "scenario-1", scenarioKey: "scenario", title: "情景", category: "售前", status: "published", createdAt: new Date(1000), updatedAt: new Date(1000) }],
    ];
    const remediationRows: Record<number, Array<Record<string, unknown>>> = {
      4: [{ id: "remediation-set", knowledgeVersionId: "knowledge-1", quizHash: "remediation-hash", sourceQuizHash: "fingerprint", title: "改善题", description: null, kind: "remediation", topicId: null, status: "published", passingScore: 80, publishedAt: new Date(2000), createdAt: new Date(2000), updatedAt: new Date(2000) }],
      5: [{ id: "remediation-catalog", stableKey: "remediation-question", createdAt: new Date(2000) }],
      6: [{ id: "remediation-question-id", questionCatalogId: "remediation-catalog", revision: 1, contentHash: "remediation-content", knowledgeVersionId: "knowledge-1", knowledgeUnitId: "unit-1", knowledgeUnitKey: "unit", questionKey: "remediation-question", type: "single_choice", prompt: "动态题", options: ["A", "B"], correctAnswers: ["A"], explanation: "说明", category: "售前", difficulty: "easy", sources: [], status: "published", createdAt: new Date(2000), updatedAt: new Date(2000) }],
      7: [{ quizSetId: "remediation-set", questionId: "remediation-question-id", position: 1, points: 1 }],
    };
    const queries: string[] = [];
    let queryIndex = 0;
    const reader = { query: async (query: string) => {
      queries.push(query);
      const baseRows = rows.shift() ?? [];
      const dynamicRows = remediationRows[queryIndex] ?? [];
      queryIndex += 1;
      return /kind IN \('formal','topic'\)/.test(query) ? baseRows : [...baseRows, ...dynamicRows];
    } };
    const bundle = await exportBaseDataBundle(reader, "fixture", "2026-08-10T00:00:00.000Z");
    expect(bundle.schemaVersion).toBe(2);
    expect(bundle.counts).toMatchObject({ users: 1, knowledgeVersions: 1, questionCatalogs: 1, questions: 1, scenarioVersions: 1 });
    expect(bundle.publishedQuiz.sets.map((item) => item.id)).toEqual(["set-1"]);
    expect(bundle.publishedQuiz.links.map((item) => item.quizSetId)).toEqual(["set-1"]);
    expect(bundle.publishedQuiz.questions.every((question) => bundle.publishedQuiz.catalogs.some((catalog) => catalog.id === question.questionCatalogId))).toBe(true);
    expect(bundle.publishedQuiz.links.every((link) => bundle.publishedQuiz.sets.some((set) => set.id === link.quizSetId) && bundle.publishedQuiz.questions.some((question) => question.id === link.questionId))).toBe(true);
    expect(compareSync("original-password", bundle.learners[0].passwordHash as string)).toBe(true);
    expect(queries.join(" ")).toContain("SELECT DISTINCT q.id");
    expect(queries.join(" ")).not.toMatch(/quiz_attempts|training_messages|evaluation_reports|assignments|review/i);
  });
});

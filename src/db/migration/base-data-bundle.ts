import { createHash } from "node:crypto";

import { z } from "zod";

import type { DatabaseClient } from "../client";

export const BASE_DATA_BUNDLE_SCHEMA_VERSION = 2;

type BaseRecord = Record<string, unknown>;

const recordSchema = z.record(z.string(), z.unknown());
const bcryptHashSchema = z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
const learnerSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().refine((email) => email === email.trim().toLowerCase(), "email must be normalized"),
  name: z.string().trim().min(1),
  passwordHash: bcryptHashSchema,
  role: z.enum(["learner", "admin"]),
  isActive: z.literal(true),
  lastLoginAt: z.number().int().nonnegative().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict();
const countSchema = z.object({
  users: z.number().int().nonnegative(),
  knowledgeVersions: z.number().int().nonnegative(),
  knowledgeSources: z.number().int().nonnegative(),
  knowledgeUnits: z.number().int().nonnegative(),
  quizSets: z.number().int().nonnegative(),
  questionCatalogs: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
  quizSetQuestions: z.number().int().nonnegative(),
  scenarios: z.number().int().nonnegative(),
  scenarioVersions: z.number().int().nonnegative(),
});

const bundleShape = z.object({
  schemaVersion: z.literal(BASE_DATA_BUNDLE_SCHEMA_VERSION),
  exportedAt: z.string().datetime({ offset: true }),
  source: z.object({ kind: z.literal("neon-postgres"), database: z.string().min(1) }),
  counts: countSchema,
  learners: z.array(learnerSchema),
  activeKnowledge: z.object({ version: recordSchema, sources: z.array(recordSchema), units: z.array(recordSchema) }),
  publishedQuiz: z.object({ catalogs: z.array(recordSchema), sets: z.array(recordSchema), questions: z.array(recordSchema), links: z.array(recordSchema) }),
  publishedScenarios: z.object({ scenarios: z.array(recordSchema), versions: z.array(recordSchema) }),
});

export const baseDataBundleV2Schema = bundleShape.extend({
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

export type BaseDataBundleV2 = z.infer<typeof baseDataBundleV2Schema>;
export type BaseDataBundleInput = z.infer<typeof bundleShape>;

const importedTables = [
  "users", "knowledge_versions", "knowledge_sources", "knowledge_units", "quiz_sets",
  "question_catalogs", "question_catalog_publications", "questions", "quiz_set_questions", "scenarios", "scenario_versions",
] as const;
const historyTables = [
  "quiz_attempts", "quiz_attempt_questions", "quiz_answers", "topic_quiz_attempts", "topic_quiz_answers",
  "remediation_exam_targets", "remediation_exams",
  "training_sessions", "training_messages", "evaluation_reports",
] as const;

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function createBaseDataBundle(input: Omit<BaseDataBundleInput, "schemaVersion" | "counts"> & { counts?: BaseDataBundleInput["counts"] }): BaseDataBundleV2 {
  const counts = input.counts ?? countRecords(input);
  const payload: BaseDataBundleInput = {
    schemaVersion: BASE_DATA_BUNDLE_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    source: input.source,
    counts,
    learners: input.learners,
    activeKnowledge: input.activeKnowledge,
    publishedQuiz: input.publishedQuiz,
    publishedScenarios: input.publishedScenarios,
  };
  return { ...payload, checksum: sha256(payload) };
}

export function parseBaseDataBundle(value: unknown): BaseDataBundleV2 {
  const bundle = baseDataBundleV2Schema.parse(value);
  const { checksum, ...payload } = bundle;
  if (sha256(payload) !== checksum) throw new Error("Base data bundle checksum mismatch.");
  if (stableJson(countRecords(bundle)) !== stableJson(bundle.counts)) {
    throw new Error("Base data bundle table counts do not match its records.");
  }
  validateBundleContent(bundle);
  return bundle;
}

export function importBaseDataBundle(value: unknown, database: DatabaseClient): void {
  const bundle = parseBaseDataBundle(value);
  const transaction = database.$client.transaction(() => {
    ensureTargetIsEmpty(database);
    insertRows(database, "users", bundle.learners);
    insertRows(database, "knowledge_versions", [bundle.activeKnowledge.version]);
    insertRows(database, "knowledge_sources", bundle.activeKnowledge.sources);
    insertRows(database, "knowledge_units", bundle.activeKnowledge.units);
    insertRows(database, "quiz_sets", bundle.publishedQuiz.sets);
    insertRows(database, "question_catalogs", bundle.publishedQuiz.catalogs);
    insertRows(database, "questions", bundle.publishedQuiz.questions);
    createCurrentQuestionPointers(database);
    insertRows(database, "quiz_set_questions", bundle.publishedQuiz.links);
    insertRows(database, "scenarios", bundle.publishedScenarios.scenarios);
    insertRows(database, "scenario_versions", bundle.publishedScenarios.versions);
    verifyImportedDatabase(database, bundle);
  });
  transaction.immediate();
}

/** A small read-only boundary so fixture tests do not need real Neon credentials. */
export interface PostgresBaseDataReader {
  query(sql: string): Promise<BaseRecord[]>;
}

/**
 * Reads only the base entities from the old PostgreSQL schema.  Query text is
 * deliberately fixed: this command never interpolates user input or mutates Neon.
 */
export async function exportBaseDataBundle(reader: PostgresBaseDataReader, sourceDatabase: string, exportedAt = new Date().toISOString()): Promise<BaseDataBundleV2> {
  const learners = learnerSchema.array().parse(normaliseRows(await reader.query("SELECT id, email, name, password_hash AS \\\"passwordHash\\\", role, is_active AS \\\"isActive\\\", last_login_at AS \\\"lastLoginAt\\\", created_at AS \\\"createdAt\\\", updated_at AS \\\"updatedAt\\\" FROM users WHERE is_active = true ORDER BY id")));
  const versions = normaliseRows(await reader.query("SELECT id, version_hash AS \\\"versionHash\\\", schema_version AS \\\"schemaVersion\\\", source_root AS \\\"sourceRoot\\\", status, is_active AS \\\"isActive\\\", coverage, published_at AS \\\"publishedAt\\\", created_at AS \\\"createdAt\\\" FROM knowledge_versions WHERE is_active = true AND status = 'published' ORDER BY id"));
  if (versions.length !== 1) throw new Error("Neon export requires exactly one active published knowledge version.");
  const knowledgeVersionId = stringField(versions[0], "id");
  const sources = normaliseRows(await reader.query(`SELECT id, knowledge_version_id AS "knowledgeVersionId", source_path AS "sourcePath", kind, source_hash AS "sourceHash", bytes, stats, created_at AS "createdAt" FROM knowledge_sources WHERE knowledge_version_id = '${escapeSqlLiteral(knowledgeVersionId)}' ORDER BY id`));
  const units = normaliseRows(await reader.query(`SELECT id, knowledge_version_id AS "knowledgeVersionId", unit_key AS "unitKey", title, content, category_path AS "categoryPath", semantic_key AS "semanticKey", content_hash AS "contentHash", sources, has_conflict AS "hasConflict", can_use_for_quiz AS "canUseForQuiz", can_use_for_scenario AS "canUseForScenario", can_use_for_evaluation AS "canUseForEvaluation", created_at AS "createdAt" FROM knowledge_units WHERE knowledge_version_id = '${escapeSqlLiteral(knowledgeVersionId)}' ORDER BY id`));
  const knowledgeVersion = withContentHash({ ...versions[0], publicationSource: "cli" }, { version: { ...versions[0], publicationSource: "cli" }, sources, units });
  const sets = normaliseRows(await reader.query(`SELECT id, knowledge_version_id AS "knowledgeVersionId", quiz_hash AS "quizHash", source_quiz_hash AS "sourceQuizHash", title, description, kind, topic_id AS "topicId", status, passing_score AS "passingScore", published_at AS "publishedAt", created_at AS "createdAt", updated_at AS "updatedAt" FROM quiz_sets WHERE knowledge_version_id = '${escapeSqlLiteral(knowledgeVersionId)}' AND status = 'published' ORDER BY id`));
  const catalogs = normaliseRows(await reader.query(`SELECT DISTINCT catalog.id, catalog.stable_key AS "stableKey", catalog.created_at AS "createdAt" FROM question_catalogs catalog JOIN questions q ON q.question_catalog_id = catalog.id JOIN quiz_set_questions link ON link.question_id = q.id JOIN quiz_sets set ON set.id = link.quiz_set_id WHERE set.knowledge_version_id = '${escapeSqlLiteral(knowledgeVersionId)}' AND set.status = 'published' ORDER BY catalog.id`));
  const questions = normaliseRows(await reader.query(`SELECT DISTINCT q.id, q.question_catalog_id AS "questionCatalogId", q.revision, q.content_hash AS "contentHash", q.knowledge_version_id AS "knowledgeVersionId", q.knowledge_unit_id AS "knowledgeUnitId", q.knowledge_unit_key AS "knowledgeUnitKey", q.question_key AS "questionKey", q.type, q.prompt, q.options, q.correct_answers AS "correctAnswers", q.explanation, q.category, q.difficulty, q.sources, q.status, q.created_at AS "createdAt", q.updated_at AS "updatedAt" FROM questions q JOIN quiz_set_questions link ON link.question_id = q.id JOIN quiz_sets set ON set.id = link.quiz_set_id WHERE set.knowledge_version_id = '${escapeSqlLiteral(knowledgeVersionId)}' AND set.status = 'published' ORDER BY q.id`));
  const links = normaliseRows(await reader.query(`SELECT link.quiz_set_id AS "quizSetId", link.question_id AS "questionId", link.position, link.points FROM quiz_set_questions link JOIN quiz_sets set ON set.id = link.quiz_set_id WHERE set.knowledge_version_id = '${escapeSqlLiteral(knowledgeVersionId)}' AND set.status = 'published' ORDER BY link.quiz_set_id, link.position`));
  const quizSets = sets.map((set) => {
    const sqliteSet = { ...set, publicationSource: "cli" };
    return withContentHash(sqliteSet, { set: sqliteSet, questions: questions.filter((question) => links.some((link) => link.quizSetId === set.id && link.questionId === question.id)), links: links.filter((link) => link.quizSetId === set.id) });
  });
  const versionsForScenarios = normaliseRows(await reader.query(`SELECT id, scenario_id AS "scenarioId", version_key AS "versionKey", version, knowledge_version_id AS "knowledgeVersionId", background, summary, first_customer_message AS "firstCustomerMessage", controlled_variables AS "controlledVariables", hidden_facts AS "hiddenFacts", customer_turns AS "customerTurns", checkpoints, prohibitions, scoring_weights AS "scoringWeights", scoring_dimensions AS "scoringDimensions", critical_risks AS "criticalRisks", reference_flow AS "referenceFlow", reference_reply AS "referenceReply", sources, max_turns AS "maxTurns", mock_mode AS "mockMode", customer_persona AS "customerPersona", difficulty, status, published_at AS "publishedAt", created_at AS "createdAt" FROM scenario_versions WHERE knowledge_version_id = '${escapeSqlLiteral(knowledgeVersionId)}' AND status = 'published' ORDER BY id`));
  const scenarioIds = [...new Set(versionsForScenarios.map((version) => stringField(version, "scenarioId")))];
  const scenarios = scenarioIds.length === 0 ? [] : normaliseRows(await reader.query(`SELECT id, scenario_key AS "scenarioKey", title, category, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM scenarios WHERE status = 'published' AND id IN (${scenarioIds.map((id) => `'${escapeSqlLiteral(id)}'`).join(", ")}) ORDER BY id`));
  const scenarioVersions = versionsForScenarios.map((version) => {
    const scenario = scenarios.find((candidate) => candidate.id === version.scenarioId);
    if (!scenario) throw new Error("Published scenario version references an unpublished scenario.");
    const sqliteVersion = { ...version, publicationSource: "cli" };
    return withContentHash(sqliteVersion, { scenario, version: sqliteVersion });
  });
  return createBaseDataBundle({ exportedAt, source: { kind: "neon-postgres", database: sourceDatabase }, learners, activeKnowledge: { version: knowledgeVersion, sources, units }, publishedQuiz: { catalogs, sets: quizSets, questions, links }, publishedScenarios: { scenarios, versions: scenarioVersions } });
}

function countRecords(input: Pick<BaseDataBundleInput, "learners" | "activeKnowledge" | "publishedQuiz" | "publishedScenarios">): BaseDataBundleInput["counts"] {
  return { users: input.learners.length, knowledgeVersions: 1, knowledgeSources: input.activeKnowledge.sources.length, knowledgeUnits: input.activeKnowledge.units.length, quizSets: input.publishedQuiz.sets.length, questionCatalogs: input.publishedQuiz.catalogs.length, questions: input.publishedQuiz.questions.length, quizSetQuestions: input.publishedQuiz.links.length, scenarios: input.publishedScenarios.scenarios.length, scenarioVersions: input.publishedScenarios.versions.length };
}

function validateBundleContent(bundle: BaseDataBundleV2): void {
  const version = bundle.activeKnowledge.version;
  if (version.isActive !== true || version.status !== "published") throw new Error("Bundle must contain one active published knowledge version.");
  expectHash(version, { version: without(version, "contentHash"), sources: bundle.activeKnowledge.sources, units: bundle.activeKnowledge.units });
  for (const set of bundle.publishedQuiz.sets) {
    if (set.status !== "published") throw new Error("Bundle includes an unpublished quiz set.");
    expectHash(set, { set: without(set, "contentHash"), questions: bundle.publishedQuiz.questions.filter((question) => bundle.publishedQuiz.links.some((link) => link.quizSetId === set.id && link.questionId === question.id)), links: bundle.publishedQuiz.links.filter((link) => link.quizSetId === set.id) });
  }
  const catalogIds = new Set(bundle.publishedQuiz.catalogs.map((catalog) => catalog.id));
  for (const question of bundle.publishedQuiz.questions) {
    if (!catalogIds.has(question.questionCatalogId)) {
      throw new Error("Bundle question references a missing stable catalog.");
    }
  }
  for (const versionRow of bundle.publishedScenarios.versions) {
    const scenario = bundle.publishedScenarios.scenarios.find((item) => item.id === versionRow.scenarioId);
    if (!scenario || versionRow.status !== "published") throw new Error("Bundle contains an invalid published scenario version.");
    expectHash(versionRow, { scenario, version: without(versionRow, "contentHash") });
  }
  for (const scenario of bundle.publishedScenarios.scenarios) {
    if (!bundle.publishedScenarios.versions.some((versionRow) => versionRow.scenarioId === scenario.id)) {
      throw new Error("Bundle includes a published scenario without an active knowledge version.");
    }
  }
}

function expectHash(record: BaseRecord, content: unknown): void {
  if (record.contentHash !== sha256(content)) throw new Error(`Bundle content hash mismatch for ${String(record.id ?? "record")}: ${String(record.contentHash)} != ${sha256(content)}.`);
}

function ensureTargetIsEmpty(database: DatabaseClient): void {
  for (const table of [...importedTables, ...historyTables]) {
    const row = database.$client.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    if (row.count !== 0) throw new Error("SQLite import target must be empty.");
  }
}

function verifyImportedDatabase(database: DatabaseClient, bundle: BaseDataBundleV2): void {
  for (const [table, count] of Object.entries({
    users: bundle.counts.users, knowledge_versions: bundle.counts.knowledgeVersions, knowledge_sources: bundle.counts.knowledgeSources, knowledge_units: bundle.counts.knowledgeUnits, quiz_sets: bundle.counts.quizSets, question_catalogs: bundle.counts.questionCatalogs, questions: bundle.counts.questions, quiz_set_questions: bundle.counts.quizSetQuestions, scenarios: bundle.counts.scenarios, scenario_versions: bundle.counts.scenarioVersions,
  })) {
    const row = database.$client.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    if (row.count !== count) throw new Error(`SQLite import count mismatch for ${table}.`);
  }
  const active = database.$client.prepare("SELECT COUNT(*) AS count FROM knowledge_versions WHERE is_active = 1 AND status = 'published'").get() as { count: number };
  if (active.count !== 1) throw new Error("SQLite import did not preserve the active knowledge pointer.");
  const pointers = database.$client.prepare("SELECT COUNT(*) AS count FROM question_catalog_publications").get() as { count: number };
  if (pointers.count !== bundle.counts.questionCatalogs) throw new Error("SQLite import did not create every current question pointer.");
  for (const table of historyTables) {
    const row = database.$client.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    if (row.count !== 0) throw new Error("SQLite import must exclude historical training data.");
  }
  const foreignKeys = database.$client.pragma("foreign_key_check") as unknown[];
  if (foreignKeys.length) throw new Error("SQLite import produced foreign-key violations.");
}

function createCurrentQuestionPointers(database: DatabaseClient): void {
  database.$client.exec(`
    INSERT INTO question_catalog_publications
      (catalog_id, current_question_id, published_by_id, published_at, updated_at)
    SELECT q.question_catalog_id, q.id, NULL, q.updated_at, q.updated_at
      FROM questions q
     WHERE q.status = 'published'
       AND q.revision = (
         SELECT MAX(latest.revision)
           FROM questions latest
          WHERE latest.question_catalog_id = q.question_catalog_id
            AND latest.status = 'published'
       );
  `);
}

function insertRows(database: DatabaseClient, table: string, rows: BaseRecord[]): void {
  for (const row of rows) {
    const entries = Object.entries(row).filter(([, value]) => value !== undefined);
    const columns = entries.map(([key]) => camelToSnake(key));
    const statement = database.$client.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
    statement.run(...entries.map(([, value]) => sqliteValue(value)));
  }
}

function sqliteValue(value: unknown): string | number | null {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return stableJson(value);
}

function withContentHash(record: BaseRecord, content: unknown): BaseRecord {
  return { ...record, contentHash: sha256(content) };
}

function normaliseRows(rows: BaseRecord[]): BaseRecord[] {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normaliseValue(value)])));
}

function normaliseValue(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map(normaliseValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as BaseRecord).map(([key, nested]) => [key, normaliseValue(nested)]));
  return value;
}

function without(value: BaseRecord, ...keys: string[]): BaseRecord {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as BaseRecord).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, sortValue(nested)]));
  return value;
}

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function stringField(record: BaseRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`Neon export returned invalid ${key}.`);
  return value;
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

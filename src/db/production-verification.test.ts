// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateProductionSnapshot,
  verifyProductionData,
} from "./production-verification";
import { knowledgeVersions } from "./schema";
import { createTestDatabase } from "./test-support/create-test-database";
import type { DatabaseClient } from "./client";
import { publishTopicQuizCatalog } from "./topic-quiz-publication";

const technicalSnapshot = {
  activeKnowledgeCount: 1,
  questionCount: 0,
  formalCatalogCount: 0,
  formalRevisionCount: 0,
  publishedQuizCount: 0,
  publishedQuizKnowledgeMismatchCount: 0,
  publishedScenarioCount: 9,
  publishedCatScenarioCount: 1,
  publishedScenarioKnowledgeMismatchCount: 0,
  activeLearnerCount: 1,
  activeAdminCount: 1,
  publishedTopicCount: 5,
  publishedTopicCategoryCount: 5,
  publishedTopicKnowledgeMismatchCount: 0,
  topicQuestionCount: 350,
  topicCatalogCount: 350,
  topicRevisionCount: 350,
  topicCategoryMismatchCount: 0,
  topicQuestionCounts: {
    "产品属性及卖点": 65,
    "宠物生理和喂养": 72,
    "活动促销": 72,
    "服务流程与规则": 75,
    "日常问答": 66,
  },
};

const clients: Array<{ close(): void }> = [];

afterEach(() => clients.splice(0).forEach((client) => client.close()));

describe("evaluateProductionSnapshot", () => {
  it("separates technical readiness from formal content readiness", () => {
    const result = evaluateProductionSnapshot(technicalSnapshot);

    expect(result.technicalPassed).toBe(true);
    expect(result.formalPassed).toBe(false);
    expect(result.formalIssues).toContain(
      "正式题组尚未发布。",
    );
  });

  it("passes formal readiness with one published quiz", () => {
    const result = evaluateProductionSnapshot({
      ...technicalSnapshot,
      publishedQuizCount: 1,
      questionCount: 40,
      formalCatalogCount: 40,
      formalRevisionCount: 40,
    });

    expect(result.technicalPassed).toBe(true);
    expect(result.formalPassed).toBe(true);
  });

  it("requires a live administrator but not manual quiz review records", () => {
    const missingAdminSnapshot = {
      ...technicalSnapshot,
      activeAdminCount: 0,
      currentApprovalCount: 0,
    };
    const result = evaluateProductionSnapshot(missingAdminSnapshot);

    expect(result.technicalPassed).toBe(false);
    expect(result.technicalIssues).toContain("至少需要一个启用中的管理员账号。");
  });

  it("rejects inconsistent production references and content counts", () => {
    const result = evaluateProductionSnapshot({
      ...technicalSnapshot,
      activeKnowledgeCount: 2,
      publishedQuizCount: 1,
      questionCount: 39,
      formalCatalogCount: 39,
      formalRevisionCount: 39,
      publishedScenarioCount: 8,
      publishedCatScenarioCount: 0,
      publishedScenarioKnowledgeMismatchCount: 1,
      publishedTopicCount: 4,
      publishedTopicCategoryCount: 4,
      publishedTopicKnowledgeMismatchCount: 1,
      topicQuestionCount: 349,
    });

    expect(result.technicalPassed).toBe(false);
    expect(result.technicalIssues).toEqual(
      expect.arrayContaining([
        "必须且只能有一个活动知识版本。",
        "当前正式题组必须链接40道不同目录、不同版本的题目。",
        "必须发布9个场景版本。",
        "必须发布“6 个月肠胃敏感英短选粮”场景。",
        "场景版本必须全部引用活动知识版本。",
        "必须发布5个专题题组。",
        "专题题库必须包含350道不同目录、不同版本的题目，且题目分类与题组一致。",
        "专题题组必须引用活动知识版本。",
      ]),
    );
  });

  it("rejects a topic catalog with the right total but a wrong distribution", () => {
    const result = evaluateProductionSnapshot({
      ...technicalSnapshot,
      topicQuestionCounts: {
        ...technicalSnapshot.topicQuestionCounts,
        "产品属性及卖点": 64,
        "日常问答": 67,
      },
    });

    expect(result.technicalPassed).toBe(false);
    expect(result.technicalIssues).toContain(
      "专题题库分类题数必须为65/72/72/75/66。",
    );
  });

  it("counts formal questions only through the unique published formal set", async () => {
    const fixture = await productionFixture();
    seedQuestionRevisions(fixture.database, 40);
    seedQuizSet(fixture.database, "formal-set", "formal");
    linkQuestions(fixture.database, "formal-set", 1);

    const result = await verifyProductionData(fixture.database);

    expect(result.snapshot.questionCount).toBe(1);
    expect(result.snapshot.formalCatalogCount).toBe(1);
    expect(result.snapshot.formalRevisionCount).toBe(1);
    expect(result.formalIssues).toContain(
      "当前正式题组必须链接40道不同目录、不同版本的题目。",
    );
  });

  it("accepts exactly 40 distinct catalogs and revisions linked to the formal set", async () => {
    const fixture = await productionFixture();
    seedQuestionRevisions(fixture.database, 40);
    seedQuizSet(fixture.database, "formal-set", "formal");
    linkQuestions(fixture.database, "formal-set", 40);

    const result = await verifyProductionData(fixture.database);

    expect(result.snapshot.questionCount).toBe(40);
    expect(result.snapshot.formalCatalogCount).toBe(40);
    expect(result.snapshot.formalRevisionCount).toBe(40);
    expect(result.formalIssues).not.toContain(
      "当前正式题组必须链接40道不同目录、不同版本的题目。",
    );
  });

  it("does not accept 40 questions linked only to a remediation set", async () => {
    const fixture = await productionFixture();
    seedQuestionRevisions(fixture.database, 40);
    seedQuizSet(fixture.database, "formal-set", "formal");
    linkQuestions(fixture.database, "formal-set", 1);
    seedQuizSet(fixture.database, "remediation-set", "remediation");
    linkQuestions(fixture.database, "remediation-set", 40);

    const result = await verifyProductionData(fixture.database);

    expect(result.snapshot.questionCount).toBe(1);
    expect(result.snapshot.formalCatalogCount).toBe(1);
    expect(result.snapshot.formalRevisionCount).toBe(1);
  });

  it("verifies topic distribution, distinct revisions, and category consistency from database links", async () => {
    const fixture = await productionFixture();
    publishTopicQuizCatalog(fixture.database);

    const valid = await verifyProductionData(fixture.database);

    expect(valid.snapshot.topicQuestionCount).toBe(350);
    expect(valid.snapshot.topicCatalogCount).toBe(350);
    expect(valid.snapshot.topicRevisionCount).toBe(350);
    expect(valid.snapshot.topicCategoryMismatchCount).toBe(0);
    expect(valid.snapshot.topicQuestionCounts).toEqual(
      technicalSnapshot.topicQuestionCounts,
    );

    fixture.client
      .prepare(
        `UPDATE questions SET category = '日常问答'
          WHERE id = (
            SELECT link.question_id
              FROM quiz_set_questions link
              JOIN quiz_sets set_row ON set_row.id = link.quiz_set_id
             WHERE set_row.topic_id = '产品属性及卖点'
             LIMIT 1
          )`,
      )
      .run();

    const inconsistent = await verifyProductionData(fixture.database);
    expect(inconsistent.snapshot.topicCategoryMismatchCount).toBe(1);
    expect(inconsistent.technicalIssues).toContain(
      "专题题库必须包含350道不同目录、不同版本的题目，且题目分类与题组一致。",
    );
  });
});

async function productionFixture() {
  const fixture = await createTestDatabase();
  clients.push(fixture.client);
  await fixture.database.insert(knowledgeVersions).values({
    id: "knowledge-production",
    versionHash: "1".repeat(64),
    contentHash: "2".repeat(64),
    schemaVersion: 1,
    sourceRoot: "production-test",
    status: "published",
    isActive: true,
    coverage: {},
    publishedAt: new Date(1000),
  });
  return fixture;
}

function seedQuestionRevisions(database: DatabaseClient, count: number): void {
  const now = Date.now();
  for (let index = 0; index < count; index += 1) {
    database.$client
      .prepare("INSERT INTO question_catalogs (id, stable_key, created_at) VALUES (?, ?, ?)")
      .run(`catalog-${index}`, `formal-${index}`, now);
    database.$client
      .prepare(
        `INSERT INTO questions
          (id, question_catalog_id, revision, content_hash, knowledge_version_id,
           knowledge_unit_key, question_key, type, prompt, options, correct_answers,
           explanation, category, difficulty, sources, status, created_at, updated_at)
         VALUES (?, ?, 1, ?, 'knowledge-production', ?, ?, 'single_choice', ?,
                 '["A","B"]', '["A"]', '解析', '正式分类', 'easy', '[]',
                 'published', ?, ?)`,
      )
      .run(
        `question-${index}`,
        `catalog-${index}`,
        String(index).padStart(64, "0"),
        `formal-ku-${index}`,
        `formal-${index}`,
        `题目 ${index}`,
        now,
        now,
      );
  }
}

function seedQuizSet(
  database: DatabaseClient,
  id: string,
  kind: "formal" | "remediation",
): void {
  database.$client
    .prepare(
      `INSERT INTO quiz_sets
        (id, knowledge_version_id, quiz_hash, content_hash, source_quiz_hash,
         title, kind, publication_source, status, passing_score, published_at,
         created_at, updated_at)
       VALUES (?, 'knowledge-production', ?, ?, ?, ?, ?, 'cli', 'published', 80,
               1000, 1000, 1000)`,
    )
    .run(id, id.padEnd(64, "0"), id.padEnd(64, "1"), id.padEnd(64, "2"), id, kind);
}

function linkQuestions(database: DatabaseClient, setId: string, count: number): void {
  const statement = database.$client.prepare(
    "INSERT INTO quiz_set_questions (quiz_set_id, question_id, position, points) VALUES (?, ?, ?, 1)",
  );
  for (let index = 0; index < count; index += 1) {
    statement.run(setId, `question-${index}`, index);
  }
}

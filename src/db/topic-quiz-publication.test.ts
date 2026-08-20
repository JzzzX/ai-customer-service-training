// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { knowledgeVersions } from "./schema";
import { createTestDatabase } from "./test-support/create-test-database";
import { publishTopicQuizCatalog } from "./topic-quiz-publication";
import { quizTopics, topicQuizQuestions } from "@/lib/quiz/question-bank";

describe("topic quiz catalog publication", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    fixture = await createTestDatabase();
    await fixture.database.insert(knowledgeVersions).values({
      id: "knowledge-topic",
      versionHash: "1".repeat(64),
      contentHash: "a".repeat(64),
      schemaVersion: 1,
      sourceRoot: "topic-static-bank",
      status: "published",
      isActive: true,
      coverage: {},
      publishedAt: new Date(1000),
    });
  });

  afterEach(() => fixture.client.close());

  it("publishes all 350 stable keys into five database topic sets idempotently", () => {
    const first = publishTopicQuizCatalog(fixture.database);
    const second = publishTopicQuizCatalog(fixture.database);

    expect(first).toEqual({
      createdSetCount: 5,
      existingSetCount: 0,
      topicCount: 5,
      questionCount: 350,
    });
    expect(second).toEqual({
      createdSetCount: 0,
      existingSetCount: 5,
      topicCount: 5,
      questionCount: 350,
    });
    expect(count("question_catalogs")).toBe(350);
    expect(count("questions")).toBe(350);
    expect(count("quiz_sets")).toBe(5);
    expect(count("quiz_set_questions")).toBe(350);
    expect(count("knowledge_units")).toBe(0);

    const categories = fixture.client
      .prepare(
        `SELECT topic_id AS topicId, COUNT(link.question_id) AS questionCount
           FROM quiz_sets set_row
           JOIN quiz_set_questions link ON link.quiz_set_id = set_row.id
          WHERE set_row.kind = 'topic' AND set_row.status = 'published'
          GROUP BY topic_id ORDER BY topic_id`,
      )
      .all();
    expect(categories).toEqual([
      { topicId: "产品属性及卖点", questionCount: 65 },
      { topicId: "宠物生理和喂养", questionCount: 72 },
      { topicId: "日常问答", questionCount: 66 },
      { topicId: "服务流程与规则", questionCount: 75 },
      { topicId: "活动促销", questionCount: 72 },
    ]);
  });

  it("stores synthetic knowledge keys and source locators directly on revisions", () => {
    publishTopicQuizCatalog(fixture.database);
    const source = topicQuizQuestions[0]!;
    const row = fixture.client
      .prepare(
        `SELECT c.stable_key AS stableKey,
                q.knowledge_unit_id AS knowledgeUnitId,
                q.knowledge_unit_key AS knowledgeUnitKey,
                q.sources
           FROM questions q
           JOIN question_catalogs c ON c.id = q.question_catalog_id
          WHERE c.stable_key = ?`,
      )
      .get(source.id) as {
        stableKey: string;
        knowledgeUnitId: string | null;
        knowledgeUnitKey: string;
        sources: string;
      };

    expect(row).toEqual({
      stableKey: source.id,
      knowledgeUnitId: null,
      knowledgeUnitKey: source.knowledgeUnitId,
      sources: JSON.stringify(source.sources),
    });
    expect(new Set(topicQuizQuestions.map((question) => question.id)).size).toBe(
      topicQuizQuestions.length,
    );
    expect(quizTopics.map((topic) => topic.id)).toHaveLength(5);
  });

  it("publishes new immutable revisions when the active knowledge version changes", async () => {
    publishTopicQuizCatalog(fixture.database);
    await fixture.database
      .update(knowledgeVersions)
      .set({ isActive: false })
      .run();
    await fixture.database.insert(knowledgeVersions).values({
      id: "knowledge-topic-v2",
      versionHash: "2".repeat(64),
      contentHash: "b".repeat(64),
      schemaVersion: 1,
      sourceRoot: "topic-static-bank-v2",
      status: "published",
      isActive: true,
      coverage: {},
      publishedAt: new Date(2000),
    });

    expect(publishTopicQuizCatalog(fixture.database)).toMatchObject({
      createdSetCount: 5,
      existingSetCount: 0,
    });
    expect(count("question_catalogs")).toBe(350);
    expect(count("questions")).toBe(700);
    expect(
      fixture.client
        .prepare(
          `SELECT status, COUNT(*) AS value
             FROM quiz_sets WHERE kind = 'topic'
             GROUP BY status ORDER BY status`,
        )
        .all(),
    ).toEqual([
      { status: "archived", value: 5 },
      { status: "published", value: 5 },
    ]);
    expect(
      fixture.client
        .prepare(
          `SELECT COUNT(*) AS value FROM quiz_sets
            WHERE kind = 'topic' AND status = 'published'
              AND knowledge_version_id = 'knowledge-topic-v2'`,
        )
        .get(),
    ).toEqual({ value: 5 });
  });

  function count(table: string): number {
    return (
      fixture.client.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get() as {
        value: number;
      }
    ).value;
  }
});

import { describe, expect, it } from "vitest";

import {
  createQuizDraftPublicationStore,
  publishQuizDraftToStore,
  type PreparedQuizDraftPublication,
  type QuizDraftPublicationStore,
  type ResolvedQuizKnowledge,
} from "./quiz-draft-publication";
import { knowledgeUnits, knowledgeVersions } from "./schema";
import { createTestDatabase } from "./test-support/create-test-database";
import type { QuizDraftPack } from "@/lib/quiz/schema";

const quizHash = "a".repeat(64);
const knowledgePackHash = "b".repeat(64);
const createdById = "00000000-0000-4000-8000-000000000001";

class MemoryQuizDraftPublicationStore
  implements QuizDraftPublicationStore
{
  readonly publications = new Map<
    string,
    { id: string; quizHash: string }
  >();
  publishCount = 0;
  lastPublication: PreparedQuizDraftPublication | undefined;

  constructor(
    private readonly knowledge: ResolvedQuizKnowledge =
      resolvedKnowledge(),
  ) {}

  async findQuizSetByHash(hash: string) {
    return this.publications.get(hash) ?? null;
  }

  async resolveKnowledgeContext() {
    return this.knowledge;
  }

  async publishDraftAtomically(
    input: PreparedQuizDraftPublication,
  ) {
    this.lastPublication = input;
    const existing = this.publications.get(input.quizSet.quizHash);
    if (existing) {
      return existing;
    }
    const published = {
      id: "00000000-0000-4000-8000-000000000010",
      quizHash: input.quizSet.quizHash,
    };
    this.publications.set(input.quizSet.quizHash, published);
    this.publishCount += 1;
    return published;
  }
}

describe("quiz draft database publication", () => {
  it("publishes the same immutable draft hash only once", async () => {
    const store = new MemoryQuizDraftPublicationStore();

    const first = await publishQuizDraftToStore(
      draft(),
      createdById,
      store,
    );
    const second = await publishQuizDraftToStore(
      draft(),
      createdById,
      store,
    );

    expect(first).toEqual({
      id: "00000000-0000-4000-8000-000000000010",
      quizHash,
      created: true,
    });
    expect(second).toEqual({ ...first, created: false });
    expect(store.publishCount).toBe(1);
    expect(store.lastPublication?.quizSet.sourceQuizHash).toBe(quizHash);
  });

  it("rejects conflicting knowledge before creating a quiz set", async () => {
    const knowledge = resolvedKnowledge();
    knowledge.units[0] = {
      ...knowledge.units[0]!,
      hasConflict: true,
    };
    const store = new MemoryQuizDraftPublicationStore(knowledge);

    await expect(
      publishQuizDraftToStore(draft(), createdById, store),
    ).rejects.toThrow("冲突知识不能进入题库");
    expect(store.publishCount).toBe(0);
  });

  it("rejects a draft whose knowledge version is not active", async () => {
    const store = new MemoryQuizDraftPublicationStore({
      ...resolvedKnowledge(),
      isActive: false,
    });

    await expect(
      publishQuizDraftToStore(draft(), createdById, store),
    ).rejects.toThrow("知识版本不是当前已发布版本");
    expect(store.publishCount).toBe(0);
  });

  it.each(["draft", "archived"] as const)(
    "rejects an active knowledge version whose lifecycle status is %s",
    async (status) => {
      const store = new MemoryQuizDraftPublicationStore({
        ...resolvedKnowledge(),
        status,
      });

      await expect(publishQuizDraftToStore(draft(), createdById, store))
        .rejects.toThrow("不是当前已发布版本");
      expect(store.publishCount).toBe(0);
    },
  );

  it("rejects a production draft that does not contain exactly 40 questions", async () => {
    const store = new MemoryQuizDraftPublicationStore();
    const incomplete = draft();
    incomplete.questions.pop();

    await expect(
      publishQuizDraftToStore(incomplete, createdById, store),
    ).rejects.toThrow("必须恰好包含 40 道题");
    expect(store.publishCount).toBe(0);
  });

  it("reuses unchanged revisions and appends changed content without rewriting old links", async () => {
    const fixture = await createTestDatabase();
    try {
      await seedKnowledge(fixture.database);
      const store = createQuizDraftPublicationStore(fixture.database);
      await publishQuizDraftToStore(draft(), createdById, store);

      const revised = draft();
      revised.quizHash = "c".repeat(64);
      revised.questions[0] = {
        ...revised.questions[0]!,
        prompt: "修订后的第一题",
      };
      await publishQuizDraftToStore(revised, createdById, store);

      expect(
        fixture.client.prepare("SELECT COUNT(*) AS value FROM question_catalogs").get(),
      ).toEqual({ value: 40 });
      expect(
        fixture.client.prepare("SELECT COUNT(*) AS value FROM questions").get(),
      ).toEqual({ value: 41 });
      expect(
        fixture.client
          .prepare(
            `SELECT revision, prompt FROM questions
              WHERE question_key = 'qq_000000000000000000000000'
              ORDER BY revision`,
          )
          .all(),
      ).toEqual([
        { revision: 1, prompt: "第 1 题" },
        { revision: 2, prompt: "修订后的第一题" },
      ]);
      expect(
        fixture.client
          .prepare(
            `SELECT set_row.quiz_hash AS quizHash, link.question_id AS questionId
               FROM quiz_set_questions link
               JOIN quiz_sets set_row ON set_row.id = link.quiz_set_id
              WHERE link.position = 0 ORDER BY set_row.quiz_hash`,
          )
          .all(),
      ).toEqual([
        { quizHash: "a".repeat(64), questionId: expect.any(String) },
        { quizHash: "c".repeat(64), questionId: expect.any(String) },
      ]);
      const linkedIds = fixture.client
        .prepare(
          `SELECT link.question_id AS questionId
             FROM quiz_set_questions link
             JOIN quiz_sets set_row ON set_row.id = link.quiz_set_id
            WHERE link.position = 0 ORDER BY set_row.quiz_hash`,
        )
        .all() as Array<{ questionId: string }>;
      expect(linkedIds[0]?.questionId).not.toBe(linkedIds[1]?.questionId);
      expect(
        fixture.client
          .prepare(
            "SELECT quiz_hash AS quizHash, status FROM quiz_sets ORDER BY quiz_hash",
          )
          .all(),
      ).toEqual([
        { quizHash: "a".repeat(64), status: "archived" },
        { quizHash: "c".repeat(64), status: "published" },
      ]);
    } finally {
      fixture.client.close();
    }
  });
});

async function seedKnowledge(
  database: Awaited<ReturnType<typeof createTestDatabase>>["database"],
): Promise<void> {
  await database.insert(knowledgeVersions).values({
    id: resolvedKnowledge().id,
    versionHash: knowledgePackHash,
    contentHash: "d".repeat(64),
    schemaVersion: 1,
    sourceRoot: "formal-test",
    status: "published",
    isActive: true,
    coverage: {},
    publishedAt: new Date(1000),
  });
  await database.insert(knowledgeUnits).values(
    resolvedKnowledge().units.map((unit, index) => ({
      id: unit.id,
      knowledgeVersionId: resolvedKnowledge().id,
      unitKey: unit.unitKey,
      title: `第 ${index + 1} 题`,
      content: `第 ${index + 1} 题知识`,
      categoryPath: ["产品属性及卖点"],
      contentHash: String((index % 9) + 1).repeat(64),
      sources: draft().questions[index]!.sources,
      hasConflict: false,
      canUseForQuiz: true,
    })),
  );
}

function draft(): QuizDraftPack {
  return {
    schemaVersion: 1,
    quizHash,
    knowledgePackHash,
    title: "客服新人知识基础小测",
    passingScore: 80,
    status: "draft",
    questions: Array.from({ length: 40 }, (_, index) => {
      const suffix = index.toString(16).padStart(24, "0");
      return {
        id: `qq_${suffix}`,
        knowledgeUnitId: `ku_${suffix}`,
        type: index < 20 ? "single_choice" : "true_false",
        prompt: `第 ${index + 1} 题`,
        options:
          index < 20 ? ["正确答案", "干扰项"] : ["正确", "错误"],
        correctAnswers: [index < 20 ? "正确答案" : "正确"],
        explanation: `第 ${index + 1} 题解释`,
        category: "产品属性及卖点",
        difficulty: "easy",
        status: "draft",
        sources: [
          {
            sourcePath: "企划问答.xlsx",
            kind: "excel",
            anchor: `sheet:产品/row:${index + 2}`,
            sheet: "产品",
            row: index + 2,
            path: ["产品", `第 ${index + 1} 题`],
          },
        ],
      };
    }),
  };
}

function resolvedKnowledge(): ResolvedQuizKnowledge {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    versionHash: knowledgePackHash,
    isActive: true,
    status: "published" as const,
    units: Array.from({ length: 40 }, (_, index) => {
      const suffix = index.toString(16).padStart(24, "0");
      return {
        id: `00000000-0000-4000-8000-${index
          .toString()
          .padStart(12, "0")}`,
        unitKey: `ku_${suffix}`,
        hasConflict: false,
        canUseForQuiz: true,
      };
    }),
  };
}

import { describe, expect, it } from "vitest";

import {
  publishQuizDraftToStore,
  type PreparedQuizDraftPublication,
  type QuizDraftPublicationStore,
  type ResolvedQuizKnowledge,
} from "./quiz-draft-publication";
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
    ).rejects.toThrow("知识版本不是当前活动版本");
    expect(store.publishCount).toBe(0);
  });

  it("rejects a production draft that does not contain exactly 40 questions", async () => {
    const store = new MemoryQuizDraftPublicationStore();
    const incomplete = draft();
    incomplete.questions.pop();

    await expect(
      publishQuizDraftToStore(incomplete, createdById, store),
    ).rejects.toThrow("必须恰好包含 40 道题");
    expect(store.publishCount).toBe(0);
  });
});

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

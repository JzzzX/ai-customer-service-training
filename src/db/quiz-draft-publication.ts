import { and, eq, inArray, ne } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";

import { getDatabase } from "./client";
import { ensureQuestionRevision } from "./question-revision-publication";
import {
  knowledgeUnits,
  knowledgeVersions,
  quizSetQuestions,
  quizSets,
} from "./schema";
import { quizDraftPackSchema } from "@/lib/quiz/schema";
import type {
  QuizDraftPack,
  QuizQuestionDraft,
} from "@/lib/quiz/schema";

type Database = ReturnType<typeof getDatabase>;

export type ResolvedQuizKnowledge = {
  id: string;
  versionHash: string;
  isActive: boolean;
  status: "draft" | "published" | "disabled" | "archived";
  units: Array<{
    id: string;
    unitKey: string;
    hasConflict: boolean;
    canUseForQuiz: boolean;
  }>;
};

export type PreparedQuizDraftPublication = {
  quizSet: {
    knowledgeVersionId: string;
    quizHash: string;
    sourceQuizHash: string;
    title: string;
    passingScore: number;
  };
  questions: Array<{
    knowledgeVersionId: string;
    knowledgeUnitId: string;
    knowledgeUnitKey: string;
    questionKey: string;
    type: QuizQuestionDraft["type"];
    prompt: string;
    options: string[];
    correctAnswers: string[];
    explanation: string;
    category: string;
    difficulty: QuizQuestionDraft["difficulty"];
    sources: QuizQuestionDraft["sources"];
    position: number;
  }>;
};

export interface QuizDraftPublicationStore {
  findQuizSetByHash(
    quizHash: string,
  ): Promise<{ id: string; quizHash: string } | null>;
  resolveKnowledgeContext(
    versionHash: string,
    unitKeys: string[],
  ): Promise<ResolvedQuizKnowledge | null>;
  publishDraftAtomically(
    input: PreparedQuizDraftPublication,
  ): Promise<{ id: string; quizHash: string }>;
}

export async function publishQuizDraftToStore(
  input: QuizDraftPack,
  _publicationSource: string,
  store: QuizDraftPublicationStore,
): Promise<{ id: string; quizHash: string; created: boolean }> {
  const draft = quizDraftPackSchema.parse(input);
  if (draft.questions.length !== 40) {
    throw new Error(
      `生产题库草稿必须恰好包含 40 道题，当前为 ${draft.questions.length} 道。`,
    );
  }

  const existing = await store.findQuizSetByHash(draft.quizHash);
  if (existing) {
    return { ...existing, created: false };
  }

  const unitKeys = draft.questions.map(
    (question) => question.knowledgeUnitId,
  );
  if (new Set(unitKeys).size !== unitKeys.length) {
    throw new Error("题库草稿不能重复绑定同一个知识单元。");
  }

  const knowledge = await store.resolveKnowledgeContext(
    draft.knowledgePackHash,
    unitKeys,
  );
  if (!knowledge) {
    throw new Error("找不到题库草稿绑定的知识版本。");
  }
  if (!knowledge.isActive || knowledge.status !== "published") {
    throw new Error("题库草稿绑定的知识版本不是当前已发布版本。");
  }

  const resolvedUnits = new Map(
    knowledge.units.map((unit) => [unit.unitKey, unit]),
  );
  const preparedQuestions = draft.questions.map((question, position) => {
    const unit = resolvedUnits.get(question.knowledgeUnitId);
    if (!unit) {
      throw new Error(
        `找不到题目绑定的知识单元：${question.knowledgeUnitId}`,
      );
    }
    if (unit.hasConflict) {
      throw new Error(
        `冲突知识不能进入题库：${question.knowledgeUnitId}`,
      );
    }
    if (!unit.canUseForQuiz) {
      throw new Error(
        `知识单元未获准用于题库：${question.knowledgeUnitId}`,
      );
    }

    return {
      knowledgeVersionId: knowledge.id,
      knowledgeUnitId: unit.id,
      knowledgeUnitKey: question.knowledgeUnitId,
      questionKey: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      correctAnswers: question.correctAnswers,
      explanation: question.explanation,
      category: question.category,
      difficulty: question.difficulty,
      sources: question.sources,
      position,
    };
  });

  const published = await store.publishDraftAtomically({
    quizSet: {
      knowledgeVersionId: knowledge.id,
      quizHash: draft.quizHash,
      sourceQuizHash: draft.quizHash,
      title: draft.title,
      passingScore: draft.passingScore,
    },
    questions: preparedQuestions,
  });
  return { ...published, created: true };
}

export function createQuizDraftPublicationStore(
  database: Database = getDatabase(),
): QuizDraftPublicationStore {
  return {
    async findQuizSetByHash(quizHash) {
      const [quizSet] = await database
        .select({ id: quizSets.id, quizHash: quizSets.quizHash })
        .from(quizSets)
        .where(
          and(
            eq(quizSets.quizHash, quizHash),
            eq(quizSets.status, "published"),
          ),
        )
        .limit(1).all();
      return quizSet ?? null;
    },

    async resolveKnowledgeContext(versionHash, unitKeys) {
      const [version] = await database
        .select({
          id: knowledgeVersions.id,
          versionHash: knowledgeVersions.versionHash,
          isActive: knowledgeVersions.isActive,
          status: knowledgeVersions.status,
        })
        .from(knowledgeVersions)
        .where(eq(knowledgeVersions.versionHash, versionHash))
        .limit(1).all();
      if (!version) {
        return null;
      }

      const units =
        unitKeys.length === 0
          ? []
          : await database
              .select({
                id: knowledgeUnits.id,
                unitKey: knowledgeUnits.unitKey,
                hasConflict: knowledgeUnits.hasConflict,
                canUseForQuiz: knowledgeUnits.canUseForQuiz,
              })
              .from(knowledgeUnits)
              .where(
                and(
                  eq(knowledgeUnits.knowledgeVersionId, version.id),
                  inArray(knowledgeUnits.unitKey, unitKeys),
                ),
              )
              .all();
      return { ...version, units };
    },

    async publishDraftAtomically(publication) {
      return database.transaction((transaction) => {
        const [insertedQuizSet] = transaction
          .insert(quizSets)
          .values({
            id: randomUUID(),
            ...publication.quizSet,
            contentHash: hashContent(publication),
            publicationSource: "cli",
            status: "published",
            description: "通过 CLI 发布的正式题库。",
            kind: "formal",
            publishedAt: new Date(),
          })
          .onConflictDoNothing({ target: quizSets.quizHash })
          .returning({ id: quizSets.id, quizHash: quizSets.quizHash }).all();

        if (!insertedQuizSet) {
          const [existingQuizSet] = transaction
            .select({ id: quizSets.id, quizHash: quizSets.quizHash })
            .from(quizSets)
            .where(eq(quizSets.quizHash, publication.quizSet.quizHash))
            .limit(1).all();
          if (!existingQuizSet) {
            throw new Error("题库草稿并发发布后无法读取。");
          }
          transaction
            .update(quizSets)
            .set({ status: "archived", updatedAt: new Date() })
            .where(
              and(
                eq(quizSets.kind, "formal"),
                eq(quizSets.status, "published"),
                ne(quizSets.id, existingQuizSet.id),
              ),
            )
            .run();
          transaction
            .update(quizSets)
            .set({ status: "published", updatedAt: new Date() })
            .where(eq(quizSets.id, existingQuizSet.id))
            .run();
          return existingQuizSet;
        }

        transaction
          .update(quizSets)
          .set({ status: "archived", updatedAt: new Date() })
          .where(
            and(
              eq(quizSets.kind, "formal"),
              eq(quizSets.status, "published"),
              ne(quizSets.id, insertedQuizSet.id),
            ),
          )
          .run();

        const links = publication.questions.map((question) => {
          const stored = ensureQuestionRevision(transaction, {
            stableKey: question.questionKey,
            knowledgeVersionId: question.knowledgeVersionId,
            knowledgeUnitId: question.knowledgeUnitId,
            knowledgeUnitKey: question.knowledgeUnitKey,
            type: question.type,
            prompt: question.prompt,
            options: question.options,
            correctAnswers: question.correctAnswers,
            explanation: question.explanation,
            category: question.category,
            difficulty: question.difficulty,
            sources: question.sources,
          });
          return {
            quizSetId: insertedQuizSet.id,
            questionId: stored.id,
            position: question.position,
            points: 1,
          };
        });
        transaction.insert(quizSetQuestions).values(links).run();

        return insertedQuizSet;
      });
    },
  };
}

function hashContent(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

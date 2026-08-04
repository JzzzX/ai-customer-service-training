import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "./client";
import {
  knowledgeUnits,
  knowledgeVersions,
  questions,
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
    title: string;
    passingScore: number;
    createdById: string;
  };
  questions: Array<{
    knowledgeVersionId: string;
    knowledgeUnitId: string;
    questionKey: string;
    type: QuizQuestionDraft["type"];
    prompt: string;
    options: string[];
    correctAnswers: string[];
    explanation: string;
    category: string;
    difficulty: QuizQuestionDraft["difficulty"];
    createdById: string;
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
  createdByIdInput: string,
  store: QuizDraftPublicationStore,
): Promise<{ id: string; quizHash: string; created: boolean }> {
  const draft = quizDraftPackSchema.parse(input);
  const createdById = z.string().uuid().parse(createdByIdInput);
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
  if (!knowledge.isActive) {
    throw new Error("题库草稿绑定的知识版本不是当前活动版本。");
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
      questionKey: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      correctAnswers: question.correctAnswers,
      explanation: question.explanation,
      category: question.category,
      difficulty: question.difficulty,
      createdById,
      position,
    };
  });

  const published = await store.publishDraftAtomically({
    quizSet: {
      knowledgeVersionId: knowledge.id,
      quizHash: draft.quizHash,
      title: draft.title,
      passingScore: draft.passingScore,
      createdById,
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
        .where(eq(quizSets.quizHash, quizHash))
        .limit(1);
      return quizSet ?? null;
    },

    async resolveKnowledgeContext(versionHash, unitKeys) {
      const [version] = await database
        .select({
          id: knowledgeVersions.id,
          versionHash: knowledgeVersions.versionHash,
          isActive: knowledgeVersions.isActive,
        })
        .from(knowledgeVersions)
        .where(eq(knowledgeVersions.versionHash, versionHash))
        .limit(1);
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
              );
      return { ...version, units };
    },

    async publishDraftAtomically(publication) {
      return database.transaction(async (transaction) => {
        const [insertedQuizSet] = await transaction
          .insert(quizSets)
          .values({
            ...publication.quizSet,
            status: "draft",
            description: "自动生成草稿，须经知识负责人逐题审核后发布。",
          })
          .onConflictDoNothing({ target: quizSets.quizHash })
          .returning({ id: quizSets.id, quizHash: quizSets.quizHash });

        if (!insertedQuizSet) {
          const [existingQuizSet] = await transaction
            .select({ id: quizSets.id, quizHash: quizSets.quizHash })
            .from(quizSets)
            .where(eq(quizSets.quizHash, publication.quizSet.quizHash))
            .limit(1);
          if (!existingQuizSet) {
            throw new Error("题库草稿并发发布后无法读取。");
          }
          return existingQuizSet;
        }

        await transaction
          .insert(questions)
          .values(
            publication.questions.map((question) => ({
              knowledgeVersionId: question.knowledgeVersionId,
              knowledgeUnitId: question.knowledgeUnitId,
              questionKey: question.questionKey,
              type: question.type,
              prompt: question.prompt,
              options: question.options,
              correctAnswers: question.correctAnswers,
              explanation: question.explanation,
              category: question.category,
              difficulty: question.difficulty,
              createdById: question.createdById,
              status: "draft" as const,
            })),
          )
          .onConflictDoNothing({
            target: [
              questions.knowledgeVersionId,
              questions.questionKey,
            ],
          });

        const storedQuestions = await transaction
          .select({
            id: questions.id,
            questionKey: questions.questionKey,
            knowledgeUnitId: questions.knowledgeUnitId,
            type: questions.type,
            prompt: questions.prompt,
            options: questions.options,
            correctAnswers: questions.correctAnswers,
            explanation: questions.explanation,
            category: questions.category,
            difficulty: questions.difficulty,
          })
          .from(questions)
          .where(
            and(
              eq(
                questions.knowledgeVersionId,
                publication.quizSet.knowledgeVersionId,
              ),
              inArray(
                questions.questionKey,
                publication.questions.map(
                  (question) => question.questionKey,
                ),
              ),
            ),
          );
        const storedByKey = new Map(
          storedQuestions.map((question) => [
            question.questionKey,
            question,
          ]),
        );

        const links = publication.questions.map((question) => {
          const stored = storedByKey.get(question.questionKey);
          if (!stored || !matchesPreparedQuestion(stored, question)) {
            throw new Error(
              `同一知识版本的问题键存在不同内容：${question.questionKey}`,
            );
          }
          return {
            quizSetId: insertedQuizSet.id,
            questionId: stored.id,
            position: question.position,
            points: 1,
          };
        });
        await transaction.insert(quizSetQuestions).values(links);

        return insertedQuizSet;
      });
    },
  };
}

function matchesPreparedQuestion(
  stored: {
    knowledgeUnitId: string;
    type: QuizQuestionDraft["type"];
    prompt: string;
    options: string[];
    correctAnswers: string[];
    explanation: string;
    category: string;
    difficulty: QuizQuestionDraft["difficulty"];
  },
  prepared: PreparedQuizDraftPublication["questions"][number],
): boolean {
  return (
    stored.knowledgeUnitId === prepared.knowledgeUnitId &&
    stored.type === prepared.type &&
    stored.prompt === prepared.prompt &&
    JSON.stringify(stored.options) === JSON.stringify(prepared.options) &&
    JSON.stringify(stored.correctAnswers) ===
      JSON.stringify(prepared.correctAnswers) &&
    stored.explanation === prepared.explanation &&
    stored.category === prepared.category &&
    stored.difficulty === prepared.difficulty
  );
}

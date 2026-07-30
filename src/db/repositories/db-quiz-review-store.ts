import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { DatabaseClient } from "../client";
import {
  knowledgeUnits,
  knowledgeVersions,
  questionReviews,
  questions,
  quizSetQuestions,
  quizSets,
} from "../schema";
import {
  approveQuizQuestion,
  hashQuizQuestion,
  publishQuizReview,
  quizReviewSchema,
} from "@/lib/quiz/review";
import type { QuizReview } from "@/lib/quiz/review";
import type {
  ApproveStoredQuestionInput,
  QuizReviewStore,
} from "@/lib/quiz/review-store";
import {
  quizPublishedPackSchema,
  type QuizPublishedPack,
  type QuizQuestionDraft,
} from "@/lib/quiz/schema";

type ReviewSetRow = {
  id: string;
  quizHash: string;
  knowledgePackHash: string;
  title: string;
  passingScore: number;
};

type ReviewQuestionRow = {
  id: string;
  questionKey: string;
  knowledgeUnitKey: string;
  type: QuizQuestionDraft["type"];
  prompt: string;
  options: string[];
  correctAnswers: string[];
  explanation: string;
  category: string;
  difficulty: QuizQuestionDraft["difficulty"];
  sources: QuizQuestionDraft["sources"];
  position: number;
};

export class DbQuizReviewStore implements QuizReviewStore {
  constructor(private readonly database: DatabaseClient) {}

  async loadReview(): Promise<QuizReview> {
    const [set] = await this.database
      .select({
        id: quizSets.id,
        quizHash: quizSets.quizHash,
        knowledgePackHash: knowledgeVersions.versionHash,
        title: quizSets.title,
        passingScore: quizSets.passingScore,
      })
      .from(quizSets)
      .innerJoin(
        knowledgeVersions,
        eq(quizSets.knowledgeVersionId, knowledgeVersions.id),
      )
      .where(eq(quizSets.status, "draft"))
      .orderBy(desc(quizSets.createdAt), desc(quizSets.id))
      .limit(1);
    if (!set) {
      throw new Error("当前没有待审核的题库草稿。");
    }
    return this.loadReviewForSet(set);
  }

  async approveQuestion(
    input: ApproveStoredQuestionInput,
  ): Promise<QuizReview> {
    const reviewerId = z.string().uuid().parse(input.reviewerId);
    const current = await this.loadReview();
    const [published] = await this.database
      .select({ id: quizSets.id })
      .from(quizSets)
      .where(
        and(
          eq(quizSets.status, "published"),
          eq(quizSets.sourceQuizHash, current.sourceQuizHash),
        ),
      )
      .limit(1);
    if (published) {
      throw new Error("该题库草稿已经发布，不能继续编辑。");
    }

    const updated = approveQuizQuestion(current, {
      ...input,
      reviewerId,
    });
    const approved = updated.questions.find(
      (item) => item.question.id === input.questionId,
    );
    if (!approved) {
      throw new Error(`找不到待审核题目：${input.questionId}`);
    }

    await this.database.transaction(async (transaction) => {
      const [stored] = await transaction
        .select({ id: questions.id })
        .from(questions)
        .innerJoin(
          quizSetQuestions,
          eq(quizSetQuestions.questionId, questions.id),
        )
        .innerJoin(
          quizSets,
          eq(quizSetQuestions.quizSetId, quizSets.id),
        )
        .where(
          and(
            eq(quizSets.quizHash, current.sourceQuizHash),
            eq(questions.questionKey, input.questionId),
          ),
        )
        .limit(1);
      if (!stored) {
        throw new Error(`找不到待审核题目：${input.questionId}`);
      }

      await transaction
        .update(questions)
        .set({
          prompt: approved.question.prompt,
          options: approved.question.options,
          correctAnswers: approved.question.correctAnswers,
          explanation: approved.question.explanation,
          category: approved.question.category,
          difficulty: approved.question.difficulty,
          updatedAt: new Date(),
        })
        .where(eq(questions.id, stored.id));
      await transaction
        .insert(questionReviews)
        .values({
          questionId: stored.id,
          reviewerId,
          contentHash: hashQuizQuestion(approved.question),
          snapshot: approved.question,
        })
        .onConflictDoNothing({
          target: [
            questionReviews.questionId,
            questionReviews.contentHash,
          ],
        });
    });

    return this.loadReview();
  }

  async publish(): Promise<QuizPublishedPack> {
    const current = await this.loadReview();
    publishQuizReview(current);

    const publishedHash = await this.database.transaction(
      async (transaction) => {
        const [set] = await transaction
          .select({
            id: quizSets.id,
            quizHash: quizSets.quizHash,
            knowledgePackHash: knowledgeVersions.versionHash,
            title: quizSets.title,
            passingScore: quizSets.passingScore,
            knowledgeVersionId: quizSets.knowledgeVersionId,
            createdById: quizSets.createdById,
          })
          .from(quizSets)
          .innerJoin(
            knowledgeVersions,
            eq(quizSets.knowledgeVersionId, knowledgeVersions.id),
          )
          .where(
            and(
              eq(quizSets.status, "draft"),
              eq(quizSets.quizHash, current.sourceQuizHash),
            ),
          )
          .limit(1);
        if (!set) {
          throw new Error("待发布题库草稿不存在。");
        }

        const questionRows = await selectReviewQuestions(
          transaction,
          set.id,
        );
        const reviewRows = await selectReviewAuditRows(
          transaction,
          questionRows.map((row) => row.id),
        );
        const transactionReview = buildReview(set, questionRows, reviewRows);
        const published = publishQuizReview(transactionReview);

        const [existing] = await transaction
          .select({ quizHash: quizSets.quizHash })
          .from(quizSets)
          .where(eq(quizSets.quizHash, published.quizHash))
          .limit(1);
        if (existing) {
          return existing.quizHash;
        }

        const [publishedSet] = await transaction
          .insert(quizSets)
          .values({
            knowledgeVersionId: set.knowledgeVersionId,
            quizHash: published.quizHash,
            sourceQuizHash: set.quizHash,
            title: set.title,
            description: "已通过逐题人工审核的不可变正式题组。",
            status: "published",
            passingScore: set.passingScore,
            publishedAt: new Date(),
            createdById: set.createdById,
          })
          .returning({ id: quizSets.id });
        if (!publishedSet) {
          throw new Error("正式题组写入失败。");
        }

        await transaction.insert(quizSetQuestions).values(
          questionRows.map((question) => ({
            quizSetId: publishedSet.id,
            questionId: question.id,
            position: question.position,
            points: 1,
          })),
        );
        await transaction
          .update(questions)
          .set({ status: "published", updatedAt: new Date() })
          .where(
            inArray(
              questions.id,
              questionRows.map((question) => question.id),
            ),
          );
        return published.quizHash;
      },
    );

    const published = await this.loadPublishedByHash(publishedHash);
    if (!published) {
      throw new Error("正式题组发布后无法读取。");
    }
    return published;
  }

  async loadPublished(): Promise<QuizPublishedPack | null> {
    const [set] = await this.database
      .select({ quizHash: quizSets.quizHash })
      .from(quizSets)
      .where(eq(quizSets.status, "published"))
      .orderBy(desc(quizSets.publishedAt), desc(quizSets.id))
      .limit(1);
    return set ? this.loadPublishedByHash(set.quizHash) : null;
  }

  private async loadReviewForSet(set: ReviewSetRow): Promise<QuizReview> {
    const questionRows = await selectReviewQuestions(
      this.database,
      set.id,
    );
    const reviewRows = await selectReviewAuditRows(
      this.database,
      questionRows.map((row) => row.id),
    );
    return buildReview(set, questionRows, reviewRows);
  }

  private async loadPublishedByHash(
    quizHash: string,
  ): Promise<QuizPublishedPack | null> {
    const [set] = await this.database
      .select({
        id: quizSets.id,
        quizHash: quizSets.quizHash,
        sourceQuizHash: quizSets.sourceQuizHash,
        knowledgePackHash: knowledgeVersions.versionHash,
        title: quizSets.title,
        passingScore: quizSets.passingScore,
      })
      .from(quizSets)
      .innerJoin(
        knowledgeVersions,
        eq(quizSets.knowledgeVersionId, knowledgeVersions.id),
      )
      .where(
        and(
          eq(quizSets.status, "published"),
          eq(quizSets.quizHash, quizHash),
        ),
      )
      .limit(1);
    if (!set?.sourceQuizHash) {
      return null;
    }

    const questionRows = await selectReviewQuestions(
      this.database,
      set.id,
    );
    return quizPublishedPackSchema.parse({
      schemaVersion: 1,
      quizHash: set.quizHash,
      sourceQuizHash: set.sourceQuizHash,
      knowledgePackHash: set.knowledgePackHash,
      title: set.title,
      passingScore: set.passingScore,
      status: "published",
      questions: questionRows.map((row) => ({
        ...toDraftQuestion(row),
        status: "published",
      })),
    });
  }
}

async function selectReviewQuestions(
  database: Pick<DatabaseClient, "select">,
  quizSetId: string,
): Promise<ReviewQuestionRow[]> {
  return database
    .select({
      id: questions.id,
      questionKey: questions.questionKey,
      knowledgeUnitKey: knowledgeUnits.unitKey,
      type: questions.type,
      prompt: questions.prompt,
      options: questions.options,
      correctAnswers: questions.correctAnswers,
      explanation: questions.explanation,
      category: questions.category,
      difficulty: questions.difficulty,
      sources: knowledgeUnits.sources,
      position: quizSetQuestions.position,
    })
    .from(quizSetQuestions)
    .innerJoin(
      questions,
      eq(quizSetQuestions.questionId, questions.id),
    )
    .innerJoin(
      knowledgeUnits,
      eq(questions.knowledgeUnitId, knowledgeUnits.id),
    )
    .where(eq(quizSetQuestions.quizSetId, quizSetId))
    .orderBy(quizSetQuestions.position);
}

async function selectReviewAuditRows(
  database: Pick<DatabaseClient, "select">,
  questionIds: string[],
): Promise<
  Array<{
    questionId: string;
    reviewerId: string;
    contentHash: string;
  }>
> {
  if (questionIds.length === 0) {
    return [];
  }
  return database
    .select({
      questionId: questionReviews.questionId,
      reviewerId: questionReviews.reviewerId,
      contentHash: questionReviews.contentHash,
    })
    .from(questionReviews)
    .where(inArray(questionReviews.questionId, questionIds))
    .orderBy(desc(questionReviews.createdAt), desc(questionReviews.id));
}

function buildReview(
  set: ReviewSetRow,
  questionRows: ReviewQuestionRow[],
  reviewRows: Array<{
    questionId: string;
    reviewerId: string;
    contentHash: string;
  }>,
): QuizReview {
  const reviewsByQuestion = new Map<
    string,
    Map<string, string>
  >();
  for (const review of reviewRows) {
    const hashes =
      reviewsByQuestion.get(review.questionId) ?? new Map<string, string>();
    if (!hashes.has(review.contentHash)) {
      hashes.set(review.contentHash, review.reviewerId);
    }
    reviewsByQuestion.set(review.questionId, hashes);
  }

  return quizReviewSchema.parse({
    schemaVersion: 1,
    sourceQuizHash: set.quizHash,
    knowledgePackHash: set.knowledgePackHash,
    title: set.title,
    passingScore: set.passingScore,
    questions: questionRows.map((row) => {
      const question = toDraftQuestion(row);
      const reviewerId = reviewsByQuestion
        .get(row.id)
        ?.get(hashQuizQuestion(question));
      return {
        question,
        decision: reviewerId ? "approved" : "pending",
        ...(reviewerId ? { reviewerId } : {}),
      };
    }),
  });
}

function toDraftQuestion(row: ReviewQuestionRow): QuizQuestionDraft {
  return {
    id: row.questionKey,
    knowledgeUnitId: row.knowledgeUnitKey,
    type: row.type,
    prompt: row.prompt,
    options: row.options,
    correctAnswers: row.correctAnswers,
    explanation: row.explanation,
    category: row.category,
    difficulty: row.difficulty,
    sources: row.sources,
    status: "draft",
  };
}

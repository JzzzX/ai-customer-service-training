import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
} from "drizzle-orm";

import type { DatabaseClient } from "../client";
import {
  assignments,
  questions,
  quizAnswers,
  quizAttempts,
  quizSetQuestions,
  quizSets,
  topicQuizAnswers,
  topicQuizAttempts,
} from "../schema";
import { evaluateAnswer, finishQuizAttempt } from "@/lib/quiz/attempt";
import {
  quizAttemptRecordSchema,
  saveQuizAttemptInputSchema,
  type QuizAttemptRecord,
  type QuizAttemptStore,
  type SaveQuizAttemptInput,
} from "@/lib/quiz/attempt-store";
import { topicQuizQuestions } from "@/lib/quiz/question-bank";
import { createTopicQuizHash } from "@/lib/quiz/topic-hash";

type AttemptRow = {
  id: string;
  learnerId: string;
  quizHash: string;
  assignmentId: string | null;
  status: "in_progress" | "passed" | "needs_retry";
  correctCount: number;
  totalQuestions: number;
  score: number | null;
  completedAt: Date | null;
};

type TopicAttemptRow = {
  id: string;
  learnerId: string;
  quizHash: string;
  topicId: string;
  status: "in_progress" | "passed" | "needs_retry";
  correctCount: number;
  totalQuestions: number;
  score: number;
  completedAt: Date;
};

export class DbQuizAttemptStore implements QuizAttemptStore {
  constructor(private readonly database: DatabaseClient) {}

  async saveAttempt(
    inputValue: SaveQuizAttemptInput,
  ): Promise<QuizAttemptRecord> {
    const input = saveQuizAttemptInputSchema.parse(inputValue);
    if (input.topicId) {
      return this.saveTopicAttempt({ ...input, topicId: input.topicId });
    }
    const [existing] = await this.database
      .select({
        id: quizAttempts.id,
        learnerId: quizAttempts.learnerId,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.id, input.attemptId))
      .limit(1);
    if (existing && existing.learnerId !== input.learnerId) {
      throw new Error("无权访问该小测记录。");
    }
    if (existing) {
      return this.loadAttempt(input.learnerId, input.attemptId);
    }

    await this.database.transaction(async (transaction) => {
      const [quizSet] = await transaction
        .select({
          id: quizSets.id,
          knowledgeVersionId: quizSets.knowledgeVersionId,
          passingScore: quizSets.passingScore,
        })
        .from(quizSets)
        .where(
          and(
            eq(quizSets.quizHash, input.quizHash),
            eq(quizSets.status, "published"),
          ),
        )
        .limit(1);
      if (!quizSet) {
        throw new Error("当前正式题组已更新，请重新开始练习。");
      }

      const officialQuestions = await transaction
        .select({
          id: questions.id,
          questionKey: questions.questionKey,
          correctAnswers: questions.correctAnswers,
        })
        .from(quizSetQuestions)
        .innerJoin(
          questions,
          eq(quizSetQuestions.questionId, questions.id),
        )
        .where(eq(quizSetQuestions.quizSetId, quizSet.id));
      const questionByKey = new Map(
        officialQuestions.map((question) => [
          question.questionKey,
          question,
        ]),
      );
      const checkedAnswers = input.answers.map((answer) => {
        const question = questionByKey.get(answer.questionId);
        if (!question) {
          throw new Error("题目不属于当前已发布题组。");
        }
        return {
          questionId: question.id,
          questionKey: question.questionKey,
          selectedAnswers: answer.selectedAnswers,
          isCorrect: evaluateAnswer(
            answer.selectedAnswers,
            question.correctAnswers,
          ),
        };
      });
      const correctCount = checkedAnswers.filter(
        (answer) => answer.isCorrect,
      ).length;
      const outcome = finishQuizAttempt({
        passingScore: quizSet.passingScore,
        correctCount,
        totalQuestions: checkedAnswers.length,
      });
      const completedAt = input.completedAt
        ? new Date(input.completedAt)
        : new Date();

      if (input.assignmentId) {
        const [assignment] = await transaction
          .select({ id: assignments.id })
          .from(assignments)
          .where(
            and(
              eq(assignments.id, input.assignmentId),
              eq(assignments.learnerId, input.learnerId),
              eq(assignments.assignmentType, "quiz"),
              eq(assignments.quizSetId, quizSet.id),
            ),
          )
          .limit(1);
        if (!assignment) {
          throw new Error("训练任务不存在或不属于当前学员。");
        }
      }

      const [inserted] = await transaction
        .insert(quizAttempts)
        .values({
          id: input.attemptId,
          quizSetId: quizSet.id,
          learnerId: input.learnerId,
          knowledgeVersionId: quizSet.knowledgeVersionId,
          assignmentId: input.assignmentId,
          status: outcome.status,
          correctCount,
          totalQuestions: checkedAnswers.length,
          score: outcome.score,
          completedAt,
        })
        .onConflictDoNothing({ target: quizAttempts.id })
        .returning({ id: quizAttempts.id });
      if (!inserted) {
        return;
      }

      await transaction.insert(quizAnswers).values(
        checkedAnswers.map((answer) => ({
          quizAttemptId: inserted.id,
          questionId: answer.questionId,
          selectedAnswers: answer.selectedAnswers,
          isCorrect: answer.isCorrect,
          answeredAt: completedAt,
        })),
      );
      if (input.assignmentId) {
        await transaction
          .update(assignments)
          .set({
            status: "completed",
            startedAt: completedAt,
            completedAt,
          })
          .where(eq(assignments.id, input.assignmentId));
      }
    });

    return this.loadAttempt(input.learnerId, input.attemptId);
  }

  async listAttempts(learnerId: string): Promise<QuizAttemptRecord[]> {
    const rows = await this.database
      .select({
        id: quizAttempts.id,
        learnerId: quizAttempts.learnerId,
        quizHash: quizSets.quizHash,
        assignmentId: quizAttempts.assignmentId,
        status: quizAttempts.status,
        correctCount: quizAttempts.correctCount,
        totalQuestions: quizAttempts.totalQuestions,
        score: quizAttempts.score,
        completedAt: quizAttempts.completedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizSets, eq(quizAttempts.quizSetId, quizSets.id))
      .where(
        and(
          eq(quizAttempts.learnerId, learnerId),
          isNotNull(quizAttempts.completedAt),
        ),
      )
      .orderBy(desc(quizAttempts.completedAt), desc(quizAttempts.id));
    const topicRows = await this.database
      .select({
        id: topicQuizAttempts.id,
        learnerId: topicQuizAttempts.learnerId,
        quizHash: topicQuizAttempts.quizHash,
        topicId: topicQuizAttempts.topicId,
        status: topicQuizAttempts.status,
        correctCount: topicQuizAttempts.correctCount,
        totalQuestions: topicQuizAttempts.totalQuestions,
        score: topicQuizAttempts.score,
        completedAt: topicQuizAttempts.completedAt,
      })
      .from(topicQuizAttempts)
      .where(eq(topicQuizAttempts.learnerId, learnerId))
      .orderBy(
        desc(topicQuizAttempts.completedAt),
        desc(topicQuizAttempts.id),
      );
    const records = [
      ...(await this.mapAttemptRows(rows)),
      ...(await this.mapTopicAttemptRows(topicRows)),
    ];
    return records.toSorted((left, right) =>
      right.completedAt.localeCompare(left.completedAt),
    );
  }

  private async saveTopicAttempt(
    input: SaveQuizAttemptInput & { topicId: string },
  ): Promise<QuizAttemptRecord> {
    if (input.assignmentId) {
      throw new Error("专题练习不能关联正式训练任务。");
    }
    if (input.quizHash !== createTopicQuizHash(input.topicId)) {
      throw new Error("专题练习版本无效，请重新开始练习。");
    }
    const [existing] = await this.database
      .select({
        id: topicQuizAttempts.id,
        learnerId: topicQuizAttempts.learnerId,
      })
      .from(topicQuizAttempts)
      .where(eq(topicQuizAttempts.id, input.attemptId))
      .limit(1);
    if (existing && existing.learnerId !== input.learnerId) {
      throw new Error("无权访问该小测记录。");
    }
    if (existing) {
      return this.loadTopicAttempt(input.learnerId, input.attemptId);
    }

    const questionByKey = new Map(
      topicQuizQuestions
        .filter((question) => question.category === input.topicId)
        .map((question) => [question.id, question]),
    );
    const checkedAnswers = input.answers.map((answer) => {
      const question = questionByKey.get(answer.questionId);
      if (!question) {
        throw new Error("题目不属于当前专题题库。");
      }
      return {
        questionKey: question.id,
        selectedAnswers: answer.selectedAnswers,
        isCorrect: evaluateAnswer(
          answer.selectedAnswers,
          question.correctAnswers,
        ),
      };
    });
    const correctCount = checkedAnswers.filter(
      (answer) => answer.isCorrect,
    ).length;
    const outcome = finishQuizAttempt({
      passingScore: input.passingScore,
      correctCount,
      totalQuestions: checkedAnswers.length,
    });
    const completedAt = input.completedAt
      ? new Date(input.completedAt)
      : new Date();

    await this.database.transaction(async (transaction) => {
      const [inserted] = await transaction
        .insert(topicQuizAttempts)
        .values({
          id: input.attemptId,
          learnerId: input.learnerId,
          topicId: input.topicId,
          quizHash: input.quizHash,
          status: outcome.status,
          correctCount,
          totalQuestions: checkedAnswers.length,
          score: outcome.score,
          completedAt,
        })
        .onConflictDoNothing({ target: topicQuizAttempts.id })
        .returning({ id: topicQuizAttempts.id });
      if (!inserted) {
        return;
      }
      await transaction.insert(topicQuizAnswers).values(
        checkedAnswers.map((answer) => ({
          topicQuizAttemptId: inserted.id,
          ...answer,
          answeredAt: completedAt,
        })),
      );
    });
    return this.loadTopicAttempt(input.learnerId, input.attemptId);
  }

  private async loadTopicAttempt(
    learnerId: string,
    attemptId: string,
  ): Promise<QuizAttemptRecord> {
    const [row] = await this.database
      .select({
        id: topicQuizAttempts.id,
        learnerId: topicQuizAttempts.learnerId,
        quizHash: topicQuizAttempts.quizHash,
        topicId: topicQuizAttempts.topicId,
        status: topicQuizAttempts.status,
        correctCount: topicQuizAttempts.correctCount,
        totalQuestions: topicQuizAttempts.totalQuestions,
        score: topicQuizAttempts.score,
        completedAt: topicQuizAttempts.completedAt,
      })
      .from(topicQuizAttempts)
      .where(
        and(
          eq(topicQuizAttempts.id, attemptId),
          eq(topicQuizAttempts.learnerId, learnerId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new Error("小测记录不存在或无权访问。");
    }
    const [record] = await this.mapTopicAttemptRows([row]);
    if (!record) {
      throw new Error("小测记录读取失败。");
    }
    return record;
  }

  private async loadAttempt(
    learnerId: string,
    attemptId: string,
  ): Promise<QuizAttemptRecord> {
    const [row] = await this.database
      .select({
        id: quizAttempts.id,
        learnerId: quizAttempts.learnerId,
        quizHash: quizSets.quizHash,
        assignmentId: quizAttempts.assignmentId,
        status: quizAttempts.status,
        correctCount: quizAttempts.correctCount,
        totalQuestions: quizAttempts.totalQuestions,
        score: quizAttempts.score,
        completedAt: quizAttempts.completedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizSets, eq(quizAttempts.quizSetId, quizSets.id))
      .where(
        and(
          eq(quizAttempts.id, attemptId),
          eq(quizAttempts.learnerId, learnerId),
          isNotNull(quizAttempts.completedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new Error("小测记录不存在或无权访问。");
    }
    const [record] = await this.mapAttemptRows([row]);
    if (!record) {
      throw new Error("小测记录读取失败。");
    }
    return record;
  }

  private async mapAttemptRows(
    rows: AttemptRow[],
  ): Promise<QuizAttemptRecord[]> {
    if (rows.length === 0) {
      return [];
    }
    const answerRows = await this.database
      .select({
        attemptId: quizAnswers.quizAttemptId,
        questionKey: questions.questionKey,
        isCorrect: quizAnswers.isCorrect,
      })
      .from(quizAnswers)
      .innerJoin(questions, eq(quizAnswers.questionId, questions.id))
      .where(
        inArray(
          quizAnswers.quizAttemptId,
          rows.map((row) => row.id),
        ),
      );
    const missedByAttempt = new Map<string, string[]>();
    for (const answer of answerRows) {
      if (!answer.isCorrect) {
        missedByAttempt.set(answer.attemptId, [
          ...(missedByAttempt.get(answer.attemptId) ?? []),
          answer.questionKey,
        ]);
      }
    }

    return rows.map((row) =>
      quizAttemptRecordSchema.parse({
        id: row.id,
        learnerId: row.learnerId,
        quizHash: row.quizHash,
        ...(row.assignmentId
          ? { assignmentId: row.assignmentId }
          : {}),
        status: row.status,
        correctCount: row.correctCount,
        totalQuestions: row.totalQuestions,
        score: row.score,
        missedQuestionIds: missedByAttempt.get(row.id) ?? [],
        completedAt: row.completedAt?.toISOString(),
      }),
    );
  }

  private async mapTopicAttemptRows(
    rows: TopicAttemptRow[],
  ): Promise<QuizAttemptRecord[]> {
    if (rows.length === 0) {
      return [];
    }
    const answerRows = await this.database
      .select({
        attemptId: topicQuizAnswers.topicQuizAttemptId,
        questionKey: topicQuizAnswers.questionKey,
        isCorrect: topicQuizAnswers.isCorrect,
      })
      .from(topicQuizAnswers)
      .where(
        inArray(
          topicQuizAnswers.topicQuizAttemptId,
          rows.map((row) => row.id),
        ),
      );
    const missedByAttempt = new Map<string, string[]>();
    for (const answer of answerRows) {
      if (!answer.isCorrect) {
        missedByAttempt.set(answer.attemptId, [
          ...(missedByAttempt.get(answer.attemptId) ?? []),
          answer.questionKey,
        ]);
      }
    }
    return rows.map((row) =>
      quizAttemptRecordSchema.parse({
        id: row.id,
        learnerId: row.learnerId,
        quizHash: row.quizHash,
        topicId: row.topicId,
        status: row.status,
        correctCount: row.correctCount,
        totalQuestions: row.totalQuestions,
        score: row.score,
        missedQuestionIds: missedByAttempt.get(row.id) ?? [],
        completedAt: row.completedAt.toISOString(),
      }),
    );
  }
}

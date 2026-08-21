import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../client";
import {
  questions,
  questionCatalogPublications,
  quizAnswers,
  quizAttemptQuestions,
  quizAttempts,
  quizSetQuestions,
  quizSets,
  topicQuizAnswers,
  topicQuizAttempts,
} from "../schema";
import { evaluateAnswer, finishQuizAttempt } from "@/lib/quiz/attempt";
import { normalizeSourceLocators } from "@/lib/knowledge/source-locator-compat";
import {
  quizAttemptSnapshotSchema,
  quizAttemptRecordSchema,
  saveQuizAttemptInputSchema,
  startQuizAttemptInputSchema,
  type QuizAttemptSnapshot,
  type QuizAttemptRecord,
  type QuizAttemptStore,
  type SaveQuizAttemptInput,
  type StartQuizAttemptInput,
} from "@/lib/quiz/attempt-store";

type AttemptRow = {
  id: string;
  learnerId: string;
  quizHash: string;
  status: "in_progress" | "passed" | "needs_retry";
  correctCount: number;
  totalQuestions: number;
  score: number | null;
  completedAt: Date | null;
  topicId: string | null;
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

const linkedQuestions = alias(questions, "linked_questions");

export class DbQuizAttemptStore implements QuizAttemptStore {
  constructor(private readonly database: DatabaseClient) {}

  async startAttempt(inputValue: StartQuizAttemptInput): Promise<QuizAttemptSnapshot> {
    const input = startQuizAttemptInputSchema.parse(inputValue);
    this.database.transaction((transaction) => {
      const existing = transaction
        .select({ learnerId: quizAttempts.learnerId })
        .from(quizAttempts)
        .where(eq(quizAttempts.id, input.attemptId))
        .get();
      if (existing) {
        if (existing.learnerId !== input.learnerId) throw new Error("无权访问该小测记录。");
        return;
      }
      const quizSet = transaction
        .select({
          id: quizSets.id,
          knowledgeVersionId: quizSets.knowledgeVersionId,
        })
        .from(quizSets)
        .where(and(
          eq(quizSets.quizHash, input.quizHash),
          eq(quizSets.status, "published"),
          input.topicId
            ? and(eq(quizSets.kind, "topic"), eq(quizSets.topicId, input.topicId))
            : eq(quizSets.kind, "formal"),
        ))
        .get();
      if (!quizSet) throw new Error("当前正式题组已更新，请重新开始练习。");

      const currentQuestions = transaction
        .select({ id: questions.id, questionKey: questions.questionKey })
        .from(quizSetQuestions)
        .innerJoin(linkedQuestions, eq(quizSetQuestions.questionId, linkedQuestions.id))
        .innerJoin(questionCatalogPublications, eq(questionCatalogPublications.catalogId, linkedQuestions.questionCatalogId))
        .innerJoin(questions, eq(questions.id, questionCatalogPublications.currentQuestionId))
        .where(and(
          eq(quizSetQuestions.quizSetId, quizSet.id),
          inArray(questions.questionKey, input.questionIds),
        ))
        .all();
      const byKey = new Map(currentQuestions.map((question) => [question.questionKey, question]));
      if (byKey.size !== input.questionIds.length) throw new Error("题目不属于当前已发布题组。");
      const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
      transaction.insert(quizAttempts).values({
        id: input.attemptId,
        quizSetId: quizSet.id,
        learnerId: input.learnerId,
        knowledgeVersionId: quizSet.knowledgeVersionId,
        status: "in_progress",
        totalQuestions: input.questionIds.length,
        startedAt,
      }).run();
      transaction.insert(quizAttemptQuestions).values(
        input.questionIds.map((questionKey, position) => ({
          quizAttemptId: input.attemptId,
          questionId: byKey.get(questionKey)!.id,
          position,
        })),
      ).run();
    }, { behavior: "immediate" });

    return this.loadSnapshot(input.learnerId, input.attemptId);
  }

  async loadSnapshot(learnerId: string, attemptId: string): Promise<QuizAttemptSnapshot> {
    const attempt = this.database
      .select({
        attemptId: quizAttempts.id,
        learnerId: quizAttempts.learnerId,
        quizHash: quizSets.quizHash,
        topicId: quizSets.topicId,
        passingScore: quizSets.passingScore,
        status: quizAttempts.status,
      })
      .from(quizAttempts)
      .innerJoin(quizSets, eq(quizSets.id, quizAttempts.quizSetId))
      .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.learnerId, learnerId)))
      .get();
    if (!attempt) throw new Error("小测记录不存在或无权访问。");
    const snapshotQuestions = this.database
      .select({
        revisionId: questions.id,
        id: questions.questionKey,
        knowledgeUnitId: questions.knowledgeUnitKey,
        type: questions.type,
        prompt: questions.prompt,
        options: questions.options,
        correctAnswers: questions.correctAnswers,
        explanation: questions.explanation,
        category: questions.category,
        difficulty: questions.difficulty,
        sources: questions.sources,
      })
      .from(quizAttemptQuestions)
      .innerJoin(questions, eq(questions.id, quizAttemptQuestions.questionId))
      .where(eq(quizAttemptQuestions.quizAttemptId, attemptId))
      .orderBy(quizAttemptQuestions.position)
      .all();
    const { topicId, ...attemptWithoutNullableTopic } = attempt;
    return quizAttemptSnapshotSchema.parse({
      ...attemptWithoutNullableTopic,
      ...(topicId ? { topicId } : {}),
      questions: snapshotQuestions.map((question) => ({
        ...question,
        status: "published" as const,
        sources: normalizeSourceLocators(question.sources),
      })),
    });
  }

  async saveAttempt(
    inputValue: SaveQuizAttemptInput,
  ): Promise<QuizAttemptRecord> {
    const input = saveQuizAttemptInputSchema.parse(inputValue);
    const existing = this.database
      .select({
        id: quizAttempts.id,
        learnerId: quizAttempts.learnerId,
        status: quizAttempts.status,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.id, input.attemptId))
      .get();
    if (existing && existing.learnerId !== input.learnerId) {
      throw new Error("无权访问该小测记录。");
    }
    if (!existing) throw new Error("小测尚未开始或已失效，请重新开始练习。");
    if (existing.status !== "in_progress") {
      return this.loadAttempt(input.learnerId, input.attemptId);
    }

    this.database.transaction((transaction) => {
      const quizSet = transaction
        .select({
          id: quizSets.id,
          quizHash: quizSets.quizHash,
          topicId: quizSets.topicId,
          passingScore: quizSets.passingScore,
        })
        .from(quizAttempts)
        .innerJoin(quizSets, eq(quizSets.id, quizAttempts.quizSetId))
        .where(
          and(
            eq(quizAttempts.id, input.attemptId),
            eq(quizAttempts.learnerId, input.learnerId),
            eq(quizAttempts.status, "in_progress"),
          ),
        )
        .get();
      if (!quizSet) {
        const completed = transaction.select({ status: quizAttempts.status }).from(quizAttempts).where(and(
          eq(quizAttempts.id, input.attemptId),
          eq(quizAttempts.learnerId, input.learnerId),
        )).get();
        if (completed?.status === "passed" || completed?.status === "needs_retry") return;
        throw new Error("当前小测与开始时的题组不一致，请重新开始练习。");
      }
      if (quizSet.quizHash !== input.quizHash || (quizSet.topicId ?? undefined) !== input.topicId) {
        throw new Error("当前小测与开始时的题组不一致，请重新开始练习。");
      }

      const officialQuestions = transaction
        .select({
          id: questions.id,
          questionKey: questions.questionKey,
          correctAnswers: questions.correctAnswers,
        })
        .from(quizAttemptQuestions)
        .innerJoin(questions, eq(questions.id, quizAttemptQuestions.questionId))
        .where(eq(quizAttemptQuestions.quizAttemptId, input.attemptId))
        .all();
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
      if (checkedAnswers.length !== officialQuestions.length) {
        throw new Error("提交答案数量与开始时的题目快照不一致。");
      }
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

      const updated = transaction
        .update(quizAttempts)
        .set({
          status: outcome.status,
          correctCount,
          score: outcome.score,
          completedAt,
        })
        .where(and(eq(quizAttempts.id, input.attemptId), eq(quizAttempts.status, "in_progress")))
        .run();
      if (updated.changes !== 1) return;

      transaction.insert(quizAnswers).values(
        checkedAnswers.map((answer) => ({
          id: randomUUID(),
          quizAttemptId: input.attemptId,
          questionId: answer.questionId,
          selectedAnswers: answer.selectedAnswers,
          isCorrect: answer.isCorrect,
          answeredAt: completedAt,
        })),
      ).run();
    }, { behavior: "immediate" });

    return this.loadAttempt(input.learnerId, input.attemptId);
  }

  async listAttempts(learnerId: string): Promise<QuizAttemptRecord[]> {
    const rows = await this.database
      .select({
        id: quizAttempts.id,
        learnerId: quizAttempts.learnerId,
        quizHash: quizSets.quizHash,
        status: quizAttempts.status,
        correctCount: quizAttempts.correctCount,
        totalQuestions: quizAttempts.totalQuestions,
        score: quizAttempts.score,
        completedAt: quizAttempts.completedAt,
        topicId: quizSets.topicId,
      })
      .from(quizAttempts)
      .innerJoin(quizSets, eq(quizAttempts.quizSetId, quizSets.id))
      .where(
        and(
          eq(quizAttempts.learnerId, learnerId),
          isNotNull(quizAttempts.completedAt),
        ),
      )
      .orderBy(desc(quizAttempts.completedAt), desc(quizAttempts.id)).all();
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
      )
      .all();
    const records = [
      ...(await this.mapAttemptRows(rows)),
      ...(await this.mapTopicAttemptRows(topicRows)),
    ];
    return records.toSorted((left, right) =>
      right.completedAt.localeCompare(left.completedAt),
    );
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
        status: quizAttempts.status,
        correctCount: quizAttempts.correctCount,
        totalQuestions: quizAttempts.totalQuestions,
        score: quizAttempts.score,
        completedAt: quizAttempts.completedAt,
        topicId: quizSets.topicId,
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
      .limit(1).all();
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
      )
      .all();
    const missedByAttempt = new Map<string, string[]>();
    const answeredByAttempt = new Map<string, string[]>();
    for (const answer of answerRows) {
      answeredByAttempt.set(answer.attemptId, [
        ...(answeredByAttempt.get(answer.attemptId) ?? []),
        answer.questionKey,
      ]);
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
        status: row.status,
        correctCount: row.correctCount,
        totalQuestions: row.totalQuestions,
        score: row.score,
        ...(row.topicId ? { topicId: row.topicId } : {}),
        missedQuestionIds: missedByAttempt.get(row.id) ?? [],
        answeredQuestionIds: answeredByAttempt.get(row.id) ?? [],
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
      )
      .all();
    const missedByAttempt = new Map<string, string[]>();
    const answeredByAttempt = new Map<string, string[]>();
    for (const answer of answerRows) {
      answeredByAttempt.set(answer.attemptId, [
        ...(answeredByAttempt.get(answer.attemptId) ?? []),
        answer.questionKey,
      ]);
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
        answeredQuestionIds: answeredByAttempt.get(row.id) ?? [],
        completedAt: row.completedAt.toISOString(),
      }),
    );
  }
}

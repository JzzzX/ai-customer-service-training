import { createHash, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { DatabaseClient } from "./client";
import { ensureQuestionRevision } from "./question-revision-publication";
import {
  knowledgeVersions,
  quizSetQuestions,
  quizSets,
} from "./schema";
import { quizTopics, topicQuizQuestions } from "@/lib/quiz/question-bank";

export type TopicQuizPublicationResult = {
  createdSetCount: number;
  existingSetCount: number;
  topicCount: number;
  questionCount: number;
};

export function publishTopicQuizCatalog(
  database: DatabaseClient,
): TopicQuizPublicationResult {
  validateStaticCatalog();
  const activeVersions = database
    .select({ id: knowledgeVersions.id })
    .from(knowledgeVersions)
    .where(
      and(
        eq(knowledgeVersions.isActive, true),
        eq(knowledgeVersions.status, "published"),
      ),
    )
    .all();
  if (activeVersions.length !== 1) {
    throw new Error("专题题库发布要求恰好一个活动知识版本。");
  }
  const knowledgeVersionId = activeVersions[0]!.id;

  return database.transaction((transaction) => {
    let createdSetCount = 0;
    let existingSetCount = 0;

    for (const topic of quizTopics) {
      const topicQuestions = topicQuizQuestions.filter(
        (question) => question.category === topic.id,
      );
      const quizHash = hashTopicSet(
        knowledgeVersionId,
        topic.id,
        topicQuestions,
      );
      const existing = transaction
        .select({ id: quizSets.id, status: quizSets.status })
        .from(quizSets)
        .where(
          and(
            eq(quizSets.quizHash, quizHash),
            eq(quizSets.kind, "topic"),
            eq(quizSets.topicId, topic.id),
          ),
        )
        .get();
      if (existing) {
        if (existing.status !== "published") {
          transaction
            .update(quizSets)
            .set({ status: "archived", updatedAt: new Date() })
            .where(
              and(
                eq(quizSets.kind, "topic"),
                eq(quizSets.topicId, topic.id),
                eq(quizSets.status, "published"),
              ),
            )
            .run();
          transaction
            .update(quizSets)
            .set({ status: "published", updatedAt: new Date() })
            .where(eq(quizSets.id, existing.id))
            .run();
        }
        existingSetCount += 1;
        continue;
      }

      transaction
        .update(quizSets)
        .set({ status: "archived", updatedAt: new Date() })
        .where(
          and(
            eq(quizSets.kind, "topic"),
            eq(quizSets.topicId, topic.id),
            eq(quizSets.status, "published"),
          ),
        )
        .run();
      const quizSetId = randomUUID();
      transaction
        .insert(quizSets)
        .values({
          id: quizSetId,
          knowledgeVersionId,
          quizHash,
          contentHash: quizHash,
          sourceQuizHash: quizHash,
          title: topic.label,
          description: topic.description,
          kind: "topic",
          topicId: topic.id,
          publicationSource: "cli",
          status: "published",
          passingScore: 80,
          publishedAt: new Date(),
        })
        .run();

      const links = topicQuestions.map((question, position) => ({
        quizSetId,
        questionId: ensureQuestionRevision(transaction, {
          stableKey: question.id,
          knowledgeVersionId,
          knowledgeUnitId: null,
          knowledgeUnitKey: question.knowledgeUnitId,
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          correctAnswers: question.correctAnswers,
          explanation: question.explanation,
          category: question.category,
          difficulty: question.difficulty,
          sources: question.sources,
        }).id,
        position,
        points: 1,
      }));
      transaction.insert(quizSetQuestions).values(links).run();
      createdSetCount += 1;
    }

    return {
      createdSetCount,
      existingSetCount,
      topicCount: quizTopics.length,
      questionCount: topicQuizQuestions.length,
    };
  });
}

function validateStaticCatalog(): void {
  if (quizTopics.length !== 5 || topicQuizQuestions.length !== 350) {
    throw new Error("专题题库必须包含5个专题和350个稳定题目键。");
  }
  const topicIds = new Set(quizTopics.map((topic) => topic.id));
  if (
    new Set(topicQuizQuestions.map((question) => question.id)).size !==
      topicQuizQuestions.length ||
    topicQuizQuestions.some((question) => !topicIds.has(question.category))
  ) {
    throw new Error("专题题库包含重复稳定键或未知分类。");
  }
}

function hashTopicSet(
  knowledgeVersionId: string,
  topicId: string,
  questions: typeof topicQuizQuestions,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({ kind: "topic", knowledgeVersionId, topicId, questions }),
    )
    .digest("hex");
}

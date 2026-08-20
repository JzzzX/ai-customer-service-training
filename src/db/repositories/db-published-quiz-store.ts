import { and, count, desc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import {
  knowledgeVersions,
  questions,
  quizSetQuestions,
  quizSets,
} from "../schema";
import { normalizeSourceLocators } from "@/lib/knowledge/source-locator-compat";
import type { PublishedQuizStore } from "@/lib/quiz/published-store";
import {
  quizPublishedPackSchema,
  type QuizPublishedPack,
  type QuizQuestionDraft,
} from "@/lib/quiz/schema";

type PublishedQuestionRow = {
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

export class DbPublishedQuizStore implements PublishedQuizStore {
  constructor(private readonly database: DatabaseClient) {}

  async loadPublished(): Promise<QuizPublishedPack | null> {
    return this.loadLatestSet("formal");
  }

  async loadPublishedTopic(topicId: string): Promise<QuizPublishedPack | null> {
    return this.loadLatestSet("topic", topicId);
  }

  async listPublishedTopics() {
    return this.database
      .select({
        topicId: quizSets.topicId,
        questionCount: count(quizSetQuestions.questionId),
      })
      .from(quizSets)
      .innerJoin(
        quizSetQuestions,
        eq(quizSetQuestions.quizSetId, quizSets.id),
      )
      .where(
        and(eq(quizSets.kind, "topic"), eq(quizSets.status, "published")),
      )
      .groupBy(quizSets.topicId)
      .orderBy(quizSets.topicId)
      .all()
      .map((row) => {
        if (!row.topicId) {
          throw new Error("已发布专题题组缺少 topic_id。");
        }
        return { topicId: row.topicId, questionCount: row.questionCount };
      });
  }

  private async loadLatestSet(
    kind: "formal" | "topic",
    topicId?: string,
  ): Promise<QuizPublishedPack | null> {
    const [set] = await this.database
      .select({
        id: quizSets.id,
        quizHash: quizSets.quizHash,
        sourceQuizHash: quizSets.sourceQuizHash,
        knowledgePackHash: knowledgeVersions.versionHash,
        title: quizSets.title,
        passingScore: quizSets.passingScore,
        kind: quizSets.kind,
        topicId: quizSets.topicId,
      })
      .from(quizSets)
      .innerJoin(
        knowledgeVersions,
        eq(quizSets.knowledgeVersionId, knowledgeVersions.id),
      )
      .where(
        and(
          eq(quizSets.status, "published"),
          eq(quizSets.kind, kind),
          ...(topicId ? [eq(quizSets.topicId, topicId)] : []),
        ),
      )
      .orderBy(desc(quizSets.publishedAt), desc(quizSets.id))
      .limit(1).all();
    if (!set) {
      return null;
    }

    // Legacy migrated quiz sets may not have sourceQuizHash.
    // Formal publication uses quizHash as sourceQuizHash,
    // so preserve that semantic as a read-time fallback.
    const sourceQuizHash =
      set.sourceQuizHash?.trim() || set.quizHash;

    const questionRows = await this.database
      .select({
        questionKey: questions.questionKey,
        knowledgeUnitKey: questions.knowledgeUnitKey,
        type: questions.type,
        prompt: questions.prompt,
        options: questions.options,
        correctAnswers: questions.correctAnswers,
        explanation: questions.explanation,
        category: questions.category,
        difficulty: questions.difficulty,
        sources: questions.sources,
        position: quizSetQuestions.position,
      })
      .from(quizSetQuestions)
      .innerJoin(questions, eq(quizSetQuestions.questionId, questions.id))
      .where(eq(quizSetQuestions.quizSetId, set.id))
      .orderBy(quizSetQuestions.position).all();

    return quizPublishedPackSchema.parse({
      schemaVersion: 1,
      quizHash: set.quizHash,
      sourceQuizHash,
      knowledgePackHash: set.knowledgePackHash,
      title: set.title,
      passingScore: set.passingScore,
      status: "published",
      kind: set.kind,
      ...(set.topicId ? { topicId: set.topicId } : {}),
      questions: questionRows.map(toPublishedQuestion),
    });
  }
}

function toPublishedQuestion(row: PublishedQuestionRow) {
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
    sources: normalizeSourceLocators(row.sources),
    status: "published" as const,
    position: row.position,
  };
}

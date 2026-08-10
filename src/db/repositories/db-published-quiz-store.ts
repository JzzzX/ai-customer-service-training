import { desc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import {
  knowledgeUnits,
  knowledgeVersions,
  questions,
  quizSetQuestions,
  quizSets,
} from "../schema";
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
      .where(eq(quizSets.status, "published"))
      .orderBy(desc(quizSets.publishedAt), desc(quizSets.id))
      .limit(1);
    if (!set?.sourceQuizHash) {
      return null;
    }

    const questionRows = await this.database
      .select({
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
      .innerJoin(questions, eq(quizSetQuestions.questionId, questions.id))
      .innerJoin(
        knowledgeUnits,
        eq(questions.knowledgeUnitId, knowledgeUnits.id),
      )
      .where(eq(quizSetQuestions.quizSetId, set.id))
      .orderBy(quizSetQuestions.position);

    return quizPublishedPackSchema.parse({
      schemaVersion: 1,
      quizHash: set.quizHash,
      sourceQuizHash: set.sourceQuizHash,
      knowledgePackHash: set.knowledgePackHash,
      title: set.title,
      passingScore: set.passingScore,
      status: "published",
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
    sources: row.sources,
    status: "published" as const,
    position: row.position,
  };
}

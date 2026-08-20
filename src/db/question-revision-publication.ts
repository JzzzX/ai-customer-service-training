import { createHash, randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "./client";
import { questionCatalogs, questions } from "./schema";
import type { SourceLocator } from "@/lib/knowledge/schema";
import type { QuizQuestionDraft } from "@/lib/quiz/schema";

type Database = ReturnType<typeof getDatabase>;
type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type QuestionRevisionInput = {
  stableKey: string;
  knowledgeVersionId: string;
  knowledgeUnitId: string | null;
  knowledgeUnitKey: string;
  type: QuizQuestionDraft["type"];
  prompt: string;
  options: string[];
  correctAnswers: string[];
  explanation: string;
  category: string;
  difficulty: QuizQuestionDraft["difficulty"];
  sources: SourceLocator[];
};

export function ensureQuestionRevision(
  transaction: DatabaseTransaction,
  input: QuestionRevisionInput,
): { id: string; revision: number; created: boolean } {
  transaction
    .insert(questionCatalogs)
    .values({ id: randomUUID(), stableKey: input.stableKey })
    .onConflictDoNothing({ target: questionCatalogs.stableKey })
    .run();
  const catalog = transaction
    .select({ id: questionCatalogs.id })
    .from(questionCatalogs)
    .where(eq(questionCatalogs.stableKey, input.stableKey))
    .get();
  if (!catalog) {
    throw new Error(`题目目录创建后无法读取：${input.stableKey}`);
  }

  const contentHash = hashQuestionRevision(input);
  const existing = transaction
    .select({ id: questions.id, revision: questions.revision })
    .from(questions)
    .where(
      and(
        eq(questions.questionCatalogId, catalog.id),
        eq(questions.contentHash, contentHash),
      ),
    )
    .get();
  if (existing) {
    return { ...existing, created: false };
  }

  const latest = transaction
    .select({ revision: questions.revision })
    .from(questions)
    .where(eq(questions.questionCatalogId, catalog.id))
    .orderBy(desc(questions.revision))
    .limit(1)
    .get();
  const revision = (latest?.revision ?? 0) + 1;
  const id = randomUUID();
  transaction
    .insert(questions)
    .values({
      id,
      questionCatalogId: catalog.id,
      revision,
      contentHash,
      knowledgeVersionId: input.knowledgeVersionId,
      knowledgeUnitId: input.knowledgeUnitId,
      knowledgeUnitKey: input.knowledgeUnitKey,
      questionKey: input.stableKey,
      type: input.type,
      prompt: input.prompt,
      options: input.options,
      correctAnswers: input.correctAnswers,
      explanation: input.explanation,
      category: input.category,
      difficulty: input.difficulty,
      sources: input.sources,
      status: "published",
    })
    .run();
  return { id, revision, created: true };
}

export function hashQuestionRevision(input: QuestionRevisionInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        stableKey: input.stableKey,
        knowledgeVersionId: input.knowledgeVersionId,
        knowledgeUnitId: input.knowledgeUnitId,
        knowledgeUnitKey: input.knowledgeUnitKey,
        type: input.type,
        prompt: input.prompt,
        options: input.options,
        correctAnswers: input.correctAnswers,
        explanation: input.explanation,
        category: input.category,
        difficulty: input.difficulty,
        sources: input.sources,
      }),
    )
    .digest("hex");
}

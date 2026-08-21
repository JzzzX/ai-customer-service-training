import { randomUUID } from "node:crypto";

import { and, desc, eq, like } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, type DatabaseClient } from "./client";
import { hashQuestionRevision } from "./question-revision-publication";
import {
  questionCatalogPublications,
  questionCatalogs,
  questions,
} from "./schema";
import { sourceLocatorSchema, type SourceLocator } from "@/lib/knowledge/schema";

const difficultySchema = z.enum(["easy", "medium", "hard"]);
const editableChangesSchema = z
  .object({
    prompt: z.string().trim().min(1, "题干不能为空"),
    options: z.array(z.string().trim().min(1)).min(2, "至少需要两个选项"),
    correctAnswers: z.array(z.string().trim().min(1)).min(1, "正确答案不能为空"),
    explanation: z.string().trim().min(1, "解析不能为空"),
    category: z.string().trim().min(1, "分类不能为空"),
    difficulty: difficultySchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.options).size !== value.options.length) {
      context.addIssue({ code: "custom", message: "选项不能重复", path: ["options"] });
    }
    if (value.correctAnswers.some((answer) => !value.options.includes(answer))) {
      context.addIssue({ code: "custom", message: "正确答案必须属于选项", path: ["correctAnswers"] });
    }
  });

export type AdminQuestionEditableChanges = z.infer<typeof editableChangesSchema>;
export type AdminQuestionFilters = {
  category?: string;
  status?: "draft" | "published" | "disabled" | "archived";
  stableKey?: string;
  keyword?: string;
};

export type AdminQuestionRevision = {
  id: string;
  revision: number;
  prompt: string;
  options: string[];
  correctAnswers: string[];
  explanation: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  sources: SourceLocator[];
  status: "draft" | "published" | "disabled" | "archived";
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminQuestionCatalogRecord = {
  catalogId: string;
  stableKey: string;
  current: AdminQuestionRevision;
  history: AdminQuestionRevision[];
};

export class AdminQuestionConflictError extends Error {
  constructor(message = "题目已由其他管理员更新，请刷新后重试。") {
    super(message);
    this.name = "AdminQuestionConflictError";
  }
}

export function createAdminQuestionRepository(
  database: DatabaseClient = getDatabase(),
) {
  return {
    async list(filters: AdminQuestionFilters): Promise<AdminQuestionCatalogRecord[]> {
      const stableKey = filters.stableKey?.trim();

      const currentRows = database
        .select({ catalogId: questionCatalogs.id, stableKey: questionCatalogs.stableKey })
        .from(questionCatalogPublications)
        .innerJoin(questionCatalogs, eq(questionCatalogs.id, questionCatalogPublications.catalogId))
        .innerJoin(questions, eq(questions.id, questionCatalogPublications.currentQuestionId))
        .where(stableKey ? like(questionCatalogs.stableKey, `%${stableKey}%`) : undefined)
        .orderBy(questionCatalogs.stableKey)
        .all();

      return currentRows.map((row) => {
        const history = database
          .select(revisionSelection)
          .from(questions)
          .where(eq(questions.questionCatalogId, row.catalogId))
          .orderBy(desc(questions.revision))
          .all();
        const currentQuestionId = database
          .select({ id: questionCatalogPublications.currentQuestionId })
          .from(questionCatalogPublications)
          .where(eq(questionCatalogPublications.catalogId, row.catalogId))
          .get()?.id;
        const current = history.find((revision) => revision.id === currentQuestionId);
        if (!current) throw new Error(`题目目录缺少当前版本：${row.stableKey}`);
        return { ...row, current, history };
      }).filter((record) => record.history.some((revision) => revisionMatchesFilters(revision, filters)));
    },

    async createDraft(input: {
      catalogId: string;
      baseRevisionId: string;
      actorId: string;
      changes: AdminQuestionEditableChanges;
    }): Promise<AdminQuestionRevision> {
      const changes = editableChangesSchema.parse(input.changes);
      return database.transaction((transaction) => {
        const base = transaction
          .select()
          .from(questions)
          .where(and(eq(questions.id, input.baseRevisionId), eq(questions.questionCatalogId, input.catalogId)))
          .get();
        const publication = transaction
          .select({ currentQuestionId: questionCatalogPublications.currentQuestionId })
          .from(questionCatalogPublications)
          .where(eq(questionCatalogPublications.catalogId, input.catalogId))
          .get();
        if (!base || publication?.currentQuestionId !== base.id) {
          throw new AdminQuestionConflictError();
        }
        const sources = z.array(sourceLocatorSchema).min(1, "题目来源不可追溯").parse(base.sources);
        const latest = transaction
          .select({ revision: questions.revision })
          .from(questions)
          .where(eq(questions.questionCatalogId, input.catalogId))
          .orderBy(desc(questions.revision))
          .limit(1)
          .get();
        const revision = (latest?.revision ?? 0) + 1;
        const id = randomUUID();
        const now = new Date();
        const contentHash = hashQuestionRevision({
          stableKey: base.questionKey,
          knowledgeVersionId: base.knowledgeVersionId,
          knowledgeUnitId: base.knowledgeUnitId,
          knowledgeUnitKey: base.knowledgeUnitKey,
          type: base.type,
          ...changes,
          sources,
        });
        try {
          transaction.insert(questions).values({
            id,
            questionCatalogId: input.catalogId,
            revision,
            contentHash,
            knowledgeVersionId: base.knowledgeVersionId,
            knowledgeUnitId: base.knowledgeUnitId,
            knowledgeUnitKey: base.knowledgeUnitKey,
            questionKey: base.questionKey,
            type: base.type,
            ...changes,
            sources,
            status: "draft",
            createdById: input.actorId,
            createdAt: now,
            updatedAt: now,
          }).run();
        } catch (error) {
          if (String(error).includes("UNIQUE constraint failed")) {
            throw new AdminQuestionConflictError("相同修订已存在，请刷新后重试。");
          }
          throw error;
        }
        return transaction.select(revisionSelection).from(questions).where(eq(questions.id, id)).get()!;
      });
    },

    async publishDraft(input: {
      catalogId: string;
      draftRevisionId: string;
      expectedCurrentRevisionId: string;
      actorId: string;
    }): Promise<AdminQuestionRevision> {
      return database.transaction((transaction) => {
        const draft = transaction.select().from(questions).where(and(
          eq(questions.id, input.draftRevisionId),
          eq(questions.questionCatalogId, input.catalogId),
          eq(questions.status, "draft"),
        )).get();
        if (!draft) throw new Error("草稿不存在或已经发布。");
        editableChangesSchema.parse({
          prompt: draft.prompt,
          options: draft.options,
          correctAnswers: draft.correctAnswers,
          explanation: draft.explanation,
          category: draft.category,
          difficulty: draft.difficulty,
        });
        z.array(sourceLocatorSchema).min(1, "题目来源不可追溯").parse(draft.sources);
        const now = new Date();
        const pointerResult = transaction
          .update(questionCatalogPublications)
          .set({
            currentQuestionId: draft.id,
            publishedById: input.actorId,
            publishedAt: now,
            updatedAt: now,
          })
          .where(and(
            eq(questionCatalogPublications.catalogId, input.catalogId),
            eq(questionCatalogPublications.currentQuestionId, input.expectedCurrentRevisionId),
          ))
          .run();
        if (pointerResult.changes !== 1) throw new AdminQuestionConflictError();
        transaction.update(questions).set({ status: "published", updatedAt: now }).where(and(
          eq(questions.id, draft.id),
          eq(questions.status, "draft"),
        )).run();
        return transaction.select(revisionSelection).from(questions).where(eq(questions.id, draft.id)).get()!;
      });
    },
  };
}

const revisionSelection = {
  id: questions.id,
  revision: questions.revision,
  prompt: questions.prompt,
  options: questions.options,
  correctAnswers: questions.correctAnswers,
  explanation: questions.explanation,
  category: questions.category,
  difficulty: questions.difficulty,
  sources: questions.sources,
  status: questions.status,
  createdById: questions.createdById,
  createdAt: questions.createdAt,
  updatedAt: questions.updatedAt,
};

function revisionMatchesFilters(
  revision: AdminQuestionRevision,
  filters: AdminQuestionFilters,
): boolean {
  const category = filters.category?.trim();
  const keyword = filters.keyword?.trim().toLocaleLowerCase("zh-CN");
  return (
    (!filters.status || revision.status === filters.status)
    && (!category || revision.category === category)
    && (!keyword
      || revision.prompt.toLocaleLowerCase("zh-CN").includes(keyword)
      || revision.explanation.toLocaleLowerCase("zh-CN").includes(keyword))
  );
}

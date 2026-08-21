import { and, count, countDistinct, eq, ne } from "drizzle-orm";

import type { DatabaseClient } from "./client";
import {
  knowledgeVersions,
  questions,
  quizSetQuestions,
  quizSets,
  scenarios,
  scenarioVersions,
  users,
} from "./schema";

export type ProductionSnapshot = {
  activeKnowledgeCount: number;
  questionCount: number;
  formalCatalogCount: number;
  formalRevisionCount: number;
  publishedQuizCount: number;
  publishedQuizKnowledgeMismatchCount: number;
  publishedScenarioCount: number;
  publishedCatScenarioCount: number;
  publishedScenarioKnowledgeMismatchCount: number;
  activeLearnerCount: number;
  activeAdminCount: number;
  publishedTopicCount: number;
  publishedTopicCategoryCount: number;
  publishedTopicKnowledgeMismatchCount: number;
  topicQuestionCount: number;
  topicCatalogCount: number;
  topicRevisionCount: number;
  topicCategoryMismatchCount: number;
  topicQuestionCounts: Record<string, number>;
};

const expectedTopicQuestionCounts: Record<string, number> = {
  "产品属性及卖点": 65,
  "宠物生理和喂养": 72,
  "活动促销": 72,
  "服务流程与规则": 75,
  "日常问答": 66,
};

export type ProductionVerification = {
  technicalPassed: boolean;
  formalPassed: boolean;
  technicalIssues: string[];
  formalIssues: string[];
  snapshot: ProductionSnapshot;
};

export function evaluateProductionSnapshot(
  snapshot: ProductionSnapshot,
): ProductionVerification {
  const technicalIssues: string[] = [];
  if (snapshot.activeKnowledgeCount !== 1) {
    technicalIssues.push("必须且只能有一个活动知识版本。");
  }
  if (
    snapshot.publishedQuizCount === 1 &&
    (snapshot.questionCount !== 40 ||
      snapshot.formalCatalogCount !== 40 ||
      snapshot.formalRevisionCount !== 40)
  ) {
    technicalIssues.push("当前正式题组必须链接40道不同目录、不同版本的题目。");
  }
  if (snapshot.publishedScenarioCount !== 9) {
    technicalIssues.push("必须发布9个场景版本。");
  }
  if (snapshot.publishedCatScenarioCount !== 1) {
    technicalIssues.push("必须发布“6 个月肠胃敏感英短选粮”场景。");
  }
  if (snapshot.publishedScenarioKnowledgeMismatchCount !== 0) {
    technicalIssues.push("场景版本必须全部引用活动知识版本。");
  }
  if (snapshot.publishedQuizKnowledgeMismatchCount !== 0) {
    technicalIssues.push("正式题组必须引用活动知识版本。");
  }
  if (snapshot.publishedQuizCount > 1) {
    technicalIssues.push("正式题组只能存在一个当前版本。");
  }
  if (snapshot.activeLearnerCount < 1) {
    technicalIssues.push("至少需要一个启用中的学员账号。");
  }
  if (snapshot.activeAdminCount < 1) {
    technicalIssues.push("至少需要一个启用中的管理员账号。");
  }
  if (snapshot.publishedTopicCount !== 5) {
    technicalIssues.push("必须发布5个专题题组。");
  }
  if (snapshot.publishedTopicKnowledgeMismatchCount !== 0) {
    technicalIssues.push("专题题组必须引用活动知识版本。");
  }
  if (
    snapshot.topicQuestionCount !== 350 ||
    snapshot.publishedTopicCategoryCount !== 5 ||
    snapshot.topicCatalogCount !== 350 ||
    snapshot.topicRevisionCount !== 350 ||
    snapshot.topicCategoryMismatchCount !== 0
  ) {
    technicalIssues.push("专题题库必须包含350道不同目录、不同版本的题目，且题目分类与题组一致。");
  }
  if (
    Object.entries(expectedTopicQuestionCounts).some(
      ([topicId, expected]) => snapshot.topicQuestionCounts[topicId] !== expected,
    )
  ) {
    technicalIssues.push("专题题库分类题数必须为65/72/72/75/66。");
  }

  const formalIssues = [...technicalIssues];
  if (snapshot.publishedQuizCount !== 1) {
    formalIssues.push("正式题组尚未发布。");
  }
  if (
    snapshot.questionCount !== 40 ||
    snapshot.formalCatalogCount !== 40 ||
    snapshot.formalRevisionCount !== 40
  ) {
    const issue = "当前正式题组必须链接40道不同目录、不同版本的题目。";
    if (!formalIssues.includes(issue)) formalIssues.push(issue);
  }

  return {
    technicalPassed: technicalIssues.length === 0,
    formalPassed: formalIssues.length === 0,
    technicalIssues,
    formalIssues,
    snapshot,
  };
}

export async function verifyProductionData(
  database: DatabaseClient,
): Promise<ProductionVerification> {
  const activeVersions = await database
    .select({ id: knowledgeVersions.id })
    .from(knowledgeVersions)
    .where(and(
      eq(knowledgeVersions.isActive, true),
      eq(knowledgeVersions.status, "published"),
    ))
    .all();
  const activeVersionId = activeVersions[0]?.id;

  const formalQuestionRows = await database
    .select({
      linkCount: count(),
      catalogCount: countDistinct(questions.questionCatalogId),
      revisionCount: countDistinct(questions.id),
    })
    .from(quizSetQuestions)
    .innerJoin(quizSets, eq(quizSetQuestions.quizSetId, quizSets.id))
    .innerJoin(questions, eq(quizSetQuestions.questionId, questions.id))
    .where(and(eq(quizSets.status, "published"), eq(quizSets.kind, "formal")))
    .all();
  const publishedQuizRows = await database
    .select({ value: count() })
    .from(quizSets)
    .where(
      and(eq(quizSets.status, "published"), eq(quizSets.kind, "formal")),
    )
    .all();
  const publishedTopicRows = await database
    .select({ value: count() })
    .from(quizSets)
    .where(
      and(eq(quizSets.status, "published"), eq(quizSets.kind, "topic")),
    )
    .all();
  const publishedTopicCategoryRows = await database
    .select({ value: countDistinct(quizSets.topicId) })
    .from(quizSets)
    .where(
      and(eq(quizSets.status, "published"), eq(quizSets.kind, "topic")),
    )
    .all();
  const topicQuestionRows = [database.$client.prepare(`
    SELECT COUNT(*) AS value,
      COUNT(DISTINCT linked.question_catalog_id) AS catalogCount,
      COUNT(DISTINCT current.id) AS revisionCount
    FROM quiz_set_questions link
    INNER JOIN quiz_sets set_row ON set_row.id = link.quiz_set_id
    INNER JOIN questions linked ON linked.id = link.question_id
    INNER JOIN question_catalog_publications publication
      ON publication.catalog_id = linked.question_catalog_id
    INNER JOIN questions current ON current.id = publication.current_question_id
    WHERE set_row.status = 'published' AND set_row.kind = 'topic'
      AND current.status = 'published'
  `).get() as { value: number; catalogCount: number; revisionCount: number }];
  const topicCategoryMismatchRows = [database.$client.prepare(`
    SELECT COUNT(*) AS value
    FROM quiz_set_questions link
    INNER JOIN quiz_sets set_row ON set_row.id = link.quiz_set_id
    INNER JOIN questions linked ON linked.id = link.question_id
    INNER JOIN question_catalog_publications publication
      ON publication.catalog_id = linked.question_catalog_id
    INNER JOIN questions current ON current.id = publication.current_question_id
    WHERE set_row.status = 'published' AND set_row.kind = 'topic'
      AND current.status = 'published' AND current.category <> set_row.topic_id
  `).get() as { value: number }];
  const topicQuestionCountRows = database.$client.prepare(`
    SELECT set_row.topic_id AS topicId, COUNT(*) AS value
    FROM quiz_set_questions link
    INNER JOIN quiz_sets set_row ON set_row.id = link.quiz_set_id
    INNER JOIN questions linked ON linked.id = link.question_id
    INNER JOIN question_catalog_publications publication
      ON publication.catalog_id = linked.question_catalog_id
    INNER JOIN questions current ON current.id = publication.current_question_id
    WHERE set_row.status = 'published' AND set_row.kind = 'topic'
      AND current.status = 'published'
    GROUP BY set_row.topic_id
  `).all() as Array<{ topicId: string | null; value: number }>;
  const publishedScenarioRows = await database
    .select({ value: count() })
    .from(scenarioVersions)
    .where(eq(scenarioVersions.status, "published"))
    .all();
  const publishedCatScenarioRows = await database
    .select({ value: count() })
    .from(scenarioVersions)
    .innerJoin(scenarios, eq(scenarioVersions.scenarioId, scenarios.id))
    .where(
      and(
        eq(scenarioVersions.status, "published"),
        eq(scenarios.scenarioKey, "st_999999999999999999999999"),
        eq(scenarios.title, "6 个月肠胃敏感英短选粮"),
      ),
    )
    .all();
  const quizMismatchRows = activeVersionId
    ? await database
        .select({ value: count() })
        .from(quizSets)
        .where(
          and(
            eq(quizSets.status, "published"),
            eq(quizSets.kind, "formal"),
            ne(quizSets.knowledgeVersionId, activeVersionId),
          ),
        )
        .all()
    : publishedQuizRows;
  const topicMismatchRows = activeVersionId
    ? await database
        .select({ value: count() })
        .from(quizSets)
        .where(
          and(
            eq(quizSets.status, "published"),
            eq(quizSets.kind, "topic"),
            ne(quizSets.knowledgeVersionId, activeVersionId),
          ),
        )
        .all()
    : publishedTopicRows;
  const scenarioMismatchRows = activeVersionId
    ? await database
        .select({ value: count() })
        .from(scenarioVersions)
        .where(
          and(
            eq(scenarioVersions.status, "published"),
            ne(
              scenarioVersions.knowledgeVersionId,
              activeVersionId,
            ),
          ),
        )
        .all()
    : publishedScenarioRows;
  const activeLearnerRows = await database
    .select({ value: count() })
    .from(users)
    .where(
      and(eq(users.isActive, true), eq(users.role, "learner")),
    )
    .all();
  const activeAdminRows = await database
    .select({ value: count() })
    .from(users)
    .where(
      and(eq(users.isActive, true), eq(users.role, "admin")),
    )
    .all();
  return evaluateProductionSnapshot({
    activeKnowledgeCount: activeVersions.length,
    questionCount: formalQuestionRows[0]?.linkCount ?? 0,
    formalCatalogCount: formalQuestionRows[0]?.catalogCount ?? 0,
    formalRevisionCount: formalQuestionRows[0]?.revisionCount ?? 0,
    publishedQuizCount: publishedQuizRows[0]?.value ?? 0,
    publishedQuizKnowledgeMismatchCount:
      quizMismatchRows[0]?.value ?? 0,
    publishedScenarioCount: publishedScenarioRows[0]?.value ?? 0,
    publishedCatScenarioCount:
      publishedCatScenarioRows[0]?.value ?? 0,
    publishedScenarioKnowledgeMismatchCount:
      scenarioMismatchRows[0]?.value ?? 0,
    activeLearnerCount: activeLearnerRows[0]?.value ?? 0,
    activeAdminCount: activeAdminRows[0]?.value ?? 0,
    publishedTopicCount: publishedTopicRows[0]?.value ?? 0,
    publishedTopicCategoryCount:
      publishedTopicCategoryRows[0]?.value ?? 0,
    publishedTopicKnowledgeMismatchCount:
      topicMismatchRows[0]?.value ?? 0,
    topicQuestionCount: topicQuestionRows[0]?.value ?? 0,
    topicCatalogCount: topicQuestionRows[0]?.catalogCount ?? 0,
    topicRevisionCount: topicQuestionRows[0]?.revisionCount ?? 0,
    topicCategoryMismatchCount: topicCategoryMismatchRows[0]?.value ?? 0,
    topicQuestionCounts: Object.fromEntries(
      topicQuestionCountRows.flatMap((row) =>
        row.topicId ? [[row.topicId, row.value] as const] : [],
      ),
    ),
  });
}

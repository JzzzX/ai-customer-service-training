import { and, count, eq, ne } from "drizzle-orm";

import type { DatabaseClient } from "./client";
import { DbQuizReviewStore } from "./repositories/db-quiz-review-store";
import {
  knowledgeVersions,
  questions,
  quizSets,
  scenarioVersions,
  users,
} from "./schema";

export type ProductionSnapshot = {
  activeKnowledgeCount: number;
  questionCount: number;
  currentApprovalCount: number;
  publishedQuizCount: number;
  publishedQuizKnowledgeMismatchCount: number;
  publishedScenarioCount: number;
  publishedScenarioKnowledgeMismatchCount: number;
  activeAdminCount: number;
  activeLearnerCount: number;
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
  if (snapshot.questionCount !== 40) {
    technicalIssues.push("活动知识版本必须有40道题目。");
  }
  if (snapshot.publishedScenarioCount !== 8) {
    technicalIssues.push("必须发布8个场景版本。");
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
  if (
    snapshot.publishedQuizCount === 1 &&
    snapshot.currentApprovalCount !== 40
  ) {
    technicalIssues.push("正式题组不得绕过40/40人工审核门禁。");
  }
  if (snapshot.activeAdminCount < 1) {
    technicalIssues.push("至少需要一个启用中的管理员账号。");
  }
  if (snapshot.activeLearnerCount < 1) {
    technicalIssues.push("至少需要一个启用中的学员账号。");
  }

  const formalIssues = [...technicalIssues];
  if (
    snapshot.publishedQuizCount !== 1 ||
    snapshot.currentApprovalCount !== 40
  ) {
    formalIssues.push("正式题组尚未在40/40人工审核后发布。");
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
    .where(eq(knowledgeVersions.isActive, true));
  const activeVersionId = activeVersions[0]?.id;

  const questionRows = activeVersionId
    ? await database
        .select({ value: count() })
        .from(questions)
        .where(eq(questions.knowledgeVersionId, activeVersionId))
    : [{ value: 0 }];
  const publishedQuizRows = await database
    .select({ value: count() })
    .from(quizSets)
    .where(eq(quizSets.status, "published"));
  const publishedScenarioRows = await database
    .select({ value: count() })
    .from(scenarioVersions)
    .where(eq(scenarioVersions.status, "published"));
  const quizMismatchRows = activeVersionId
    ? await database
        .select({ value: count() })
        .from(quizSets)
        .where(
          and(
            eq(quizSets.status, "published"),
            ne(quizSets.knowledgeVersionId, activeVersionId),
          ),
        )
    : publishedQuizRows;
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
    : publishedScenarioRows;
  const activeAdminRows = await database
    .select({ value: count() })
    .from(users)
    .where(
      and(eq(users.role, "admin"), eq(users.isActive, true)),
    );
  const activeLearnerRows = await database
    .select({ value: count() })
    .from(users)
    .where(
      and(eq(users.role, "learner"), eq(users.isActive, true)),
    );
  let currentApprovalCount = 0;
  try {
    const review = await new DbQuizReviewStore(database).loadReview();
    currentApprovalCount = review.questions.filter(
      (item) => item.decision === "approved",
    ).length;
  } catch {
    currentApprovalCount = 0;
  }

  return evaluateProductionSnapshot({
    activeKnowledgeCount: activeVersions.length,
    questionCount: questionRows[0]?.value ?? 0,
    currentApprovalCount,
    publishedQuizCount: publishedQuizRows[0]?.value ?? 0,
    publishedQuizKnowledgeMismatchCount:
      quizMismatchRows[0]?.value ?? 0,
    publishedScenarioCount: publishedScenarioRows[0]?.value ?? 0,
    publishedScenarioKnowledgeMismatchCount:
      scenarioMismatchRows[0]?.value ?? 0,
    activeAdminCount: activeAdminRows[0]?.value ?? 0,
    activeLearnerCount: activeLearnerRows[0]?.value ?? 0,
  });
}

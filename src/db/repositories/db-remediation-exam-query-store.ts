import type { DatabaseClient } from "../client";
import type { RemediationExam, RemediationImprovementResult } from "@/lib/remediation/schema";

export class DbRemediationExamQueryStore {
  constructor(protected readonly database: DatabaseClient) {}

  loadForLearner(learnerId: string, examId: string): RemediationExam {
    const row = this.database.$client.prepare(`SELECT e.*, qs.quiz_hash AS quizHash, qa.completed_at AS attemptCompletedAt
      FROM remediation_exams e JOIN quiz_sets qs ON qs.id=e.quiz_set_id JOIN quiz_attempts qa ON qa.id=e.attempt_id
      WHERE e.id=? AND e.learner_id=?`).get(examId, learnerId) as Record<string, unknown> | undefined;
    if (!row) throw new Error("改善考卷不存在或无权访问。");
    const targets = this.database.$client.prepare("SELECT category,question_count AS questionCount FROM remediation_exam_targets WHERE exam_id=? ORDER BY position").all(examId) as Array<{category:string;questionCount:number}>;
    const questions = this.database.$client.prepare(`SELECT c.stable_key AS stableKey,q.id AS revisionId,q.category
      FROM quiz_attempt_questions aq JOIN questions q ON q.id=aq.question_id JOIN question_catalogs c ON c.id=q.question_catalog_id
      WHERE aq.quiz_attempt_id=? ORDER BY aq.position`).all(String(row.attempt_id)) as Array<{stableKey:string;revisionId:string;category:string}>;
    const completedAt = row.attemptCompletedAt ? new Date(Number(row.attemptCompletedAt)).toISOString() : null;
    return {
      id: String(row.id), learnerId, quizSetId: String(row.quiz_set_id), attemptId: String(row.attempt_id), quizHash: String(row.quizHash),
      weaknessFingerprint: String(row.weakness_fingerprint),
      reportRange: { preset: "custom", startDate: beijingDate(Number(row.report_start_at)), endDate: beijingDate(Number(row.report_end_exclusive_at) - 1), startAt: new Date(Number(row.report_start_at)).toISOString(), endExclusiveAt: new Date(Number(row.report_end_exclusive_at)).toISOString() },
      reportDataCutoffAt: new Date(Number(row.report_data_cutoff_at)).toISOString(), status: completedAt ? "completed" : "in_progress",
      targets, questions, createdAt: new Date(Number(row.created_at)).toISOString(), completedAt, result: completedAt ? this.result(String(row.attempt_id), targets) : null,
    };
  }

  listCompletedForLearner(learnerId: string, startAt: string, endExclusiveAt: string): RemediationExam[] {
    const ids = this.database.$client.prepare(`SELECT e.id FROM remediation_exams e JOIN quiz_attempts qa ON qa.id=e.attempt_id
      WHERE e.learner_id=? AND qa.completed_at>=? AND qa.completed_at<? ORDER BY qa.completed_at DESC`).all(learnerId, new Date(startAt).getTime(), new Date(endExclusiveAt).getTime()) as Array<{id:string}>;
    return ids.map((row) => this.loadForLearner(learnerId, row.id));
  }

  private result(attemptId: string, targets: Array<{category:string;questionCount:number}>): RemediationImprovementResult {
    const rows = this.database.$client.prepare(`SELECT q.category,a.is_correct AS isCorrect FROM quiz_answers a JOIN questions q ON q.id=a.question_id WHERE a.quiz_attempt_id=?`).all(attemptId) as Array<{category:string;isCorrect:number}>;
    const categories = targets.map((target) => { const answers = rows.filter((row) => row.category === target.category); const correctCount = answers.filter((row) => Boolean(row.isCorrect)).length; const accuracy = Math.round(correctCount / target.questionCount * 100); return { ...target, correctCount, accuracy, passed: accuracy >= 80 }; });
    const totalScore = Math.round(rows.filter((row) => Boolean(row.isCorrect)).length / 10 * 100);
    const overallPassed = totalScore >= 80;
    return { totalScore, overallPassed, categories, improved: overallPassed && categories.every((item) => item.passed) };
  }
}

function beijingDate(ms: number) { return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10); }

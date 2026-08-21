import { createHash, randomUUID } from "node:crypto";

import type { DatabaseClient } from "../client";
import { DbLearningQuizReportStore } from "./db-learning-quiz-report-store";
import type { BeijingDateRangeInput, LearningQuizReport } from "@/lib/report/learning-quiz-report";
import type { GenerateRemediationExamResult, RemediationExam, RemediationImprovementResult } from "@/lib/remediation/schema";

type Candidate = { revisionId: string; stableKey: string; category: string; lastAnsweredAt: number | null };

export class DbRemediationExamStore {
  constructor(private readonly database: DatabaseClient) {}

  generate(learnerId: string, rangeInput: BeijingDateRangeInput, now = new Date()): GenerateRemediationExamResult {
    return this.database.transaction(() => {
      const report = new DbLearningQuizReportStore(this.database).getReport(learnerId, rangeInput, now);
      const targets = report.categories.filter((item) => item.wrongCount > 0).slice(0, 2);
      if (targets.length === 0) return { status: "no_weakness" } as const;
      const attemptRows = this.completedAttemptRows(learnerId, report);
      const fingerprint = sha({ learnerId, range: report.range, attempts: attemptRows, categories: report.categories, questions: report.questionWeaknesses });
      const existing = this.database.$client.prepare(
        "SELECT id FROM remediation_exams WHERE learner_id = ? AND weakness_fingerprint = ? AND status = 'in_progress'",
      ).get(learnerId, fingerprint) as { id: string } | undefined;
      if (existing) return { status: "existing", exam: this.loadForLearner(learnerId, existing.id) } as const;

      const quota = targets.length === 1 ? 10 : 5;
      const missedByCategory = new Map(targets.map((target) => [target.category,
        report.questionWeaknesses.filter((item) => item.category === target.category).map((item) => item.stableKey),
      ]));
      const selectedMissed = new Map(targets.map((target) => [target.category, [] as string[]]));
      for (let picked = 0; picked < 4;) {
        let changed = false;
        for (const target of targets) {
          if (picked >= 4) break;
          const source = missedByCategory.get(target.category)!;
          const selected = selectedMissed.get(target.category)!;
          const next = source.find((key) => !selected.includes(key));
          if (next) { selected.push(next); picked += 1; changed = true; }
        }
        if (!changed) break;
      }

      const selections: Candidate[] = [];
      for (const target of targets) {
        const candidates = this.currentCandidates(learnerId, target.category);
        const byKey = new Map(candidates.map((item) => [item.stableKey, item]));
        const originalKeys = new Set(missedByCategory.get(target.category));
        const exact = selectedMissed.get(target.category)!.map((key) => byKey.get(key)).filter((item): item is Candidate => Boolean(item));
        const remainder = candidates.filter((item) => !originalKeys.has(item.stableKey)).sort(compareCandidate);
        const chosen = [...exact, ...remainder].slice(0, quota);
        if (chosen.length < quota) return { status: "insufficient_bank", category: target.category, required: quota, available: chosen.length } as const;
        selections.push(...chosen);
      }

      const createdAt = Date.now();
      const dataCutoff = attemptRows.reduce((max, row) => Math.max(max, row.completedAt), new Date(report.range.startAt).getTime());
      const examId = randomUUID(); const quizSetId = randomUUID(); const attemptId = randomUUID();
      const quizHash = sha({ examId, fingerprint, revisions: selections.map((item) => item.revisionId) });
      const active = this.database.$client.prepare("SELECT id FROM knowledge_versions WHERE is_active = 1 AND status = 'published'").get() as { id: string } | undefined;
      if (!active) throw new Error("当前没有已发布知识版本。");
      this.database.$client.prepare(`INSERT INTO quiz_sets
        (id,knowledge_version_id,quiz_hash,content_hash,source_quiz_hash,title,kind,publication_source,status,passing_score,published_at,created_at,updated_at)
        VALUES (?,?,?,?,?,'薄弱点改善考卷','remediation','cli','published',80,?,?,?)`).run(quizSetId, active.id, quizHash, sha(selections), fingerprint, createdAt, createdAt, createdAt);
      const link = this.database.$client.prepare("INSERT INTO quiz_set_questions (quiz_set_id,question_id,position,points) VALUES (?,?,?,1)");
      selections.forEach((item, position) => link.run(quizSetId, item.revisionId, position));
      this.database.$client.prepare(`INSERT INTO quiz_attempts
        (id,quiz_set_id,learner_id,knowledge_version_id,status,total_questions,started_at) VALUES (?,?,?,?,'in_progress',10,?)`).run(attemptId, quizSetId, learnerId, active.id, createdAt);
      const snapshot = this.database.$client.prepare("INSERT INTO quiz_attempt_questions (quiz_attempt_id,question_id,position) VALUES (?,?,?)");
      selections.forEach((item, position) => snapshot.run(attemptId, item.revisionId, position));
      this.database.$client.prepare(`INSERT INTO remediation_exams
        (id,learner_id,quiz_set_id,attempt_id,weakness_fingerprint,report_start_at,report_end_exclusive_at,report_data_cutoff_at,status,created_at)
        VALUES (?,?,?,?,?,?,?,?, 'in_progress',?)`).run(examId, learnerId, quizSetId, attemptId, fingerprint, new Date(report.range.startAt).getTime(), new Date(report.range.endExclusiveAt).getTime(), dataCutoff, createdAt);
      const insertTarget = this.database.$client.prepare("INSERT INTO remediation_exam_targets (exam_id,category,position,question_count) VALUES (?,?,?,?)");
      targets.forEach((target, position) => insertTarget.run(examId, target.category, position, quota));
      return { status: "created", exam: this.loadForLearner(learnerId, examId) } as const;
    }, { behavior: "immediate" });
  }

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

  private completedAttemptRows(learnerId: string, report: LearningQuizReport): Array<{source:string;id:string;completedAt:number}> {
    const args = [learnerId, new Date(report.range.startAt).getTime(), new Date(report.range.endExclusiveAt).getTime()];
    const standard = this.database.$client.prepare("SELECT 'standard' AS source,id,completed_at AS completedAt FROM quiz_attempts WHERE learner_id=? AND completed_at>=? AND completed_at<?").all(...args) as Array<{source:string;id:string;completedAt:number}>;
    const legacy = this.database.$client.prepare("SELECT 'legacy' AS source,id,completed_at AS completedAt FROM topic_quiz_attempts WHERE learner_id=? AND completed_at>=? AND completed_at<?").all(...args) as Array<{source:string;id:string;completedAt:number}>;
    return [...standard, ...legacy].sort((a,b) => a.completedAt-b.completedAt || a.id.localeCompare(b.id));
  }

  private currentCandidates(learnerId: string, category: string): Candidate[] {
    const rows = this.database.$client.prepare(`SELECT q.id AS revisionId,c.stable_key AS stableKey,q.category,
      MAX(history.answeredAt) AS lastAnsweredAt
      FROM question_catalog_publications p JOIN questions q ON q.id=p.current_question_id JOIN question_catalogs c ON c.id=p.catalog_id
      LEFT JOIN (
        SELECT qh.question_catalog_id AS catalogId, MAX(a.answered_at) AS answeredAt
          FROM quiz_answers a JOIN quiz_attempts qa ON qa.id=a.quiz_attempt_id JOIN questions qh ON qh.id=a.question_id
         WHERE qa.learner_id=? GROUP BY qh.question_catalog_id
        UNION ALL
        SELECT cl.id AS catalogId, MAX(la.answered_at) AS answeredAt
          FROM topic_quiz_answers la JOIN topic_quiz_attempts lqa ON lqa.id=la.topic_quiz_attempt_id JOIN question_catalogs cl ON cl.stable_key=la.question_key
         WHERE lqa.learner_id=? GROUP BY cl.id
      ) history ON history.catalogId=q.question_catalog_id
      WHERE q.category=? AND q.status='published' GROUP BY q.id,c.stable_key,q.category`).all(learnerId, learnerId, category) as Candidate[];
    return rows;
  }
}

function compareCandidate(a: Candidate, b: Candidate) { return (a.lastAnsweredAt === null ? -1 : b.lastAnsweredAt === null ? 1 : a.lastAnsweredAt - b.lastAnsweredAt) || a.stableKey.localeCompare(b.stableKey); }
function sha(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function beijingDate(ms: number) { return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10); }

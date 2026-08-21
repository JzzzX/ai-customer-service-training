import { createHash, randomUUID } from "node:crypto";

import type { DatabaseClient } from "../client";
import { DbLearningQuizReportStore } from "./db-learning-quiz-report-store";
import { DbRemediationExamQueryStore } from "./db-remediation-exam-query-store";
import type { BeijingDateRangeInput, LearningQuizReport } from "@/lib/report/learning-quiz-report";
import type { GenerateRemediationExamResult } from "@/lib/remediation/schema";

type Candidate = { revisionId: string; stableKey: string; category: string; lastAnsweredAt: number | null };

export class DbRemediationExamStore extends DbRemediationExamQueryStore {
  constructor(database: DatabaseClient) {
    super(database);
  }

  generate(learnerId: string, rangeInput: BeijingDateRangeInput, now = new Date()): GenerateRemediationExamResult {
    return this.database.transaction(() => {
      const report = new DbLearningQuizReportStore(this.database).getReport(learnerId, rangeInput, now);
      const targets = report.categories.filter((item) => item.wrongCount > 0).slice(0, 2);
      if (targets.length === 0) return { status: "no_weakness" } as const;
      const attemptRows = this.completedAttemptRows(learnerId, report);
      const fingerprint = sha({
        learnerId,
        range: {
          startAt: report.range.startAt,
          endExclusiveAt: report.range.endExclusiveAt,
        },
        attempts: attemptRows,
        categories: report.categories,
        questions: report.questionWeaknesses,
      });
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

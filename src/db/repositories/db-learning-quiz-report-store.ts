import type { DatabaseClient } from "../client";
import {
  resolveBeijingDateRange,
  toBeijingDate,
  type BeijingDateRangeInput,
  type CategoryWeakness,
  type LearningQuizReport,
  type QuestionWeaknessEvidence,
  type WrongAnswerEvidence,
} from "@/lib/report/learning-quiz-report";

type Attempt = {
  id: string;
  status: "passed" | "needs_retry";
  completedAt: number;
};

type Revision = {
  id: string;
  questionKey: string;
  prompt: string;
  correctAnswers: string;
  explanation: string;
  category: string;
  createdAt: number;
  revision: number;
};

type Answer = {
  attemptId: string;
  stableKey: string;
  selectedAnswers: string[];
  isCorrect: boolean;
  answeredAt: number;
  category: string;
  source: "standard" | "legacy";
  revision: Revision | null;
};

export class DbLearningQuizReportStore {
  constructor(private readonly database: DatabaseClient) {}

  async getReport(
    learnerId: string,
    rangeInput: BeijingDateRangeInput,
    now = new Date(),
  ): Promise<LearningQuizReport> {
    const range = resolveBeijingDateRange(rangeInput, now);
    const start = new Date(range.startAt).getTime();
    const end = new Date(range.endExclusiveAt).getTime();
    const learner = this.database.$client.prepare(
      "SELECT id, name, email FROM users WHERE id = ? AND role = 'learner' AND is_active = 1",
    ).get(learnerId) as { id: string; name: string; email: string } | undefined;
    if (!learner) throw new Error("学员不存在或已停用。");

    const standardAttempts = this.database.$client.prepare(`
      SELECT qa.id, qa.status, qa.completed_at AS completedAt
      FROM quiz_attempts qa
      INNER JOIN quiz_sets qs ON qs.id = qa.quiz_set_id
      WHERE qa.learner_id = ?
        AND qa.status IN ('passed', 'needs_retry')
        AND qa.completed_at >= ? AND qa.completed_at < ?
        AND qs.kind IN ('formal', 'topic', 'remediation')
    `).all(learnerId, start, end) as Attempt[];
    const legacyAttempts = this.database.$client.prepare(`
      SELECT id, status, completed_at AS completedAt
      FROM topic_quiz_attempts
      WHERE learner_id = ?
        AND status IN ('passed', 'needs_retry')
        AND completed_at >= ? AND completed_at < ?
    `).all(learnerId, start, end) as Attempt[];
    const attempts = [...standardAttempts, ...legacyAttempts];

    const standardAnswers = this.loadStandardAnswers(standardAttempts.map((item) => item.id));
    const legacyAnswers = this.loadLegacyAnswers(legacyAttempts.map((item) => item.id));
    const answers = [...standardAnswers, ...legacyAnswers];

    return {
      learner,
      range,
      summary: summarize(attempts, answers),
      trend: buildTrend(attempts, answers),
      categories: buildCategories(answers),
      questionWeaknesses: buildQuestionWeaknesses(answers),
    };
  }

  listLearners(search = "") {
    const pattern = `%${search.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    return this.database.$client.prepare(`
      SELECT id, name, email FROM users
      WHERE role = 'learner' AND is_active = 1
        AND (? = '%%' OR name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')
      ORDER BY name, email
      LIMIT 100
    `).all(pattern, pattern, pattern) as Array<{ id: string; name: string; email: string }>;
  }

  private loadStandardAnswers(attemptIds: string[]): Answer[] {
    if (attemptIds.length === 0) return [];
    const placeholders = attemptIds.map(() => "?").join(",");
    const rows = this.database.$client.prepare(`
      SELECT a.quiz_attempt_id AS attemptId, c.stable_key AS stableKey,
        a.selected_answers AS selectedAnswers, a.is_correct AS isCorrect,
        a.answered_at AS answeredAt, q.id, q.question_key AS questionKey,
        q.prompt, q.correct_answers AS correctAnswers, q.explanation, q.category,
        q.created_at AS createdAt, q.revision
      FROM quiz_answers a
      INNER JOIN questions q ON q.id = a.question_id
      INNER JOIN question_catalogs c ON c.id = q.question_catalog_id
      WHERE a.quiz_attempt_id IN (${placeholders})
    `).all(...attemptIds) as Array<Record<string, unknown>>;
    return rows.map((row) => {
      const revision = mapRevision(row);
      return {
        attemptId: String(row.attemptId),
        stableKey: String(row.stableKey),
        selectedAnswers: parseAnswers(row.selectedAnswers),
        isCorrect: Boolean(row.isCorrect),
        answeredAt: Number(row.answeredAt),
        category: revision.category,
        source: "standard",
        revision,
      };
    });
  }

  private loadLegacyAnswers(attemptIds: string[]): Answer[] {
    if (attemptIds.length === 0) return [];
    const placeholders = attemptIds.map(() => "?").join(",");
    const rows = this.database.$client.prepare(`
      SELECT a.topic_quiz_attempt_id AS attemptId, a.question_key AS stableKey,
        a.selected_answers AS selectedAnswers, a.is_correct AS isCorrect,
        a.answered_at AS answeredAt, t.topic_id AS topicId
      FROM topic_quiz_answers a
      INNER JOIN topic_quiz_attempts t ON t.id = a.topic_quiz_attempt_id
      WHERE a.topic_quiz_attempt_id IN (${placeholders})
    `).all(...attemptIds) as Array<Record<string, unknown>>;
    const revisionQuery = this.database.$client.prepare(`
      SELECT id, question_key AS questionKey, prompt, correct_answers AS correctAnswers,
        explanation, category, created_at AS createdAt, revision
      FROM questions
      WHERE question_key = ?
      ORDER BY CASE WHEN created_at <= ? THEN 0 ELSE 1 END,
        CASE WHEN created_at <= ? THEN created_at END DESC,
        revision ASC
      LIMIT 1
    `);
    return rows.map((row) => {
      const revisionRow = revisionQuery.get(row.stableKey, row.answeredAt, row.answeredAt) as Record<string, unknown> | undefined;
      const revision = revisionRow ? mapRevision(revisionRow) : null;
      return {
        attemptId: String(row.attemptId),
        stableKey: String(row.stableKey),
        selectedAnswers: parseAnswers(row.selectedAnswers),
        isCorrect: Boolean(row.isCorrect),
        answeredAt: Number(row.answeredAt),
        category: revision?.category ?? String(row.topicId),
        source: "legacy",
        revision,
      };
    });
  }
}

function summarize(attempts: Attempt[], answers: Answer[]) {
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const passedAttempts = attempts.filter((attempt) => attempt.status === "passed").length;
  return {
    completedAttempts: attempts.length,
    answeredCount: answers.length,
    correctCount,
    accuracy: percent(correctCount, answers.length),
    passedAttempts,
    passRate: percent(passedAttempts, attempts.length),
  };
}

function buildTrend(attempts: Attempt[], answers: Answer[]) {
  const dates = new Map<string, { completedAttempts: number; answeredCount: number; correctCount: number }>();
  for (const attempt of attempts) {
    const date = toBeijingDate(new Date(attempt.completedAt));
    const item = dates.get(date) ?? { completedAttempts: 0, answeredCount: 0, correctCount: 0 };
    item.completedAttempts += 1;
    dates.set(date, item);
  }
  for (const answer of answers) {
    const date = toBeijingDate(new Date(answer.answeredAt));
    const item = dates.get(date) ?? { completedAttempts: 0, answeredCount: 0, correctCount: 0 };
    item.answeredCount += 1;
    if (answer.isCorrect) item.correctCount += 1;
    dates.set(date, item);
  }
  return [...dates.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, item]) => ({
    date,
    ...item,
    accuracy: percent(item.correctCount, item.answeredCount),
  }));
}

function buildCategories(answers: Answer[]): CategoryWeakness[] {
  const categories = new Map<string, { answeredCount: number; wrongCount: number; latestWrongAt: string | null }>();
  for (const answer of answers) {
    const item = categories.get(answer.category) ?? { answeredCount: 0, wrongCount: 0, latestWrongAt: null };
    item.answeredCount += 1;
    if (!answer.isCorrect) {
      item.wrongCount += 1;
      const answeredAt = new Date(answer.answeredAt).toISOString();
      if (!item.latestWrongAt || answeredAt > item.latestWrongAt) item.latestWrongAt = answeredAt;
    }
    categories.set(answer.category, item);
  }
  return [...categories.entries()].map(([category, item]) => ({
    category,
    ...item,
    errorRate: percent(item.wrongCount, item.answeredCount),
  })).sort((left, right) => compareWeakness(left, right) || left.category.localeCompare(right.category));
}

function buildQuestionWeaknesses(answers: Answer[]): QuestionWeaknessEvidence[] {
  const groups = new Map<string, Answer[]>();
  for (const answer of answers) groups.set(answer.stableKey, [...(groups.get(answer.stableKey) ?? []), answer]);
  return [...groups.entries()].flatMap(([stableKey, group]) => {
    const wrong = group.filter((answer) => !answer.isCorrect);
    if (wrong.length === 0) return [];
    const orderedWrong = wrong.toSorted((left, right) =>
      right.answeredAt - left.answeredAt || left.attemptId.localeCompare(right.attemptId),
    );
    const latestWrongAt = new Date(orderedWrong[0]!.answeredAt).toISOString();
    const evidence: WrongAnswerEvidence[] = orderedWrong.map((answer) => ({
      attemptId: answer.attemptId,
      source: answer.source,
      revisionId: answer.revision?.id ?? null,
      prompt: answer.revision?.prompt ?? null,
      selectedAnswers: answer.selectedAnswers,
      correctAnswers: answer.revision ? parseAnswers(answer.revision.correctAnswers) : null,
      explanation: answer.revision?.explanation ?? null,
      answeredAt: new Date(answer.answeredAt).toISOString(),
      isCorrect: false,
    }));
    return [{
      stableKey,
      category: orderedWrong[0]!.category,
      classification: wrong.length >= 2 ? "high_frequency" as const : "period_mistake" as const,
      answeredCount: group.length,
      wrongCount: wrong.length,
      errorRate: percent(wrong.length, group.length),
      latestWrongAt,
      evidence,
    }];
  }).sort((left, right) => compareWeakness(left, right) || left.stableKey.localeCompare(right.stableKey));
}

function compareWeakness(
  left: { wrongCount: number; errorRate: number; latestWrongAt: string | null },
  right: { wrongCount: number; errorRate: number; latestWrongAt: string | null },
) {
  return right.wrongCount - left.wrongCount
    || right.errorRate - left.errorRate
    || (right.latestWrongAt ?? "").localeCompare(left.latestWrongAt ?? "");
}

function mapRevision(row: Record<string, unknown>): Revision {
  return {
    id: String(row.id),
    questionKey: String(row.questionKey),
    prompt: String(row.prompt),
    correctAnswers: String(row.correctAnswers),
    explanation: String(row.explanation),
    category: String(row.category),
    createdAt: Number(row.createdAt),
    revision: Number(row.revision),
  };
}

function parseAnswers(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function percent(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

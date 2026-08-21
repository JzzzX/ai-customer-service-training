export type BeijingDateRangePreset = "today" | "last7" | "custom";

export type BeijingDateRangeInput =
  | { preset: "today" }
  | { preset: "last7" }
  | { preset: "custom"; startDate: string; endDate: string };

export interface BeijingDateRange {
  preset: BeijingDateRangePreset;
  startDate: string;
  endDate: string;
  startAt: string;
  endExclusiveAt: string;
}

export interface CategoryWeakness {
  category: string;
  answeredCount: number;
  wrongCount: number;
  errorRate: number;
  latestWrongAt: string | null;
}

export interface WrongAnswerEvidence {
  attemptId: string;
  source: "standard" | "legacy";
  revisionId: string | null;
  prompt: string | null;
  selectedAnswers: string[];
  correctAnswers: string[] | null;
  explanation: string | null;
  answeredAt: string;
  isCorrect: false;
}

export interface QuestionWeaknessEvidence {
  stableKey: string;
  category: string;
  classification: "high_frequency" | "period_mistake";
  answeredCount: number;
  wrongCount: number;
  errorRate: number;
  latestWrongAt: string;
  evidence: WrongAnswerEvidence[];
}

export interface LearningQuizReport {
  learner: { id: string; name: string; email: string };
  range: BeijingDateRange;
  summary: {
    completedAttempts: number;
    answeredCount: number;
    correctCount: number;
    accuracy: number;
    passedAttempts: number;
    passRate: number;
  };
  trend: Array<{
    date: string;
    completedAttempts: number;
    answeredCount: number;
    correctCount: number;
    accuracy: number;
  }>;
  categories: CategoryWeakness[];
  questionWeaknesses: QuestionWeaknessEvidence[];
  remediationExams: import("@/lib/remediation/schema").RemediationExam[];
}

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function resolveBeijingDateRange(
  input: BeijingDateRangeInput,
  now = new Date(),
): BeijingDateRange {
  const today = new Date(now.getTime() + BEIJING_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  let startDate: string;
  let endDate: string;
  if (input.preset === "today") {
    startDate = endDate = today;
  } else if (input.preset === "last7") {
    endDate = today;
    startDate = addCalendarDays(today, -6);
  } else {
    startDate = validateDate(input.startDate);
    endDate = validateDate(input.endDate);
    if (startDate > endDate) throw new Error("日期范围的开始日期不能晚于结束日期。");
  }
  const startAt = beijingMidnight(startDate);
  const endExclusiveAt = beijingMidnight(addCalendarDays(endDate, 1));
  return {
    preset: input.preset,
    startDate,
    endDate,
    startAt: startAt.toISOString(),
    endExclusiveAt: endExclusiveAt.toISOString(),
  };
}

export function toBeijingDate(instant: Date | string): string {
  const value = instant instanceof Date ? instant : new Date(instant);
  return new Date(value.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function validateDate(value: string): string {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error("日期必须使用 YYYY-MM-DD 格式。");
  const [, year, month, day] = match;
  const candidate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (candidate.toISOString().slice(0, 10) !== value) throw new Error("日期不是有效的日历日期。");
  return value;
}

function beijingMidnight(date: string): Date {
  const valid = validateDate(date);
  const [year, month, day] = valid.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!) - BEIJING_OFFSET_MS);
}

function addCalendarDays(date: string, days: number): string {
  const valid = validateDate(date);
  const [year, month, day] = valid.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

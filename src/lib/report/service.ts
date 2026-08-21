import { getDatabase } from "@/db/client";
import { DbLearningQuizReportStore } from "@/db/repositories/db-learning-quiz-report-store";
import type { BeijingDateRangeInput } from "./learning-quiz-report";
import { resolveBeijingDateRange } from "./learning-quiz-report";

export function getLearningQuizReport(learnerId: string, range: BeijingDateRangeInput) {
  return new DbLearningQuizReportStore(getDatabase()).getReport(learnerId, range);
}

export function listReportLearners(search = "") {
  return new DbLearningQuizReportStore(getDatabase()).listLearners(search);
}

export function parseReportRange(params: {
  preset?: string;
  start?: string;
  end?: string;
}): BeijingDateRangeInput {
  if (params.preset === "last7") return { preset: "last7" };
  if (params.preset === "custom" && params.start && params.end) {
    const range = { preset: "custom" as const, startDate: params.start, endDate: params.end };
    resolveBeijingDateRange(range);
    return range;
  }
  if (params.preset === "custom") throw new Error("自定义日期范围需要开始和结束日期。");
  return { preset: "today" };
}

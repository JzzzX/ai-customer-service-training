import { getDatabase } from "@/db/client";
import { DbRemediationExamStore } from "@/db/repositories/db-remediation-exam-store";
import type { BeijingDateRangeInput } from "@/lib/report/learning-quiz-report";

export function generateRemediationExam(learnerId: string, range: BeijingDateRangeInput) {
  return new DbRemediationExamStore(getDatabase()).generate(learnerId, range);
}
export function loadRemediationExam(learnerId: string, examId: string) {
  return new DbRemediationExamStore(getDatabase()).loadForLearner(learnerId, examId);
}

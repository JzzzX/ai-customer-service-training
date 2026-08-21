import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireLearner: vi.fn(), loadExam: vi.fn(), loadSnapshot: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireLearner: mocks.requireLearner }));
vi.mock("@/lib/remediation/service", () => ({ loadRemediationExam: mocks.loadExam }));
vi.mock("@/lib/quiz/attempt-service", () => ({ loadQuizAttemptSnapshotForLearner: mocks.loadSnapshot }));
vi.mock("@/components/quiz/quiz-runner", () => ({ QuizRunner: ({ questions }: {questions: unknown[]}) => <div>改善题目 {questions.length}</div> }));

import RemediationExamPage from "./page";

beforeEach(() => vi.clearAllMocks());

it("renders only the signed-in learner's immutable remediation snapshot", async () => {
  mocks.requireLearner.mockResolvedValue({ id: "learner-1" });
  mocks.loadExam.mockReturnValue({ id: "exam-1", attemptId: "attempt-1", status: "in_progress", targets: [{ category: "日常问答" }] });
  mocks.loadSnapshot.mockResolvedValue({ attemptId: "attempt-1", quizHash: "a".repeat(64), passingScore: 80, questions: Array.from({length:10}, (_,i) => ({ id:`qq_${String(i).padStart(24,"0")}`, type:"true_false", prompt:"题", options:["对","错"], correctAnswers:["对"], explanation:"解", category:"日常问答", difficulty:"easy", status:"published", sources:[] })) });
  render(await RemediationExamPage({ params: Promise.resolve({ examId: "exam-1" }) }));
  expect(mocks.loadExam).toHaveBeenCalledWith("learner-1", "exam-1");
  expect(screen.getByText("改善题目 10")).toBeInTheDocument();
});

it("shows the persisted double-eighty result after completion instead of reopening answers", async () => {
  mocks.requireLearner.mockResolvedValue({ id: "learner-1" });
  mocks.loadExam.mockReturnValue({ id: "exam-1", attemptId: "attempt-1", status: "completed", targets: [{ category: "日常问答" }], result: { totalScore: 80, improved: false, categories: [{ category: "日常问答", accuracy: 70 }] } });
  render(await RemediationExamPage({ params: Promise.resolve({ examId: "exam-1" }) }));
  expect(screen.getByText("仍需巩固")).toBeInTheDocument();
  expect(screen.getByText(/日常问答 70%/)).toBeInTheDocument();
  expect(mocks.loadSnapshot).not.toHaveBeenCalled();
});

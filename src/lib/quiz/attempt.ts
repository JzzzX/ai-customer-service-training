export type QuizAttemptOutcome = {
  score: number;
  status: "passed" | "needs_retry";
};

export function evaluateAnswer(
  selectedAnswers: string[],
  correctAnswers: string[],
): boolean {
  if (
    selectedAnswers.length === 0 ||
    selectedAnswers.length !== correctAnswers.length
  ) {
    return false;
  }

  return [...selectedAnswers].toSorted().every(
    (answer, index) => answer === [...correctAnswers].toSorted()[index],
  );
}

export function finishQuizAttempt(input: {
  correctCount: number;
  totalQuestions: number;
  passingScore?: number;
}): QuizAttemptOutcome {
  const passingScore = input.passingScore ?? 80;
  if (!Number.isInteger(input.totalQuestions) || input.totalQuestions <= 0) {
    throw new Error("小测题目数量必须大于 0。");
  }
  if (
    !Number.isInteger(input.correctCount) ||
    input.correctCount < 0 ||
    input.correctCount > input.totalQuestions
  ) {
    throw new Error("答对题数超出有效范围。");
  }

  const score = Math.round(
    (input.correctCount / input.totalQuestions) * 100,
  );
  return {
    score,
    status: score >= passingScore ? "passed" : "needs_retry",
  };
}

export function selectRetryQuestionIds(input: {
  missedQuestionIds: string[];
  relatedQuestionIds: string[];
  limit: number;
}): string[] {
  if (!Number.isInteger(input.limit) || input.limit <= 0) {
    return [];
  }

  return [...new Set([
    ...input.missedQuestionIds,
    ...input.relatedQuestionIds,
  ])].slice(0, input.limit);
}

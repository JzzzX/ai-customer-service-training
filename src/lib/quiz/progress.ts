import type { QuizAttemptRecord } from "./attempt-store";

export type QuizProgressCatalogTopic = {
  id: string;
  totalQuestions: number;
};

export type QuizAttemptProgress = QuizAttemptRecord & {
  newCoverageCount: number;
};

export type QuizTopicProgress = {
  topicId: string;
  totalQuestions: number;
  uniqueAnsweredCount: number;
  totalCorrectAnswers: number;
  totalAnsweredAnswers: number;
  accuracy: number;
  attemptCount: number;
};

export type QuizProgressSummary = {
  totalQuestions: number;
  uniqueAnsweredCount: number;
  totalCorrectAnswers: number;
  totalAnsweredAnswers: number;
  accuracy: number;
  attemptCount: number;
  topics: QuizTopicProgress[];
  recentAttempts: QuizAttemptProgress[];
};

export function summarizeQuizProgress(
  attempts: QuizAttemptRecord[],
  catalog: QuizProgressCatalogTopic[],
  recentLimit = 20,
): QuizProgressSummary {
  const topicIds = new Set(catalog.map((topic) => topic.id));
  const topicAttempts = attempts.filter(
    (attempt) => attempt.topicId && topicIds.has(attempt.topicId),
  );
  const chronological = [...topicAttempts].sort(compareAttemptsAscending);
  const seenByTopic = new Map<string, Set<string>>();
  const newCoverageByAttempt = new Map<string, number>();

  for (const attempt of chronological) {
    const topicId = attempt.topicId!;
    const seen = seenByTopic.get(topicId) ?? new Set<string>();
    const questionIds = knownQuestionIds(attempt);
    let newCoverageCount = 0;
    for (const questionId of questionIds) {
      if (!seen.has(questionId)) {
        seen.add(questionId);
        newCoverageCount += 1;
      }
    }
    seenByTopic.set(topicId, seen);
    newCoverageByAttempt.set(attempt.id, newCoverageCount);
  }

  const topics = catalog.map((topic) => {
    const attemptsForTopic = topicAttempts.filter(
      (attempt) => attempt.topicId === topic.id,
    );
    const uniqueAnswered = new Set<string>();
    let totalCorrectAnswers = 0;
    let totalAnsweredAnswers = 0;
    for (const attempt of attemptsForTopic) {
      for (const questionId of knownQuestionIds(attempt)) {
        uniqueAnswered.add(questionId);
      }
      totalCorrectAnswers += attempt.correctCount;
      totalAnsweredAnswers += attempt.totalQuestions;
    }
    return {
      topicId: topic.id,
      totalQuestions: topic.totalQuestions,
      uniqueAnsweredCount: uniqueAnswered.size,
      totalCorrectAnswers,
      totalAnsweredAnswers,
      accuracy: percentage(totalCorrectAnswers, totalAnsweredAnswers),
      attemptCount: attemptsForTopic.length,
    };
  });

  const allKnownQuestionIds = new Set<string>();
  for (const topic of seenByTopic.values()) {
    for (const questionId of topic) {
      allKnownQuestionIds.add(questionId);
    }
  }
  const totalCorrectAnswers = attempts.reduce(
    (total, attempt) => total + attempt.correctCount,
    0,
  );
  const totalAnsweredAnswers = attempts.reduce(
    (total, attempt) => total + attempt.totalQuestions,
    0,
  );

  const recentAttempts = [...attempts]
    .sort(compareAttemptsDescending)
    .slice(0, recentLimit)
    .map((attempt) => ({
      ...attempt,
      newCoverageCount: newCoverageByAttempt.get(attempt.id) ?? 0,
    }));

  return {
    totalQuestions: catalog.reduce(
      (total, topic) => total + topic.totalQuestions,
      0,
    ),
    uniqueAnsweredCount: allKnownQuestionIds.size,
    totalCorrectAnswers,
    totalAnsweredAnswers,
    accuracy: percentage(totalCorrectAnswers, totalAnsweredAnswers),
    attemptCount: attempts.length,
    topics,
    recentAttempts,
  };
}

function knownQuestionIds(attempt: QuizAttemptRecord): string[] {
  return attempt.answeredQuestionIds ?? attempt.missedQuestionIds;
}

function percentage(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function compareAttemptsAscending(
  left: QuizAttemptRecord,
  right: QuizAttemptRecord,
): number {
  return (
    left.completedAt.localeCompare(right.completedAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareAttemptsDescending(
  left: QuizAttemptRecord,
  right: QuizAttemptRecord,
): number {
  return -compareAttemptsAscending(left, right);
}

import { describe, expect, it } from "vitest";

import {
  evaluateAnswer,
  finishQuizAttempt,
  selectRetryQuestionIds,
} from "./attempt";

describe("quiz attempt rules", () => {
  it("uses exact option matching for objective questions", () => {
    expect(evaluateAnswer(["A"], ["A"])).toBe(true);
    expect(evaluateAnswer(["B"], ["A"])).toBe(false);
    expect(evaluateAnswer([], ["A"])).toBe(false);
  });

  it("passes at 80 percent and asks for retry below the threshold", () => {
    expect(finishQuizAttempt({ correctCount: 8, totalQuestions: 10 })).toEqual({
      score: 80,
      status: "passed",
    });
    expect(finishQuizAttempt({ correctCount: 7, totalQuestions: 10 })).toEqual({
      score: 70,
      status: "needs_retry",
    });
  });

  it("builds a stable retry set with missed questions first", () => {
    expect(
      selectRetryQuestionIds({
        missedQuestionIds: ["q3", "q1", "q3"],
        relatedQuestionIds: ["q4", "q2", "q1"],
        limit: 4,
      }),
    ).toEqual(["q3", "q1", "q4", "q2"]);
  });
});

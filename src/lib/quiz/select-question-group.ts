import type { QuizQuestionPublished } from "./schema";

const DEFAULT_GROUP_SIZE = 10;

export function selectQuestionGroup(
  questions: QuizQuestionPublished[],
  groupSize = DEFAULT_GROUP_SIZE,
): QuizQuestionPublished[] {
  if (groupSize <= 0) {
    return [];
  }

  const singleChoice = questions.filter(
    (question) => question.type === "single_choice",
  );
  const trueFalse = questions.filter(
    (question) => question.type === "true_false",
  );
  const selected: QuizQuestionPublished[] = [];

  while (
    selected.length < groupSize &&
    (singleChoice.length > 0 || trueFalse.length > 0)
  ) {
    const choice = singleChoice.shift();
    if (choice) {
      selected.push(choice);
    }

    if (selected.length >= groupSize) {
      break;
    }

    const judgment = trueFalse.shift();
    if (judgment) {
      selected.push(judgment);
    }
  }

  return selected;
}

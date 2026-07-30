import type { QuizQuestion, QuizQuestionPublished } from "./schema";

const DEFAULT_GROUP_SIZE = 10;

const TOPIC_DIFFICULTY_QUOTAS: Record<QuizQuestion["difficulty"], number> = {
  easy: 4,
  medium: 4,
  hard: 2,
};

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

export function selectQuestionGroupByTopic(
  questions: QuizQuestion[],
  topic: string,
  groupSize = DEFAULT_GROUP_SIZE,
): QuizQuestion[] {
  if (groupSize <= 0) {
    return [];
  }

  const topicQuestions = questions.filter(
    (question) => question.category === topic,
  );
  if (topicQuestions.length === 0) {
    return [];
  }

  const buckets: Record<QuizQuestion["difficulty"], QuizQuestion[]> = {
    easy: [],
    medium: [],
    hard: [],
  };
  for (const question of topicQuestions) {
    buckets[question.difficulty].push(question);
  }

  const picked: QuizQuestion[] = [];
  const leftovers: QuizQuestion[] = [];

  (Object.keys(TOPIC_DIFFICULTY_QUOTAS) as QuizQuestion["difficulty"][]).forEach(
    (difficulty) => {
      const quota = TOPIC_DIFFICULTY_QUOTAS[difficulty];
      const pool = shuffle(buckets[difficulty]);
      const take = Math.min(quota, pool.length);
      picked.push(...pool.slice(0, take));
      leftovers.push(...pool.slice(take));
    },
  );

  if (picked.length < groupSize) {
    const shuffledLeftovers = shuffle(leftovers);
    const need = Math.min(groupSize - picked.length, shuffledLeftovers.length);
    picked.push(...shuffledLeftovers.slice(0, need));
  }

  return shuffle(picked).slice(0, groupSize);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

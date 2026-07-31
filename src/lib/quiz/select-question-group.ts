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

const BALANCED_TYPE_QUOTAS: Record<
  QuizQuestion["type"],
  Record<QuizQuestion["difficulty"], number>
> = {
  single_choice: { easy: 2, medium: 2, hard: 1 },
  true_false: { easy: 2, medium: 2, hard: 1 },
};

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

  const singleChoiceCount = topicQuestions.filter(
    (question) => question.type === "single_choice",
  ).length;
  const trueFalseCount = topicQuestions.filter(
    (question) => question.type === "true_false",
  ).length;

  if (singleChoiceCount >= 5 && trueFalseCount >= 5) {
    return pickBalancedByType(topicQuestions, groupSize);
  }

  return pickByDifficulty(topicQuestions, groupSize);
}

function pickBalancedByType(
  topicQuestions: QuizQuestion[],
  groupSize: number,
): QuizQuestion[] {
  const picked: QuizQuestion[] = [];
  const leftovers: QuizQuestion[] = [];

  (Object.keys(BALANCED_TYPE_QUOTAS) as QuizQuestion["type"][]).forEach(
    (type) => {
      const typePool = topicQuestions.filter(
        (question) => question.type === type,
      );
      const quotas = BALANCED_TYPE_QUOTAS[type];
      (Object.keys(quotas) as QuizQuestion["difficulty"][]).forEach(
        (difficulty) => {
          const quota = quotas[difficulty];
          const pool = shuffle(
            typePool.filter((question) => question.difficulty === difficulty),
          );
          const take = Math.min(quota, pool.length);
          picked.push(...pool.slice(0, take));
          leftovers.push(...pool.slice(take));
        },
      );
    },
  );

  if (picked.length < groupSize) {
    const shuffledLeftovers = shuffle(leftovers);
    const need = Math.min(groupSize - picked.length, shuffledLeftovers.length);
    picked.push(...shuffledLeftovers.slice(0, need));
  }

  return shuffle(picked).slice(0, groupSize);
}

function pickByDifficulty(
  topicQuestions: QuizQuestion[],
  groupSize: number,
): QuizQuestion[] {
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

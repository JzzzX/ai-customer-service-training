import { randomUUID } from "node:crypto";

import { PageHeader } from "@/components/ui/page-header";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { requireLearner } from "@/lib/auth/guards";
import { startQuizAttemptForLearner } from "@/lib/quiz/attempt-service";
import { demoQuizQuestions } from "@/lib/quiz/demo-questions";
import { quizTopics } from "@/lib/quiz/question-bank";
import {
  loadPublishedQuiz,
  loadPublishedTopicQuiz,
} from "@/lib/quiz/published-service";
import {
  shuffleClientQuestionOptions,
  toClientQuizQuestion,
  type QuizQuestionPublished,
} from "@/lib/quiz/schema";
import {
  selectQuestionGroup,
  selectQuestionGroupByTopic,
} from "@/lib/quiz/select-question-group";

import {
  checkDemoQuizAnswerAction,
  checkPublishedQuizAnswerAction,
  checkTopicQuizAnswerAction,
  saveQuizAttemptAction,
  saveTopicQuizAttemptAction,
} from "./actions";

export default async function PracticeQuizPage({
  searchParams,
}: {
  searchParams?: Promise<{ topic?: string; retry?: string }>;
} = {}) {
  const user = await requireLearner();
  const params = await searchParams;
  const topicInput = params?.topic;
  const topicMatch = topicInput
    ? quizTopics.find((topic) => topic.id === topicInput)
    : undefined;
  const attemptId = randomUUID();

  if (topicMatch) {
    const topicQuiz = await loadPublishedTopicQuiz(topicMatch.id);
    if (topicQuiz) {
      const questions = selectRetryQuestions(topicQuiz.questions, params?.retry)
        ?? selectQuestionGroupByTopic(topicQuiz.questions, topicMatch.id);
      const snapshot = await startQuizAttemptForLearner({
        attemptId,
        learnerId: user.id,
        quizHash: topicQuiz.quizHash,
        topicId: topicMatch.id,
        questionIds: questions.map((question) => question.id),
      });
      const saveAttempt = saveTopicQuizAttemptAction.bind(
        null,
        topicMatch.id,
        snapshot.quizHash,
      );
      const checkAnswer = checkTopicQuizAnswerAction.bind(null, attemptId);

      return (
        <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-3xl">
            <PageHeader
              backHref="/practice/quiz/topics"
              badge="专题练习"
              description={`从该专题 ${topicQuiz.questions.length} 道题中随机抽取 ${questions.length} 题，完成后可重练错题。即时反馈用于学习，不作为防作弊考试或认证成绩。`}
              label="知识小测"
              title={`${topicMatch.icon} ${topicMatch.label}`}
            />

            <div className="mt-8 animate-fade-in-up stagger-1">
              <QuizRunner
                attemptId={attemptId}
                onAnswer={checkAnswer}
                onComplete={saveAttempt}
                passingScore={snapshot.passingScore}
                questions={snapshot.questions.map((question) =>
                  shuffleClientQuestionOptions(
                    toClientQuizQuestion(question),
                  ),
                )}
                resultBackHref="/practice/quiz/topics"
                restartHref={`/practice/quiz?topic=${encodeURIComponent(topicMatch.id)}`}
              />
            </div>
          </div>
        </main>
      );
    }
  }

  const publishedQuiz = await loadPublishedQuiz();
  const questions = publishedQuiz
    ? selectRetryQuestions(publishedQuiz.questions, params?.retry)
      ?? selectQuestionGroup(publishedQuiz.questions)
    : demoQuizQuestions;
  const passingScore = publishedQuiz?.passingScore ?? 80;
  const snapshot = publishedQuiz
    ? await startQuizAttemptForLearner({
        attemptId,
        learnerId: user.id,
        quizHash: publishedQuiz.quizHash,
        questionIds: questions.map((question) => question.id),
      })
    : null;
  const saveAttempt = publishedQuiz
    ? saveQuizAttemptAction.bind(null, publishedQuiz.quizHash)
    : undefined;
  const checkAnswer = publishedQuiz
    ? checkPublishedQuizAnswerAction.bind(null, attemptId)
    : checkDemoQuizAnswerAction;

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          backHref="/practice"
          badge={publishedQuiz ? "正式题组" : "交互演示题"}
          description={
            publishedQuiz
              ? `本组从已审核的${publishedQuiz.questions.length}道题中选取${questions.length}道，完成后可重练错题。即时反馈用于学习，不作为防作弊考试或认证成绩。`
              : "正式题组仍在管理员审核；这里先验证完整答题体验，不作为培训成绩。"
          }
          label="知识小测"
          title="知识小测"
        />

        <div className="mt-8 animate-fade-in-up stagger-1">
          <QuizRunner
            attemptId={attemptId}
            onAnswer={checkAnswer}
            onComplete={saveAttempt}
            passingScore={snapshot?.passingScore ?? passingScore}
            questions={(snapshot?.questions ?? questions).map((question) =>
              shuffleClientQuestionOptions(toClientQuizQuestion(question)),
            )}
            resultBackHref="/practice"
            restartHref={publishedQuiz ? "/practice/quiz" : undefined}
          />
        </div>
      </div>
    </main>
  );
}

function selectRetryQuestions(
  questions: QuizQuestionPublished[],
  retryInput: string | undefined,
): QuizQuestionPublished[] | null {
  const ids = retryInput?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  if (ids.length === 0 || ids.length > 10 || new Set(ids).size !== ids.length) return null;
  const byId = new Map(questions.map((question) => [question.id, question]));
  const selected = ids.map((id) => byId.get(id));
  return selected.every((question): question is QuizQuestionPublished => Boolean(question))
    ? selected
    : null;
}

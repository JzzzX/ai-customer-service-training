import { randomUUID } from "node:crypto";

import { PageHeader } from "@/components/ui/page-header";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { requireUser } from "@/lib/auth/guards";
import { demoQuizQuestions } from "@/lib/quiz/demo-questions";
import { quizTopics, topicQuizQuestions } from "@/lib/quiz/question-bank";
import { loadPublishedQuiz } from "@/lib/quiz/review-service";
import {
  shuffleClientQuestionOptions,
  toClientQuizQuestion,
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
  searchParams?: Promise<{ assignment?: string; topic?: string }>;
} = {}) {
  await requireUser();
  const params = await searchParams;
  const assignmentInput = params?.assignment;
  const assignmentId =
    assignmentInput &&
    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(assignmentInput)
      ? assignmentInput
      : undefined;
  const topicInput = params?.topic;
  const topicMatch = topicInput
    ? quizTopics.find((topic) => topic.id === topicInput)
    : undefined;
  const attemptId = randomUUID();

  if (topicMatch) {
    const topicTotal = topicQuizQuestions.filter(
      (question) => question.category === topicMatch.id,
    ).length;
    const questions = selectQuestionGroupByTopic(
      topicQuizQuestions,
      topicMatch.id,
    );
    const saveAttempt = saveTopicQuizAttemptAction.bind(null, topicMatch.id);
    const checkAnswer = checkTopicQuizAnswerAction.bind(null, topicMatch.id);

    return (
      <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <PageHeader
            backHref="/practice/quiz/topics"
            badge="专题练习"
            description={`从该专题 ${topicTotal} 道题中随机抽取 ${questions.length} 题，完成后可重练错题。即时反馈用于学习，不作为防作弊考试或认证成绩。`}
            label="知识小测"
            title={`${topicMatch.icon} ${topicMatch.label}`}
          />

          <div className="mt-8 animate-fade-in-up stagger-1">
            <QuizRunner
              attemptId={attemptId}
              onAnswer={checkAnswer}
              onComplete={saveAttempt}
              passingScore={80}
              questions={questions.map((question) =>
                shuffleClientQuestionOptions(
                  toClientQuizQuestion(question),
                ),
              )}
              resultBackHref="/practice/quiz/topics"
            />
          </div>
        </div>
      </main>
    );
  }

  const publishedQuiz = await loadPublishedQuiz();
  const questions = publishedQuiz
    ? selectQuestionGroup(publishedQuiz.questions)
    : demoQuizQuestions;
  const passingScore = publishedQuiz?.passingScore ?? 80;
  const saveAttempt = publishedQuiz
    ? saveQuizAttemptAction.bind(null, publishedQuiz.quizHash, assignmentId)
    : undefined;
  const checkAnswer = publishedQuiz
    ? checkPublishedQuizAnswerAction.bind(null, publishedQuiz.quizHash)
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
            passingScore={passingScore}
            questions={questions.map((question) =>
              shuffleClientQuestionOptions(toClientQuizQuestion(question)),
            )}
            resultBackHref="/practice"
          />
        </div>
      </div>
    </main>
  );
}

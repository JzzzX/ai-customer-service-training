"use client";

import { useMemo, useState } from "react";

import { ProgressBar } from "@/components/ui/progress-bar";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButton } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { WaveLoader } from "@/components/ui/wave-loader";
import type { QuizAnswerFeedback } from "@/app/practice/quiz/actions";
import { finishQuizAttempt } from "@/lib/quiz/attempt";
import type { QuizQuestionClient } from "@/lib/quiz/schema";

function shuffleSingleChoiceOptions(
  question: QuizQuestionClient,
): QuizQuestionClient {
  if (question.type !== "single_choice") {
    return question;
  }
  const options = [...question.options];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [options[index], options[swapIndex]] = [options[swapIndex]!, options[index]!];
  }
  return { ...question, options };
}

function prepareQuestions(
  questions: QuizQuestionClient[],
): QuizQuestionClient[] {
  return questions.map(shuffleSingleChoiceOptions);
}

interface QuizRunnerProps {
  attemptId: string;
  questions: QuizQuestionClient[];
  passingScore?: number;
  onAnswer: (
    questionId: string,
    selected: string,
  ) => Promise<QuizAnswerFeedback>;
  onComplete?: (
    attemptId: string,
    answers: Array<{ questionId: string; selected: string }>,
  ) => Promise<void>;
}

type AnswerRecord = {
  questionId: string;
  selected: string;
  isCorrect: boolean;
  explanation: string;
  sourceLabel: string;
};

export function QuizRunner({
  attemptId,
  questions,
  passingScore = 80,
  onAnswer,
  onComplete,
}: QuizRunnerProps) {
  const [activeQuestions, setActiveQuestions] = useState(questions);
  const [activeAttemptId, setActiveAttemptId] = useState(attemptId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<AnswerRecord | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);
  const [answerWarning, setAnswerWarning] = useState("");
  const current = activeQuestions[currentIndex];
  const outcome = useMemo(
    () =>
      showResult
        ? finishQuizAttempt({
            correctCount: answers.filter((answer) => answer.isCorrect).length,
            totalQuestions: activeQuestions.length,
            passingScore,
          })
        : null,
    [activeQuestions.length, answers, passingScore, showResult],
  );

  if (!current || questions.length === 0) {
    return (
      <SoftCard className="text-center">
        <h2 className="text-xl font-black text-ink">暂时没有可练习的题目</h2>
      </SoftCard>
    );
  }

  if (showResult && outcome) {
    const missedIds = new Set(
      answers
        .filter((answer) => !answer.isCorrect)
        .map((answer) => answer.questionId),
    );
    const missed = activeQuestions.filter((question) =>
      missedIds.has(question.id),
    );

    return (
      <SoftCard className="text-center" gradient>
        <div
          aria-hidden="true"
          className={`mx-auto flex size-16 items-center justify-center rounded-full text-3xl font-black text-white ${
            outcome.status === "passed" ? "bg-success" : "bg-warning"
          }`}
        >
          {outcome.status === "passed" ? "✓" : "↻"}
        </div>
        <p className="mt-5 text-sm font-bold text-success">
          本组完成 · 通过线 {passingScore}%
        </p>
        <h2 className="mt-2 text-3xl font-black text-ink">
          {outcome.status === "passed"
            ? "这组顺利通过"
            : "这组需要再练一次"}
        </h2>
        <p className="mt-4 text-5xl font-black text-success">
          {outcome.score}%
        </p>
        <p className="mt-3 text-ink-soft">
          答对 {answers.filter((answer) => answer.isCorrect).length} /{" "}
          {activeQuestions.length} 题
        </p>
        {saveWarning ? (
          <p className="mt-4 text-sm font-bold text-danger">
            本次结果已显示，但练习记录暂未保存，请稍后再试。
          </p>
        ) : null}
        {missed.length > 0 ? (
          <SoftButton
            className="mt-7"
            onClick={() => restart(missed)}
            variant="primary"
          >
            重练错题
          </SoftButton>
        ) : (
          <SoftButton
            className="mt-7"
            onClick={() => restart(questions)}
            variant="primary"
          >
            再练一组
          </SoftButton>
        )}
      </SoftCard>
    );
  }

  const progress = ((currentIndex + 1) / activeQuestions.length) * 100;

  async function submitAnswer() {
    if (!current || !selected || feedback) {
      return;
    }
    setChecking(true);
    setAnswerWarning("");
    try {
      const result = await onAnswer(current.id, selected);
      const answer = {
        questionId: current.id,
        selected,
        ...result,
      };
      setFeedback(answer);
      setAnswers((previous) => [...previous, answer]);
    } catch {
      setAnswerWarning("答案校验失败，请稍后重试。");
    } finally {
      setChecking(false);
    }
  }

  async function continueQuiz() {
    if (currentIndex === activeQuestions.length - 1) {
      if (onComplete) {
        setSaving(true);
        setSaveWarning(false);
        try {
          await onComplete(
            activeAttemptId,
            answers.map(({ questionId, selected: answerSelected }) => ({
              questionId,
              selected: answerSelected,
            })),
          );
        } catch {
          setSaveWarning(true);
        } finally {
          setSaving(false);
        }
      }
      setShowResult(true);
      return;
    }
    setCurrentIndex((index) => index + 1);
    setSelected("");
    setFeedback(null);
    setAnswerWarning("");
  }

  function restart(nextQuestions: QuizQuestionClient[]) {
    if (onComplete) {
      setActiveAttemptId(globalThis.crypto.randomUUID());
    }
    setActiveQuestions(prepareQuestions(nextQuestions));
    setCurrentIndex(0);
    setSelected("");
    setFeedback(null);
    setAnswers([]);
    setShowResult(false);
    setSaveWarning(false);
    setAnswerWarning("");
  }

  return (
    <SoftCard hover={false}>
      <div className="border-b border-surface-muted pb-5">
        <div className="flex items-center justify-between gap-4 text-sm font-bold">
          <SoftBadge variant="brand">
            第 {currentIndex + 1} / {activeQuestions.length} 题
          </SoftBadge>
          <span className="text-ink-faint">{current.category}</span>
        </div>
        <ProgressBar className="mt-4" value={progress} />
      </div>

      <div className="pt-6">
        <p className="text-xs font-bold tracking-wide text-ink-faint">
          {current.type === "single_choice" ? "单选题" : "判断题"}
        </p>
        <h2 className="mt-3 text-xl font-black leading-8 text-ink sm:text-2xl">
          {current.prompt}
        </h2>

        <fieldset className="mt-7 grid gap-3" disabled={Boolean(feedback)}>
          <legend className="sr-only">请选择答案</legend>
          {current.options.map((option, index) => {
            const isSelected = selected === option;
            return (
              <label
                className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-[var(--radius-control)] border-2 px-4 py-3 font-bold transition-all ${
                  isSelected
                    ? "border-brand bg-brand-soft text-brand-ink"
                    : "border-transparent bg-surface-muted text-ink hover:bg-surface-muted/80"
                }`}
                key={option}
              >
                <input
                  aria-label={option}
                  checked={isSelected}
                  className="sr-only"
                  name={`question-${current.id}`}
                  onChange={() => setSelected(option)}
                  type="radio"
                  value={option}
                />
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface text-sm font-black text-ink-soft">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option}</span>
              </label>
            );
          })}
        </fieldset>

        {feedback ? (
          <div
            className={`mt-6 rounded-[var(--radius-control)] border-2 p-5 ${
              feedback.isCorrect
                ? "border-success/30 bg-success-soft"
                : "border-danger/30 bg-danger-soft"
            }`}
          >
            <p
              className={`font-black ${
                feedback.isCorrect ? "text-success" : "text-danger"
              }`}
            >
              {feedback.isCorrect ? "回答正确" : "回答错误"}
            </p>
            <p className="mt-2 leading-7 text-ink-soft">
              {feedback.explanation}
            </p>
            <p className="mt-3 text-xs text-ink-faint">
              知识来源：{feedback.sourceLabel}
            </p>
          </div>
        ) : null}
        {answerWarning ? (
          <p className="mt-4 text-sm font-bold text-danger" role="alert">
            {answerWarning}
          </p>
        ) : null}

        <div className="mt-7 flex justify-end">
          {feedback ? (
            <SoftButton
              disabled={saving}
              onClick={continueQuiz}
              variant="primary"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <WaveLoader barClassName="bg-white" />
                  正在保存…
                </span>
              ) : currentIndex === activeQuestions.length - 1 ? (
                "查看结果"
              ) : (
                "下一题"
              )}
            </SoftButton>
          ) : (
            <SoftButton
              disabled={!selected || checking}
              onClick={submitAnswer}
              variant="primary"
            >
              {checking ? "正在校验…" : "提交答案"}
            </SoftButton>
          )}
        </div>
      </div>
    </SoftCard>
  );
}

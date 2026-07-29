"use client";

import { useMemo, useState } from "react";

import { evaluateAnswer, finishQuizAttempt } from "@/lib/quiz/attempt";
import type { QuizQuestion } from "@/lib/quiz/schema";

interface QuizRunnerProps {
  questions: QuizQuestion[];
  passingScore?: number;
  onComplete?: (
    answers: Array<{ questionId: string; selected: string }>,
  ) => Promise<void>;
}

type AnswerRecord = {
  questionId: string;
  selected: string;
  isCorrect: boolean;
};

export function QuizRunner({
  questions,
  passingScore = 80,
  onComplete,
}: QuizRunnerProps) {
  const [activeQuestions, setActiveQuestions] = useState(questions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<AnswerRecord | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);
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
      <section className="rounded-[28px] border-2 border-[#dce8df] bg-white p-7 text-center">
        <h2 className="text-xl font-black">暂时没有可练习的题目</h2>
      </section>
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
      <section className="rounded-[28px] border-2 border-[#dce8df] bg-white p-7 text-center shadow-[0_7px_0_#dce8df] sm:p-10">
        <div
          aria-hidden="true"
          className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#eaf7ed] text-3xl"
        >
          {outcome.status === "passed" ? "✓" : "↻"}
        </div>
        <p className="mt-5 text-sm font-bold text-[#399a57]">
          本组完成 · 通过线 {passingScore}%
        </p>
        <h2 className="mt-2 text-3xl font-black text-[#21312a]">
          {outcome.status === "passed"
            ? "这组顺利通过"
            : "这组需要再练一次"}
        </h2>
        <p className="mt-4 text-5xl font-black text-[#399a57]">
          {outcome.score}%
        </p>
        <p className="mt-3 text-[#68786f]">
          答对 {answers.filter((answer) => answer.isCorrect).length} /{" "}
          {activeQuestions.length} 题
        </p>
        {saveWarning ? (
          <p className="mt-4 text-sm font-bold text-[#b56127]">
            本次结果已显示，但练习记录暂未保存，请稍后再试。
          </p>
        ) : null}
        {missed.length > 0 ? (
          <button
            className="mt-7 min-h-12 rounded-2xl bg-[#65b87a] px-6 font-black text-white shadow-[0_4px_0_#3f9258] transition active:translate-y-1 active:shadow-none"
            onClick={() => restart(missed)}
            type="button"
          >
            重练错题
          </button>
        ) : (
          <button
            className="mt-7 min-h-12 rounded-2xl bg-[#65b87a] px-6 font-black text-white shadow-[0_4px_0_#3f9258] transition active:translate-y-1 active:shadow-none"
            onClick={() => restart(questions)}
            type="button"
          >
            再练一组
          </button>
        )}
      </section>
    );
  }

  const progress = ((currentIndex + 1) / activeQuestions.length) * 100;

  function submitAnswer() {
    if (!current || !selected || feedback) {
      return;
    }
    const answer = {
      questionId: current.id,
      selected,
      isCorrect: evaluateAnswer([selected], current.correctAnswers),
    };
    setFeedback(answer);
    setAnswers((previous) => [...previous, answer]);
  }

  async function continueQuiz() {
    if (currentIndex === activeQuestions.length - 1) {
      if (onComplete) {
        setSaving(true);
        setSaveWarning(false);
        try {
          await onComplete(
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
  }

  function restart(nextQuestions: QuizQuestion[]) {
    setActiveQuestions(nextQuestions);
    setCurrentIndex(0);
    setSelected("");
    setFeedback(null);
    setAnswers([]);
    setShowResult(false);
    setSaveWarning(false);
  }

  return (
    <section className="overflow-hidden rounded-[28px] border-2 border-[#dce8df] bg-white shadow-[0_7px_0_#dce8df]">
      <div className="border-b-2 border-[#edf3ee] px-6 py-5 sm:px-8">
        <div className="flex items-center justify-between gap-4 text-sm font-bold">
          <span className="text-[#399a57]">
            第 {currentIndex + 1} / {activeQuestions.length} 题
          </span>
          <span className="text-[#7a8981]">{current.category}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8efe9]">
          <div
            aria-label={`完成进度 ${Math.round(progress)}%`}
            className="h-full rounded-full bg-[#6ec581] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <p className="text-xs font-bold tracking-wide text-[#7a8981]">
          {current.type === "single_choice" ? "单选题" : "判断题"}
        </p>
        <h2 className="mt-3 text-xl font-black leading-8 text-[#21312a] sm:text-2xl">
          {current.prompt}
        </h2>

        <fieldset className="mt-7 grid gap-3" disabled={Boolean(feedback)}>
          <legend className="sr-only">请选择答案</legend>
          {current.options.map((option, index) => {
            const isSelected = selected === option;
            return (
              <label
                className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3 font-bold transition ${
                  isSelected
                    ? "border-[#65b87a] bg-[#eff9f1] text-[#2f7043]"
                    : "border-[#dde8df] bg-white text-[#405149] hover:bg-[#f7faf7]"
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
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#eef3ef] text-sm">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option}</span>
              </label>
            );
          })}
        </fieldset>

        {feedback ? (
          <div
            className={`mt-6 rounded-2xl border-2 p-5 ${
              feedback.isCorrect
                ? "border-[#bfe2c7] bg-[#eff9f1]"
                : "border-[#f0cfb6] bg-[#fff7ef]"
            }`}
          >
            <p
              className={`font-black ${
                feedback.isCorrect ? "text-[#2f7b46]" : "text-[#b56127]"
              }`}
            >
              {feedback.isCorrect ? "回答正确" : "回答错误"}
            </p>
            <p className="mt-2 leading-7 text-[#405149]">
              {current.explanation}
            </p>
            <p className="mt-3 text-xs text-[#748179]">
              知识来源：{formatSource(current)}
            </p>
          </div>
        ) : null}

        <div className="mt-7 flex justify-end">
          {feedback ? (
            <button
              className="min-h-12 rounded-2xl bg-[#65b87a] px-6 font-black text-white shadow-[0_4px_0_#3f9258] transition active:translate-y-1 active:shadow-none"
              disabled={saving}
              onClick={continueQuiz}
              type="button"
            >
              {saving
                ? "正在保存…"
                : currentIndex === activeQuestions.length - 1
                  ? "查看结果"
                  : "下一题"}
            </button>
          ) : (
            <button
              className="min-h-12 rounded-2xl bg-[#65b87a] px-6 font-black text-white shadow-[0_4px_0_#3f9258] transition enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:bg-[#b9c6bc] disabled:shadow-[0_4px_0_#98a69b]"
              disabled={!selected}
              onClick={submitAnswer}
              type="button"
            >
              提交答案
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function formatSource(question: QuizQuestion): string {
  const source = question.sources[0];
  if (!source) {
    return "未标注";
  }
  if (source.sheet && source.row) {
    return `${source.sourcePath} · ${source.sheet} 第 ${source.row} 行`;
  }
  if (source.line) {
    return `${source.sourcePath} · 第 ${source.line} 行`;
  }
  return `${source.sourcePath} · ${source.anchor}`;
}

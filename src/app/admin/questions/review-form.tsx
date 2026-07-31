"use client";

import { useActionState } from "react";

import { SoftButton } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import type { QuizReview } from "@/lib/quiz/review";

import {
  approveQuestionAction,
  type ReviewActionState,
} from "./actions";

type ReviewItem = QuizReview["questions"][number];

const inputClassName =
  "min-h-12 w-full rounded-[var(--radius-control)] border-2 border-surface-muted bg-surface px-4 text-ink outline-none transition-colors focus:border-scenario";

const textareaClassName =
  "min-h-24 w-full rounded-[var(--radius-control)] border-2 border-surface-muted bg-surface px-4 py-3 leading-7 text-ink outline-none transition-colors focus:border-scenario";

export function ReviewForm({
  index,
  item,
  total,
}: {
  index: number;
  item: ReviewItem;
  total: number;
}) {
  const [state, action, pending] = useActionState<
    ReviewActionState,
    FormData
  >(approveQuestionAction, {});
  const question = item.question;

  return (
    <form action={action} className="mt-7 space-y-5">
      <input name="questionId" type="hidden" value={question.id} />
      <input name="index" type="hidden" value={index} />
      <input name="total" type="hidden" value={total} />

      <Field label="题干">
        <textarea
          className={textareaClassName}
          defaultValue={question.prompt}
          id="prompt"
          name="prompt"
          required
        />
      </Field>

      <Field label="选项（每行一个）">
        <textarea
          className={textareaClassName}
          defaultValue={question.options.join("\n")}
          id="options"
          name="options"
          required
        />
      </Field>

      <Field label="正确答案">
        <input
          className={inputClassName}
          defaultValue={question.correctAnswers[0]}
          id="correctAnswer"
          name="correctAnswer"
          required
        />
      </Field>

      <Field label="答案解释">
        <textarea
          className={textareaClassName}
          defaultValue={question.explanation}
          id="explanation"
          name="explanation"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="知识分类">
          <input
            className={inputClassName}
            defaultValue={question.category}
            id="category"
            name="category"
            required
          />
        </Field>
        <Field label="难度">
          <select
            className={inputClassName}
            defaultValue={question.difficulty}
            id="difficulty"
            name="difficulty"
          >
            <option value="easy">简单</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </select>
        </Field>
      </div>

      {state.error ? (
        <SoftCard className="border-danger/20 bg-danger-soft">
          <p className="text-sm font-bold text-danger" role="alert">
            {state.error}
          </p>
        </SoftCard>
      ) : null}

      <SoftButton
        className="w-full"
        disabled={pending}
        type="submit"
        variant="scenario"
      >
        {pending ? "正在保存…" : "审核通过并下一题"}
      </SoftButton>
    </form>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const id =
    label === "题干"
      ? "prompt"
      : label.startsWith("选项")
        ? "options"
        : label === "正确答案"
          ? "correctAnswer"
          : label === "答案解释"
            ? "explanation"
            : label === "知识分类"
              ? "category"
              : "difficulty";

  return (
    <div>
      <label
        className="mb-2 block text-sm font-bold text-ink-soft"
        htmlFor={id}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

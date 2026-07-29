"use client";

import { useActionState } from "react";

import type { QuizReview } from "@/lib/quiz/review";

import {
  approveQuestionAction,
  type ReviewActionState,
} from "./actions";

type ReviewItem = QuizReview["questions"][number];

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
          className="min-h-24 w-full rounded-2xl border-2 border-[#dfe6e1] bg-white px-4 py-3 leading-7 outline-none focus:border-[#6c8bea]"
          defaultValue={question.prompt}
          id="prompt"
          name="prompt"
          required
        />
      </Field>

      <Field label="选项（每行一个）">
        <textarea
          className="min-h-32 w-full rounded-2xl border-2 border-[#dfe6e1] bg-white px-4 py-3 leading-7 outline-none focus:border-[#6c8bea]"
          defaultValue={question.options.join("\n")}
          id="options"
          name="options"
          required
        />
      </Field>

      <Field label="正确答案">
        <input
          className="min-h-12 w-full rounded-2xl border-2 border-[#dfe6e1] bg-white px-4 outline-none focus:border-[#6c8bea]"
          defaultValue={question.correctAnswers[0]}
          id="correctAnswer"
          name="correctAnswer"
          required
        />
      </Field>

      <Field label="答案解释">
        <textarea
          className="min-h-28 w-full rounded-2xl border-2 border-[#dfe6e1] bg-white px-4 py-3 leading-7 outline-none focus:border-[#6c8bea]"
          defaultValue={question.explanation}
          id="explanation"
          name="explanation"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="知识分类">
          <input
            className="min-h-12 w-full rounded-2xl border-2 border-[#dfe6e1] bg-white px-4 outline-none focus:border-[#6c8bea]"
            defaultValue={question.category}
            id="category"
            name="category"
            required
          />
        </Field>
        <Field label="难度">
          <select
            className="min-h-12 w-full rounded-2xl border-2 border-[#dfe6e1] bg-white px-4 outline-none focus:border-[#6c8bea]"
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
        <p
          className="rounded-2xl bg-[#fff3f1] px-4 py-3 text-sm font-bold text-[#b94a3b]"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button
        className="min-h-12 w-full rounded-2xl bg-[#6c8bea] px-6 font-black text-white shadow-[0_4px_0_#526fc6] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-wait disabled:opacity-70"
        disabled={pending}
        type="submit"
      >
        {pending ? "正在保存…" : "审核通过并下一题"}
      </button>
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
        className="mb-2 block text-sm font-bold text-[#405149]"
        htmlFor={id}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

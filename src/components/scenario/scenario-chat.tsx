"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendScenarioMessageAction } from "@/app/practice/scenario/actions";
import type { LiveRiskAlert, ScenarioSession } from "@/lib/scenario/schema";

export function ScenarioChat({
  initialSession,
  scenarioTitle,
}: {
  initialSession: ScenarioSession;
  scenarioTitle: string;
}) {
  const [session, setSession] = useState(initialSession);
  const [content, setContent] = useState("");
  const [optimisticLearner, setOptimisticLearner] = useState("");
  const [streamingReply, setStreamingReply] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const reachedLimit = session.learnerTurnCount >= session.maxTurns;

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const learnerMessage = content.trim();
    if (!learnerMessage || pending || reachedLimit) {
      return;
    }

    setPending(true);
    setError("");
    setContent("");
    setOptimisticLearner(learnerMessage);
    const formData = new FormData();
    formData.set("sessionId", session.id);
    formData.set("content", learnerMessage);
    const state = await sendScenarioMessageAction({}, formData);

    if (!state.result) {
      setError(state.error ?? "消息发送失败，请稍后重试。");
      setOptimisticLearner("");
      setPending(false);
      return;
    }

    let revealed = "";
    for (const chunk of state.result.customerChunks) {
      revealed += chunk;
      setStreamingReply(revealed);
      await wait(20);
    }
    setSession(state.result.session);
    setOptimisticLearner("");
    setStreamingReply("");
    setPending(false);
  }

  return (
    <section className="overflow-hidden rounded-[28px] border-2 border-[#dde4ef] bg-white shadow-[0_7px_0_#dde4ef]">
      <div className="border-b-2 border-[#edf0f6] px-5 py-4 sm:px-7">
        <div className="flex items-center justify-between gap-4 text-sm font-bold">
          <span className="text-[#5c7cdb]">
            第 {session.learnerTurnCount} / {session.maxTurns} 轮
          </span>
          <span className="text-[#7a8981]">{scenarioTitle}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e9edf5]">
          <div
            aria-label={`训练进度 ${Math.round(
              (session.learnerTurnCount / session.maxTurns) * 100,
            )}%`}
            className="h-full rounded-full bg-[#7f99ec] transition-all"
            style={{
              width: `${Math.max(
                4,
                (session.learnerTurnCount / session.maxTurns) * 100,
              )}%`,
            }}
          />
        </div>
      </div>

      <div className="max-h-[52vh] min-h-80 space-y-4 overflow-y-auto bg-[#f8f9fc] p-5 sm:p-7">
        {session.messages.map((message) => (
          <div className="space-y-2" key={message.id}>
            <MessageBubble
              content={message.content}
              role={message.role}
            />
            {message.riskAlert ? (
              <RiskAlertCard alert={message.riskAlert} />
            ) : null}
          </div>
        ))}
        {optimisticLearner ? (
          <MessageBubble content={optimisticLearner} role="learner" />
        ) : null}
        {streamingReply ? (
          <MessageBubble content={streamingReply} role="customer" />
        ) : null}
        {pending && !streamingReply ? (
          <p className="text-sm font-bold text-[#7a8981]">
            模拟顾客正在回复…
          </p>
        ) : null}
      </div>

      <div className="border-t-2 border-[#edf0f6] p-5 sm:p-7">
        {error ? (
          <p
            className="mb-4 rounded-2xl bg-[#fff1e5] px-4 py-3 text-sm font-bold text-[#b56127]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {reachedLimit ? (
          <p className="rounded-2xl bg-[#eef3ff] px-4 py-3 text-sm font-bold text-[#526fc6]">
            已达到最大轮次，请结束训练查看报告。
          </p>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={submitMessage}>
            <label className="sr-only" htmlFor="scenario-message">
              回复顾客
            </label>
            <textarea
              className="min-h-24 resize-none rounded-2xl border-2 border-[#dde4ef] px-4 py-3 leading-7 outline-none focus:border-[#7f99ec]"
              disabled={pending}
              id="scenario-message"
              maxLength={1000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="像真实接待一样回复顾客…"
              value={content}
            />
            <button
              className="min-h-12 rounded-2xl bg-[#6c8bea] px-6 font-black text-white shadow-[0_4px_0_#526fc6] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!content.trim() || pending}
              type="submit"
            >
              {pending ? "回复中…" : "发送"}
            </button>
          </form>
        )}

        <button
          className="mt-4 min-h-11 w-full rounded-2xl border-2 border-[#d7deea] px-5 font-bold text-[#5f6f67] disabled:opacity-50"
          disabled={pending}
          onClick={() =>
            router.push(
              `/practice/scenario/report/${session.id}?streaming=1`,
            )
          }
          type="button"
        >
          结束并查看报告
        </button>
      </div>
    </section>
  );
}

function MessageBubble({
  content,
  role,
}: {
  content: string;
  role: "customer" | "learner";
}) {
  const learner = role === "learner";
  return (
    <div className={`flex ${learner ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] rounded-2xl px-4 py-3 leading-7 ${
          learner
            ? "bg-[#6c8bea] text-white"
            : "border border-[#dde4ef] bg-white text-[#405149]"
        }`}
      >
        <p className="mb-1 text-xs font-bold opacity-70">
          {learner ? "你" : "顾客"}
        </p>
        <p>{content}</p>
      </div>
    </div>
  );
}

function RiskAlertCard({ alert }: { alert: LiveRiskAlert }) {
  const isDanger = alert.severity === "danger";
  return (
    <div className="flex justify-end" role="status">
      <div
        className={`max-w-[86%] rounded-2xl border-2 px-4 py-3 text-sm leading-6 ${
          isDanger
            ? "border-[#f0b3b3] bg-[#fff0f0] text-[#a04040]"
            : "border-[#f3d68a] bg-[#fff7e0] text-[#8a6420]"
        }`}
      >
        <p className="mb-1 text-xs font-black opacity-80">
          {isDanger ? "严重风险提示" : "风险提示"} · {alert.riskLabel}
        </p>
        <p>{alert.suggestion}</p>
      </div>
    </div>
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

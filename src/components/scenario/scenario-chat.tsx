"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ProgressBar } from "@/components/ui/progress-bar";
import {
  ScenarioReportProgress,
  type ReportGenerationPhase,
} from "@/components/scenario/scenario-report-progress";
import { SoftButton } from "@/components/ui/soft-button";
import { WaveLoader } from "@/components/ui/wave-loader";
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
  const [reportPhase, setReportPhase] = useState<
    ReportGenerationPhase | undefined
  >();
  const [reportError, setReportError] = useState("");
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reportStartedRef = useRef(false);
  const reportAbortRef = useRef<AbortController | null>(null);
  const reachedLimit = session.learnerTurnCount >= session.maxTurns;
  const reportBusy =
    reportPhase !== undefined &&
    reportPhase !== "ready" &&
    reportPhase !== "error";

  const replaceFinishingFlag = useCallback((enabled: boolean) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (enabled) {
      url.searchParams.set("finishing", "1");
    } else {
      url.searchParams.delete("finishing");
    }
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  const generateReport = useCallback(async () => {
    if (reportStartedRef.current) return;
    reportStartedRef.current = true;
    reportAbortRef.current?.abort();
    const controller = new AbortController();
    reportAbortRef.current = controller;
    setReportPhase("analyzing");
    setReportError("");

    try {
      const response = await fetch(
        `/api/scenario/complete/${session.id}`,
        { signal: controller.signal },
      );
      if (!response.ok || !response.body) {
        throw new Error(
          response.status === 401
            ? "未登录，请重新登录后重试。"
            : "连接评测服务失败，请稍后重试。",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reportReceived = false;
      const consumeEvent = (event: string) => {
        const data = event.replace(/^data: /, "").trim();
        if (!data || data === "[DONE]") return;
        let chunk: {
          phase?: ReportGenerationPhase;
          report?: unknown;
          error?: string;
        };
        try {
          chunk = JSON.parse(data) as typeof chunk;
        } catch {
          return;
        }
        if (chunk.error) throw new Error(chunk.error);
        if (
          chunk.phase === "analyzing" ||
          chunk.phase === "scoring" ||
          chunk.phase === "saving"
        ) {
          setReportPhase(chunk.phase);
        }
        if (chunk.report) {
          reportReceived = true;
          setReportPhase("ready");
          replaceFinishingFlag(false);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        events.forEach(consumeEvent);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeEvent(buffer);
      if (!reportReceived) {
        throw new Error("报告生成失败，请稍后重试。");
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      setReportPhase("error");
      setReportError(
        caught instanceof Error
          ? caught.message
          : "报告生成失败，请稍后重试。",
      );
      replaceFinishingFlag(false);
    } finally {
      if (reportAbortRef.current === controller) {
        reportAbortRef.current = null;
      }
    }
  }, [replaceFinishingFlag, session.id]);

  useEffect(() => {
    const finishing =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("finishing") === "1";
    if (
      initialSession.learnerTurnCount >= initialSession.maxTurns ||
      finishing
    ) {
      const timer = window.setTimeout(() => void generateReport(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [generateReport, initialSession.learnerTurnCount, initialSession.maxTurns]);

  useEffect(() => {
    return () => reportAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    const target = messagesEndRef.current;
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }, [session.messages, optimisticLearner, streamingReply]);

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
    if (state.result.session.learnerTurnCount >= state.result.session.maxTurns) {
      void generateReport();
    }
  }

  function finishTraining() {
    if (pending || reportPhase !== undefined || reachedLimit) return;
    replaceFinishingFlag(true);
    void generateReport();
  }

  function retryReport() {
    reportStartedRef.current = false;
    replaceFinishingFlag(true);
    void generateReport();
  }

  function viewReport() {
    router.push(`/practice/scenario/report/${session.id}`);
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-soft)]">
      <div className="border-b border-surface-muted px-5 py-4 sm:px-7">
        <div className="flex items-center justify-between gap-4 text-sm font-bold">
          <span className="text-scenario-strong">
            第 {session.learnerTurnCount} / {session.maxTurns} 轮
          </span>
          <span className="text-ink-faint">{scenarioTitle}</span>
        </div>
        <ProgressBar
          className="mt-3"
          color="scenario"
          label={`训练进度 ${Math.round(
            (session.learnerTurnCount / session.maxTurns) * 100,
          )}%`}
          value={session.learnerTurnCount}
          max={session.maxTurns}
        />
      </div>

      <div className="max-h-[52vh] min-h-80 space-y-4 overflow-y-auto bg-canvas p-5 sm:p-7">
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
          <div className="flex items-center gap-2 text-sm font-bold text-ink-faint">
            <WaveLoader barClassName="bg-scenario" />
            <span>模拟顾客正在回复…</span>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-surface-muted p-5 sm:p-7">
        {error ? (
          <p
            className="mb-4 rounded-[var(--radius-control)] bg-danger-soft px-4 py-3 text-sm font-bold text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {reachedLimit ? (
          <p className="rounded-[var(--radius-control)] bg-scenario-soft px-4 py-3 text-sm font-bold text-scenario-strong">
            已达到最大轮次，正在准备训练报告。
          </p>
        ) : reportPhase === undefined ? (
          <form className="flex flex-col gap-3" onSubmit={submitMessage}>
            <label className="sr-only" htmlFor="scenario-message">
              回复顾客
            </label>
            <textarea
              className="min-h-24 resize-none rounded-[var(--radius-control)] border-2 border-transparent bg-surface-muted px-4 py-3 leading-7 text-ink outline-none transition-all placeholder:text-ink-faint focus:border-scenario/30 focus:bg-surface focus:ring-0"
              disabled={pending || reportBusy}
              id="scenario-message"
              maxLength={1000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="像真实接待一样回复顾客…"
              value={content}
            />
            <SoftButton
              disabled={!content.trim() || pending || reportBusy}
              type="submit"
              variant="scenario"
            >
              {pending ? "回复中…" : "发送"}
            </SoftButton>
          </form>
        ) : null}

        {reportPhase ? (
          <ScenarioReportProgress
            error={reportError}
            onRetry={retryReport}
            onView={viewReport}
            phase={reportPhase}
          />
        ) : (
          <SoftButton
            className="mt-4 w-full"
            disabled={pending || reachedLimit}
            onClick={finishTraining}
            variant="secondary"
          >
            结束并查看报告
          </SoftButton>
        )}
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
        className={[
          "max-w-[86%] rounded-[var(--radius-control)] px-4 py-3 leading-7",
          learner
            ? "bg-scenario text-white"
            : "border border-scenario-border bg-surface text-ink-soft",
          learner ? "animate-slide-in-right" : "animate-slide-in-left",
        ].join(" ")}
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
        className={[
          "max-w-[86%] rounded-[var(--radius-control)] border-2 px-4 py-3 text-sm leading-6 animate-slide-in-right",
          isDanger
            ? "border-danger/30 bg-danger-soft text-danger"
            : "border-warning/30 bg-warning-soft text-warning",
        ].join(" ")}
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

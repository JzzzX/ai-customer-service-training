import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { scenarioTemplates } from "@/lib/scenario/templates";
import type { ScenarioEvaluationReport } from "@/lib/scenario/schema";

const mocks = vi.hoisted(() => ({
  completeScenarioAction: vi.fn(),
  restartScenarioAction: vi.fn(),
  routerReplace: vi.fn(),
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
}));
mocks.router.replace = mocks.routerReplace;

vi.mock("@/app/practice/scenario/actions", () => ({
  completeScenarioAction: mocks.completeScenarioAction,
  restartScenarioAction: mocks.restartScenarioAction,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

import { StreamingReport } from "./streaming-report";

const sessionId = "00000000-0000-4000-8000-000000000010";
const scenario = scenarioTemplates[0];

describe("StreamingReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers an explicit retry after a stream error and completes on retry", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        createSseResponse({
          error: "AI 评测服务暂时不可用，请稍后重试。",
        }),
      )
      .mockResolvedValueOnce(
        createSseResponse({ report: createReport() }),
      );

    render(
      <StreamingReport sessionId={sessionId} scenario={scenario} />,
    );

    expect(
      await screen.findByRole("heading", { name: "报告生成遇到问题" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI 评测服务暂时不可用，请稍后重试。"),
    ).toBeInTheDocument();
    expect(mocks.completeScenarioAction).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "重新生成报告" }),
    );

    await waitFor(() =>
      expect(screen.getByText("演示评分")).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.routerReplace).toHaveBeenCalledWith(
      `/practice/scenario/report/${sessionId}`,
    );
    expect(mocks.completeScenarioAction).not.toHaveBeenCalled();
  });

  it("offers a retry when the report stream is silent for 45 seconds", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
          Promise.resolve(createStalledSseResponse(init?.signal)),
        ),
      );

      render(
        <StreamingReport sessionId={sessionId} scenario={scenario} />,
      );
      await act(async () => {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(45_000);
      });

      expect(
        screen.getByRole("heading", { name: "报告生成遇到问题" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("与评测服务的连接已中断，请重新生成报告。"),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

function createSseResponse(payload: unknown) {
  const encoded = new TextEncoder().encode(
    `data: ${JSON.stringify(payload)}\n\n`,
  );
  let sent = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            if (sent) {
              return { done: true, value: undefined };
            }
            sent = true;
            return { done: false, value: encoded };
          },
        };
      },
    },
  };
}

function createStalledSseResponse(signal?: AbortSignal | null) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      signal?.addEventListener("abort", () => {
        controller.error(new DOMException("Aborted", "AbortError"));
      });
    },
  }), {
    headers: { "Content-Type": "text/event-stream" },
  });
}

function createReport(): ScenarioEvaluationReport {
  return {
    mode: "mock",
    totalScore: 100,
    status: "passed",
    confidence: 0.92,
    dimensions: scenario.scoringDimensions.map((dimension) => ({
      name: dimension.name,
      score: dimension.weight,
      maxScore: dimension.weight,
      evidence: dimension.signals.slice(0, 2),
    })),
    strengths: scenario.scoringDimensions.map(
      (dimension) => dimension.name,
    ),
    missedSteps: [],
    risks: [],
    recommendations: scenario.referenceFlow.map((step) => ({
      issue: "参考流程",
      suggestedReply: step,
    })),
    referenceReply: scenario.referenceReply,
    lowConfidence: false,
  };
}

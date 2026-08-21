import { NextResponse } from "next/server";
import { z } from "zod";

import { checkLearnerAccess } from "@/lib/auth/guards";
import { getScenarioTrainingService } from "@/lib/runtime/services";
import {
  reportRuntimeError,
} from "@/lib/runtime/errors";
import {
  classifyAiGatewayError,
  toPublicAiGatewayError,
} from "@/lib/scenario/ai-errors";

const sessionIdSchema = z.string().uuid();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await checkLearnerAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.status === 401 ? "未登录，请先登录。" : "当前账号无权进行练习。" },
      { status: access.status },
    );
  }
  const learner = access.user;
  const { sessionId } = await params;
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "无效的会话 ID。" },
      { status: 400 },
    );
  }

  const service = getScenarioTrainingService();
  const encoder = new TextEncoder();
  let cancelStream = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abortController = new AbortController();
      const signal = AbortSignal.any([
        request.signal,
        abortController.signal,
      ]);
      let cancelled = false;
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const stopHeartbeat = () => {
        if (heartbeat !== undefined) {
          clearInterval(heartbeat);
          heartbeat = undefined;
        }
      };
      const abort = () => {
        if (!abortController.signal.aborted) {
          abortController.abort();
        }
      };
      const stop = () => {
        stopHeartbeat();
        abort();
      };
      const enqueue = (chunk: Uint8Array) => {
        if (cancelled || closed) return false;
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          closed = true;
          stopHeartbeat();
          abort();
          return false;
        }
      };
      const close = () => {
        stopHeartbeat();
        if (cancelled || closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The consumer may have closed the stream concurrently.
        }
      };
      const cancel = () => {
        cancelled = true;
        stop();
      };
      const onRequestAbort = () => {
        stop();
        close();
      };
      request.signal.addEventListener("abort", onRequestAbort, { once: true });
      if (request.signal.aborted) {
        onRequestAbort();
      }
      cancelStream = cancel;
      if (signal.aborted || closed) {
        request.signal.removeEventListener("abort", onRequestAbort);
        return;
      }
      const send = (data: unknown) =>
        enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      // 立即发送 SSE 注释行，确保生产模式下响应头不被缓冲
      enqueue(encoder.encode(": stream-open\n\n"));
      heartbeat = setInterval(() => {
        enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);
      try {
        for await (const chunk of service.completeStream({
          learnerId: learner.id,
          sessionId: parsed.data,
          signal,
        })) {
          if (!send(chunk)) return;
        }
        enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        reportRuntimeError(
          {
            errorCategory: classifyAiGatewayError(error).kind,
            operation: "complete_session",
            route: "/api/scenario/complete",
            userId: learner.id,
            resourceId: parsed.data,
          },
          error,
        );
        send({
          error: toPublicAiGatewayError(error),
        });
      } finally {
        request.signal.removeEventListener("abort", onRequestAbort);
        close();
      }
    },
    cancel() {
      cancelStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

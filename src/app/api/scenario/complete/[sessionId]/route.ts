import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "未登录，请先登录。" },
      { status: 401 },
    );
  }
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };
      // 立即发送 SSE 注释行，确保生产模式下响应头不被缓冲
      controller.enqueue(encoder.encode(": stream-open\n\n"));
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);
      try {
        for await (const chunk of service.completeStream({
          learnerId: session.user.id,
          sessionId: parsed.data,
          signal: request.signal,
        })) {
          send(chunk);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        if (request.signal.aborted) {
          return;
        }
        reportRuntimeError(
          {
            errorCategory: classifyAiGatewayError(error).kind,
            operation: "complete_session",
            route: "/api/scenario/complete",
            userId: session.user.id,
            resourceId: parsed.data,
          },
          error,
        );
        send({
          error: toPublicAiGatewayError(error),
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
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

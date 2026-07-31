import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getScenarioTrainingService } from "@/lib/runtime/services";

const sessionIdSchema = z.string().uuid();

export async function GET(
  _request: Request,
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
      try {
        for await (const chunk of service.completeStream({
          learnerId: session.user.id,
          sessionId: parsed.data,
        })) {
          send(chunk);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        send({
          error:
            error instanceof Error
              ? error.message
              : "报告生成失败，请稍后重试。",
        });
      } finally {
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

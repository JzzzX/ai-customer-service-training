import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import { scenarioTemplates } from "./templates";
import {
  OpenAIConversationProvider,
  OpenAIEvaluationProvider,
} from "./ai-providers";
import { classifyAiGatewayError } from "./ai-errors";

function fakeClient(replies: string[]) {
  const create = vi.fn();
  for (const reply of replies) {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: reply } }],
    });
  }
  return {
    client: {
      chat: { completions: { create } },
    } as unknown as OpenAI,
    create,
  };
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let result = "";
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}

describe("OpenAIConversationProvider", () => {
  it("sets a 60-second deadline for the customer reply request", async () => {
    const scenario = scenarioTemplates[0];
    const { client, create } = fakeClient(["它3个月大，是泰迪。"]);
    const provider = new OpenAIConversationProvider(client, "test-model");

    await collect(
      provider.streamCustomerReply({
        scenario,
        learnerTurnCount: 0,
        messages: [
          { role: "customer", content: scenario.openingMessage },
          { role: "learner", content: "狗狗多大？" },
        ],
      }),
    );

    expect(create).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ timeout: 60_000 }),
    );
  });

  it("sends the ordered transcript and current turn to the model", async () => {
    const scenario = scenarioTemplates[0];
    const { client, create } = fakeClient(["它3个月大，体重2.1公斤。"]);
    const provider = new OpenAIConversationProvider(client, "test-model");

    const reply = await collect(
      provider.streamCustomerReply({
        scenario,
        learnerTurnCount: 1,
        messages: [
          { role: "customer", content: scenario.openingMessage },
          { role: "learner", content: "狗狗多大？" },
          { role: "customer", content: "它刚满3个月。" },
          { role: "learner", content: "最新回复" },
        ],
      }),
    );

    expect(reply).toBe("它3个月大，体重2.1公斤。");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-model",
        stream: false,
        messages: [
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("当前是对话的第 2 轮"),
          }),
          {
            role: "user",
            content: expect.stringContaining(
              "顾客：它刚满3个月。\n客服：最新回复",
            ),
          },
        ],
      }),
      expect.objectContaining({ timeout: 60_000 }),
    );
  });

  it("retries once when the model repeats an earlier customer message", async () => {
    const scenario = scenarioTemplates[0];
    const repeated = "我家狗狗3个月大。";
    const { client, create } = fakeClient([
      repeated,
      "它是泰迪，现在大约2.1公斤。",
    ]);
    const provider = new OpenAIConversationProvider(client, "test-model");

    const reply = await collect(
      provider.streamCustomerReply({
        scenario,
        learnerTurnCount: 2,
        messages: [
          { role: "customer", content: scenario.openingMessage },
          { role: "learner", content: "狗狗多大？" },
          { role: "customer", content: repeated },
          { role: "learner", content: "体重和品种呢？" },
        ],
      }),
    );

    expect(reply).toBe("它是泰迪，现在大约2.1公斤。");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("rejects empty model output with a retry-safe message", async () => {
    const scenario = scenarioTemplates[0];
    const { client } = fakeClient([""]);
    const provider = new OpenAIConversationProvider(client, "test-model");

    await expect(
      collect(
        provider.streamCustomerReply({
          scenario,
          learnerTurnCount: 0,
          messages: [
            { role: "customer", content: scenario.openingMessage },
            { role: "learner", content: "您好" },
          ],
        }),
      ),
    ).rejects.toMatchObject({
      code: "AI_EMPTY_RESPONSE",
      message: "AI 未返回有效回复，请稍后重试。",
    });
  });

  it("fails safely after the model repeats a customer message twice", async () => {
    const scenario = scenarioTemplates[0];
    const repeated = "我家狗狗3个月大。";
    const { client, create } = fakeClient([repeated, repeated]);
    const provider = new OpenAIConversationProvider(client, "test-model");

    await expect(
      collect(
        provider.streamCustomerReply({
          scenario,
          learnerTurnCount: 1,
          messages: [
            { role: "customer", content: repeated },
            { role: "learner", content: "体重是多少？" },
          ],
        }),
      ),
    ).rejects.toMatchObject({
      code: "AI_DUPLICATE_RESPONSE",
      message: "AI 顾客回复重复，请重新发送消息。",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("omits provider-specific thinking options for gateway models", async () => {
    const scenario = scenarioTemplates[0];
    const { client, create } = fakeClient(["它3个月大，是泰迪。"]);
    const provider = new OpenAIConversationProvider(
      client,
      "bytedance/seed-1.8",
      false,
    );

    await collect(
      provider.streamCustomerReply({
        scenario,
        learnerTurnCount: 0,
        messages: [
          { role: "customer", content: scenario.openingMessage },
          { role: "learner", content: "狗狗多大？" },
        ],
      }),
    );

    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("thinking");
  });
});

describe("OpenAIEvaluationProvider", () => {
  it("passes the report deadline and caller abort signal to the AI request", async () => {
    const scenario = scenarioTemplates[0];
    const signal = new AbortController().signal;
    const create = vi.fn().mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield {
          choices: [
            {
              delta: {
                content: JSON.stringify({
                  confidence: 0.9,
                  dimensions: scenario.scoringDimensions.map((dimension) => ({
                    name: dimension.name,
                    score: dimension.weight,
                    evidence: ["已确认"],
                  })),
                  risks: [],
                  recommendations: [],
                }),
              },
            },
          ],
        };
      },
    });
    const client = {
      chat: { completions: { create } },
    } as unknown as OpenAI;
    const provider = new OpenAIEvaluationProvider(client, "test-model");

    const chunks = [];
    for await (const chunk of provider.evaluateStream({
      scenario,
      learnerMessages: ["我会先确认宠物年龄。"],
      signal,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(create).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ timeout: 180_000, signal }),
    );
  });

  it("classifies an empty report stream as AI_EMPTY_RESPONSE", async () => {
    const provider = new OpenAIEvaluationProvider(streamingClient([]), "test-model");

    const error = await collectEvaluationError(provider);

    expect(error).toMatchObject({ code: "AI_EMPTY_RESPONSE" });
    expect(classifyAiGatewayError(error)).toMatchObject({ kind: "empty_response" });
  });

  it.each([
    ["not-json", "invalid JSON"],
    [JSON.stringify({
      confidence: 0.9,
      dimensions: scenarioTemplates[0].scoringDimensions.map((dimension) => ({
        name: dimension.name,
        score: "not-a-number",
        evidence: ["证据"],
      })),
      risks: [],
    }), "schema-invalid JSON"],
  ])("classifies %s report content as AI_INVALID_RESPONSE (%s)", async (content) => {
    const provider = new OpenAIEvaluationProvider(streamingClient([content]), "test-model");

    const error = await collectEvaluationError(provider);

    expect(error).toMatchObject({ code: "AI_INVALID_RESPONSE" });
    expect(classifyAiGatewayError(error)).toMatchObject({ kind: "invalid_response" });
  });

  it("classifies a completed evaluation stream without a report as AI_INVALID_RESPONSE", async () => {
    class MissingReportProvider extends OpenAIEvaluationProvider {
      override async *evaluateStream() {
        yield { delta: "partial" } as const;
      }
    }
    const provider = new MissingReportProvider(streamingClient([]), "test-model");

    await expect(provider.evaluate({
      scenario: scenarioTemplates[0],
      learnerMessages: ["测试回复"],
    })).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });
});

function streamingClient(contents: string[]): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          async *[Symbol.asyncIterator]() {
            for (const content of contents) {
              yield { choices: [{ delta: { content } }] };
            }
          },
        }),
      },
    },
  } as unknown as OpenAI;
}

async function collectEvaluationError(provider: OpenAIEvaluationProvider): Promise<unknown> {
  try {
    for await (const chunk of provider.evaluateStream({
      scenario: scenarioTemplates[0],
      learnerMessages: ["测试回复"],
    })) {
      // Consume the provider to its terminal parse step.
      void chunk;
    }
  } catch (error) {
    return error;
  }
  throw new Error("expected evaluation provider to fail");
}

import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import { scenarioTemplates } from "./templates";
import { OpenAIConversationProvider } from "./ai-providers";

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
    ).rejects.toThrow("AI 未返回有效回复，请稍后重试。");
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
    ).rejects.toThrow("AI 顾客回复重复，请重新发送消息。");
    expect(create).toHaveBeenCalledTimes(2);
  });
});

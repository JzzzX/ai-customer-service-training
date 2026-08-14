import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import { verifyCompanyAiGateway } from "./ai-preflight";

describe("verifyCompanyAiGateway", () => {
  it("sends a minimal non-business prompt and returns safe metadata", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "OK" } }],
    });
    const client = {
      chat: { completions: { create } },
    } as unknown as OpenAI;

    const result = await verifyCompanyAiGateway(
      {
        SCENARIO_AI_MODE: "real",
        AI_GATEWAY_ENABLED: "false",
        OPENAI_API_KEY: "secret-key",
        OPENAI_BASE_URL: "https://gateway.example.test/v1",
        OPENAI_MODEL: "approved-model",
      },
      { createClient: () => client, now: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(42) },
    );

    expect(result).toEqual({
      endpoint: "gateway.example.test",
      latencyMs: 32,
      model: "approved-model",
    });
    expect(create).toHaveBeenCalledWith({
      model: "approved-model",
      stream: false,
      max_tokens: 8,
      messages: [
        { role: "system", content: "这是连通性检查，不包含业务或用户数据。" },
        { role: "user", content: "只回复 OK" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("rejects mock mode and Vercel gateway routing", async () => {
    await expect(
      verifyCompanyAiGateway({ SCENARIO_AI_MODE: "mock" }),
    ).rejects.toThrow("SCENARIO_AI_MODE 必须设置为 real");
    await expect(
      verifyCompanyAiGateway({
        SCENARIO_AI_MODE: "real",
        AI_GATEWAY_ENABLED: "true",
      }),
    ).rejects.toThrow("AI_GATEWAY_ENABLED 必须设置为 false");
  });

  it("rejects an empty model response", async () => {
    const client = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "" } }],
          }),
        },
      },
    } as unknown as OpenAI;

    await expect(
      verifyCompanyAiGateway(
        {
          SCENARIO_AI_MODE: "real",
          OPENAI_API_KEY: "secret-key",
          OPENAI_BASE_URL: "https://gateway.example.test/v1",
          OPENAI_MODEL: "approved-model",
        },
        { createClient: () => client },
      ),
    ).rejects.toMatchObject({ code: "AI_EMPTY_RESPONSE" });
  });

  it("classifies a malformed compatibility response", async () => {
    const client = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({ choices: [] }),
        },
      },
    } as unknown as OpenAI;

    await expect(
      verifyCompanyAiGateway(
        {
          SCENARIO_AI_MODE: "real",
          OPENAI_API_KEY: "secret-key",
          OPENAI_BASE_URL: "https://gateway.example.test/v1",
          OPENAI_MODEL: "approved-model",
        },
        { createClient: () => client },
      ),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });
});

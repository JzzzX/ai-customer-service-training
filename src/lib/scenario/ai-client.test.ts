// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  createOpenAIClient,
  isAiGatewayEnabled,
  resolveOpenAiModel,
} from "./ai-client";

describe("AI client routing", () => {
  it("uses the configured private OpenAI-compatible endpoint by default", () => {
    const environment = {
      OPENAI_API_KEY: "private-key",
      OPENAI_BASE_URL: "https://model.example.test/v1",
      OPENAI_MODEL: "private-model",
    };

    expect(isAiGatewayEnabled(environment)).toBe(false);
    expect(resolveOpenAiModel(environment)).toBe("private-model");
    expect(createOpenAIClient(environment).baseURL).toBe(
      "https://model.example.test/v1",
    );
  });

  it("uses Vercel OIDC and the gateway model when explicitly enabled", () => {
    const environment = {
      AI_GATEWAY_ENABLED: "true",
      AI_GATEWAY_MODEL: "bytedance/seed-1.8",
      VERCEL_OIDC_TOKEN: "oidc-token",
    };

    expect(isAiGatewayEnabled(environment)).toBe(true);
    expect(resolveOpenAiModel(environment)).toBe("bytedance/seed-1.8");
    expect(createOpenAIClient(environment).baseURL).toBe(
      "https://ai-gateway.vercel.sh/v1",
    );
  });
});

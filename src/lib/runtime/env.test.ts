import { describe, expect, it } from "vitest";

import { validateRuntimeEnvironment } from "./env";

const valid = {
  DATABASE_URL: "postgresql://user:password@example.test/database",
  AUTH_SECRET: "a".repeat(32),
  LOCAL_TEST_AUTH_ENABLED: "false",
};

describe("validateRuntimeEnvironment", () => {
  it("requires the database and a strong auth secret in production", () => {
    expect(() =>
      validateRuntimeEnvironment(
        { ...valid, DATABASE_URL: "" },
        "production",
      ),
    ).toThrow("生产环境配置无效");
    expect(() =>
      validateRuntimeEnvironment(
        { ...valid, AUTH_SECRET: "short" },
        "production",
      ),
    ).toThrow("生产环境配置无效");
  });

  it("rejects local test authentication in production", () => {
    expect(() =>
      validateRuntimeEnvironment(
        { ...valid, LOCAL_TEST_AUTH_ENABLED: "true" },
        "production",
      ),
    ).toThrow("生产环境配置无效");
  });

  it("requires a complete model configuration for real AI mode", () => {
    expect(() =>
      validateRuntimeEnvironment(
        { ...valid, SCENARIO_AI_MODE: "real" },
        "production",
      ),
    ).toThrow("生产环境配置无效");
    expect(
      validateRuntimeEnvironment(
        {
          ...valid,
          SCENARIO_AI_MODE: "real",
          OPENAI_API_KEY: "test-key",
          OPENAI_BASE_URL: "https://model.example.test/v1",
          OPENAI_MODEL: "test-model",
        },
        "production",
      ),
    ).toEqual({ mode: "production" });
    expect(
      validateRuntimeEnvironment(
        {
          ...valid,
          SCENARIO_AI_MODE: "real",
          AI_GATEWAY_ENABLED: "true",
          AI_GATEWAY_MODEL: "bytedance/seed-1.8",
        },
        "production",
      ),
    ).toEqual({ mode: "production" });
  });

  it("does not require production secrets for explicit local demo", () => {
    expect(
      validateRuntimeEnvironment(
        { LOCAL_TEST_AUTH_ENABLED: "true" },
        "development",
      ),
    ).toEqual({ mode: "local_demo" });
  });
});

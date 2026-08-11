import { describe, expect, it } from "vitest";

import { validateRuntimeEnvironment } from "./env";

const valid = {
  SQLITE_PATH: "./data/training.sqlite",
  AUTH_SECRET: "a".repeat(32),
};

describe("validateRuntimeEnvironment", () => {
  it("requires a SQLite path and a strong auth secret in production", () => {
    expect(() =>
      validateRuntimeEnvironment(
        { ...valid, SQLITE_PATH: "" },
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

  it("allows the SQLite path to be absent only for explicit demo mode", () => {
    expect(
      validateRuntimeEnvironment(
        { AUTH_SECRET: "a".repeat(32), DEMO_MODE: "true" },
        "production",
      ),
    ).toEqual({ mode: "sqlite" });
    expect(() =>
      validateRuntimeEnvironment(
        { AUTH_SECRET: "a".repeat(32) },
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
    ).toEqual({ mode: "sqlite" });
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
    ).toEqual({ mode: "sqlite" });
    expect(
      validateRuntimeEnvironment(
        {
          ...valid,
          SCENARIO_AI_MODE: "real",
          AI_GATEWAY_ENABLED: "false",
          OPENAI_API_KEY: "test-key",
          OPENAI_BASE_URL: "https://model.example.test/v1",
          OPENAI_MODEL: "test-model",
        },
        "production",
      ),
    ).toEqual({ mode: "sqlite" });
  });

  it("does not expose a local demo mode", () => {
    expect(
      validateRuntimeEnvironment(
        {},
        "development",
      ),
    ).toEqual({ mode: "sqlite" });
  });
});

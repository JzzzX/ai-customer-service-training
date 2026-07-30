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

  it("does not require production secrets for explicit local demo", () => {
    expect(
      validateRuntimeEnvironment(
        { LOCAL_TEST_AUTH_ENABLED: "true" },
        "development",
      ),
    ).toEqual({ mode: "local_demo" });
  });
});

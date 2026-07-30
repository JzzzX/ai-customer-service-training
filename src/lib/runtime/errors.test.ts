import { describe, expect, it, vi } from "vitest";

import { reportRuntimeError } from "./errors";

describe("reportRuntimeError", () => {
  it("logs structured identifiers without error messages or secrets", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret =
      "postgresql://admin:password@example.test/database";

    reportRuntimeError(
      { route: "/practice/quiz", userId: "learner-id" },
      new Error(`connection failed: ${secret}`),
    );

    const output = JSON.stringify(spy.mock.calls);
    expect(output).toContain("/practice/quiz");
    expect(output).toContain("learner-id");
    expect(output).toContain("Error");
    expect(output).not.toContain(secret);
    expect(output).not.toContain("password");
    spy.mockRestore();
  });
});

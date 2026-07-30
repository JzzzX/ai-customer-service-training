import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveRuntimeMode } from "./mode";

describe("runtime mode", () => {
  it("never selects local demo in production", () => {
    expect(
      resolveRuntimeMode({
        NODE_ENV: "production",
        LOCAL_TEST_AUTH_ENABLED: "true",
      }),
    ).toBe("production");
  });

  it("requires an explicit flag and no database for local demo", () => {
    expect(
      resolveRuntimeMode({
        NODE_ENV: "development",
        LOCAL_TEST_AUTH_ENABLED: "true",
      }),
    ).toBe("local_demo");
    expect(
      resolveRuntimeMode({
        NODE_ENV: "development",
        LOCAL_TEST_AUTH_ENABLED: "false",
      }),
    ).toBe("production");
    expect(
      resolveRuntimeMode({
        NODE_ENV: "development",
        LOCAL_TEST_AUTH_ENABLED: "true",
        DATABASE_URL: "postgresql://configured",
      }),
    ).toBe("production");
  });

  it("keeps application routes free of concrete persistence imports", async () => {
    const files = [
      "src/app/admin/questions/actions.ts",
      "src/app/admin/questions/page.tsx",
      "src/app/practice/quiz/actions.ts",
      "src/app/practice/quiz/page.tsx",
      "src/app/practice/history/page.tsx",
      "src/app/practice/scenario/actions.ts",
      "src/app/practice/scenario/page.tsx",
      "src/app/practice/scenario/[scenarioId]/page.tsx",
      "src/app/practice/scenario/session/[sessionId]/page.tsx",
      "src/app/practice/scenario/report/[sessionId]/page.tsx",
    ];
    const forbidden = [
      "LocalQuiz",
      "LocalScenario",
      "artifacts",
      "node:fs",
      "node:path",
      "@/db/repositories",
    ];

    for (const file of files) {
      const source = await readFile(resolve(process.cwd(), file), "utf8");
      for (const token of forbidden) {
        expect(source, `${file} must not contain ${token}`).not.toContain(
          token,
        );
      }
    }
  });
});

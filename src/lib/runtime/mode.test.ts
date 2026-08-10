import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveRuntimeMode } from "./mode";

describe("runtime mode", () => {
  it("always uses SQLite regardless of legacy environment flags", () => {
    expect(
      resolveRuntimeMode({
        NODE_ENV: "production",
        LOCAL_TEST_AUTH_ENABLED: "true",
      }),
    ).toBe("sqlite");
    expect(resolveRuntimeMode({ NODE_ENV: "development" })).toBe("sqlite");
  });

  it("keeps application routes free of concrete persistence imports", async () => {
    const files = await collectApplicationFiles("src/app");
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

async function collectApplicationFiles(root: string): Promise<string[]> {
  const entries = await readdir(resolve(process.cwd(), root), {
    withFileTypes: true,
  });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        return collectApplicationFiles(path);
      }
      return /\.(ts|tsx)$/.test(entry.name) &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".test.tsx")
        ? [path]
        : [];
    }),
  );
  return nested.flat();
}

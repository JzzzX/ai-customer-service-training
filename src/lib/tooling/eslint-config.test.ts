// @vitest-environment node

import { resolve } from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("ESLint workspace boundary", () => {
  it("ignores generated files inside local Git worktrees", async () => {
    const eslint = new ESLint({ cwd: process.cwd() });

    await expect(
      eslint.isPathIgnored(
        resolve(
          process.cwd(),
          ".worktrees/example/.next/build/generated.js",
        ),
      ),
    ).resolves.toBe(true);
  });
});

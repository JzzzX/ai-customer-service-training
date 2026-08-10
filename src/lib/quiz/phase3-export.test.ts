import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPhase3Export } from "../../../scripts/export-phase3-data";
import { quizTopics, topicQuizQuestions } from "./question-bank";

describe("phase 3 legacy export", () => {
  it("exports every topic question with deterministic identifiers and hashes", () => {
    const first = buildPhase3Export();
    const second = buildPhase3Export();
    const questions = first.topics.flatMap((topic) => topic.questions);

    expect(first).toEqual(second);
    expect(first.topics).toHaveLength(quizTopics.length);
    expect(questions).toHaveLength(topicQuizQuestions.length);
    expect(new Set(questions.map((question) => question.id)).size).toBe(
      questions.length,
    );
    expect(first.knowledge_version_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.export_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.topics.every((topic) => /^[a-f0-9]{64}$/.test(topic.quiz_hash)))
      .toBe(true);
  });

  it("writes the same canonical export through the command line", () => {
    const output = join(mkdtempSync(join(tmpdir(), "phase3-export-")), "data.json");
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        resolve("scripts/export-phase3-data.ts"),
        output,
      ],
    );

    const written = JSON.parse(readFileSync(output, "utf8"));
    expect(written.export_hash).toBe(buildPhase3Export().export_hash);
  });
});

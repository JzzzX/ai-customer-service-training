import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { publishQuizDraftPack } from "./publisher";
import type { QuizDraftPack } from "./schema";

function draftPack(): QuizDraftPack {
  return {
    schemaVersion: 1,
    quizHash: "b".repeat(64),
    knowledgePackHash: "a".repeat(64),
    title: "客服新人知识基础小测",
    passingScore: 80,
    status: "draft",
    questions: [
      {
        id: `qq_${"1".repeat(24)}`,
        knowledgeUnitId: `ku_${"2".repeat(24)}`,
        type: "true_false",
        prompt: "这是一道判断题。",
        options: ["正确", "错误"],
        correctAnswers: ["正确"],
        explanation: "来源中的正确说明。",
        category: "日常问答",
        difficulty: "easy",
        status: "draft",
        sources: [
          {
            sourcePath: "问答.md",
            kind: "markdown",
            anchor: "heading:1",
            line: 2,
            path: ["问答"],
          },
        ],
      },
    ],
  };
}

describe("publishQuizDraftPack", () => {
  it("writes an immutable draft and an idempotent latest pointer", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "quiz-draft-"));
    const first = await publishQuizDraftPack({
      pack: draftPack(),
      outputDir,
    });
    const second = await publishQuizDraftPack({
      pack: draftPack(),
      outputDir,
    });

    expect(first.createdFiles).toHaveLength(2);
    expect(second.createdFiles).toHaveLength(0);
    expect(
      JSON.parse(await readFile(first.latestPath, "utf8")),
    ).toMatchObject({
      quizHash: "b".repeat(64),
      status: "draft",
    });
  });
});

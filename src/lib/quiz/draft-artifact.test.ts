import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadQuizDraftArtifact } from "./draft-artifact";
import type { QuizDraftPack } from "./schema";

describe("quiz draft artifact loading", () => {
  it("loads the immutable draft selected by the local pointer", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "quiz-draft-loader-"));
    const draft = oneQuestionDraft();
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      join(outputDir, "latest.json"),
      JSON.stringify({
        schemaVersion: 1,
        quizHash: draft.quizHash,
        knowledgePackHash: draft.knowledgePackHash,
        status: "draft",
        draftFile: `draft-${draft.quizHash}.json`,
      }),
    );
    await writeFile(
      join(outputDir, `draft-${draft.quizHash}.json`),
      JSON.stringify(draft),
    );

    await expect(loadQuizDraftArtifact(outputDir)).resolves.toEqual(draft);
  });

  it("rejects a pointer that escapes the artifact directory", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "quiz-draft-loader-"));
    const draft = oneQuestionDraft();
    await writeFile(
      join(outputDir, "latest.json"),
      JSON.stringify({
        schemaVersion: 1,
        quizHash: draft.quizHash,
        knowledgePackHash: draft.knowledgePackHash,
        status: "draft",
        draftFile: "../secret.json",
      }),
    );

    await expect(loadQuizDraftArtifact(outputDir)).rejects.toThrow(
      "无效文件名",
    );
  });
});

function oneQuestionDraft(): QuizDraftPack {
  return {
    schemaVersion: 1,
    quizHash: "a".repeat(64),
    knowledgePackHash: "b".repeat(64),
    title: "测试草稿",
    passingScore: 80,
    status: "draft",
    questions: [
      {
        id: `qq_${"c".repeat(24)}`,
        knowledgeUnitId: `ku_${"d".repeat(24)}`,
        type: "true_false",
        prompt: "测试题目",
        options: ["正确", "错误"],
        correctAnswers: ["正确"],
        explanation: "测试解释",
        category: "测试分类",
        difficulty: "easy",
        status: "draft",
        sources: [
          {
            sourcePath: "企划问答.xlsx",
            kind: "excel",
            anchor: "sheet:产品/row:2",
            sheet: "产品",
            row: 2,
            path: ["产品", "测试题目"],
          },
        ],
      },
    ],
  };
}

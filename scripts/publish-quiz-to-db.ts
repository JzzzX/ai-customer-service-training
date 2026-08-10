import { config } from "dotenv";
import { resolve } from "node:path";

import { getDatabase } from "../src/db/client";
import {
  createQuizDraftPublicationStore,
  publishQuizDraftToStore,
} from "../src/db/quiz-draft-publication";
import { loadQuizDraftArtifact } from "../src/lib/quiz/draft-artifact";

config({
  path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local",
  quiet: true,
});

async function main(): Promise<void> {
  const database = getDatabase();
  const draft = await loadQuizDraftArtifact(
    resolve(process.cwd(), "artifacts", "quiz"),
  );
  const draftResult = await publishQuizDraftToStore(
    draft,
    "cli",
    createQuizDraftPublicationStore(database),
  );
  console.log(
    [
      `题库草稿：${draftResult.quizHash}`,
      `题目数：${draft.questions.length}`,
      `草稿：${draftResult.created ? "已创建" : "已存在（幂等）"}`,
      `正式题组：${draftResult.quizHash}`,
      "状态：已通过 CLI 发布",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "题库发布失败。");
  process.exitCode = 1;
});

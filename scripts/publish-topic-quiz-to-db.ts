import { config } from "dotenv";

import { getDatabase } from "../src/db/client";
import { publishTopicQuizCatalog } from "../src/db/topic-quiz-publication";

config({
  path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local",
  quiet: true,
});

try {
  const result = publishTopicQuizCatalog(getDatabase());
  console.log(
    [
      `专题数：${result.topicCount}`,
      `题目数：${result.questionCount}`,
      `新建题组：${result.createdSetCount}`,
      `已有题组：${result.existingSetCount}`,
      "状态：专题题库已通过 CLI 幂等发布",
    ].join("\n"),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "专题题库发布失败。");
  process.exitCode = 1;
}

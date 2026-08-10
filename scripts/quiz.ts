import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { knowledgePackSchema } from "../src/lib/knowledge/schema";
import { generateQuizDraftPack } from "../src/lib/quiz/generator";
import { publishQuizDraftPack } from "../src/lib/quiz/publisher";

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== "build") {
    throw new Error(
      "Usage: quiz.ts build [--knowledge FILE] [--out DIR] [--count NUMBER]",
    );
  }

  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      knowledge: { type: "string" },
      out: { type: "string" },
      count: { type: "string" },
    },
    strict: true,
  });
  const knowledgePath = resolve(
    values.knowledge ?? (await resolveLatestKnowledgePack()),
  );
  const outputDir = resolve(
    values.out ?? join(process.cwd(), "artifacts", "quiz"),
  );
  const count = values.count ? Number.parseInt(values.count, 10) : 40;
  const knowledge = knowledgePackSchema.parse(
    JSON.parse(await readFile(knowledgePath, "utf8")),
  );
  const pack = generateQuizDraftPack({ knowledge, count });
  const published = await publishQuizDraftPack({ pack, outputDir });

  const typeCounts = Object.groupBy(
    pack.questions,
    (question) => question.type,
  );
  const categoryCounts = Object.groupBy(
    pack.questions,
    (question) => question.category,
  );
  console.log(`小测草稿：${pack.questions.length} 题`);
  console.log(
    `题型：单选 ${typeCounts.single_choice?.length ?? 0} / 判断 ${typeCounts.true_false?.length ?? 0}`,
  );
  console.log(
    `分类：${Object.entries(categoryCounts)
      .map(([category, questions]) => `${category} ${questions?.length ?? 0}`)
      .join(" / ")}`,
  );
  console.log(`知识版本：${pack.knowledgePackHash}`);
  console.log(`题目版本：${pack.quizHash}`);
  console.log(
    published.createdFiles.length > 0
      ? `已生成 ${published.createdFiles.length} 个本地草稿产物：${outputDir}`
      : `草稿版本已存在，无需重复写入：${outputDir}`,
  );
  console.log("状态：draft（管理员审核后才能发布）");
}

async function resolveLatestKnowledgePack(): Promise<string> {
  const knowledgeDir = join(process.cwd(), "artifacts", "knowledge");
  const latest = JSON.parse(
    await readFile(join(knowledgeDir, "latest.json"), "utf8"),
  ) as { packFile?: unknown };
  if (typeof latest.packFile !== "string" || latest.packFile.length === 0) {
    throw new Error("知识 latest.json 中缺少 packFile。");
  }
  return join(knowledgeDir, latest.packFile);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

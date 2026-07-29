import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { compileKnowledgeDirectory } from "../src/lib/knowledge/directory-compiler";
import {
  projectExpectedCoverage,
  projectKnowledgeOutputDirectory,
  projectKnowledgeSourceDirectory,
} from "../src/lib/knowledge/project-config";
import { publishKnowledgePack } from "../src/lib/knowledge/publisher";

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== "check" && command !== "publish") {
    throw new Error(
      "Usage: knowledge.ts <check|publish> [--source DIR] [--out DIR]",
    );
  }

  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      out: { type: "string" },
      source: { type: "string" },
    },
    strict: true,
  });
  const sourceDir = resolve(
    values.source ?? join(process.cwd(), projectKnowledgeSourceDirectory),
  );
  const outputDir = resolve(
    values.out ?? join(process.cwd(), projectKnowledgeOutputDirectory),
  );
  const pack = await compileKnowledgeDirectory({
    sourceDir,
    expected: projectExpectedCoverage,
  });

  printSummary(pack);

  if (!pack.gate.passed) {
    process.exitCode = 1;
    return;
  }

  if (command === "publish") {
    const published = await publishKnowledgePack({ pack, outputDir });
    console.log(
      published.createdFiles.length > 0
        ? `已发布 ${published.createdFiles.length} 个本地知识产物：${outputDir}`
        : `知识版本已存在，无需重复写入：${outputDir}`,
    );
  }
}

function printSummary(
  pack: Awaited<ReturnType<typeof compileKnowledgeDirectory>>,
): void {
  const status = pack.gate.passed ? "PASS" : "FAIL";
  console.log(`知识覆盖门禁：${status}`);
  console.log(`知识版本：${pack.packHash}`);
  console.log(
    `源文件：${pack.coverage.sourceFiles}（MD ${pack.coverage.markdownFiles} / XLSX ${pack.coverage.workbookFiles} / MM ${pack.coverage.mindmapFiles}）`,
  );
  console.log(
    `知识单元：${pack.coverage.unitsBeforeDedup} → ${pack.coverage.unitsAfterDedup}（合并重复 ${pack.coverage.duplicatesMerged}）`,
  );
  console.log(
    `工作表：${pack.coverage.workbookSheets}；MM 节点：${pack.coverage.mindmapNodes}；跳过图片：${pack.coverage.skippedImages}`,
  );
  console.log(
    `冲突：${pack.coverage.conflicts}；空内容：${pack.coverage.emptyItemsSkipped}；解析错误：${pack.coverage.parseErrors}`,
  );

  for (const check of pack.gate.checks.filter((item) => !item.passed)) {
    console.error(
      `门禁未通过 ${check.name}: expected=${check.expected}, actual=${check.actual}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

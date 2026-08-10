import { config } from "dotenv";
import { resolve } from "node:path";

import { getDatabase } from "../src/db/client";
import {
  createScenarioPublicationStore,
  publishScenarioTemplatesToStore,
} from "../src/db/scenario-publication";
import { compileKnowledgeDirectory } from "../src/lib/knowledge/directory-compiler";
import {
  projectExpectedCoverage,
  projectKnowledgeSourceDirectory,
} from "../src/lib/knowledge/project-config";
import { scenarioTemplates } from "../src/lib/scenario/templates";

config({
  path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local",
  quiet: true,
});

async function main(): Promise<void> {
  const knowledge = await compileKnowledgeDirectory({
    sourceDir: resolve(
      process.cwd(),
      projectKnowledgeSourceDirectory,
    ),
    expected: projectExpectedCoverage,
  });
  if (!knowledge.gate.passed) {
    throw new Error("知识覆盖门禁未通过。");
  }

  const database = getDatabase();
  const result = await publishScenarioTemplatesToStore({
    templates: scenarioTemplates,
    knowledgeVersionHash: knowledge.packHash,
    store: createScenarioPublicationStore(database),
  });
  console.log(
    [
      `场景数：${scenarioTemplates.length}`,
      `知识版本：${knowledge.packHash}`,
      `状态：新建 ${result.created}，已存在 ${result.existing}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "场景发布失败。请检查数据库连接、迁移、管理员种子、知识版本和来源定位。",
  );
  process.exitCode = 1;
});

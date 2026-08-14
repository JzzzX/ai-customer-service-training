import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { getDatabase } from "../src/db/client";
import { knowledgeVersions } from "../src/db/schema";
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
  const database = getDatabase();

  const sourceDir = resolve(
    process.cwd(),
    projectKnowledgeSourceDirectory,
  );

  let knowledgeVersionHash: string;

  if (existsSync(sourceDir)) {
    const knowledge = await compileKnowledgeDirectory({
      sourceDir,
      expected: projectExpectedCoverage,
    });

    if (!knowledge.gate.passed) {
      throw new Error("知识覆盖门禁未通过。");
    }

    knowledgeVersionHash = knowledge.packHash;
  } else {
    const activeVersions = await database
      .select({
        versionHash: knowledgeVersions.versionHash,
      })
      .from(knowledgeVersions)
      .where(
        and(
          eq(knowledgeVersions.isActive, true),
          eq(knowledgeVersions.status, "published"),
        ),
      )
      .limit(2)
      .all();

    if (activeVersions.length !== 1) {
      throw new Error(
        "原始知识目录不存在，且 SQLite 中无法唯一确定当前活动知识版本。",
      );
    }

    knowledgeVersionHash =
      activeVersions[0]!.versionHash;

    console.log(
      "原始知识目录不存在，使用 SQLite 当前活动知识版本。",
    );
  }

  const result = await publishScenarioTemplatesToStore({
    templates: scenarioTemplates,
    knowledgeVersionHash,
    store: createScenarioPublicationStore(database),
  });

  console.log(
    [
      `场景数：${scenarioTemplates.length}`,
      `知识版本：${knowledgeVersionHash}`,
      `状态：新建 ${result.created}，已存在 ${result.existing}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "场景发布失败。请检查数据库连接、迁移、知识版本和来源定位。",
  );
  process.exitCode = 1;
});

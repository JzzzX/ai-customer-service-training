import { and, eq } from "drizzle-orm";
import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

import { getDatabase } from "../src/db/client";
import {
  createScenarioPublicationStore,
  publishScenarioTemplatesToStore,
} from "../src/db/scenario-publication";
import { users } from "../src/db/schema";
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
  const adminEmail = z
    .string()
    .email()
    .parse(process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase());
  const [admin] = await database
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.email, adminEmail),
        eq(users.role, "admin"),
        eq(users.isActive, true),
      ),
    )
    .limit(1);
  if (!admin) {
    throw new Error("找不到已启用的种子管理员账号。");
  }

  const result = await publishScenarioTemplatesToStore({
    templates: scenarioTemplates,
    knowledgeVersionHash: knowledge.packHash,
    createdById: admin.id,
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

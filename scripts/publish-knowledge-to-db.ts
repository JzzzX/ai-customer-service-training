import { config } from "dotenv";
import { resolve } from "node:path";

import { publishKnowledgePackToDatabase } from "../src/db/knowledge-store";
import { compileKnowledgeDirectory } from "../src/lib/knowledge/directory-compiler";
import {
  projectExpectedCoverage,
  projectKnowledgeSourceDirectory,
} from "../src/lib/knowledge/project-config";

config({ path: ".env.local", quiet: true });

async function main(): Promise<void> {
  const pack = await compileKnowledgeDirectory({
    sourceDir: resolve(process.cwd(), projectKnowledgeSourceDirectory),
    expected: projectExpectedCoverage,
  });
  if (!pack.gate.passed) {
    throw new Error(
      "Knowledge coverage gate failed. Run pnpm knowledge:check for details.",
    );
  }

  const published = await publishKnowledgePackToDatabase(pack);
  console.log(
    published.created
      ? `已发布数据库知识版本：${published.versionHash}`
      : `数据库知识版本已存在：${published.versionHash}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

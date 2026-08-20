import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

import { exportBaseDataBundle } from "../src/db/migration/base-data-bundle";

config({ path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local", quiet: true });

function requiredOption(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1]?.trim();
  if (!value) throw new Error(`缺少参数 ${name}`);
  return value;
}

async function main() {
  const databaseUrl = process.env.NEON_EXPORT_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("NEON_EXPORT_DATABASE_URL 是 Neon 只读导出所必需的连接串。");
  const output = resolve(requiredOption("--output"));
  const sql = neon(databaseUrl, { readOnly: true });
  const bundle = await exportBaseDataBundle({ query: (query) => sql.query(query) }, "neon-postgres");
  writeFileSync(output, `${JSON.stringify(bundle, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(`已导出 BaseDataBundleV2：${output}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

import { getDatabase } from "../src/db/client";
import { importBaseDataBundle } from "../src/db/migration/base-data-bundle";

config({ path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local", quiet: true });

function requiredOption(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1]?.trim();
  if (!value) throw new Error(`缺少参数 ${name}`);
  return value;
}

try {
  const file = resolve(requiredOption("--file"));
  const bundle = JSON.parse(readFileSync(file, "utf8")) as unknown;
  importBaseDataBundle(bundle, getDatabase());
  console.log("BaseDataBundleV1 已原子导入 SQLite（未导入训练历史）。");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

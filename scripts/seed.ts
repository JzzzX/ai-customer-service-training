import { config } from "dotenv";

import { importLearners } from "./cli-support";

config({
  path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local",
  quiet: true,
});

async function main(): Promise<void> {
  const email = process.env.SEED_LEARNER_EMAIL?.trim();
  const name = process.env.SEED_LEARNER_NAME?.trim();
  const password = process.env.SEED_LEARNER_PASSWORD;
  if (!email || !name || !password) throw new Error("SEED_LEARNER_EMAIL、SEED_LEARNER_NAME、SEED_LEARNER_PASSWORD 均为必填。");
  const result = await importLearners([{ email, name, password, isActive: true }]);
  console.log(`预置学员完成：新增 ${result.created}，更新 ${result.updated}。`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

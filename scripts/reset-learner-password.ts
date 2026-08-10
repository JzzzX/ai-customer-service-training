import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resetLearnerPassword, requiredOption } from "./cli-support";
config({ path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local", quiet: true });
async function main() { const password = readFileSync(0, "utf8").trim(); if (!password) throw new Error("请通过标准输入提供新密码。"); if (!await resetLearnerPassword(requiredOption("--email"), password)) throw new Error("找不到学员账号。"); console.log("学员密码已重置。"); }
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

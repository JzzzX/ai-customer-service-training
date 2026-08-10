import { config } from "dotenv";
import { importLearners, parseCsvFile, requiredOption } from "./cli-support";
config({ path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local", quiet: true });
async function main() { const result = await importLearners(parseCsvFile(requiredOption("--file"))); console.log(`学员导入完成：新增 ${result.created}，更新 ${result.updated}。`); }
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

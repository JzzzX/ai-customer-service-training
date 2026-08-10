import { config } from "dotenv";
import { backupDatabase, requiredOption } from "./cli-support";
config({ path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local", quiet: true });
async function main() { await backupDatabase(requiredOption("--output")); console.log("SQLite 备份完成。"); }
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

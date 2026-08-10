import { config } from "dotenv";
import { disableLearner, requiredOption } from "./cli-support";
config({ path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local", quiet: true });
try { if (!disableLearner(requiredOption("--email"))) throw new Error("找不到学员账号。"); console.log("学员已停用。"); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }

import { config } from "dotenv";
import { assertDatabaseSchema, getDatabase } from "../src/db/client";
config({ path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local", quiet: true });
try { assertDatabaseSchema(getDatabase()); console.log("SQLite 数据库校验通过。"); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }

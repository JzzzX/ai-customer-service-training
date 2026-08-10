import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

const sqlitePath = process.env.SQLITE_PATH?.trim();

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  ...(sqlitePath ? { dbCredentials: { url: sqlitePath } } : {}),
});

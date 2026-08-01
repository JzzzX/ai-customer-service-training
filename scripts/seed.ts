import { hash } from "bcryptjs";
import { config } from "dotenv";

import { getDatabase } from "../src/db/client";
import { readSeedAccounts } from "../src/db/seed-config";
import { users } from "../src/db/schema";

config({
  path: process.env.DOTENV_CONFIG_PATH?.trim() || ".env.local",
  quiet: true,
});

async function main(): Promise<void> {
  const database = getDatabase();
  const accounts = readSeedAccounts();

  for (const account of accounts) {
    const passwordHash = await hash(account.password, 12);
    await database
      .insert(users)
      .values({
        email: account.email,
        name: account.name,
        passwordHash,
        role: account.role,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: account.name,
          passwordHash,
          role: account.role,
          isActive: true,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`已写入 ${accounts.length} 个预置测试账号。`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

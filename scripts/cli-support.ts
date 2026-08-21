import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hash, hashSync } from "bcryptjs";
import { eq } from "drizzle-orm";

import { getDatabase, type DatabaseClient } from "../src/db/client";
import { users } from "../src/db/schema";

export type LearnerCsvRow = {
  email: string;
  name: string;
  password: string;
  isActive: boolean;
};

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`无效邮箱：${email}`);
  }
  return normalized;
}

export function parseLearnerCsv(contents: string): LearnerCsvRow[] {
  const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2 || lines[0] !== "email,name,password,is_active") {
    throw new Error("CSV 表头必须为 email,name,password,is_active。");
  }
  const seen = new Set<string>();
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    if (cells.length !== 4) throw new Error(`第 ${index + 2} 行必须包含 4 列。`);
    const [rawEmail, rawName, password, rawActive] = cells;
    const email = normalizeEmail(rawEmail);
    const name = rawName.trim();
    if (!name) throw new Error(`第 ${index + 2} 行姓名不能为空。`);
    if (password && password.length < 8) throw new Error(`第 ${index + 2} 行密码至少 8 位。`);
    if (rawActive !== "true" && rawActive !== "false") throw new Error(`第 ${index + 2} 行 is_active 必须为 true 或 false。`);
    if (seen.has(email)) throw new Error(`CSV 包含重复邮箱：${email}`);
    seen.add(email);
    return { email, name, password, isActive: rawActive === "true" };
  });
}

export async function importLearners(rows: LearnerCsvRow[], database: DatabaseClient = getDatabase()): Promise<{ created: number; updated: number }> {
  const prepared = await Promise.all(rows.map(async (row) => ({ ...row, passwordHash: row.password ? await hash(row.password, 12) : "" })));
  return database.transaction((transaction) => {
    let created = 0; let updated = 0;
    for (const row of prepared) {
      const existing = transaction.select({ id: users.id }).from(users).where(eq(users.email, row.email)).get();
      if (!existing) {
        if (!row.password) throw new Error(`新学员必须提供密码：${row.email}`);
        transaction.insert(users).values({ id: randomUUID(), email: row.email, name: row.name, passwordHash: row.passwordHash, isActive: row.isActive }).run();
        created += 1;
      } else {
        transaction.update(users).set({ name: row.name, isActive: row.isActive, ...(row.password ? { passwordHash: row.passwordHash } : {}), updatedAt: new Date() }).where(eq(users.id, existing.id)).run();
        updated += 1;
      }
    }
    return { created, updated };
  });
}

export function disableLearner(email: string, database: DatabaseClient = getDatabase()): boolean {
  const result = database.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.email, normalizeEmail(email))).run();
  return result.changes === 1;
}

export function grantAdmin(
  email: string,
  database: DatabaseClient = getDatabase(),
): boolean {
  const normalizedEmail = normalizeEmail(email);
  return database.transaction((transaction) => {
    const existing = transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .get();
    if (existing) {
      return transaction
        .update(users)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .run().changes === 1;
    }

    const localName = normalizedEmail.split("@", 1)[0] || "待绑定管理员";
    transaction.insert(users).values({
      id: randomUUID(),
      email: normalizedEmail,
      name: localName,
      passwordHash: hashSync(randomUUID(), 10),
      role: "admin",
      isActive: true,
    }).run();
    return true;
  });
}

export function revokeAdmin(
  email: string,
  database: DatabaseClient = getDatabase(),
): boolean {
  return setUserRole(email, "learner", database);
}

export async function resetLearnerPassword(email: string, password: string, database: DatabaseClient = getDatabase()): Promise<boolean> {
  if (password.length < 8) throw new Error("新密码至少需要 8 位。");
  const passwordHash = await hash(password, 12);
  const result = database.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.email, normalizeEmail(email))).run();
  return result.changes === 1;
}

export function requiredOption(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1]?.trim() : undefined;
  if (!value) throw new Error(`缺少参数 ${name}`);
  return value;
}

export function parseCsvFile(path: string): LearnerCsvRow[] { return parseLearnerCsv(readFileSync(resolve(path), "utf8")); }
export async function backupDatabase(output: string, database: DatabaseClient = getDatabase()): Promise<void> {
  const target = resolve(output);
  if (existsSync(target)) throw new Error(`备份目标已存在：${target}`);
  const source = database.$client;
  source.exec("PRAGMA wal_checkpoint(FULL)");
  await source.backup(target);
}
export function contentHash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function setUserRole(
  email: string,
  role: "learner" | "admin",
  database: DatabaseClient,
): boolean {
  const result = database
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.email, normalizeEmail(email)))
    .run();
  return result.changes === 1;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; }
    else if (character === "," && !quoted) { cells.push(current); current = ""; } else current += character;
  }
  if (quoted) throw new Error("CSV 引号未闭合。");
  cells.push(current); return cells;
}

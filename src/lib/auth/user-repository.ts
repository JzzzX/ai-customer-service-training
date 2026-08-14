import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import { feishuIdentities, users } from "@/db/schema";

export interface FeishuIdentityProfile {
  unionId: string;
  openId: string;
  email: string;
}

export interface ResolvedUser {
  id: string;
  email: string;
  name: string;
}

/**
 * 保留旧系统的飞书账号解析规则：
 *
 * 1. union_id 已绑定：直接返回对应启用用户，并刷新 open_id。
 * 2. union_id 未绑定：按飞书已验证邮箱寻找启用用户。
 * 3. 用户已经绑定另一个飞书身份时拒绝重新绑定。
 * 4. 找不到预分配用户时拒绝登录，不自动创建陌生账号。
 */
export function resolveFeishuUser(
  profile: FeishuIdentityProfile,
): ResolvedUser | null {
  const unionId = profile.unionId.trim();
  const openId = profile.openId.trim();
  const normalizedEmail = profile.email.trim().toLowerCase();

  if (!unionId || !openId) {
    return null;
  }

  const database = getDatabase();

  return database.transaction((tx) => {
    const bound = tx
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
      })
      .from(feishuIdentities)
      .innerJoin(users, eq(users.id, feishuIdentities.userId))
      .where(eq(feishuIdentities.unionId, unionId))
      .get();

    const now = new Date();

    if (bound) {
      if (!bound.isActive) {
        return null;
      }

      tx.update(feishuIdentities)
        .set({
          openId,
          updatedAt: now,
        })
        .where(eq(feishuIdentities.unionId, unionId))
        .run();

      tx.update(users)
        .set({
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, bound.userId))
        .run();

      return {
        id: bound.userId,
        email: bound.email,
        name: bound.name,
      };
    }

    // union_id 尚未绑定时，才使用飞书邮箱
    // 与预分配的本地账号进行首次绑定。
    if (!normalizedEmail) {
      return null;
    }

    const user = tx
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          sql`lower(${users.email}) = ${normalizedEmail}`,
          eq(users.isActive, true),
        ),
      )
      .get();

    if (!user || !user.isActive) {
      return null;
    }

    const existingIdentity = tx
      .select({
        id: feishuIdentities.id,
      })
      .from(feishuIdentities)
      .where(eq(feishuIdentities.userId, user.id))
      .get();

    if (existingIdentity) {
      return null;
    }

    tx.insert(feishuIdentities)
      .values({
        id: randomUUID(),
        userId: user.id,
        unionId,
        openId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    tx.update(users)
      .set({
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id))
      .run();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  });
}

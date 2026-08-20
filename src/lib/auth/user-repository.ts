import {
  createHash,
  randomUUID,
} from "node:crypto";

import { hashSync } from "bcryptjs";
import { eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import {
  feishuIdentities,
  users,
} from "@/db/schema";

export interface FeishuIdentityProfile {
  unionId: string;
  openId: string;
  email: string;
  name: string;
}

export interface ResolvedUser {
  id: string;
  email: string;
  name: string;
}

type UserRepositoryDatabase =
  ReturnType<typeof getDatabase>;

/**
 * 飞书账号解析规则：
 *
 * 1. union_id 已绑定：
 *    返回原用户，并刷新 open_id 和最后登录时间。
 *
 * 2. union_id 未绑定，但飞书返回邮箱：
 *    优先按邮箱匹配已有本地用户，兼容历史迁移账号。
 *
 * 3. 邮箱匹配到已禁用用户：
 *    拒绝登录，不能通过飞书 OAuth 绕过 is_active=false。
 *
 * 4. 本地没有对应用户：
 *    自动创建启用用户，并同时建立 feishu_identities。
 *
 * 5. 飞书未返回邮箱：
 *    根据 union_id 生成内部占位邮箱，仍允许已通过
 *    飞书 OAuth 的员工正常进入系统。
 *
 * 用户创建和飞书身份绑定在同一 SQLite transaction 内完成。
 */
export function resolveFeishuUser(
  profile: FeishuIdentityProfile,
  database: UserRepositoryDatabase = getDatabase(),
): ResolvedUser | null {
  const unionId = profile.unionId.trim();
  const openId = profile.openId.trim();

  const normalizedEmail =
    profile.email.trim().toLowerCase();

  const normalizedName =
    profile.name.trim();

  if (!unionId || !openId) {
    return null;
  }

  return database.transaction((tx) => {
    const now = new Date();

    /**
     * 第一优先级：稳定的 union_id 已经绑定。
     */
    const bound = tx
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
      })
      .from(feishuIdentities)
      .innerJoin(
        users,
        eq(
          users.id,
          feishuIdentities.userId,
        ),
      )
      .where(
        eq(
          feishuIdentities.unionId,
          unionId,
        ),
      )
      .get();

    if (bound) {
      if (!bound.isActive) {
        return null;
      }

      tx.update(feishuIdentities)
        .set({
          openId,
          updatedAt: now,
        })
        .where(
          eq(
            feishuIdentities.unionId,
            unionId,
          ),
        )
        .run();

      tx.update(users)
        .set({
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(
          eq(users.id, bound.userId),
        )
        .run();

      return {
        id: bound.userId,
        email: bound.email,
        name: bound.name,
      };
    }

    /**
     * 第二优先级：
     * 有飞书邮箱时先匹配历史 users，
     * 避免老员工生成第二个本地账号。
     */
    if (normalizedEmail) {
      const existingUser = tx
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          isActive: users.isActive,
        })
        .from(users)
        .where(
          sql`
            lower(${users.email})
            =
            ${normalizedEmail}
          `,
        )
        .get();

      if (existingUser) {
        /**
         * 明确禁用过的账号不能重新自动激活。
         */
        if (!existingUser.isActive) {
          return null;
        }

        /**
         * 一个 users 只能绑定一个飞书身份。
         */
        const existingIdentity = tx
          .select({
            id: feishuIdentities.id,
          })
          .from(feishuIdentities)
          .where(
            eq(
              feishuIdentities.userId,
              existingUser.id,
            ),
          )
          .get();

        if (existingIdentity) {
          return null;
        }

        tx.insert(feishuIdentities)
          .values({
            id: randomUUID(),
            userId: existingUser.id,
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
          .where(
            eq(
              users.id,
              existingUser.id,
            ),
          )
          .run();

        return {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        };
      }
    }

    /**
     * 第三优先级：
     * 全新员工第一次飞书登录时自动开户。
     */
    const userId = randomUUID();

    const localEmail =
      normalizedEmail ||
      createSyntheticFeishuEmail(unionId);

    const localName =
      normalizedName ||
      displayNameFromEmail(normalizedEmail) ||
      "飞书用户";

    /**
     * users.password_hash 是历史 schema 的 NOT NULL 字段。
     * 生产登录入口已经是飞书 OAuth，因此这里生成不可知随机密码，
     * 仅用于满足兼容性约束，不向用户提供密码登录。
     */
    const passwordHash = hashSync(
      randomUUID(),
      10,
    );

    tx.insert(users)
      .values({
        id: userId,
        email: localEmail,
        name: localName,
        passwordHash,
        isActive: true,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    tx.insert(feishuIdentities)
      .values({
        id: randomUUID(),
        userId,
        unionId,
        openId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return {
      id: userId,
      email: localEmail,
      name: localName,
    };
  });
}

function createSyntheticFeishuEmail(
  unionId: string,
): string {
  const digest = createHash("sha256")
    .update(unionId)
    .digest("hex")
    .slice(0, 40);

  return `feishu-${digest}@oauth.invalid`;
}

function displayNameFromEmail(
  email: string,
): string {
  if (!email) {
    return "";
  }

  return (
    email.split("@", 1)[0]?.trim() ?? ""
  );
}

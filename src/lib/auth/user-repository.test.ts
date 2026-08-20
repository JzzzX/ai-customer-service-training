// @vitest-environment node

import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  feishuIdentities,
  users,
} from "@/db/schema";
import {
  createTestDatabase,
} from "@/db/test-support/create-test-database";

import {
  resolveFeishuUser,
} from "./user-repository";

type RepositoryDatabase =
  NonNullable<
    Parameters<typeof resolveFeishuUser>[1]
  >;

describe(
  "resolveFeishuUser 飞书自动开户",
  () => {
    let client: Awaited<
      ReturnType<typeof createTestDatabase>
    >["client"];

    let database: Awaited<
      ReturnType<typeof createTestDatabase>
    >["database"];

    beforeEach(async () => {
      ({
        client,
        database,
      } = await createTestDatabase());
    });

    afterEach(async () => {
      await client.close();
    });

    function resolve(
      overrides: Partial<{
        unionId: string;
        openId: string;
        email: string;
        name: string;
      }> = {},
    ) {
      return resolveFeishuUser(
        {
          unionId: "union-new",
          openId: "open-new",
          email:
            "new.employee@example.com",
          name: "新员工",
          ...overrides,
        },
        database as unknown as RepositoryDatabase,
      );
    }

    it(
      "全新飞书员工首次登录自动创建用户并绑定身份",
      () => {
        const result = resolve();

        expect(result).not.toBeNull();

        expect(result).toMatchObject({
          email:
            "new.employee@example.com",
          name: "新员工",
        });

        const storedUsers =
          database
            .select()
            .from(users)
            .all();

        const identities =
          database
            .select()
            .from(feishuIdentities)
            .all();

        expect(storedUsers).toHaveLength(1);
        expect(identities).toHaveLength(1);

        expect(storedUsers[0]).toMatchObject({
          id: result?.id,
          email:
            "new.employee@example.com",
          name: "新员工",
          isActive: true,
        });

        expect(
          storedUsers[0]?.passwordHash,
        ).toMatch(/^\$2[aby]\$/);

        expect(
          identities[0],
        ).toMatchObject({
          userId: result?.id,
          unionId: "union-new",
          openId: "open-new",
        });
      },
    );

    it(
      "飞书未返回邮箱时仍自动创建用户",
      () => {
        const result = resolve({
          email: "",
          name: "无邮箱员工",
        });

        expect(result).not.toBeNull();

        expect(result?.name).toBe(
          "无邮箱员工",
        );

        expect(
          result?.email,
        ).toMatch(
          /^feishu-[0-9a-f]{40}@oauth\.invalid$/,
        );

        expect(
          database
            .select()
            .from(users)
            .all(),
        ).toHaveLength(1);

        expect(
          database
            .select()
            .from(feishuIdentities)
            .all(),
        ).toHaveLength(1);
      },
    );

    it(
      "同一 union_id 重复登录不会重复开户并刷新 open_id",
      () => {
        const first = resolve();

        const second = resolve({
          openId: "open-refreshed",
          email: "",
          name: "",
        });

        expect(second?.id).toBe(first?.id);

        expect(
          database
            .select()
            .from(users)
            .all(),
        ).toHaveLength(1);

        expect(
          database
            .select()
            .from(feishuIdentities)
            .all(),
        ).toHaveLength(1);

        const identity =
          database
            .select()
            .from(feishuIdentities)
            .get();

        expect(identity?.openId).toBe(
          "open-refreshed",
        );
      },
    );

    it(
      "已有启用账号按飞书邮箱完成首次绑定",
      async () => {
        await database
          .insert(users)
          .values({
            id: "existing-user",
            email:
              "existing@example.com",
            name: "已有员工",
            passwordHash: "not-used",
            isActive: true,
          });

        const result = resolve({
          unionId: "union-existing",
          openId: "open-existing",
          email:
            "EXISTING@EXAMPLE.COM",
          name: "飞书姓名",
        });

        expect(result).toEqual({
          id: "existing-user",
          email:
            "existing@example.com",
          name: "已有员工",
        });

        const identity =
          database
            .select()
            .from(feishuIdentities)
            .where(
              eq(
                feishuIdentities.userId,
                "existing-user",
              ),
            )
            .get();

        expect(identity).toMatchObject({
          unionId: "union-existing",
          openId: "open-existing",
        });

        expect(
          database
            .select()
            .from(users)
            .all(),
        ).toHaveLength(1);
      },
    );

    it(
      "已禁用本地账号不能通过飞书重新激活",
      async () => {
        await database
          .insert(users)
          .values({
            id: "disabled-user",
            email:
              "disabled@example.com",
            name: "已禁用员工",
            passwordHash: "not-used",
            isActive: false,
          });

        const result = resolve({
          unionId: "union-disabled",
          email:
            "disabled@example.com",
        });

        expect(result).toBeNull();

        expect(
          database
            .select()
            .from(feishuIdentities)
            .all(),
        ).toHaveLength(0);

        expect(
          database
            .select()
            .from(users)
            .all(),
        ).toHaveLength(1);
      },
    );

    it(
      "已有其他飞书身份的账号不能被重新抢绑",
      async () => {
        await database
          .insert(users)
          .values({
            id: "bound-user",
            email:
              "bound@example.com",
            name: "已绑定员工",
            passwordHash: "not-used",
            isActive: true,
          });

        await database
          .insert(feishuIdentities)
          .values({
            id: "identity-existing",
            userId: "bound-user",
            unionId: "union-original",
            openId: "open-original",
          });

        const result = resolve({
          unionId: "union-other",
          openId: "open-other",
          email:
            "bound@example.com",
        });

        expect(result).toBeNull();

        expect(
          database
            .select()
            .from(feishuIdentities)
            .all(),
        ).toHaveLength(1);

        expect(
          database
            .select()
            .from(users)
            .all(),
        ).toHaveLength(1);
      },
    );
  },
);

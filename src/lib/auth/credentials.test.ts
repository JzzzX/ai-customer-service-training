import { hash } from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import { authenticateCredentials } from "./credentials";
import type { StoredUserAccount } from "./credentials";

async function account(
  overrides: Partial<StoredUserAccount> = {},
): Promise<StoredUserAccount> {
  return {
    id: "78c9efc2-2e1f-47a2-9dcc-1d7ce588de53",
    email: "admin@example.test",
    name: "培训管理员",
    passwordHash: await hash("correct-password", 4),
    role: "admin",
    isActive: true,
    ...overrides,
  };
}

describe("authenticateCredentials", () => {
  it("normalizes email and returns only session-safe user fields", async () => {
    const stored = await account();
    const findByEmail = vi.fn(async () => stored);

    const result = await authenticateCredentials(
      {
        email: "  ADMIN@EXAMPLE.TEST ",
        password: "correct-password",
      },
      findByEmail,
    );

    expect(findByEmail).toHaveBeenCalledWith("admin@example.test");
    expect(result).toEqual({
      id: stored.id,
      email: stored.email,
      name: stored.name,
      role: stored.role,
    });
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("rejects invalid passwords and inactive accounts", async () => {
    const active = await account();
    const inactive = await account({ isActive: false });

    await expect(
      authenticateCredentials(
        { email: active.email, password: "wrong-password" },
        async () => active,
      ),
    ).resolves.toBeNull();
    await expect(
      authenticateCredentials(
        { email: inactive.email, password: "correct-password" },
        async () => inactive,
      ),
    ).resolves.toBeNull();
  });

  it("rejects malformed credentials without querying the database", async () => {
    const findByEmail = vi.fn();

    await expect(
      authenticateCredentials({ email: "", password: "" }, findByEmail),
    ).resolves.toBeNull();
    await expect(
      authenticateCredentials(
        { email: "admin@example.test" },
        findByEmail,
      ),
    ).resolves.toBeNull();

    expect(findByEmail).not.toHaveBeenCalled();
  });
});

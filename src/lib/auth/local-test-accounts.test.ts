import { describe, expect, it } from "vitest";

import { authenticateCredentials } from "./credentials";
import {
  findLocalTestUserByEmail,
  shouldUseLocalTestAccounts,
} from "./local-test-accounts";

const environment = {
  LOCAL_TEST_AUTH_ENABLED: "true",
  SEED_ADMIN_EMAIL: "admin@example.test",
  SEED_ADMIN_NAME: "培训管理员",
  SEED_ADMIN_PASSWORD: "admin-password",
  SEED_LEARNER_EMAIL: "learner@example.test",
  SEED_LEARNER_NAME: "客服学员",
  SEED_LEARNER_PASSWORD: "learner-password",
};

describe("local test accounts", () => {
  it("requires an explicit flag, a non-production environment and no database", () => {
    expect(shouldUseLocalTestAccounts(environment, "development")).toBe(true);
    expect(
      shouldUseLocalTestAccounts(
        { ...environment, LOCAL_TEST_AUTH_ENABLED: "false" },
        "development",
      ),
    ).toBe(false);
    expect(shouldUseLocalTestAccounts(environment, "production")).toBe(false);
    expect(
      shouldUseLocalTestAccounts(
        {
          ...environment,
          DATABASE_URL: "postgresql://configured",
        },
        "development",
      ),
    ).toBe(false);
  });

  it("creates password-hashed admin and learner accounts from local env", async () => {
    const learner = await findLocalTestUserByEmail(
      "LEARNER@EXAMPLE.TEST",
      environment,
      "development",
    );

    expect(learner).toMatchObject({
      email: "learner@example.test",
      name: "客服学员",
      role: "learner",
      isActive: true,
    });
    expect(learner?.passwordHash).not.toBe("learner-password");
    await expect(
      authenticateCredentials(
        {
          email: "learner@example.test",
          password: "learner-password",
        },
        (email) =>
          findLocalTestUserByEmail(email, environment, "development"),
      ),
    ).resolves.toMatchObject({ role: "learner" });
  });

  it("never returns local accounts in production", async () => {
    await expect(
      findLocalTestUserByEmail(
        "admin@example.test",
        environment,
        "production",
      ),
    ).resolves.toBeNull();
  });

  it("fails clearly when local test account configuration is incomplete", async () => {
    await expect(
      findLocalTestUserByEmail(
        "learner@example.test",
        { ...environment, SEED_LEARNER_PASSWORD: "" },
        "development",
      ),
    ).rejects.toThrow("本地测试账号配置不完整");
  });
});

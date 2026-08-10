import { describe, expect, it } from "vitest";

import { readSeedAccounts } from "./seed-config";

describe("readSeedAccounts", () => {
  it("requires both test passwords instead of committing defaults", () => {
    expect(() =>
      readSeedAccounts({
        SEED_ADMIN_EMAIL: "admin@example.test",
        SEED_ADMIN_NAME: "培训管理员",
        SEED_LEARNER_EMAIL: "learner@example.test",
        SEED_LEARNER_NAME: "客服学员",
      }),
    ).toThrow("SEED_ADMIN_PASSWORD");
  });

  it("returns normalized admin and learner accounts", () => {
    expect(
      readSeedAccounts({
        SEED_ADMIN_EMAIL: " ADMIN@EXAMPLE.TEST ",
        SEED_ADMIN_NAME: "培训管理员",
        SEED_ADMIN_PASSWORD: "admin-password",
        SEED_LEARNER_EMAIL: " learner@example.test ",
        SEED_LEARNER_NAME: "客服学员",
        SEED_LEARNER_PASSWORD: "learner-password",
      }),
    ).toEqual([
      {
        email: "admin@example.test",
        name: "培训管理员",
        password: "admin-password",
        role: "admin",
      },
      {
        email: "learner@example.test",
        name: "客服学员",
        password: "learner-password",
        role: "learner",
      },
    ]);
  });
});

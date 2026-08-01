import { expect, test, type Page } from "@playwright/test";

const learnerEmail = requiredEnvironment("SEED_LEARNER_EMAIL");
const learnerPassword = requiredEnvironment("SEED_LEARNER_PASSWORD");

test("runs a complete mock scenario and restores it after refresh", async ({
  page,
}) => {
  test.skip(
    process.env.SCENARIO_AI_MODE !== "mock",
    "the deterministic scenario smoke test requires SCENARIO_AI_MODE=mock",
  );
  await login(page);
  await page.goto("/practice/scenario");

  const startLinks = page.getByRole("link", { name: "开始训练" });
  await expect(startLinks).toHaveCount(8);
  await startLinks.first().click();
  await page.getByRole("button", { name: "开始模拟接待" }).click();
  await expect(page).toHaveURL(/\/practice\/scenario\/session\//);

  await page.getByLabel("回复顾客").fill("您好，我先了解宠物的年龄、体重和当前饮食。");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("第 1 / 12 轮")).toBeVisible();

  await page.reload();
  await expect(page.getByText("第 1 / 12 轮")).toBeVisible();
  await page.getByRole("button", { name: "结束并查看报告" }).click();

  await expect(page).toHaveURL(/\/practice\/scenario\/report\/.*streaming=1/);
  await expect(
    page.getByRole("heading", { name: /本次训练通过|本次需要重练/ }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("演示评分")).toBeVisible();
});

test("keeps the scenario list and chat usable at 390px", async ({ page }) => {
  test.skip(
    process.env.SCENARIO_AI_MODE !== "mock",
    "the deterministic responsive smoke test requires SCENARIO_AI_MODE=mock",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/practice/scenario");
  await expect(page.getByRole("link", { name: "开始训练" })).toHaveCount(8);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "开始训练" }).first().click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "开始模拟接待" }).click();
  await page.getByLabel("回复顾客").fill("您好，我先了解宠物的年龄和体重。");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("第 1 / 12 轮")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("runs three context-dependent turns against the live AI provider", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_LIVE_AI_SMOKE !== "true",
    "set RUN_LIVE_AI_SMOKE=true to run the production AI smoke test",
  );
  test.setTimeout(180_000);

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await login(page);
  await page.goto("/practice/scenario");
  await page.getByRole("link", { name: "开始训练" }).first().click();
  await page.getByRole("button", { name: "开始模拟接待" }).click();

  const turns = [
    "您好，我先了解一下宠物的年龄、体重和目前吃的粮。",
    "明白了，结合它的情况，您最关注适口性、营养还是预算？",
    "我会根据这些信息给出合适建议，也说明换粮和后续跟进方式。",
  ];
  for (const [index, message] of turns.entries()) {
    await page.getByLabel("回复顾客").fill(message);
    await page.getByRole("button", { name: "发送" }).click();
    await waitForTurn(page, index + 1);
  }

  await page.reload();
  await expect(page.getByText("第 3 / 12 轮")).toBeVisible();
  await page.getByRole("button", { name: "结束并查看报告" }).click();
  await expect(page).toHaveURL(/\/practice\/scenario\/report\/.*streaming=1/);
  await expect(
    page.getByRole("heading", { name: /本次训练通过|本次需要重练/ }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("AI 评分")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "学员" }).click();
  await page.getByLabel("邮箱").fill(learnerEmail);
  await page.getByLabel("密码").fill(learnerPassword);
  await page.getByRole("button", { name: "登录并继续" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function waitForTurn(page: Page, turn: number) {
  const progress = page.getByText(`第 ${turn} / 12 轮`);
  const alert = page.getByRole("alert");
  await expect
    .poll(
      async () => {
        if (await progress.isVisible()) return "complete";
        if (await alert.isVisible()) {
          return `error: ${(await alert.textContent())?.trim() ?? "unknown"}`;
        }
        return "pending";
      },
      { timeout: 60_000, intervals: [500, 1_000, 2_000] },
    )
    .toBe("complete");
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Playwright E2E.`);
  }
  return value;
}

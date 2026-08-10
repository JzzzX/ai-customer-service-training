import { expect, test, type Page } from "@playwright/test";

const learner = {
  email: process.env.E2E_LEARNER_EMAIL ?? "learner.one@example.test",
  password: process.env.E2E_LEARNER_PASSWORD ?? "learner-pass-1",
};
const disabledLearner = {
  email: process.env.E2E_DISABLED_LEARNER_EMAIL ?? "disabled@example.test",
  password: process.env.E2E_DISABLED_LEARNER_PASSWORD ?? "learner-pass-3",
};

test("learner completes quiz and keeps personal history private", async ({
  page,
  browser,
}) => {
  await login(page, learner);
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole("heading", { name: /你好，/ })).toBeVisible();

  await page.goto(`/practice/quiz?topic=${encodeURIComponent("产品属性及卖点")}`);
  for (let question = 0; question < 10; question += 1) {
    await page.locator("fieldset label").first().click();
    await page.getByRole("button", { name: "提交答案" }).click();
    await expect(page.getByText(/回答正确|回答错误/)).toBeVisible();
    await page.getByRole("button", {
      name: question === 9 ? "查看结果" : "下一题",
    }).click();
  }

  await page.goto("/practice/profile?tab=quiz");
  await expect(page.getByText("最近练习")).toBeVisible();

  const secondContext = await browser.newContext();
  const secondLearner = await secondContext.newPage();
  await login(secondLearner, {
    email: process.env.E2E_SECOND_LEARNER_EMAIL ?? "learner.two@example.test",
    password: process.env.E2E_SECOND_LEARNER_PASSWORD ?? "learner-pass-2",
  });
  await secondLearner.goto("/practice/profile?tab=quiz");
  await expect(secondLearner.getByText("还没有练习记录")).toBeVisible();
  await secondContext.close();
});

test("disabled account is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(disabledLearner.email);
  await page.getByLabel("密码").fill(disabledLearner.password);
  await page.getByRole("button", { name: "登录并继续" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("mock scenario restores three turns after refresh and generates report", async ({
  page,
}) => {
  test.skip(
    process.env.SCENARIO_AI_MODE !== "mock",
    "requires deterministic Mock AI",
  );
  await login(page, learner);
  await page.goto("/practice/scenario");
  await page.getByRole("link", { name: "开始训练" }).first().click();
  await page.getByRole("button", { name: "开始模拟接待" }).click();

  for (let turn = 1; turn <= 3; turn += 1) {
    await page.getByLabel("回复顾客").fill(`第 ${turn} 轮：先确认宠物信息，再说明处理方案。`);
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText(`第 ${turn} / 12 轮`)).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText("第 3 / 12 轮")).toBeVisible();
  await page.getByRole("button", { name: "结束并查看报告" }).click();
  await expect(page.getByText("报告已生成")).toBeVisible();
  await page.getByRole("button", { name: "查看训练报告" }).click();
  await expect(page).toHaveURL(/\/practice\/scenario\/report\//);
  await expect(page.getByRole("heading", { name: /本次(训练通过|需要重练)/ })).toBeVisible();
});

async function login(page: Page, account: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(account.email);
  await page.getByLabel("密码").fill(account.password);
  await page.getByRole("button", { name: "登录并继续" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

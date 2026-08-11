import { expect, test } from "@playwright/test";

test("demo mode enters the learner flow without an account and supports quiz and mock scenario", async ({
  page,
}) => {
  test.skip(
    process.env.DEMO_MODE !== "true",
    "demo-mode E2E requires DEMO_MODE=true",
  );

  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "直接进入演示" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "直接进入演示" }).click();
  await page.waitForURL(/\/practice$/);
  await expect(
    page.getByRole("heading", { name: "你好，演示学员" }),
  ).toBeVisible();

  await page.goto("/practice/quiz");
  await expect(page.getByText("交互演示题")).toBeVisible();

  await page.goto("/practice/scenario");
  await expect(page.getByRole("link", { name: "开始训练" })).toHaveCount(1);
  await page.getByRole("link", { name: "开始训练" }).click();
  await page.getByRole("button", { name: "开始模拟接待" }).click();
  await page.getByLabel("回复顾客").fill("您好，我先了解宠物的年龄和当前饮食。");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("第 1 / 12 轮")).toBeVisible();
  await page.getByRole("button", { name: "结束并查看报告" }).click();
  await expect(page.getByText("报告已生成")).toBeVisible({ timeout: 30_000 });
});

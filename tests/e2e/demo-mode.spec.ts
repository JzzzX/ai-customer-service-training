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
  await expect(page.getByRole("link", { name: "开始训练" })).toHaveCount(2);
  const catScenarioCard = page
    .getByText("6 个月肠胃敏感英短选粮")
    .locator("..");
  await catScenarioCard.getByRole("link", { name: "开始训练" }).click();
  await expect(
    page.getByRole("heading", { name: "6 个月肠胃敏感英短选粮" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "开始模拟接待" }).click();
  for (let turn = 1; turn <= 3; turn += 1) {
    await page
      .getByLabel("回复顾客")
      .fill(`第 ${turn} 轮：先确认宠物信息，再说明处理方案。`);
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText(`第 ${turn} / 12 轮`)).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText("第 3 / 12 轮")).toBeVisible();
  await page.getByRole("button", { name: "结束并查看报告" }).click();
  await expect(page.getByText("报告已生成")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "查看训练报告" }).click();
  await expect(page).toHaveURL(/\/practice\/scenario\/report\//);
});

import { expect, test } from "@playwright/test";

test("Phase 4 completes a recoverable multi-turn scenario and history timeline", async ({
  page,
}) => {
  const login = await page.request.post("/api/v1/auth/test-login");
  expect(login.status()).toBe(204);

  await page.goto("/practice/scenario");
  await expect(page.getByRole("heading", { name: "选择实战场景" })).toBeVisible();
  const scenarioCard = page
    .locator(".scenario-card")
    .filter({ hasText: "物流长时间未更新" });
  await scenarioCard.getByRole("link", { name: "开始训练" }).click();

  await expect(page.getByRole("heading", { name: "物流长时间未更新" })).toBeVisible();
  const sessionUrl = page.url();
  const sessionId = sessionUrl.split("/").pop();
  const textarea = page.getByLabel("回复顾客");
  await textarea.fill("我先确认订单号和物流节点，我保证今天到。");
  await page.getByRole("button", { name: "发送回复" }).click();
  await expect(page.getByText("风险提示：虚构物流时效")).toBeVisible();

  await page.reload();
  await expect(page.locator(".scenario-message")).toHaveCount(3);
  await textarea.fill("我会联系快递核实并创建工单，说明预计反馈节点。");
  await page.getByRole("button", { name: "发送回复" }).click();
  await textarea.fill("我确认后续跟进并回复你。");
  await page.getByRole("button", { name: "发送回复" }).click();

  await page.getByRole("button", { name: "完成本次训练并生成报告" }).click();
  await expect(page.getByRole("heading", { name: "训练报告" })).toBeVisible();
  await expect(page.getByText(/分/).first()).toBeVisible();

  const retry = await page.request.post(
    `/api/v1/scenario-sessions/${sessionId}/report/retry`,
  );
  expect(retry.ok()).toBe(true);
  expect((await retry.json()).status).toBe("completed");

  await page.goto("/practice/scenario/history");
  await expect(page.getByRole("heading", { name: "实战历史" })).toBeVisible();
  await page.getByRole("button", { name: "已完成" }).click();
  await expect(page.getByText("物流长时间未更新")).toBeVisible();
  await page.locator("summary").first().click();
  await expect(page.getByText("查看报告").first()).toBeVisible();
});

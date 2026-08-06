import { expect, test } from "@playwright/test";

test("Vue health page reaches the FastAPI service", async ({ page }) => {
  await page.goto("/migration/health");

  await expect(page.getByRole("heading", { name: "系统状态" })).toBeVisible();
  await expect(page.getByText("FastAPI 连接正常")).toBeVisible();
  await expect(
    page.getByText(/ai-customer-service-training-api/),
  ).toBeVisible();
});

test("published quiz catalog renders the seeded phase 3 topic", async ({ page }) => {
  await page.goto("/practice/quiz/topics");

  await expect(page.getByRole("heading", { name: "专题练习" })).toBeVisible();
  await expect(page.getByText("E2E 退换货专题")).toBeVisible();
});

test("completes a server-scored phase 3 quiz and retains coverage after reload", async ({
  page,
}) => {
  const login = await page.request.post("/api/v1/auth/test-login");
  expect(login.status()).toBe(204);
  await page.goto("/practice/quiz/topics");
  await page.getByRole("link", { name: "进入专题" }).click();

  await expect(
    page.getByRole("heading", { name: "E2E 退换货专题" }),
  ).toBeVisible();
  const questions = page.locator("fieldset");
  await expect(questions).toHaveCount(10);
  for (let index = 0; index < 10; index += 1) {
    await questions.nth(index).locator("input").first().check();
  }
  await page.getByRole("button", { name: "提交答案" }).click();

  await expect(page.getByText("100 分")).toBeVisible();
  await expect(page.getByText("回答正确")).toHaveCount(10);
  await page.reload();
  await page.goto("/profile");
  await expect(page.getByText("10 / 10 题")).toBeVisible();
  const progress = await page.request.get("/api/v1/me/quiz-progress");
  expect(progress.ok()).toBe(true);
  expect((await progress.json()).unique_answered_count).toBe(10);
});

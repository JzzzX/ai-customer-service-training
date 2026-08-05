import { expect, test } from "@playwright/test";

test("Vue health page reaches the FastAPI service", async ({ page }) => {
  await page.goto("/migration/health");

  await expect(page.getByRole("heading", { name: "系统状态" })).toBeVisible();
  await expect(page.getByText("FastAPI 连接正常")).toBeVisible();
  await expect(
    page.getByText(/ai-customer-service-training-api/),
  ).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("learner cannot enter the administrator console", async ({ page }) => {
  const login = await page.request.post("/api/v1/auth/test-login");
  expect(login.status()).toBe(204);

  await page.goto("/admin/knowledge");

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "个人中心" })).toBeVisible();
});

test("administrator manages resources, reviews a report, and sees audit history", async ({
  page,
}) => {
  const login = await page.request.post("/api/v1/auth/test-login?role=admin");
  expect(login.status()).toBe(204);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "管理员控制台" })).toBeVisible();
  await expect(page.getByRole("link", { name: "知识版本" })).toBeVisible();

  await page.goto("/admin/knowledge");
  await expect(page.getByRole("heading", { name: "知识版本" })).toBeVisible();
  await expect(page.getByText("E2E 正式知识库")).toBeVisible();

  await page.goto("/admin/reviews");
  await expect(page.getByRole("cell", { name: "端到端学员" }).first()).toBeVisible();
  await page.getByRole("button", { name: "通过复核" }).first().click();

  await page.goto("/admin/history");
  await expect(page.getByText("review_decision")).toBeVisible();
});

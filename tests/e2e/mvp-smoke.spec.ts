import { expect, test, type Page } from "@playwright/test";

const learnerEmail = requiredEnvironment("SEED_LEARNER_EMAIL");
const learnerPassword = requiredEnvironment("SEED_LEARNER_PASSWORD");
const adminEmail = requiredEnvironment("SEED_ADMIN_EMAIL");
const adminPassword = requiredEnvironment("SEED_ADMIN_PASSWORD");

async function login(page: Page, input: {
  email: string;
  password: string;
  role: "learner" | "admin";
}) {
  await page.goto("/login");
  if (input.role === "admin") {
    await page.getByRole("button", { name: "管理员" }).click();
  }
  await page.getByLabel("邮箱").fill(input.email);
  await page.getByLabel("密码").fill(input.password);
  await page.getByRole("button", { name: "登录并继续" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("protects routes and sends a learner to the training center", async ({
  page,
}) => {
  await page.goto("/practice");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);

  await login(page, {
    email: learnerEmail,
    password: learnerPassword,
    role: "learner",
  });

  await expect(page).toHaveURL(/\/practice$/);
  await expect(
    page.getByRole("heading", { name: /你好，/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "知识小测" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "情景实战" })).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/forbidden$/);
});

test("sends an administrator to the management console", async ({ page }) => {
  await login(page, {
    email: adminEmail,
    password: adminPassword,
    role: "admin",
  });

  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "管理员控制台" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "开始审题" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看场景" })).toBeVisible();
});

test("completes a topic practice and keeps it in learner history", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await login(page, {
    email: learnerEmail,
    password: learnerPassword,
    role: "learner",
  });
  await page.goto(
    `/practice/quiz?topic=${encodeURIComponent("产品属性及卖点")}`,
  );

  for (let index = 0; index < 10; index += 1) {
    await page.locator("fieldset label").first().click();
    await page.getByRole("button", { name: "提交答案" }).click();
    await expect(page.getByText(/回答正确|回答错误/)).toBeVisible();
    await page
      .getByRole("button", {
        name: index === 9 ? "查看结果" : "下一题",
      })
      .click();
  }

  await expect(
    page.getByRole("heading", {
      name: /这组顺利通过|这组需要再练一次/,
    }),
  ).toBeVisible();
  await page.goto("/practice/history");
  await expect(page.getByText("产品属性及卖点").first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("keeps the login and topic selection usable at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");

  await expect(page.getByRole("button", { name: "学员" })).toBeVisible();
  await expect(page.getByRole("button", { name: "管理员" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await login(page, {
    email: learnerEmail,
    password: learnerPassword,
    role: "learner",
  });
  await page.goto("/practice/quiz/topics");
  await expect(page.getByRole("link", { name: /开始练习/ })).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Playwright E2E.`);
  }
  return value;
}

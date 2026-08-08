import { test, expect } from "@playwright/test";

test.describe("auth", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/VayuGuard/i).first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("login form has password field and submit", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in|log in|login/i }),
    ).toBeVisible();
  });
});

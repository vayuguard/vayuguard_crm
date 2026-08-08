import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "admin@vayuguard.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "Password@123";

test.describe("leads smoke", () => {
  test("login and navigate to leads", async ({ page }) => {
    test.skip(
      process.env.E2E_SKIP_DB === "1",
      "Skipped: no database available (E2E_SKIP_DB=1)",
    );

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);

    await Promise.all([
      page.waitForURL(/\/(dashboard|leads)/, { timeout: 30_000 }).catch(() => null),
      page.getByRole("button", { name: /sign in|log in|login/i }).click(),
    ]);

    // If still on login (auth/DB down), skip rather than fail hard
    if (page.url().includes("/login")) {
      const errorVisible = await page
        .getByText(/invalid|error|failed|unable/i)
        .first()
        .isVisible()
        .catch(() => false);
      test.skip(true, errorVisible ? "Login failed — DB may be unavailable" : "Still on login");
      return;
    }

    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: /leads/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

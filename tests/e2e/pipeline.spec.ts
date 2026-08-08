import { test, expect } from "@playwright/test";

test.describe("pipeline", () => {
  test("pipeline page requires auth or loads board", async ({ page }) => {
    await page.goto("/pipeline");
    const url = page.url();
    if (url.includes("/login")) {
      await expect(page.getByLabel(/email/i)).toBeVisible();
      return;
    }
    await expect(page.getByText(/pipeline|forecast|deal/i).first()).toBeVisible({
      timeout: 15000,
    });
  });
});

import { expect, test } from "@playwright/test";

test.describe("Parliament Pulse smoke", () => {
  test("loads the overview page with brand and version chip", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Parliament Pulse/);
    await expect(page.getByText("Parliament Pulse").first()).toBeVisible();
    // Version chip is rendered by DemoBanner (vX.Y.Z · sha)
    await expect(page.locator('a[title*="Deployed build"]')).toBeVisible();
  });

  test("primary nav surfaces are reachable", async ({ page }) => {
    await page.goto("/");
    for (const label of ["Overview", "Live parliament", "Attention radar", "Briefings", "Bills intelligence", "Watchlists", "Sources", "Status", "Archive"]) {
      await expect(page.getByRole("button", { name: label, exact: false }).first()).toBeVisible();
    }
  });

  test("status page reports proxy and connector health blocks", async ({ page }) => {
    await page.goto("/?page=status");
    await expect(page.getByRole("heading", { name: "Service status" })).toBeVisible();
    await expect(page.getByText(/proxy worker/i)).toBeVisible();
    await expect(page.getByText(/APH connector health/i)).toBeVisible();
  });

  test("archive filters render even without backend", async ({ page }) => {
    await page.goto("/?page=archive");
    await expect(page.getByRole("heading", { name: "Archive" })).toBeVisible();
    await expect(page.getByText(/Filters/)).toBeVisible();
  });

  test("theme toggle flips data-theme attribute", async ({ page }) => {
    await page.goto("/");
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await page.getByRole("button", { name: /Current theme/ }).first().click();
    const next = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(next).not.toEqual(initialTheme);
  });
});

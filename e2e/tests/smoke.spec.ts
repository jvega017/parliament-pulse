import { expect, test } from "@playwright/test";

test.describe("Parliament Pulse smoke", () => {
  test("loads the overview page with brand and version chip", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Parliament Pulse/);
    await expect(page.getByText("Parliament Pulse").first()).toBeVisible();
    // Version chip is rendered by DemoBanner (vX.Y.Z · sha)
    await expect(page.locator('[title*="Deployed build"]')).toBeVisible();
  });

  test("primary nav surfaces are reachable", async ({ page }) => {
    await page.goto("/");
    for (const label of ["Overview", "Live parliament", "Attention radar", "Briefings", "Today in chamber", "Committees", "Bills Digests", "QON patterns", "Archive", "Alert rules", "Watchlists", "Sources", "Status"]) {
      await expect(page.getByRole("button", { name: label, exact: false }).first()).toBeVisible();
    }
  });

  test("status page reports proxy and connector health blocks", async ({ page }) => {
    await page.goto("/?page=status");
    await expect(page.getByRole("heading", { name: "Service status" })).toBeVisible();
    await expect(page.getByText(/proxy worker/i)).toBeVisible();
    await expect(page.getByText(/APH connector health/i)).toBeVisible();
  });

  test("status page shows scoring engine and D1 migration stat", async ({ page }) => {
    await page.goto("/?page=status");
    await expect(page.getByText(/scoring engine/i)).toBeVisible();
    await expect(page.getByText(/D1 migrations/i)).toBeVisible();
  });

  test("archive filters render even without backend", async ({ page }) => {
    await page.goto("/?page=archive");
    await expect(page.getByRole("heading", { name: "Archive" })).toBeVisible();
    await expect(page.getByText(/Filters/)).toBeVisible();
  });

  test("archive save-search inline form opens on button click", async ({ page }) => {
    await page.goto("/?page=archive");
    await page.getByRole("button", { name: /Save search/i }).click();
    await expect(page.getByPlaceholder(/AI governance/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Save$/ })).toBeVisible();
    // Cancel closes the form
    await page.getByRole("button", { name: /Cancel/ }).click();
    await expect(page.getByPlaceholder(/AI governance/i)).not.toBeVisible();
  });

  test("bills page renders both panels", async ({ page }) => {
    await page.goto("/?page=bills");
    await expect(page.getByRole("heading", { name: "Bills Digests" })).toBeVisible();
    await expect(page.getByText(/Bills Digests/i).first()).toBeVisible();
    await expect(page.getByText(/Archive — all Bills Digests/i)).toBeVisible();
  });

  test("QON patterns page renders with search and chamber filter", async ({ page }) => {
    await page.goto("/?page=patterns");
    await expect(page.getByRole("heading", { name: "QON pattern engine" })).toBeVisible();
    await expect(page.getByPlaceholder(/Search member, topic/i)).toBeVisible();
    await expect(page.getByRole("combobox", { name: /Filter by chamber/i })).toBeVisible();
  });

  test("alerts page renders rules panel and create-rule form", async ({ page }) => {
    await page.goto("/?page=alerts");
    await expect(page.getByRole("heading", { name: "Alert rules" })).toBeVisible();
    await expect(page.getByText(/Rules/)).toBeVisible();
    await page.getByRole("button", { name: /New rule/i }).click();
    await expect(page.getByPlaceholder(/AI governance/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Create rule/ })).toBeVisible();
  });

  test("theme toggle flips data-theme attribute", async ({ page }) => {
    await page.goto("/");
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await page.getByRole("button", { name: /Current theme/ }).first().click();
    const next = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(next).not.toEqual(initialTheme);
  });
});

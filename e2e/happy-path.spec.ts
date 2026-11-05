import { expect, test } from "@playwright/test";

/**
 * Demo-mode happy path (no Supabase keys): landing → analyze with quick numbers → Scout's first
 * analysis is fully unlocked → saving an offer asks for a plan → upgrade (demo) → offer saved →
 * deal shows in the pipeline → second Scout-style lock is gone. Numbers are typed, so the result
 * doesn't depend on any AI read.
 */
test("analyze, upgrade, offer, pipeline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Underwrite any deal");

  await page.goto("/app");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Analyze a deal");
  await page.locator("summary", { hasText: "Quick numbers" }).click();
  await page.locator("#q-name").fill("12 Oak St");
  await page.locator("#q-city").fill("Memphis");
  await page.locator("#q-state").fill("TN");
  await page.locator("#q-list").fill("120000");
  await page.locator("#q-rentMonthly").fill("1650");
  await page.locator("#q-arv").fill("210000");
  await page.locator("#q-rehab").fill("35000");
  await page.getByRole("button", { name: /Analyze deal/ }).click();

  await page.waitForURL(/\/app\/analyses\//, { timeout: 120_000 });
  await expect(page.getByText("Your first analysis is on us")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exit Strategy Matrix" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Offer Ladder" })).toBeVisible();

  // Saving an offer is a paid feature: the plan picker opens with the trial.
  await page.getByRole("button", { name: "Save offer" }).click();
  await expect(page.getByText("Upgrade UndrIq")).toBeVisible();
  await page.getByRole("button", { name: /Start 7-day free trial/ }).first().click();
  await expect(page.getByText(/Investor unlocked/)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Save offer" }).click();
  await expect(page.getByRole("heading", { name: "Offer history" })).toBeVisible();

  await page.goto("/app/pipeline");
  await expect(page.locator("section[aria-label='Offer sent'] article")).toContainText("12 Oak St");
});

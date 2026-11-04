import { expect, test } from "@playwright/test";

/**
 * Happy path in demo mode (no Supabase/Stripe keys): free user sees locks,
 * the contract gate blocks Under contract, upgrading unlocks the live panel,
 * and San Antonio shows 1.35x DSCR at $715K / 30% / 7.5% / 20 yr.
 */
const SA = "/app/deals/5a000000-0000-4000-8000-000000000001";

test("landing → pipeline → underwriting", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Underwrite a storage deal");

  // Pro API routes refuse a free org.
  expect((await request.get("/api/export/deals")).status()).toBe(402);

  await page.goto("/app");
  await expect(page.getByText("West San Antonio Storage").first()).toBeVisible();

  // Contract gate
  await page.goto(SA);
  await page.selectOption("#stage", "under_contract");
  await expect(page.getByText("Record the contract")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("#stage")).toHaveValue("negotiating");

  // Upgrade (demo checkout) and check the signature numbers
  await page.goto(`${SA}?tab=underwriting`);
  await page.getByRole("button", { name: "Unlock for $49/month" }).first().click();
  await page.getByRole("button", { name: /Upgrade for \$49/ }).click();
  await expect(page.getByText("1.35x")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("$715,000").first()).toBeVisible();
  await expect(page.getByText("9.11%").first()).toBeVisible();

  // OM stays locked server-side while Negotiating
  const om = await request.post(`/api/deals/5a000000-0000-4000-8000-000000000001/generate`, { data: { kind: "om" } });
  expect(om.status()).toBe(403);
});

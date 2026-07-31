import { expect, type Page } from "@playwright/test";

/**
 * Sign a user in through the /auth page and wait until the authenticated
 * shell is visible.
 */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).first().fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();

  // Either dashboard or onboarding — both mean we are authenticated.
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
  await expect(page.locator("body")).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /sair|logout/i }).click();
  await page.waitForURL(/\/auth/);
}

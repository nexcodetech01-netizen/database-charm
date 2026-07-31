import type { Page } from "@playwright/test";

/** Navigate via the sidebar to a module by its visible label. */
export async function gotoModule(page: Page, label: RegExp | string) {
  await page.getByRole("navigation").getByRole("link", { name: label }).click();
}

/** Wait for TanStack Query to settle by watching the network. */
export async function waitForIdle(page: Page) {
  await page.waitForLoadState("networkidle");
}

/** Fill an input by its accessible label. */
export async function fillByLabel(page: Page, label: RegExp | string, value: string) {
  await page.getByLabel(label).fill(value);
}

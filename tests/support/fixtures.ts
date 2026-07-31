import { test as base, expect, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";

export type NexOSFixtures = {
  authedPage: Page;
};

/**
 * Base test with an authenticated page fixture.
 *
 * Requires the following env vars to actually sign in:
 *   E2E_USER_EMAIL, E2E_USER_PASSWORD
 *
 * When those env vars are missing the fixture skips the current test — this
 * allows the suite to be checked into CI without leaking credentials while
 * still running locally against a seeded Supabase project.
 */
export const test = base.extend<NexOSFixtures>({
  authedPage: async ({ page }, use) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    if (!email || !password) {
      test.skip(true, "E2E_USER_EMAIL / E2E_USER_PASSWORD not configured");
    }
    await signIn(page, email!, password!);
    await use(page);
  },
});

export { expect };

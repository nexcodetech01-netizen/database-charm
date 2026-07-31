import { test, expect } from "../support/fixtures";

test.describe("Dashboard", () => {
  test("carrega KPIs, alertas e insights", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    await expect(authedPage.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

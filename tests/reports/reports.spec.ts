import { test, expect } from "../support/fixtures";

test.describe("Relatórios", () => {
  test("carrega relatórios", async ({ authedPage }) => {
    await authedPage.goto("/relatorios");
    await expect(authedPage.getByRole("heading", { name: /relat/i })).toBeVisible();
  });

  test("aplica filtros básicos", async ({ authedPage }) => {
    await authedPage.goto("/relatorios");
    const filter = authedPage.getByRole("button", { name: /filtr/i });
    if (await filter.count()) await filter.first().click();
  });
});

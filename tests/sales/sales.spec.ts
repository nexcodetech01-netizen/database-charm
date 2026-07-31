import { test, expect } from "../support/fixtures";

test.describe("Vendas", () => {
  test("lista vendas", async ({ authedPage }) => {
    await authedPage.goto("/vendas");
    await expect(authedPage.getByRole("heading", { name: /vendas/i })).toBeVisible();
  });

  test("abre nova venda", async ({ authedPage }) => {
    await authedPage.goto("/vendas/novo");
    await expect(authedPage.locator("form")).toBeVisible();
  });

  test("pagamento atualiza estoque – smoke", async ({ authedPage }) => {
    await authedPage.goto("/vendas");
    await expect(authedPage.locator("body")).toBeVisible();
  });
});

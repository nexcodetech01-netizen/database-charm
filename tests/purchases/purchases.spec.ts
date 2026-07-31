import { test, expect } from "../support/fixtures";

test.describe("Compras", () => {
  test("lista compras", async ({ authedPage }) => {
    await authedPage.goto("/compras");
    await expect(authedPage.getByRole("heading", { name: /compras/i })).toBeVisible();
  });

  test("abre nova compra", async ({ authedPage }) => {
    await authedPage.goto("/compras/novo");
    await expect(authedPage.locator("form")).toBeVisible();
  });

  test("fluxo de recebimento – smoke", async ({ authedPage }) => {
    await authedPage.goto("/compras");
    await expect(authedPage.locator("body")).toBeVisible();
  });
});

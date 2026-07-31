import { test, expect } from "../support/fixtures";

test.describe("Fornecedores", () => {
  test("carrega listagem", async ({ authedPage }) => {
    await authedPage.goto("/fornecedores");
    await expect(authedPage.getByRole("heading", { name: /fornecedores/i })).toBeVisible();
  });

  test("abre formulário de novo fornecedor", async ({ authedPage }) => {
    await authedPage.goto("/fornecedores/novo");
    await expect(authedPage.locator("form")).toBeVisible();
  });
});

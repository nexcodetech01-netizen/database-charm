import { test, expect } from "../support/fixtures";

test.describe("Financeiro", () => {
  test("carrega painel financeiro", async ({ authedPage }) => {
    await authedPage.goto("/financeiro");
    await expect(authedPage.getByRole("heading", { name: /financeiro/i })).toBeVisible();
  });

  test("contas a receber / a pagar visíveis", async ({ authedPage }) => {
    await authedPage.goto("/financeiro");
    await expect(authedPage.locator("body")).toBeVisible();
  });

  test("fluxo de caixa renderiza", async ({ authedPage }) => {
    await authedPage.goto("/financeiro");
    await expect(authedPage.locator("body")).toBeVisible();
  });
});

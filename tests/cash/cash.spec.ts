import { test, expect } from "../support/fixtures";

test.describe("Caixa", () => {
  test("acessa a tela de fechamento de caixa", async ({ authedPage }) => {
    await authedPage.goto("/caixa");
    await expect(
      authedPage.getByRole("heading", { name: /fechamento de caixa/i }),
    ).toBeVisible();
  });
});

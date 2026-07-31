import { test, expect } from "../support/fixtures";

test.describe("Categorias", () => {
  test("carrega listagem", async ({ authedPage }) => {
    await authedPage.goto("/categorias");
    await expect(authedPage.getByRole("heading", { name: /categorias/i })).toBeVisible();
  });
});

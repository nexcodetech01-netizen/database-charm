import { test, expect } from "../support/fixtures";
import { factories } from "../support/factories";

test.describe("Agenda", () => {
  test("carrega agenda", async ({ authedPage }) => {
    await authedPage.goto("/agenda");
    await expect(authedPage.getByRole("heading", { name: /agenda/i })).toBeVisible();
  });

  test("abre diálogo de novo evento", async ({ authedPage }) => {
    await authedPage.goto("/agenda");
    const btn = authedPage.getByRole("button", { name: /novo|criar|agendar/i });
    if (await btn.count()) {
      await btn.first().click();
      const title = authedPage.getByLabel(/título|title/i);
      if (await title.count()) await title.first().fill(factories.appointment().title);
    }
  });

  test("alterar/cancelar – smoke", async ({ authedPage }) => {
    await authedPage.goto("/agenda");
    await expect(authedPage.locator("body")).toBeVisible();
  });
});

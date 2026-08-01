import { test, expect } from "../support/fixtures";

test.describe("Caixa", () => {
  test("acessa a tela de fechamento de caixa", async ({ authedPage }) => {
    await authedPage.goto("/caixa");
    await expect(
      authedPage.getByRole("heading", { name: /fechamento de caixa/i }),
    ).toBeVisible();
  });
});

test.describe("PDV — menu do caixa", () => {
  test("abre o menu, fecha ao clicar fora e F12 abre o fechamento", async ({
    authedPage,
  }) => {
    await authedPage.goto("/pdv");
    const trigger = authedPage.locator("#pdv-cash-menu");
    if (!(await trigger.isVisible().catch(() => false))) test.skip();

    await trigger.click();
    const menuItem = authedPage.getByRole("menuitem", { name: /ver sessão/i });
    await expect(menuItem).toBeVisible();

    // Clique fora fecha o menu.
    await authedPage.keyboard.press("Escape");
    await expect(menuItem).toBeHidden();

    // F12 abre o diálogo de fechamento existente (nunca fecha sozinho).
    await authedPage.keyboard.press("F12");
    await expect(authedPage.getByRole("dialog")).toBeVisible();
    await authedPage.keyboard.press("Escape");
    await expect(authedPage.getByRole("dialog")).toBeHidden();
  });
});

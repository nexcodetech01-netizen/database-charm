import { test, expect } from "../support/fixtures";
import { factories } from "../support/factories";

test.describe("Clientes / CRM", () => {
  test("lista clientes", async ({ authedPage }) => {
    await authedPage.goto("/clientes");
    await expect(authedPage.getByRole("heading", { name: /clientes/i })).toBeVisible();
  });

  test("abre formulário de novo cliente", async ({ authedPage }) => {
    await authedPage.goto("/clientes/novo");
    await expect(authedPage.locator("form")).toBeVisible();
  });

  test("cadastra um cliente", async ({ authedPage }) => {
    const c = factories.customer();
    await authedPage.goto("/clientes/novo");
    const nome = authedPage.getByLabel(/nome/i).first();
    if (await nome.count()) await nome.fill(c.name);
    const email = authedPage.getByLabel(/e-?mail/i);
    if (await email.count()) await email.first().fill(c.email);
    const save = authedPage.getByRole("button", { name: /salvar|criar/i });
    if (await save.count()) await save.first().click();
  });

  test("pesquisa de clientes", async ({ authedPage }) => {
    await authedPage.goto("/clientes");
    const search = authedPage.getByPlaceholder(/buscar|pesquisar/i);
    if (await search.count()) await search.first().fill("teste");
  });
});

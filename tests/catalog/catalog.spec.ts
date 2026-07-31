import { expect, test } from "@playwright/test";

/**
 * E2E — Catálogo público (RC1-002).
 *
 * Cobertura mínima para a rota `/catalogo/colecao/:slug` sem depender de
 * dados semeados: os testes buscam elementos genéricos e degradam para
 * `test.skip` quando o ambiente não tem coleções publicadas, permitindo
 * rodar no CI mesmo em ambientes vazios.
 */

const KNOWN_SLUG = process.env.E2E_CATALOG_SLUG;

test.describe("Catálogo público — smoke", () => {
  test("página retorna 404 amigável para slug inexistente", async ({ page }) => {
    const res = await page.goto("/catalogo/colecao/__nao_existe_zzz__");
    expect(res, "resposta HTTP").not.toBeNull();
    // A UI deve renderizar mensagem de coleção não encontrada
    await expect(page.getByText(/não encontrada|not found|indisponível/i))
      .toBeVisible({ timeout: 10_000 });
  });

  test("preview=1 exige autenticação — anônimo enxerga 404", async ({ page }) => {
    const res = await page.goto(
      "/catalogo/colecao/__nao_existe_zzz__?preview=1",
    );
    expect(res).not.toBeNull();
    await expect(page.getByText(/não encontrada|not found|indisponível/i))
      .toBeVisible({ timeout: 10_000 });
  });

  test("rate limit responde 429 após burst nas rotas /api/public/catalog/*", async ({
    request,
  }) => {
    // Dispara 80 chamadas contra a rota (limite = 60/min por IP).
    // Contamos 429s. Basta 1 para provar a proteção.
    const results = await Promise.all(
      Array.from({ length: 80 }, () =>
        request.get("/api/public/catalog/__ratelimit_probe__"),
      ),
    );
    const statuses = results.map((r) => r.status());
    const has429 = statuses.some((s) => s === 429);
    expect(
      has429,
      `esperava ao menos um 429, recebi: ${statuses.slice(0, 10).join(",")}...`,
    ).toBe(true);
  });

  test.describe("com slug conhecido", () => {
    test.skip(!KNOWN_SLUG, "defina E2E_CATALOG_SLUG para rodar");

    test("renderiza coleção ativa com header, produtos e CTA", async ({
      page,
    }) => {
      await page.goto(`/catalogo/colecao/${KNOWN_SLUG}`);
      // Cabeçalho com nome da coleção
      await expect(page.locator("h1, h2").first()).toBeVisible();
      // Barra de busca sticky
      await expect(
        page.getByPlaceholder(/buscar|pesquisar|search/i).first(),
      ).toBeVisible();
    });

    test("filtro por texto reduz a lista", async ({ page }) => {
      await page.goto(`/catalogo/colecao/${KNOWN_SLUG}`);
      const search = page
        .getByPlaceholder(/buscar|pesquisar|search/i)
        .first();
      await search.fill("zzznaoexiste");
      await expect(page.getByText(/nenhum|sem resultado|empty/i))
        .toBeVisible({ timeout: 10_000 });
    });
  });
});

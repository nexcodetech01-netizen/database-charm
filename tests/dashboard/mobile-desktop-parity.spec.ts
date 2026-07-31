import { chromium, devices, expect, test } from "@playwright/test";
import { signIn } from "../support/helpers/auth";

/**
 * Paridade mobile × desktop no Dashboard.
 *
 * Objetivo: garantir que o MESMO usuário na MESMA company enxerga os MESMOS
 * KPIs no mobile e no desktop. Caso divirja, o culpado quase sempre é cache
 * stale da PWA no mobile — o hook `useMobileDashboardRefresh` deve impedir.
 *
 * Estratégia:
 *  - Abre 2 contexts isolados (viewports desktop e mobile) contra o mesmo
 *    Supabase.
 *  - Faz login em ambos.
 *  - Extrai os valores numéricos dos KpiCards do Dashboard.
 *  - Compara os textos formatados (BRL / inteiros) — devem ser idênticos.
 */

const KPI_LABELS = [
  /vendas do dia/i,
  /transa[çc][õo]es/i,
  /caixa/i,
  /a receber/i,
];

async function readDashboardKpis(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  // Aguarda os KPIs renderizarem (título "Vendas do dia" é âncora estável).
  await expect(page.getByText(/vendas do dia/i).first()).toBeVisible({
    timeout: 20_000,
  });

  const values: Record<string, string> = {};
  for (const label of KPI_LABELS) {
    const card = page
      .locator("article, div", { hasText: label })
      .filter({ has: page.locator("[data-kpi-value], .text-2xl, .text-3xl") })
      .first();
    // Se o KPI usa uma classe utilitária de valor grande, capture-a; senão,
    // pegue o segundo texto do card (label + valor).
    const value = (await card.textContent()) ?? "";
    values[label.source] = value.replace(/\s+/g, " ").trim();
  }
  return values;
}

test.describe("Dashboard — paridade mobile × desktop", () => {
  test("mesmo usuário vê os mesmos KPIs em ambos os viewports", async () => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    test.skip(
      !email || !password,
      "E2E_USER_EMAIL / E2E_USER_PASSWORD não configurados",
    );

    const browser = await chromium.launch();
    try {
      const desktopCtx = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      const mobileCtx = await browser.newContext({
        ...devices["iPhone 13"],
      });

      const desktopPage = await desktopCtx.newPage();
      const mobilePage = await mobileCtx.newPage();

      await Promise.all([
        signIn(desktopPage, email!, password!),
        signIn(mobilePage, email!, password!),
      ]);

      const [desktopKpis, mobileKpis] = await Promise.all([
        readDashboardKpis(desktopPage),
        readDashboardKpis(mobilePage),
      ]);

      expect(mobileKpis).toEqual(desktopKpis);

      await desktopCtx.close();
      await mobileCtx.close();
    } finally {
      await browser.close();
    }
  });

  test("drawer mobile fecha ao navegar e nunca fica preso aberto", async ({
    browser,
  }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    test.skip(
      !email || !password,
      "E2E_USER_EMAIL / E2E_USER_PASSWORD não configurados",
    );

    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await ctx.newPage();
    await signIn(page, email!, password!);
    await page.goto("/dashboard");

    // Abre o drawer
    await page.getByRole("button", { name: /abrir menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    // Navega para Produtos pelo drawer
    await drawer.getByRole("link", { name: /produtos/i }).click();
    await page.waitForURL(/\/produtos/);

    // Drawer NÃO pode continuar aberto
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Reabre e clica no item da rota atual — também precisa fechar
    await page.getByRole("button", { name: /abrir menu/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /produtos/i })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await ctx.close();
  });
});

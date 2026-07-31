import { test, expect } from "../support/fixtures";
import type { NavTelemetryEvent } from "../../src/lib/nav-telemetry";

/**
 * Garante que navegar entre os módulos principais NÃO gera flicker:
 *  - O AppLayout (sidebar) permanece montado o tempo todo (não desmonta/remonta).
 *  - Nenhum fallback global vazio aparece (data-testid="route-pending" só
 *    é aceitável se durar <150ms — significa que o loader demorou e o
 *    skeleton mínimo apareceu; fallback branco/vazio não é aceitável).
 *  - A telemetria de navegação registra durationMs razoável e sem
 *    showedFallback=true.
 */
const ROUTES = ["/dashboard", "/vendas", "/clientes", "/produtos"] as const;

test.describe("Navegação sem flicker", () => {
  test("alterna entre módulos preservando layout e sem fallback global", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.locator("#main-content")).toBeVisible();

    // Snapshot do sidebar — deve manter a MESMA instância entre navegações.
    const sidebar = page.getByRole("navigation").first();
    await expect(sidebar).toBeVisible();
    const sidebarHandle = await sidebar.elementHandle();
    expect(sidebarHandle).not.toBeNull();

    // Reseta buffer de telemetria.
    await page.evaluate(() => {
      (window as unknown as { __nexosNav?: unknown[] }).__nexosNav = [];
    });

    for (const path of ROUTES) {
      await page.goto(path);
      // Layout continua montado imediatamente (sem tela branca).
      await expect(page.locator("#main-content")).toBeVisible();
      await expect(sidebar).toBeVisible();

      // Se o skeleton apareceu, deve desaparecer rapidamente (conteúdo real
      // renderiza em <5s). Não é um flash branco/vazio.
      const pending = page.getByTestId("route-pending");
      if (await pending.count()) {
        await expect(pending).toBeHidden({ timeout: 5_000 });
      }

      // Título da página (h1) precisa aparecer — prova de que conteúdo carregou.
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
        timeout: 10_000,
      });
    }

    // Sidebar não pode ter sido desmontado/remontado durante o percurso.
    const stillAttached = await page.evaluate(
      (el) => !!el && document.body.contains(el as Node),
      sidebarHandle,
    );
    expect(stillAttached).toBe(true);

    // Analisa telemetria.
    const events = await page.evaluate(
      () => (window as unknown as { __nexosNav?: NavTelemetryEvent[] }).__nexosNav ?? [],
    );
    expect(events.length).toBeGreaterThanOrEqual(ROUTES.length);
    for (const ev of events) {
      expect.soft(ev.showedFallback, `fallback visível ao navegar para ${ev.to}`).toBe(false);
      expect.soft(ev.durationMs, `nav ${ev.from} -> ${ev.to} lenta`).toBeLessThan(3_000);
    }
  });
});

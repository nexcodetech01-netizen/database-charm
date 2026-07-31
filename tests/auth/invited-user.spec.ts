import { test, expect } from "@playwright/test";

/**
 * Regressão: usuário convidado que já aceitou o convite deve cair no
 * /dashboard após login — nunca em /onboarding — mesmo em contexto
 * anônimo (sem localStorage/session prévia).
 *
 * Causa histórica: RLS de `public.companies` só libera SELECT para o
 * owner. `getCurrentUserCompany` retornava null para membros convidados
 * e o guard mandava para /onboarding. Correção: reconhecer a associação
 * via `profiles.current_company_id` / `user_roles` sem depender do SELECT
 * em `companies`.
 *
 * Requer variáveis de ambiente com credenciais de um usuário CONVIDADO
 * (não owner) já vinculado a uma empresa:
 *   E2E_INVITED_EMAIL
 *   E2E_INVITED_PASSWORD
 * Sem elas o teste é pulado — evita vazar credenciais no CI padrão.
 */
test.describe("Auth · usuário convidado", () => {
  const email = process.env.E2E_INVITED_EMAIL;
  const password = process.env.E2E_INVITED_PASSWORD;

  test.skip(
    !email || !password,
    "E2E_INVITED_EMAIL / E2E_INVITED_PASSWORD não configurados",
  );

  test("após login em aba anônima, não é redirecionado para /onboarding", async ({
    browser,
  }) => {
    // Contexto isolado = aba anônima (sem storage/cookies compartilhados).
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto("/auth");
      await page.getByLabel(/e-?mail/i).fill(email!);
      await page.getByLabel(/senha/i).first().fill(password!);
      await page.getByRole("button", { name: /entrar/i }).click();

      // Aguarda o roteador estabilizar em qualquer rota autenticada.
      await page.waitForURL(/\/(dashboard|onboarding|invite)/, {
        timeout: 20_000,
      });

      // Garante que a decisão do guard não muda em uma segunda rodada
      // (ex: race entre profile/user_roles e o beforeLoad).
      await page.waitForLoadState("networkidle");

      expect(page.url()).not.toMatch(/\/onboarding/);
      await expect(page).toHaveURL(/\/dashboard/);

      // Reload em aba anônima também deve manter a rota autenticada.
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/dashboard/);
      expect(page.url()).not.toMatch(/\/onboarding/);
    } finally {
      await context.close();
    }
  });
});

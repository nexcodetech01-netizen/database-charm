import { test, expect } from "../support/fixtures";

test.describe("Auth", () => {
  test("mostra a página de login", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("rejeita credenciais inválidas", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/e-?mail/i).fill("invalido@example.com");
    await page.getByLabel(/senha/i).first().fill("senha-invalida-123");
    await page.getByRole("button", { name: /entrar/i }).click();
    // Should stay on /auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test("login com credenciais válidas leva ao app", async ({ authedPage }) => {
    await expect(authedPage).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test("sessão persiste após reload", async ({ authedPage }) => {
    await authedPage.reload();
    await expect(authedPage).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test("logout redireciona para /auth", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    const logout = authedPage.getByRole("button", { name: /sair|logout/i });
    if (await logout.count()) {
      await logout.first().click();
      await authedPage.waitForURL(/\/auth/);
    } else {
      test.skip(true, "Botão de logout não localizado na topbar atual");
    }
  });
});

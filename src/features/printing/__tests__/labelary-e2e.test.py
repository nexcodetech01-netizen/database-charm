import { chromium, expect } from '@playwright/test';
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def test_labelary_failure_flow():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Intercepta chamadas para api.labelary.com e simula falha 500
        await page.route("https://api.labelary.com/**", lambda route: route.fulfill(
            status=500,
            body="Simulated Labelary Failure"
        ))

        # Vai para a página de teste (Dashboard onde o componente é renderizado)
        await page.goto("http://localhost:8080/dashboard", wait_until="networkidle")
        
        # Clica no botão de teste ZPL (que abre o diálogo)
        # Nota: O seletor depende de como o botão está rotulado no index.tsx ou dashboard
        await page.get_by_text("🧪 Testar Etiqueta Mercado Livre").click()
        
        # Verifica se a mensagem de erro aparece no preview
        error_msg = page.get_by_text("Preview indisponível. Impressão e download continuam disponíveis.")
        await expect(error_msg).to_be_visible()
        
        # Verifica se o botão de auditoria técnica aparece
        audit_btn = page.get_by_text("Ver Auditoria Técnica")
        await expect(audit_btn).to_be_visible()
        await audit_btn.click()
        
        # Verifica se o JSON da auditoria está visível e contém o status 500
        audit_content = page.locator("pre")
        await expect(audit_content).to_contain_text('"status": 500')
        await expect(audit_content).to_contain_text("Simulated Labelary Failure")

        await browser.close()

if __name__ == "__main__":
    import sys
    # Apenas esqueleto do teste em python para rodar no sandbox se necessário, 
    # mas o objetivo é documentar a estratégia e2e conforme solicitado.
    print("E2E Test Logic Defined for Labelary Failure Flow")

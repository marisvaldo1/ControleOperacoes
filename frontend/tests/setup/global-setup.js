// frontend/tests/setup/global-setup.js
// Setup global dos testes Playwright — verifica servidor Flask
// Não há autenticação nesta aplicação.

import { chromium } from "@playwright/test";

export default async function globalSetup() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    const baseUrl = "http://localhost:8888";
    let serverReady = false;

    for (let attempt = 1; attempt <= 10; attempt++) {
        try {
            const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 5000 });
            if (response && response.status() < 500) {
                serverReady = true;
                break;
            }
        } catch (_) {
            await page.waitForTimeout(2000);
        }
    }

    await browser.close();

    if (!serverReady) {
        console.warn("[setup] Servidor em localhost:8888 não respondeu. Testes podem falhar.");
        // Não lançar erro — permite rodar testes mesmo sem servidor (navegador mostrará erros de rede)
    } else {
        console.log("[setup] Servidor Flask em localhost:8888 está respondendo.");
    }
}

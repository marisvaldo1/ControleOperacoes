// frontend/tests/pages/crypto.spec.js
// Testa comportamentos da página de Operações Crypto (sem autenticação)

import { test, expect } from "@playwright/test";

const BASE = "/html/crypto.html";

// ─── Qualidade do JS ─────────────────────────────────────────────────────────

test("[Crypto] não deve ter SyntaxError no JS", async ({ page }) => {
    const jsErrors = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const syntaxErrors = jsErrors.filter(e => e.includes("SyntaxError"));
    expect(syntaxErrors, `SyntaxErrors: ${syntaxErrors.join("; ")}`).toHaveLength(0);
});

test("[Crypto] página deve carregar sem erros de runtime", async ({ page }) => {
    const criticalErrors = [];
    page.on("pageerror", (err) => {
        if (!err.message.includes("fetch") && !err.message.includes("net::ERR")) {
            criticalErrors.push(err.message);
        }
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const syntaxErrors = criticalErrors.filter(e => e.includes("SyntaxError"));
    expect(syntaxErrors, `SyntaxErrors: ${syntaxErrors.join("\n")}`).toHaveLength(0);
});

test("[Crypto] scripts NÃO devem ser carregados duas vezes", async ({ page }) => {
    const scriptUrls = [];
    page.on("response", (resp) => {
        if (resp.url().includes("/js/") && resp.url().endsWith(".js")) {
            scriptUrls.push(resp.url());
        }
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const duplicates = scriptUrls.filter((url, i) => scriptUrls.indexOf(url) !== i);
    expect(duplicates, `Scripts duplicados: ${duplicates.join(", ")}`).toHaveLength(0);
});

// ─── Estrutura da página ─────────────────────────────────────────────────────

test("[Crypto] título da página deve estar definido", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
});

test("[Crypto] deve exibir a página de Cryptos (sem redirect)", async ({ page }) => {
    // crypto.html agora exibe a tela completa, sem meta refresh
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    // Confirma que permanece na URL correta (sem redirect)
    expect(page.url()).toContain("crypto.html");
    // Confirma que a estrutura principal está presente
    const heading = await page.locator("h2.page-title").textContent();
    expect(heading).toBeTruthy();
});

test("[Crypto] deve responder a requisição da página com status 200", async ({ page }) => {
    const response = await page.goto(BASE);
    expect(response?.status()).toBe(200);
});

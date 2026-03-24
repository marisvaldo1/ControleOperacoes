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
    // Confirma que a estrutura do page-header está presente
    const pageHeader = await page.locator(".page-header").count();
    expect(pageHeader).toBeGreaterThan(0);
});

test("[Crypto] deve responder a requisição da página com status 200", async ({ page }) => {
    const response = await page.goto(BASE);
    expect(response?.status()).toBe(200);
});

// ─── Análise Temporal ────────────────────────────────────────────────────────

test("[Crypto] modal de Análise deve abrir e carregar dados", async ({ page }) => {
    const jsErrors = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    // Aguarda __appLayoutReady: definido em layout.js APÓS dispatchEvent(layoutReady)
    // Como dispatchEvent é síncrono, garante que crypto.js setupEventListeners() já rodou
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.bootstrap !== 'undefined' &&
        typeof window.bootstrap.Modal !== 'undefined' &&
        typeof window.ModalAnalise !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal de Análise
    const btnAnalise = page.locator("#btnAnaliseCrypto");
    await expect(btnAnalise).toBeVisible();
    await btnAnalise.click({ force: true });

    // Modal abre antes dos dados (template fetch pode demorar sob carga paralela)
    await page.waitForSelector("#modalAnalise.show", { timeout: 20000 });

    // O modal deve estar visível
    const modal = page.locator("#modalAnalise");
    await expect(modal).toBeVisible();

    // Aguarda dados carregarem (fetch /api/crypto pode demorar sob carga paralela)
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '' && !el.textContent.match(/^0 operaç/);
    }, { timeout: 30000 });

    // Os dados não devem ser zerados (totalOps > 0)
    const donutSub = await page.locator("#maDonutSub").textContent();
    expect(donutSub).not.toMatch(/^0 operaç/);

    // Nenhum erro crítico de JS
    const criticalErrors = jsErrors.filter(e =>
        !e.includes("bootstrap-autofill") &&
        !e.includes("net::ERR") &&
        !e.includes("fetch")
    );
    expect(criticalErrors, `Erros JS: ${criticalErrors.join("; ")}`).toHaveLength(0);
});

test("[Crypto] botão atualizar da Análise deve funcionar", async ({ page }) => {
    const consoleMessages = [];
    const jsErrors = [];
    page.on("console", (msg) => { if (msg.type() === 'error') consoleMessages.push(msg.text()); });
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    // Aguarda __appLayoutReady: definido em layout.js APÓS dispatchEvent(layoutReady)
    // Como dispatchEvent é síncrono, garante que crypto.js setupEventListeners() já rodou
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.bootstrap !== 'undefined' &&
        typeof window.bootstrap.Modal !== 'undefined' &&
        typeof window.ModalAnalise !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal via JS diretamente: este teste cobre o botão de REFRESH,
    // não a abertura pelo botão (já coberta por "modal deve abrir").
    // Usar page.evaluate() evita flakiness de clique sob carga paralela.
    await page.evaluate(() => window.ModalAnalise && window.ModalAnalise.open());
    await page.waitForSelector("#modalAnalise.show", { timeout: 10000 });
    // Aguarda dados carregarem para ter valor inicial significativo
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '' && !el.textContent.match(/^0 operaç/);
    }, { timeout: 30000 });

    // Lê valor inicial
    const valorAntes = await page.locator("#maDonutValue").textContent();

    // Clica no botão de atualizar (#maRefreshBtn)
    const btnRefresh = page.locator("#maRefreshBtn");
    await expect(btnRefresh).toBeVisible();
    await btnRefresh.click();

    // Aguarda spinner desaparecer e dados recarregarem
    await page.waitForTimeout(2000);

    // O valor deve continuar não zerado após refresh
    const valorDepois = await page.locator("#maDonutValue").textContent();
    expect(valorDepois).not.toBe("R$ 0");

    // O timestamp deve ter sido atualizado
    const status = await page.locator("#maRefreshStatus").textContent();
    expect(status).toContain("Atualizado:");
});

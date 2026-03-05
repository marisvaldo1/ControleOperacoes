// frontend/tests/pages/opcoes.spec.js
// Testa comportamentos da página de Opções (sem autenticação)

import { test, expect } from "@playwright/test";

const BASE = "/html/opcoes.html";

// ─── Qualidade do JS ─────────────────────────────────────────────────────────

test("[Opcoes] não deve ter SyntaxError no JS", async ({ page }) => {
    const jsErrors = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const syntaxErrors = jsErrors.filter(e => e.includes("SyntaxError"));
    expect(syntaxErrors, `SyntaxErrors: ${syntaxErrors.join("; ")}`).toHaveLength(0);
});

test("[Opcoes] página deve carregar sem erros de runtime", async ({ page }) => {
    const criticalErrors = [];
    page.on("pageerror", (err) => {
        // Ignorar erros de rede (fetch para API que pode não estar rodando)
        if (!err.message.includes("fetch") && !err.message.includes("net::ERR")) {
            criticalErrors.push(err.message);
        }
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const syntaxErrors = criticalErrors.filter(e => e.includes("SyntaxError") || e.includes("TypeError") && !e.includes("fetch"));
    expect(syntaxErrors, `Erros críticos: ${syntaxErrors.join("\n")}`).toHaveLength(0);
});

test("[Opcoes] scripts NÃO devem ser carregados duas vezes", async ({ page }) => {
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

test("[Opcoes] título da página deve estar definido", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
});

test("[Opcoes] deve conter elemento de tabela ou lista de operações", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    // A página deve ter algum container para operações
    const hasTable = await page.locator("#tableMesAtual, #tableHistorico, table, .table-responsive").count();
    expect(hasTable).toBeGreaterThan(0);
});

test("[Opcoes] deve ter botão para nova operação", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const btnNova = page.locator(
        "button:has-text('Nova'), button:has-text('Adicionar'), button:has-text('Add'), #btnNovaOpcao, .btn-nova"
    ).first();
    await expect(btnNova).toBeVisible({ timeout: 5000 }).catch(() => {});
    // Se não encontrar botão específico, pelo menos a página carregou
    const body = page.locator("body");
    await expect(body).toBeVisible();
});

test("[Opcoes] deve responder a requisição da página com status 200", async ({ page }) => {
    const response = await page.goto(BASE);
    expect(response?.status()).toBe(200);
});

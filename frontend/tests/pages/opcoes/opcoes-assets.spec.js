// frontend/tests/pages/opcoes/opcoes-assets.spec.js
// Testa carregamento dos assets reorganizados do módulo de Opções
// Complementa: pages/opcoes.spec.js

import { test, expect } from "@playwright/test";

const BASE = "/html/opcoes.html";

// ─── Assets nos novos caminhos ───────────────────────────────────────────────

test("[Opcoes-Assets] CSS organizados devem carregar com status 200", async ({ page }) => {
    const cssRequests = [];
    page.on("response", (resp) => {
        if (resp.url().includes("/css/")) {
            cssRequests.push({ url: resp.url(), status: resp.status() });
        }
    });
    await page.goto(BASE, { waitUntil: "networkidle" });

    // Verificar que não há 404 nos CSS
    const failedCss = cssRequests.filter(r => r.status === 404);
    expect(failedCss, `CSS com 404: ${failedCss.map(r => r.url).join(", ")}`).toHaveLength(0);
});

test("[Opcoes-Assets] JS do módulo opções deve carregar sem erros 404", async ({ page }) => {
    const jsRequests = [];
    page.on("response", (resp) => {
        if (resp.url().includes("/js/")) {
            jsRequests.push({ url: resp.url(), status: resp.status() });
        }
    });
    await page.goto(BASE, { waitUntil: "networkidle" });

    const failedJs = jsRequests.filter(r => r.status === 404);
    expect(failedJs, `JS com 404: ${failedJs.map(r => r.url).join(", ")}`).toHaveLength(0);
});

test("[Opcoes-Assets] CSS deve carregar de js/opcoes/, js/shared/ ou js/core/", async ({ page }) => {
    const loadedJs = [];
    page.on("response", (resp) => {
        if (resp.url().includes("/js/") && resp.status() === 200) {
            loadedJs.push(resp.url());
        }
    });
    await page.goto(BASE, { waitUntil: "networkidle" });

    // Confirmar que pelo menos algum JS de opcoes/ ou shared/ foi carregado
    const hasOpcoes = loadedJs.some(url => url.includes("/js/opcoes/") || url.includes("/js/shared/") || url.includes("/js/core/"));
    expect(hasOpcoes, `Nenhum JS de opcoes/shared/core carregado. Carregados: ${loadedJs.join(", ")}`).toBe(true);
});

// ─── API de backend (tabela de opcoes) ──────────────────────────────────────

test("[Opcoes-Assets] requisição GET /api/opcoes deve retornar JSON válido", async ({ page, request }) => {
    const resp = await request.get("/api/opcoes");
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
});

test("[Opcoes-Assets] POST /api/opcoes deve criar e deletar operação de teste", async ({ request }) => {
    const resp = await request.post("/api/opcoes", {
        data: {
            ativo: "TESTE00",
            tipo: "CALL",
            tipo_operacao: "VENDA",
            quantidade: 100,
            status: "ABERTA",
            data_operacao: "2025-01-01",
        },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.success).toBe(true);
    expect(data.id).toBeTruthy();

    // Limpar: deletar a operação criada
    const del = await request.delete(`/api/opcoes/${data.id}`);
    expect(del.status()).toBe(200);
});

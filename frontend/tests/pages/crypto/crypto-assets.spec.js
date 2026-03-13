// frontend/tests/pages/crypto/crypto-assets.spec.js
// Testa carregamento dos assets reorganizados e funcionalidades do módulo Crypto
// Complementa: pages/crypto.spec.js

import { test, expect } from "@playwright/test";

const BASE = "/html/crypto.html";

// ─── Assets nos novos caminhos ───────────────────────────────────────────────

test("[Crypto-Assets] CSS e JS devem carregar sem 404", async ({ page }) => {
    const failed = [];
    page.on("response", (resp) => {
        if ((resp.url().includes("/css/") || resp.url().includes("/js/"))
            && resp.status() === 404) {
            failed.push(resp.url());
        }
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    expect(failed, `Assets com 404: ${failed.join(", ")}`).toHaveLength(0);
});

test("[Crypto-Assets] JS do módulo crypto deve estar presente (js/crypto/)", async ({ page }) => {
    const loadedJs = [];
    page.on("response", (resp) => {
        if (resp.url().includes("/js/") && resp.status() === 200) {
            loadedJs.push(resp.url());
        }
    });
    await page.goto(BASE, { waitUntil: "networkidle" });

    const hasCrypto = loadedJs.some(url => url.includes("/js/crypto/"));
    expect(hasCrypto, `crypto.js não carregado. Carregados: ${loadedJs.join(", ")}`).toBe(true);
});

// ─── API de backend (crypto) ─────────────────────────────────────────────────

test("[Crypto-Assets] GET /api/crypto deve retornar JSON válido", async ({ request }) => {
    const resp = await request.get("/api/crypto");
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
});

test("[Crypto-Assets] GET /api/crypto/estrategias deve listar estratégias", async ({ request }) => {
    const resp = await request.get("/api/crypto/estrategias");
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Verificar campos esperados
    const primeira = data[0];
    expect(primeira).toHaveProperty("key");
    expect(primeira).toHaveProperty("label");

    // Verificar que DUAL_INVESTMENT está presente
    const keys = data.map(e => e.key);
    expect(keys).toContain("DUAL_INVESTMENT");
});

test("[Crypto-Assets] POST /api/crypto deve criar e deletar operação de teste", async ({ request }) => {
    const resp = await request.post("/api/crypto", {
        data: {
            ativo: "BTC",
            tipo: "HIGH",
            tipo_estrategia: "DUAL_INVESTMENT",
            cotacao_atual: 300000,
            abertura: 290000,
            status: "ABERTA",
            data_operacao: "2025-01-01",
        },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.success).toBe(true);
    expect(data.id).toBeTruthy();

    // Limpar: deletar
    const del = await request.delete(`/api/crypto/${data.id}`);
    expect(del.status()).toBe(200);
});

test("[Crypto-Assets] campo tipo_estrategia deve ser persistido corretamente", async ({ request }) => {
    // Criar com estratégia SPOT
    const create = await request.post("/api/crypto", {
        data: {
            ativo: "ETH",
            tipo: "SPOT",
            tipo_estrategia: "SPOT",
            status: "ABERTA",
            data_operacao: "2025-06-01",
        },
    });
    const createData = await create.json();
    expect(createData.success).toBe(true);

    // Buscar e verificar
    const get = await request.get(`/api/crypto/${createData.id}`);
    const getData = await get.json();
    expect(getData.tipo_estrategia).toBe("SPOT");

    // Limpar
    await request.delete(`/api/crypto/${createData.id}`);
});

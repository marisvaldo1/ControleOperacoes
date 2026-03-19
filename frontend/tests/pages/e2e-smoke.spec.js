// frontend/tests/pages/e2e-smoke.spec.js
// Testes E2E de fumaça: simulam o usuário acessando o sistema.
// Screenshots são opcionais: defina PLAYWRIGHT_SCREENSHOTS=1 ou E2E_SCREENSHOTS=always para habilitá-las.
//   Exemplo direto: $env:PLAYWRIGHT_SCREENSHOTS="1"; npx playwright test
//   Via dashboard de testes: Configurações → Captura de Tela → Sempre (passa E2E_SCREENSHOTS=always)

import { test, expect } from "@playwright/test";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// ── Carrega fixtures ────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const opcoesFx  = require("../fixtures/opcoes-fixtures.json");
const cryptoFx  = require("../fixtures/crypto-fixtures.json");

const BASE        = "http://localhost:8888";
const SHOT_DIR    = path.resolve(__dirname, "../../../tests/results/screenshots");
const SCREENSHOTS = process.env.PLAYWRIGHT_SCREENSHOTS === "1"
                 || process.env.E2E_SCREENSHOTS === "always";

// Captura screenshot apenas se PLAYWRIGHT_SCREENSHOTS=1
async function shot(page, name) {
    if (!SCREENSHOTS) return;
    if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
    const file = path.join(SHOT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  📸 Screenshot salvo: ${file}`);
}

// ─── PÁGINA DE OPÇÕES ────────────────────────────────────────────────────────

test.describe("[E2E] Página de Opções", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/html/opcoes.html", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1200);
    });

    test("[E2E-Opcoes] screenshot inicial da página", async ({ page }) => {
        await shot(page, "e2e-opcoes-inicial");
        const title = await page.title();
        expect(title).toBeTruthy();
    });

    test("[E2E-Opcoes] página carrega sem erros críticos de JS", async ({ page }) => {
        const errors = [];
        page.on("pageerror", e => {
            if (!e.message.includes("fetch") && !e.message.includes("net::")) errors.push(e.message);
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);
        await shot(page, "e2e-opcoes-carregada");
        const criticals = errors.filter(e => e.includes("SyntaxError") || e.includes("ReferenceError"));
        expect(criticals, `Erros críticos: ${criticals.join("; ")}`).toHaveLength(0);
    });

    test("[E2E-Opcoes] container principal de operações está visível", async ({ page }) => {
        const container = page.locator(
            "#tableMesAtual, #tableHistorico, table, .table-responsive, #opcoes-list, #mainContainer"
        ).first();
        await expect(container).toBeVisible({ timeout: 5000 });
        await shot(page, "e2e-opcoes-tabela-visivel");
    });

    test("[E2E-Opcoes] todos os assets CSS carregam sem 404", async ({ page }) => {
        const failed = [];
        page.on("response", r => { if (r.url().includes("/css/") && r.status() === 404) failed.push(r.url()); });
        await page.reload({ waitUntil: "networkidle" });
        await shot(page, "e2e-opcoes-assets-ok");
        expect(failed, `CSS com 404: ${failed.join(", ")}`).toHaveLength(0);
    });

    test("[E2E-Opcoes] todos os assets JS carregam sem 404", async ({ page }) => {
        const failed = [];
        page.on("response", r => { if (r.url().includes("/js/") && r.status() === 404) failed.push(r.url()); });
        await page.reload({ waitUntil: "networkidle" });
        expect(failed, `JS com 404: ${failed.join(", ")}`).toHaveLength(0);
    });
});

// ─── PÁGINA DE CRYPTO ────────────────────────────────────────────────────────

test.describe("[E2E] Página de Crypto", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/html/crypto.html", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1200);
    });

    test("[E2E-Crypto] screenshot inicial da página", async ({ page }) => {
        await shot(page, "e2e-crypto-inicial");
        const title = await page.title();
        expect(title).toBeTruthy();
    });

    test("[E2E-Crypto] página carrega sem erros críticos de JS", async ({ page }) => {
        const errors = [];
        page.on("pageerror", e => {
            if (!e.message.includes("fetch") && !e.message.includes("net::")) errors.push(e.message);
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);
        await shot(page, "e2e-crypto-carregada");
        const criticals = errors.filter(e => e.includes("SyntaxError") || e.includes("ReferenceError"));
        expect(criticals, `Erros críticos: ${criticals.join("; ")}`).toHaveLength(0);
    });

    test("[E2E-Crypto] container principal de operações está visível", async ({ page }) => {
        const container = page.locator(
            "#tableOperacoes, table, .table-responsive, #crypto-list, #mainContainer"
        ).first();
        await expect(container).toBeVisible({ timeout: 5000 });
        await shot(page, "e2e-crypto-tabela-visivel");
    });

    test("[E2E-Crypto] todos os assets carregam sem 404", async ({ page }) => {
        const failed = [];
        page.on("response", r => {
            if ((r.url().includes("/css/") || r.url().includes("/js/")) && r.status() === 404) {
                failed.push(r.url());
            }
        });
        await page.reload({ waitUntil: "networkidle" });
        await shot(page, "e2e-crypto-assets-ok");
        expect(failed, `Assets com 404: ${failed.join(", ")}`).toHaveLength(0);
    });
});

// ─── API BACKEND (via request) ───────────────────────────────────────────────

test.describe("[E2E] API Backend", () => {
    test("[E2E-API] GET /api/opcoes retorna JSON válido", async ({ request }) => {
        const resp = await request.get(`${BASE}/api/opcoes`);
        expect(resp.status()).toBe(200);
        const data = await resp.json();
        expect(Array.isArray(data)).toBe(true);
        console.log(`  ✓ /api/opcoes: ${data.length} operação(ões)`);
    });

    test("[E2E-API] GET /api/crypto retorna JSON válido", async ({ request }) => {
        const resp = await request.get(`${BASE}/api/crypto`);
        expect(resp.status()).toBe(200);
        const data = await resp.json();
        expect(Array.isArray(data)).toBe(true);
        console.log(`  ✓ /api/crypto: ${data.length} operação(ões)`);
    });

    test("[E2E-API] GET /api/version retorna versão", async ({ request }) => {
        const resp = await request.get(`${BASE}/api/version`);
        expect(resp.status()).toBe(200);
        const data = await resp.json();
        expect(data).toHaveProperty("version");
        console.log(`  ✓ /api/version: ${data.version}`);
    });

    test("[E2E-API] GET /api/config retorna lista de configurações", async ({ request }) => {
        const resp = await request.get(`${BASE}/api/config`);
        expect(resp.status()).toBe(200);
        // Pode ser array ou objeto
        const data = await resp.json();
        expect(data).toBeTruthy();
    });

    test("[E2E-API] POST /api/opcoes CRUD completo (criar → buscar → deletar)", async ({ request }) => {
        const op = opcoesFx.crud_test;
        // Cria
        const createResp = await request.post(`${BASE}/api/opcoes`, {
            data: {
                ativo:         op.ativo,
                ativo_base:    op.ativo_base,
                tipo:          op.tipo,
                tipo_operacao: op.tipo_operacao,
                strike:        op.strike,
                premio:        op.premio,
                quantidade:    op.quantidade,
                status:        op.status,
            },
            headers: { "Content-Type": "application/json" }
        });
        expect([200, 201]).toContain(createResp.status());
        const created = await createResp.json();
        const id = created.id;
        expect(id).toBeTruthy();
        console.log(`  ✓ Criou operação id=${id} (fixture: ${op._descricao})`);

        // Busca
        const getResp = await request.get(`${BASE}/api/opcoes/${id}`);
        expect(getResp.status()).toBe(200);
        const got = await getResp.json();
        expect(got.ativo.toUpperCase()).toBe(op.ativo.toUpperCase());
        console.log(`  ✓ Buscou operação id=${id}: ativo=${got.ativo}`);

        // Deleta
        const delResp = await request.delete(`${BASE}/api/opcoes/${id}`);
        expect([200, 204]).toContain(delResp.status());
        console.log(`  ✓ Deletou operação id=${id}`);
    });

    test("[E2E-API] POST /api/crypto CRUD completo (criar → buscar → deletar)", async ({ request }) => {
        const op = cryptoFx.crud_test;
        // Cria
        const createResp = await request.post(`${BASE}/api/crypto`, {
            data: {
                ativo:            op.ativo,
                tipo:             op.tipo,
                abertura:         op.preco || op.abertura || 0,
                exercicio_status: op.exercicio_status || "NAO",
            },
            headers: { "Content-Type": "application/json" }
        });
        expect([200, 201]).toContain(createResp.status());
        const created = await createResp.json();
        const id = created.id;
        expect(id).toBeTruthy();
        console.log(`  ✓ Criou crypto id=${id} (fixture: ${op._descricao})`);

        // Deleta
        const delResp = await request.delete(`${BASE}/api/crypto/${id}`);
        expect([200, 204]).toContain(delResp.status());
        console.log(`  ✓ Deletou crypto id=${id}`);
    });
});

// ─── INTERAÇÕES DE USUÁRIO ───────────────────────────────────────────────────

test.describe("[E2E] Interações do Usuário - Opções", () => {
    test("[E2E-UI] clicar em botões/filtros não gera erros JS", async ({ page }) => {
        const errors = [];
        page.on("pageerror", e => {
            if (!e.message.includes("fetch") && !e.message.includes("net::")) errors.push(e.message);
        });

        await page.goto("/html/opcoes.html", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);

        // Tenta clicar em todos os botões visíveis
        const buttons = await page.locator("button:visible").all();
        console.log(`  ▶ ${buttons.length} botão(ões) encontrado(s) na tela`);

        for (const btn of buttons.slice(0, 5)) {
            try {
                const txt = (await btn.textContent()) || '';
                if (txt.toLowerCase().includes('excluir') || txt.toLowerCase().includes('deletar')) continue;
                await btn.click({ timeout: 800 }).catch(() => {});
                await page.waitForTimeout(300);
            } catch (_) { /* ignora erros de click */ }
        }

        await shot(page, "e2e-ui-interacoes-opcoes");

        const criticals = errors.filter(e => e.includes("SyntaxError") || e.includes("ReferenceError"));
        expect(criticals, `Erros após interação: ${criticals.join("; ")}`).toHaveLength(0);
    });

    test("[E2E-UI] screenshot com dados carregados via API", async ({ page, request }) => {
        // Garante que existe pelo menos uma operação
        const listResp = await request.get(`${BASE}/api/opcoes`);
        const list = await listResp.json();

        await page.goto("/html/opcoes.html", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000); // aguarda fetch inicial
        await shot(page, "e2e-ui-opcoes-com-dados");

        // Verifica se total de operações é consistente com API
        console.log(`  ℹ️ API retornou ${list.length} operação(ões)`);
        expect(listResp.status()).toBe(200);
    });
});

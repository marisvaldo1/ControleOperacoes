/**
 * e2e-usuario.spec.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Testes E2E que SIMULAM A DIGITAÇÃO DO USUÁRIO no browser.
 *
 * ► Como executar e VER o browser aberto:
 *     npx playwright test e2e-usuario --headed --slow-mo=700
 *
 * ► Como executar SEM ver o browser (headless):
 *     npx playwright test e2e-usuario
 *
 * ► Este arquivo é EXCLUÍDO do run_all_tests.bat para não bloquear CI.
 *   Para incluir: remova "e2e-usuario.spec.js" do testIgnore no playwright.config.js
 *
 * Dados dos testes ficam em:
 *   frontend/tests/fixtures/opcoes-fixtures.json
 *   frontend/tests/fixtures/crypto-fixtures.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { test, expect } from "@playwright/test";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── Carrega fixtures ──────────────────────────────────────────────────────────
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const require    = createRequire(import.meta.url);
const opcoesFx   = require("../fixtures/opcoes-fixtures.json");
const cryptoFx   = require("../fixtures/crypto-fixtures.json");

// ── Diretório de screenshots ──────────────────────────────────────────────────
const SHOT_DIR = path.resolve(__dirname, "../../../tests/results/screenshots");

function ensureShotDir() {
    if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
}

async function shot(page, name) {
    ensureShotDir();
    const file = path.join(SHOT_DIR, `usuario-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  📸 ${file}`);
}

// ── Helpers de preenchimento ──────────────────────────────────────────────────

/** Aguarda o modal abrir (visibilidade do campo pivô) */
async function waitModal(page, pivotSelector = "#inputAtivo", timeout = 8000) {
    await page.waitForSelector(`${pivotSelector}:visible`, { timeout });
    await page.waitForTimeout(400);
}

/** Preenche campo texto/número limpando primeiro */
async function fill(page, selector, value) {
    if (value === null || value === undefined || value === "") return;
    await page.locator(selector).click();
    await page.locator(selector).fill(String(value));
}

/** Selects a value from a <select> */
async function select(page, selector, value) {
    if (!value) return;
    await page.locator(selector).selectOption(String(value));
}

/** Fecha modal via ESC ou botão X, se ainda estiver aberto */
async function closeModal(page) {
    const btnClose = page.locator(".modal.show .btn-close").first();
    if (await btnClose.isVisible({ timeout: 500 }).catch(() => false)) {
        await btnClose.click();
        await page.waitForTimeout(600);
    } else {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(600);
    }
}

/** Aguarda o modal fechar */
async function waitModalClose(page, timeout = 8000) {
    await page.waitForSelector(".modal.show", { state: "hidden", timeout }).catch(() => {});
    await page.waitForTimeout(500);
}

// ═════════════════════════════════════════════════════════════════════════════
//  OPÇÕES — CRUD VIA FORMULÁRIO MODAL
// ═════════════════════════════════════════════════════════════════════════════

// IDs criados via formulário para limpeza afterAll
const _formCreatedIds = [];

test.describe("[E2E-Usuario] Opções — Simulação de Digitação", () => {

    test.beforeEach(async ({ page }) => {
        await page.goto("/html/opcoes.html", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1200);
        await shot(page, "opcoes-pagina-inicial");
    });

    // ── Limpeza ao final: remove todos os registros de teste ──────────────────
    test.afterAll(async ({ request }) => {
        // 1. Remove marcados is_test_data=1 via endpoint dedicado
        const r1 = await request.delete("http://localhost:8888/api/opcoes/test-data");
        const d1 = await r1.json().catch(() => ({}));
        console.log(`  🧹 afterAll: removidos ${d1.deleted ?? '?'} registros is_test_data=1`);

        // 2. Remove IDs rastreados manualmente (criados via form)
        for (const id of _formCreatedIds) {
            await request.delete(`http://localhost:8888/api/opcoes/${id}`).catch(() => {});
            console.log(`  🧹 afterAll: removido id=${id} (form)`);
        }
        _formCreatedIds.length = 0;
    });

    // ── Passo 1: Abrir modal de nova operação ─────────────────────────────────
    test("[E2E-Usuario-Opcoes-01] Abrir modal Nova Operação", async ({ page }) => {
        const btn = page.locator("#btnNovaOperacao");
        await expect(btn).toBeVisible({ timeout: 5000 });

        console.log("  ▶ Clicando em 'Nova Operação'...");
        await btn.click();
        await waitModal(page, "#inputAtivo");

        await shot(page, "opcoes-modal-aberto");

        const modal = page.locator("#modalOperacao");
        await expect(modal).toBeVisible({ timeout: 5000 });
        console.log("  ✓ Modal aberto com sucesso.");
        await closeModal(page);
    });

    // ── Passo 2: Preencher e salvar operação (fixture[0]) ─────────────────────
    test("[E2E-Usuario-Opcoes-02] Preencher formulário com dados do fixture e salvar", async ({ page, request }) => {
        const op = opcoesFx.operacoes[0];
        console.log(`  ► Fixture: ${op._descricao}`);

        // Abre modal
        await page.locator("#btnNovaOperacao").click();
        await waitModal(page, "#inputAtivo");
        await shot(page, "opcoes-form-antes-preenchimento");

        // Preenche campos — passo a passo visível
        console.log("  ✍ Preenchendo Ativo Base...");
        await fill(page, "#inputAtivoBase", op.ativo_base);
        await page.waitForTimeout(300);
        await shot(page, "opcoes-form-ativo-base");

        console.log("  ✍ Preenchendo Ativo (ticker da opção)...");
        await fill(page, "#inputAtivo", op.ativo);
        await page.waitForTimeout(300);

        console.log("  ✍ Selecionando Tipo (CALL/PUT)...");
        await select(page, "#inputTipo", op.tipo);
        await page.waitForTimeout(200);

        console.log("  ✍ Selecionando Tipo de Operação (VENDA/COMPRA)...");
        await select(page, "#inputTipoOperacao", op.tipo_operacao);
        await page.waitForTimeout(200);

        console.log("  ✍ Preenchendo Data...");
        await fill(page, "#inputDataOperacao", op.data_operacao);
        await page.waitForTimeout(200);

        console.log("  ✍ Preenchendo Quantidade...");
        await fill(page, "#inputQuantidade", op.quantidade);
        await page.waitForTimeout(200);
        await shot(page, "opcoes-form-meio-preenchimento");

        console.log("  ✍ Preenchendo Preço de Entrada...");
        await fill(page, "#inputPrecoEntrada", op.preco_entrada);
        await page.waitForTimeout(200);

        console.log("  ✍ Preenchendo Strike...");
        await fill(page, "#inputStrike", op.strike);
        await page.waitForTimeout(200);

        console.log("  ✍ Preenchendo Prêmio...");
        await fill(page, "#inputPremio", op.premio);
        await page.waitForTimeout(200);

        if (op.vencimento) {
            console.log("  ✍ Preenchendo Vencimento...");
            await fill(page, "#inputVencimento", op.vencimento);
            await page.waitForTimeout(200);
        }

        if (op.status) {
            console.log("  ✍ Selecionando Status...");
            await select(page, "#inputStatus", op.status);
            await page.waitForTimeout(200);
        }

        await shot(page, "opcoes-form-preenchido");
        console.log("  ✓ Formulário preenchido. Salvando...");

        // Salva
        const btnSave = page.locator("#btnSaveOperacao");
        await expect(btnSave).toBeVisible({ timeout: 3000 });
        await btnSave.click();
        await waitModalClose(page);

        await shot(page, "opcoes-apos-salvar");
        console.log("  ✓ Operação salva. Verificando tabela...");

        await page.waitForTimeout(1500);
        await shot(page, "opcoes-tabela-atualizada");
        const tabela = page.locator("#tableMesAtual, #tableHistorico").first();
        await expect(tabela).toBeVisible({ timeout: 5000 });

        // Rastreia ID para limpeza afterAll
        const listResp = await request.get("http://localhost:8888/api/opcoes");
        if (listResp.ok()) {
            const ops = await listResp.json();
            const created = ops.find(o => o.ativo === op.ativo && o.ativo_base === op.ativo_base);
            if (created?.id) {
                _formCreatedIds.push(created.id);
                console.log(`  ℹ️ Rastreando id=${created.id} para limpeza afterAll`);
            }
        }
    });

    // ── Passo 3: CRUD completo via API + verificação na tela ──────────────────
    test("[E2E-Usuario-Opcoes-03] Criar via API e verificar aparecimento na tela", async ({ page, request }) => {
        const op = opcoesFx.crud_test;
        console.log(`  ► Fixture CRUD: ${op._descricao}`);

        // Cria via API (marcado como is_test_data)
        const createResp = await request.post("http://localhost:8888/api/opcoes", {
            data: {
                ativo:         op.ativo,
                ativo_base:    op.ativo_base,
                tipo:          op.tipo,
                tipo_operacao: op.tipo_operacao,
                strike:        op.strike,
                premio:        op.premio,
                quantidade:    op.quantidade,
                status:        op.status,
                is_test_data:  1,
                observacoes:   "[TESTE E2E]",
            },
            headers: { "Content-Type": "application/json" }
        });
        expect([200, 201]).toContain(createResp.status());
        const { id } = await createResp.json();
        console.log(`  ✓ Criado via API: id=${id} (${op.ativo_base} / ${op.ativo})`);

        // Recarrega página e verifica
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        await shot(page, `opcoes-crud-id${id}-apareceu`);

        // Limpa — deleta via API
        const delResp = await request.delete(`http://localhost:8888/api/opcoes/${id}`);
        expect([200, 204]).toContain(delResp.status());
        console.log(`  ✓ Deletado id=${id}`);

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);
        await shot(page, `opcoes-crud-id${id}-removido`);
    });

    // ── Passo 4: Excluir operação via datatable (click no botão Excluir) ──────
    test("[E2E-Usuario-Opcoes-04] Excluir operação via datatable", async ({ page, request }) => {
        const op = opcoesFx.crud_test;
        console.log(`  ► Criando operação de teste para excluir via datatable...`);

        // Cria via API com marcador de teste
        const createResp = await request.post("http://localhost:8888/api/opcoes", {
            data: {
                ativo:         op.ativo,
                ativo_base:    op.ativo_base,
                tipo:          op.tipo,
                tipo_operacao: op.tipo_operacao,
                strike:        parseFloat(op.strike)    || 0,
                premio:        parseFloat(op.premio)    || 0,
                quantidade:    parseInt(op.quantidade)  || 1,
                status:        "ABERTA",
                is_test_data:  1,
                observacoes:   "[TESTE E2E] excluir-via-datatable",
            },
            headers: { "Content-Type": "application/json" }
        });
        expect([200, 201]).toContain(createResp.status());
        const { id } = await createResp.json();
        console.log(`  ✓ Criado via API: id=${id} — agora excluindo via datatable`);

        // Navega para a tela principal
        await page.goto("/html/opcoes.html", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000);
        await shot(page, `opcoes-delete04-lista-antes-id${id}`);

        // Localiza e clica no botão Excluir da linha correspondente
        const btnExcluir = page.locator(`button[onclick="deleteOperacao('${id}')"]`);
        await expect(btnExcluir).toBeVisible({ timeout: 8000 });
        console.log(`  ▶ Clicando em Excluir (id=${id})...`);
        await btnExcluir.click();

        // Confirma o SweetAlert2 ("Sim, excluir")
        const btnConfirm = page.locator(".swal2-confirm");
        await expect(btnConfirm).toBeVisible({ timeout: 5000 });
        await shot(page, `opcoes-delete04-swal-confirm-id${id}`);
        console.log("  ▶ Confirmando exclusão no diálogo SweetAlert2...");
        await btnConfirm.click();

        // Aguarda a tabela se atualizar
        await page.waitForTimeout(2000);
        await shot(page, `opcoes-delete04-apos-excluir-id${id}`);

        // Verifica que o botão de excluir NÃO aparece mais na tela
        const btnApos = page.locator(`button[onclick="deleteOperacao('${id}')"]`);
        await expect(btnApos).toHaveCount(0, { timeout: 5000 });
        console.log(`  ✓ Operação id=${id} removida da tela com sucesso.`);

        // Confirma via API que o registro foi deletado (deve retornar 404)
        const checkResp = await request.get(`http://localhost:8888/api/opcoes/${id}`);
        expect(checkResp.status()).toBe(404);
        console.log("  ✓ Confirmado via API: operação não existe mais no banco.");
    });
});

// ═════════════════════════════════════════════════════════════════════════════
//  CRYPTO — CRUD VIA FORMULÁRIO MODAL
// ═════════════════════════════════════════════════════════════════════════════
test.describe("[E2E-Usuario] Crypto — Simulação de Digitação", () => {

    test.beforeEach(async ({ page }) => {
        await page.goto("/html/crypto.html", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1200);
        await shot(page, "crypto-pagina-inicial");
    });

    // ── Passo 1: Abrir modal ──────────────────────────────────────────────────
    test("[E2E-Usuario-Crypto-01] Abrir modal Nova Operação", async ({ page }) => {
        const btn = page.locator("#btnNovaOperacao");
        await expect(btn).toBeVisible({ timeout: 5000 });

        console.log("  ▶ Clicando em 'Nova Operação'...");
        await btn.click();
        await waitModal(page, "#inputAtivo");

        await shot(page, "crypto-modal-aberto");

        const modal = page.locator("#modalOperacao");
        await expect(modal).toBeVisible({ timeout: 5000 });
        console.log("  ✓ Modal aberto.");
        await closeModal(page);
    });

    // ── Passo 2: Preencher formulário com fixture[0] ──────────────────────────
    test("[E2E-Usuario-Crypto-02] Preencher formulário com dados do fixture e salvar", async ({ page }) => {
        const op = cryptoFx.operacoes[0];
        console.log(`  ► Fixture: ${op._descricao}`);

        await page.locator("#btnNovaOperacao").click();
        await waitModal(page, "#inputAtivo");
        await shot(page, "crypto-form-antes-preenchimento");

        const preenchimentos = [
            ["#inputAtivo",       op.ativo,            "Ativo (BTC/ETH...)"],
            ["#inputTipo",        op.tipo,              "Tipo (CALL/PUT)"],
            ["#inputStatus",      op.status,            "Status"],
            ["#inputDataOperacao",op.data_operacao,     "Data"],
            ["#inputAbertura",    op.abertura,          "Abertura (cotação entrada)"],
            ["#inputStrike",      op.strike,            "Strike"],
            ["#inputTae",         op.tae,               "TAE (%)"],
            ["#inputPrazo",       op.prazo,             "Prazo (dias)"],
            ["#inputCrypto",      op.crypto,            "Quantidade Crypto"],
            ["#inputPremioUs",    op.premio_us,         "Prêmio (US$)"],
            ["#inputDistancia",   op.distancia,         "Distância (%)"],
        ];

        for (const [sel, val, label] of preenchimentos) {
            if (val === null || val === undefined || val === "") continue;
            const el = page.locator(sel);
            if (!await el.isVisible({ timeout: 400 }).catch(() => false)) {
                console.log(`  ⚠ Campo ${label} (${sel}) não encontrado — pulando.`);
                continue;
            }
            console.log(`  ✍ ${label}: ${val}`);
            const tag = await el.evaluate(e => e.tagName);
            if (tag === "SELECT") {
                await el.selectOption(String(val));
            } else {
                await el.click();
                await el.fill(String(val));
            }
            await page.waitForTimeout(250);
        }

        if (op.exercicio_status) {
            const elEx = page.locator("#inputExercicioStatus");
            if (await elEx.isVisible({ timeout: 400 }).catch(() => false)) {
                console.log(`  ✍ Exercício Status: ${op.exercicio_status}`);
                await elEx.selectOption(op.exercicio_status);
            }
        }

        if (op.observacoes) {
            const elObs = page.locator("#inputObservacoes");
            if (await elObs.isVisible({ timeout: 400 }).catch(() => false)) {
                console.log("  ✍ Observações...");
                await elObs.click();
                await elObs.fill(op.observacoes);
            }
        }

        await shot(page, "crypto-form-preenchido");
        console.log("  ✓ Formulário preenchido. Salvando...");

        const btnSave = page.locator("#btnSaveOperacao");
        await expect(btnSave).toBeVisible({ timeout: 3000 });
        await btnSave.click();
        await waitModalClose(page);

        await page.waitForTimeout(1500);
        await shot(page, "crypto-apos-salvar");
        console.log("  ✓ Operação salva.");

        // Valida que a tabela existe
        const tabela = page.locator("#tableMesAtual").first();
        await expect(tabela).toBeVisible({ timeout: 5000 });
    });

    // ── Passo 3: CRUD completo via API ────────────────────────────────────────
    test("[E2E-Usuario-Crypto-03] Criar via API e verificar aparecimento na tela", async ({ page, request }) => {
        const op = cryptoFx.crud_test;
        console.log(`  ► Fixture CRUD: ${op._descricao}`);

        const createResp = await request.post("http://localhost:8888/api/crypto", {
            data: {
                ativo:            op.ativo,
                tipo:             op.tipo,
                abertura:         op.preco || op.abertura || 0,
                exercicio_status: op.exercicio_status || "NAO",
            },
            headers: { "Content-Type": "application/json" }
        });
        expect([200, 201]).toContain(createResp.status());
        const { id } = await createResp.json();
        console.log(`  ✓ Criado via API: id=${id} (${op.ativo})`);

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        await shot(page, `crypto-crud-id${id}-apareceu`);

        const delResp = await request.delete(`http://localhost:8888/api/crypto/${id}`);
        expect([200, 204]).toContain(delResp.status());
        console.log(`  ✓ Deletado id=${id}`);

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);
        await shot(page, `crypto-crud-id${id}-removido`);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
//  TODAS AS FIXTURES — PERCORRE CADA ITEM DO ARRAY
// ═════════════════════════════════════════════════════════════════════════════
test.describe("[E2E-Usuario] Percorre todas as fixtures de Opções", () => {
    for (const [idx, op] of opcoesFx.operacoes.entries()) {
        test(`[E2E-Usuario-Opcoes-FX${String(idx + 1).padStart(2, "0")}] ${op._descricao}`, async ({ page, request }) => {
            console.log(`  ► [FX${idx + 1}] ${op._descricao}`);

            // Cria via API (marcado como is_test_data para limpeza segura)
            const createResp = await request.post("http://localhost:8888/api/opcoes", {
                data: {
                    ativo:         op.ativo,
                    ativo_base:    op.ativo_base,
                    tipo:          op.tipo,
                    tipo_operacao: op.tipo_operacao,
                    strike:        parseFloat(op.strike)   || 0,
                    premio:        parseFloat(op.premio)   || 0,
                    quantidade:    parseInt(op.quantidade) || 1,
                    status:        op.status               || "ABERTA",
                    preco_entrada: parseFloat(op.preco_entrada) || 0,
                    vencimento:    op.vencimento            || null,
                    data_operacao: op.data_operacao         || null,
                    is_test_data:  1,
                    observacoes:   "[TESTE E2E]",
                },
                headers: { "Content-Type": "application/json" }
            });
            expect([200, 201]).toContain(createResp.status());
            const { id } = await createResp.json();
            console.log(`    ✓ id=${id}`);

            // Visita a página e tira screenshot
            await page.goto("/html/opcoes.html", { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(1500);
            await shot(page, `opcoes-fx${idx + 1}-id${id}`);

            // Limpa
            await request.delete(`http://localhost:8888/api/opcoes/${id}`);
            console.log(`    ✓ Deletado id=${id}`);
        });
    }
});

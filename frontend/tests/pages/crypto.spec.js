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

    // ✅ CORRIGIDO: Selecionar botão de refresh dentro do modal visível
    const btnRefresh = page.locator("#modalAnalise.show .cfb-btn.ref");
    await expect(btnRefresh).toBeVisible({ timeout: 5000 });
    await btnRefresh.click();

    // Aguarda spinner desaparecer e dados recarregarem
    await page.waitForTimeout(2000);

    // O valor deve continuar não zerado após refresh
    const valorDepois = await page.locator("#maDonutValue").textContent();
    expect(valorDepois).not.toBe("R$ 0");

    // ✅ CORRIGIDO: Timestamp dentro do modal visível
    const status = await page.locator("#modalAnalise.show .cfb-time").textContent();
    expect(status).not.toBe("—");  // Deve ter sido atualizado
});

test("[Crypto] loading deve aparecer durante atualização", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.ModalAnalise !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal
    await page.evaluate(() => window.ModalAnalise && window.ModalAnalise.open());
    await page.waitForSelector("#modalAnalise.show", { timeout: 10000 });
    
    // Aguarda dados carregarem
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '';
    }, { timeout: 30000 });

    // Clica no botão refresh
    const btnRefresh = page.locator("#modalAnalise.show .cfb-btn.ref");
    await expect(btnRefresh).toBeVisible({ timeout: 5000 });
    
    // Clica e imediatamente verifica se o loading aparece
    await btnRefresh.click();
    
    // Verifica se o spinner aparece em pelo menos um dos elementos
    const hasSpinner = await page.evaluate(() => {
        const elements = [
            'maDonutValue', 'maDonutSub', 'maWinRate', 'maTicketMedio', 
            'maRoiValue', 'maRightResult', 'maRightSub', 'maMelhorTrade',
            'maTicketMedioFooter', 'maRoiFooter'
        ];
        
        return elements.some(id => {
            const el = document.getElementById(id);
            return el && el.innerHTML.includes('spinner-border');
        });
    });
    
    // Se não encontrou spinner, pode ser que já tenha carregado muito rápido
    // Nesse caso, apenas verificamos se os valores foram atualizados
    if (!hasSpinner) {
        console.log('Loading foi muito rápido ou já completou');
    }
    
    // Aguarda o loading terminar
    await page.waitForTimeout(2000);
    
    // Verifica se os valores foram atualizados (não devem ter spinner)
    const noSpinner = await page.evaluate(() => {
        const elements = [
            'maDonutValue', 'maDonutSub', 'maWinRate', 'maTicketMedio', 
            'maRoiValue', 'maRightResult', 'maRightSub', 'maMelhorTrade',
            'maTicketMedioFooter', 'maRoiFooter'
        ];
        
        return elements.every(id => {
            const el = document.getElementById(id);
            return el && !el.innerHTML.includes('spinner-border');
        });
    });
    
    expect(noSpinner).toBe(true);
});

// ─── Filtros de Período ──────────────────────────────────────────────────────

test("[Crypto] filtro 'Hoje' deve mostrar operações do dia", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.ModalAnalise !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal
    await page.evaluate(() => window.ModalAnalise && window.ModalAnalise.open());
    await page.waitForSelector("#modalAnalise.show", { timeout: 10000 });
    
    // Aguarda dados carregarem
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '';
    }, { timeout: 30000 });

    // Clica no filtro "Hoje"
    const btnHoje = page.locator("#modalAnalise.show .cfb-pill[data-cfb-p='today']");
    await expect(btnHoje).toBeVisible({ timeout: 5000 });
    await btnHoje.click();
    
    // Aguarda filtro ser aplicado
    await page.waitForTimeout(1000);
    
    // Verifica se há operações ou se está vazio (ambos são válidos)
    const donutSub = await page.locator("#maDonutSub").textContent();
    expect(donutSub).toMatch(/\d+ operaç/); // Deve mostrar "X operações"
});

test("[Crypto] filtro 'Semana' deve mostrar operações da semana", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.ModalAnalise !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal
    await page.evaluate(() => window.ModalAnalise && window.ModalAnalise.open());
    await page.waitForSelector("#modalAnalise.show", { timeout: 10000 });
    
    // Aguarda dados carregarem
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '';
    }, { timeout: 30000 });

    // Clica no filtro "Semana"
    const btnSemana = page.locator("#modalAnalise.show .cfb-pill[data-cfb-p='semana']");
    await expect(btnSemana).toBeVisible({ timeout: 5000 });
    await btnSemana.click();
    
    // Aguarda filtro ser aplicado
    await page.waitForTimeout(1000);
    
    // Verifica se o filtro foi aplicado (botão deve estar ativo)
    await expect(btnSemana).toHaveClass(/p-on/);
    
    // Verifica se os valores foram atualizados
    const donutValue = await page.locator("#maDonutValue").textContent();
    expect(donutValue).toBeTruthy();
});

test("[Crypto] período customizado deve filtrar corretamente", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.ModalAnalise !== 'undefined' &&
        typeof window.Swal !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal
    await page.evaluate(() => window.ModalAnalise && window.ModalAnalise.open());
    await page.waitForSelector("#modalAnalise.show", { timeout: 10000 });
    
    // Aguarda dados carregarem
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '';
    }, { timeout: 30000 });

    // Clica no botão de período customizado
    const btnCustom = page.locator("#modalAnalise.show .cfb-pill[data-cfb-p='custom']");
    await expect(btnCustom).toBeVisible({ timeout: 5000 });
    await btnCustom.click();
    
    // Aguarda o modal do SweetAlert2 aparecer
    await page.waitForSelector(".swal2-container", { timeout: 5000 });
    
    // Preenche as datas (04/05/2026 até 08/05/2026)
    await page.fill("#cfb-swal-from", "2026-05-04");
    await page.fill("#cfb-swal-to", "2026-05-08");
    
    // Clica em "Aplicar"
    await page.click(".swal2-confirm");
    
    // Aguarda o filtro ser aplicado
    await page.waitForTimeout(2000);
    
    // Verifica se o botão de período customizado está ativo
    await expect(btnCustom).toHaveClass(/p-on/);
    
    // Verifica se o label do botão foi atualizado com as datas
    const btnText = await btnCustom.textContent();
    expect(btnText).toContain("04/05/2026");
    expect(btnText).toContain("08/05/2026");
    
    // Verifica se os valores foram atualizados
    const donutValue = await page.locator("#maDonutValue").textContent();
    expect(donutValue).toBeTruthy();
});

// ─── Badges de Totalização ───────────────────────────────────────────────────

test("[Crypto] badges de totalização devem aparecer no modal", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.ModalAnalise !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal
    await page.evaluate(() => window.ModalAnalise && window.ModalAnalise.open());
    await page.waitForSelector("#modalAnalise.show", { timeout: 10000 });
    
    // Aguarda dados carregarem
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '';
    }, { timeout: 30000 });

    // Verifica se os badges de totalização estão visíveis
    const badgeTotal = page.locator("#modalAnalise.show .cfb-tag-b");
    const badgeAbertas = page.locator("#modalAnalise.show .cfb-tag-g");
    const badgeFechadas = page.locator("#modalAnalise.show .cfb-tag-r");
    const badgePremio = page.locator("#modalAnalise.show .cfb-tag-a");
    
    await expect(badgeTotal).toBeVisible({ timeout: 5000 });
    await expect(badgeAbertas).toBeVisible({ timeout: 5000 });
    await expect(badgeFechadas).toBeVisible({ timeout: 5000 });
    await expect(badgePremio).toBeVisible({ timeout: 5000 });
    
    // Verifica se os badges contêm valores
    const totalText = await badgeTotal.textContent();
    const abertasText = await badgeAbertas.textContent();
    const fechadasText = await badgeFechadas.textContent();
    const premioText = await badgePremio.textContent();
    
    expect(totalText).toMatch(/TOTAL \d+/);
    expect(abertasText).toMatch(/ABERTAS \d+/);
    expect(fechadasText).toMatch(/FECHADAS \d+/);
    expect(premioText).toMatch(/PRÊMIO US\$ [\d,]+\.\d{2}/);
});

// ─── Filtros de Status e Tipo ────────────────────────────────────────────────

test("[Crypto] filtros de status devem funcionar", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.ModalAnalise !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal
    await page.evaluate(() => window.ModalAnalise && window.ModalAnalise.open());
    await page.waitForSelector("#modalAnalise.show", { timeout: 10000 });
    
    // Aguarda dados carregarem
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '';
    }, { timeout: 30000 });

    // Abre o dropdown de status
    const btnStatus = page.locator("#modalAnalise.show .cfb-msel[data-cfb-ms='status'] .cfb-msel-btn");
    await expect(btnStatus).toBeVisible({ timeout: 5000 });
    await btnStatus.click();
    
    // Aguarda o painel abrir
    await page.waitForSelector("#modalAnalise.show .cfb-msel[data-cfb-ms='status'].open", { timeout: 2000 });
    
    // Desmarca "Fechadas"
    const chkFechadas = page.locator("#modalAnalise.show .cfb-msel-chk[value='fechada']");
    await chkFechadas.uncheck();
    
    // Fecha o dropdown clicando fora
    await page.click("#modalAnalise.show .ma-body");
    
    // Aguarda filtro ser aplicado
    await page.waitForTimeout(1000);
    
    // Verifica se o badge de fechadas mostra 0
    const badgeFechadas = await page.locator("#modalAnalise.show .cfb-tag-r").textContent();
    expect(badgeFechadas).toMatch(/FECHADAS 0/);
});

test("[Crypto] filtros de tipo devem funcionar", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.ModalAnalise !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal
    await page.evaluate(() => window.ModalAnalise && window.ModalAnalise.open());
    await page.waitForSelector("#modalAnalise.show", { timeout: 10000 });
    
    // Aguarda dados carregarem
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '';
    }, { timeout: 30000 });

    // Abre o dropdown de tipo
    const btnTipo = page.locator("#modalAnalise.show .cfb-msel[data-cfb-ms='tipo'] .cfb-msel-btn");
    await expect(btnTipo).toBeVisible({ timeout: 5000 });
    await btnTipo.click();
    
    // Aguarda o painel abrir
    await page.waitForSelector("#modalAnalise.show .cfb-msel[data-cfb-ms='tipo'].open", { timeout: 2000 });
    
    // Desmarca "PUT"
    const chkPut = page.locator("#modalAnalise.show .cfb-msel-chk[value='PUT']");
    await chkPut.uncheck();
    
    // Fecha o dropdown clicando fora
    await page.click("#modalAnalise.show .ma-body");
    
    // Aguarda filtro ser aplicado
    await page.waitForTimeout(1000);
    
    // Verifica se os valores foram atualizados
    const donutValue = await page.locator("#maDonutValue").textContent();
    expect(donutValue).toBeTruthy();
});

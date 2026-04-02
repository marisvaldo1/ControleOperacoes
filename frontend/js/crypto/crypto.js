/** crypto.js v1.5.3 - Controle de Dual Investment Cryptos */

let allOperacoes = [];
let tableMesAtual, tableHistorico;
let chartAnual = null;
let currentFilterCrypto = "ABERTA";
let _lastSimData = null;
let _investidoMode = 'usd';
const CRYPTO_CFG_KEY = "cryptoConfig";
const historicoQuickFilter = {
    periodo: "all",
    status: "all",
    tipo: "all"
};
let historicoFilterRegistered = false;

function setInvestidoMode(mode) {
    _investidoMode = mode;
    const btnUsd    = document.getElementById('btnInvestidoUsd');
    const btnCrypto = document.getElementById('btnInvestidoCrypto');
    const unit      = document.getElementById('investidoUnit');
    const input     = document.getElementById('inputAbertura');
    if (btnUsd)    btnUsd.classList.toggle('active', mode === 'usd');
    if (btnUsd)    btnUsd.classList.toggle('btn-primary', mode === 'usd');
    if (btnUsd)    btnUsd.classList.toggle('btn-outline-secondary', mode !== 'usd');
    if (btnCrypto) btnCrypto.classList.toggle('active', mode === 'crypto');
    if (btnCrypto) btnCrypto.classList.toggle('btn-primary', mode === 'crypto');
    if (btnCrypto) btnCrypto.classList.toggle('btn-outline-secondary', mode !== 'crypto');
    if (unit)  unit.textContent  = mode === 'usd' ? 'USD' : 'BTC';
    if (input) input.placeholder = mode === 'usd' ? 'Ex: 5000' : 'Ex: 0.1';
    if (input) input.step        = mode === 'usd' ? '0.01' : '0.00000001';
}

function _initCrypto() {
    initDataTables();
    loadConfig();
    loadOperacoes();
    setupEventListeners();
    setupCardClicks();
    setupFilterButtons();
    setupHistoricoQuickFilters();
}

// Garante inicialização mesmo se layoutReady já disparou antes de este script ser parseado
if (window.__appLayoutReady) {
    _initCrypto();
} else {
    document.addEventListener("layoutReady", _initCrypto);
}

// Recarrega dados ao voltar via BFCache (botão Voltar/Avançar do browser)
window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
        loadOperacoes();
    }
});

function setupEventListeners() {
    document.getElementById("btnNovaOperacao")?.addEventListener("click", openNewModal);
    document.getElementById("btnSaveOperacao")?.addEventListener("click", saveOperacao);
    document.getElementById("btnSaveConfigCrypto")?.addEventListener("click", saveConfig);
    document.getElementById("btnSimularCrypto")?.addEventListener("click", openSimuladorModal);
    document.getElementById("btnCalcularSim")?.addEventListener("click", calcularSimulador);
    document.getElementById("btnAplicarSim")?.addEventListener("click", aplicarSimulacao);
    document.getElementById("btnSimCotacaoLive")?.addEventListener("click", buscarCotacaoSimLive);
    // Atualiza cotação automaticamente ao trocar o par
    document.getElementById("simPar")?.addEventListener("change", buscarCotacaoSimLive);
    // Botão refresh da navbar
    document.getElementById("btnRefresh")?.addEventListener("click", refreshQuotes);
    if (window.ModalAnalise) {
        window.ModalAnalise.configure({
            apiEndpoint: "/api/crypto",
            containerSelector: "#modalAnaliseCryptoContainer",
            modalId: "modalAnalise"
        });
    }
    document.getElementById("btnAnaliseCrypto")?.addEventListener("click", () => {
        if (window.ModalAnalise) window.ModalAnalise.open();
        else iziToast.warning({ title: "Aviso", message: "Modal de analise nao carregado." });
    });

    // ── Cálculos automáticos no formulário de nova/editar operação ──────────
    const calcFormFields = () => {
        const cotacao  = parseFloat(document.getElementById("inputCotacaoAtual")?.value) || 0;
        const strike   = parseFloat(document.getElementById("inputStrike")?.value)       || 0;
        const abertura = parseFloat(document.getElementById("inputAbertura")?.value)     || 0;
        const tae      = parseFloat(document.getElementById("inputTae")?.value)          || 0;
        const prazo    = parseInt(document.getElementById("inputPrazo")?.value)          || 0;
        const tipo     = document.getElementById("inputTipo")?.value                     || "CALL";
        // Distância strike vs cotação atual
        if (cotacao > 0 && strike > 0) {
            const distEl = document.getElementById("inputDistancia");
            const dist   = tipo === "PUT"
                ? ((cotacao - strike) / cotacao * 100)
                : ((strike  - cotacao) / cotacao * 100);
            if (distEl && !distEl.matches(":focus")) distEl.value = dist.toFixed(4);
        }
        // Prêmio = investimento × TAE/100 × prazo/365
        if (abertura > 0 && tae > 0 && prazo > 0) {
            const premio   = abertura * (tae / 100) * (prazo / 365);
            const premioEl = document.getElementById("inputPremioUs");
            if (premioEl && !premioEl.matches(":focus")) premioEl.value = premio.toFixed(6);
            // Resultado % = (prêmio / saldoCrypto) × 100  (% sobre o saldo total na corretora)
            const resultEl = document.getElementById("inputResultado");
            try {
                const _cfg   = JSON.parse(localStorage.getItem(CRYPTO_CFG_KEY) || '{}');
                const _saldo = parseFloat(_cfg.saldoCrypto || 0) || 0;
                const baseCalc = _saldo > 0 ? _saldo : abertura;
                if (resultEl && !resultEl.matches(":focus"))
                    resultEl.value = baseCalc > 0 ? (premio / baseCalc * 100).toFixed(4) : '';
            } catch (_) {
                if (resultEl && !resultEl.matches(":focus"))
                    resultEl.value = abertura > 0 ? (premio / abertura * 100).toFixed(4) : '';
            }
            // Qtd crypto = abertura / cotação_atual
            if (cotacao > 0) {
                const cryptoEl = document.getElementById("inputCrypto");
                if (cryptoEl && !cryptoEl.matches(":focus")) cryptoEl.value = (abertura / cotacao).toFixed(8);
            }
        }
        // Vencimento = data abertura + prazo dias
        const dataAbEl = document.getElementById("inputDataOperacao");
        const exEl     = document.getElementById("inputExercicio");
        if (prazo > 0 && dataAbEl?.value && exEl && !exEl.matches(":focus")) {
            const d = new Date(dataAbEl.value);
            d.setDate(d.getDate() + prazo);
            exEl.value = d.toISOString().slice(0, 10);
        }
        // Dias = prazo (sync)
        const diasEl = document.getElementById("inputDias");
        if (prazo > 0 && diasEl && !diasEl.matches(":focus")) diasEl.value = prazo;
    };
    // Reverso: calc prazo a partir de exercicio e data abertura
    const calcPrazoFromDatas = () => {
        const dataAbEl = document.getElementById("inputDataOperacao");
        const exEl     = document.getElementById("inputExercicio");
        const prazoEl  = document.getElementById("inputPrazo");
        const diasEl   = document.getElementById("inputDias");
        if (dataAbEl?.value && exEl?.value) {
            const d1   = new Date(dataAbEl.value);
            const d2   = new Date(exEl.value);
            if (!isNaN(d1) && !isNaN(d2)) {
                const dias = Math.round((d2 - d1) / 86400000);
                if (prazoEl && !prazoEl.matches(":focus")) prazoEl.value = dias;
                if (diasEl  && !diasEl.matches(":focus"))  diasEl.value  = dias;
            }
        }
    };
    ["inputCotacaoAtual", "inputStrike", "inputAbertura", "inputTae", "inputPrazo",
     "inputTipo", "inputDataOperacao"].forEach(fid => {
        document.getElementById(fid)?.addEventListener("input", calcFormFields);
        document.getElementById(fid)?.addEventListener("change", calcFormFields);
    });
    document.getElementById("inputExercicio")?.addEventListener("input", calcPrazoFromDatas);
    document.getElementById("inputExercicio")?.addEventListener("change", calcPrazoFromDatas);

    // ── Conversão automática Crypto → USD ao sair do campo inputAbertura ────
    document.getElementById("inputAbertura")?.addEventListener("blur", function () {
        if (_investidoMode !== 'crypto') return;
        const qtdCrypto = parseFloat(this.value);
        if (!qtdCrypto || qtdCrypto <= 0) return;
        const cotacao = parseFloat(document.getElementById("inputCotacaoAtual")?.value) || 0;
        if (cotacao <= 0) {
            iziToast.warning({ title: "Aviso", message: "Informe a Cotação Atual para converter Crypto → USD." });
            return;
        }
        this.value = (qtdCrypto * cotacao).toFixed(2);
        setInvestidoMode('usd');
        calcFormFields();
    });

    // ── Reatividade: atualiza UI sempre que o saldo for alterado em qualquer aba ──
    window.addEventListener("storage", e => {
        if (e.key === CRYPTO_CFG_KEY || e.key === "appConfig") updateUI();
    });
    window.addEventListener("cryptoConfigUpdated", () => updateUI());
}

function setupCardClicks() {
    // cardTotalOpsCryptoCard é gerenciado por modal-total-operacoes-crypto.js (initTriggers).
    // Outros cards são tratados pelos modais configurados externamente em crypto.html.
}

function openCryptoDashboardModal(type) {
    const ops    = allOperacoes || [];
    const abertas  = ops.filter(o => (o.status || "ABERTA") === "ABERTA");
    const fechadas = ops.filter(o => (o.status || "") !== "ABERTA");
    const total    = ops.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
    const saldo    = getSaldoCrypto();
    const media    = calcResultadoMedio(ops);

    let title = "", body = "";

    if (type === "total") {
        title = `Total de Operações (${ops.length})`;
        const byStatus = (list, label, cls) => list.length === 0 ? "" : `
            <h6 class="text-${cls} mt-3">${label} (${list.length})</h6>
            <div class="table-responsive"><table class="table table-sm table-hover">
                <thead><tr><th>Ativo</th><th>Tipo</th><th>Strike</th><th>Exercício</th><th>Prêmio</th><th>Resultado</th><th>Status</th></tr></thead>
                <tbody>${list.map(op => {
                    const p = parseFloat(op.premio_us) || 0;
                    const r = parseFloat(op.resultado) || 0;
                    const tipoBadge = op.tipo === "CALL" ? "<span class='badge crypto-badge-call'>CALL</span>" : "<span class='badge crypto-badge-put'>PUT</span>";
                    const stBadge = (op.status||"ABERTA") === "ABERTA"
                    ? "<span class='badge bg-success text-white'>ABERTA</span>"
                    : "<span class='badge bg-azure text-white'>" + (op.status||"FECHADA") + "</span>";
                    return `<tr><td><strong>${op.ativo||"-"}</strong></td><td>${tipoBadge}</td><td>${op.strike ? fmtUsd(op.strike) : "-"}</td><td>${op.exercicio||"-"}</td><td class="${p>=0?"text-success":"text-danger"}">${fmtUsd(p)}</td><td class="${r>=0?"text-success":"text-danger"}">${r.toFixed(2)}%</td><td>${stBadge}</td></tr>`;
                }).join("")}</tbody>
            </table></div>`;
        const wins = ops.filter(o => parseFloat(o.resultado||0) > 0).length;
        body = `
            <div class="row g-3 mb-3">
                <div class="col-4"><div class="card bg-dark-lt text-center p-2"><div class="h4 mb-0">${ops.length}</div><div class="text-muted small">Total</div></div></div>
                <div class="col-4"><div class="card bg-success-lt text-center p-2"><div class="h4 mb-0 text-success">${abertas.length}</div><div class="text-muted small">Abertas</div></div></div>
                <div class="col-4"><div class="card bg-secondary-lt text-center p-2"><div class="h4 mb-0">${fechadas.length}</div><div class="text-muted small">Encerradas</div></div></div>
            </div>
            <div class="mb-2 d-flex gap-3">
                <span class="badge bg-success-lt text-success fs-6">Vitórias: ${wins}/${ops.length} (${ops.length > 0 ? (wins/ops.length*100).toFixed(0) : 0}%)</span>
                <span class="badge bg-info-lt fs-6">Prêmio Total: ${fmtUsd(total)}</span>
            </div>
            ${byStatus(abertas, "Posições Abertas", "success")}
            ${byStatus(fechadas, "Encerradas", "secondary")}`;

    } else if (type === "saldo") {
        title = "Saldo em Crypto";
        const porAtivo = ops.reduce((m, op) => {
            const k = op.ativo || "?";
            if (!m[k]) m[k] = { ops: 0, premioUs: 0, resultados: [] };
            m[k].ops++;
            m[k].premioUs += parseFloat(op.premio_us) || 0;
            const r = parseFloat(op.resultado);
            if (!isNaN(r)) m[k].resultados.push(r);
            return m;
        }, {});
        const rows = Object.entries(porAtivo).map(([ativo, v]) => {
            const mediaRes = v.resultados.length > 0
                ? (v.resultados.reduce((s, x) => s + x, 0) / v.resultados.length)
                : null;
            const pctHtml  = mediaRes !== null
                ? `<span class="${mediaRes >= 0 ? "text-success" : "text-danger"} fw-bold">${mediaRes.toFixed(2)}%</span>`
                : `<span class="text-muted">—</span>`;
            return `<tr>
                <td><strong>${ativo}</strong></td>
                <td>${v.ops}</td>
                <td class="text-success">${fmtUsd(v.premioUs)}</td>
                <td>${pctHtml}</td>
            </tr>`;
        }).join("") || "<tr><td colspan='4' class='text-muted text-center'>Nenhuma operação.</td></tr>";
        body = `
            <div class="row g-3 mb-3">
                <div class="col-6"><div class="card text-center p-3"><div class="h3 mb-0 text-primary">${fmtUsd(saldo)}</div><div class="text-muted">Saldo Configurado</div></div></div>
                <div class="col-6"><div class="card text-center p-3"><div class="h3 mb-0 text-success">${fmtUsd(total)}</div><div class="text-muted">Total em Prêmios</div></div></div>
            </div>
            <h6 class="mt-3">Por Ativo</h6>
            <div class="table-responsive"><table class="table table-sm table-hover">
                <thead><tr><th>Ativo</th><th>Operações</th><th>Prêmio Acumulado</th><th>% Lucro Médio</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>`;

    } else if (type === "premio") {
        title = "Prêmio Total";
        // Agrupar por mês
        const byMonth = groupByMonth(ops);
        const rows = Object.keys(byMonth).sort().reverse().map(month => {
            const d = byMonth[month];
            const p = d.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
            return `<tr><td>${getMonthName(month)}</td><td>${d.length}</td><td class="${p>=0?"text-success":"text-danger"}">${fmtUsd(p)}</td></tr>`;
        }).join("") || "<tr><td colspan='3' class='text-muted text-center'>Sem dados.</td></tr>";
        body = `
            <div class="row g-3 mb-3">
                <div class="col-6"><div class="card text-center p-3"><div class="h3 mb-0 text-success">${fmtUsd(total)}</div><div class="text-muted">Total Acumulado</div></div></div>
                <div class="col-6"><div class="card text-center p-3"><div class="h3 mb-0">${fmtUsd(total / (Object.keys(byMonth).length || 1))}</div><div class="text-muted">Média por Mês</div></div></div>
            </div>
            <h6 class="mt-3">Por Mês</h6>
            <div class="table-responsive"><table class="table table-sm table-hover">
                <thead><tr><th>Mês</th><th>Ops</th><th>Prêmio</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>`;

    } else if (type === "media") {
        title = "Resultado Médio";
        const byMonth = groupByMonth(ops);
        const sortedMonths = Object.keys(byMonth).sort().reverse();
        let cumulative = 0;
        const rows = sortedMonths.map(month => {
            const d = byMonth[month];
            const p = d.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
            const m = calcResultadoMedio(d);
            cumulative += p;
            const barPct = Math.min(100, Math.abs(m) * 10);
            const barCls = m >= 5 ? "bg-green" : m >= 2 ? "bg-blue" : m >= 0 ? "bg-yellow" : "bg-red";
            return `<tr>
                <td>${getMonthName(month).split("-")[0]}</td>
                <td>${d.length}</td>
                <td class="${p>=0?"text-success":"text-danger"}">${fmtUsd(p)}</td>
                <td class="${m>=0?"text-success":"text-danger"}">${m.toFixed(2)}%</td>
                <td><div class="d-flex align-items-center"><div class="progress progress-sm flex-grow-1 me-2"><div class="progress-bar ${barCls}" style="width:${barPct}%"></div></div><span class="small text-muted">${m.toFixed(1)}%</span></div></td>
            </tr>`;
        }).join("") || "<tr><td colspan='5' class='text-muted text-center'>Sem dados.</td></tr>";
        const wins = ops.filter(o => parseFloat(o.resultado||0) > 0).length;
        body = `
            <div class="row g-3 mb-3">
                <div class="col-4"><div class="card text-center p-2"><div class="h4 mb-0 text-success">${media.toFixed(2)}%</div><div class="text-muted small">Média Geral</div></div></div>
                <div class="col-4"><div class="card text-center p-2"><div class="h4 mb-0">${ops.length > 0 ? (wins/ops.length*100).toFixed(0) : 0}%</div><div class="text-muted small">Taxa de Acerto</div></div></div>
                <div class="col-4"><div class="card text-center p-2"><div class="h4 mb-0">${fmtUsd(total / (sortedMonths.length || 1))}</div><div class="text-muted small">Média mensal</div></div></div>
            </div>
            <h6 class="mt-3">Rentabilidade por Mês</h6>
            <div class="table-responsive"><table class="table table-sm table-hover">
                <thead><tr><th>Mês</th><th>Ops</th><th>Prêmio</th><th>Resultado</th><th>Rentabilidade</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>`;
    }

    // Reutilizar modalDetalhesCrypto
    const modalBody  = document.getElementById("modalDetalhesBody");
    const modalTitle = document.getElementById("modalDetalhesTitle");
    const editBtn    = document.getElementById("modalDetalhesEditBtn");
    if (modalBody && modalTitle) {
        modalTitle.textContent = title;
        modalBody.innerHTML    = body;
        if (editBtn) editBtn.style.display = "none";
        new bootstrap.Modal(document.getElementById("modalDetalhesCrypto")).show();
    }
}

function setupFilterButtons() {
    document.querySelectorAll(".crypto-filter-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".crypto-filter-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentFilterCrypto = this.dataset.filter || "all";
            applyStatusFilterMesAtual();
        });
    });
}

function applyStatusFilterMesAtual() {
    if (!tableMesAtual) return;
    const statusCol = tableMesAtual.column(14);

    if (currentFilterCrypto === "all") {
        statusCol.search("", false, false).draw();
        return;
    }

    if (currentFilterCrypto === "ABERTA") {
        statusCol.search("^ABERTA$", true, false).draw();
        return;
    }

    if (currentFilterCrypto === "FECHADA") {
        statusCol.search("FECHADA|EXERCIDA|ENCERRADA", true, false).draw();
        return;
    }

    statusCol.search(currentFilterCrypto, false, false).draw();
}

function initDataTables() {
    const dtConfig = {
        language: { url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json" },
        pageLength: 10,
        responsive: false,
        scrollX: true,
        autoWidth: false,
        order: [[10, "desc"]],
        columnDefs: [
            { targets: 15, orderable: false },
            { targets: [0,1,13,14,15], width: "auto" }
        ]
    };
    tableMesAtual  = $('#tableMesAtual').DataTable(dtConfig);
    tableHistorico = $('#tableHistorico').DataTable({ ...dtConfig, order: [] });
    registerHistoricoQuickFilter();
    // Recalcula larguras das colunas apenas nas tabs principais da tela crypto
    document.querySelectorAll('#cryptoTabs a[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', () => {
            tableMesAtual?.columns.adjust();
            tableHistorico?.columns.adjust();
        });
    });
}

async function loadOperacoes(attempt) {
    attempt = attempt || 0;
    try {
        const res = await fetch(API_BASE + "/api/crypto", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        allOperacoes = await res.json();
        window.cryptoOperacoes = allOperacoes;
        updateUI();
        refreshCryptoCotacoes();
        updateCryptoMarketStatus();
    } catch (e) {
        console.error("[crypto] Erro ao carregar (tentativa " + (attempt + 1) + "):", e);
        if (attempt < 3) {
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            console.log("[crypto] Retentando em " + (delay / 1000) + "s...");
            setTimeout(function() { loadOperacoes(attempt + 1); }, delay);
        } else {
            iziToast.error({ title: "Erro", message: "Servidor indisponível. Verifique se o Flask está rodando." });
        }
    }
}

function updateUI() {
    const currentMonth = getCurrentMonth();
    const currentYear  = new Date().getFullYear().toString();
    const mesAtualData = filterByMonth(allOperacoes, currentMonth);
    const anoData      = filterByYear(allOperacoes, currentYear);
    const saldo        = getSaldoCrypto();
    const totalPremios = allOperacoes.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
    const aberturaMed  = calcResultadoMedio(allOperacoes);

    // Saldo: usa o configurado; se zero, exibe total capital nas posições abertas
    const abertasOps   = allOperacoes.filter(o => (o.status || "ABERTA") === "ABERTA");
    // Valora investido: novo formato -> abertura(preço) × crypto(qtd); antigo -> abertura era USD direto
    const totalAbertura = abertasOps.reduce((s, o) => {
        const abr = parseFloat(o.abertura) || 0;
        const cot = parseFloat(o.cotacao_atual) || 0;
        const qty = parseFloat(o.crypto) || 0;
        if (abr > 0 && cot > 0 && abr < cot * 0.1) return s + abr;  // formato antigo (USD)
        return s + (abr > 0 && qty > 0 ? abr * qty : abr);           // formato novo (preço × qtd)
    }, 0);
    const saldoDisplay  = saldo > 0 ? saldo : totalAbertura;
    document.getElementById("cardTotalOps").textContent       = allOperacoes.length;
    document.getElementById("cardSaldoCrypto").textContent    = fmtUsd(saldoDisplay);
    document.getElementById("cardTotalPremios").textContent   = fmtUsd(totalPremios);
    document.getElementById("cardResultadoMedio").textContent = aberturaMed.toFixed(2) + "%";

    const mesPremio  = mesAtualData.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
    const mesResult  = calcResultadoMedio(mesAtualData);
    const mesAbertas = mesAtualData.filter(o => !o.status || o.status === "ABERTA").length;

    document.getElementById("mesAtualHeader").innerHTML = `
        <div class="col-12 mb-2">
            <h4 class="d-inline">${getMonthName(currentMonth)}</h4>
            <span class="ms-2 badge bg-primary">Mes Atual</span>
        </div>
        <div class="col-md-3 col-sm-6 mb-2">
            <div class="text-muted small">Total Operacoes</div>
            <div class="fw-bold">${mesAtualData.length}</div>
        </div>
        <div class="col-md-3 col-sm-6 mb-2">
            <div class="text-muted small">Premio Mes (US$)</div>
            <div class="fw-bold text-success">${fmtUsd(mesPremio)}</div>
        </div>
        <div class="col-md-3 col-sm-6 mb-2">
            <div class="text-muted small">Resultado Medio</div>
            <div class="fw-bold text-success">${mesResult.toFixed(2)}%</div>
        </div>
        <div class="col-md-3 col-sm-6 mb-2">
            <div class="text-muted small">Operacoes Abertas</div>
            <div class="fw-bold text-primary">${mesAbertas}</div>
        </div>`;

    document.getElementById("mesAtualTitle").textContent = "Operacoes - " + getMonthName(currentMonth);
    populateTable(tableMesAtual,  mesAtualData, { prioritizeOpen: true });
    populateTable(tableHistorico, allOperacoes, { prioritizeOpen: false });
    renderHistoricoMensal();
    renderChartAnual(anoData, currentYear);
    // Reaplica filtro de status ativo após recarregar a tabela
    applyStatusFilterMesAtual();
}

function fmtUsd(v) {
    return "US$ " + (parseFloat(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcResultadoMedio(ops) {
    const validas = ops.filter(o => o.abertura && o.premio_us);
    if (!validas.length) return 0;
    const soma = validas.reduce((s, o) => s + ((parseFloat(o.premio_us) || 0) / (parseFloat(o.abertura) || 1) * 100), 0);
    return soma / validas.length;
}

function getSaldoCrypto() {
    try {
        // Prioriza cryptoConfig; fallback para appConfig (modal configurações global)
        const cfg = JSON.parse(localStorage.getItem(CRYPTO_CFG_KEY) || '{}');
        let s = parseFloat(cfg.saldoCrypto || 0) || 0;
        if (!s) {
            const app = JSON.parse(localStorage.getItem('appConfig') || '{}');
            s = parseFloat(app.saldoCrypto || 0) || 0;
        }
        return s;
    } catch { return 0; }
}

function getOpEventDate(op) {
    const raw = op?.exercicio || op?.vencimento || op?.data_operacao || op?.created_at || op?.data_fechamento;
    if (!raw) return null;
    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function isTypeExercised(op, type) {
    const opType = String(op?.tipo || '').toUpperCase();
    if (opType !== type) return false;
    const exStatus = String(op?.exercicio_status || '').toUpperCase();
    const status = String(op?.status || '').toUpperCase();
    if (exStatus === 'SIM' || status === 'EXERCIDA') return true;

    const strike = parseFloat(op?.strike || 0);
    const current = parseFloat(op?.cotacao_atual || 0);
    if (!strike || !current) return false;
    if (type === 'CALL') return current >= strike;
    if (type === 'PUT') return current <= strike;
    return false;
}

function computeRecoverySnapshot(opsSource) {
    const ops = Array.isArray(opsSource) ? opsSource : (allOperacoes || []);
    const sorted = ops
        .map(op => ({ op, eventDate: getOpEventDate(op) }))
        .filter(item => !!item.eventDate)
        .sort((a, b) => a.eventDate - b.eventDate);

    const calls = sorted.filter(item => isTypeExercised(item.op, 'CALL'));
    const puts = sorted.filter(item => isTypeExercised(item.op, 'PUT'));
    const lastCall = calls.length ? calls[calls.length - 1] : null;
    const lastPut = puts.length ? puts[puts.length - 1] : null;

    if (!lastCall) {
        return { hasCycle: false, hasLoss: false, reason: 'Sem CALL exercida no histórico.' };
    }

    const callStrike = parseFloat(lastCall.op.strike || 0) || 0;
    const putStrike = lastPut ? (parseFloat(lastPut.op.strike || 0) || 0) : 0;

    const premiumsBetween = sorted
        .filter(item => {
            if (item.eventDate <= lastCall.eventDate) return false;
            if (lastPut && item.eventDate >= lastPut.eventDate) return false;
            return true;
        })
        .reduce((acc, item) => acc + (parseFloat(item.op.premio_us) || 0), 0);

    const adjustedCall = callStrike - premiumsBetween;
    const diff = lastPut ? (putStrike - adjustedCall) : null;
    const diffPct = Number.isFinite(diff) && adjustedCall !== 0 ? (diff / adjustedCall) * 100 : null;
    const hasLoss = Number.isFinite(diff) ? diff < 0 : false;
    const lossValue = hasLoss ? Math.abs(diff) : 0;

    const premiumsAfterPut = lastPut
        ? sorted
            .filter(item => item.eventDate > lastPut.eventDate)
            .reduce((acc, item) => acc + (parseFloat(item.op.premio_us) || 0), 0)
        : 0;

    const recovered = Math.max(0, premiumsAfterPut);
    const missing = Math.max(0, lossValue - recovered);
    const progressPct = lossValue > 0 ? Math.min(100, (recovered / lossValue) * 100) : 100;

    return {
        hasCycle: true,
        hasLoss,
        lastCall,
        lastPut,
        callStrike,
        putStrike,
        premiumsBetween,
        adjustedCall,
        diff,
        diffPct,
        lossValue,
        recovered,
        missing,
        progressPct
    };
}

function notifyRecoveryLossContext(contextLabel) {
    const snapshot = computeRecoverySnapshot();
    if (!snapshot.hasLoss) return snapshot;
    iziToast.warning({
        title: 'Prejuízo pendente',
        message: `${contextLabel}: falta cobrir ${fmtUsd(snapshot.missing)} (${snapshot.progressPct.toFixed(2)}% coberto).`
    });
    return snapshot;
}

function populateTable(dt, data, options) {
    if (!dt) return; // DataTable não inicializado ainda
    const cfg = options || {};
    const prioritizeOpen = cfg.prioritizeOpen !== false;
    dt.clear();
    [...data].sort((a, b) => {
        if (prioritizeOpen) {
            const aOpen = (a.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
            const bOpen = (b.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
            if (aOpen !== bOpen) return aOpen - bOpen;
        }
        return new Date(b.exercicio || b.data_operacao || 0) - new Date(a.exercicio || a.data_operacao || 0);
    }).forEach(op => {
        const pct = (op.abertura && op.premio_us)
            ? ((parseFloat(op.premio_us) / parseFloat(op.abertura)) * 100).toFixed(2) + "%"
            : "-";
        const tipoBadge   = op.tipo === "CALL" ? "<span class=\"badge crypto-badge-call\">CALL</span>" : "<span class=\"badge crypto-badge-put\">PUT</span>";
        // Calcula exercício: usa campo do banco; se ausente, deriva de tipo/cotacao/strike
        let exStatus = op.exercicio_status;
        if (!exStatus && op.tipo && op.cotacao_atual && op.strike) {
            const _cot = parseFloat(op.cotacao_atual);
            const _str = parseFloat(op.strike);
            if (_cot > 0 && _str > 0) {
                exStatus = op.tipo === "CALL" ? (_cot >= _str ? "SIM" : "NAO") : (_cot <= _str ? "SIM" : "NAO");
            }
        }
        const exBadge = exStatus === "SIM" ? "<span class=\"badge bg-warning text-dark\">SIM</span>" : "<span class=\"badge bg-secondary text-white\">NÃO</span>";
        const status      = op.status || "ABERTA";
        const statusBadge = status === "ABERTA"
            ? "<span class=\"badge bg-success text-white\">ABERTA</span>"
            : status === "FECHADA"
                ? "<span class=\"badge bg-azure text-white\">FECHADA</span>"
                : "<span class=\"badge bg-danger text-white\">" + status + "</span>";
        const resultado   = parseFloat(op.resultado) || 0;
        const resHtml     = op.resultado != null ? "<span class=\"" + (resultado >= 0 ? "text-success" : "text-danger") + "\">" + resultado.toFixed(2) + "%</span>" : "-";
        dt.row.add([
            "<span class=\"badge bg-warning text-dark\" style=\"cursor:pointer\" title=\"Análise completa\" onclick=\"if(window.ModalAnaliseCrypto)window.ModalAnaliseCrypto.open(" + op.id + ")\">" + (op.ativo || "-") + "</span>",
            tipoBadge,
            op.cotacao_atual ? fmtUsd(op.cotacao_atual) : "-",
            op.abertura      ? fmtUsd(op.abertura)      : "-",
            op.tae           ? parseFloat(op.tae).toFixed(2) + "%" : "-",
            op.strike        ? fmtUsd(op.strike)         : "-",
            op.distancia     ? parseFloat(op.distancia).toFixed(2) + "%" : "-",
            op.premio_us     ? fmtUsd(op.premio_us)      : "-",
            pct, resHtml,
            op.exercicio     ? formatDateCell(op.exercicio) : "-",
            (() => { const d = calcularDuracaoDias(getCurrentDate(), op.exercicio); return d !== null ? d + "d" : (op.prazo ? op.prazo + "d" : "-"); })(),
            op.crypto        ? parseFloat(op.crypto).toFixed(6) : "-",
            exBadge, statusBadge,
            "<div class=\"btn-list flex-nowrap\">" +
            "<button class=\"btn btn-sm btn-info btn-icon\" onclick=\"showDetalhes(" + op.id + ")\" title=\"Detalhes\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/></svg></button>" +
            (status === "ABERTA" ? "<button class=\"btn btn-sm btn-warning btn-icon\" onclick=\"fecharOperacao(" + op.id + ")\" title=\"Fechar Operação\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/></svg></button>" : "") +
            (status === "ABERTA" ? "<button class=\"btn btn-sm btn-primary btn-icon\" onclick=\"editOperacao(" + op.id + ")\" title=\"Editar\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/></svg></button>" : "") +
            "<button class=\"btn btn-sm btn-danger btn-icon\" onclick=\"deleteOperacao(" + op.id + ")\" title=\"Excluir\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/></svg></button>" +
            "</div>"
        ]);
    });
    dt.draw();
    dt.columns.adjust();
}

function setupHistoricoQuickFilters() {
    document.querySelectorAll(".history-filter-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            const group = this.dataset.filterGroup;
            const value = this.dataset.filterValue;
            if (!group || !value) return;

            document.querySelectorAll(`.history-filter-btn[data-filter-group="${group}"]`).forEach(item => {
                item.classList.remove("active");
            });
            this.classList.add("active");

            historicoQuickFilter[group] = value;
            tableHistorico?.draw();
        });
    });
}

function registerHistoricoQuickFilter() {
    if (historicoFilterRegistered || !window.jQuery || !$.fn?.dataTable?.ext?.search) return;
    historicoFilterRegistered = true;

    $.fn.dataTable.ext.search.push(function (settings, data) {
        if (settings?.nTable?.id !== "tableHistorico") return true;

        const tipo = normalizeTableCell(data[1]);
        const vencimento = parseDateFromTableCell(data[10]);
        const status = normalizeTableCell(data[14]);

        if (historicoQuickFilter.tipo !== "all" && tipo !== historicoQuickFilter.tipo) {
            return false;
        }

        if (historicoQuickFilter.status === "ABERTA" && status !== "ABERTA") {
            return false;
        }
        if (historicoQuickFilter.status === "FECHADA" && !(status === "FECHADA" || status === "EXERCIDA" || status === "ENCERRADA")) {
            return false;
        }

        return matchPeriodoFilter(vencimento, historicoQuickFilter.periodo);
    });
}

function normalizeTableCell(rawValue) {
    return String(rawValue || "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim()
        .toUpperCase();
}

function parseDateFromTableCell(rawValue) {
    const text = normalizeTableCell(rawValue);
    const parts = text.split("/");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!day || !month || !year) return null;
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
}

function matchPeriodoFilter(date, periodo) {
    if (periodo === "all") return true;
    if (!date) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (periodo === "today") {
        return date.getTime() === today.getTime();
    }

    if (periodo === "month") {
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    }

    if (periodo === "year") {
        return date.getFullYear() === today.getFullYear();
    }

    if (periodo === "12m") {
        const from = new Date(today);
        from.setMonth(from.getMonth() - 12);
        return date >= from && date <= today;
    }

    if (periodo.endsWith("d")) {
        const days = parseInt(periodo, 10);
        if (Number.isNaN(days)) return true;
        const from = new Date(today);
        from.setDate(from.getDate() - days);
        return date >= from && date <= today;
    }

    return true;
}

function renderHistoricoMensal() {
    const grouped = groupByMonth(allOperacoes);
    const months  = Object.keys(grouped).sort().reverse();
    let html = "";
    months.forEach(month => {
        const data   = grouped[month];
        const premio = data.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
        const medio  = calcResultadoMedio(data);
        html += "<div class=\"card mb-2\"><div class=\"card-body py-2\"><div class=\"row align-items-center\"><div class=\"col-md-2 col-6\"><strong>" + getMonthName(month) + "</strong></div><div class=\"col-md-2 col-6\"><span class=\"text-muted small\">Ops:</span> <span class=\"fw-bold\">" + data.length + "</span></div><div class=\"col-md-3 col-6\"><span class=\"text-muted small\">Premio:</span> <span class=\"fw-bold text-success\">" + fmtUsd(premio) + "</span></div><div class=\"col-md-2 col-6\"><span class=\"text-muted small\">Media:</span> <span class=\"fw-bold text-success\">" + medio.toFixed(2) + "%</span></div></div></div></div>";
    });
    document.getElementById("historicoContainer").innerHTML = html || "<div class=\"text-muted text-center py-4\">Nenhum historico disponivel.</div>";
}

function renderChartAnual(data, year) {
    const grouped = groupByMonth(data);
    const labels  = [], values = [], colors = [];
    for (let i = 1; i <= 12; i++) {
        const k = year + "-" + String(i).padStart(2, "0");
        const d = grouped[k] || [];
        const p = d.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
        labels.push(getMonthName(k).slice(0, 3));
        values.push(p);
        colors.push(p > 0 ? "rgba(47,179,68,0.75)" : "rgba(100,100,120,0.4)");
    }
    const anoTotal = data.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
    const anoMedio = calcResultadoMedio(data);
    const anualHeaderEl = document.getElementById("anualHeader");
    if (anualHeaderEl) {
        anualHeaderEl.innerHTML = `
            <div class="col-12 mb-2"><h3 class="d-inline">${year}</h3><span class="ms-2 badge bg-info text-dark">Resultado Anual</span></div>
            <div class="col-md-3 col-sm-6 mb-2"><div class="text-muted small">Total Operações</div><div class="fw-bold">${data.length}</div></div>
            <div class="col-md-3 col-sm-6 mb-2"><div class="text-muted small">Prêmio Total</div><div class="fw-bold text-success">${fmtUsd(anoTotal)}</div></div>
            <div class="col-md-3 col-sm-6 mb-2"><div class="text-muted small">Resultado Médio</div><div class="fw-bold text-success">${anoMedio.toFixed(2)}%</div></div>
            <div class="col-md-3 col-sm-6 mb-2"><div class="text-muted small">Média por Mês</div><div class="fw-bold">${fmtUsd(anoTotal / 12)}</div></div>`;
    }
    const ctx = document.getElementById("chartAnual").getContext("2d");
    if (chartAnual) chartAnual.destroy();
    chartAnual = new Chart(ctx, {
        type: "bar",
        data: { labels, datasets: [{ label: "Premio US$", data: values, backgroundColor: colors, borderRadius: 6 }] },
        options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => "US$ " + c.parsed.y.toFixed(2) } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => "US$ " + v.toFixed(0) } } } }
    });

    // ─── Resumo Mensal (padrão opcoes: tabela com barra de progresso) ───────
    const resumoCont = document.getElementById("anualResumoContainer");
    if (resumoCont) {
        let rows = "", totalOps = 0, totalPremios = 0, totalResultado = 0, totalWins = 0;
        let cumulative = 0;
        const saldoCrypto = getSaldoCrypto() || 1;
        const sortedMonths = [];
        for (let i = 1; i <= 12; i++) sortedMonths.push(year + "-" + String(i).padStart(2, "0"));

        sortedMonths.forEach(month => {
            const ops = grouped[month] || [];
            if (!ops.length) return;
            const premio     = ops.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
            const resultado  = ops.reduce((s, o) => s + (parseFloat(o.resultado)  || 0), 0);
            const wins       = ops.filter(o => parseFloat(o.resultado || 0) > 0).length;
            const taxaAcerto = ops.length > 0 ? (wins / ops.length * 100) : 0;
            const rentabilidade = saldoCrypto > 0 ? (premio / saldoCrypto * 100) : 0;
            const rentAbs    = Math.min(100, Math.abs(rentabilidade));
            const rentBarCls = rentabilidade >= 5 ? "bg-green" : rentabilidade >= 2 ? "bg-blue" : rentabilidade >= 0 ? "bg-yellow" : "bg-red";
            cumulative      += premio;
            totalOps        += ops.length;
            totalPremios    += premio;
            totalResultado  += resultado;
            totalWins       += wins;

            rows += `<tr class="cursor-pointer" onclick="showCryptoMonthOps(${year}, '${month}')" style="cursor:pointer" title="Clique para ver detalhes">
                <td>${getMonthName(month).split("-")[0]}</td>
                <td class="text-end">${ops.length}</td>
                <td class="text-end ${premio >= 0 ? "text-success" : "text-danger"}">${fmtUsd(premio)}</td>
                <td class="text-end ${resultado >= 0 ? "text-success" : "text-danger"}">${resultado.toFixed(2)}%</td>
                <td class="text-end">${taxaAcerto.toFixed(0)}%</td>
                <td class="text-end ${cumulative >= 0 ? "text-success" : "text-danger"}">${fmtUsd(cumulative)}</td>
                <td onclick="showCryptoMonthOps(${year}, '${month}'); event.stopPropagation();" style="cursor:pointer">
                    <div class="d-flex align-items-center">
                        <div class="progress progress-sm flex-grow-1 me-2" style="pointer-events:none">
                            <div class="progress-bar ${rentBarCls}" style="width:${rentAbs.toFixed(0)}%"></div>
                        </div>
                        <span class="text-muted small">${rentabilidade.toFixed(2)}%</span>
                    </div>
                </td>
            </tr>`;
        });

        resumoCont.innerHTML = `
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h3 class="card-title mb-0">📊 Resumo Mensal ${year}</h3>
            <div class="text-muted small">${totalOps} ops · ${fmtUsd(totalPremios)} prêmio · ${totalWins > 0 ? (totalWins / totalOps * 100).toFixed(0) + "% acerto" : ""}</div>
          </div>
          <div class="table-responsive">
            <table class="table table-vcenter table-hover card-table">
              <thead><tr>
                <th>Mês</th><th class="text-end">Ops</th><th class="text-end">Prêmio</th>
                <th class="text-end">Resultado</th><th class="text-end">Acerto</th>
                <th class="text-end">Acumulado</th><th>Rentabilidade</th>
              </tr></thead>
              <tbody>${rows || '<tr><td colspan="7" class="text-muted text-center py-3">Nenhuma operação encerrada neste ano.</td></tr>'}</tbody>
            </table>
          </div>
        </div>`;
    }

        // ─── Operações Detalhadas por mês (accordion) ───────────────────────────
    const tabelaCont = document.getElementById("anualTabelaContainer");
    if (tabelaCont) {
        const sortedMonths = [];
        for (let i = 1; i <= 12; i++) sortedMonths.push(year + "-" + String(i).padStart(2, "0"));

        let accItems = "";
        sortedMonths.forEach(month => {
            const ops = grouped[month] || [];
            if (!ops.length) return;
            const monthPremio = ops.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
            const monthName   = getMonthName(month).split("-")[0];
            const safeId      = month.replace("-", "_");

            let opRows = "";
            [...ops].sort((a, b) => {
                const aOpen = (a.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
                const bOpen = (b.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
                if (aOpen !== bOpen) return aOpen - bOpen;
                return new Date(b.exercicio || b.data_operacao || 0) - new Date(a.exercicio || a.data_operacao || 0);
            }).forEach(op => {
                const premio = parseFloat(op.premio_us) || 0;
                const result = parseFloat(op.resultado) || 0;
                const tipoBadge  = op.tipo === "CALL"
                    ? "<span class='badge crypto-badge-call'>CALL</span>"
                    : "<span class='badge crypto-badge-put'>PUT</span>";
                const statusBadge = (op.status || "ABERTA") === "ABERTA"
                    ? `<span class="badge bg-success text-white">${op.status || "ABERTA"}</span>`
                    : `<span class="badge bg-azure text-white">${op.status || "FECHADA"}</span>`;
                opRows += `<tr>
                    <td>${op.data_operacao || "-"}</td>
                    <td><strong style="cursor:pointer;color:#4299e1" onclick="if(window.ModalAnaliseCrypto)window.ModalAnaliseCrypto.open(${op.id})" title="Análise completa">${op.ativo || "-"}</strong></td>
                    <td>${tipoBadge}</td>
                    <td>${op.strike ? fmtUsd(op.strike) : "-"}</td>
                    <td>${op.exercicio || "-"}</td>
                    <td class="${premio >= 0 ? "text-success" : "text-danger"}">${fmtUsd(premio)}</td>
                    <td class="${result >= 0 ? "text-success" : "text-danger"}">${result.toFixed(2)}%</td>
                    <td>${statusBadge}</td>
                    <td>
                      <div class="btn-list flex-nowrap">
                        <button class="btn btn-sm btn-info btn-icon" onclick="showDetalhes(${op.id})" title="Detalhes">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        </button>
                      </div>
                    </td>
                </tr>`;
            });

            accItems += `<div class="accordion-item border-0 mb-2">
  <h2 class="accordion-header" id="anualAH-${safeId}">
    <button class="accordion-button collapsed rounded py-2" type="button"
            data-bs-toggle="collapse" data-bs-target="#anualAP-${safeId}"
            aria-expanded="false" aria-controls="anualAP-${safeId}"
            style="background:rgba(66,153,225,0.06)">
      <span class="fw-bold me-2">${monthName} ${year}</span>
      <span class="badge bg-blue-lt text-blue me-2">${ops.length} op${ops.length !== 1 ? "s" : ""}</span>
      <span class="text-success fw-bold ms-auto me-3">${fmtUsd(monthPremio)}</span>
    </button>
  </h2>
  <div id="anualAP-${safeId}" class="accordion-collapse collapse" aria-labelledby="anualAH-${safeId}">
    <div class="accordion-body p-0">
      <div class="table-responsive">
        <table class="table table-vcenter table-hover table-sm card-table mb-0">
          <thead><tr>
            <th>Abertura</th><th>Ativo</th><th>Tipo</th><th>Strike</th>
            <th>Exercício</th><th>Prêmio</th><th>Resultado</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>${opRows}</tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;
        });

        tabelaCont.innerHTML = accItems
            ? `<div class="card mt-3">
                 <div class="card-header"><h3 class="card-title mb-0">📋 Operações Detalhadas ${year}</h3></div>
                 <div class="card-body p-2">
                   <div class="accordion" id="anualOpsAcc">${accItems}</div>
                 </div>
               </div>`
            : "";
    }

    // ─── Evolução do Resultado (linha acumulada) ─────────────────────────────
    const extraCont = document.getElementById("anualExtraCharts");
    if (extraCont) {
        const evolLabels = [], evolValues = [], evolColors = [];
        let evolCum = 0;
        const sortedMonthsEvol = [];
        for (let i = 1; i <= 12; i++) sortedMonthsEvol.push(year + "-" + String(i).padStart(2, "0"));
        let hasSomeData = false;
        sortedMonthsEvol.forEach(month => {
            const d = grouped[month] || [];
            const monthPremiio = d.reduce((s, o) => s + (parseFloat(o.premio_us) || 0), 0);
            evolCum += monthPremiio;
            evolLabels.push(getMonthName(month).slice(0, 3));
            evolValues.push(parseFloat(evolCum.toFixed(2)));
            evolColors.push(evolCum > 0 ? "rgba(47,179,68,0.9)" : "rgba(250,82,82,0.9)");
            if (monthPremiio > 0) hasSomeData = true;
        });
        const evolId = "chartEvolAnual_" + year;
        extraCont.innerHTML = `
        <div class="col-12">
          <div class="card">
            <div class="card-header"><h3 class="card-title mb-0">\uD83D\uDCC8 Evolu\u00e7\u00e3o do Resultado Acumulado ${year}</h3></div>
            <div class="card-body" style="min-height:200px">${hasSomeData
                ? `<canvas id="${evolId}" style="max-height:220px"></canvas>`
                : `<div class="d-flex align-items-center justify-content-center h-100 text-muted py-5">Sem dados de prêmio registrados ainda.</div>`
            }</div>
          </div>
        </div>`;
        if (hasSomeData) {
            setTimeout(() => {
                const evolCtx = document.getElementById(evolId);
                if (evolCtx && !evolCtx._chartRendered) {
                    evolCtx._chartRendered = true;
                    new Chart(evolCtx.getContext("2d"), {
                        type: "line",
                        data: {
                            labels: evolLabels,
                            datasets: [{
                                label: "Acumulado US$",
                                data: evolValues,
                                borderColor: "rgba(47,179,68,0.9)",
                                backgroundColor: "rgba(47,179,68,0.12)",
                                fill: true, tension: 0.35, pointRadius: 5,
                                pointBackgroundColor: evolColors
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: { callbacks: { label: c => "US$ " + c.parsed.y.toFixed(2) } }
                            },
                            scales: {
                                y: {
                                    ticks: { callback: v => "US$ " + v.toFixed(0) },
                                    grid: { color: "rgba(255,255,255,0.05)" }
                                }
                            }
                        }
                    });
                }
            }, 150);
        }
    }
}

// Mostra operações de um mês no modal de detalhes (chamado ao clicar no Resumo Mensal)
function showCryptoMonthOps(year, monthKey) {
    // Expande o item do accordion correspondente ao mês clicado (anualTabelaContainer)
    // em vez de abrir modal — o accordion já contém todas as operações detalhadas
    const safeId = monthKey.replace("-", "_");
    const collapseEl = document.getElementById("anualAP-" + safeId);
    if (collapseEl) {
        // Fecha todos os outros itens do accordion
        document.querySelectorAll("#anualOpsAcc .accordion-collapse.show").forEach(el => {
            if (el !== collapseEl) bootstrap.Collapse.getOrCreateInstance(el).hide();
        });
        // Expande o item do mês selecionado
        bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: true }).show();
        // Scroll suave até o accordion
        setTimeout(() => collapseEl.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
}



function openNewModal() {
    notifyRecoveryLossContext('Nova operação');
    document.getElementById("modalOperacaoTitle").textContent = "Nova Operacao";
    document.getElementById("formOperacao").reset();
    document.getElementById("operacaoId").value = "";
    document.getElementById("inputDataOperacao").value = getCurrentDate();
    new bootstrap.Modal(document.getElementById("modalOperacao")).show();
}

function editOperacao(id) {
    const op = allOperacoes.find(o => o.id === id);
    if (!op) return;
    if ((op.status || 'ABERTA').toUpperCase() === 'FECHADA') {
        iziToast.warning({ title: 'Aviso', message: 'Operações fechadas não podem ser editadas.' });
        return;
    }
    document.getElementById("modalOperacaoTitle").textContent = "Editar Operacao";
    document.getElementById("operacaoId").value              = op.id;
    document.getElementById("inputAtivo").value              = op.ativo || "BTC";
    document.getElementById("inputTipo").value               = op.tipo || "CALL";
    document.getElementById("inputStatus").value             = op.status || "ABERTA";
    document.getElementById("inputDataOperacao").value       = op.data_operacao || "";
    // Valor Investido (USD) derivado: novo formato = preço × qtd; antigo = abertura era USD
    (() => {
        const abr = parseFloat(op.abertura) || 0;
        const cot = parseFloat(op.cotacao_atual) || 0;
        const qty = parseFloat(op.crypto) || 0;
        const isOldFormat = abr > 0 && cot > 0 && abr < cot * 0.1;
        document.getElementById("inputAbertura").value = isOldFormat
            ? abr.toFixed(2)
            : (abr > 0 && qty > 0 ? (abr * qty).toFixed(2) : (abr || ""));
    })();
    document.getElementById("inputStrike").value             = op.strike || "";
    document.getElementById("inputTae").value                = op.tae || "";
    document.getElementById("inputPrazo").value              = op.prazo || "";
    document.getElementById("inputExercicio").value          = op.exercicio || "";
    document.getElementById("inputCotacaoAtual").value       = op.cotacao_atual || "";
    document.getElementById("inputDistancia").value          = op.distancia || "";
    document.getElementById("inputDias").value               = op.dias || "";
    document.getElementById("inputPremioUs").value           = op.premio_us || "";
    document.getElementById("inputCrypto").value             = op.crypto || "";
    document.getElementById("inputResultado").value          = op.resultado || "";
    document.getElementById("inputExercicioStatus").value    = op.exercicio_status || "NAO";
    document.getElementById("inputObservacoes").value        = op.observacoes || "";
    new bootstrap.Modal(document.getElementById("modalOperacao")).show();
}

async function saveOperacao() {
    const id = document.getElementById("operacaoId").value;
    const isNew = !id;
    const recoverySnapshot = computeRecoverySnapshot();
    if (isNew && recoverySnapshot.hasLoss) {
        const proceed = await Swal.fire({
            title: 'Prejuízo pendente detectado',
            text: `Ainda faltam ${fmtUsd(recoverySnapshot.missing)} para cobrir o ciclo CALL/PUT. Deseja salvar mesmo assim?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Salvar mesmo assim',
            cancelButtonText: 'Revisar operação'
        });
        if (!proceed.isConfirmed) return;
    }
    const data = {
        ativo: document.getElementById("inputAtivo").value,
        tipo:  document.getElementById("inputTipo").value,
        status: document.getElementById("inputStatus").value,
        data_operacao:    document.getElementById("inputDataOperacao").value,
        cotacao_atual:    parseFloat(document.getElementById("inputCotacaoAtual").value) || null,
        // abertura = preço da crypto na abertura (cotação), não o valor investido
        abertura:         parseFloat(document.getElementById("inputCotacaoAtual").value) || null,
        tae:              parseFloat(document.getElementById("inputTae").value)          || null,
        strike:           parseFloat(document.getElementById("inputStrike").value)       || null,
        distancia:        parseFloat(document.getElementById("inputDistancia").value)    || null,
        prazo:            parseInt(document.getElementById("inputPrazo").value)          || null,
        crypto:           parseFloat(document.getElementById("inputCrypto").value)       || null,
        premio_us:        parseFloat(document.getElementById("inputPremioUs").value)     || null,
        resultado:        parseFloat(document.getElementById("inputResultado").value)    || null,
        exercicio:        document.getElementById("inputExercicio").value                || null,
        dias:             parseInt(document.getElementById("inputDias").value)           || null,
        exercicio_status: document.getElementById("inputExercicioStatus").value,
        observacoes:      document.getElementById("inputObservacoes").value              || null
    };
    try {
        const url = id ? API_BASE + "/api/crypto/" + id : API_BASE + "/api/crypto";
        const res = await fetch(url, { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error("HTTP " + res.status);
        bootstrap.Modal.getInstance(document.getElementById("modalOperacao")).hide();
        iziToast.success({ title: "Sucesso", message: "Operacao salva!" });
        loadOperacoes();
    } catch (e) {
        iziToast.error({ title: "Erro", message: "Erro ao salvar operacao." });
    }
}

async function fecharOperacao(id) {
    const result = await Swal.fire({
        title: "Fechar Operação?",
        text: "Isso marcará a operação como FECHADA. Não é possível desfazer automaticamente.",
        icon: "question", showCancelButton: true,
        confirmButtonColor: "#f59f00", confirmButtonText: "Sim, fechar", cancelButtonText: "Cancelar"
    });
    if (result.isConfirmed) {
        try {
            const res = await fetch(API_BASE + "/api/crypto/" + id + "/fechar", { method: "PATCH" });
            if (!res.ok) throw new Error("Erro " + res.status);
            iziToast.success({ title: "Sucesso", message: "Operação fechada com sucesso!" });
            loadOperacoes();
        } catch (e) {
            iziToast.error({ title: "Erro", message: "Erro ao fechar operação." });
        }
    }
}

async function deleteOperacao(id) {
    const result = await Swal.fire({ title: "Confirmar exclusao?", text: "Esta acao nao pode ser desfeita.", icon: "warning", showCancelButton: true, confirmButtonColor: "#d63939", confirmButtonText: "Sim, excluir", cancelButtonText: "Cancelar" });
    if (result.isConfirmed) {
        try {
            await fetch(API_BASE + "/api/crypto/" + id, { method: "DELETE" });
            iziToast.success({ title: "Sucesso", message: "Operacao excluida!" });
            loadOperacoes();
        } catch (e) {
            iziToast.error({ title: "Erro", message: "Erro ao excluir." });
        }
    }
}

function openSimuladorModal() {
    notifyRecoveryLossContext('Simulação');
    document.getElementById("btnAplicarSim").disabled = true;
    document.getElementById("simCotacaoLiveInfo").textContent = "";
    const timeEl = document.getElementById("simHeaderTime");
    if (timeEl) timeEl.textContent = "";
    _lastSimData = null;
    // Limpa painel direito
    simResetRight();
    new bootstrap.Modal(document.getElementById("modalSimuladorCrypto")).show();
    // Renderiza estado inicial com os valores padrão após o modal estar visível
    setTimeout(() => onSimInput(), 300);
}

// Busca cotação ao vivo para o campo de simulação
async function buscarCotacaoSimLive() {
    const par = document.getElementById("simPar").value || "BTC";
    const btn        = document.getElementById("btnSimCotacaoLive");
    const headerBtn  = document.getElementById("btnSimHeaderRefresh");
    const headerIcon = document.getElementById("simHeaderRefreshIcon");
    if (btn) { btn.disabled = true; btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span>"; }
    if (headerBtn)  headerBtn.disabled = true;
    if (headerIcon) headerIcon.classList.add("sim-spin");
    // Loading nos KPIs e cards do painel direito
    const _spinSm = '<span class="spinner-border" style="width:.55rem;height:.55rem;border-width:1px"></span>';
    ['simPremioEstimado','simRoi','simDistancia','simTaeAnual'].forEach(id => {
        const el = document.getElementById(id); if (el) el.innerHTML = _spinSm;
    });
    const cotEl = document.getElementById('simCotacao');
    if (cotEl) { cotEl.readOnly = true; cotEl.style.opacity = '.5'; }
    try {
        const sym  = par + "USDT";
        const res  = await fetch(API_BASE + "/api/proxy/crypto/" + sym);
        const data = await res.json();
        if (data.price) {
            const price = parseFloat(data.price);
            document.getElementById("simCotacao").value = price.toFixed(2);
            document.getElementById("simCotacaoLiveInfo").textContent = "● ao vivo";
            document.getElementById("simCotacaoLiveInfo").className = "text-success ms-1";
            // Atualiza timestamp do header
            const timeEl = document.getElementById("simHeaderTime");
            if (timeEl) {
                const now = new Date();
                timeEl.textContent = "Atualizado: " + now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
            }
        }
    } catch {
        iziToast.error({ title: "Erro", message: "Erro ao buscar cotação." });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'/><path d='M3 3v5h5'/><path d='M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16'/><path d='M16 16h5v5'/></svg>"; }
        if (headerBtn)  headerBtn.disabled = false;
        if (headerIcon) headerIcon.classList.remove("sim-spin");
        const cotEl2 = document.getElementById('simCotacao');
        if (cotEl2) { cotEl2.readOnly = false; cotEl2.style.opacity = ''; }
        onSimInput(); // atualiza painel direito após atualizar cotação
    }
}

// Busca produtos Dual Investment da Binance via backend
async function buscarProdutosDI() {
    const par    = document.getElementById("simDiPar").value || "BTC";
    const tipo   = document.getElementById("simDiTipoFiltro").value || "";
    const btn    = document.getElementById("btnBuscarDI");
    const empty  = document.getElementById("diProdutosEmpty");
    const table  = document.getElementById("diProdutosTable");
    const tbody  = document.getElementById("diProdutosTbody");

    if (btn) btn.disabled = true;
    empty.style.display = "";
    empty.innerHTML = "<div class='py-3 text-muted text-center'><span class='spinner-border spinner-border-sm me-2'></span>Buscando produtos na Binance...</div>";
    table.style.display = "none";

    try {
        let url = API_BASE + "/api/crypto/dual-investment?asset=" + par + "&pageSize=30";
        if (tipo) url += "&optionType=" + tipo;
        const res  = await fetch(url);
        const data = await res.json();

        if (!data.success || !data.data || data.data.length === 0) {
            const hint = data.hint ? `<div class='text-muted small mt-1'>${data.hint}</div>` : "";
            const errMsg = data.error ? `<div class='text-danger small mt-1'>${data.error}</div>` : "";
            empty.innerHTML = `<div class='py-3 text-center'>
                <div class='text-muted'>Nenhum produto disponível no momento.</div>
                ${errMsg}${hint}
                <div class='mt-2'><a href='#' onclick='buscarProdutosDI()'>Tentar novamente</a></div>
            </div>`;
            empty.style.display = "";
            table.style.display = "none";
            return;
        }

        // Ordena por TAE decrescente
        const products = data.data.sort((a, b) => parseFloat(b.annualInterestRate || 0) - parseFloat(a.annualInterestRate || 0));
        tbody.innerHTML = products.map(p => {
            const tipoP = p.optionType === "CALL"
                ? "<span class='badge crypto-badge-call'>CALL</span>"
                : "<span class='badge crypto-badge-put'>PUT</span>";
            const strike    = p.strikePrice ? parseFloat(p.strikePrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "-";
            const tae       = p.annualInterestRate ? (parseFloat(p.annualInterestRate) * 100).toFixed(2) + "%" : "-";
            const prazo     = p.duration || "-";
            const venc      = p.deliveryDate ? new Date(parseInt(p.deliveryDate)).toLocaleDateString("pt-BR") : "-";
            const underlying = (p.underlying || par).replace("USDT", "");
            return `<tr>
                <td><span class="fw-bold">${underlying}/USDT</span></td>
                <td>${tipoP}</td>
                <td>US$ ${strike}</td>
                <td class="text-info fw-bold">${tae}</td>
                <td>${prazo}d</td>
                <td>${venc}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="usarProdutoDI('${underlying}','${p.optionType}',${p.strikePrice},${parseFloat(p.annualInterestRate || 0) * 100},${p.duration || 7},'${venc}')">
                        Usar
                    </button>
                </td>
            </tr>`;
        }).join("");
        empty.style.display = "none";
        table.style.display = "";
    } catch (e) {
        empty.innerHTML = "<div class='py-3 text-danger text-center'>Erro ao buscar: " + (e.message || e) + "</div>";
        empty.style.display = "";
        table.style.display = "none";
        console.error("[buscarProdutosDI]", e);
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Preenche formulário do simulador com dados de produto DI
function usarProdutoDI(ativo, tipo, strike, tae, prazo, vencimento) {
    document.getElementById("simPar").value   = ativo;
    document.getElementById("simTipo").value  = tipo;
    document.getElementById("simStrike").value = parseFloat(strike).toFixed(2);
    document.getElementById("simTae").value   = parseFloat(tae).toFixed(4);
    document.getElementById("simPrazo").value = prazo;
    // Calcula data de vencimento para o campo exercicio
    iziToast.info({ title: "Produto selecionado", message: ativo + " Strike US$" + parseFloat(strike).toFixed(0) + " — TAE " + parseFloat(tae).toFixed(2) + "% — Venc " + vencimento });
    // Scroll para o formulário
    document.getElementById("simValor").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("simValor").focus();
}

// ── Simulador: variável do chart P&L ─────────────────────────────────────────
let _simPnLChart  = null;
let _simInputTimer = null;
let _simModo = 'usd'; // 'usd' | 'crypto'

// Chamada em todo oninput — debounce 250ms para não sobrecarregar
function onSimInput() {
    clearTimeout(_simInputTimer);
    _simInputTimer = setTimeout(() => simAtualizar(), 250);
}

// Reset do painel direito
function simResetRight() {
    const ids = ['simPremioEstimado', 'simRoi', 'simTaeAnual'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    const dist = document.getElementById('simDistancia');
    if (dist) dist.innerHTML = '—';
    document.getElementById('simPmBody').innerHTML = '<div class="sim-empty-state" style="min-height:80px">Informe os dados para ver o PM do portfólio</div>';
    document.getElementById('simNextOpBody').innerHTML = '<div class="sim-empty-state" style="min-height:80px">Informe Strike e Cotação para análise de risco</div>';
    const prevBody = document.getElementById('simPrevBody');
    if (prevBody) prevBody.innerHTML = '<div class="sim-empty-state" style="min-height:60px">Preencha Strike e Cotação para ver a previsão</div>';
    const prevBadge = document.getElementById('simPrevBadge');
    if (prevBadge) { prevBadge.textContent = ''; prevBadge.style.cssText = ''; }
    const empty = document.getElementById('simPnLEmpty');
    if (empty) empty.style.display = 'flex';
    if (_simPnLChart) { try { _simPnLChart.destroy(); } catch(e) {} _simPnLChart = null; }
}

// Atualiza TODOS os componentes do painel direito com os valores atuais dos inputs
function simAtualizar() {
    const valor   = parseFloat(document.getElementById("simValor")?.value)  || 0;
    const tae     = parseFloat(document.getElementById("simTae")?.value)    || 0;
    const prazo   = parseInt(document.getElementById("simPrazo")?.value)    || 7;
    const strike  = parseFloat(document.getElementById("simStrike")?.value) || 0;
    const cotacao = parseFloat(document.getElementById("simCotacao")?.value) || 0;
    const tipo    = document.getElementById("simTipo")?.value || 'CALL';
    const par     = document.getElementById("simPar")?.value || 'BTC';

    // KPIs
    if (valor && tae) {
        const premioEstimado = valor * (tae / 100) * (prazo / 365);
        const roi = (premioEstimado / valor) * 100;
        document.getElementById("simPremioEstimado").textContent = fmtUsd(premioEstimado);
        document.getElementById("simRoi").textContent = roi.toFixed(4) + "%";
        document.getElementById("simTaeAnual").textContent = tae.toFixed(2) + "% a.a.";
        // Preenche _lastSimData para Calcular/Aplicar (retrocompat)
        const distanciaVal = (cotacao && strike) ? ((strike - cotacao) / cotacao) * 100 : 0;
        _lastSimData = { ativo: par, tipo, abertura: valor, tae, prazo, strike, cotacao_atual: cotacao || null,
                         premio_us: premioEstimado, distancia: distanciaVal || null, data_operacao: getCurrentDate() };
        document.getElementById("btnAplicarSim").disabled = false;
    } else {
        document.getElementById("simPremioEstimado").textContent = '—';
        document.getElementById("simRoi").textContent = '—';
        document.getElementById("simTaeAnual").textContent = '—';
    }

    // Distância
    if (cotacao && strike) {
        const distanciaVal = ((strike - cotacao) / cotacao) * 100;
        const sign = distanciaVal > 0 ? "+" : "";
        const cls  = distanciaVal > 0 ? "text-success" : "text-danger";
        document.getElementById("simDistancia").innerHTML =
            `<span class="${cls}">${sign}${distanciaVal.toFixed(2)}%</span>`;
    } else {
        document.getElementById("simDistancia").innerHTML = '—';
    }

    // PM do portfólio para o ativo selecionado
    simRenderPmCard(par, cotacao);

    // Risco da Operação
    simRenderNextOpCard(par, strike, cotacao, tipo);

    // Previsão / POP
    const _qty = (valor > 0 && strike > 0) ? valor / strike : 0;
    const _premioEst = (valor > 0 && tae > 0) ? valor * (tae / 100) * (prazo / 365) : 0;
    const _breakEven = tipo === 'CALL'
        ? strike + (_qty > 0 ? _premioEst / _qty : 0)
        : strike - (_qty > 0 ? _premioEst / _qty : 0);
    simRenderPrevisao(calcPOP(tipo, cotacao, strike), cotacao, strike, _premioEst, _breakEven, tipo);

    // Gráfico P&L
    if (valor && strike && tae) {
        simRenderPnLChart(valor, strike, cotacao, tipo, prazo, tae);
    }
}

// Renderiza o card de Preço Médio do portfólio para o ativo selecionado
function simRenderPmCard(par, cotacaoInput) {
    const body = document.getElementById('simPmBody');
    const title = document.getElementById('simPmCardTitle');
    if (!body) return;

    // Busca operações do portfólio
    const ops = (allOperacoes || []).filter(o => {
        const ativo = (o.ativo || '').toUpperCase().replace('USDT','').replace('/','').trim();
        return ativo === par.toUpperCase();
    });

    if (!ops.length) {
        body.innerHTML = `<div class="sim-empty-state" style="min-height:80px">Sem operações de ${par} no portfólio</div>`;
        if (title) title.textContent = `📊 Preço Médio ${par}`;
        return;
    }

    // Encontra última CALL exercida (strike exercida = PM base)
    const callsExercidas = ops.filter(o => (o.tipo||'').toUpperCase() === 'CALL' && (o.exercicio_status||'').toUpperCase() === 'SIM');
    const strikeExercida = callsExercidas.length
        ? Math.max(...callsExercidas.map(o => parseFloat(o.strike||0)))
        : parseFloat(ops.reduce((max, o) => parseFloat(o.strike||0) > parseFloat(max.strike||0) ? o : max, ops[0])?.strike || 0);

    // Soma todos os prêmios do ativo
    const totalPremios = ops.reduce((s, o) => s + (parseFloat(o.premio_us)||0), 0);
    const pm = strikeExercida - totalPremios;
    const cotacao = cotacaoInput || parseFloat(ops.find(o => parseFloat(o.cotacao_atual||0) > 0)?.cotacao_atual || 0);
    const pctVsPm = cotacao && pm ? ((cotacao - pm) / pm) * 100 : null;

    const acCor = par === 'BTC' ? '#f59f00' : par === 'ETH' ? '#4da6ff' : '#3fb950';
    const icone = par === 'BTC' ? '₿' : par === 'ETH' ? 'Ξ' : '◎';
    const pctColor = pctVsPm === null ? '' : pctVsPm >= 0 ? 'color:#3fb950' : pctVsPm > -3 ? 'color:#f59f00' : 'color:#f85149';
    const pctSign  = pctVsPm === null ? '?' : (pctVsPm >= 0 ? '+' : '') + pctVsPm.toFixed(2) + '%';

    if (title) title.textContent = `${icone} PREÇO MÉDIO ${par}`;

    body.innerHTML = `
        <div class="sim-pm-val" style="color:${acCor}">$${pm.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="sim-pm-row"><span class="sim-pm-key">● Strike Exercido</span><span class="sim-pm-v" style="color:var(--tblr-warning)">$${strikeExercida.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
        <div class="sim-pm-row"><span class="sim-pm-key">− Prêmios</span><span class="sim-pm-v" style="color:#3fb950">−$${totalPremios.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
        ${cotacao ? `<div class="sim-pm-row"><span class="sim-pm-key">● Cotação</span><span class="sim-pm-v" style="${pctColor}">$${cotacao.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>` : ''}
        ${pctVsPm !== null ? `<div class="sim-pm-row"><span class="sim-pm-key">● vs PM</span><span class="sim-pm-v" style="${pctColor}">${pctSign}</span></div>` : ''}
    `;
}

// Renderiza card de Risco da Operação atual
function simRenderNextOpCard(par, strike, cotacao, tipo) {
    const body = document.getElementById('simNextOpBody');
    if (!body) return;

    if (!strike || !cotacao) {
        body.innerHTML = `<div class="sim-empty-state" style="min-height:80px">Informe Strike e Cotação para análise de risco</div>`;
        return;
    }

    const dist = tipo === 'CALL'
        ? (cotacao - strike) / strike * 100   // positivo = cotação acima do strike
        : (strike - cotacao) / cotacao * 100;  // positivo = strike acima da cotação
    const absDist = Math.abs(dist);

    let riskClass, riskLabel, riskMsg;
    if (absDist < 1) {
        riskClass = 'danger'; riskLabel = '🔴 RISCO ALTO';
        riskMsg = 'Strike muito próximo da cotação. Exercício imediato possível.';
    } else if (absDist < 5) {
        riskClass = 'warn'; riskLabel = '🟡 RISCO MÉDIO';
        riskMsg = dist > 0
            ? 'Cotação favorável ao exercício. Monitorar de perto.'
            : 'Margem moderada de segurança. Atenção ao movimento.';
    } else {
        riskClass = 'safe'; riskLabel = '🟢 RISCO BAIXO';
        riskMsg = dist > 0
            ? 'Boa probabilidade de exercício — retorno em ' + (tipo === 'CALL' ? 'BTC' : 'USDT') + ' esperado.'
            : 'Baixa probabilidade de exercício — retorno em ' + (tipo === 'CALL' ? 'USDT' : 'BTC') + ' esperado.';
    }

    const distSign = dist > 0 ? '+' : '';
    const distColor = riskClass === 'danger' ? '#f85149' : riskClass === 'warn' ? '#f59f00' : '#3fb950';
    const recovery = computeRecoverySnapshot();
    const recoveryWarning = recovery.hasLoss
        ? `<div style="margin-top:8px;padding:8px;border:1px solid rgba(248,81,73,.45);border-radius:8px;background:rgba(248,81,73,.10)">
                <div style="font-size:.72rem;font-weight:700;color:#f85149">⚠ Prejuízo pendente no ciclo</div>
                <div style="font-size:.68rem;color:#fca5a5">Falta cobrir ${fmtUsd(recovery.missing)} (${recovery.progressPct.toFixed(2)}% coberto).</div>
           </div>`
        : '';
    body.innerHTML = `
        <div class="sim-zone ${riskClass}" style="margin-bottom:8px">
            <span style="font-weight:700;font-size:.75rem">${riskLabel}</span>
        </div>
        <div class="sim-pm-row">
            <span class="sim-pm-key">● Cotação</span>
            <span class="sim-pm-v">$${cotacao.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
        <div class="sim-pm-row">
            <span class="sim-pm-key">● Strike</span>
            <span class="sim-pm-v">$${strike.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
        <div class="sim-pm-row">
            <span class="sim-pm-key">● Distância</span>
            <span class="sim-pm-v" style="color:${distColor}">${distSign}${dist.toFixed(2)}%</span>
        </div>
        <div style="margin-top:7px;font-size:.68rem;color:var(--tblr-secondary)">${riskMsg}</div>
        ${recoveryWarning}
    `;
}

// Calcula Probabilidade de Exercício (POP) aproximada — modelo linear simplificado
function calcPOP(tipo, cotacao, strike) {
    if (!cotacao || !strike) return null;
    const dist = tipo === 'CALL'
        ? (cotacao - strike) / strike * 100
        : (strike - cotacao) / cotacao * 100;
    return Math.max(5, Math.min(95, 50 + dist * 2.5));
}

// Auto-fetch cotação ao sair do campo simValor em modo crypto
function simAutoFetchCotacao() {
    if (_simModo === 'crypto') {
        const cotEl = document.getElementById("simCotacao");
        if (cotEl && !parseFloat(cotEl.value)) {
            buscarCotacaoSimLive();
        }
    }
}

// Renderiza card de Previsão: POP circle + items + progress bar
function simRenderPrevisao(pop, cotacao, strike, premio, breakEven, tipo) {
    const body  = document.getElementById('simPrevBody');
    const badge = document.getElementById('simPrevBadge');
    if (!body) return;

    if (pop === null || !cotacao || !strike) {
        body.innerHTML = '<div class="sim-empty-state" style="min-height:60px">Preencha Strike e Cotação para ver a previsão</div>';
        if (badge) { badge.textContent = ''; badge.style.cssText = ''; }
        return;
    }

    const arcColor = pop >= 65 ? '#3fb950' : pop >= 35 ? '#f59f00' : '#f85149';
    const CIRC = 175.93; // 2π × 28
    const dashOffset = CIRC * (1 - pop / 100);

    let badgeText, badgeColor, badgeBg;
    if (pop >= 65) {
        badgeText = 'Exercício Provável'; badgeColor = '#3fb950'; badgeBg = 'rgba(47,179,68,.15)';
    } else if (pop >= 35) {
        badgeText = 'Zona Neutra'; badgeColor = '#f59f00'; badgeBg = 'rgba(245,159,0,.15)';
    } else {
        badgeText = tipo === 'CALL' ? 'Retorno em USDT' : 'Retorno em Crypto';
        badgeColor = '#4da6ff'; badgeBg = 'rgba(77,166,255,.15)';
    }
    if (badge) {
        badge.textContent = badgeText;
        badge.style.cssText = `color:${badgeColor};background:${badgeBg};border:1px solid ${badgeColor};padding:2px 9px;border-radius:10px;font-size:.63rem;font-weight:700`;
    }

    const pMin = strike * 0.85, pMax = strike * 1.15;
    const markerPct = Math.max(2, Math.min(98, (cotacao - pMin) / (pMax - pMin) * 100));
    const barFillPct = Math.max(0, Math.min(100, (strike - pMin) / (pMax - pMin) * 100));

    const dist = tipo === 'CALL'
        ? (cotacao - strike) / strike * 100
        : (strike - cotacao) / cotacao * 100;
    const distSign = dist > 0 ? '+' : '';
    let riskMsg, msgBg, msgColor;
    if (pop >= 65) {
        const retorno = tipo === 'CALL' ? 'BTC' : 'USDT';
        riskMsg = `✅ Cotação ${distSign}${dist.toFixed(2)}% do Strike — alta probabilidade de exercício (retorno em ${retorno})`;
        msgBg = 'rgba(47,179,68,.10)'; msgColor = '#3fb950';
    } else if (pop >= 35) {
        riskMsg = `⚖️ Zona de indefinição — Cotação ${distSign}${dist.toFixed(2)}% do Strike`;
        msgBg = 'rgba(245,159,0,.10)'; msgColor = '#f59f00';
    } else {
        const retorno = tipo === 'CALL' ? 'USDT' : 'BTC';
        riskMsg = `💵 Cotação ${distSign}${dist.toFixed(2)}% do Strike — baixa probabilidade de exercício (retorno em ${retorno})`;
        msgBg = 'rgba(77,166,255,.10)'; msgColor = '#4da6ff';
    }

    const fmt  = v => v ? v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
    const fmtK = v => v >= 1000 ? '$' + (v/1000).toFixed(0) + 'k' : '$' + v.toFixed(0);

    body.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
            <div class="sim-pop-wrap">
                <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="6"/>
                    <circle cx="36" cy="36" r="28" fill="none" stroke="${arcColor}" stroke-width="6"
                        stroke-linecap="round" stroke-dasharray="${CIRC.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}"
                        transform="rotate(-90 36 36)"/>
                </svg>
                <div class="sim-pop-center">
                    <div class="sim-pop-pct" style="color:${arcColor}">${pop.toFixed(1)}%</div>
                    <div class="sim-pop-lbl">POP</div>
                </div>
            </div>
            <div style="flex:1">
                <div class="sim-prev-item">
                    <span class="sim-prev-item-dot" style="background:#4da6ff"></span>
                    <span class="sim-prev-item-lbl">Cotação Atual</span>
                    <span class="sim-prev-item-val" style="color:#4da6ff">$${fmt(cotacao)}</span>
                </div>
                <div class="sim-prev-item">
                    <span class="sim-prev-item-dot" style="background:#f59f00"></span>
                    <span class="sim-prev-item-lbl">Strike</span>
                    <span class="sim-prev-item-val" style="color:#f59f00">$${fmt(strike)}</span>
                </div>
                ${premio > 0 ? `<div class="sim-prev-item">
                    <span class="sim-prev-item-dot" style="background:#3fb950"></span>
                    <span class="sim-prev-item-lbl">Prêmio Est.</span>
                    <span class="sim-prev-item-val" style="color:#3fb950">+$${premio.toFixed(2)}</span>
                </div>` : ''}
                ${breakEven > 0 ? `<div class="sim-prev-item">
                    <span class="sim-prev-item-dot" style="background:rgba(255,255,255,.3)"></span>
                    <span class="sim-prev-item-lbl">Break-Even</span>
                    <span class="sim-prev-item-val">$${fmt(breakEven)}</span>
                </div>` : ''}
            </div>
        </div>
        <div class="sim-prev-bar-track">
            <div class="sim-prev-bar-fill" style="width:${barFillPct.toFixed(1)}%;background:${arcColor};opacity:.45"></div>
            <div class="sim-prev-bar-marker" style="left:${markerPct.toFixed(1)}%"></div>
        </div>
        <div class="sim-prev-bar-lbl">
            <span>${fmtK(pMin)}</span><span>Strike ${fmtK(strike)}</span><span>${fmtK(pMax)}</span>
        </div>
        <div class="sim-prev-msg" style="background:${msgBg};color:${msgColor}">${riskMsg}</div>
    `;
}

// Renderiza curva P&L no canvas
function simRenderPnLChart(valor, strike, cotacao, tipo, prazo, tae) {
    const empty = document.getElementById('simPnLEmpty');
    if (empty) empty.style.display = 'none';

    if (_simPnLChart) { try { _simPnLChart.destroy(); } catch(e) {} _simPnLChart = null; }

    const premioEstimado = valor * (tae / 100) * (prazo / 365);
    const qty = valor / strike;
    const priceMin = strike * 0.88;
    const priceMax = strike * 1.12;
    const N = 100;

    const prices  = [];
    const pnlVals = [];
    for (let i = 0; i <= N; i++) {
        const p = priceMin + (priceMax - priceMin) * i / N;
        prices.push(p);
        // CALL DI: acima do strike recebe BTC que vale mais → P&L sobe
        // PUT DI:  abaixo do strike recebe BTC que pode cair → P&L desce
        const pnl = tipo === 'CALL'
            ? premioEstimado + (p >= strike ? (p - strike) * qty : 0)
            : (p >= strike ? premioEstimado : premioEstimado - (strike - p) * qty);
        pnlVals.push(pnl);
    }

    // Break-even: CALL DI nunca cruza zero (sempre positivo), PUT DI tem BEP abaixo do strike
    const breakEvenPrice = tipo === 'PUT'
        ? strike - (premioEstimado / qty)
        : null; // CALL DI: sem break-even negativo

    const getClosestIdx = (arr, val) => {
        let minD = Infinity, idx = 0;
        arr.forEach((v, i) => { const d = Math.abs(v - val); if (d < minD) { minD = d; idx = i; } });
        return idx;
    };

    const canvas = document.getElementById('simPnLCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    _simPnLChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: prices.map(p => p.toFixed(0)),
            datasets: [{
                label: 'P&L (US$)',
                data: pnlVals,
                // CALL DI: sempre positivo → tudo verde. PUT DI: mantém bicolor
                fill: tipo === 'CALL'
                    ? { target: { value: 0 }, above: 'rgba(63,185,80,.15)' }
                    : { target: { value: 0 }, above: 'rgba(63,185,80,.18)', below: 'rgba(248,81,73,.18)' },
                segment: tipo === 'CALL'
                    ? { borderColor: () => '#3fb950' }
                    : { borderColor: ctx2 => ctx2.p1.parsed.y >= 0 ? '#3fb950' : '#f85149' },
                tension: 0,
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: c => `Preço: $${parseFloat(c[0].label).toLocaleString('en-US',{minimumFractionDigits:0})}`,
                        label: c => {
                            const p = parseFloat(c.label);
                            const zone = tipo === 'CALL'
                                ? (p < strike ? 'Recebe USDT' : 'Recebe BTC')
                                : (p >= strike ? 'Recebe USDT' : 'Recebe BTC');
                            return `${zone} | Retorno: ${c.raw >= 0 ? '+' : ''}$${c.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,.04)' },
                     ticks: { color: '#8b949e', font: { size: 9 }, maxTicksLimit: 9,
                               callback: (_, idx) => { const p = prices[idx]; if (!p) return ''; return p >= 1000 ? '$' + (p/1000).toFixed(0) + 'k' : '$' + p.toFixed(0); } } },
                y: { grid: { color: 'rgba(255,255,255,.05)' },
                     ticks: { color: '#8b949e', font: { size: 9 }, callback: v => (v >= 0 ? '+' : '') + '$' + Math.abs(v).toFixed(0) } }
            }
        },
        plugins: [{
            id: 'simOverlay',
            afterDraw: chart => {
                const c2  = chart.ctx;
                const xs  = chart.scales.x;
                const ys  = chart.scales.y;
                const ca  = chart.chartArea;

                c2.save();
                // Linha zero tracejada
                const y0 = ys.getPixelForValue(0);
                c2.strokeStyle = 'rgba(255,255,255,.18)';
                c2.lineWidth = 1;
                c2.setLineDash([4,4]);
                c2.beginPath(); c2.moveTo(ca.left, y0); c2.lineTo(ca.right, y0); c2.stroke();
                c2.setLineDash([]);

                const drawVLine = (val, color, label, labelY) => {
                    const idx = getClosestIdx(prices, val);
                    const xP  = xs.getPixelForValue(idx);
                    c2.strokeStyle = color;
                    c2.lineWidth = 1.5;
                    c2.setLineDash([5,3]);
                    c2.beginPath(); c2.moveTo(xP, ca.top); c2.lineTo(xP, ca.bottom); c2.stroke();
                    c2.setLineDash([]);
                    c2.fillStyle = color;
                    c2.font = 'bold 9px monospace';
                    c2.textAlign = 'center';
                    c2.fillText(label, xP, labelY);
                };

                // Strike
                drawVLine(strike, '#f59f00',
                    `Strike $${strike >= 1000 ? (strike/1000).toFixed(0)+'k' : strike.toFixed(0)}`,
                    ca.top + 11);

                // Break-even: só para PUT DI
                if (breakEvenPrice !== null) {
                    drawVLine(breakEvenPrice, 'rgba(255,255,255,.5)', 'B/E', ca.top + 22);
                }

                // Anotações de zona para CALL DI
                if (tipo === 'CALL') {
                    const strikeIdx = getClosestIdx(prices, strike);
                    const xStrike = xs.getPixelForValue(strikeIdx);
                    c2.save();
                    c2.font = '8px monospace';
                    c2.textAlign = 'center';
                    c2.fillStyle = 'rgba(63,185,80,.55)';
                    if (xStrike - ca.left > 60) c2.fillText('Recebe USDT', (ca.left + xStrike) / 2, ca.bottom - 6);
                    if (ca.right - xStrike > 60) c2.fillText('Recebe BTC', (ca.right + xStrike) / 2, ca.bottom - 6);
                    c2.restore();
                }

                // Cotação atual
                if (cotacao) {
                    const idx = getClosestIdx(prices, cotacao);
                    const xC  = xs.getPixelForValue(idx);
                    const pnlAtCot = pnlVals[idx] !== undefined ? pnlVals[idx] : 0;
                    const yC  = ys.getPixelForValue(pnlAtCot);
                    // Linha vertical azul
                    c2.strokeStyle = 'rgba(77,166,255,.7)';
                    c2.lineWidth = 1.5;
                    c2.setLineDash([5,3]);
                    c2.beginPath(); c2.moveTo(xC, ca.top); c2.lineTo(xC, ca.bottom); c2.stroke();
                    c2.setLineDash([]);
                    // Ponto no cruzamento
                    c2.fillStyle = '#4da6ff';
                    c2.beginPath(); c2.arc(xC, yC, 4, 0, Math.PI * 2); c2.fill();
                    // Label do P&L
                    const lbl = (pnlAtCot >= 0 ? '+$' : '-$') + Math.abs(pnlAtCot).toFixed(2);
                    c2.fillStyle = '#4da6ff';
                    c2.font = 'bold 9px monospace';
                    c2.textAlign = 'center';
                    const labelY = yC > ca.top + 20 ? yC - 8 : yC + 16;
                    c2.fillText(lbl, xC, labelY);
                    c2.fillStyle = 'rgba(77,166,255,.6)';
                    c2.font = '8px monospace';
                    c2.fillText('Atual', xC, ca.bottom - 2);
                }

                c2.restore();
            }
        }]
    });
}

function calcularSimulador() {
    // Garantir que o valor está em USD antes de calcular
    if (_simModo === 'crypto') {
        const cotacao = parseFloat(document.getElementById('simCotacao')?.value || 0);
        if (!cotacao) { iziToast.warning({ title: 'Aviso', message: 'Informe a cotação para converter antes de calcular.' }); return; }
        converterSimValor();
    }
    const valor   = parseFloat(document.getElementById("simValor").value)  || 0;
    const tae     = parseFloat(document.getElementById("simTae").value)    || 0;
    const prazo   = parseInt(document.getElementById("simPrazo").value)    || 7;
    const strike  = parseFloat(document.getElementById("simStrike").value) || 0;
    const cotacao = parseFloat(document.getElementById("simCotacao").value) || 0;
    const tipo    = document.getElementById("simTipo").value;
    const par     = document.getElementById("simPar").value;
    if (!valor || !tae) { iziToast.warning({ title: "Aviso", message: "Preencha Valor e TAE." }); return; }

    simAtualizar(); // Atualiza todos os painéis reativos

    const premioEstimado = valor * (tae / 100) * (prazo / 365);
    const recoverySnapshot = computeRecoverySnapshot();
    if (recoverySnapshot.hasLoss && premioEstimado < recoverySnapshot.missing) {
        iziToast.warning({
            title: 'Meta de recuperação',
            message: `Prêmio estimado (${fmtUsd(premioEstimado)}) ainda abaixo do faltante (${fmtUsd(recoverySnapshot.missing)}).`
        });
    }
    const roi = (premioEstimado / valor) * 100;
    const distanciaVal = (cotacao && strike) ? ((strike - cotacao) / cotacao) * 100 : 0;

    // compat retroativa com cenários (hidden)
    const cenarioWin     = tipo === "CALL" ? "Preço acima do Strike (" + fmtUsd(strike) + ")" : "Preço abaixo do Strike (" + fmtUsd(strike) + ")";
    document.getElementById("simCenarioWin").textContent     = cenarioWin;
    document.getElementById("simCenarioWinDesc").textContent = "Recebe prêmio: " + fmtUsd(premioEstimado);
    document.getElementById("simCenarioAlt").textContent     = tipo === "CALL" ? "Preço abaixo do Strike" : "Preço acima do Strike";
    document.getElementById("simCenarioAltDesc").textContent = tipo === "CALL" ? "Recebe em " + par : "Recebe USDT + prêmio";

    document.getElementById("btnAplicarSim").disabled = false;
    _lastSimData = { ativo: par, tipo, abertura: valor, tae, prazo, strike, cotacao_atual: cotacao || null,
                     premio_us: premioEstimado, distancia: distanciaVal || null, data_operacao: getCurrentDate() };
}

function setSimModo(modo) {
    _simModo = modo;
    const usdBtn    = document.getElementById('simModoUsd');
    const cryptoBtn = document.getElementById('simModoCrypto');
    const suffix    = document.getElementById('simValorSuffix');
    const convRow   = document.getElementById('simConverterRow');
    const input     = document.getElementById('simValor');
    if (!usdBtn || !cryptoBtn) return;
    if (modo === 'usd') {
        usdBtn.classList.add('active');
        cryptoBtn.classList.remove('active');
        if (suffix)  suffix.textContent = 'USD';
        if (convRow) convRow.classList.add('d-none');
        if (input)   input.placeholder  = 'Valor em US$';
    } else {
        cryptoBtn.classList.add('active');
        usdBtn.classList.remove('active');
        if (suffix)  suffix.textContent = 'Crypto';
        if (convRow) convRow.classList.remove('d-none');
        if (input)   input.placeholder  = 'Quantidade de crypto';
        // Atualiza referência de cotação
        const cotacao = parseFloat(document.getElementById('simCotacao')?.value || 0);
        const cotRef  = document.getElementById('simCotacaoRef');
        if (cotRef) cotRef.textContent = cotacao > 0 ? `Cotação: US$ ${cotacao.toLocaleString('pt-BR', {minimumFractionDigits:2})}` : 'Cotação: US$ —';
    }
}

function converterSimValor() {
    const cotacao = parseFloat(document.getElementById('simCotacao')?.value || 0);
    const simValorEl = document.getElementById('simValor');
    const simUsdEquiv = document.getElementById('simUsdEquiv');
    if (!cotacao) { iziToast.warning({ title: 'Aviso', message: 'Informe a cotação atual antes de converter.' }); return; }
    const qty = parseFloat(simValorEl?.value || 0);
    if (!qty) { iziToast.warning({ title: 'Aviso', message: 'Informe a quantidade de crypto.' }); return; }
    const usdEquiv = qty * cotacao;
    if (simUsdEquiv) simUsdEquiv.textContent = `≈ US$ ${usdEquiv.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    // Substituir valor pelo equivalente em USD e trocar modo
    if (simValorEl) simValorEl.value = usdEquiv.toFixed(2);
    setSimModo('usd');
    iziToast.success({ title: 'Convertido', message: `${qty} crypto × ${cotacao.toFixed(2)} = US$ ${usdEquiv.toFixed(2)}` });
}

function aplicarSimulacao() {
    if (!_lastSimData) return;
    bootstrap.Modal.getInstance(document.getElementById("modalSimuladorCrypto")).hide();
    setTimeout(() => {
        openNewModal();
        // Aguardar o modal abrir e o form resetar antes de preencher
        setTimeout(() => {
            const el = id => document.getElementById(id);
            // Ativo — garante match exato no select (BTC, ETH, etc.)
            const ativoSel = el("inputAtivo");
            if (ativoSel) {
                ativoSel.value = _lastSimData.ativo;
                if (!ativoSel.value) {  // fallback: procura prefixo
                    const opt = Array.from(ativoSel.options).find(o => o.value.startsWith(_lastSimData.ativo.split("/")[0]));
                    if (opt) ativoSel.value = opt.value;
                }
            }
            // Tipo e Status
            if (el("inputTipo"))   el("inputTipo").value   = _lastSimData.tipo;   // CALL ou PUT
            if (el("inputStatus")) el("inputStatus").value = "ABERTA";
            // Campos numéricos
            // Valor investido em USD (não a cotação do ativo)
            setInvestidoMode('usd');
            const valorInvestido = parseFloat(_lastSimData.abertura || 0);
            if (el("inputAbertura"))     el("inputAbertura").value     = valorInvestido > 0 ? valorInvestido.toFixed(2) : "";
            if (el("inputTae"))          el("inputTae").value          = _lastSimData.tae;
            if (el("inputPrazo"))        el("inputPrazo").value        = _lastSimData.prazo;
            if (el("inputStrike"))       el("inputStrike").value       = _lastSimData.strike;
            if (el("inputCotacaoAtual")) el("inputCotacaoAtual").value = _lastSimData.cotacao_atual || "";
            if (el("inputPremioUs"))     el("inputPremioUs").value     = parseFloat(_lastSimData.premio_us || 0).toFixed(6);
            if (el("inputDistancia"))    el("inputDistancia").value    = _lastSimData.distancia ? parseFloat(_lastSimData.distancia).toFixed(4) : "";
            if (el("inputDataOperacao")) el("inputDataOperacao").value = _lastSimData.data_operacao;
            // Vencimento = data abertura + prazo
            if (_lastSimData.prazo && _lastSimData.data_operacao) {
                const dt = new Date(_lastSimData.data_operacao + "T00:00:00");
                dt.setDate(dt.getDate() + parseInt(_lastSimData.prazo));
                const exVal = dt.toISOString().split("T")[0];
                if (el("inputExercicio")) el("inputExercicio").value = exVal;
                if (el("inputDias"))      el("inputDias").value      = _lastSimData.prazo;
            }
            // Dispara auto-cálculo (distância, qtd crypto, resultado%)
            ["inputAbertura", "inputTae", "inputPrazo", "inputCotacaoAtual", "inputStrike", "inputTipo"].forEach(fid => {
                el(fid)?.dispatchEvent(new Event("input", { bubbles: true }));
            });
            el("inputAbertura")?.focus();
        }, 250);
    }, 400);
}

function loadLocalConfig() {
    try { return JSON.parse(localStorage.getItem(CRYPTO_CFG_KEY)) || {}; } catch { return {}; }
}

window.getCryptoRecoverySnapshot = computeRecoverySnapshot;

function loadConfig() {
    const cfg = loadLocalConfig();
    const el = id => document.getElementById(id);
    if (cfg.saldoCrypto && el("cfgSaldoCrypto")) el("cfgSaldoCrypto").value = cfg.saldoCrypto;
    if (cfg.meta && el("cfgMetaCrypto"))           el("cfgMetaCrypto").value = cfg.meta;
    if (cfg.parPadrao && el("cfgParPadrao"))       el("cfgParPadrao").value  = cfg.parPadrao;
}

function saveConfig() {
    const cfg = {
        saldoCrypto: parseFloat(document.getElementById("cfgSaldoCrypto")?.value) || 0,
        meta:        parseFloat(document.getElementById("cfgMetaCrypto")?.value)  || 0,
        parPadrao:   document.getElementById("cfgParPadrao")?.value || "BTC"
    };
    localStorage.setItem(CRYPTO_CFG_KEY, JSON.stringify(cfg));
    iziToast.success({ title: "Configuracoes salvas!", message: "Saldo e metas atualizados." });
    updateUI();
}

function showRefreshLoading() {
    // Spinner nos cards
    ["cardTotalOps", "cardSaldoCrypto", "cardTotalPremios", "cardResultadoMedio"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el._prevText = el.textContent; el.innerHTML = '<span class="spinner-border spinner-border-sm opacity-50"></span>'; }
    });
    // Overlay sobre a tabela
    const tabContent = document.querySelector(".tab-content");
    if (tabContent && !document.getElementById("cryptoTableLoadingOverlay")) {
        const overlay = document.createElement("div");
        overlay.id = "cryptoTableLoadingOverlay";
        overlay.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;border-radius:6px;";
        overlay.innerHTML = '<div class="text-center"><div class="spinner-border text-primary mb-3" style="width:3rem;height:3rem;"></div><div class="text-light fs-5 fw-semibold">Atualizando cotações...</div></div>';
        tabContent.style.position = "relative";
        tabContent.appendChild(overlay);
    }
}

function hideRefreshLoading() {
    document.getElementById("cryptoTableLoadingOverlay")?.remove();
}

async function refreshQuotes() {
    const btn = document.getElementById("btnRefresh");
    if (btn) { btn.disabled = true; btn.classList.add("spin-anim"); }
    showRefreshLoading();
    iziToast.info({ title: "Atualizando", message: "Verificando posições e buscando cotações..." });
    try {
        // 1. Chama backend refresh (auto-fecha operações com data passada)
        await fetch(API_BASE + "/api/crypto/refresh", { method: "POST" });
        // 2. Recarrega todas as operações do DB (com status atualizado)
        const res = await fetch(API_BASE + "/api/crypto");
        allOperacoes = await res.json();
        window.cryptoOperacoes = allOperacoes;
        // 3. Busca cotações ao vivo somente para ops ABERTAS
        await refreshCryptoCotacoes();
        updateUI();
        updateCryptoMarketStatus();
        iziToast.success({ title: "Atualizado", message: "Cotações e status atualizados." });
    } catch (e) {
        console.error("[refreshQuotes]", e);
        iziToast.error({ title: "Erro", message: "Falha ao atualizar cotações." });
    } finally {
        hideRefreshLoading();
        if (btn) { btn.disabled = false; btn.classList.remove("spin-anim"); }
    }
}

// Atualiza cotações ao vivo da Binance — somente operações ABERTAS
async function refreshCryptoCotacoes() {
    const abertas = allOperacoes.filter(o => (o.status || "ABERTA") === "ABERTA");
    const ativos  = [...new Set(abertas.map(o => o.ativo).filter(Boolean))];
    if (!ativos.length) return;
    const priceMap = {};
    await Promise.allSettled(ativos.map(async ativo => {
        try {
            const sym = (ativo + "USDT").replace(/USDTUSDT$/, "USDT");
            const res  = await fetch(API_BASE + "/api/proxy/crypto/" + sym);
            const d    = await res.json();
            if (d.price) priceMap[ativo] = parseFloat(d.price);
        } catch {}
    }));
    // Injeta preço ao vivo em cada operação aberta
    abertas.forEach(op => {
        if (priceMap[op.ativo] !== undefined) {
            op._livePrice    = priceMap[op.ativo];
            op.cotacao_atual = priceMap[op.ativo];
            if (op.strike) {
                const dist = ((parseFloat(op.strike) - priceMap[op.ativo]) / priceMap[op.ativo]) * 100;
                op._liveDist = dist;
            }
        }
    });
    if (Object.keys(priceMap).length) updateUI();
}

// Atualiza badge de mercado no navbar com cotação BTC
async function updateCryptoMarketStatus() {
    try {
        const res  = await fetch(API_BASE + "/api/proxy/crypto/BTCUSDT");
        const data = await res.json();
        if (!data.price) return;
        const badge = document.getElementById("navbarMarketStatus");
        if (!badge) return;
        const price = parseFloat(data.price);
        badge.textContent = "BTC US$" + price.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
        badge.className   = "badge bg-success-lt ms-2";
        badge.style.display = "";
    } catch {}
}

// Mostra modal de detalhes de uma operação
// showDetalhes() movida para modal-detalhe-crypto.js (v1.0.0)
// O módulo expõe window.showDetalhes como retrocompatibilidade

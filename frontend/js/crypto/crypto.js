/** crypto.js v1.5.3 - Controle de Dual Investment Cryptos */

let allOperacoes = [];
let tableMesAtual, tableHistorico;
let chartAnual = null;
let currentFilterCrypto = "ABERTA";
let _lastSimData = null;
let _investidoMode = 'usd';
const CRYPTO_CFG_KEY = "cryptoConfig";

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
    // cardResultadoTotalCryptoCard, cardResultadoMedioCryptoCard e cardSaldoCryptoCard
    // são tratados pelos modais configurados externamente em crypto.html.
    const handlers = {
        "cardTotalOpsCryptoCard": () => {
            if (window.ModalTotalOperacoesCrypto && window.ModalTotalOperacoesCrypto.openModal) {
                window.ModalTotalOperacoesCrypto.openModal();
            }
        },
    };
    for (const [id, fn] of Object.entries(handlers)) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.addEventListener("click", fn);
        el.addEventListener("keydown", e => (e.key === "Enter" || e.key === " ") && fn());
    }
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
            if (tableMesAtual) {
                if (currentFilterCrypto === "all") tableMesAtual.column(14).search("").draw();
                else tableMesAtual.column(14).search(currentFilterCrypto).draw();
            }
        });
    });
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
    tableHistorico = $('#tableHistorico').DataTable(dtConfig);
    // Recalcula larguras das colunas após o tab ser exibido
    document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(tab => {
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
    populateTable(tableMesAtual,  mesAtualData);
    populateTable(tableHistorico, allOperacoes);
    renderHistoricoMensal();
    renderChartAnual(anoData, currentYear);
    // Reaplica filtro de status ativo após recarregar a tabela
    if (tableMesAtual) {
        tableMesAtual.column(14).search(currentFilterCrypto === "all" ? "" : currentFilterCrypto).draw();
    }
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

function populateTable(dt, data) {
    if (!dt) return; // DataTable não inicializado ainda
    dt.clear();
    [...data].sort((a, b) => {
        const aOpen = (a.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
        const bOpen = (b.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
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
            "<span class=\"badge bg-warning text-dark\">" + (op.ativo || "-") + "</span>",
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
                    <td><strong>${op.ativo || "-"}</strong></td>
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
    document.getElementById("simResultContainer").style.display = "none";
    document.getElementById("btnAplicarSim").disabled = true;
    document.getElementById("simCotacaoLiveInfo").textContent = "";
    _lastSimData = null;
    new bootstrap.Modal(document.getElementById("modalSimuladorCrypto")).show();
}

// Busca cotação ao vivo para o campo de simulação
async function buscarCotacaoSimLive() {
    const par = document.getElementById("simPar").value || "BTC";
    const btn = document.getElementById("btnSimCotacaoLive");
    if (btn) { btn.disabled = true; btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span>"; }
    try {
        const sym  = par + "USDT";
        const res  = await fetch(API_BASE + "/api/proxy/crypto/" + sym);
        const data = await res.json();
        if (data.price) {
            const price = parseFloat(data.price);
            document.getElementById("simCotacao").value = price.toFixed(2);
            document.getElementById("simCotacaoLiveInfo").textContent = "● ao vivo";
            document.getElementById("simCotacaoLiveInfo").className = "text-success ms-1";
        }
    } catch {
        iziToast.error({ title: "Erro", message: "Erro ao buscar cotação." });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'/><path d='M3 3v5h5'/><path d='M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16'/><path d='M16 16h5v5'/></svg>"; }
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

// ── Simulador: Toggle USD ↔ Crypto ────────────────────────────────────────────
let _simModo = 'usd'; // 'usd' | 'crypto'

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
    if (!valor || !tae) { iziToast.warning({ title: "Aviso", message: "Preencha Valor e TAE." }); return; }
    const premioEstimado = valor * (tae / 100) * (prazo / 365);
    const roi = (premioEstimado / valor) * 100;
    let distanciaHtml = "-", distanciaVal = 0;
    if (cotacao && strike) {
        distanciaVal = ((strike - cotacao) / cotacao) * 100;
        const sign = distanciaVal > 0 ? "+" : "";
        distanciaHtml = "<span class=\"" + (distanciaVal > 0 ? "text-success" : "text-danger") + "\">" + sign + distanciaVal.toFixed(2) + "%</span>";
    }
    const cenarioWin     = tipo === "CALL" ? "Preco acima do Strike (" + fmtUsd(strike) + ")" : "Preco abaixo do Strike (" + fmtUsd(strike) + ")";
    const cenarioWinDesc = "Recebe premio: " + fmtUsd(premioEstimado);
    const cenarioAlt     = tipo === "CALL" ? "Preco abaixo do Strike" : "Preco acima do Strike";
    const cenarioAltDesc = tipo === "CALL" ? "Recebe em " + document.getElementById("simPar").value : "Recebe USDT + premio";
    document.getElementById("simPremioEstimado").textContent = fmtUsd(premioEstimado);
    document.getElementById("simRoi").textContent            = roi.toFixed(4) + "%";
    document.getElementById("simDistancia").innerHTML        = distanciaHtml;
    document.getElementById("simTaeAnual").textContent       = tae.toFixed(2) + "% a.a.";
    document.getElementById("simCenarioWin").textContent     = cenarioWin;
    document.getElementById("simCenarioWinDesc").textContent = cenarioWinDesc;
    document.getElementById("simCenarioAlt").textContent     = cenarioAlt;
    document.getElementById("simCenarioAltDesc").textContent = cenarioAltDesc;
    document.getElementById("simResultContainer").style.display = "";
    document.getElementById("btnAplicarSim").disabled = false;
    _lastSimData = { ativo: document.getElementById("simPar").value, tipo, abertura: valor, tae, prazo, strike, cotacao_atual: cotacao || null, premio_us: premioEstimado, distancia: distanciaVal || null, data_operacao: getCurrentDate() };
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

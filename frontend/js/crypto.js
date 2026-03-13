/** crypto.js v1.2.0 - Controle de Dual Investment Cryptos */

let allOperacoes = [];
let tableMesAtual, tableHistorico;
let chartAnual = null;
let currentFilterCrypto = "all";
const CRYPTO_CFG_KEY = "cryptoConfig";

document.addEventListener("layoutReady", function () {
    initDataTables();
    loadConfig();
    loadOperacoes();
    setupEventListeners();
    setupCardClicks();
    setupFilterButtons();
});

function setupEventListeners() {
    document.getElementById("btnNovaOperacao")?.addEventListener("click", openNewModal);
    document.getElementById("btnSaveOperacao")?.addEventListener("click", saveOperacao);
    document.getElementById("btnSaveConfigCrypto")?.addEventListener("click", saveConfig);
    document.getElementById("btnSimularCrypto")?.addEventListener("click", openSimuladorModal);
    document.getElementById("btnCalcularSim")?.addEventListener("click", calcularSimulador);
    document.getElementById("btnAplicarSim")?.addEventListener("click", aplicarSimulacao);
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
}

function setupCardClicks() {
    const map = {
        "cardTotalOpsCryptoCard":       () => scrollToTab("tab-mes-atual"),
        "cardSaldoCryptoCard":          () => scrollToTab("tab-config-crypto"),
        "cardResultadoTotalCryptoCard": () => scrollToTab("tab-historico"),
        "cardResultadoMedioCryptoCard": () => scrollToTab("tab-anual")
    };
    for (const [id, fn] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.addEventListener("click", fn);
        el.addEventListener("keydown", e => (e.key === "Enter" || e.key === " ") && fn());
    }
}

function scrollToTab(tabId) {
    const tabEl = document.querySelector('[href="#' + tabId + '"]');
    if (tabEl) { tabEl.click(); tabEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
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
        order: [[10, "desc"]],
        columnDefs: [{ targets: 15, orderable: false }]
    };
    tableMesAtual  = $('#tableMesAtual').DataTable(dtConfig);
    tableHistorico = $('#tableHistorico').DataTable(dtConfig);
}

async function loadOperacoes() {
    try {
        const res = await fetch(API_BASE + "/api/crypto");
        allOperacoes = await res.json();
        updateUI();
    } catch (e) {
        console.error("[crypto] Erro ao carregar:", e);
        iziToast.error({ title: "Erro", message: "Erro ao carregar operacoes crypto." });
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

    document.getElementById("cardTotalOps").textContent       = allOperacoes.length;
    document.getElementById("cardSaldoCrypto").textContent    = fmtUsd(saldo);
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
    try { return parseFloat(JSON.parse(localStorage.getItem(CRYPTO_CFG_KEY))?.saldoCrypto) || 0; }
    catch { return 0; }
}

function populateTable(dt, data) {
    dt.clear();
    [...data].sort((a, b) => new Date(b.exercicio || b.data_operacao || 0) - new Date(a.exercicio || a.data_operacao || 0)).forEach(op => {
        const pct = (op.abertura && op.premio_us)
            ? ((parseFloat(op.premio_us) / parseFloat(op.abertura)) * 100).toFixed(2) + "%"
            : "-";
        const tipoBadge   = op.tipo === "CALL" ? "<span class=\"badge crypto-badge-high\">HIGH</span>" : "<span class=\"badge crypto-badge-low\">LOW</span>";
        const exBadge     = op.exercicio_status === "SIM" ? "<span class=\"badge bg-warning text-dark\">SIM</span>" : "<span class=\"badge bg-secondary\">NAO</span>";
        const status      = op.status || "ABERTA";
        const statusBadge = status === "ABERTA" ? "<span class=\"badge bg-success\">ABERTA</span>" : status === "FECHADA" ? "<span class=\"badge bg-secondary\">FECHADA</span>" : "<span class=\"badge bg-danger\">VENCIDA</span>";
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
            op.prazo || "-",
            op.crypto        ? parseFloat(op.crypto).toFixed(6) : "-",
            exBadge, statusBadge,
            "<div class=\"btn-group btn-group-sm\"><button class=\"btn btn-outline-primary\" onclick=\"editOperacao(" + op.id + ")\" title=\"Editar\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z\"/></svg></button><button class=\"btn btn-outline-danger\" onclick=\"deleteOperacao(" + op.id + ")\" title=\"Excluir\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/></svg></button></div>"
        ]);
    });
    dt.draw();
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
    document.getElementById("anualHeader").innerHTML = "<div class=\"col-12 mb-2\"><h3 class=\"d-inline\">" + year + "</h3><span class=\"ms-2 badge bg-info text-dark\">Resultado Anual</span></div><div class=\"col-md-3 col-sm-6 mb-2\"><div class=\"text-muted small\">Total Operacoes</div><div class=\"fw-bold\">" + data.length + "</div></div><div class=\"col-md-3 col-sm-6 mb-2\"><div class=\"text-muted small\">Premio Total</div><div class=\"fw-bold text-success\">" + fmtUsd(anoTotal) + "</div></div><div class=\"col-md-3 col-sm-6 mb-2\"><div class=\"text-muted small\">Resultado Medio</div><div class=\"fw-bold text-success\">" + anoMedio.toFixed(2) + "%</div></div><div class=\"col-md-3 col-sm-6 mb-2\"><div class=\"text-muted small\">Media por Mes</div><div class=\"fw-bold\">" + fmtUsd(anoTotal / 12) + "</div></div>";
    const ctx = document.getElementById("chartAnual").getContext("2d");
    if (chartAnual) chartAnual.destroy();
    chartAnual = new Chart(ctx, {
        type: "bar",
        data: { labels, datasets: [{ label: "Premio US$", data: values, backgroundColor: colors, borderRadius: 6 }] },
        options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => "US$ " + c.parsed.y.toFixed(2) } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => "US$ " + v.toFixed(0) } } } }
    });
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
    document.getElementById("modalOperacaoTitle").textContent = "Editar Operacao";
    document.getElementById("operacaoId").value              = op.id;
    document.getElementById("inputAtivo").value              = op.ativo || "BTC";
    document.getElementById("inputTipo").value               = op.tipo || "CALL";
    document.getElementById("inputStatus").value             = op.status || "ABERTA";
    document.getElementById("inputDataOperacao").value       = op.data_operacao || "";
    document.getElementById("inputAbertura").value           = op.abertura || "";
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
        abertura:         parseFloat(document.getElementById("inputAbertura").value)     || null,
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

let _lastSimData = null;

function openSimuladorModal() {
    document.getElementById("simResultContainer").style.display = "none";
    document.getElementById("btnAplicarSim").disabled = true;
    _lastSimData = null;
    new bootstrap.Modal(document.getElementById("modalSimuladorCrypto")).show();
}

function calcularSimulador() {
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
        document.getElementById("inputAtivo").value        = _lastSimData.ativo;
        document.getElementById("inputTipo").value         = _lastSimData.tipo;
        document.getElementById("inputAbertura").value     = _lastSimData.abertura;
        document.getElementById("inputTae").value          = _lastSimData.tae;
        document.getElementById("inputPrazo").value        = _lastSimData.prazo;
        document.getElementById("inputStrike").value       = _lastSimData.strike;
        document.getElementById("inputCotacaoAtual").value = _lastSimData.cotacao_atual || "";
        document.getElementById("inputPremioUs").value     = _lastSimData.premio_us.toFixed(2);
        document.getElementById("inputDistancia").value    = _lastSimData.distancia ? _lastSimData.distancia.toFixed(2) : "";
        document.getElementById("inputDataOperacao").value = _lastSimData.data_operacao;
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

async function refreshQuotes() {
    iziToast.info({ title: "Atualizando", message: "Buscando cotacoes..." });
    try {
        const res  = await fetch(API_BASE + "/api/proxy/crypto/BTCUSDT");
        const data = await res.json();
        if (data.price) iziToast.success({ title: "BTC/USDT", message: "US$ " + parseFloat(data.price).toFixed(2) });
    } catch (e) {
        iziToast.error({ title: "Erro", message: "Erro ao buscar cotacao." });
    }
}

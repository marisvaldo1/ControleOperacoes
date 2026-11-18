/**
 * mes-atual-opcoes.js
 * Aba "Mês Atual" da página de Opções com paridade visual/funcional à de Crypto:
 *  - Toolbar (mês + badge + alternância gadgets/gráfico + recarga)
 *  - Gadgets (KPIs do mês)
 *  - Gráfico da evolução diária do resultado
 *  - Filtros rápidos Todas/Abertas/Fechadas
 *
 * Fonte de dados: window.opcoesOperacoes / evento "opcoesDataUpdated" (opcoes.js)
 * A renderização é disparada por opcoes.js (updateUI) via window.MesAtualOpcoes.render().
 */
;(function (global) {
    'use strict';

    let _chart = null;
    let _mesOps = [];
    let _toolbarBound = false;

    function brl(v) {
        if (typeof global.formatCurrency === 'function') return global.formatCurrency(parseFloat(v) || 0, 'BRL');
        return 'R$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function num(v) {
        if (typeof global.parseFloatSafe === 'function') return global.parseFloatSafe(v);
        return parseFloat(v) || 0;
    }

    function isOpen(op) {
        const s = String(op.status || 'ABERTA').toUpperCase();
        return s === 'ABERTA' || s === 'ABERTO';
    }

    // Prêmio total da operação = prêmio unitário × quantidade
    function premioTotal(op) {
        const premio = num(op.premio);
        const qtd = Math.abs(parseInt(op.quantidade || 0, 10)) || 1;
        return premio * qtd;
    }

    function saldoCorretora() {
        try {
            const cfg = JSON.parse(localStorage.getItem('appConfig') || '{}');
            return num(cfg.saldoAcoes);
        } catch (e) {
            return 0;
        }
    }

    function mesMetrics(ops) {
        ops = Array.isArray(ops) ? ops : [];
        const abertas = ops.filter(isOpen);
        const fechadas = ops.filter(o => !isOpen(o));
        const comResultado = fechadas.filter(o => o.resultado !== null && o.resultado !== undefined && o.resultado !== '');
        const lucrativas = comResultado.filter(o => num(o.resultado) >= 0);
        const premio = ops.reduce((s, o) => s + premioTotal(o), 0);
        const ganho = comResultado.reduce((s, o) => s + num(o.resultado), 0);
        const vencHoje = abertas.filter(o => {
            if (typeof global.calcularDuracaoDias !== 'function') return false;
            const d = global.calcularDuracaoDias(global.getCurrentDate ? global.getCurrentDate() : new Date(), o.vencimento);
            return d !== null && d <= 1;
        }).length;
        const saldo = saldoCorretora();
        const resultadoMedio = saldo > 0 ? (ganho / saldo) * 100 : 0;
        return {
            n: ops.length,
            abertas: abertas.length,
            fechadas: fechadas.length,
            premio: premio,
            premioMedio: ops.length ? premio / ops.length : 0,
            win: comResultado.length ? (lucrativas.length / comResultado.length) * 100 : null,
            winN: lucrativas.length,
            winTotal: comResultado.length,
            ganho: ganho,
            resultadoMedio: resultadoMedio,
            vencHoje: vencHoje
        };
    }

    function renderGadgets(ops) {
        const el = document.getElementById('mesKpiGrid');
        if (!el) return;
        const m = mesMetrics(ops);
        const kpis = [
            { cls: 'k-blue', lbl: 'Operações do mês', val: String(m.n),
              sub: m.abertas + ' abertas · ' + m.fechadas + ' fechadas' },
            { cls: 'k-green', lbl: 'Prêmio do mês', val: brl(m.premio),
              sub: 'média de ' + brl(m.premioMedio) + ' por operação' },
            { cls: 'k-yellow', lbl: 'Abertas agora', val: String(m.abertas),
              sub: m.vencHoje ? (m.vencHoje + ' vencendo hoje/amanhã') : 'nenhum vencimento iminente' },
            { cls: (m.win !== null && m.win >= 50) ? 'k-green' : 'k-red',
              lbl: 'Taxa de acerto',
              val: m.win !== null ? m.win.toFixed(0) + '%' : '—',
              sub: m.winTotal ? (m.winN + ' de ' + m.winTotal + ' fechadas lucrativas') : 'sem fechadas no mês' },
            { cls: m.ganho >= 0 ? 'k-green' : 'k-red', lbl: 'Resultado do mês',
              val: brl(m.ganho), sub: 'soma dos resultados registrados' },
            { cls: m.resultadoMedio >= 0 ? 'k-green' : 'k-red', lbl: 'Resultado médio',
              val: m.resultadoMedio.toFixed(2) + '%', sub: 'sobre o saldo da corretora' }
        ];
        el.innerHTML = kpis.map(k =>
            '<div class="mes-kpi ' + k.cls + '">' +
                '<span class="mes-kpi-lbl">' + k.lbl + '</span>' +
                '<span class="mes-kpi-val">' + k.val + '</span>' +
                '<span class="mes-kpi-sub">' + k.sub + '</span>' +
            '</div>').join('');

        const chartWrap = document.getElementById('mesViewChart');
        if (chartWrap && !chartWrap.hidden) renderEvoChart(ops);
    }

    function renderEvoChart(ops) {
        const canvas = document.getElementById('chartMesEvo');
        if (!canvas || typeof global.Chart === 'undefined') return;

        const ym = (typeof global.getCurrentMonth === 'function') ? global.getCurrentMonth() : '';
        const parts = String(ym).split('-');
        if (parts.length < 2) return;
        const total = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
        const perDay = new Array(total + 1).fill(0);
        (ops || []).forEach(o => {
            const ds = String(o.data_operacao || '');
            if (ds.slice(0, 7) !== ym) return;
            const d = parseInt(ds.slice(8, 10), 10);
            if (d >= 1 && d <= total) perDay[d] += premioTotal(o);
        });

        const labels = [], bars = [], acum = [];
        let acc = 0;
        for (let d = 1; d <= total; d++) {
            labels.push(String(d));
            bars.push(Number(perDay[d].toFixed(2)));
            acc += perDay[d];
            acum.push(Number(acc.toFixed(2)));
        }

        if (_chart) { try { _chart.destroy(); } catch (e) { /* best-effort */ } }
        try {
            _chart = new global.Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { type: 'bar', label: 'Prêmio do dia (R$)', data: bars,
                          backgroundColor: 'rgba(47,179,68,.65)', borderRadius: 3, order: 2 },
                        { type: 'line', label: 'Acumulado (R$)', data: acum,
                          borderColor: '#4da6ff', backgroundColor: 'rgba(77,166,255,.15)',
                          borderWidth: 2, tension: .35, pointRadius: 0, fill: true, yAxisID: 'y1', order: 1 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { labels: { color: '#8aa4c0', boxWidth: 12, font: { size: 11 } } } },
                    scales: {
                        x: { ticks: { color: '#5b7291', font: { size: 10 }, maxRotation: 0, autoSkip: true },
                             grid: { display: false } },
                        y: { beginAtZero: true,
                             ticks: { color: '#5b7291', font: { size: 10 }, callback: v => 'R$ ' + v },
                             grid: { color: 'rgba(255,255,255,.06)' } },
                        y1: { position: 'right', beginAtZero: true,
                              ticks: { color: '#4da6ff', font: { size: 10 } },
                              grid: { display: false } }
                    }
                }
            });
        } catch (e) {
            console.warn('[opcoes] Falha ao montar gráfico da evolução do mês:', e);
        }
    }

    function toggleView() {
        const g = document.getElementById('mesViewGadgets');
        const c = document.getElementById('mesViewChart');
        const btn = document.getElementById('btnMesView');
        if (!g || !c) return;
        const showChart = c.hidden;
        g.hidden = showChart;
        c.hidden = !showChart;
        if (btn) btn.innerHTML = showChart ? '&#128201; Ver gadgets' : '&#128200; Ver gráfico';
        if (showChart) renderEvoChart(_mesOps);
    }

    function setupToolbar() {
        if (_toolbarBound) return;
        _toolbarBound = true;
        document.getElementById('btnMesView')?.addEventListener('click', toggleView);
        document.getElementById('btnMesRefresh')?.addEventListener('click', function () {
            if (typeof global.loadOperacoes === 'function') global.loadOperacoes();
            else document.dispatchEvent(new CustomEvent('opcoesDataUpdated'));
        });
    }

    // ── Filtros rápidos (Todas/Abertas/Fechadas) ────────────────────────────
    let _currentFilter = 'ABERTA';

    function getTable() {
        try {
            if (global.$ && global.$('#tableMesAtual').length) {
                return global.$('#tableMesAtual').DataTable();
            }
        } catch (e) { /* noop */ }
        return null;
    }

    function applyStatusFilter() {
        const dt = getTable();
        if (!dt) return;
        // Coluna 14 = Status (badge "ABERTA"/"FECHADA"/...) — filtro por substring
        // para não falhar com espaços ou marcação residual do badge.
        const col = dt.column(14);
        if (_currentFilter === 'all') { col.search('', false, false).draw(); return; }
        if (_currentFilter === 'ABERTA') { col.search('ABERTA', false, false).draw(); return; }
        if (_currentFilter === 'FECHADA') { col.search('FECHADA|EXERCIDA|ENCERRADA|VENCIDA', true, false).draw(); return; }
        col.search(_currentFilter, false, false).draw();
    }

    function setupFilterButtons() {
        const btns = document.querySelectorAll('.opcoes-filter-btn');
        if (!btns.length) return;
        btns.forEach(btn => {
            if (btn.dataset.bound === 'true') return;
            btn.dataset.bound = 'true';
            btn.addEventListener('click', function () {
                btns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                _currentFilter = this.dataset.filter || 'all';
                applyStatusFilter();
            });
        });
        applyStatusFilter();
    }

    function render(mesOps, allOps) {
        _mesOps = Array.isArray(mesOps) ? mesOps : [];
        setupToolbar();
        renderGadgets(_mesOps);
        setupFilterButtons();
    }

    function init() {
        setupToolbar();
        setupFilterButtons();
        // Repinta quando os dados mudarem, caso o render não tenha sido chamado explicitamente.
        document.addEventListener('opcoesDataUpdated', function (ev) {
            const all = (ev && ev.detail && ev.detail.operacoes) || global.opcoesOperacoes || [];
            const mes = (typeof global.filterByMonth === 'function' && typeof global.getCurrentMonth === 'function')
                ? global.filterByMonth(all, global.getCurrentMonth()) : all;
            render(mes, all);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    global.MesAtualOpcoes = { render: render, applyStatusFilter: applyStatusFilter };
})(window);

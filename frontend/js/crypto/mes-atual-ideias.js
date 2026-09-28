// mes-atual-ideias.js — Demo: gadgets + gráfico + DataTable real da aba "Mês Atual"
// v2.0.0 — layout conforme referência: gadgets em largura total, botão alterna para o
//          gráfico da evolução diária; DataTable idêntico ao da tela real (mesmas colunas,
//          config, filtros e badges), sem alterar o crypto.html.
(function () {
    'use strict';

    var state = { ops: [], source: '', filter: 'ABERTA', view: 'gadgets' };
    var charts = {};
    var dtMes = null;

    /* ─────────────────── util ─────────────────── */

    function apiBase() {
        return typeof API_BASE !== 'undefined' ? API_BASE : (window.API_BASE || '');
    }

    function curMonth() {
        return typeof getCurrentMonth === 'function'
            ? getCurrentMonth()
            : new Date().toISOString().slice(0, 7);
    }

    function byMonth(data, m) {
        if (typeof filterByMonth === 'function') return filterByMonth(data, m);
        return data.filter(function (o) { return String(o.data_operacao || '').indexOf(m) === 0; });
    }

    function num(v) { return parseFloat(v) || 0; }

    // MESMO formato do fmtUsd do crypto.js (tela real)
    function usd(v) {
        return 'US$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function isOpen(op) {
        var s = String(op.status || 'ABERTA').toUpperCase();
        return s === 'ABERTA' || s === 'ABERTO';
    }

    function isOpenStatus(s) {
        s = String(s || '').toUpperCase();
        return s === 'ABERTA' || s === 'ABERTO';
    }

    function daysUntil(dateStr) {
        if (!dateStr) return null;
        var d = new Date(String(dateStr).slice(0, 10) + 'T23:59:59');
        if (isNaN(d.getTime())) return null;
        return Math.ceil((d.getTime() - Date.now()) / 86400000);
    }

    /* ─────────────────── fallback (dados de exemplo) ─────────────────── */

    function fallbackOps() {
        var ym = curMonth();
        var day = Math.max(1, new Date().getDate());
        function dateAt(offset, prazo) {
            var dt = new Date(ym + '-' + String(Math.max(1, Math.min(day, 1 + offset))).padStart(2, '0') + 'T12:00:00');
            var ex = new Date(dt.getTime());
            ex.setDate(ex.getDate() + (prazo || 1));
            return [dt.toISOString().slice(0, 10), ex.toISOString().slice(0, 10)];
        }
        function mk(id, ativo, tipo, status, strike, cot, premio, abertura, tae, off, prazo, resultado, crypto, corr) {
            var dates = dateAt(off, prazo);
            return {
                id: id, ativo: ativo, tipo: tipo, status: status, corretora: corr || 'BINANCE',
                strike: strike, cotacao_atual: cot, premio_us: premio, abertura: abertura, tae: tae,
                crypto: crypto, data_operacao: dates[0], exercicio: dates[1], prazo: prazo,
                resultado: status === 'ABERTA' ? null : resultado
            };
        }
        var d = Math.min(day, 14);
        return [
            mk(9001, 'ETH', 'CALL', 'ABERTA', 2700, 2712.40, 7.85, 2700, 57.03, 0, 1, null, 1.8596),
            mk(9002, 'BTC', 'CALL', 'ABERTA', 84000, 83546.00, 33.10, 84000, 48.20, 1, 2, null, 0.2440),
            mk(9003, 'ETH', 'PUT', 'ABERTA', 2650, 2712.40, 6.20, 2650, 52.10, 2, 1, null, 1.7200),
            mk(9004, 'BTC', 'PUT', 'ABERTA', 83000, 83546.00, 28.45, 83000, 44.90, 3, 2, null, 0.2300),
            mk(9011, 'ETH', 'CALL', 'FECHADA', 2600, 2598.10, 8.40, 2600, 61.20, Math.max(0, d - 12), 1, 1.02, 1.8596),
            mk(9012, 'BTC', 'CALL', 'FECHADA', 82500, 82455.00, 30.20, 82500, 46.50, Math.max(0, d - 11), 1, 0.88, 0.2500),
            mk(9013, 'ETH', 'PUT', 'FECHADA', 2550, 2598.10, 5.90, 2550, 54.30, Math.max(0, d - 9), 1, 1.15, 1.7800),
            mk(9014, 'SOL', 'CALL', 'FECHADA', 195, 198.20, 1.95, 195, 49.80, Math.max(0, d - 8), 1, -0.42, 45.00),
            mk(9015, 'BTC', 'PUT', 'FECHADA', 85000, 82455.00, 26.80, 85000, 43.10, Math.max(0, d - 6), 1, 1.31, 0.2200),
            mk(9016, 'ETH', 'CALL', 'EXERCIDA', 2500, 2598.10, 7.10, 2500, 58.90, Math.max(0, d - 5), 1, 2.05, 1.9000),
            mk(9017, 'BNB', 'CALL', 'FECHADA', 620, 612.40, 2.35, 620, 45.60, Math.max(0, d - 3), 1, -0.55, 10.5000),
            mk(9018, 'ETH', 'PUT', 'FECHADA', 2680, 2712.40, 6.55, 2680, 55.40, Math.max(0, d - 2), 1, 0.94, 1.8100)
        ];
    }

    /* ─────────────────── métricas do mês ─────────────────── */

    function metrics(ops) {
        var abertas = ops.filter(isOpen);
        var fechadas = ops.filter(function (o) { return !isOpen(o); });
        var comResultado = fechadas.filter(function (o) { return o.resultado !== null && o.resultado !== undefined; });
        var lucrativas = comResultado.filter(function (o) { return num(o.resultado) >= 0; });
        var premio = ops.reduce(function (s, o) { return s + num(o.premio_us); }, 0);
        var taeOps = ops.filter(function (o) { return num(o.tae) > 0; });
        var taeMed = taeOps.length ? taeOps.reduce(function (s, o) { return s + num(o.tae); }, 0) / taeOps.length : 0;
        var ganho = comResultado.reduce(function (s, o) { return s + num(o.resultado); }, 0);
        var vencHoje = abertas.filter(function (o) {
            var d = daysUntil(o.exercicio);
            return d !== null && d <= 1;
        }).length;
        return {
            n: ops.length,
            abertas: abertas.length,
            fechadas: fechadas.length,
            premio: premio,
            premioMedio: ops.length ? premio / ops.length : 0,
            win: comResultado.length ? (lucrativas.length / comResultado.length) * 100 : null,
            winN: lucrativas.length,
            winTotal: comResultado.length,
            taeMed: taeMed,
            ganho: ganho,
            vencHoje: vencHoje
        };
    }

    /* ─────────────────── Gadgets (KPIs) ─────────────────── */

    function renderKpis() {
        var m = metrics(state.ops);
        var kpis = [
            { cls: 'k-blue', lbl: 'Operações do mês', val: String(m.n), sub: m.abertas + ' abertas · ' + m.fechadas + ' fechadas' },
            { cls: 'k-green', lbl: 'Prêmio do mês', val: usd(m.premio), sub: 'média de ' + usd(m.premioMedio) + ' por operação' },
            {
                cls: 'k-yellow', lbl: 'Abertas agora', val: String(m.abertas),
                sub: m.vencHoje ? (m.vencHoje + ' vencendo hoje/amanhã') : 'nenhum vencimento iminente'
            },
            {
                cls: m.win !== null && m.win >= 50 ? 'k-green' : 'k-red',
                lbl: 'Taxa de acerto', val: m.win !== null ? m.win.toFixed(0) + '%' : '—',
                sub: m.winTotal ? (m.winN + ' de ' + m.winTotal + ' fechadas lucrativas') : 'sem fechadas no mês'
            },
            { cls: 'k-blue', lbl: 'TAE médio', val: m.taeMed ? m.taeMed.toFixed(2) + '%' : '—', sub: 'prêmio sobre a abertura' },
            {
                cls: m.ganho >= 0 ? 'k-green' : 'k-red',
                lbl: 'Retorno acumulado', val: (m.ganho >= 0 ? '+' : '') + m.ganho.toFixed(2) + '%',
                sub: 'soma dos resultados fechados'
            }
        ];
        var el = document.getElementById('kpiGrid');
        if (!el) return;
        el.innerHTML = kpis.map(function (k) {
            return '<div class="kpi ' + k.cls + '">' +
                '<span class="lbl">' + esc(k.lbl) + '</span>' +
                '<span class="val">' + esc(k.val) + '</span>' +
                '<span class="sub">' + esc(k.sub) + '</span>' +
                '</div>';
        }).join('');
    }

    /* ─────────────────── Gráfico: evolução diária ─────────────────── */

    function mkChart(id, cfg) {
        if (typeof Chart === 'undefined') return null;
        if (charts[id]) { try { charts[id].destroy(); } catch (e) { /* destruição best-effort */ } }
        var el = document.getElementById(id);
        if (!el) return null;
        try {
            charts[id] = new Chart(el, cfg);
            return charts[id];
        } catch (e) {
            console.warn('[mes-atual-ideias] falha ao montar gráfico ' + id + ':', e);
            return null;
        }
    }

    function daysInMonth(ym) {
        var y = num(ym.slice(0, 4)), m = num(ym.slice(5, 7));
        return new Date(y, m, 0).getDate();
    }

    function renderEvo() {
        var hasChart = typeof Chart !== 'undefined';
        var n3 = document.getElementById('noteChart3');
        if (n3) n3.hidden = hasChart;
        if (!hasChart) return;

        var ym = curMonth();
        var total = daysInMonth(ym);
        var perDay = new Array(total + 1).fill(0);
        state.ops.forEach(function (o) {
            var ds = String(o.data_operacao || '');
            if (ds.slice(0, 7) !== ym) return;
            var d = num(ds.slice(8, 10));
            if (d >= 1 && d <= total) perDay[d] += num(o.premio_us);
        });
        var labels = [], bars = [], acum = [], acc = 0;
        for (var d = 1; d <= total; d++) {
            labels.push(String(d));
            bars.push(perDay[d]);
            acc += perDay[d];
            acum.push(Number(acc.toFixed(2)));
        }

        mkChart('chEvo', {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar', label: 'Prêmio do dia (US$)', data: bars,
                        backgroundColor: 'rgba(47,179,68,.65)', borderRadius: 3, order: 2
                    },
                    {
                        type: 'line', label: 'Acumulado (US$)', data: acum,
                        borderColor: '#4da6ff', backgroundColor: 'rgba(77,166,255,.15)',
                        borderWidth: 2, tension: .35, pointRadius: 0, fill: true, yAxisID: 'y1', order: 1
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#8aa4c0', boxWidth: 12, font: { size: 11 } } }
                },
                scales: {
                    x: { ticks: { color: '#5b7291', font: { size: 10 }, maxRotation: 0, autoSkip: true }, grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#5b7291', font: { size: 10 }, callback: function (v) { return 'US$ ' + v; } },
                        grid: { color: 'rgba(255,255,255,.06)' }
                    },
                    y1: {
                        position: 'right', beginAtZero: true,
                        ticks: { color: '#4da6ff', font: { size: 10 }, callback: function (v) { return v + '%'; } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    /* ─────────────────── Alternância gadgets ↔ gráfico ─────────────────── */

    function setView(v) {
        state.view = (v === 'chart') ? 'chart' : 'gadgets';
        var g = document.getElementById('viewGadgets');
        var c = document.getElementById('viewChart');
        var btn = document.getElementById('btnToggleView');
        if (g) g.hidden = state.view !== 'gadgets';
        if (c) c.hidden = state.view !== 'chart';
        if (btn) btn.innerHTML = state.view === 'gadgets' ? '&#128200; Ver gráfico' : '&#128201; Ver gadgets';
        if (state.view === 'chart') renderEvo();
    }

    /* ─────────────────── DataTable real (réplica do crypto.js) ─────────────────── */

    function acoesHtml(status, id) {
        return '<div class="btn-list flex-nowrap">' +
            (status === 'ABERTA'
                ? '<button class="btn btn-sm btn-warning btn-icon crypto-fechar-btn" data-op-id="' + id + '" title="Fechar Operação"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>'
                : '') +
            '<button class="btn btn-sm btn-primary btn-icon crypto-edit-btn" data-op-id="' + id + '" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
            (status === 'ABERTA'
                ? '<button class="btn btn-sm btn-danger btn-icon crypto-delete-btn" data-op-id="' + id + '" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>'
                : '') +
            '</div>';
    }

    // Células idênticas a populateTable() do crypto.js (17 colunas)
    function rowCells(op) {
        var pct = (op.abertura && op.premio_us)
            ? ((parseFloat(op.premio_us) / parseFloat(op.abertura)) * 100).toFixed(2) + '%'
            : '-';
        var tipoBadge = op.tipo === 'CALL'
            ? '<span class="badge crypto-badge-call">CALL</span>'
            : '<span class="badge crypto-badge-put">PUT</span>';
        var exBadge = window.CryptoExerciseStatus && window.CryptoExerciseStatus.renderBadgeHtml
            ? window.CryptoExerciseStatus.renderBadgeHtml(op, {
                openPositive: 'bg-warning text-dark',
                openNegative: 'bg-success text-white',
                closedPositive: 'bg-warning text-dark',
                closedNegative: 'bg-secondary text-white'
            })
            : '<span class="badge bg-secondary text-white">NÃO</span>';
        var status = op.status || 'ABERTA';
        var statusBadge = status === 'ABERTA'
            ? '<span class="badge bg-success text-white">ABERTA</span>'
            : status === 'FECHADA'
                ? '<span class="badge bg-azure text-white">FECHADA</span>'
                : '<span class="badge bg-danger text-white">' + status + '</span>';
        var resultado = parseFloat(op.resultado) || 0;
        var resHtml = op.resultado != null
            ? '<span class="' + (resultado >= 0 ? 'text-success' : 'text-danger') + '">' + resultado.toFixed(2) + '%</span>'
            : '-';
        var corretoraBadge = (function () {
            var c = (op.corretora || 'BINANCE').toUpperCase();
            if (c === 'BINANCE') return '<span class="badge bg-warning text-dark" title="Binance">BNC</span>';
            if (c === 'BYBIT') return '<span class="badge bg-info text-white" title="Bybit">BB</span>';
            return '<span class="badge bg-secondary text-white">' + esc(c) + '</span>';
        })();
        var prazoCell = '-';
        if (typeof calcularDuracaoDias === 'function' && typeof getCurrentDate === 'function') {
            var d = calcularDuracaoDias(getCurrentDate(), op.exercicio);
            prazoCell = d !== null ? d + 'd' : (op.prazo ? op.prazo + 'd' : '-');
        } else if (op.prazo) {
            prazoCell = op.prazo + 'd';
        }
        return [
            corretoraBadge,
            '<span class="badge bg-warning text-dark op-analise-link" style="cursor:pointer" title="Análise completa" data-op-id="' + op.id + '">' + (op.ativo || '-') + '</span>',
            tipoBadge,
            op.cotacao_atual ? usd(op.cotacao_atual) : '-',
            op.abertura ? usd(op.abertura) : '-',
            op.tae ? parseFloat(op.tae).toFixed(2) + '%' : '-',
            op.strike ? usd(op.strike) : '-',
            op.distancia ? parseFloat(op.distancia).toFixed(2) + '%' : '-',
            op.premio_us ? usd(op.premio_us) : '-',
            pct, resHtml,
            op.exercicio ? (typeof formatDateCell === 'function' ? formatDateCell(op.exercicio) : String(op.exercicio)) : '-',
            prazoCell,
            op.crypto ? parseFloat(op.crypto).toFixed(6) : '-',
            exBadge, statusBadge,
            acoesHtml(status, op.id)
        ];
    }

    // Mesma ordenação do populateTable(..., { prioritizeOpen: true })
    function sortedOps() {
        return state.ops.slice().sort(function (a, b) {
            var aOpen = (a.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
            var bOpen = (b.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
            if (aOpen !== bOpen) return aOpen - bOpen;
            return new Date(b.exercicio || b.data_operacao || 0) - new Date(a.exercicio || a.data_operacao || 0);
        });
    }

    // Config idêntico ao initDataTables() do crypto.js
    function tryInitDT() {
        if (dtMes) return true;
        if (typeof jQuery === 'undefined' || !jQuery.fn || !jQuery.fn.DataTable) return false;
        var dtConfig = {
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json' },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'Todos']],
            responsive: false,
            scrollX: true,
            autoWidth: false,
            order: [[11, 'desc']],
            columnDefs: [
                { targets: 16, orderable: false },
                { targets: [0, 1, 2, 14, 15, 16], width: 'auto' }
            ]
        };
        try {
            dtMes = jQuery('#tableMesAtual').DataTable(dtConfig);
            return true;
        } catch (e) {
            console.warn('[mes-atual-ideias] falha ao iniciar DataTable:', e);
            return false;
        }
    }

    function matchFilter(o) {
        if (state.filter === 'all') return true;
        if (state.filter === 'ABERTA') return isOpen(o);
        if (state.filter === 'FECHADA') return !isOpen(o);
        return true;
    }

    // Mesmos regex do applyStatusFilterMesAtual() do crypto.js (coluna 15 = Status)
    function applyStatusFilter() {
        if (!dtMes) return;
        var col = dtMes.column(15);
        if (state.filter === 'all') { col.search('', false, false).draw(); return; }
        if (state.filter === 'ABERTA') { col.search('^ABERTA$', true, false).draw(); return; }
        if (state.filter === 'FECHADA') { col.search('FECHADA|EXERCIDA|ENCERRADA', true, false).draw(); return; }
        col.search(state.filter, false, false).draw();
    }

    function populateDataTable() {
        var titleEl = document.getElementById('mesAtualTitle');
        if (titleEl && typeof getMonthName === 'function') {
            titleEl.textContent = 'Operacoes - ' + getMonthName(curMonth());
        }

        var ops = sortedOps();
        if (dtMes) {
            dtMes.clear();
            ops.forEach(function (op) { dtMes.row.add(rowCells(op)); });
            dtMes.draw();
            if (dtMes.columns && dtMes.columns.adjust) dtMes.columns.adjust();
            applyStatusFilter();
            return;
        }

        // Sem DataTables (libs ainda carregando): tbody simples, mesma ordenação/filtro
        var visible = ops.filter(matchFilter);
        var tb = document.querySelector('#tableMesAtual tbody');
        if (!tb) return;
        tb.innerHTML = visible.length
            ? visible.map(function (op) {
                return '<tr>' + rowCells(op).map(function (c) {
                    return '<td>' + c + '</td>';
                }).join('') + '</tr>';
            }).join('')
            : '<tr><td class="tbl-empty" colspan="17">Nenhuma operação para o filtro atual.</td></tr>';
    }

    /* ─────────────────── orquestração ─────────────────── */

    function renderBadge() {
        var el = document.getElementById('srcBadge');
        if (!el) return;
        el.textContent = (state.source === 'api' ? 'API real · ' : 'dados de exemplo · ') + state.ops.length + ' ops';
        el.className = 'src-badge' + (state.source === 'api' ? '' : ' mock');
    }

    function render() {
        renderBadge();
        renderKpis();
        if (state.view === 'chart') renderEvo();
        populateDataTable();
    }

    function load() {
        var el = document.getElementById('srcBadge');
        if (el) { el.textContent = 'carregando…'; el.className = 'src-badge'; }
        fetch(apiBase() + '/api/crypto', { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var arr = Array.isArray(data) ? data : (data.operacoes || data.data || []);
                state.ops = byMonth(arr, curMonth());
                state.source = 'api';
                render();
            })
            .catch(function (err) {
                console.warn('[mes-atual-ideias] API indisponível, usando dados de exemplo:', err);
                state.ops = fallbackOps();
                state.source = 'mock';
                render();
            });
    }

    function bindEvents() {
        var btn = document.getElementById('btnReload');
        if (btn) btn.addEventListener('click', load);

        var btnView = document.getElementById('btnToggleView');
        if (btnView) btnView.addEventListener('click', function () {
            setView(state.view === 'gadgets' ? 'chart' : 'gadgets');
        });

        document.querySelectorAll('.crypto-filter-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                document.querySelectorAll('.crypto-filter-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                state.filter = b.dataset ? (b.dataset.filter || 'all') : (b.getAttribute('data-filter') || 'all');
                if (dtMes) applyStatusFilter();
                else populateDataTable();
            });
        });
    }

    function init() {
        bindEvents();
        tryInitDT();
        if (dtMes && state.ops.length) populateDataTable();

        document.addEventListener('libsLoaded', function () {
            if (tryInitDT()) populateDataTable();
        });

        // aguarda libs.js (jQuery + DataTables) carregar — máx. 15s
        var polls = 0;
        var iv = setInterval(function () {
            polls++;
            if (tryInitDT() || polls > 30) {
                clearInterval(iv);
                if (dtMes) populateDataTable();
            }
        }, 500);

        load();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/**
 * modal-dashboard-crypto.js  v1.1.0
 * Dashboard Avançado de Performance · Crypto
 * Layout "Bento Executivo" + acordeão de meses — baseado em
 * ideias/dashboard-performance-Claude.html, com dados 100% reais de /api/crypto.
 * Cabeçalho/filtros continuam a cargo do CryptoModalHeader (padrão do site).
 */

;(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /*  Configuração padrão (substituída via configure())                   */
    /* ------------------------------------------------------------------ */
    const cfg = {
        currency       : 'USD',
        apiEndpoint    : '/api/crypto',
        modalElId      : 'modalDashboardCrypto',
        containerElId  : 'modalDashboardCryptoContainer',
        templatePath   : 'modal-dashboard-crypto.html',
        templateVersion: '1.1.0',
        triggerCard    : 'cardSaldoCryptoCard',
        /** Retorna o saldo numérico da conta de crypto */
        getSaldo       : function () {
            try {
                const cfg2 = JSON.parse(localStorage.getItem('cryptoConfig') || '{}');
                return parseFloat(cfg2.saldoCrypto || 0);
            } catch (_) { return 0; }
        },
        /** Valor monetário principal da operação (prêmio em USD) */
        getResultValue : function (op) {
            return parseFloat(op.premio_us) || 0;
        },
        /** Ativo da operação */
        getAtivo       : function (op) {
            return op.ativo || '—';
        },
        /** Chave de meta no localStorage */
        metaKey        : 'metaCrypto',
    };

    /* ------------------------------------------------------------------ */
    /*  Estado                                                              */
    /* ------------------------------------------------------------------ */
    let loaded          = false;
    let _dcStartDate    = null;
    let _dcEndDate      = null;
    let _header         = null;
    let _dcPeriod       = 'mes';
    let _dcState        = null;
    let _dcTipo         = 'ALL';
    let _dcAsset        = null;
    let _dcCorr         = null;
    let _dcStatus       = null;
    let _bentoUid       = 0;
    let _bodyBound      = false;

    /* Mapeamento de período cfb-bar → applyPeriodo() */
    const _PERIOD_MAP = {
        'all':    '_all',
        'today':  'today',
        'semana': 'semana',
        '7d':     '7',
        'mes':    'month',
        '30d':    '30',
        '60d':    '60',
        '90d':    '90',
        'ano':    'year',
    };

    const _MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    /* ------------------------------------------------------------------ */
    /*  Utilitários (mantidos)                                              */
    /* ------------------------------------------------------------------ */
    function fmtC(value) {
        const v = parseFloat(value) || 0;
        if (window.CryptoExerciseStatus?.formatUsd) {
            return window.CryptoExerciseStatus.formatUsd(v);
        }
        return (v < 0 ? '-' : '') + 'US$ ' + Math.abs(v).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function parseDateLocal(str) {
        if (!str) return null;
        const iso = /^\d{4}-\d{2}-\d{2}$/.test(str)
            ? new Date(str + 'T00:00:00')
            : new Date(str);
        return isNaN(iso.getTime()) ? null : iso;
    }

    function getOpDate(op) {
        // Usa data_operacao (abertura) como referência primária.
        const raw = op.data_operacao || op.created_at || op.exercicio || null;
        if (!raw) return null;
        return parseDateLocal(raw.toString().trim().slice(0, 10));
    }

    function getDateKey(date) {
        return date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0');
    }

    function filterOps(ops, startDate, endDate, tipoFiltro, asset, corretora, status) {
        return ops.filter(op => {
            const d = getOpDate(op);
            if (!d) return false;
            if (d < startDate || d > endDate) return false;
            if (tipoFiltro && tipoFiltro !== 'ALL' && (op.tipo || '') !== tipoFiltro) return false;
            if (asset) {
                const a = (op.ativo || '').toUpperCase();
                const assetOp = a.split('/')[0].replace(/USDT$/, '').trim();
                if (assetOp !== asset.toUpperCase()) return false;
            }
            if (corretora) {
                const c = (op.corretora || 'BINANCE').toUpperCase();
                if (c !== corretora) return false;
            }
            if (status) {
                const s = (op.status || '').toLowerCase();
                if (status === 'exercida') {
                    const isEx = window.CryptoExerciseStatus
                        ? window.CryptoExerciseStatus.isActuallyExercised(op)
                        : (s === 'fechada' && (op.exercicio_status || '').toUpperCase() === 'SIM');
                    if (!isEx) return false;
                } else if (status === 'nao_exercida') {
                    if (s === 'aberta') return false;
                    const isEx = window.CryptoExerciseStatus
                        ? window.CryptoExerciseStatus.isActuallyExercised(op)
                        : (s === 'fechada' && (op.exercicio_status || '').toUpperCase() === 'SIM');
                    if (isEx) return false;
                } else if (s !== status.toLowerCase()) return false;
            }
            return true;
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Dados reais: helpers de valor/resultado/win rate                    */
    /* ------------------------------------------------------------------ */
    function isAberta(op) {
        return String(op.status || '').toUpperCase() === 'ABERTA';
    }

    /* Resultado realizado da op (campo da API); null quando ainda não definido */
    function resultadoOf(op) {
        const r = op.resultado;
        if (r === null || r === undefined || r === '') return null;
        const v = parseFloat(r);
        return isFinite(v) ? v : null;
    }

    /* Valor "realizado" do dia: resultado quando existe, senão o prêmio recebido */
    function opValue(op) {
        const r = resultadoOf(op);
        return r !== null ? r : cfg.getResultValue(op);
    }

    /* Win rate: % das ops COM resultado definido cujo resultado é lucrativo */
    function winRateOf(ops) {
        const com = ops.filter(op => resultadoOf(op) !== null);
        if (!com.length) return null;
        const wins = com.filter(op => resultadoOf(op) >= 0).length;
        return (wins / com.length) * 100;
    }

    function normAtivo(op) {
        if (window.CryptoFilterBar && window.CryptoFilterBar.getAsset) {
            return window.CryptoFilterBar.getAsset(op.ativo);
        }
        return cfg.getAtivo(op);
    }

    /* Métricas por dia: { 'YYYY-MM-DD': { ops, premio, value } } */
    function dayMetrics(ops) {
        const map = new Map();
        ops.forEach(op => {
            const d = getOpDate(op);
            if (!d) return;
            const key = getDateKey(d);
            if (!map.has(key)) map.set(key, { ops: 0, premio: 0, value: 0 });
            const m = map.get(key);
            m.ops += 1;
            m.premio += cfg.getResultValue(op);
            m.value += opValue(op);
        });
        return map;
    }

    /* ------------------------------------------------------------------ */
    /*  Aplicar período (seletor)                                           */
    /* ------------------------------------------------------------------ */
    function applyPeriodo(value) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let start, end = new Date(today);

        if (value === 'semana') {
            const dow = today.getDay();
            start = new Date(today);
            start.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
        }
        else if (value === '7')        { start = new Date(today); start.setDate(today.getDate() - 6); }
        else if (value === '30')  { start = new Date(today); start.setDate(today.getDate() - 29); }
        else if (value === '60')  { start = new Date(today); start.setDate(today.getDate() - 59); }
        else if (value === '90')  { start = new Date(today); start.setDate(today.getDate() - 89); }
        else if (value === 'month') { start = new Date(today.getFullYear(), today.getMonth(), 1); }
        else if (value === 'year')  { start = new Date(today.getFullYear(), 0, 1); }
        else if (value === 'today') { start = new Date(today); }
        else if (value === 'lastYear') {
            start = new Date(today.getFullYear() - 1, 0, 1);
            end   = new Date(today.getFullYear() - 1, 11, 31);
        }
        else if (value === '12') { start = new Date(today); start.setFullYear(today.getFullYear() - 1); }
        else { return; }

        _dcStartDate = start;
        _dcEndDate   = end;
    }

    /* Resolve o intervalo do período ativo (inclui custom do filter bar) */
    function resolveRange(state) {
        if (state && state.period === 'custom') {
            const s = state.dateFrom ? parseDateLocal(state.dateFrom) : null;
            const e = state.dateTo   ? parseDateLocal(state.dateTo)   : null;
            _dcStartDate = s || new Date(2000, 0, 1);
            _dcEndDate   = e ? new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999) : new Date();
            return;
        }
        const pv = _PERIOD_MAP[(state && state.period) || 'mes'] || 'today';
        if (pv === '_all') {
            _dcStartDate = new Date(2000, 0, 1);
            _dcEndDate   = new Date();
        } else {
            applyPeriodo(pv);
        }
    }

    /* Modo lista (acordeão de meses): "Todos" ou intervalo maior que 1 mês */
    function isListMode() {
        if (_dcPeriod === 'all') return true;
        if (!_dcStartDate || !_dcEndDate) return false;
        const days = Math.round((_dcEndDate - _dcStartDate) / 86400000);
        return days > 31;
    }

    /* ------------------------------------------------------------------ */
    /*  Agregação (dados reais)                                             */
    /* ------------------------------------------------------------------ */
    function groupByMonth(ops) {
        const groups = new Map();
        ops.forEach(op => {
            const d = getOpDate(op);
            if (!d) return;
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            if (!groups.has(key)) groups.set(key, { key, year: d.getFullYear(), month: d.getMonth(), ops: [] });
            groups.get(key).ops.push(op);
        });
        return groups;
    }

    /**
     * Meta de exibição: métricas do conjunto `ops` + grid/weekday do mês
     * (gridYear/gridMonth) calculados com as ops daquele mês.
     */
    function buildMeta(ops, gridYear, gridMonth) {
        const totalOps = ops.length;
        const totalPremio = ops.reduce((s, o) => s + cfg.getResultValue(o), 0);
        const abertas  = ops.filter(isAberta).length;
        const fechadas = totalOps - abertas;
        const winRate  = winRateOf(ops);

        const callOps = ops.filter(o => (o.tipo || '') === 'CALL');
        const putOps  = ops.filter(o => (o.tipo || '') === 'PUT');
        const premio  = arr => arr.reduce((s, o) => s + cfg.getResultValue(o), 0);
        const call = { premio: premio(callOps), ops: callOps.length, winRate: winRateOf(callOps) };
        const put  = { premio: premio(putOps),  ops: putOps.length,  winRate: winRateOf(putOps) };

        const ativoMap = new Map();
        ops.forEach(op => {
            const name = normAtivo(op);
            if (!name || name === '?') return;
            if (!ativoMap.has(name)) ativoMap.set(name, { name, ops: 0, premio: 0, comResultado: 0, wins: 0 });
            const e = ativoMap.get(name);
            e.ops += 1;
            e.premio += cfg.getResultValue(op);
            const r = resultadoOf(op);
            if (r !== null) { e.comResultado += 1; if (r >= 0) e.wins += 1; }
        });
        const ativos = [...ativoMap.values()]
            .sort((a, b) => b.premio - a.premio)
            .slice(0, 5)
            .map(a => ({
                name: a.name,
                ops: a.ops,
                premio: a.premio,
                winRate: a.comResultado > 0 ? (a.wins / a.comResultado) * 100 : null,
                ticket: a.ops > 0 ? a.premio / a.ops : 0,
            }));

        /* Grid do mês + prêmio por dia da semana */
        const monthOps = ops.filter(op => {
            const d = getOpDate(op);
            return d && d.getFullYear() === gridYear && d.getMonth() === gridMonth;
        });
        const dm = dayMetrics(monthOps);

        const daysInMonth = new Date(gridYear, gridMonth + 1, 0).getDate();
        const startIdx = (new Date(gridYear, gridMonth, 1).getDay() + 6) % 7; // 0=Seg..6=Dom
        const grid = [];
        let row = [];
        for (let i = 0; i < startIdx; i++) row.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            const key = gridYear + '-' + String(gridMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const m = dm.get(key);
            row.push(m ? { d: d, ops: m.ops, p: Math.round(m.value * 100) / 100, premio: m.premio, key: key }
                       : { d: d, ops: 0, p: 0, premio: 0, key: key });
            if (row.length === 7) { grid.push(row); row = []; }
        }
        if (row.length) { while (row.length < 7) row.push(null); grid.push(row); }

        const weekday = { Dom: 0, Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0, Sab: 0 };
        const wdKeys = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        dm.forEach((m, key) => {
            const dt = parseDateLocal(key);
            if (dt) weekday[wdKeys[dt.getDay()]] += m.value;
        });

        return {
            grid, weekday, totalOps, totalPremio,
            abertas, fechadas, winRate,
            call, put, ativos,
            gridYear, gridMonth,
        };
    }

    /* ------------------------------------------------------------------ */
    /*  KPIs de topo                                                        */
    /* ------------------------------------------------------------------ */
    function renderTopKpis(ops) {
        const el = document.getElementById('dcTopKpis');
        if (!el) return;
        const abertas  = ops.filter(isAberta).length;
        const premio   = ops.reduce((s, o) => s + cfg.getResultValue(o), 0);
        el.innerHTML =
            '<div class="dc-kpi"><span class="dc-kpi__lbl">📊 Total</span><span class="dc-kpi__val">' + ops.length + '</span></div>' +
            '<div class="dc-kpi"><span class="dc-kpi__lbl">🟢 Abertas</span><span class="dc-kpi__val">' + abertas + '</span></div>' +
            '<div class="dc-kpi"><span class="dc-kpi__lbl">✅ Fechadas</span><span class="dc-kpi__val">' + (ops.length - abertas) + '</span></div>' +
            '<div class="dc-kpi dc-kpi--premio"><span class="dc-kpi__lbl">💰 Prêmio</span><span class="dc-kpi__val">' + fmtC(premio) + '</span></div>';
    }

    /* ------------------------------------------------------------------ */
    /*  Widgets (SVG/HTML string — dados reais)                             */
    /* ------------------------------------------------------------------ */
    function svgEl(tag, attrs) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const k in attrs) el.setAttribute(k, attrs[k]);
        return el;
    }

    function ringSvg(pct, color, size, stroke) {
        size = size || 130; stroke = stroke || 11;
        const r = (size - stroke) / 2;
        const c = 2 * Math.PI * r;
        const v = Math.max(0, Math.min(100, pct || 0));
        const half = size / 2;
        return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" height="100%">' +
            '<circle cx="' + half + '" cy="' + half + '" r="' + r + '" fill="none" stroke="#1c2536" stroke-width="' + stroke + '"/>' +
            '<circle cx="' + half + '" cy="' + half + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke +
            '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - v / 100)) +
            '" transform="rotate(-90 ' + half + ' ' + half + ')"/></svg>';
    }

    function heatBg(day) {
        if (!day || day.ops <= 0) return { bg: '#1a222c', neg: false };
        const p = day.p || 0;
        if (p < 0) {
            const a = Math.abs(p);
            return { bg: a >= 70 ? '#f87171' : a >= 30 ? '#b91c1c' : '#5c1d1d', neg: true };
        }
        return { bg: p >= 70 ? '#3fe089' : p >= 30 ? '#1c8f56' : '#0f3d24', neg: false };
    }

    function heatGridHtml(meta) {
        const wds = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        let html = '<div class="dc-heat">';
        wds.forEach(w => { html += '<div class="dc-heat__wd">' + w + '</div>'; });
        meta.grid.forEach(row => {
            row.forEach(day => {
                if (!day) { html += '<div class="dc-heat__cell dc-heat__cell--empty"></div>'; return; }
                const c = heatBg(day);
                html += '<div class="dc-heat__cell' + (c.neg ? ' dc-heat__cell--neg' : '') + (day.ops > 0 ? ' is-click' : '') +
                    '" style="background:' + c.bg + ';"' +
                    (day.ops > 0 && day.key ? ' data-date="' + day.key + '" title="' + day.key.split('-').reverse().join('/') + ' · Ops: ' + day.ops + ' · ' + fmtC(day.p) + '"' : '') + '>' +
                    '<div class="dc-heat__day">' + day.d + '</div>' +
                    '<div class="dc-heat__meta">Ops: ' + day.ops + '<br>' + (day.ops > 0 ? 'US$ ' + (day.p).toFixed(2) : '—') + '</div>' +
                    '</div>';
            });
        });
        html += '</div>';
        return html;
    }

    function lineSvg(meta, color) {
        const days = [];
        meta.grid.forEach(row => row.forEach(d => { if (d) days.push(d); }));
        if (!days.length) return '';
        let cum = 0;
        const series = [];
        days.forEach(d => {
            if (d.ops > 0 || d.p !== 0) { cum += d.p; series.push({ d: d.d, v: cum }); }
        });
        if (!series.length) return '';
        const W = 480, H = 120, pad = { l: 8, r: 8, t: 12, b: 18 };
        const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
        const n = series.length;
        const vals = series.map(s => s.v);
        const maxV = Math.max.apply(null, vals.concat([0]));
        const minV = Math.min.apply(null, vals.concat([0]));
        const span = (maxV - minV) || 1;
        const x = i => pad.l + plotW * (n > 1 ? i / (n - 1) : 0.5);
        const y = v => pad.t + plotH - ((v - minV) / span) * plotH;

        let out = '<svg class="dc-line" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
        for (let g = 0; g <= 3; g++) {
            const gy = pad.t + plotH - (plotH * g / 3);
            out += '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + gy + '" y2="' + gy + '" stroke="#223050" stroke-width="1" stroke-dasharray="2,4"/>';
        }
        const pts = series.map((s, i) => [x(i), y(s.v)]);
        if (n > 1) {
            out += '<path d="M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L') +
                ' L' + pts[n - 1][0].toFixed(1) + ',' + (pad.t + plotH) + ' L' + pts[0][0].toFixed(1) + ',' + (pad.t + plotH) + ' Z" fill="' + color + '" opacity="0.12"/>';
            out += '<polyline points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2.2"/>';
        } else {
            out += '<circle cx="' + pts[0][0].toFixed(1) + '" cy="' + pts[0][1].toFixed(1) + '" r="4" fill="' + color + '"/>';
        }
        series.forEach((s, i) => {
            if (i % 5 === 0 || i === n - 1) {
                out += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle" fill="#7c8aa0" font-size="9">' + s.d + '</text>';
            }
        });
        out += '</svg>';
        return out;
    }

    function weekdayBarsHtml(meta, color) {
        const order = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        const labels = { Dom: 'Dom', Seg: 'Seg', Ter: 'Ter', Qua: 'Qua', Qui: 'Qui', Sex: 'Sex', Sab: 'Sáb' };
        let max = 0, best = null, bestVal = -Infinity;
        order.forEach(k => {
            const v = meta.weekday[k] || 0;
            if (v > max) max = v;
            if (v > bestVal) { bestVal = v; best = k; }
        });
        let html = '';
        order.forEach(k => {
            const v = meta.weekday[k] || 0;
            const pct = max ? Math.abs(v) / max * 100 : 0;
            html += '<div class="dc-wd"><div class="dc-wd__lbl">' + labels[k] + (k === best && v > 0 ? ' ⭐' : '') + '</div>' +
                '<div class="dc-wd__bar"><div class="dc-wd__fill" style="width:' + pct + '%;background:' + (v >= 0 ? color : '#f87171') + ';"></div></div>' +
                '<div class="dc-wd__val">US$ ' + v.toFixed(2) + '</div></div>';
        });
        return html;
    }

    function bentoHtml(meta) {
        _bentoUid += 1;
        const p = 'dcb' + _bentoUid;
        const medals = ['🥇', '🥈', '🥉'];
        const ativosHtml = meta.ativos.length
            ? meta.ativos.map((a, i) =>
                '<div class="dc-ta"><div class="dc-ta__l"><span>' + (medals[i] || '•') + '</span>' + a.name +
                '<span class="dc-ta__mid">' + a.ops + ' ops · ' + (a.winRate === null ? '—' : Math.round(a.winRate) + '%') + '</span></div>' +
                '<div class="dc-ta__r">US$ ' + a.premio.toFixed(2).replace('.', ',') +
                '<small>tkt US$ ' + a.ticket.toFixed(2).replace('.', ',') + '</small></div></div>').join('')
            : '<div class="dc-empty-sm">Sem dados</div>';

        const order = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        const full = { Dom: 'Domingo', Seg: 'Segunda', Ter: 'Terça', Qua: 'Quarta', Qui: 'Quinta', Sex: 'Sexta', Sab: 'Sábado' };
        let bestKey = null, bestVal = -Infinity;
        order.forEach(k => { const v = meta.weekday[k] || 0; if (v > bestVal) { bestVal = v; bestKey = k; } });

        const wr = meta.winRate === null ? '—' : Math.round(meta.winRate) + '%';
        const wrPct = meta.winRate === null ? 0 : meta.winRate;
        const callWr = meta.call.winRate === null ? '—' : Math.round(meta.call.winRate) + '%';
        const putWr  = meta.put.winRate  === null ? '—' : Math.round(meta.put.winRate)  + '%';

        return '' +
            '<div class="dc-bento">' +
                '<div class="dc-widget dc-hero">' +
                    '<div class="dc-widget__title">💰 Prêmio total no mês</div>' +
                    '<div class="dc-ring">' + ringSvg(wrPct, '#3b82f6') +
                        '<div class="dc-ring__c"><b class="dc-mono">' + wr + '</b><span>win rate</span></div>' +
                    '</div>' +
                    '<div class="dc-hero__premio dc-mono">' + fmtC(meta.totalPremio) + '</div>' +
                    '<div class="dc-hero__sub">' + meta.totalOps + ' ops · ' + meta.fechadas + ' fechadas · ' + meta.abertas + ' aberta' + (meta.abertas !== 1 ? 's' : '') + '</div>' +
                '</div>' +
                '<div class="dc-mini"><span>🟢</span><i>Abertas</i><b>' + meta.abertas + '</b></div>' +
                '<div class="dc-mini"><span>✅</span><i>Fechadas</i><b>' + meta.fechadas + '</b></div>' +
                '<div class="dc-mini"><span>⭐</span><i>Melhor dia</i><b class="dc-mini__day">' + (bestVal > 0 ? full[bestKey] : '—') + '</b></div>' +
                '<div class="dc-widget" style="grid-column:2 / span 3;">' +
                    '<div class="dc-widget__title">📈 Evolução do patrimônio acumulado</div>' +
                    lineSvg(meta, '#3b82f6') +
                '</div>' +
                '<div class="dc-widget" style="grid-column:1 / span 2;">' +
                    '<div class="dc-widget__title">🗓️ Heatmap do mês</div>' + heatGridHtml(meta) +
                '</div>' +
                '<div class="dc-widget">' +
                    '<div class="dc-widget__title">🥊 CALL vs PUT</div>' +
                    '<div class="dc-cvp">' +
                        '<div><div class="dc-cvp__lbl">CALL</div><div class="dc-cvp__val" style="color:#22c55e">' + fmtC(meta.call.premio) + '</div>' +
                            '<div class="dc-cvp__sub">' + callWr + ' · ' + meta.call.ops + ' ops</div></div>' +
                        '<div><div class="dc-cvp__lbl">PUT</div><div class="dc-cvp__val" style="color:#f87171">' + fmtC(meta.put.premio) + '</div>' +
                            '<div class="dc-cvp__sub">' + putWr + ' · ' + meta.put.ops + ' ops</div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="dc-widget"><div class="dc-widget__title">📅 Por dia da semana</div>' + weekdayBarsHtml(meta, '#3b82f6') + '</div>' +
                '<div class="dc-widget"><div class="dc-widget__title">🏆 Top ativos</div>' + ativosHtml + '</div>' +
            '</div>';
    }

    /* ------------------------------------------------------------------ */
  /*  Modo lista: acordeão de meses (ordem decrescente)                    */
  /* ------------------------------------------------------------------ */
    function showMonthList(body, ops) {
        const groups = groupByMonth(ops);
        const keys = Array.from(groups.keys()).sort().reverse();
        if (!keys.length) {
            body.innerHTML = '<div class="dc-empty">Nenhuma operação no período selecionado.</div>';
            return;
        }
        let html = '<div class="dc-mlist">';
        keys.forEach(k => {
            const g = groups.get(k);
            const quick = buildMeta(g.ops, g.year, g.month);
            html +=
                '<div class="dc-mitem" data-mkey="' + k + '">' +
                    '<div class="dc-mhead">' +
                        '<div class="dc-mhead__l"><span class="dc-mhead__label">' + _MONTHS[g.month] + ' ' + g.year + '</span>' +
                            '<span class="dc-mhead__meta">' + quick.totalOps + ' ops</span></div>' +
                        '<div class="dc-mhead__r">' +
                            '<span class="dc-mhead__premio">' + fmtC(quick.totalPremio) + '</span>' +
                            '<span class="dc-mhead__chev">▾</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="dc-mbody"><div class="dc-mbody__in"></div></div>' +
                '</div>';
        });
        html += '</div>';
        body.innerHTML = html;
    }

    /* ------------------------------------------------------------------ */
    /*  Modo direto: bento do período                                       */
    /* ------------------------------------------------------------------ */
    function showDirectDashboard(body, ops) {
        if (!ops.length) {
            body.innerHTML = '<div class="dc-empty">Nenhuma operação no período selecionado.</div>';
            return;
        }
        const end = _dcEndDate || new Date();
        const meta = buildMeta(ops, end.getFullYear(), end.getMonth());
        body.innerHTML = bentoHtml(meta);
    }

    /* ------------------------------------------------------------------ */
    /*  Orquestrador principal                                              */
    /* ------------------------------------------------------------------ */
    function renderAll() {
        const allOps = (window.cryptoOperacoes || window.allOperacoesCrypto || []);

        /* Filtros padrão do site (período/status/tipo/moeda/corretora) */
        const state = _dcState || { period: _dcPeriod || 'mes' };
        let ops;
        if (window.CryptoFilterBar && typeof window.CryptoFilterBar.filter === 'function') {
            ops = window.CryptoFilterBar.filter(allOps, state);
        } else {
            ops = filterOps(allOps,
                _dcStartDate || new Date(2000, 0, 1),
                _dcEndDate   || new Date(),
                _dcTipo, _dcAsset, _dcCorr, _dcStatus);
        }

        renderTopKpis(ops);

        const body = document.getElementById('dcBentoBody');
        if (body) {
            if (isListMode()) showMonthList(body, ops);
            else showDirectDashboard(body, ops);
            bindBody(body);
        }

        if (_header) {
            _header.setOps(allOps, ops);
            _header.tick();
        }
    }

    /* Delegação única: dia do heatmap (detalhe) + acordeão de meses */
    function bindBody(body) {
        if (!body || _bodyBound) return;
        _bodyBound = true;

        body.addEventListener('click', function (e) {
            /* Dia do heatmap → modal de detalhe do dia */
            const dayEl = e.target.closest('.dc-heat__cell[data-date]');
            if (dayEl) {
                const date = dayEl.getAttribute('data-date');
                if (date) {
                    const allOps2 = window.cryptoOperacoes || window.allOperacoesCrypto || [];
                    const dayOps = allOps2.filter(op => {
                        const d = getOpDate(op);
                        return d && getDateKey(d) === date;
                    });
                    showDayDetailModal(date, dayOps);
                }
                return;
            }

            /* Cabeçalho do mês → acordeão (abrir fecha o anterior) */
            const head = e.target.closest('.dc-mhead');
            if (!head) return;
            const item = head.closest('.dc-mitem');
            if (!item) return;
            const wasOpen = item.classList.contains('open');
            body.querySelectorAll('.dc-mitem.open').forEach(function (openItem) {
                openItem.classList.remove('open');
                openItem.querySelector('.dc-mbody').classList.remove('open');
                openItem.querySelector('.dc-mhead__chev').classList.remove('open');
            });
            if (wasOpen) return;
            item.classList.add('open');
            item.classList.add('dc-loading');
            item.querySelector('.dc-mbody').classList.add('open');
            item.querySelector('.dc-mhead__chev').classList.add('open');

            const mkey = item.getAttribute('data-mkey');
            const inner = item.querySelector('.dc-mbody__in');
            const allOps = (window.cryptoOperacoes || window.allOperacoesCrypto || []);
            const monthOps = allOps.filter(op => {
                const d = getOpDate(op);
                return d && (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) === mkey;
            });
            /* Reaplica os filtros ativos do site ao mês aberto */
            const state = _dcState || { period: _dcPeriod || 'mes' };
            const filtered = (window.CryptoFilterBar && window.CryptoFilterBar.filter)
                ? window.CryptoFilterBar.filter(monthOps, Object.assign({}, state, { period: 'all', dateFrom: null, dateTo: null }))
                : filterOps(monthOps,
                    _dcStartDate || new Date(2000, 0, 1),
                    _dcEndDate   || new Date(),
                    _dcTipo, _dcAsset, _dcCorr, _dcStatus);

            if (!filtered.length) {
                inner.innerHTML = '<div class="dc-empty">Nenhuma operação em ' + mkey + ' com os filtros ativos.</div>';
                item.classList.remove('dc-loading');
                return;
            }
            const [yy, mm] = mkey.split('-').map(Number);
            const meta = buildMeta(filtered, yy, mm - 1);
            inner.innerHTML = bentoHtml(meta);
            item.classList.remove('dc-loading');
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Modal de detalhe por dia (heatmap click) — Formato Recibo         */
    /* ------------------------------------------------------------------ */
    function showDayDetailModal(dateKey, dayOps) {
        const existing = document.getElementById('dcDayDetailModal');
        if (existing) existing.remove();

        const [year, month, day] = dateKey.split('-');
        const dateObj = new Date(`${year}-${month}-${day}T00:00:00`);
        const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const dayName = weekdays[dateObj.getDay()];
        const dateLabel = `${day}/${month}/${year}`;
        const totalResult = dayOps.reduce((acc, op) => acc + cfg.getResultValue(op), 0);

        function getStampText(op) {
            const status = (op.status || '').toUpperCase();
            const exStatus = (op.exercicio_status_exibicao || op.exercicio_status || '').toUpperCase();
            if (status === 'FECHADA' && exStatus === 'SIM') return 'EXERCIDA';
            if (status === 'FECHADA' && exStatus === 'NAO') return 'NÃO EXERCIDA';
            if (status === 'ABERTA') return 'ABERTA';
            return status;
        }

        function getBadgeClass(tipo, status, exStatus) {
            const t = (tipo || '').toUpperCase();
            const s = (status || '').toUpperCase();
            const ex = (exStatus || '').toUpperCase();
            const tipoClass = t === 'PUT' ? 'put' : t === 'CALL' ? 'call' : '';
            const statusClass = s === 'FECHADA' ? 'fechada' : s === 'ABERTA' ? 'aberta' : '';
            const exClass = ex === 'SIM' ? 'exercida' : '';
            return { tipoClass, statusClass, exClass };
        }

        function fmtDateBR(dateStr) {
            if (!dateStr) return '-';
            const d = dateStr.toString().trim().slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
            return d.split('-').reverse().join('/');
        }

        const cardsHtml = dayOps.length
            ? dayOps.map(op => {
                const ativo = cfg.getAtivo(op);
                const tipo = (op.tipo || '-').toUpperCase();
                const status = (op.status || 'ABERTA').toUpperCase();
                const exStatus = (op.exercicio_status_exibicao || op.exercicio_status || '').toUpperCase();
                const stampText = getStampText(op);
                const val = cfg.getResultValue(op);
                const strike = op.strike ? fmtC(op.strike) : '-';
                const cotacao = op.cotacao_atual ? fmtC(op.cotacao_atual) : (op.strike ? fmtC(op.strike) : '-');
                const exercicio = op.exercicio ? fmtDateBR(op.exercicio) : '-';
                const dataOp = op.data_operacao ? fmtDateBR(op.data_operacao) : '-';
                const estrategia = op.tipo_estrategia || 'DUAL_INVESTMENT';
                const corretora = op.corretora || 'BINANCE';
                const badgeCls = getBadgeClass(tipo, status, exStatus);
                const showStamp = status === 'FECHADA';

                return `
                <div class="dc-rc-card">
                    ${showStamp ? `<div class="dc-rc-stamp">${stampText}</div>` : ''}
                    <div class="dc-rc-date">${dataOp}<span>${dayName} · total do dia ${fmtC(totalResult)}</span></div>
                    <div class="dc-rc-asset">
                        <b>${ativo}</b>
                        <span class="dc-badge ${badgeCls.tipoClass}">${tipo}</span>
                        <span class="dc-badge ${badgeCls.statusClass}">${status}</span>
                        ${exStatus === 'SIM' ? `<span class="dc-badge ${badgeCls.exClass}">EXERCIDA</span>` : ''}
                    </div>
                    <div class="dc-rc-row"><span>Entrada</span><span>${dataOp}</span></div>
                    <div class="dc-rc-row"><span>Fechamento</span><span>${exercicio}</span></div>
                    <div class="dc-rc-row"><span>Strike</span><span>${strike}</span></div>
                    <div class="dc-rc-row"><span>Cotação</span><span>${cotacao}</span></div>
                    <div class="dc-rc-row"><span>Estratégia</span><span>${estrategia}</span></div>
                    <div class="dc-rc-row"><span>Corretora</span><span>${corretora}</span></div>
                    <div class="dc-rc-total">
                        <span class="dc-rc-total__lbl">Prêmio recebido</span>
                        <span class="dc-rc-total__val">${val >= 0 ? '+' : ''}${fmtC(val).replace('US$ ', '')}</span>
                    </div>
                </div>`;
            }).join('')
            : '<div class="dc-rc-card" style="text-align:center;padding:40px 20px;color:#7c8aa0;">Nenhuma operação nesta data</div>';

        const html = `
        <div class="modal modal-blur fade" id="dcDayDetailModal" tabindex="-1" style="z-index:1100;">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            📅 Operações de ${dateLabel} (${dayName})
                            <span class="badge ms-2 ${totalResult >= 0 ? 'bg-success' : 'bg-danger'}">${fmtC(totalResult)}</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0" style="max-height: 70vh; overflow-y: auto;">
                        ${cardsHtml}
                    </div>
                    <div class="modal-footer">
                        <span class="text-muted me-auto small">${dayOps.length} operação(ões)</span>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        const modalEl = document.getElementById('dcDayDetailModal');
        modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    /* ------------------------------------------------------------------ */
    /*  Lazy HTML loading                                                   */
    /* ------------------------------------------------------------------ */
    async function ensureModalLoaded() {
        const existing = document.getElementById(cfg.modalElId);
        if (existing) return;

        const container = document.getElementById(cfg.containerElId);
        if (!container) { console.warn('[ModalDashboardCrypto] container não encontrado:', cfg.containerElId); return; }

        try {
            const res  = await fetch('../components/modals/crypto/' + cfg.templatePath + '?v=' + cfg.templateVersion);
            const html = await res.text();
            container.innerHTML = html;
            _bodyBound = false;
        } catch (err) {
            console.error('[ModalDashboardCrypto] Erro ao carregar template:', err);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Montar CryptoModalHeader                                            */
    /* ------------------------------------------------------------------ */
    function _mountHeader() {
        if (_header) { _header.destroy(); _header = null; }
        if (!window.CryptoModalHeader) {
            console.warn('[ModalDashboardCrypto] CryptoModalHeader não disponível');
            return;
        }
        _header = window.CryptoModalHeader.mount('#dcModalHeader', {
            title:         'Dashboard Avançado de Performance · Crypto',
            icon:          '🔥',
            defaultPeriod: 'mes',
            closeModalId:  cfg.modalElId,
            onFilter: function (state) {
                _dcState  = state;
                _dcPeriod = state.period || 'mes';
                resolveRange(state);
                _dcTipo   = state.tipo   || 'ALL';
                _dcAsset  = state.asset  || null;
                _dcCorr   = state.corretora || null;
                _dcStatus = state.status    || null;
                renderAll();
            },
            onRefresh: async function () {
                try {
                    const res = await fetch(cfg.apiEndpoint, { cache: 'no-store' });
                    if (res.ok) {
                        const data = await res.json();
                        window.cryptoOperacoes = Array.isArray(data) ? data : [];
                        window.allOperacoesCrypto = window.cryptoOperacoes;
                    }
                } catch (err) {
                    console.error('[ModalDashboardCrypto] Erro ao atualizar:', err);
                }
                renderAll();
            },
            showTotals: true,
        });
        // Estado inicial: mês corrente, todos os tipos/status (padrão do site)
        _dcState  = window.CryptoFilterBar && window.CryptoFilterBar.createState
            ? window.CryptoFilterBar.createState({ period: 'mes' })
            : { period: 'mes' };
        _dcPeriod = 'mes';
        resolveRange(_dcState);
        _dcTipo   = 'ALL';
        _dcAsset  = null;
        _dcCorr   = null;
        _dcStatus = null;
    }

    /* ------------------------------------------------------------------ */
    /*  Abrir modal                                                         */
    /* ------------------------------------------------------------------ */
    async function openModal() {
        await ensureModalLoaded();

        const modalEl = document.getElementById(cfg.modalElId);
        if (!modalEl) { console.warn('[ModalDashboardCrypto] modal não encontrado'); return; }

        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        _mountHeader();
        renderAll();
    }

    /* ------------------------------------------------------------------ */
    /*  Bindagem do card gatilho                                            */
    /* ------------------------------------------------------------------ */
    function setupTriggers() {
        if (!cfg.triggerCard) return;
        const card = document.getElementById(cfg.triggerCard);
        if (!card) return;
        // Remove listeners anteriores clonando o nó
        const clone = card.cloneNode(true);
        card.parentNode.replaceChild(clone, card);
        clone.addEventListener('click', () => openModal());
    }

    /* ------------------------------------------------------------------ */
    /*  API pública                                                         */
    /* ------------------------------------------------------------------ */
    function configure(opts) {
        Object.assign(cfg, opts);
        // Re-bind trigger após configure
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupTriggers);
        } else {
            setupTriggers();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Init                                                                */
    /* ------------------------------------------------------------------ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupTriggers);
    } else {
        setupTriggers();
    }

    window.ModalDashboardCrypto = { configure, openModal };

})();

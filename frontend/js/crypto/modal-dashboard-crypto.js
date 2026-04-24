/**
 * modal-dashboard-crypto.js  v1.0.0
 * Dashboard Avançado de Performance · Crypto
 * Padrão IIFE + configure(), espelhando opcoes modal-saldo-medio.
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
    let chartComparacao = null;
    let chartPatrimonio = null;
    let loaded          = false;
    let _dcStartDate    = null;
    let _dcEndDate      = null;
    let _header         = null;
    let _dcTipo         = 'ALL';
    let _dcAsset        = null;
    let _dcCorr         = null;
    let _dcStatus       = null;

    /* Mapeamento de período cfb-bar → applyPeriodo() */
    const _PERIOD_MAP = {
        'all':   '_all',
        'today': 'today',
        '7d':    '7',
        'mes':   'month',
        '30d':   '30',
        '60d':   '60',
        '90d':   '90',
        'ano':   'year',
    };

    /* ------------------------------------------------------------------ */
    /*  Utilitários                                                         */
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
        const raw = op.exercicio || op.data_operacao || op.created_at || null;
        if (!raw) return null;
        return parseDateLocal(raw.toString().trim().slice(0, 10));
    }

    function getDateKey(date) {
        return date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0');
    }

    function computeDailyResults(ops) {
        const map = new Map();
        ops.forEach(op => {
            const d = getOpDate(op);
            if (!d) return;
            const key  = getDateKey(d);
            const val  = cfg.getResultValue(op);
            map.set(key, (map.get(key) || 0) + val);
        });
        return map;
    }

    function computeDailyHeatmapMetrics(ops) {
        const map = new Map();
        ops.forEach(op => {
            const d = getOpDate(op);
            if (!d) return;
            const key = getDateKey(d);
            const premium = cfg.getResultValue(op);
            if (!map.has(key)) map.set(key, { premium: 0, ops: 0 });
            const dayMetrics = map.get(key);
            dayMetrics.premium += premium;
            dayMetrics.ops += 1;
        });
        return map;
    }

    function getHeatmapClass(value, maxPos, maxNeg) {
        if (!value) return 'heatmap-neutral';
        if (value > 0) {
            const r = maxPos > 0 ? value / maxPos : 0;
            if (r >= 0.66) return 'heatmap-profit-high';
            if (r >= 0.33) return 'heatmap-profit-med';
            return 'heatmap-profit-low';
        }
        const r = maxNeg > 0 ? Math.abs(value) / maxNeg : 0;
        if (r >= 0.66) return 'heatmap-loss-high';
        if (r >= 0.33) return 'heatmap-loss-med';
        return 'heatmap-loss-low';
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

    function computeStats(ops, prevOps) {
        function statsFrom(arr) {
            const total    = arr.length;
            const results  = arr.map(o => cfg.getResultValue(o));
            const sum      = results.reduce((a, b) => a + b, 0);
            const wins     = results.filter(v => v > 0).length;
            const losses   = results.filter(v => v < 0).length;
            const winRate  = total > 0 ? (wins / total) * 100 : 0;
            const sumPos   = results.filter(v => v > 0).reduce((a, b) => a + b, 0);
            const sumNeg   = results.filter(v => v < 0).reduce((a, b) => a + b, 0);
            return { totalOps: total, totalResultado: sum, wins, losses, winRate, sumPos, sumNeg };
        }
        return {
            current  : statsFrom(ops),
            previous : statsFrom(prevOps),
        };
    }

    /* ------------------------------------------------------------------ */
    /*  Aplicar período (seletor)                                           */
    /* ------------------------------------------------------------------ */
    function applyPeriodo(value) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let start, end = new Date(today);

        if (value === '7')        { start = new Date(today); start.setDate(today.getDate() - 6); }
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

    /* ------------------------------------------------------------------ */
    /*  Render: Métricas KPI                                                */
    /* ------------------------------------------------------------------ */
    function renderMetrics(stats) {
        const saldoEl   = document.getElementById('dcMetricSaldo');
        const resultEl  = document.getElementById('dcMetricResultado');
        const wrEl      = document.getElementById('dcMetricWinRate');
        const wlEl      = document.getElementById('dcMetricWinLoss');
        const opsEl     = document.getElementById('dcMetricOps');

        if (saldoEl)  saldoEl .textContent = fmtC(cfg.getSaldo());
        if (resultEl) resultEl.textContent = fmtC(stats.totalResultado);
        if (wrEl)     wrEl    .textContent = stats.winRate.toFixed(1) + '%';
        if (wlEl)     wlEl    .textContent = stats.wins + 'W / ' + stats.losses + 'L';
        if (opsEl)    opsEl   .textContent = String(stats.totalOps);
    }

    /* ------------------------------------------------------------------ */
    /*  Render: Heatmap                                                     */
    /* ------------------------------------------------------------------ */
    function renderHeatmap(ops, startDate, endDate) {
        const container = document.getElementById('dcHeatmap');
        if (!container) return;

        const dailyMap = computeDailyResults(ops);
        const dailyMetrics = computeDailyHeatmapMetrics(ops);
        let maxPos = 0, maxNeg = 0;
        dailyMap.forEach(v => {
            if (v > maxPos) maxPos = v;
            if (v < 0) maxNeg = Math.min(maxNeg, v);
        });
        maxNeg = Math.abs(maxNeg);

        const monthNames    = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const weekdayLabels = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];

        const monthsWithOps = new Set();
        ops.forEach(op => {
            const d = getOpDate(op);
            if (!d) return;
            monthsWithOps.add(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
        });

        const html = ['<div class="accordion" id="dcHeatmapAccordion">'];
        let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (current <= endMonth) {
            const year   = current.getFullYear();
            const month  = current.getMonth();
            const days   = new Date(year, month + 1, 0).getDate();
            const mKey   = year + '-' + String(month + 1).padStart(2, '0');

            if (!monthsWithOps.has(mKey)) {
                current = new Date(year, month + 1, 1);
                continue;
            }

            const accId = 'dc-hm-' + mKey;
            html.push(`
                <div class="accordion-item">
                    <h2 class="accordion-header" id="hd-${accId}">
                        <button class="accordion-button collapsed" type="button"
                            data-bs-toggle="collapse" data-bs-target="#cl-${accId}"
                            aria-expanded="false" aria-controls="cl-${accId}">
                            ${monthNames[month]} ${year}
                        </button>
                    </h2>
                    <div id="cl-${accId}" class="accordion-collapse collapse"
                        aria-labelledby="hd-${accId}" data-bs-parent="#dcHeatmapAccordion">
                        <div class="accordion-body">
                            <div class="heatmap-month">
                                <div class="heatmap-weekdays">
                                    ${weekdayLabels.map(l => `<span class="heatmap-weekday">${l}</span>`).join('')}
                                </div>
                                <div class="heatmap-grid">
            `);

            const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
            for (let i = 0; i < firstWeekday; i++) {
                html.push('<span class="heatmap-day heatmap-empty" aria-hidden="true"></span>');
            }

            for (let day = 1; day <= days; day++) {
                const date    = new Date(year, month, day);
                const inRange = date >= startDate && date <= endDate;
                const dayLabel = String(day).padStart(2, '0');

                if (!inRange) {
                    html.push(`
                        <span class="heatmap-day heatmap-neutral heatmap-out-range">
                            <span class="hm-top">Dia</span>
                            <span class="hm-daynum">${dayLabel}</span>
                            <span class="hm-meta">Ops: -</span>
                            <span class="hm-prem">Prêmios: -</span>
                        </span>
                    `);
                    continue;
                }

                const key    = getDateKey(date);
                const value  = dailyMap.get(key) || 0;
                const dayData = dailyMetrics.get(key) || { premium: 0, ops: 0 };
                const cls    = getHeatmapClass(value, maxPos, maxNeg);
                const tip    = dayLabel + '/' + String(month + 1).padStart(2, '0')
                    + ' · Ops: ' + dayData.ops + ' · ' + fmtC(dayData.premium);
                html.push(`
                    <span class="heatmap-day ${cls}" data-date="${key}" title="${tip}">
                        <span class="hm-top">Dia</span>
                        <span class="hm-daynum">${dayLabel}</span>
                        <span class="hm-meta">Ops: ${dayData.ops}</span>
                        <span class="hm-prem">Prêmios: ${fmtC(dayData.premium)}</span>
                    </span>
                `);
            }

            const totalCells = firstWeekday + days;
            const trailing = (7 - (totalCells % 7)) % 7;
            for (let i = 0; i < trailing; i++) {
                html.push('<span class="heatmap-day heatmap-empty" aria-hidden="true"></span>');
            }

            html.push(`
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `);

            current = new Date(year, month + 1, 1);
        }
        html.push('</div>');
        container.innerHTML = html.join('');

        // Delegated click: clique em dia do heatmap → exibe operações daquele dia.
        // O bind é feito uma única vez para evitar múltiplos handlers ao re-renderizar.
        if (!container.dataset.dayClickBound) {
            container.addEventListener('click', function (e) {
                const dayEl = e.target.closest('.heatmap-day[data-date]');
                if (!dayEl) return;
                const date = dayEl.getAttribute('data-date');
                if (!date) return;
                // Inclui ops fechadas nesta data (por data de exercício/fechamento)
                // e ops abertas com data_operacao nesta data.
                const allOps2 = window.cryptoOperacoes || window.allOperacoesCrypto || [];
                const dayOps = allOps2.filter(op => {
                    const d = getOpDate(op);
                    return d && getDateKey(d) === date;
                });
                showDayDetailModal(date, dayOps);
            });
            container.dataset.dayClickBound = '1';
        }
    }
    /* ------------------------------------------------------------------ */
    /*  Modal de detalhe por dia (heatmap click)                            */
    /* ------------------------------------------------------------------ */
    function showDayDetailModal(dateKey, dayOps) {
        const existing = document.getElementById('dcDayDetailModal');
        if (existing) existing.remove();

        const [year, month, day] = dateKey.split('-');
        const dateLabel = `${day}/${month}/${year}`;
        const totalResult = dayOps.reduce((acc, op) => acc + cfg.getResultValue(op), 0);

        const rows = dayOps.length
            ? dayOps.map(op => {
                const ativo  = cfg.getAtivo(op);
                const tipo   = (op.tipo || '-').toUpperCase();
                const status = (op.status || 'ABERTA').toUpperCase();
                const val    = cfg.getResultValue(op);
                const strike = op.strike ? fmtC(op.strike) : '-';
                const exercicio = op.exercicio || '-';
                const pct    = parseFloat(op.resultado) || 0;
                return `<tr>
                    <td><strong>${ativo}</strong></td>
                    <td><span class="badge ${tipo === 'CALL' ? 'bg-success' : 'bg-danger'}">${tipo}</span></td>
                    <td>${strike}</td>
                    <td>${exercicio}</td>
                    <td class="${val >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtC(val)}</td>
                    <td class="${pct >= 0 ? 'text-success' : 'text-danger'}">${pct ? pct.toFixed(2) + '%' : '-'}</td>
                    <td><span class="badge ${status === 'ABERTA' ? 'bg-success' : 'bg-secondary'}">${status}</span></td>
                </tr>`;
            }).join('')
            : '<tr><td colspan="7" class="text-center text-muted py-3">Nenhuma operação nesta data</td></tr>';

        const html = `
        <div class="modal modal-blur fade" id="dcDayDetailModal" tabindex="-1" style="z-index:1100;">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            📅 Operações de ${dateLabel}
                            <span class="badge ms-2 ${totalResult >= 0 ? 'bg-success' : 'bg-danger'}">${fmtC(totalResult)}</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="table-responsive">
                            <table class="table table-vcenter table-hover card-table mb-0">
                                <thead>
                                    <tr>
                                        <th>Ativo</th>
                                        <th>Tipo</th>
                                        <th>Strike</th>
                                        <th>Exercício</th>
                                        <th>Prêmio (USD)</th>
                                        <th>Resultado %</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
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
    /*  Render: Evolução do Patrimônio Acumulado                           */
    /* ------------------------------------------------------------------ */
    function renderPatrimonio(ops) {
        const canvas = document.getElementById('dcPatrimonioChart');
        if (!canvas || typeof Chart === 'undefined') return;
        if (chartPatrimonio) { chartPatrimonio.destroy(); chartPatrimonio = null; }

        const sorted = [...ops]
            .filter(op => getOpDate(op))
            .sort((a, b) => getOpDate(a) - getOpDate(b));

        const labels = [];
        const data   = [];
        let acc      = 0;
        sorted.forEach(op => {
            const d = getOpDate(op);
            if (!d) return;
            acc += cfg.getResultValue(op);
            labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            data.push(parseFloat(acc.toFixed(2)));
        });

        if (!labels.length) return;

        chartPatrimonio = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Patrimônio Acumulado',
                    data,
                    borderColor: '#f6c23e',
                    backgroundColor: 'rgba(246,194,62,0.15)',
                    tension: 0.3,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => fmtC(ctx.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 14 },
                        grid: { color: 'rgba(148,163,184,0.12)' }
                    },
                    y: {
                        ticks: { color: '#94a3b8', callback: v => fmtC(v) },
                        grid: { color: 'rgba(148,163,184,0.12)' }
                    }
                }
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Render: CALL vs PUT                                                 */
    /* ------------------------------------------------------------------ */
    function renderComparacao(ops) {
        const canvas = document.getElementById('dcChartComparacao');
        if (!canvas || typeof Chart === 'undefined') return;
        if (chartComparacao) { chartComparacao.destroy(); chartComparacao = null; }

        const callOps = ops.filter(o => (o.tipo || '') === 'CALL');
        const putOps  = ops.filter(o => (o.tipo || '') === 'PUT');
        const sum     = arr => arr.map(o => cfg.getResultValue(o)).reduce((a, b) => a + b, 0);
        const wr      = arr => arr.length > 0
            ? (arr.filter(o => cfg.getResultValue(o) > 0).length / arr.length) * 100
            : 0;

        chartComparacao = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Resultado (USD)', 'Win Rate (%)', 'Operações'],
                datasets: [
                    {
                        label: 'CALL',
                        data: [sum(callOps), wr(callOps), callOps.length],
                        backgroundColor: 'rgba(47,179,68,0.75)',
                    },
                    {
                        label: 'PUT',
                        data: [sum(putOps), wr(putOps), putOps.length],
                        backgroundColor: 'rgba(214,57,57,0.75)',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: true } },
            },
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Render: Weekday Performance                                         */
    /* ------------------------------------------------------------------ */
    function renderWeekday(ops) {
        const container = document.getElementById('dcWeekdayList');
        if (!container) return;
        const labels  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        const totals  = new Array(7).fill(0);
        const dailyMap = computeDailyResults(ops);

        dailyMap.forEach((value, key) => {
            const d = new Date(key + 'T00:00:00');
            if (!isNaN(d.getTime())) totals[d.getDay()] += value;
        });

        const maxAbs = Math.max(...totals.map(v => Math.abs(v)), 1);
        let bestIdx = -1, bestVal = -Infinity;
        totals.forEach((v, i) => { if (v > bestVal) { bestVal = v; bestIdx = i; } });

        container.innerHTML = '';
        totals.forEach((value, idx) => {
            const item = document.createElement('div');
            item.className = 'saldo-weekday-item';

            const lbl = document.createElement('div');
            lbl.className = 'saldo-weekday-label';
            lbl.textContent = labels[idx];

            const bar = document.createElement('div');
            bar.className = 'saldo-weekday-bar';
            const fill = document.createElement('span');
            fill.style.width = Math.min(100, Math.abs(value) / maxAbs * 100) + '%';
            fill.style.background = value >= 0 ? '#2fb344' : '#d63939';
            bar.appendChild(fill);

            const val = document.createElement('div');
            val.className = 'saldo-weekday-value' + (value < 0 ? ' text-danger' : value > 0 ? ' text-success' : '');
            val.textContent = fmtC(value);

            item.append(lbl, bar, val);
            container.appendChild(item);
        });

        const bestDayEl = document.getElementById('dcBestDay');
        if (bestDayEl) bestDayEl.textContent = bestIdx >= 0 ? labels[bestIdx] : '-';
    }

    /* ------------------------------------------------------------------ */
    /*  Render: Top Ativos                                                  */
    /* ------------------------------------------------------------------ */
    function renderTopAtivos(ops) {
        const tbody = document.getElementById('dcTopAtivosBody');
        if (!tbody) return;
        const map = new Map();
        ops.forEach(op => {
            const ativo = cfg.getAtivo(op);
            if (!map.has(ativo)) map.set(ativo, { ativo, total: 0, wins: 0, count: 0 });
            const e = map.get(ativo);
            const v = cfg.getResultValue(op);
            e.total += v;
            e.count += 1;
            if (v > 0) e.wins += 1;
        });
        const items = [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">Sem dados no período</td></tr>';
            return;
        }
        tbody.innerHTML = items.map((it, i) => {
            const wr   = it.count > 0 ? (it.wins / it.count) * 100 : 0;
            const tick = it.count > 0 ? it.total / it.count : 0;
            return `<tr>
                <td>#${i + 1}</td>
                <td class="fw-bold">${it.ativo}</td>
                <td>${it.count}</td>
                <td>${wr.toFixed(1)}%</td>
                <td class="${it.total >= 0 ? 'text-success' : 'text-danger'}">${fmtC(it.total)}</td>
                <td>${fmtC(tick)}</td>
            </tr>`;
        }).join('');
    }

    /* ------------------------------------------------------------------ */
    /*  Render: Consistência                                                */
    /* ------------------------------------------------------------------ */
    function renderConsistencia(ops) {
        const dailyMap   = computeDailyResults(ops);
        const values     = [...dailyMap.values()];
        const positiveDays = values.filter(v => v > 0).length;
        const negativeDays = values.filter(v => v < 0).length;
        const total        = positiveDays + negativeDays;
        const posPct = total > 0 ? (positiveDays / total) * 100 : 0;
        const negPct = total > 0 ? (negativeDays / total) * 100 : 0;
        const stabPct = Math.max(0, 100 - negPct);

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const setW = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; };

        set  ('dcConsPositiveValue', posPct .toFixed(0) + '%');
        setW ('dcConsPositiveBar',   posPct);
        set  ('dcConsNegativeValue', negPct .toFixed(0) + '%');
        setW ('dcConsNegativeBar',   negPct);
        set  ('dcConsStabilityValue',stabPct.toFixed(0) + '%');
        setW ('dcConsStabilityBar',  stabPct);
    }

    /* ------------------------------------------------------------------ */
    /*  Render: Probabilidades                                              */
    /* ------------------------------------------------------------------ */
    function renderProbabilidades(ops, stats) {
        const callOps = ops.filter(o => (o.tipo || '') === 'CALL');
        const putOps  = ops.filter(o => (o.tipo || '') === 'PUT');
        const callWins = callOps.filter(o => cfg.getResultValue(o) > 0).length;
        const putWins  = putOps .filter(o => cfg.getResultValue(o) > 0).length;
        const callRate = callOps.length > 0 ? (callWins / callOps.length) * 100 : 0;
        const putRate  = putOps .length > 0 ? (putWins  / putOps .length) * 100 : 0;
        const expectancy = stats.totalOps > 0 ? stats.totalResultado / stats.totalOps : 0;
        const roi        = cfg.getSaldo() > 0 ? (stats.totalResultado / cfg.getSaldo()) * 100 : 0;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('dcProbCall',    callRate.toFixed(0) + '%');
        set('dcProbPut',     putRate.toFixed(0) + '%');
        set('dcExpectativa', fmtC(expectancy));

        const roiEl = document.getElementById('dcRoi');
        if (roiEl) {
            roiEl.textContent = roi.toFixed(1) + '%';
            roiEl.className   = 'h2 mb-0 ' + (roi >= 0 ? 'text-success' : 'text-danger');
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Orquestrador principal                                              */
    /* ------------------------------------------------------------------ */
    function renderAll() {
        const startDate = _dcStartDate || new Date(new Date().getFullYear(), 0, 1);
        const endDate   = _dcEndDate   || new Date();

        const tipo      = _dcTipo   || 'ALL';
        const asset     = _dcAsset  || null;
        const corretora = _dcCorr   || null;
        const status    = _dcStatus || null;

        const allOps  = (window.cryptoOperacoes || window.allOperacoesCrypto || []);
        const ops     = filterOps(allOps, startDate, endDate, tipo, asset, corretora, status);

        const diffMs    = endDate - startDate;
        const prevEnd   = new Date(startDate.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - diffMs);
        const prevOps   = filterOps(allOps, prevStart, prevEnd, tipo, asset, corretora);

        const { current: stats } = computeStats(ops, prevOps);

        renderMetrics(stats);
        renderHeatmap(ops, startDate, endDate);
        renderPatrimonio(ops);
        renderComparacao(ops);
        renderWeekday(ops);
        renderTopAtivos(ops);
        renderConsistencia(ops);
        renderProbabilidades(ops, stats);

        if (_header) {
            _header.setOps(allOps, ops);
            _header.tick();
        }
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
            const res  = await fetch('../components/modals/crypto/' + cfg.templatePath + '?v=1.0.0');
            const html = await res.text();
            container.innerHTML = html;
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
            defaultPeriod: 'today',
            closeModalId:  cfg.modalElId,
            onFilter: function (state) {
                const pv = _PERIOD_MAP[state.period] || 'today';
                if (pv === '_all') {
                    _dcStartDate = new Date(2000, 0, 1);
                    _dcEndDate   = new Date();
                } else {
                    applyPeriodo(pv);
                }
                _dcTipo   = state.tipo   || 'ALL';
                _dcAsset  = state.asset  || null;
                _dcCorr   = state.corretora || null;
                _dcStatus = state.status    || null;
                renderAll();
            },
            onRefresh: async function () {
                try {
                    const res = await fetch(cfg.apiEndpoint);
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
        // Estado inicial: hoje, todos os tipos
        applyPeriodo('today');
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

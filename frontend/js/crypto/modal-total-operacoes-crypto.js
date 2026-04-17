/** modal-total-operacoes-crypto.js v1.0.0 */
(function () {
    'use strict';

    let currentOps = [];
    let activePeriod = 'today';
    let activeFilter = null;
    let activeTipo = null;
    let activeAsset = null;
    let activeCorr = null;
    let _header = null;

    function fmtUsd(v) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
    }

    function fmtPct(v) {
        return `${(v || 0).toFixed(2)}%`;
    }

    function getNumber(op, fields) {
        for (let i = 0; i < fields.length; i++) {
            const val = parseFloat(op[fields[i]]);
            if (!Number.isNaN(val)) return val;
        }
        return 0;
    }

    function getOpDate(op) {
        const raw = op.data_operacao || op.created_at || op.data || op.exercicio || null;
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function formatDate(d) {
        if (!d) return '-';
        return d.toLocaleDateString('pt-BR');
    }

    function getPremio(op) {
        return getNumber(op, ['premio_us', 'premio', 'resultado_us', 'resultado']);
    }

    function getResultadoPct(op) {
        return getNumber(op, ['resultado', 'resultado_pct', 'roi']);
    }

    function applyFilter(ops, filter) {
        if (!filter || filter === 'all') return ops;
        // Status filters — usa isActuallyExercised para consistência global
        if (filter === 'ABERTA' || filter === 'FECHADA' || filter === 'VENCIDA') {
            return ops.filter(op => (op.status || 'ABERTA').toUpperCase() === filter);
        }
        if (filter === 'exercida') {
            return ops.filter(op => window.CryptoExerciseStatus
                ? window.CryptoExerciseStatus.isActuallyExercised(op)
                : ((op.status || '').toUpperCase() === 'FECHADA' && (op.exercicio_status || '').toUpperCase() === 'SIM'));
        }
        if (filter === 'nao_exercida') {
            return ops.filter(op => {
                const s = (op.status || '').toUpperCase();
                if (s === 'ABERTA') return false;
                return window.CryptoExerciseStatus
                    ? !window.CryptoExerciseStatus.isActuallyExercised(op)
                    : (op.exercicio_status || '').toUpperCase() !== 'SIM';
            });
        }
        if (filter === 'CALL' || filter === 'PUT') {
            return ops.filter(op => (op.tipo || '').toUpperCase() === filter);
        }
        return ops;
    }

    function applyFilterFull(ops, state) {
        if (window.CryptoFilterBar?.filter) {
            return window.CryptoFilterBar.filter(ops, {
                period: state.period || 'today',
                status: state.status || null,
                tipo: state.tipo || null,
                asset: state.asset || null,
                corretora: state.corretora || null,
            });
        }
        let result = applyFilter(ops, state.status);
        if (state.tipo) {
            result = result.filter(op => (op.tipo || '').toUpperCase() === state.tipo.toUpperCase());
        }
        if (state.asset) {
            const asset = state.asset.toUpperCase();
            result = result.filter(op => String(op.ativo || '').toUpperCase().includes(asset));
        }
        if (state.corretora) {
            result = result.filter(op => (op.corretora || 'BINANCE').toUpperCase() === state.corretora);
        }
        return result;
    }

    function calcStats(ops) {
        const totalOps = ops.length;
        const totalPremio = ops.reduce((acc, op) => acc + getPremio(op), 0);
        const wins = ops.filter(op => getPremio(op) > 0).length;
        const losses = ops.filter(op => getPremio(op) < 0).length;
        const winRate = totalOps > 0 ? (wins / totalOps) * 100 : 0;
        const abertas = ops.filter(op => (op.status || 'ABERTA').toUpperCase() === 'ABERTA').length;
        const fechadas = ops.filter(op => (op.status || '').toUpperCase() !== 'ABERTA').length;
        return { totalOps, totalPremio, wins, losses, winRate, abertas, fechadas };
    }

    function groupByMonth(ops) {
        const map = new Map();
        ops.forEach(op => {
            const d = getOpDate(op);
            if (!d) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!map.has(key)) {
                map.set(key, { key, date: new Date(d.getFullYear(), d.getMonth(), 1), premio: 0, saldoSum: 0, saldoCount: 0 });
            }
            const row = map.get(key);
            row.premio += getPremio(op);
            const saldo = getNumber(op, ['abertura', 'saldo_abertura', 'saldo', 'investimento']);
            if (saldo > 0) {
                row.saldoSum += saldo;
                row.saldoCount += 1;
            }
        });
        const rows = Array.from(map.values()).sort((a, b) => a.date - b.date);
        rows.forEach(r => {
            r.saldoMedio = r.saldoCount > 0 ? (r.saldoSum / r.saldoCount) : 0;
            r.roi = r.saldoMedio ? (r.premio / r.saldoMedio) * 100 : 0;
        });
        return rows;
    }

    function renderMonthly(rows) {
        const tbody = document.getElementById('tocMonthlyTbody');
        if (!tbody) return;
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Sem dados</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(r => {
            const mes = r.date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
            return `<tr>
                <td>${mes}</td>
                <td>${r.saldoMedio ? fmtUsd(r.saldoMedio) : '-'}</td>
                <td class="${r.premio >= 0 ? 'text-success' : 'text-danger'}">${fmtUsd(r.premio)}</td>
                <td>${r.saldoMedio ? fmtPct(r.roi) : '-'}</td>
                <td>${r.saldoMedio ? fmtPct(r.roi) : '-'}</td>
            </tr>`;
        }).join('');
    }

    function renderTimeline(rows) {
        const container = document.getElementById('tocTimeline');
        if (!container) return;
        if (!rows.length) {
            container.innerHTML = '<div class="toc-timeline-item"><span class="toc-timeline-dot"></span><div class="fw-bold">Sem dados</div><div class="text-muted" style="font-size:.75rem;">Nenhum mês disponível</div></div>';
            return;
        }
        container.innerHTML = rows.map(r => {
            const mes = r.date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const roi = r.saldoMedio ? fmtPct(r.roi) : 'ROI N/A';
            const cls = r.premio < 0 ? 'toc-timeline-item toc-timeline-neg' : 'toc-timeline-item';
            return `<div class="${cls}">
                <span class="toc-timeline-dot"></span>
                <div class="fw-bold">${mes}</div>
                <div class="text-muted" style="font-size:.75rem;">${fmtUsd(r.premio)} · ${roi}</div>
            </div>`;
        }).join('');
    }

    function renderOpsTable(ops) {
        const tbody = document.getElementById('tocOpsTbody');
        if (!tbody) return;
        if (!ops.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Sem dados</td></tr>';
            return;
        }
        const sorted = [...ops].sort((a, b) => {
            const da = getOpDate(a) || new Date(0);
            const db = getOpDate(b) || new Date(0);
            return da - db;
        });
        let acumulado = 0;
        tbody.innerHTML = sorted.map(op => {
            const d = getOpDate(op);
            const premio = getPremio(op);
            acumulado += premio;
            const resultadoPct = getResultadoPct(op);
            const ativo = op.ativo || op.codigo || '-';
            const tipo = (op.tipo || '-').toUpperCase();
            const status = (op.status || 'ABERTA').toUpperCase();
            const pctCls = resultadoPct >= 0 ? 'text-success' : 'text-danger';
            return `<tr>
                <td>${formatDate(d)}</td>
                <td>${ativo}</td>
                <td>${tipo}</td>
                <td>${status}</td>
                <td class="${premio >= 0 ? 'text-success' : 'text-danger'}">${fmtUsd(premio)}</td>
                <td class="${pctCls}">${resultadoPct ? fmtPct(resultadoPct) : '-'}</td>
                <td class="${acumulado >= 0 ? 'text-success' : 'text-danger'}">${fmtUsd(acumulado)}</td>
            </tr>`;
        }).join('');
    }

    function renderMeta(stats, monthlyRows) {
        const config = JSON.parse(localStorage.getItem('cryptoConfig') || localStorage.getItem('appConfig') || '{}');
        const metaMensal = parseFloat(config.metaCrypto || config.metaMensal || 500);
        const metaAnual = metaMensal * 12;
        const faltam = Math.max(0, metaAnual - stats.totalPremio);

        const metaAnualEl = document.getElementById('tocMetaAnual');
        const metaFaltamEl = document.getElementById('tocMetaFaltam');
        if (metaAnualEl) metaAnualEl.textContent = fmtUsd(metaAnual);
        if (metaFaltamEl) metaFaltamEl.textContent = `Faltam ${fmtUsd(faltam)}`;

        const monthsWithData = monthlyRows.length || 1;
        const avgMonthly = stats.totalPremio / monthsWithData;
        const projected = avgMonthly * 12;
        const projectedEl = document.getElementById('tocMetaProjetada');
        const projectedInfo = document.getElementById('tocMetaProjetadaInfo');
        if (projectedEl) projectedEl.textContent = fmtUsd(projected);
        if (projectedInfo) projectedInfo.textContent = `Média mensal ${fmtUsd(avgMonthly)}`;
    }

    function renderSummary(stats, monthlyRows) {
        const totalResultadoEl = document.getElementById('tocTotalResultado');
        const pillAbertas = document.getElementById('tocPillAbertas');
        const pillFechadas = document.getElementById('tocPillFechadas');
        const pillOps = document.getElementById('tocPillOps');
        const pillRoi = document.getElementById('tocPillRoi');

        if (totalResultadoEl) totalResultadoEl.textContent = fmtUsd(stats.totalPremio);
        if (pillAbertas) pillAbertas.textContent = String(stats.abertas);
        if (pillFechadas) pillFechadas.textContent = String(stats.fechadas);
        if (pillOps) pillOps.textContent = String(stats.totalOps);

        const totalSaldo = monthlyRows.reduce((acc, r) => acc + (r.saldoMedio || 0), 0);
        const roi = totalSaldo > 0 ? (stats.totalPremio / totalSaldo) * 100 : 0;
        if (pillRoi) pillRoi.textContent = fmtPct(roi);

        const cardResultado = document.getElementById('tocCardResultado');
        const cardAcumulado = document.getElementById('tocCardAcumulado');
        const cardOps = document.getElementById('tocCardOps');
        const cardWinRate = document.getElementById('tocCardWinRate');
        if (cardResultado) cardResultado.textContent = fmtUsd(stats.totalPremio);
        if (cardAcumulado) cardAcumulado.textContent = fmtUsd(stats.totalPremio);
        if (cardOps) cardOps.textContent = `${stats.totalOps}`;
        if (cardWinRate) cardWinRate.textContent = fmtPct(stats.winRate);
    }

    function renderAll(ops) {
        const stats = calcStats(ops);
        const monthlyRows = groupByMonth(ops);
        renderSummary(stats, monthlyRows);
        renderMonthly(monthlyRows);
        renderTimeline(monthlyRows);
        renderOpsTable(ops);
        renderMeta(stats, monthlyRows);
    }

    function loadData() {
        fetch('/api/crypto', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                currentOps = Array.isArray(data) ? data : [];
                const filtered = applyFilterFull(currentOps, {
                    period: activePeriod,
                    status: activeFilter,
                    tipo: activeTipo,
                    asset: activeAsset,
                    corretora: activeCorr,
                });
                renderAll(filtered);
                if (_header) _header.setOps(currentOps, filtered);
            })
            .catch(() => renderAll([]));
    }

    function _mountHeader() {
        if (!window.CryptoModalHeader) return;
        if (_header) { _header.destroy(); _header = null; }
        _header = window.CryptoModalHeader.mount('#tocModalHeader', {
            title:         'Total de Operações Crypto',
            icon:          '📊',
            defaultPeriod: 'today',
            closeModalId:  'modalTotalOperacoesCrypto',
            onFilter: function (state) {
                activePeriod = state.period || 'today';
                activeFilter = state.status  || null;
                activeTipo   = state.tipo    || null;
                activeAsset  = state.asset   || null;
                activeCorr   = state.corretora || null;
                const filtered = applyFilterFull(currentOps, {
                    period: activePeriod,
                    status: activeFilter,
                    tipo: activeTipo,
                    asset: activeAsset,
                    corretora: activeCorr,
                });
                renderAll(filtered);
                if (_header) _header.setOps(currentOps, filtered);
            },
            onRefresh: loadData,
            showTotals: true,
        });
    }

    function ensureModalHtml() {
        const modalEl = document.getElementById('modalTotalOperacoesCrypto');
        if (modalEl) return Promise.resolve(modalEl);
        const container = document.getElementById('modalTotalOperacoesCryptoContainer');
        if (!container) return Promise.reject(new Error('container-missing'));
        return fetch('modal-total-operacoes-crypto.html', { cache: 'no-store' })
            .then(r => r.text())
            .then(html => {
                container.innerHTML = html;
                return document.getElementById('modalTotalOperacoesCrypto');
            });
    }

    function openModal() {
        if (typeof bootstrap === 'undefined') return;
        ensureModalHtml()
            .then(modalEl => {
                if (!modalEl) return;
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.show();
                _mountHeader();
                loadData();
            })
            .catch(() => {});
    }

    window.ModalTotalOperacoesCrypto = { openModal };

    function initTriggers() {
        const card = document.getElementById('cardTotalOpsCryptoCard');
        if (card) {
            card.addEventListener('click', openModal);
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTriggers);
    } else {
        initTriggers();
    }
}());

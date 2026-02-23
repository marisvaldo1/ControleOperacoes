(function () {
    'use strict';

    let currentOps = [];
    let activeFilter = 'all';

    function fmtCurrency(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
    }

    function fmtPct(v) {
        return `${(v || 0).toFixed(1)}%`;
    }

    function getNumber(op, fields) {
        for (let i = 0; i < fields.length; i += 1) {
            const val = parseFloat(op[fields[i]]);
            if (!Number.isNaN(val)) return val;
        }
        return 0;
    }

    function getOpDate(op) {
        const raw = op.data_operacao || op.created_at || op.data || op.vencimento || null;
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function formatDate(d) {
        if (!d) return '-';
        return d.toLocaleDateString('pt-BR');
    }

    function applyFilter(ops, filter) {
        if (filter === 'all') return ops;
        if (filter === 'ABERTA' || filter === 'FECHADA' || filter === 'VENCIDA') {
            return ops.filter(op => (op.status || '').toUpperCase() === filter);
        }
        if (filter === 'CALL' || filter === 'PUT') {
            return ops.filter(op => (op.tipo || '').toUpperCase() === filter);
        }
        return ops;
    }

    function calcStats(ops) {
        const totalOps = ops.length;
        const totalResultado = ops.reduce((acc, op) => acc + getNumber(op, ['resultado', 'resultado_total', 'resultado_op', 'resultado_fechamento']), 0);
        const wins = ops.filter(op => getNumber(op, ['resultado', 'resultado_total', 'resultado_op', 'resultado_fechamento']) > 0).length;
        const losses = ops.filter(op => getNumber(op, ['resultado', 'resultado_total', 'resultado_op', 'resultado_fechamento']) < 0).length;
        const winRate = totalOps > 0 ? (wins / totalOps) * 100 : 0;
        const abertas = ops.filter(op => (op.status || '').toUpperCase() === 'ABERTA').length;
        const fechadas = ops.filter(op => (op.status || '').toUpperCase() === 'FECHADA').length;
        return { totalOps, totalResultado, wins, losses, winRate, abertas, fechadas };
    }

    function groupByMonth(ops) {
        const map = new Map();
        ops.forEach(op => {
            const d = getOpDate(op);
            if (!d) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!map.has(key)) {
                map.set(key, { key, date: new Date(d.getFullYear(), d.getMonth(), 1), resultado: 0, saldoSum: 0, saldoCount: 0, irpf: 0 });
            }
            const row = map.get(key);
            const resultado = getNumber(op, ['resultado', 'resultado_total', 'resultado_op', 'resultado_fechamento']);
            const saldo = getNumber(op, ['saldo', 'saldo_abertura', 'saldo_entrada', 'saldo_inicial']);
            const irpf = getNumber(op, ['irpf', 'imposto', 'taxa', 'tributo']);
            row.resultado += resultado;
            if (saldo) {
                row.saldoSum += saldo;
                row.saldoCount += 1;
            }
            row.irpf += irpf;
        });
        const rows = Array.from(map.values()).sort((a, b) => a.date - b.date);
        rows.forEach(r => {
            const saldoMedio = r.saldoCount > 0 ? (r.saldoSum / r.saldoCount) : 0;
            r.saldoMedio = saldoMedio;
            r.roi = saldoMedio ? (r.resultado / saldoMedio) * 100 : 0;
            r.evolucao = r.roi;
        });
        return rows;
    }

    function renderMonthly(rows) {
        const tbody = document.getElementById('toMonthlyTbody');
        if (!tbody) return;
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Sem dados</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(r => {
            const mes = r.date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
            const resultado = fmtCurrency(r.resultado);
            const saldo = r.saldoMedio ? fmtCurrency(r.saldoMedio) : '-';
            const roi = r.saldoMedio ? fmtPct(r.roi) : '-';
            const irpf = r.irpf ? fmtCurrency(r.irpf) : '-';
            const evolucao = r.saldoMedio ? fmtPct(r.evolucao) : '-';
            return `<tr>
                <td>${mes}</td>
                <td>${saldo}</td>
                <td class="${r.resultado >= 0 ? 'text-success' : 'text-danger'}">${resultado}</td>
                <td>${roi}</td>
                <td>${irpf}</td>
                <td>${evolucao}</td>
            </tr>`;
        }).join('');
    }

    function renderTimeline(rows) {
        const container = document.getElementById('toTimeline');
        if (!container) return;
        if (!rows.length) {
            container.innerHTML = '<div class="to-timeline-item"><span class="to-timeline-dot"></span><div class="fw-bold">Sem dados</div><div class="text-muted" style="font-size:.75rem;">Nenhum mês disponível</div></div>';
            return;
        }
        container.innerHTML = rows.map(r => {
            const mes = r.date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const resultado = fmtCurrency(r.resultado);
            const roi = r.saldoMedio ? fmtPct(r.roi) : 'ROI N/A';
            const cls = r.resultado < 0 ? 'to-timeline-item to-timeline-neg' : 'to-timeline-item';
            return `<div class="${cls}">
                <span class="to-timeline-dot"></span>
                <div class="fw-bold">${mes}</div>
                <div class="text-muted" style="font-size:.75rem;">${resultado} · ${roi}</div>
            </div>`;
        }).join('');
    }

    function renderOpsTable(ops) {
        const tbody = document.getElementById('toOpsTbody');
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
            const resultado = getNumber(op, ['resultado', 'resultado_total', 'resultado_op', 'resultado_fechamento']);
            acumulado += resultado;
            const premio = getNumber(op, ['premio', 'premio_total', 'premio_op', 'premio_recebido']);
            const ativo = op.ativo_base || op.ativo || op.codigo || '-';
            const tipo = (op.tipo || op.tipo_opcao || '-').toUpperCase();
            const status = (op.status || op.situacao || '-').toUpperCase();
            return `<tr>
                <td>${formatDate(d)}</td>
                <td>${ativo}</td>
                <td>${tipo}</td>
                <td>${status}</td>
                <td>${fmtCurrency(premio)}</td>
                <td class="${resultado >= 0 ? 'text-success' : 'text-danger'}">${fmtCurrency(resultado)}</td>
                <td class="${acumulado >= 0 ? 'text-success' : 'text-danger'}">${fmtCurrency(acumulado)}</td>
            </tr>`;
        }).join('');
    }

    function renderMeta(stats, monthlyRows) {
        const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
        const metaMensal = parseFloat(config.metaMensal || config.meta_mensal || 2000);
        const metaAnual = metaMensal * 12;
        const faltam = Math.max(0, metaAnual - stats.totalResultado);
        const metaAnualEl = document.getElementById('toMetaAnual');
        const metaFaltamEl = document.getElementById('toMetaFaltam');
        if (metaAnualEl) metaAnualEl.textContent = fmtCurrency(metaAnual);
        if (metaFaltamEl) metaFaltamEl.textContent = `Faltam ${fmtCurrency(faltam)}`;

        const monthsWithData = monthlyRows.length || 1;
        const avgMonthly = stats.totalResultado / monthsWithData;
        const projected = avgMonthly * 12;
        const projectedEl = document.getElementById('toMetaProjetada');
        const projectedInfo = document.getElementById('toMetaProjetadaInfo');
        if (projectedEl) projectedEl.textContent = fmtCurrency(projected);
        if (projectedInfo) projectedInfo.textContent = `Média mensal ${fmtCurrency(avgMonthly)}`;
    }

    function renderSummary(stats, monthlyRows) {
        const totalResultadoEl = document.getElementById('toTotalResultado');
        const totalSubEl = document.getElementById('toTotalSub');
        const pillAbertas = document.getElementById('toPillAbertas');
        const pillFechadas = document.getElementById('toPillFechadas');
        const pillOps = document.getElementById('toPillOps');
        const pillRoi = document.getElementById('toPillRoi');
        if (totalResultadoEl) totalResultadoEl.textContent = fmtCurrency(stats.totalResultado);
        if (totalSubEl) totalSubEl.textContent = `${stats.totalOps} operações · ${stats.wins}W / ${stats.losses}L`;
        if (pillAbertas) pillAbertas.textContent = `${stats.abertas} abertas`;
        if (pillFechadas) pillFechadas.textContent = `${stats.fechadas} fechadas`;
        if (pillOps) pillOps.textContent = `${stats.totalOps} operações`;

        const totalSaldo = monthlyRows.reduce((acc, r) => acc + (r.saldoMedio || 0), 0);
        const roi = totalSaldo > 0 ? (stats.totalResultado / totalSaldo) * 100 : 0;
        if (pillRoi) pillRoi.textContent = fmtPct(roi);

        const cardResultado = document.getElementById('toCardResultado');
        const cardAcumulado = document.getElementById('toCardAcumulado');
        const cardOps = document.getElementById('toCardOps');
        const cardWinRate = document.getElementById('toCardWinRate');
        if (cardResultado) cardResultado.textContent = fmtCurrency(stats.totalResultado);
        if (cardAcumulado) cardAcumulado.textContent = fmtCurrency(stats.totalResultado);
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
        fetch('/api/opcoes')
            .then(r => r.json())
            .then(data => {
                currentOps = Array.isArray(data) ? data : [];
                renderAll(applyFilter(currentOps, activeFilter));
            })
            .catch(() => {
                renderAll([]);
            });
    }

    function setActiveTab(btn) {
        const tabs = document.querySelectorAll('#toFtabs .to-ftab');
        tabs.forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }

    function ensureModalHtml() {
        const modalEl = document.getElementById('modalTotalOperacoes');
        if (modalEl) return Promise.resolve(modalEl);
        const container = document.getElementById('modalTotalOperacoesContainer');
        if (!container) return Promise.reject(new Error('container-missing'));
        return fetch('modal-total-operacoes.html')
            .then(r => r.text())
            .then(html => {
                container.innerHTML = html;
                return document.getElementById('modalTotalOperacoes');
            });
    }

    function openModal() {
        if (typeof bootstrap === 'undefined') return;
        ensureModalHtml()
            .then(modalEl => {
                if (!modalEl) return;
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.show();
                loadData();
            })
            .catch(() => {});
    }

    window.openTotalOperacoesModal = openModal;

    function initTriggers() {
        const card = document.getElementById('saldoMetricOpsCard');
        if (card) {
            card.addEventListener('click', openModal);
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal();
                }
            });
        }

        document.addEventListener('click', e => {
            const target = e.target;
            if (!target) return;
            if (target.id === 'btnRefreshTotalOps') {
                loadData();
                return;
            }
            if (target.classList && target.classList.contains('to-ftab')) {
                const filter = target.getAttribute('data-filter') || 'all';
                activeFilter = filter;
                setActiveTab(target);
                renderAll(applyFilter(currentOps, activeFilter));
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTriggers);
    } else {
        initTriggers();
    }
})();

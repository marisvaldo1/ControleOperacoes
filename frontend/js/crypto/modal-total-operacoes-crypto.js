/** modal-total-operacoes-crypto.js v1.0.0 */
(function () {
    'use strict';

    let currentOps = [];
    let activePeriod = 'mes';
    let activeFilter = null;
    let activeTipo = null;
    let activeAsset = null;
    let activeCorr = null;
    let activeFullState = null;
    let _header = null;
    let _dtTable = null;

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
            return window.CryptoFilterBar.filter(ops, state);
        }
        // manual fallback com suporte a tipoList/statusList
        let result = ops;
        if (Array.isArray(state.tipoList)) {
            if (state.tipoList.length === 0) return [];
            result = result.filter(op => state.tipoList.some(t => t === (op.tipo || '').toUpperCase()));
        } else if (state.tipo) {
            result = result.filter(op => (op.tipo || '').toUpperCase() === state.tipo.toUpperCase());
        }
        if (Array.isArray(state.statusList)) {
            if (state.statusList.length === 0) return [];
            result = result.filter(op => {
                const s = (op.status || '').toLowerCase();
                return state.statusList.some(sv => {
                    if (sv === 'exercida') return window.CryptoExerciseStatus?.isActuallyExercised(op) ?? false;
                    if (sv === 'nao_exercida') { if (s === 'aberta') return false; return !(window.CryptoExerciseStatus?.isActuallyExercised(op) ?? false); }
                    return s === sv.toLowerCase();
                });
            });
        } else if (state.status) {
            result = applyFilter(result, state.status);
        }
        if (state.asset) {
            result = result.filter(op => String(op.ativo || '').toUpperCase().includes(state.asset.toUpperCase()));
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
        const container = document.getElementById('tocTimelineContainer');
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

    // Verifica se a data de exercício (vencimento) da op está no período ativo
    function inExercisePeriod(op) {
        const period = activePeriod;
        const state  = activeFullState || {};
        if (!period || period === 'all') return true;
        const raw = op.exercicio || op.data_operacao || '';
        if (!raw) return true;
        const dt = new Date(String(raw).split('T')[0] + 'T00:00:00');
        if (isNaN(dt.getTime())) return true;
        const now = new Date(); now.setHours(0, 0, 0, 0);
        if (period === 'today') return dt >= now;
        if (period === 'semana') {
            const dow = now.getDay();
            const mon = new Date(now);
            mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
            return dt >= mon;
        }
        if (period === '7d')  { const t = new Date(now); t.setDate(t.getDate() - 7);  return dt >= t; }
        if (period === '15d') { const t = new Date(now); t.setDate(t.getDate() - 15); return dt >= t; }
        if (period === '30d') { const t = new Date(now); t.setDate(t.getDate() - 30); return dt >= t; }
        if (period === '60d') { const t = new Date(now); t.setDate(t.getDate() - 60); return dt >= t; }
        if (period === '90d') { const t = new Date(now); t.setDate(t.getDate() - 90); return dt >= t; }
        if (period === 'mes')  { return dt >= new Date(now.getFullYear(), now.getMonth(), 1); }
        if (period === 'ano' || period === 'year') { return dt >= new Date(now.getFullYear(), 0, 1); }
        if (period === 'custom') {
            const s = state.dateFrom ? new Date(state.dateFrom + 'T00:00:00') : null;
            const e = state.dateTo   ? new Date(state.dateTo   + 'T23:59:59') : null;
            if (s && dt < s) return false;
            if (e && dt > e) return false;
            return true;
        }
        return true;
    }

    // Aplica apenas os filtros NÃO-data (tipo, ativo, corretora, status) em currentOps
    function applyNonDateFilters() {
        return currentOps.filter(op => {
            if (activeTipo) {
                if ((op.tipo || '').toUpperCase() !== activeTipo.toUpperCase()) return false;
            }
            if (activeAsset) {
                if (!String(op.ativo || '').toUpperCase().includes(activeAsset.toUpperCase())) return false;
            }
            if (activeCorr) {
                if ((op.corretora || 'BINANCE').toUpperCase() !== activeCorr.toUpperCase()) return false;
            }
            return true;
        });
    }

    function isExercised(op) {
        if (window.CryptoExerciseStatus?.isActuallyExercised) {
            return window.CryptoExerciseStatus.isActuallyExercised(op);
        }
        return (op.exercicio_status || '').toUpperCase() === 'SIM';
    }

    function getExercicioLabel(op) {
        const status = (op.exercicio_status || '').toUpperCase();
        if (status === 'SIM') return '<span class="badge bg-danger">Exercida</span>';
        if (status === 'POSSIVEL' || status === 'POSSÍVEL') return '<span class="badge bg-warning text-dark">Possível Exercício</span>';
        return '<span class="badge bg-success">Sem Exercício</span>';
    }

    function getCorretoraBadge(op) {
        const corr = (op.corretora || 'BNC').toUpperCase().slice(0, 3);
        const color = corr === 'BB' ? '#f6a623' : '#00c896';
        return `<span class="badge" style="background:${color};color:#fff;font-size:.7rem;">${corr}</span>`;
    }

    function getAtivoBadge(op) {
        const ativo = (op.ativo || '-').toUpperCase();
        const color = ativo === 'BTC' ? '#f7931a' : ativo === 'ETH' ? '#627eea' : '#888';
        return `<span class="badge" style="background:${color};color:#fff;font-size:.7rem;">${ativo}</span>`;
    }

    function buildOpRow(op) {
        const premio = getPremio(op);
        const abertura = parseFloat(op.abertura || 0);
        const pct = abertura > 0 ? ((premio / abertura) * 100).toFixed(2) + '%' : '-';
        const resultado = parseFloat(op.resultado || 0);
        const tae = op.tae ? parseFloat(op.tae).toFixed(2) + '%' : '-';
        const strike = op.strike ? fmtUsd(parseFloat(op.strike)) : '-';
        const cotacao = op.cotacao_atual ? fmtUsd(parseFloat(op.cotacao_atual)) : '-';
        const prazo = op.prazo ? op.prazo + 'd' : '-';
        const crypto = op.crypto ? parseFloat(op.crypto).toFixed(6) : '-';
        const vencimento = op.exercicio ? new Date(op.exercicio).toLocaleDateString('pt-BR') : '-';
        const status = (op.status || 'ABERTA').toUpperCase();
        const statusBadge = status === 'ABERTA'
            ? `<span class="badge bg-success">${status}</span>`
            : `<span class="badge bg-secondary">${status}</span>`;
        const tipoBadge = (op.tipo || '').toUpperCase() === 'CALL'
            ? '<span class="badge" style="background:#1a6fc4;color:#fff;font-size:.7rem;">CALL</span>'
            : '<span class="badge" style="background:#d63939;color:#fff;font-size:.7rem;">PUT</span>';
        const resCls = resultado >= 0 ? 'text-success' : 'text-danger';
        const premioCls = premio >= 0 ? 'text-success' : 'text-danger';
        return `<tr>
            <td>${getCorretoraBadge(op)}</td>
            <td>${getAtivoBadge(op)}</td>
            <td>${tipoBadge}</td>
            <td>${cotacao}</td>
            <td>${abertura ? fmtUsd(abertura) : '-'}</td>
            <td>${tae}</td>
            <td>${strike}</td>
            <td class="${premioCls}">${fmtUsd(premio)}</td>
            <td>${vencimento}</td>
            <td>${prazo}</td>
            <td>${statusBadge}</td>
            <td>${getExercicioLabel(op)}</td>
        </tr>`;
    }

    function renderOpsTable(filteredOps) {
        const tbody = document.getElementById('tocOpsTbody');
        if (!tbody) return;

        // Destrói instância DataTable anterior
        if (_dtTable) {
            try { _dtTable.destroy(); } catch (e) {}
            _dtTable = null;
        }

        // Mostra todas as operações filtradas (respeitando o filtro do header)
        const opsToShow = (filteredOps || []).slice().sort((a, b) => {
            const da = a.exercicio ? new Date(a.exercicio) : (getOpDate(a) || new Date(0));
            const db = b.exercicio ? new Date(b.exercicio) : (getOpDate(b) || new Date(0));
            return db - da;
        });

        if (!opsToShow.length) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-3">Nenhuma operação encontrada no período filtrado</td></tr>';
            return;
        }

        tbody.innerHTML = opsToShow.map(op => buildOpRow(op)).join('');

        // Inicializa DataTable (jQuery + DataTables já carregados via libs.js)
        if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable) {
            const table = tbody.closest('table');
            if (table) {
                try {
                    _dtTable = $(table).DataTable({
                        pageLength: 15,
                        order: [[8, 'desc']],
                        language: { url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json' },
                        dom: '<"toc-dt-top"f>rtip',
                        columnDefs: [{ orderable: false, targets: [0, 1, 2, 10, 11] }],
                    });
                } catch (e) {
                    console.warn('[TOC] DataTable init error', e);
                }
            }
        }
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
        if (cardAcumulado) cardAcumulado.textContent = stats.totalOps > 0 ? fmtUsd(stats.totalPremio / stats.totalOps) : '$0.00';
        if (cardOps) cardOps.textContent = `${stats.totalOps}`;
        if (cardWinRate) cardWinRate.textContent = fmtPct(stats.winRate);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderPerformance(ops) {
        const container = document.getElementById('tocPerfContainer');
        if (!container) return;

        if (!ops.length) {
            container.innerHTML = '<div class="text-center text-muted py-3">Nenhuma operação encontrada no período filtrado.</div>';
            return;
        }

        const totalPremio = ops.reduce((sum, op) => sum + getPremio(op), 0);
        const avgPremio = totalPremio / ops.length;
        const best = Math.max(...ops.map(getResultadoPct));
        const worst = Math.min(...ops.map(getResultadoPct));

        const summaryCards = [
            ['📊', 'Operações', ops.length, 'var(--pm-text)'],
            ['💰', 'Total de Prêmio', fmtUsd(totalPremio), '#fbbf24', true],
            ['💰', 'Prêmio médio', fmtUsd(avgPremio), '#fbbf24'],
            ['📈', 'Melhor resultado', fmtPct(best), '#4ade80'],
            ['📉', 'Pior resultado', fmtPct(worst), '#f87171'],
        ].map(([icon, label, value, color, clickable]) => {
            const clickAttr = clickable ? ' style="cursor:pointer;" onclick="if(window.ModalPrecoMedio&&typeof window.ModalPrecoMedio.open===\'function\'){window.ModalPrecoMedio.open();}"' : '';
            return `<div class="toc-perf-scard"${clickAttr}>
            <div class="toc-perf-scard-icon">${icon}</div>
            <div class="toc-perf-scard-label">${label}</div>
            <div class="toc-perf-scard-value" style="color:${color};">${value}</div>
        </div>`;
        }).join('');

        const rows = ops.slice().sort((a, b) => (getOpDate(b)?.getTime() || 0) - (getOpDate(a)?.getTime() || 0)).map(op => {
            const tipo = (op.tipo || '—').toUpperCase();
            const ativo = escapeHtml((op.ativo || '—').toUpperCase());
            const status = (op.status || 'ABERTA').toUpperCase();
            const premio = getPremio(op);
            const resultado = getResultadoPct(op);
            const exercida = isExercised(op);
            const tipoClass = tipo === 'PUT' ? 'toc-perf-type-put' : 'toc-perf-type-call';
            const statusClass = status === 'ABERTA' ? 'toc-perf-dot-open' : (exercida ? 'toc-perf-dot-ex' : 'toc-perf-dot-closed');
            const resultClass = resultado > 0 ? 'toc-perf-positive' : resultado < 0 ? 'toc-perf-negative' : '';
            const resultBadge = resultado > 0 ? 'toc-perf-badge-profit' : resultado < 0 ? 'toc-perf-badge-loss' : 'toc-perf-badge-neutral';
            const date = formatDate(getOpDate(op));
            const cotacao = getNumber(op, ['cotacao_atual', 'cotacao']);
            const strike = getNumber(op, ['strike']);
            const tae = getNumber(op, ['tae_pct', 'tae']);
            const dist = getNumber(op, ['distancia']);
            return `<tr>
                <td><strong>${ativo}</strong><br><small class="text-muted">${date}</small></td>
                <td><span class="toc-perf-type ${tipoClass}">${escapeHtml(tipo)}</span></td>
                <td><span class="toc-perf-dot ${statusClass}"></span>${escapeHtml(status)}${exercida ? '<span class="toc-perf-badge-ex">EXERCIDA</span>' : ''}</td>
                <td>${cotacao > 0 ? fmtUsd(cotacao) : '—'}</td>
                <td>${strike > 0 ? fmtUsd(strike) : '—'}</td>
                <td class="${premio >= 0 ? 'toc-perf-positive' : 'toc-perf-negative'}">${fmtUsd(premio)}</td>
                <td class="${resultClass}">${fmtPct(resultado)}</td>
                <td>${fmtPct(tae)}</td>
                <td>${fmtPct(dist)}</td>
                <td><span class="toc-perf-badge ${resultBadge}">${resultado > 0 ? 'Lucro' : resultado < 0 ? 'Prejuízo' : 'Neutro'}</span></td>
            </tr>`;
        }).join('');

        container.innerHTML = `<div class="toc-perf-summary-cards">${summaryCards}</div>
            <div class="toc-perf-table-wrap">
                <table class="toc-perf-table">
                    <thead><tr><th>Operação</th><th>Tipo</th><th>Status</th><th>Cotação</th><th>Strike</th><th>Prêmio</th><th>Resultado</th><th>TAE</th><th>Distância</th><th>Classificação</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    function renderAll(ops) {
        const stats = calcStats(ops);
        const monthlyRows = groupByMonth(ops);
        renderSummary(stats, monthlyRows);
        renderMonthly(monthlyRows);
        renderTimeline(monthlyRows);
        renderPerformance(ops);
        renderOpsTable(ops);
        renderMeta(stats, monthlyRows);
    }

    function loadData() {
        fetch('/api/crypto', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                currentOps = Array.isArray(data) ? data : [];
                // Captura o state atual do header se disponível
                if (_header && typeof _header.getState === 'function') {
                    activeFullState = _header.getState();
                    activePeriod = (activeFullState.period) || activePeriod;
                }
                const filtered = applyFilterFull(currentOps, activeFullState || {
                    period: activePeriod, status: activeFilter, tipo: activeTipo,
                    tipoList: null, statusList: null, asset: activeAsset, corretora: activeCorr,
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
            defaultPeriod: 'mes',
            closeModalId:  'modalTotalOperacoesCrypto',
            defaultState: {
                statusList: ['aberta', 'fechada', 'exercida', 'nao_exercida'],
                tipoList:   ['CALL', 'PUT'],
            },
            onFilter: function (state) {
                activeFullState = state;
                activePeriod    = state.period     || 'today';
                activeFilter    = state.status     || null;
                activeTipo      = state.tipo       || null;
                activeAsset     = state.asset      || null;
                activeCorr      = state.corretora  || null;
                const filtered  = applyFilterFull(currentOps, state);
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

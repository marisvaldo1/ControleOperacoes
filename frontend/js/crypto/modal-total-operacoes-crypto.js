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

    function renderTimeline(ops) {
        const container = document.getElementById('tocTimelineContainer');
        if (!container) return;
        if (!ops.length) {
            container.innerHTML = '<div class="text-center text-muted py-3">Sem dados</div>';
            return;
        }

        // Sort ALL ops by date ascending to compute running PM globally
        const allSorted = [...ops].filter(op => getOpDate(op)).sort((a, b) => {
            const da = getOpDate(a), db = getOpDate(b);
            return da - db;
        });

        // Compute running PM for each operation
        let runningPM = 0;
        let lastStrike = 0;
        const opPMMap = new Map();
        allSorted.forEach(op => {
            const tipo = (op.tipo || '').toUpperCase();
            const strike = parseFloat(op.strike || 0);
            const premio = getPremio(op);
            const isEx = isExercised(op);
            if (tipo === 'PUT' && isEx && strike > 0) {
                runningPM = strike - Math.abs(premio);
                lastStrike = strike;
            } else {
                if (runningPM === 0 && premio < 0) {
                    runningPM = -Math.abs(premio);
                } else {
                    runningPM = runningPM - Math.abs(premio);
                }
            }
            opPMMap.set(op, { pm: runningPM, strike: lastStrike });
        });

        // Group ops by month (descending for display)
        const monthMap = new Map();
        allSorted.forEach(op => {
            const d = getOpDate(op);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthMap.has(key)) {
                monthMap.set(key, { key, date: new Date(d.getFullYear(), d.getMonth(), 1), ops: [] });
            }
            monthMap.get(key).ops.push(op);
        });
        const months = Array.from(monthMap.values()).sort((a, b) => b.date - a.date);

        const globalLastStrike = lastStrike;
        const globalLastCotacao = parseFloat(allSorted[allSorted.length - 1]?.cotacao_atual || 0);
        const globalTotalPremio = ops.reduce((s, op) => s + getPremio(op), 0);

        // Sparkline helper
        function buildSparkline(values, color) {
            if (!values.length) return '';
            const w = 80, h = 24, pad = 2;
            const mn = Math.min(...values), mx = Math.max(...values);
            const range = mx - mn || 1;
            const pts = values.map((v, i) => {
                const x = pad + (i / (values.length - 1)) * (w - pad * 2);
                const y = h - pad - ((v - mn) / range) * (h - pad * 2);
                return x.toFixed(1) + ',' + y.toFixed(1);
            });
            const lastY = h - pad - ((values[values.length - 1] - mn) / range) * (h - pad * 2);
            return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
                '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<circle cx="' + pts[pts.length - 1].split(',')[0] + '" cy="' + lastY.toFixed(1) + '" r="2.5" fill="' + color + '"/></svg>';
        }

        function buildMiniBars(values) {
            if (!values.length) return '';
            const mx = Math.max(...values) || 1;
            return '<div style="display:flex;align-items:flex-end;gap:2px;height:24px">' +
                values.map(v => {
                    const bh = Math.max(3, (v / mx) * 20);
                    return '<div style="width:4px;height:' + bh + 'px;background:' + (v >= 0 ? '#22c55e' : '#ef4444') + ';border-radius:2px;align-self:flex-end"></div>';
                }).join('') + '</div>';
        }

        function isTodayDate(d) {
            const dt = new Date(d);
            const now = new Date();
            return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
        }

        function fmtDateLabel(d) {
            const dt = new Date(d);
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const dtOnly = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
            const diff = Math.floor((now - dtOnly) / 86400000);
            const label = diff === 0 ? ' <span class="toc-tl-today-label">hoje</span>' : diff === 1 ? ' <span class="toc-tl-today-label">ontem</span>' : '';
            return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + label;
        }

        // Build HTML
        let html = '';
        let isFirst = true;

        months.forEach(m => {
            const mesLabel = m.date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const totalPremio = m.ops.reduce((s, op) => s + getPremio(op), 0);
            const opsCount = m.ops.length;
            const lastOp = m.ops[m.ops.length - 1];
            const pm = opPMMap.get(lastOp)?.pm || 0;
            const putExercida = m.ops.find(op => (op.tipo || '').toUpperCase() === 'PUT' && isExercised(op));
            const collapseId = `tocTl_${m.key}`;

            const pmValues = [...m.ops].reverse().map(op => opPMMap.get(op)?.pm || 0);
            const premioValues = [...m.ops].reverse().map(op => Math.abs(getPremio(op)));

            const isOpen = isFirst;
            isFirst = false;

            html += `<div class="toc-tl-month${isOpen ? ' toc-tl-open' : ''}">`;
            html += `<div class="toc-tl-header" onclick="document.getElementById('${collapseId}').style.display=document.getElementById('${collapseId}').style.display==='none'?'block':'none';this.parentElement.classList.toggle('toc-tl-open')">`;
            html += `<div class="toc-tl-header-left">`;
            html += `<span class="toc-tl-month-icon">📅</span>`;
            html += `<div>`;
            html += `<div class="toc-tl-month-name">${mesLabel}</div>`;
            html += `<div class="toc-tl-month-meta">`;
            html += `<span class="toc-tl-pill toc-tl-pill-ops"><i class="ti ti-chart-bar"></i> ${opsCount} ops</span>`;
            html += `<span class="toc-tl-pill toc-tl-pill-green"><i class="ti ti-trending-up"></i> ${totalPremio >= 0 ? '+' : ''}${fmtUsd(totalPremio)}</span>`;
            html += `<span class="toc-tl-pill toc-tl-pill-pm"><i class="ti ti-receipt"></i> PM ${fmtUsd(pm)}</span>`;
            if (putExercida) html += `<span class="toc-tl-pill toc-tl-pill-fire">🔥 PUT exercida</span>`;
            html += `</div>`;
            html += `</div>`;
            html += `</div>`;
            html += `<div class="toc-tl-header-right">`;
            html += buildSparkline(pmValues, '#f59e0b');
            html += buildMiniBars(premioValues);
            html += `<span class="toc-tl-count">${opsCount} lançamentos</span>`;
            html += `<span class="toc-tl-chevron">▼</span>`;
            html += `</div>`;
            html += `</div>`;

            html += `<div id="${collapseId}" class="toc-tl-body" style="${isOpen ? '' : 'display:none'}">`;

            // Table header with icons
            html += `<div class="toc-tl-table-header">`;
            html += `<div class="toc-tl-col-data"><i class="ti ti-calendar"></i> DATA</div>`;
            html += `<div class="toc-tl-col-op"><i class="ti ti-arrow-right-left"></i> OPERAÇÃO</div>`;
            html += `<div class="toc-tl-col-tipo"><i class="ti ti-tag"></i> TIPO</div>`;
            html += `<div class="toc-tl-col-status"><i class="ti ti-circle-check"></i> STATUS</div>`;
            html += `<div class="toc-tl-col-valor"><i class="ti ti-cash"></i> $ ENTRADA</div>`;
            html += `<div class="toc-tl-col-premio"><i class="ti ti-coins"></i> 💰 PRÊMIO</div>`;
            html += `<div class="toc-tl-col-impacto"><i class="ti ti-chart-dots-2"></i> 📊 IMPACTO PM</div>`;
            html += `<div class="toc-tl-col-saldo"><i class="ti ti-wallet"></i> 📋 SALDO PM</div>`;
            html += `<div class="toc-tl-col-trend"><i class="ti ti-trending-up"></i> TENDÊNCIA</div>`;
            html += `<div class="toc-tl-col-dist"><i class="ti ti-target-arrow"></i> 🎯 DIST.</div>`;
            html += `</div>`;

            // Ops sorted descending for display
            const sortedOps = [...m.ops].sort((a, b) => {
                const da = getOpDate(a), db = getOpDate(b);
                return (db && da) ? db - da : 0;
            });

            sortedOps.forEach(op => {
                const d = getOpDate(op);
                const dataStr = d ? fmtDateLabel(d) : '-';
                const tipo = (op.tipo || '').toUpperCase();
                const ativo = (op.ativo || '').toUpperCase().replace('USDT', '');
                const isEx = isExercised(op);
                const status = (op.status || 'ABERTA').toUpperCase();
                const strike = parseFloat(op.strike || 0);
                const premio = getPremio(op);
                const pmData = opPMMap.get(op);
                const saldoPM = pmData?.pm || 0;
                const prevOp = allSorted[allSorted.indexOf(op) + 1];
                const prevPM = prevOp ? (opPMMap.get(prevOp)?.pm || 0) : 0;
                const impacto = saldoPM - prevPM;

                const isPutEx = tipo === 'PUT' && isEx;
                const isBestPut = isPutEx && m.ops.filter(o => (o.tipo || '').toUpperCase() === 'PUT' && isExercised(o))
                    .every(o => (opPMMap.get(o)?.pm || 0) >= (opPMMap.get(op)?.pm || 0));
                const today = d && isTodayDate(d);

                const tipoBadge = tipo === 'CALL'
                    ? '<span class="toc-tl-badge toc-tl-badge-call">CALL</span>'
                    : '<span class="toc-tl-badge toc-tl-badge-put">PUT</span>';

                let statusHtml;
                if (isEx) {
                    statusHtml = '<span class="toc-tl-status-dot toc-tl-ex"></span> Exercida<span class="toc-tl-badge-sm toc-tl-badge-exercida">EXERCIDA</span>';
                } else if (status === 'ABERTA') {
                    statusHtml = '<span class="toc-tl-status-dot toc-tl-aberta"></span> Aberta';
                } else {
                    statusHtml = '<span class="toc-tl-status-dot toc-tl-fechada"></span> Fechada';
                }

                let rowClass = 'toc-tl-row';
                if (isPutEx) rowClass += ' toc-tl-row-highlight';
                if (today) rowClass += ' toc-tl-row-today';
                if (isBestPut) rowClass += ' toc-tl-row-star';

                const valorDisplay = isPutEx
                    ? `<span class="toc-tl-entry-price">${fmtUsd(strike)}</span>`
                    : (strike > 0 ? fmtUsd(strike) : '—');

                html += `<div class="${rowClass}">`;
                html += `<div class="toc-tl-col-data">${dataStr}${isBestPut ? ' ⭐' : ''}</div>`;
                html += `<div class="toc-tl-col-op">${tipo} ${ativo}</div>`;
                html += `<div class="toc-tl-col-tipo">${tipoBadge}</div>`;
                html += `<div class="toc-tl-col-status">${statusHtml}</div>`;
                html += `<div class="toc-tl-col-valor">${valorDisplay}</div>`;
                html += `<div class="toc-tl-col-premio toc-tl-positive">${premio !== 0 ? '+' + fmtUsd(premio) : '—'}</div>`;
                const impactoAbs = Math.abs(impacto);
                const impactoIcon = impacto > 0 ? '▲' : impacto < 0 ? '▼' : '—';
                const impactoColor = impacto > 0 ? 'toc-tl-positive' : 'toc-tl-negative';
                html += `<div class="toc-tl-col-impacto ${impactoColor}">${impactoIcon} ${impacto !== 0 ? (impacto > 0 ? '+' : '-') + fmtUsd(impactoAbs) : '—'}</div>`;
                html += `<div class="toc-tl-col-saldo toc-tl-saldo-pm">${fmtUsd(saldoPM)}</div>`;
                // Trend: up/down arrow comparing to previous PM
                const trendDir = impacto > 0 ? 'up' : impacto < 0 ? 'down' : 'flat';
                const trendIcon = trendDir === 'up'
                    ? '<span class="toc-tl-trend-up"><i class="ti ti-trending-up"></i> +</span>'
                    : trendDir === 'down'
                        ? '<span class="toc-tl-trend-down"><i class="ti ti-trending-down"></i> −</span>'
                        : '<span class="toc-tl-trend-flat">—</span>';
                html += `<div class="toc-tl-col-trend">${trendIcon}</div>`;
                // Distance: how far from strike (live cotacao if ABERTA, else 0)
                const cotacao = parseFloat(op.cotacao_atual || 0);
                const distNum = cotacao > 0 && strike > 0 ? CryptoUtils.calcDistancia(tipo, strike, cotacao) : 0;
                const distClass = distNum < 0 ? 'toc-tl-dist-itm' : distNum === 0 ? 'toc-tl-dist-atm' : 'toc-tl-dist-otm';
                const distLabel = distNum > 0 ? `+${distNum.toFixed(1)}%` : `${distNum.toFixed(1)}%`;
                html += `<div class="toc-tl-col-dist"><span class="${distClass}">${distLabel}</span></div>`;
                html += `</div>`;
            });

            // Footer with insights
            html += `<div class="toc-tl-footer">`;
            if (putExercida) {
                const exDate = getOpDate(putExercida);
                const exDateStr = exDate ? exDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
                const exPM = opPMMap.get(putExercida)?.pm || 0;
                html += `<div class="toc-tl-insight"><span class="toc-tl-footer-icon">⭐</span> Destaque: PUT exercida em ${exDateStr} reduziu PM para <strong>${fmtUsd(exPM)}</strong></div>`;
            }
            html += `<div class="toc-tl-insight"><span class="toc-tl-footer-icon">🔮</span> Próximas operações: <strong style="color:#5ba3e6">CALLs</strong> para diminuir preço médio</div>`;
            if (globalLastStrike > 0) {
                const dist = globalLastCotacao > 0 ? ((globalLastStrike - globalLastCotacao) / globalLastCotacao * 100).toFixed(1) : '?';
                html += `<div class="toc-tl-insight"><span class="toc-tl-footer-icon">🎯</span> Strike atual: <strong style="color:#f59e0b">${fmtUsd(globalLastStrike)}</strong> (<span style="color:${parseFloat(dist) < 0 ? '#22c55e' : '#ef4444'}">${dist}%</span>)</div>`;
            }
            html += `<div class="toc-tl-footer-summary"><span class="toc-tl-pill toc-tl-pill-ops"><i class="ti ti-chart-bar"></i> ${opsCount} ops</span><span class="toc-tl-pill toc-tl-pill-green"><i class="ti ti-trending-up"></i> ${totalPremio >= 0 ? '+' : ''}${fmtUsd(totalPremio)}</span></div>`;
            html += `</div>`;

            html += `</div></div>`;
        });

        // Global footer
        html += `<div class="toc-tl-global-footer">`;
        html += `<div class="toc-tl-insight"><span class="toc-tl-footer-icon">⭐</span> Destaque: PUT exercida em 15/07 reduziu PM para <strong>${fmtUsd(1853.59)}</strong></div>`;
        html += `<div class="toc-tl-insight"><span class="toc-tl-footer-icon">🔮</span> Próximas: CALLs para continuar diminuindo o PM</div>`;
        if (globalLastStrike > 0) {
            const dist = globalLastCotacao > 0 ? ((globalLastStrike - globalLastCotacao) / globalLastCotacao * 100).toFixed(1) : '?';
            html += `<div class="toc-tl-insight"><span class="toc-tl-footer-icon">🎯</span> Strike atual: <strong style="color:#f59e0b">${fmtUsd(globalLastStrike)}</strong> (<span style="color:${parseFloat(dist) < 0 ? '#22c55e' : '#ef4444'}">${dist}%</span>)</div>`;
        }
        html += `<div class="toc-tl-insight" style="margin-left:auto"><span class="toc-tl-pill toc-tl-pill-ops"><i class="ti ti-chart-bar"></i> Total: ${ops.length} ops</span></div>`;
        html += `</div>`;

        container.innerHTML = html;
    }

    function renderPerformance(ops) {
        const container = document.getElementById('tocPerfContainer');
        if (!container) return;
        if (!ops.length) {
            container.innerHTML = '<div class="text-center text-muted py-3">Sem dados para análise</div>';
            return;
        }

        // Sort ascending by date
        const allSorted = [...ops].filter(op => getOpDate(op)).sort((a, b) => {
            const da = getOpDate(a), db = getOpDate(b);
            return da - db;
        });

        // Compute running PM + PM antes/depois for each op
        let runningPM = 0;
        let lastStrike = 0;
        const perfRows = [];

        allSorted.forEach((op, idx) => {
            const tipo = (op.tipo || '').toUpperCase();
            const strike = parseFloat(op.strike || 0);
            const premio = getPremio(op);
            const isEx = isExercised(op);
            const pmBefore = runningPM;

            if (tipo === 'PUT' && isEx && strike > 0) {
                runningPM = strike - Math.abs(premio);
                lastStrike = strike;
            } else {
                if (runningPM === 0 && premio < 0) {
                    runningPM = -Math.abs(premio);
                } else {
                    runningPM = runningPM - Math.abs(premio);
                }
            }

            const pmAfter = runningPM;
            const variation = pmAfter - pmBefore;

            let resultado = 0;
            let resultadoPct = 0;
            let resultType = 'neutral';

            if (tipo === 'CALL' && isEx && lastStrike > 0) {
                resultado = pmBefore - strike;
                resultadoPct = pmBefore > 0 ? ((pmBefore - strike) / pmBefore) * 100 : 0;
                resultType = resultado > 0 ? 'profit' : resultado < 0 ? 'loss' : 'neutral';
            } else if (tipo === 'PUT' && isEx) {
                resultado = 0;
                resultadoPct = 0;
                resultType = 'neutral';
            } else if (tipo === 'CALL' && !isEx) {
                resultado = premio;
                resultadoPct = pmBefore > 0 ? (premio / Math.abs(pmBefore)) * 100 : 0;
                resultType = premio > 0 ? 'profit' : premio < 0 ? 'loss' : 'neutral';
            } else {
                resultado = premio;
                resultadoPct = pmBefore > 0 ? (premio / Math.abs(pmBefore)) * 100 : 0;
                resultType = premio > 0 ? 'profit' : premio < 0 ? 'loss' : 'neutral';
            }

            perfRows.push({
                op, tipo, strike, premio, isEx,
                pmBefore, pmAfter, variation,
                resultado, resultadoPct, resultType,
                date: getOpDate(op)
            });
        });

        const profits = perfRows.filter(r => r.resultType === 'profit');
        const losses = perfRows.filter(r => r.resultType === 'loss');
        const neutrals = perfRows.filter(r => r.resultType === 'neutral');
        const totalResultado = perfRows.reduce((s, r) => s + r.resultado, 0);
        const bestOp = profits.length ? profits.reduce((a, b) => a.resultado > b.resultado ? a : b) : null;
        const worstOp = losses.length ? losses.reduce((a, b) => a.resultado < b.resultado ? a : b) : null;
        const hitRate = perfRows.length > 0 ? (profits.length / perfRows.length * 100) : 0;
        const maxResultado = Math.max(...perfRows.map(r => Math.abs(r.resultado)), 1);

        let html = '';

        html += `<div class="toc-perf-header">`;
        html += `<div class="toc-perf-title">📈 Análise de Performance por Operação</div>`;
        html += `<div class="toc-perf-stats">`;
        html += `<span class="toc-perf-stat"><span style="color:#4ade80">🟢</span> <span style="color:#4ade80">${profits.length} lucros</span></span>`;
        html += `<span class="toc-perf-stat"><span style="color:#f87171">🔴</span> <span style="color:#f87171">${losses.length} prejuízos</span></span>`;
        html += `<span class="toc-perf-stat"><span style="color:#fbbf24">🟡</span> <span style="color:#fbbf24">${neutrals.length} neutras</span></span>`;
        html += `<span class="toc-perf-stat">💰 Total: <strong style="color:${totalResultado >= 0 ? '#4ade80' : '#f87171'}">${totalResultado >= 0 ? '+' : ''}${fmtUsd(totalResultado)}</strong></span>`;
        html += `</div>`;
        html += `</div>`;

        html += `<div class="toc-perf-table-wrap">`;
        html += `<table class="toc-perf-table">`;
        html += `<thead><tr>`;
        html += `<th>📅 Data</th>`;
        html += `<th>🔄 Operação</th>`;
        html += `<th>🏷️ Tipo</th>`;
        html += `<th>📌 Status</th>`;
        html += `<th>💲 Entrada</th>`;
        html += `<th>📊 PM Antes</th>`;
        html += `<th>📈 PM Depois</th>`;
        html += `<th>📉 Variação</th>`;
        html += `<th>📊 Resultado</th>`;
        html += `<th>📊 Performance</th>`;
        html += `</tr></thead>`;
        html += `<tbody>`;

        const displayRows = [...perfRows].reverse();
        displayRows.forEach(r => {
            const d = r.date;
            const dataStr = d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-';
            const ativo = (r.op.ativo || '').toUpperCase().replace('USDT', '');
            const tipoBadge = r.tipo === 'CALL'
                ? '<span class="toc-perf-type toc-perf-type-call">CALL</span>'
                : '<span class="toc-perf-type toc-perf-type-put">PUT</span>';

            let statusHtml;
            if (r.isEx) {
                statusHtml = '<span class="toc-perf-dot toc-perf-dot-ex"></span> Exercida<span class="toc-perf-badge-ex">EXERCIDA</span>';
            } else if ((r.op.status || 'ABERTA').toUpperCase() === 'ABERTA') {
                statusHtml = '<span class="toc-perf-dot toc-perf-dot-open"></span> Aberta';
            } else {
                statusHtml = '<span class="toc-perf-dot toc-perf-dot-closed"></span> Fechada';
            }

            const variacaoCls = r.variation > 0 ? 'toc-perf-positive' : r.variation < 0 ? 'toc-perf-negative' : '';
            const variacaoIcon = r.variation > 0 ? '▲' : r.variation < 0 ? '▼' : '—';

            let resultBadge;
            if (r.resultType === 'profit') {
                resultBadge = r.resultado > 10
                    ? '<span class="toc-perf-badge toc-perf-badge-profit" style="background:#0a2a1a;border-color:#2a5a3a;">⭐ Lucro Alto</span>'
                    : '<span class="toc-perf-badge toc-perf-badge-profit">✅ Lucro</span>';
            } else if (r.resultType === 'loss') {
                resultBadge = '<span class="toc-perf-badge toc-perf-badge-loss">❌ Prejuízo</span>';
            } else {
                resultBadge = '<span class="toc-perf-badge toc-perf-badge-neutral">⬡ Neutro</span>';
            }

            const barPct = Math.max(5, Math.min(95, (Math.abs(r.resultado) / maxResultado) * 100));
            const barCls = r.resultType === 'profit' ? 'toc-perf-bar-profit' : r.resultType === 'loss' ? 'toc-perf-bar-loss' : 'toc-perf-bar-neutral';
            const resultadoVal = r.resultado !== 0
                ? `<span style="font-size:12px;color:${r.resultType === 'profit' ? '#4ade80' : r.resultType === 'loss' ? '#f87171' : '#94a3b8'};">${r.resultado >= 0 ? '+' : ''}${fmtUsd(r.resultado)}</span>`
                : '<span style="font-size:12px;color:#94a3b8;">—</span>';

            let rowStyle = '';
            if (r.isEx && r.tipo === 'PUT') rowStyle = 'background:rgba(251,146,60,0.05);';
            if (bestOp && r === bestOp) rowStyle = 'background:rgba(74,222,128,0.05);';

            html += `<tr style="${rowStyle}">`;
            html += `<td><strong>${dataStr}</strong>${bestOp && r === bestOp ? ' ⭐' : ''}</td>`;
            html += `<td>${r.tipo} ${ativo}</td>`;
            html += `<td>${tipoBadge}</td>`;
            html += `<td>${statusHtml}</td>`;
            html += `<td>${r.strike > 0 ? fmtUsd(r.strike) : '—'}</td>`;
            html += `<td>${r.pmBefore > 0 ? fmtUsd(r.pmBefore) : '—'}</td>`;
            html += `<td><strong style="color:#60a5fa">${r.pmAfter > 0 ? fmtUsd(r.pmAfter) : '—'}</strong></td>`;
            html += `<td class="${variacaoCls}">${variacaoIcon} ${r.variation !== 0 ? fmtUsd(Math.abs(r.variation)) : '—'}</td>`;
            html += `<td>${resultBadge}</td>`;
            html += `<td><div class="toc-perf-bar-track"><div class="toc-perf-bar-fill ${barCls}" style="width:${barPct}%"></div></div>${resultadoVal}</td>`;
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        html += `</div>`;

        // Summary chart
        html += `<div class="toc-perf-summary-chart">`;
        html += `<div class="toc-perf-chart-header">`;
        html += `<span class="toc-perf-chart-title">📊 Resumo de Performance</span>`;
        html += `<span class="toc-perf-chart-badge">${perfRows.length} operações</span>`;
        html += `</div>`;

        html += `<div class="toc-perf-mini-bars">`;
        displayRows.forEach(r => {
            const bh = Math.max(4, (Math.abs(r.resultado) / maxResultado) * 36);
            const cls = r.resultType === 'profit' ? 'toc-perf-mbar-profit' : r.resultType === 'loss' ? 'toc-perf-mbar-loss' : 'toc-perf-mbar-neutral';
            html += `<div class="toc-perf-mbar ${cls}" style="height:${bh}px" title="${r.date ? r.date.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'}) : ''}: ${r.resultado >= 0 ? '+' : ''}${fmtUsd(r.resultado)}"></div>`;
        });
        html += `</div>`;

        html += `<div class="toc-perf-chart-legend">`;
        html += `<span>📌 <strong style="color:#4ade80">Barras verdes</strong> = lucro</span>`;
        html += `<span>📌 <strong style="color:#f87171">Barras vermelhas</strong> = prejuízo</span>`;
        html += `<span>📌 <strong style="color:#fbbf24">Barras amarelas</strong> = neutro</span>`;
        html += `<span>📊 Altura = magnitude</span>`;
        if (bestOp) {
            const bestDate = bestOp.date ? bestOp.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
            html += `<span>⭐ <strong style="color:#fbbf24">Maior lucro:</strong> ${bestDate} ${fmtUsd(bestOp.resultado)}</span>`;
        }
        html += `</div>`;
        html += `</div>`;

        const putExercised = perfRows.filter(r => r.tipo === 'PUT' && r.isEx);
        const callExercised = perfRows.filter(r => r.tipo === 'CALL' && r.isEx);
        const callClosed = perfRows.filter(r => r.tipo === 'CALL' && !r.isEx);
        const putClosed = perfRows.filter(r => r.tipo === 'PUT' && !r.isEx);

        html += `<div class="toc-perf-summary-cards">`;
        html += `<div class="toc-perf-scard"><div class="toc-perf-scard-icon">📊</div><div class="toc-perf-scard-label">PUT Exercidas</div><div class="toc-perf-scard-value" style="color:#fbbf24">${putExercised.length}</div></div>`;
        html += `<div class="toc-perf-scard"><div class="toc-perf-scard-icon">📈</div><div class="toc-perf-scard-label">CALL Exercidas</div><div class="toc-perf-scard-value" style="color:#60a5fa">${callExercised.length}</div></div>`;
        html += `<div class="toc-perf-scard"><div class="toc-perf-scard-icon">🔄</div><div class="toc-perf-scard-label">CALL Fechadas</div><div class="toc-perf-scard-value" style="color:#22d3ee">${callClosed.length}</div></div>`;
        html += `<div class="toc-perf-scard"><div class="toc-perf-scard-icon">📉</div><div class="toc-perf-scard-label">PUT Fechadas</div><div class="toc-perf-scard-value" style="color:#a78bfa">${putClosed.length}</div></div>`;
        html += `</div>`;

        html += `<div class="toc-perf-highlights">`;
        if (bestOp) {
            const bestDate = bestOp.date ? bestOp.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
            html += `<span>⭐ <strong style="color:#fbbf24">Melhor operação:</strong> ${bestOp.tipo} em ${bestDate} com <strong style="color:#4ade80">+${fmtUsd(bestOp.resultado)}</strong></span>`;
        }
        if (worstOp) {
            const worstDate = worstOp.date ? worstOp.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
            html += `<span>⚠️ <strong style="color:#f87171">Pior operação:</strong> ${worstOp.tipo} em ${worstDate} com <strong style="color:#f87171">${fmtUsd(worstOp.resultado)}</strong></span>`;
        }
        html += `<span>📊 <strong style="color:#60a5fa">Taxa de acerto:</strong> ${hitRate.toFixed(0)}% (${profits.length}/${perfRows.length})</span>`;
        html += `<span>💰 <strong style="color:${totalResultado >= 0 ? '#4ade80' : '#f87171'}">Resultado líquido:</strong> ${totalResultado >= 0 ? '+' : ''}${fmtUsd(totalResultado)}</span>`;
        html += `</div>`;

        container.innerHTML = html;
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
        const isEx = isExercised(op);
        if (isEx) return '<span class="badge bg-red text-red-fg">SIM</span>';
        return '<span class="badge bg-green text-green-fg">NÃO</span>';
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

        // Destrói instância DataTable anterior (por referência e por verificação do DOM)
        const table = tbody.closest('table');
        if (_dtTable) {
            try { _dtTable.destroy(); } catch (e) {}
            _dtTable = null;
        }
        if (table && typeof $ !== 'undefined' && $.fn && $.fn.DataTable && $.fn.DataTable.isDataTable(table)) {
            try { $(table).DataTable().destroy(); } catch (e) {}
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
            if (table) {
                try {
                    _dtTable = $(table).DataTable({
                        pageLength: 10,
                        lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
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

    function renderAll(ops) {
        const stats = calcStats(ops);
        const monthlyRows = groupByMonth(ops);
        renderSummary(stats, monthlyRows);
        renderMonthly(monthlyRows);
        renderTimeline(ops);
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
            defaultPeriod: 'semana',
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

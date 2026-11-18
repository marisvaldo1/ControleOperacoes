/**
 * modal-preco-medio-ativo-opcoes.js
 * Raio-X do Preço Médio por ativo base (Opções) — paridade visual com
 * frontend/js/crypto/modal-preco-medio-ativo.js, adaptado ao domínio de opções:
 *  - Preço médio = média ponderada de preco_entrada pela quantidade das
 *    posições em ABERTO do ativo base (sem abertas: PM final líquido).
 *  - PM final líquido = (Σ entradas − Σ saídas) ÷ Σ contratos, incluindo
 *    fechamentos antecipados (preco_saida) e espelhos (op_fechamento).
 *  - Prêmio total da operação = premio × |quantidade| (BRL).
 *  - Sem APIs externas (sem Binance, sem /api/crypto/ultima-put-exercida):
 *    a "cotação" é o preco_atual registrado nas operações.
 *
 * API: window.ModalPrecoMedioAtivoOpcoes = { openModal, computeData }
 */
;(function () {
    'use strict';

    var modalData = null;
    var closeHandler = null;
    var chartRef = null;
    var currentAtivoBase = null;

    function brl(n) {
        return 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    var usd = brl; // alias: mesmas assinaturas do fonte crypto
    function pct(n) {
        return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    }
    function sgn(n) {
        return (n >= 0 ? '+' : '−') + brl(n);
    }
    function fmtDateBR(iso) {
        if (!iso) return '';
        var parts = String(iso).split('T')[0].split('-');
        if (parts.length < 3) return iso;
        return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // ── Convenções de domínio (opções) ─────────────────────────────────────
    function num(v) {
        if (typeof window.parseFloatSafe === 'function') return window.parseFloatSafe(v);
        return parseFloat(v) || 0;
    }
    function qtdOf(op) {
        return Math.abs(parseInt(op && op.quantidade, 10)) || 1;
    }
    // Prêmio total da operação = prêmio unitário × |quantidade|
    function premioTotal(op) {
        return num(op && op.premio) * qtdOf(op);
    }
    function custoOf(op) {
        return num(op && op.preco_entrada) * qtdOf(op);
    }
    function isOpen(op) {
        var s = String((op && op.status) || 'ABERTA').toUpperCase();
        return s === 'ABERTA' || s === 'ABERTO';
    }
    function isExercida(op) {
        return String((op && op.status) || '').toUpperCase() === 'EXERCIDA';
    }
    // Espelho de fechamento parcial (lado oposto lançado pelo fechar-antecipado)
    function isEspelho(op) {
        return !!(op && parseInt(op.op_fechamento, 10) > 0);
    }

    function getOps(ativoBase, opsOverride) {
        var source = Array.isArray(opsOverride)
            ? opsOverride
            : (window.opcoesOperacoes || window.allOperacoes || []);
        var key = String(ativoBase || '').toUpperCase().trim();
        return source.filter(function (o) {
            var a = String(o.ativo_base || o.ativo || '').toUpperCase().trim();
            return a === key;
        });
    }

    /**
     * computeData(ativoBase, cotacaoOverride, opsOverride, baseOpsOverride)
     * PM = Σ(preco_entrada × |qtd|) / Σ(|qtd|) sobre as posições em ABERTO
     * do ativo base; sem abertas, PM = pmFinal (líquido, entradas − saídas).
     * pmFinal considera preco_saida (fechamento total) e espelhos (parcial).
     */
    function computeData(ativoBase, cotacaoOverride, opsOverride, baseOpsOverride) {
        var ops = getOps(ativoBase, opsOverride);
        var baseOps = Array.isArray(baseOpsOverride) ? getOps(ativoBase, baseOpsOverride) : ops;

        var abertas  = ops.filter(isOpen);
        var normais  = ops.filter(function (o) { return !isEspelho(o); });
        var espelhos = ops.filter(isEspelho);
        var alvo = abertas.length ? abertas : normais; // sem abertas, calcula com todas (normais)

        var qtyTotal = 0;
        var custoTotal = 0;
        alvo.forEach(function (o) {
            qtyTotal += qtdOf(o);
            custoTotal += custoOf(o);
        });
        var pmAberto = qtyTotal > 0 ? custoTotal / qtyTotal : 0;

        // ── PM final líquido (entradas − saídas) ─────────────────────────
        // Cada operação normal entra com o total aberto (|qtd| + qtd_fechada
        // já realizada); as saídas entram por preco_saida (fechamento total)
        // e pelos espelhos (fechamento parcial, lado oposto).
        var entradasQty = 0, entradasValor = 0, saidasValor = 0, espelhoValor = 0;
        normais.forEach(function (o) {
            var q     = qtdOf(o);
            var qFech = Math.abs(parseInt(o.qtd_fechada, 10) || 0);
            entradasQty   += q + qFech;
            entradasValor += num(o.preco_entrada) * (q + qFech);
            var precoSaida = num(o.preco_saida);
            if (precoSaida > 0) saidasValor += precoSaida * q;
        });
        espelhos.forEach(function (o) {
            espelhoValor += num(o.preco_entrada) * qtdOf(o);
        });
        var pmFinal = entradasQty > 0 ? (entradasValor - saidasValor - espelhoValor) / entradasQty : 0;
        // Sem posições em aberto, o PM exibido passa a ser o líquido final
        var pm = abertas.length ? pmAberto : pmFinal;

        // Prêmios: posições em aberto (o que reduz o custo efetivo)
        var premiosSrc = abertas.length ? abertas : normais;
        var premios = premiosSrc.map(function (o) {
            return {
                rot: (o.tipo || '') + ' ' + (o.ativo || o.ativo_base || '') + ' — ' + (o.status || ''),
                v: premioTotal(o),
                data: o.data_operacao || o.created_at || '',
                exercida: isExercida(o),
            };
        }).filter(function (p) { return p.v > 0; }).sort(function (a, b) {
            return (b.data || '').localeCompare(a.data || '');
        });
        var totalPremios = premios.reduce(function (s, p) { return s + p.v; }, 0);

        // Cotação: média de preco_atual > 0 das operações do ativo (dado registrado)
        // Espelhos de fechamento são sintéticos — não distorcem a cotação.
        var cotacao = cotacaoOverride;
        if (!cotacao) {
            var cots = normais.map(function (o) { return num(o.preco_atual); })
                .filter(function (c) { return c > 0; });
            cotacao = cots.length ? cots.reduce(function (s, c) { return s + c; }, 0) / cots.length : 0;
        }

        // Lançamentos ordenados por data (evolução do PM no ledger — histórico completo)
        var lancamentos = normais.filter(function (o) {
            return num(o.preco_entrada) > 0;
        }).slice().sort(function (a, b) {
            var da = String(a.data_operacao || a.created_at || '');
            var db = String(b.data_operacao || b.created_at || '');
            return da.localeCompare(db);
        });

        // ── Lançamentos de fechamento (para o ledger) ─────────────────────
        // 1) Fechamento total: preco_saida gravado na própria operação.
        // 2) Fechamento parcial: espelho FECHADA com o lado oposto.
        var fechamentos = [];
        lancamentos.forEach(function (o) {
            var precoSaida = num(o.preco_saida);
            if (precoSaida > 0) {
                var ladoOrig = String(o.tipo_operacao || '').toUpperCase();
                fechamentos.push({
                    data: o.data_fechamento || o.data_operacao || o.created_at || '',
                    valor: precoSaida,
                    qtd: qtdOf(o),
                    lado: ladoOrig === 'VENDA' ? 'COMPRA' : 'VENDA',
                    tipo: o.tipo,
                    contrato: o.ativo || o.ativo_base || '',
                    resultado: num(o.resultado),
                });
            }
        });
        espelhos.forEach(function (m) {
            fechamentos.push({
                data: m.data_operacao || m.data_fechamento || m.created_at || '',
                valor: num(m.preco_entrada),
                qtd: qtdOf(m),
                lado: String(m.tipo_operacao || '').toUpperCase(),
                tipo: m.tipo,
                contrato: m.ativo || m.ativo_base || '',
                resultado: num(m.resultado),
            });
        });
        fechamentos.sort(function (a, b) {
            return String(a.data).localeCompare(String(b.data));
        });

        // Posição em aberto mais recente (strike/tipo de referência)
        var openOp = abertas.slice().sort(function (a, b) {
            var da = String(a.data_operacao || a.created_at || '');
            var db = String(b.data_operacao || b.created_at || '');
            return db.localeCompare(da);
        })[0] || lancamentos[lancamentos.length - 1] || null;

        return {
            ativo: ativoBase,
            custoTotal: custoTotal,
            qtyTotal: qtyTotal,
            pm: pm,
            pmFinal: pmFinal,
            fechamentos: fechamentos,
            premios: premios,
            totalPremios: totalPremios,
            lancamentos: lancamentos,
            cotacao: cotacao,
            strikeAberto: openOp ? num(openOp.strike) : 0,
            tipoAberto: openOp ? String(openOp.tipo || 'CALL').toUpperCase() : 'CALL',
            hasOpenOp: !!openOp && isOpen(openOp),
        };
    }

    function openModal(ativoBase, cotacaoOverride) {
        if (!ativoBase) return;
        currentAtivoBase = ativoBase;
        modalData = computeData(ativoBase, cotacaoOverride);
        var overlay = document.getElementById('pmOpOverlay');
        if (!overlay) return;
        build();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function refresh() {
        if (currentAtivoBase) openModal(currentAtivoBase);
    }

    function closeModal() {
        if (chartRef) { try { chartRef.destroy(); } catch (e) { /* noop */ } chartRef = null; }
        var overlay = document.getElementById('pmOpOverlay');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    function ensureBind() {
        if (closeHandler) return;
        closeHandler = true;
        var overlay = document.getElementById('pmOpOverlay');
        if (!overlay) return;
        var closeBtn = document.getElementById('pmOpClose');
        if (closeBtn) closeBtn.onclick = closeModal;
        var refreshBtn = document.getElementById('pmOpRefresh');
        if (refreshBtn) refreshBtn.onclick = refresh;
        overlay.onclick = function (e) { if (e.target === overlay) closeModal(); };
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    }

    // ── Ledger: evolução do PM a cada lançamento ───────────────────────────
    function buildSteps(d) {
        var steps = [];
        var runQty = 0;
        var runCost = 0;

        // Intercala entradas e fechamentos em ordem cronológica
        var eventos = [];
        (d.lancamentos || []).forEach(function (op) {
            eventos.push({ kind: 'entrada', op: op, data: op.data_operacao || op.created_at || '' });
        });
        (d.fechamentos || []).forEach(function (f) {
            eventos.push({ kind: 'fechamento', f: f, data: f.data || '' });
        });
        eventos.sort(function (a, b) {
            var c = String(a.data).localeCompare(String(b.data));
            if (c !== 0) return c;
            // Empate de data: entrada antes do fechamento correspondente
            return (a.kind === 'entrada' ? 0 : 1) - (b.kind === 'entrada' ? 0 : 1);
        });

        eventos.forEach(function (ev) {
            if (ev.kind === 'entrada') {
                var op = ev.op;
                // Entrada conta o total aberto (restante + já fechado parcialmente)
                var qFech = Math.abs(parseInt(op.qtd_fechada, 10) || 0);
                var q = qtdOf(op) + qFech;
                var before = runQty > 0 ? runCost / runQty : 0;
                runQty += q;
                runCost += num(op.preco_entrada) * q;
                var after = runQty > 0 ? runCost / runQty : 0;
                steps.push({
                    rot: (op.tipo || '') + ' ' + (op.ativo || op.ativo_base || '') + ' — ' + (op.status || ''),
                    v: num(op.premio) * q,
                    type: steps.length === 0 ? 'in' : (after <= before ? 'down' : 'up'),
                    before: before,
                    after: after,
                    data: ev.data,
                    tipo: String(op.tipo || '').toUpperCase(),
                    top: String(op.tipo_operacao || '').toUpperCase(),
                    contrato: op.ativo || op.ativo_base || '',
                    status: String(op.status || '').toUpperCase(),
                    exercida: isExercida(op),
                });
            } else {
                var f = ev.f;
                var beforeF = runQty > 0 ? runCost / runQty : 0;
                runCost -= f.valor * f.qtd; // saída reduz o custo líquido
                var afterF = runQty > 0 ? runCost / runQty : beforeF;
                steps.push({
                    rot: 'FECHAMENTO',
                    v: f.valor * f.qtd,
                    type: 'fech',
                    before: beforeF,
                    after: afterF,
                    data: f.data,
                    tipo: String(f.tipo || '').toUpperCase(),
                    top: String(f.lado || '').toUpperCase(),
                    contrato: f.contrato || '',
                    status: 'FECHADA',
                    exercida: false,
                    resultado: f.resultado || 0,
                });
            }
        });
        steps.push({ rot: 'PREÇO MÉDIO FINAL', v: d.pmFinal, type: 'out', before: 0, after: d.pmFinal, data: '' });
        return steps;
    }

    function drawChart(steps) {
        var canvas = document.getElementById('pmOpChart');
        if (!canvas) return;
        if (chartRef) { try { chartRef.destroy(); } catch (e) { /* noop */ } chartRef = null; }
        if (typeof Chart === 'undefined') return;

        var labels = [];
        var pmValues = [];
        var impactValues = [];
        var impactColors = [];

        steps.forEach(function (s) {
            if (s.type === 'in') {
                labels.push('Entrada');
                pmValues.push(s.after);
                impactValues.push(0);
                impactColors.push('rgba(34,197,94,.55)');
            } else if (s.type === 'out') {
                labels.push('PM Atual');
                pmValues.push(s.after);
                impactValues.push(0);
                impactColors.push('rgba(34,197,94,.55)');
            } else if (s.type === 'fech') {
                var lblFech = s.data ? s.data.substring(8, 10) + '/' + s.data.substring(5, 7) : '#';
                var impactFech = s.after - s.before;
                labels.push(lblFech);
                pmValues.push(s.after);
                impactValues.push(Number(impactFech.toFixed(2)));
                // Cor por resultado realizado do fechamento
                impactColors.push((s.resultado || 0) >= 0 ? 'rgba(34,197,94,.55)' : 'rgba(239,68,68,.55)');
            } else {
                var lbl = s.data ? s.data.substring(8, 10) + '/' + s.data.substring(5, 7) : '#';
                var impact = s.after - s.before;
                labels.push(lbl);
                pmValues.push(s.after);
                impactValues.push(Number(impact.toFixed(2)));
                impactColors.push(impact <= 0 ? 'rgba(34,197,94,.55)' : 'rgba(239,68,68,.55)');
            }
        });

        chartRef = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Impacto no PM',
                        data: impactValues,
                        backgroundColor: impactColors,
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.55,
                        yAxisID: 'yImpact',
                        order: 2,
                    },
                    {
                        label: 'Saldo (PM)',
                        data: pmValues,
                        type: 'line',
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245,158,11,.12)',
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        borderWidth: 2.5,
                        tension: 0.3,
                        fill: false,
                        yAxisID: 'yPm',
                        order: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#7890b0',
                            font: { size: 10, weight: '600' },
                            boxWidth: 14,
                            boxHeight: 10,
                            padding: 14,
                            usePointStyle: true,
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(13,17,23,.92)',
                        titleColor: '#e6edf3',
                        bodyColor: '#e6edf3',
                        borderColor: 'rgba(255,255,255,.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function (c) {
                                if (c.dataset.label === 'Saldo (PM)') {
                                    return 'Saldo: R$ ' + c.raw.toFixed(2);
                                }
                                return c.raw > 0 ? 'Impacto: +R$ ' + c.raw.toFixed(2)
                                    : (c.raw < 0 ? 'Impacto: −R$ ' + Math.abs(c.raw).toFixed(2) : '');
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: '#7890b0', font: { size: 10 } },
                        grid: { display: false },
                    },
                    yPm: {
                        position: 'left',
                        title: { display: true, text: 'Saldo (PM)', color: '#f59e0b', font: { size: 10, weight: '600' } },
                        ticks: {
                            color: '#f59e0b',
                            font: { size: 9 },
                            callback: function (v) { return 'R$ ' + v.toFixed(0); },
                        },
                        grid: { color: 'rgba(255,255,255,.04)' },
                    },
                    yImpact: {
                        position: 'right',
                        title: { display: true, text: 'Impacto', color: '#22c55e', font: { size: 10, weight: '600' } },
                        ticks: {
                            color: '#22c55e',
                            font: { size: 9 },
                            callback: function (v) { return 'R$ ' + v.toFixed(0); },
                        },
                        grid: { drawOnChartArea: false },
                    },
                },
            },
        });
    }

    function drawLedger(steps) {
        var html = '';
        steps.forEach(function (s) {
            var isLast = s.type === 'out';
            var dataStr = s.data ? s.data.substring(8, 10) + '/' + s.data.substring(5, 7) : '';
            var valorStr;
            var saldoStr = brl(s.after);

            var opHtml;
            if (s.type === 'out') {
                opHtml = '<span class="pm-badge final">Preço Médio final</span>';
                valorStr = '';
            } else if (s.type === 'fech') {
                var resFech = s.resultado || 0;
                opHtml = '<span class="pm-badge final">FECHAMENTO</span> ' +
                    '<span class="pm-badge pm-badge-sm ' + (s.tipo === 'PUT' ? 'put' : 'call') + '">' + escapeHtml(s.tipo || 'OP') + '</span> ' +
                    '<span class="pm-op-asset">' + escapeHtml(s.contrato || '') + '</span> ' +
                    '<span class="pm-badge pm-badge-sm final" title="Lado do fechamento">' + escapeHtml(s.top || '') + '</span> ' +
                    '<span class="pm-badge pm-badge-sm fechada">FECHADA</span> ' +
                    '<span class="pm-badge pm-badge-sm ' + (resFech >= 0 ? 'fechada' : 'exercida') + '" title="Resultado realizado">' +
                    (resFech >= 0 ? '+' : '−') + brl(resFech) + '</span>';
                valorStr = '−' + brl(s.v);
            } else {
                var tipoBadge = s.tipo === 'PUT' ? 'put' : 'call';
                var statusBadge = s.status === 'ABERTA' ? 'aberta' : 'fechada';
                var exercidaBadge = s.exercida
                    ? ' <span class="pm-badge pm-badge-sm exercida" title="Opção exercida">EXERCIDA</span>'
                    : '';
                var topBadge = s.top === 'COMPRA'
                    ? ' <span class="pm-badge pm-badge-sm final" title="Compra de opção (pagou prêmio)">COMPRA</span>'
                    : '';
                opHtml = '<span class="pm-badge ' + tipoBadge + '">' + escapeHtml(s.tipo || 'OP') + '</span> ' +
                    '<span class="pm-op-asset">' + escapeHtml(s.contrato || '') + '</span> ' +
                    '<span class="pm-badge pm-badge-sm ' + statusBadge + '">' + escapeHtml(s.status || '') + '</span>' +
                    exercidaBadge + topBadge;
                valorStr = (s.top === 'COMPRA' ? '+' : '−') + brl(s.v);
            }

            html += '<tr class="' + (isLast ? 'pm-final-row' : '') + (s.exercida ? ' pm-exercida-row' : '') + '">' +
                '<td>' + dataStr + '</td>' +
                '<td>' + opHtml + '</td>' +
                '<td class="pm-valor">' + valorStr + '</td>' +
                '<td class="pm-saldo"' + (s.type === 'in' ? ' style="color:#3b82f6;font-weight:700"' : '') + '>' + saldoStr + '</td>' +
                '</tr>';
        });
        var el = document.getElementById('pmOpLedgerBody');
        if (el) el.innerHTML = html;
    }

    function build() {
        var d = modalData;
        if (!d) return;
        ensureBind();

        var hdTitleAsset = document.getElementById('pmOpHdTitleAsset');
        if (hdTitleAsset) hdTitleAsset.textContent = '· ' + d.ativo;

        var steps = buildSteps(d);
        var vsPm = d.cotacao && d.pm ? ((d.cotacao - d.pm) / d.pm) * 100 : null;
        var resExerc = d.strikeAberto && d.pm ? d.strikeAberto - d.pm : null;
        var dist = d.cotacao && d.strikeAberto ? ((d.cotacao - d.strikeAberto) / d.strikeAberto) * 100 : null;

        var cotTip = function () {
            return {
                type: 'default',
                title: 'Cotação',
                lines: [
                    { key: '📊 Preço atual registrado no ' + d.ativo },
                    { key: 'Fonte: cotação manual da operação' },
                ],
            };
        };

        var pmTip = function () {
            if (!d.pm) {
                return { type: 'default', title: 'Preço Médio', lines: [{ key: 'Indisponível' }] };
            }
            return {
                type: 'default',
                title: d.hasOpenOp ? 'Preço Médio (posições em aberto)' : 'Preço Médio (= PM final líquido)',
                lines: [
                    { key: 'Média ponderada do preço de entrada pela quantidade' },
                ],
                formula: 'Fórmula: Σ(preço de entrada × quantidade) ÷ Σ(quantidade)<br>' +
                    'Custo: ' + brl(d.custoTotal) + '<br>' +
                    'Quantidade: ' + d.qtyTotal + '<br>' +
                    'Resultado: ' + brl(d.pm),
                note: d.hasOpenOp
                    ? 'Só considera as posições em aberto do ativo base.'
                    : 'Sem posições em aberto: vale o PM final líquido.',
            };
        };

        var entradaTip = function () {
            if (!d.custoTotal) {
                return { type: 'default', title: 'Custo em aberto', lines: [{ key: 'Nenhuma posição em aberto' }] };
            }
            return {
                type: 'default',
                title: 'Custo em aberto',
                lines: [
                    { key: 'Soma de preço de entrada × quantidade das posições abertas' },
                    { key: 'Total', value: brl(d.custoTotal) },
                    { key: 'Quantidade', value: String(d.qtyTotal) },
                ],
                note: 'Base do cálculo do preço médio.',
            };
        };

        var premiosTip = function () {
            if (d.totalPremios <= 0) {
                return { type: 'default', title: 'Prêmios acumulados', lines: [{ key: 'Nenhum prêmio nas posições abertas' }] };
            }
            return {
                type: 'default',
                title: 'Prêmios acumulados',
                lines: [
                    { key: 'Soma dos prêmios das posições em aberto' },
                    { key: 'Total', value: brl(d.totalPremios) },
                    { key: 'Operações', value: d.premios.length + ' lançamento' + (d.premios.length !== 1 ? 's' : '') },
                ],
                note: 'Prêmio total = prêmio unitário × quantidade.',
            };
        };

        var pmFinalTip = function () {
            if (!d.pmFinal) {
                return { type: 'default', title: 'PM final líquido', lines: [{ key: 'Indisponível' }] };
            }
            return {
                type: 'default',
                title: 'PM final líquido',
                lines: [
                    { key: 'Preço médio efetivo por contrato: entradas − saídas' },
                    { key: 'Inclui os fechamentos antecipados (total e parcial)' },
                ],
                formula: '(Σ entradas − Σ saídas) ÷ Σ contratos abertos<br>' +
                    'Resultado: ' + brl(d.pmFinal),
                note: d.hasOpenOp
                    ? 'Com posição em aberto, o box "Preço Médio" mostra somente as posições abertas.'
                    : 'Posição zerada: o PM exibido já é o líquido final.',
            };
        };

        var vsPmTip = function () {
            if (!d.cotacao || !d.pm) {
                return { type: 'default', title: 'Cotação vs PM', lines: [{ key: 'Indisponível' }] };
            }
            return {
                type: 'default',
                title: 'Cotação vs PM',
                lines: [
                    { key: 'Quanto a cotação está acima (ou abaixo) do PM' },
                ],
                formula: '(Cotação − PM) / PM × 100<br>' +
                    '(' + brl(d.cotacao) + ' − ' + brl(d.pm) + ') / ' + brl(d.pm) + ' × 100<br>' +
                    'Resultado: ' + pct(vsPm),
                note: 'Quanto maior, mais "segura" a posição.',
            };
        };

        var resExercTip = function () {
            if (!d.strikeAberto || !d.pm) {
                return { type: 'default', title: 'Resultado se exercido', lines: [{ key: 'Sem opção aberta ou sem PM' }] };
            }
            return {
                type: 'default',
                title: 'Resultado se exercido',
                lines: [
                    { key: 'Diferença entre o strike da ' + d.tipoAberto + ' (strike ' + brl(d.strikeAberto) + ') e o PM' },
                ],
                formula: 'Strike − PM<br>' +
                    brl(d.strikeAberto) + ' − ' + brl(d.pm) + '<br>' +
                    'Resultado: ' + sgn(resExerc),
                note: 'O PM já desconta todos os prêmios colhidos.',
            };
        };

        var distTip = function () {
            if (!d.cotacao || !d.strikeAberto) {
                return { type: 'default', title: 'Distância Strike', lines: [{ key: 'Indisponível' }] };
            }
            return {
                type: 'default',
                title: 'Distância Strike',
                lines: [
                    { key: 'Distância da cotação até o strike da ' + d.tipoAberto },
                ],
                formula: '(Cotação − Strike) / Strike × 100<br>' +
                    '(' + brl(d.cotacao) + ' − ' + brl(d.strikeAberto) + ') / ' + brl(d.strikeAberto) + ' × 100<br>' +
                    'Resultado: ' + pct(dist),
                note: dist < 0
                    ? 'Negativo = cotação abaixo do strike = ' + d.tipoAberto + ' fora do dinheiro (OTM, segura).'
                    : 'Positivo = cotação acima do strike = ' + d.tipoAberto + ' dentro do dinheiro (ITM, risco de exercício).',
            };
        };

        var body = document.getElementById('pmOpBody');
        if (!body) return;

        body.innerHTML =
            '<div class="pm-summary-row">' +
                '<div class="pm-stat-box" data-tip="pm"><div class="lbl">Preço Médio</div><div class="val" style="color:var(--pm-amber)">' + brl(d.pm) + '</div></div>' +
                '<div class="pm-stat-box" data-tip="pmFinal"><div class="lbl">PM final líquido</div><div class="val" style="color:var(--pm-green)">' + brl(d.pmFinal) + '</div></div>' +
                '<div class="pm-stat-box" data-tip="entrada"><div class="lbl">Custo em aberto</div><div class="val" style="color:var(--pm-blue)">' + brl(d.custoTotal) + '</div></div>' +
                '<div class="pm-stat-box" data-tip="premios"><div class="lbl">Prêmios acumulados</div><div class="val" style="color:var(--pm-green)">' + brl(d.totalPremios) + '</div></div>' +
            '</div>' +
            '<div class="pm-panel">' +
                '<div class="pm-panel-title">' +
                    '<span>' + (d.hasOpenOp ? 'Evolução do custo × Lançamentos (aberto: ' + d.tipoAberto + ' ' + brl(d.strikeAberto) + ')' : 'Evolução do custo × Lançamentos') + '</span>' +
                '</div>' +
                '<div class="pm-chart-ledger-grid">' +
                    '<div class="pm-chart-wrap"><canvas id="pmOpChart"></canvas></div>' +
                    '<div class="pm-ledger-scroll">' +
                        '<table class="pm-ledger">' +
                            '<thead><tr><th>Data</th><th>Operação</th><th>Valor</th><th>Saldo (PM)</th></tr></thead>' +
                            '<tbody id="pmOpLedgerBody"></tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="pm-summary-row">' +
                '<div class="pm-stat-box" data-tip="cot"><div class="lbl">📊 Cotação</div><div class="val" style="color:var(--pm-blue)">' + brl(d.cotacao) + '</div></div>' +
                '<div class="pm-stat-box ' + (vsPm !== null && vsPm >= 0 ? 'g' : '') + '" data-tip="vsPm"><div class="lbl">📈 Cotação vs PM</div><div class="val">' + (vsPm !== null ? pct(vsPm) : '—') + '</div></div>' +
                '<div class="pm-stat-box ' + (resExerc !== null && resExerc >= 0 ? 'g' : '') + '" data-tip="resExerc"><div class="lbl">💰 Resultado se exercido</div><div class="val">' + (resExerc !== null ? sgn(resExerc) : '—') + '</div></div>' +
                '<div class="pm-stat-box" data-tip="dist"><div class="lbl">📏 Distância strike</div><div class="val">' + (dist !== null ? pct(dist) : '—') + '</div></div>' +
            '</div>';

        var tipMap = { pm: pmTip, pmFinal: pmFinalTip, entrada: entradaTip, premios: premiosTip, cot: cotTip, vsPm: vsPmTip, resExerc: resExercTip, dist: distTip };
        body.querySelectorAll('.pm-stat-box[data-tip]').forEach(function (box) {
            var key = box.getAttribute('data-tip');
            var configFn = tipMap[key];
            if (!configFn) return;
            box.addEventListener('mouseenter', function () {
                var config = configFn();
                if (config && window.SharedTooltip) window.SharedTooltip.show(box, config);
            });
            box.addEventListener('mouseleave', function () { if (window.SharedTooltip) window.SharedTooltip.hide(); });
        });

        drawLedger(steps);
        if (typeof Chart !== 'undefined') {
            drawChart(steps);
        }
    }

    function init() {
        var container = document.getElementById('modalPrecoMedioAtivoContainer');
        if (!container) return;
        fetch('../html/modal-preco-medio-ativo-opcoes.html', { cache: 'no-store' })
            .then(function (r) { return r.text(); })
            .then(function (html) {
                container.innerHTML = html;
            })
            .catch(function () { /* noop */ });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ModalPrecoMedioAtivoOpcoes = { openModal: openModal, computeData: computeData, refresh: refresh };
})();

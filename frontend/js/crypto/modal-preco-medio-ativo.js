;(function () {
    'use strict';

    var usd = function (n) {
        return 'US$ ' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    var pct = function (n) {
        return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    };
    var sgn = function (n) {
        return (n >= 0 ? '+' : '−') + usd(n);
    };

    var modalData = null;
    var closeHandler = null;
    var chartRef = null;

    function getOps(par, opsOverride) {
        var source = Array.isArray(opsOverride) ? opsOverride : (window.cryptoOperacoes || []);
        return source.filter(function (o) {
            var a = (o.ativo || '').toUpperCase().replace('USDT', '').replace('/', '').trim();
            return a === par.toUpperCase();
        });
    }

    function isPositiveExerciseStatus(value) {
        var normalized = String(value == null ? '' : value).toUpperCase().trim();
        return ['SIM', 'S', 'YES', 'Y', 'TRUE', '1', 'EXERCIDA', 'EXERCIDO', 'EXERCISED'].indexOf(normalized) !== -1;
    }

    function isExercisedPut(op) {
        if ((op.status || '').toUpperCase() === 'ABERTA') return false;
        if ((op.tipo || '').toUpperCase() !== 'PUT') return false;

        if (window.CryptoExerciseStatus && typeof window.CryptoExerciseStatus.isActuallyExercised === 'function') {
            return window.CryptoExerciseStatus.isActuallyExercised(op);
        }

        var resolvedStatus = window.CryptoExerciseStatus && typeof window.CryptoExerciseStatus.resolveDisplayStatus === 'function'
            ? window.CryptoExerciseStatus.resolveDisplayStatus(op)
            : null;
        return isPositiveExerciseStatus(resolvedStatus) || isPositiveExerciseStatus(op.exercicio_status);
    }

    function computeData(par, cotacaoOverride, opsOverride, baseOpsOverride) {
        var ops = getOps(par, opsOverride);
        var baseOps = getOps(par, baseOpsOverride);
        if (!Array.isArray(baseOpsOverride)) baseOps = ops;

        var putsExercidas = baseOps.filter(isExercisedPut);
        var ultimaPut = putsExercidas.length
            ? putsExercidas.sort(function (a, b) {
                var aTime = window.CryptoExerciseStatus?.getOperationDate?.(a)?.getTime?.() || 0;
                var bTime = window.CryptoExerciseStatus?.getOperationDate?.(b)?.getTime?.() || 0;
                return bTime - aTime;
            })[0]
            : null;

        var strikeBase = ultimaPut
            ? parseFloat(ultimaPut.strike || 0)
            : parseFloat(baseOps.reduce(function (max, o) {
                return parseFloat(o.strike || 0) > parseFloat(max.strike || 0) ? o : max;
            }, baseOps[0])?.strike || 0);

        var cicloDate = ultimaPut
            ? (ultimaPut.exercicio || ultimaPut.data_operacao || '')
            : '';

        var allPremios = ops.map(function (o) {
            return {
                rot: (o.tipo || '') + ' ' + (o.ativo || '') + ' — ' + (o.status || ''),
                v: parseFloat(o.premio_us || 0),
                data: o.exercicio || o.data_operacao || '',
            };
        }).filter(function (p) { return p.v > 0; }).sort(function (a, b) {
            return (b.data || '').localeCompare(a.data || '');
        });

        var premios = cicloDate
            ? allPremios.filter(function (p) {
                return p.data >= cicloDate;
            })
            : allPremios;

        var totalPremios = premios.reduce(function (s, p) { return s + p.v; }, 0);
        var pm = strikeBase - totalPremios;

        var cotacao = cotacaoOverride || parseFloat(ops.find(function (o) {
            return parseFloat(o.cotacao_atual || 0) > 0;
        })?.cotacao_atual || 0);

        var openOp = ops.find(function (o) { return (o.status || '').toUpperCase() === 'ABERTA'; });
        var strikeAberto = openOp ? parseFloat(openOp.strike || 0) : 0;
        var tipoAberto = openOp ? (openOp.tipo || 'CALL').toUpperCase() : 'CALL';

        return {
            ativo: par,
            ultimoExercicio: strikeBase,
            premios: premios,
            totalPremios: totalPremios,
            pm: pm,
            cotacao: cotacao,
            strikeAberto: strikeAberto,
            tipoAberto: tipoAberto,
            hasOpenOp: !!openOp,
        };
    }

    function openModal(par, cotacaoOverride) {
        if (!par) return;
        modalData = computeData(par, cotacaoOverride);
        var overlay = document.getElementById('pmOverlay');
        if (!overlay) return;
        build();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (chartRef) { try { chartRef.destroy(); } catch (e) {} chartRef = null; }
        var overlay = document.getElementById('pmOverlay');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    function ensureBind() {
        if (closeHandler) return;
        closeHandler = true;
        var overlay = document.getElementById('pmOverlay');
        if (!overlay) return;
        var closeBtn = document.getElementById('pmClose');
        if (closeBtn) closeBtn.onclick = closeModal;
        overlay.onclick = function (e) { if (e.target === overlay) closeModal(); };
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    }

    function buildSteps(d) {
        var run = d.ultimoExercicio;
        var steps = [{
            rot: 'Preço de entrada (PUT exercida)',
            v: d.ultimoExercicio,
            type: 'in',
            before: 0,
            after: d.ultimoExercicio,
            data: '',
        }];
        d.premios.forEach(function (p) {
            var b = run;
            run -= p.v;
            steps.push({
                rot: p.rot,
                v: p.v,
                type: 'down',
                before: b,
                after: run,
                data: p.data,
            });
        });
        steps.push({ rot: 'PREÇO MÉDIO ATUAL', v: d.pm, type: 'out', before: 0, after: d.pm, data: '' });
        return steps;
    }

    function drawChart(steps) {
        var canvas = document.getElementById('pmChart');
        if (!canvas) return;
        if (chartRef) { try { chartRef.destroy(); } catch (e) {} chartRef = null; }
        if (typeof Chart === 'undefined') return;

        var labels = [];
        var pmValues = [];
        var impactValues = [];

        steps.forEach(function (s, i) {
            if (s.type === 'in') {
                labels.push('Entrada');
                pmValues.push(s.after);
                impactValues.push(0);
            } else if (s.type === 'down') {
                var lbl = s.data ? s.data.substring(8, 10) + '/' + s.data.substring(5, 7) : '#' + i;
                labels.push(lbl);
                pmValues.push(s.after);
                impactValues.push(s.v);
            } else {
                labels.push('PM Atual');
                pmValues.push(s.after);
                impactValues.push(0);
            }
        });

        chartRef = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Impacto do lançamento',
                        data: impactValues,
                        backgroundColor: 'rgba(34,197,94,.55)',
                        borderColor: 'rgba(34,197,94,.8)',
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
                    }
                ]
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
                        }
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
                                    return 'Saldo: US$ ' + c.raw.toFixed(2);
                                }
                                return c.raw > 0 ? 'Impacto: −US$ ' + c.raw.toFixed(2) : '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#7890b0', font: { size: 10 } },
                        grid: { display: false }
                    },
                    yPm: {
                        position: 'left',
                        title: { display: true, text: 'Saldo (PM)', color: '#f59e0b', font: { size: 10, weight: '600' } },
                        ticks: {
                            color: '#f59e0b',
                            font: { size: 9 },
                            callback: function (v) { return '$' + v.toFixed(0); }
                        },
                        grid: { color: 'rgba(255,255,255,.04)' }
                    },
                    yImpact: {
                        position: 'right',
                        title: { display: true, text: 'Impacto', color: '#22c55e', font: { size: 10, weight: '600' } },
                        ticks: {
                            color: '#22c55e',
                            font: { size: 9 },
                            callback: function (v) { return '$' + v.toFixed(0); }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    function drawLedger(steps) {
        var html = '';
        steps.forEach(function (s) {
            var isLast = s.type === 'out';
            var dataStr = s.data ? s.data.substring(8, 10) + '/' + s.data.substring(5, 7) : '';
            var valorStr, saldoStr = usd(s.after);

            var opHtml;
            if (s.type === 'in') {
                opHtml = '<span class="pm-badge put">Entrada</span> <span class="pm-op-asset">PUT</span>';
                valorStr = '';
            } else if (s.type === 'out') {
                opHtml = '<span class="pm-badge final">Preço Médio final</span>';
                valorStr = '';
            } else {
                var parts = s.rot.split(' — ');
                var left = parts[0] || s.rot;
                var statusStr = parts[1] || '';
                var sp = left.indexOf(' ');
                var tipo = sp > 0 ? left.substring(0, sp) : '';
                var ativo = sp > 0 ? left.substring(sp + 1) : left;
                var tipoBadge = tipo === 'PUT' ? 'put' : 'call';
                var statusBadge = statusStr === 'ABERTA' ? 'aberta' : 'fechada';
                opHtml = '<span class="pm-badge ' + tipoBadge + '">' + tipo + '</span> ' +
                    '<span class="pm-op-asset">' + ativo + '</span> ' +
                    (statusStr ? '<span class="pm-badge pm-badge-sm ' + statusBadge + '">' + statusStr + '</span>' : '');
                valorStr = '−' + usd(s.v);
            }

            html += '<tr class="' + (isLast ? 'pm-final-row' : '') + '">' +
                '<td>' + dataStr + '</td>' +
                '<td>' + opHtml + '</td>' +
                '<td class="pm-valor">' + valorStr + '</td>' +
                '<td class="pm-saldo"' + (s.type === 'in' ? ' style="color:#3b82f6;font-weight:700"' : '') + '>' + saldoStr + '</td>' +
                '</tr>';
        });
        var el = document.getElementById('pmLedgerBody');
        if (el) el.innerHTML = html;
    }

    function build() {
        var d = modalData;
        if (!d) return;
        ensureBind();

        var hdPm = document.getElementById('hdPm');
        if (hdPm) hdPm.textContent = usd(d.pm);
        var hdAsset = document.getElementById('hdAsset');
        if (hdAsset) hdAsset.textContent = d.ativo;
        var hdTitleAsset = document.getElementById('hdTitleAsset');
        if (hdTitleAsset) hdTitleAsset.textContent = '· ' + d.ativo;

        var steps = buildSteps(d);
        var vsPm = d.cotacao && d.pm ? ((d.cotacao - d.pm) / d.pm) * 100 : null;
        var resExerc = d.strikeAberto && d.pm ? d.strikeAberto - d.pm : null;
        var dist = d.cotacao && d.strikeAberto ? ((d.cotacao - d.strikeAberto) / d.strikeAberto) * 100 : null;

        var body = document.getElementById('pmBody');
        if (!body) return;

        body.innerHTML =
            '<div class="pm-summary-row">' +
                '<div class="pm-stat-box"><div class="lbl">Preço Médio</div><div class="val" style="color:var(--pm-amber)">' + usd(d.pm) + '</div></div>' +
                '<div class="pm-stat-box"><div class="lbl">Entrada (PUT)</div><div class="val" style="color:var(--pm-blue)">' + usd(d.ultimoExercicio) + '</div></div>' +
                '<div class="pm-stat-box"><div class="lbl">Prêmios acumulados</div><div class="val" style="color:var(--pm-green)">−' + usd(d.totalPremios) + '</div></div>' +
            '</div>' +
            '<div class="pm-panel">' +
                '<div class="pm-panel-title">' +
                    '<span>' + (d.hasOpenOp ? 'Evolução do custo × Lançamentos (aberto: ' + d.tipoAberto + ' ' + usd(d.strikeAberto) + ')' : 'Evolução do custo × Lançamentos') + '</span>' +
                '</div>' +
                '<div class="pm-chart-ledger-grid">' +
                    '<div class="pm-chart-wrap"><canvas id="pmChart"></canvas></div>' +
                    '<div class="pm-ledger-scroll">' +
                        '<table class="pm-ledger">' +
                            '<thead><tr><th>Data</th><th>Operação</th><th>Valor</th><th>Saldo (PM)</th></tr></thead>' +
                            '<tbody id="pmLedgerBody"></tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="pm-summary-row">' +
                '<div class="pm-stat-box"><div class="lbl">Cotação</div><div class="val" style="color:var(--pm-blue)">' + usd(d.cotacao) + '</div></div>' +
                '<div class="pm-stat-box ' + (vsPm !== null && vsPm >= 0 ? 'g' : '') + '"><div class="lbl">vs PM</div><div class="val">' + (vsPm !== null ? pct(vsPm) : '—') + '</div></div>' +
                '<div class="pm-stat-box ' + (resExerc !== null && resExerc >= 0 ? 'g' : '') + '"><div class="lbl">Resultado se exercido</div><div class="val">' + (resExerc !== null ? sgn(resExerc) : '—') + '</div></div>' +
                '<div class="pm-stat-box"><div class="lbl">Distância strike</div><div class="val">' + (dist !== null ? pct(dist) : '—') + '</div></div>' +
            '</div>';

        drawLedger(steps);
        if (typeof Chart !== 'undefined') {
            drawChart(steps);
        }
    }

    function init() {
        var container = document.getElementById('modalPrecoMedioAtivoContainer');
        if (!container) return;
        fetch('modal-preco-medio-ativo.html', { cache: 'no-store' })
            .then(function (r) { return r.text(); })
            .then(function (html) {
                container.innerHTML = html;
            })
            .catch(function () {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ModalPrecoMedioAtivo = { openModal: openModal, computeData: computeData };
})();

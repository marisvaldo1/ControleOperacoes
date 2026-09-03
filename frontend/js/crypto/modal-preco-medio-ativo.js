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
    var fmtDateBR = function (iso) {
        if (!iso) return '';
        var parts = String(iso).split('T')[0].split('-');
        if (parts.length < 3) return iso;
        return parts[2] + '/' + parts[1] + '/' + parts[0];
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
        var s = (op.status || '').toUpperCase();
        var t = (op.tipo || '').toUpperCase();
        if (s === 'ABERTA') { return false; }
        if (t !== 'PUT') { return false; }

        var result;
        if (window.CryptoExerciseStatus && typeof window.CryptoExerciseStatus.isActuallyExercised === 'function') {
            result = window.CryptoExerciseStatus.isActuallyExercised(op);
        } else {
            var resolvedStatus = window.CryptoExerciseStatus && typeof window.CryptoExerciseStatus.resolveDisplayStatus === 'function'
                ? window.CryptoExerciseStatus.resolveDisplayStatus(op)
                : null;
            result = isPositiveExerciseStatus(resolvedStatus) || isPositiveExerciseStatus(op.exercicio_status);
        }
        if (t === 'PUT' && s !== 'ABERTA') {
            // // console.log('[PM-Debug] isExercisedPut op=' + op.id + ' tipo=' + t + ' status=' + s + ' exercicio_status=' + op.exercicio_status + ' persistido=' + op.exercicio_status_persistido + ' CryptoES=' + !!window.CryptoExerciseStatus + ' => ' + result);
        }
        return result;
    }

    function computeData(par, cotacaoOverride, opsOverride, baseOpsOverride) {
        var ops = getOps(par, opsOverride);
        var baseOps = getOps(par, baseOpsOverride);
        if (!Array.isArray(opsOverride)) baseOps = ops;

        // // console.log('[PM-Debug] par=' + par + ' totalOps=' + ops.length + ' cryptoOperacoes=' + (window.cryptoOperacoes || []).length);
        // console.log('[PM-Debug] sampleOp:', ops[0] ? { tipo: ops[0].tipo, status: ops[0].status, exercicio_status: ops[0].exercicio_status, exercicio_status_persistido: ops[0].exercicio_status_persistido, crypto: ops[0].crypto, strike: ops[0].strike } : 'none');

        var putsExercidas = baseOps.filter(isExercisedPut);
        // console.log('[PM-Debug] putsExercidas=' + putsExercidas.length);
        var ultimaPut = putsExercidas.length
            ? putsExercidas.sort(function (a, b) {
                var aTime = window.CryptoExerciseStatus?.getOperationDate?.(a)?.getTime?.() || 0;
                var bTime = window.CryptoExerciseStatus?.getOperationDate?.(b)?.getTime?.() || 0;
                return bTime - aTime;
            })[0]
            : null;

        var cicloDate = ultimaPut
            ? (ultimaPut.exercicio || ultimaPut.data_operacao || '')
            : '';

        var allPremios = ops.map(function (o) {
            return {
                rot: (o.tipo || '') + ' ' + (o.ativo || '') + ' — ' + (o.status || ''),
                v: parseFloat(o.premio_us || 0),
                data: o.exercicio || o.data_operacao || '',
                exercida: isExercisedPut(o),
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

        var custoTotal = 0;
        var qtyTotal = 0;
        var detalheCompras = [];

        putsExercidas.forEach(function (op) {
            var strike = parseFloat(op.strike || 0);
            var crypto = parseFloat(op.crypto || 0);
            var premio = parseFloat(op.premio_us || 0);
            var data = op.exercicio || op.data_operacao || '';

            if (strike > 0 && crypto > 0) {
                var custo = strike * crypto - premio;
                custoTotal += custo;
                qtyTotal += crypto;
                detalheCompras.push({
                    id: op.id,
                    data: data,
                    strike: strike,
                    crypto: crypto,
                    premio: premio,
                    custo: custo,
                });
            }
        });

        var pm = qtyTotal > 0 ? custoTotal / qtyTotal : 0;

        var cotacao = cotacaoOverride || parseFloat(ops.find(function (o) {
            return parseFloat(o.cotacao_atual || 0) > 0;
        })?.cotacao_atual || 0);

        var openOp = ops.find(function (o) { return (o.status || '').toUpperCase() === 'ABERTA'; });
        var strikeAberto = openOp ? parseFloat(openOp.strike || 0) : 0;
        var tipoAberto = openOp ? (openOp.tipo || 'CALL').toUpperCase() : 'CALL';

        return {
            ativo: par,
            ultimoExercicio: ultimaPut ? parseFloat(ultimaPut.strike || 0) : 0,
            dataUltimaPut: cicloDate || '',
            premios: premios,
            totalPremios: totalPremios,
            pm: pm,
            custoTotal: custoTotal,
            qtyTotal: qtyTotal,
            detalheCompras: detalheCompras,
            cotacao: cotacao,
            strikeAberto: strikeAberto,
            tipoAberto: tipoAberto,
            hasOpenOp: !!openOp,
        };
    }

    function openModal(par, cotacaoOverride) {
        if (!par) return;
        var allOps = window.cryptoOperacoes || [];
        // console.log('[PM-Debug] openModal par=' + par + ' totalOps=' + allOps.length);

        var parOps = allOps.filter(function(o) {
            var a = (o.ativo || '').toUpperCase().replace('USDT', '').replace('/', '').trim();
            return a === par.toUpperCase();
        });
        // console.log('[PM-Debug] parOps(' + par + '):', parOps.length);

        var putsAll = parOps.filter(function(o) { return (o.tipo || '').toUpperCase() === 'PUT'; });
        // console.log('[PM-Debug] PUTs:', putsAll.length);

        var putsClosed = putsAll.filter(function(o) { return (o.status || '').toUpperCase() !== 'ABERTA'; });
        // console.log('[PM-Debug] PUTs closed:', putsClosed.length);

        var putsSIM = putsAll.filter(function(o) { return (o.exercicio_status || '').toUpperCase() === 'SIM'; });
        // console.log('[PM-Debug] PUTs with exercicio_status=SIM:', putsSIM.length);

        var putsPersistido = putsAll.filter(function(o) { return (o.exercicio_status_persistido || '').toUpperCase() === 'SIM'; });
        // console.log('[PM-Debug] PUTs with persistido=SIM:', putsPersistido.length);

        if (putsSIM.length > 0) {
            var sample = putsSIM[0];
            // console.log('[PM-Debug] sample PUT SIM:', JSON.stringify({id: sample.id, tipo: sample.tipo, status: sample.status, exercicio_status: sample.exercicio_status, persistido: sample.exercicio_status_persistido, crypto: sample.crypto, strike: sample.strike}));
            var exResult = window.CryptoExerciseStatus ? window.CryptoExerciseStatus.isActuallyExercised(sample) : 'no CryptoExerciseStatus';
            // console.log('[PM-Debug] isActuallyExercised(sample) =', exResult);
        }

        modalData = computeData(par, cotacaoOverride);
        // console.log('[PM-Debug] computeData result: pm=' + (modalData ? modalData.pm : 'null') + ' qtyTotal=' + (modalData ? modalData.qtyTotal : 'null') + ' custoTotal=' + (modalData ? modalData.custoTotal : 'null'));
        var overlay = document.getElementById('pmOverlay');
        if (!overlay) return;
        build();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        startLiveUpdates(par);
    }

    function closeModal() {
        stopLiveUpdates();
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
                var exercidaBadge = s.exercida ? ' <span class="pm-badge pm-badge-sm exercida" title="PUT exercida - Comprou crypto">EXERCIDA</span>' : '';
                opHtml = '<span class="pm-badge ' + tipoBadge + '">' + tipo + '</span> ' +
                    '<span class="pm-op-asset">' + ativo + '</span> ' +
                    (statusStr ? '<span class="pm-badge pm-badge-sm ' + statusBadge + '">' + statusStr + '</span>' : '') +
                    exercidaBadge;
                valorStr = '−' + usd(s.v);
            }

            html += '<tr class="' + (isLast ? 'pm-final-row' : '') + (s.exercida ? ' pm-exercida-row' : '') + '">' +
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

        var cotTip = function () {
            return {
                type: 'default',
                title: 'Cotação',
                lines: [
                    { key: '📊 Preço atual do ' + d.ativo },
                    { key: 'Fonte: Binance (tempo real)' },
                ],
            };
        };

        var pmTip = function () {
            if (!d.pm) {
                return { type: 'default', title: 'Preço Médio', lines: [{ key: 'Indisponível' }] };
            }
            return {
                type: 'default',
                title: 'Preço Médio (Ponderado)',
                lines: [
                    { key: 'Custo efetivo ponderado de todas as compras' },
                ],
                formula: 'Fórmula: Custo Total / Quantidade Total<br>' +
                    'Custo Total: ' + usd(d.custoTotal) + '<br>' +
                    'Quantidade: ' + d.qtyTotal.toFixed(6) + ' ' + d.ativo + '<br>' +
                    'Resultado: ' + usd(d.pm),
                note: 'PM ponderado de todas as PUTs exercidas (compras).',
            };
        };

        var entradaTip = function () {
            if (!d.ultimoExercicio) {
                return { type: 'default', title: 'Última PUT Exercida', lines: [{ key: 'Nenhuma PUT exercida ainda' }] };
            }
            var lines = [
                { key: 'Strike da última PUT exercida' },
                { key: 'Strike', value: usd(d.ultimoExercicio) },
            ];
            if (d.dataUltimaPut) {
                lines.push({ key: '📅 Exercida em', value: fmtDateBR(d.dataUltimaPut) });
            }
            return {
                type: 'default',
                title: 'Última PUT Exercida',
                lines: lines,
                note: 'Última operação de compra via Dual Investment.',
            };
        };

        var premiosTip = function () {
            if (d.totalPremios <= 0) {
                return { type: 'default', title: 'Prêmios Acumulados', lines: [{ key: 'Nenhum prêmio no ciclo atual' }] };
            }
            return {
                type: 'default',
                title: 'Prêmios Acumulados',
                lines: [
                    { key: 'Soma dos prêmios desde a última PUT exercida' },
                    { key: 'Total', value: usd(d.totalPremios) },
                    { key: 'Operações', value: d.premios.length + ' lançamento' + (d.premios.length !== 1 ? 's' : '') },
                ],
                note: 'Prêmios dos lançamentos recentes (não impactam mais o PM ponderado).',
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
                    '(' + usd(d.cotacao) + ' − ' + usd(d.pm) + ') / ' + usd(d.pm) + ' × 100<br>' +
                    'Resultado: ' + pct(vsPm),
                note: 'Quanto maior, mais "segura" a posição.',
            };
        };

        var resExercTip = function () {
            if (!d.strikeAberto || !d.pm) {
                return { type: 'default', title: 'Resultado se Exercido', lines: [{ key: 'Sem opção aberta ou sem PM' }] };
            }
            return {
                type: 'default',
                title: 'Resultado se Exercido',
                lines: [
                    { key: 'Lucro se a ' + d.tipoAberto + ' (strike ' + usd(d.strikeAberto) + ') for exercida' },
                ],
                formula: 'Strike − PM<br>' +
                    usd(d.strikeAberto) + ' − ' + usd(d.pm) + '<br>' +
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
                    '(' + usd(d.cotacao) + ' − ' + usd(d.strikeAberto) + ') / ' + usd(d.strikeAberto) + ' × 100<br>' +
                    'Resultado: ' + pct(dist),
                note: dist < 0
                    ? 'Negativo = cotação abaixo do strike = ' + d.tipoAberto + ' fora do dinheiro (OTM, segura).'
                    : 'Positivo = cotação acima do strike = ' + d.tipoAberto + ' dentro do dinheiro (ITM, risco de exercício).',
            };
        };

        var body = document.getElementById('pmBody');
        if (!body) return;

        body.innerHTML =
            '<div class="pm-summary-row">' +
                '<div class="pm-stat-box" data-tip="pm"><div class="lbl">Preço Médio</div><div class="val" style="color:var(--pm-amber)">' + usd(d.pm) + '</div></div>' +
                '<div class="pm-stat-box" data-tip="entrada"><div class="lbl">Entrada (PUT)</div><div class="val" style="color:var(--pm-blue)">' + usd(d.ultimoExercicio) + '</div></div>' +
                '<div class="pm-stat-box" data-tip="premios"><div class="lbl">Prêmios acumulados</div><div class="val" style="color:var(--pm-green)">' + usd(d.totalPremios) + '</div></div>' +
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
                '<div class="pm-stat-box" data-tip="cot"><div class="lbl">📊 Cotação</div><div class="val" style="color:var(--pm-blue)">' + usd(d.cotacao) + '</div></div>' +
                '<div class="pm-stat-box ' + (vsPm !== null && vsPm >= 0 ? 'g' : '') + '" data-tip="vsPm"><div class="lbl">📈 Cotação vs PM</div><div class="val">' + (vsPm !== null ? pct(vsPm) : '—') + '</div></div>' +
                '<div class="pm-stat-box ' + (resExerc !== null && resExerc >= 0 ? 'g' : '') + '" data-tip="resExerc"><div class="lbl">💰 Resultado se exercido</div><div class="val">' + (resExerc !== null ? sgn(resExerc) : '—') + '</div></div>' +
                '<div class="pm-stat-box" data-tip="dist"><div class="lbl">📏 Distância strike</div><div class="val">' + (dist !== null ? pct(dist) : '—') + '</div></div>' +
            '</div>';

        var tipMap = { pm: pmTip, entrada: entradaTip, premios: premiosTip, cot: cotTip, vsPm: vsPmTip, resExerc: resExercTip, dist: distTip };
        body.querySelectorAll('.pm-stat-box[data-tip]').forEach(function (box) {
            var key = box.getAttribute('data-tip');
            var configFn = tipMap[key];
            if (!configFn) return;
            box.addEventListener('mouseenter', function () {
                var config = configFn();
                if (config) SharedTooltip.show(box, config);
            });
            box.addEventListener('mouseleave', function () { SharedTooltip.hide(); });
        });

        drawLedger(steps);
        if (typeof Chart !== 'undefined') {
            drawChart(steps);
        }
    }

    var _liveUnsub = null;
    var _currentAsset = null;

    function updateFooterPrices(newPrice) {
        if (!modalData || !isFinite(newPrice) || newPrice <= 0) return;
        modalData.cotacao = newPrice;
        var d = modalData;
        var vsPm = d.cotacao && d.pm ? ((d.cotacao - d.pm) / d.pm) * 100 : null;
        var resExerc = d.strikeAberto && d.pm ? d.strikeAberto - d.pm : null;
        var dist = d.cotacao && d.strikeAberto ? ((d.cotacao - d.strikeAberto) / d.strikeAberto) * 100 : null;

        var boxes = document.querySelectorAll('#pmBody .pm-summary-row:last-child .pm-stat-box');
        if (boxes.length < 4) return;

        boxes[0].querySelector('.val').textContent = usd(d.cotacao);
        boxes[1].querySelector('.val').textContent = vsPm !== null ? pct(vsPm) : '—';
        boxes[1].className = 'pm-stat-box' + (vsPm !== null && vsPm >= 0 ? ' g' : '');
        boxes[2].querySelector('.val').textContent = resExerc !== null ? sgn(resExerc) : '—';
        boxes[2].className = 'pm-stat-box' + (resExerc !== null && resExerc >= 0 ? g : '');
        boxes[3].querySelector('.val').textContent = dist !== null ? pct(dist) : '—';

        var tipMap2 = {
            cot: function () {
                return {
                    type: 'default',
                    title: 'Cotação',
                    lines: [
                        { key: 'Preço atual do ' + d.ativo },
                        { key: 'Fonte: Binance (tempo real)' },
                    ],
                };
            },
            vsPm: function () {
                if (vsPm === null) {
                    return { type: 'default', title: 'Cotação vs PM', lines: [{ key: 'Indisponível' }] };
                }
                return {
                    type: 'default',
                    title: 'Cotação vs PM',
                    lines: [
                        { key: 'Quanto a cotação está acima (ou abaixo) do PM' },
                    ],
                    formula: '(Cotação − PM) / PM × 100<br>(' + usd(d.cotacao) + ' − ' + usd(d.pm) + ') / ' + usd(d.pm) + ' × 100<br>Resultado: ' + pct(vsPm),
                    note: 'Quanto maior, mais "segura" a posição.',
                };
            },
            resExerc: function () {
                if (resExerc === null) {
                    return { type: 'default', title: 'Resultado se Exercido', lines: [{ key: 'Sem opção aberta ou sem PM' }] };
                }
                return {
                    type: 'default',
                    title: 'Resultado se Exercido',
                    lines: [
                        { key: 'Lucro se a ' + d.tipoAberto + ' (strike ' + usd(d.strikeAberto) + ') for exercida' },
                    ],
                    formula: 'Strike − PM<br>' + usd(d.strikeAberto) + ' − ' + usd(d.pm) + '<br>Resultado: ' + sgn(resExerc),
                    note: 'O PM já desconta todos os prêmios colhidos.',
                };
            },
            dist: function () {
                if (dist === null) {
                    return { type: 'default', title: 'Distância Strike', lines: [{ key: 'Indisponível' }] };
                }
                return {
                    type: 'default',
                    title: 'Distância Strike',
                    lines: [
                        { key: 'Distância da cotação até o strike da ' + d.tipoAberto },
                    ],
                    formula: '(Cotação − Strike) / Strike × 100<br>(' + usd(d.cotacao) + ' − ' + usd(d.strikeAberto) + ') / ' + usd(d.strikeAberto) + ' × 100<br>Resultado: ' + pct(dist),
                    note: dist < 0
                        ? 'Negativo = cotação abaixo do strike = ' + d.tipoAberto + ' fora do dinheiro (OTM, segura).'
                        : 'Positivo = cotação acima do strike = ' + d.tipoAberto + ' dentro do dinheiro (ITM, risco de exercício).',
                };
            },
        };

        boxes.forEach(function (box) {
            var key = box.getAttribute('data-tip');
            var configFn = tipMap2[key];
            if (!configFn) return;
            box.onmouseenter = function () {
                var config = configFn();
                if (config) SharedTooltip.show(box, config);
            };
            box.onmouseleave = function () { SharedTooltip.hide(); };
        });
    }

    function startLiveUpdates(par) {
        stopLiveUpdates();
        _currentAsset = par;
        if (window.CryptoLive && typeof window.CryptoLive.onChange === 'function') {
            _liveUnsub = window.CryptoLive.onChange(function (asset, price) {
                if (asset === _currentAsset) updateFooterPrices(price);
            });
        }
    }

    function stopLiveUpdates() {
        if (typeof _liveUnsub === 'function') { _liveUnsub(); _liveUnsub = null; }
        _currentAsset = null;
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

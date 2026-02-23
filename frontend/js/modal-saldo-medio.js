/**
 * modal-saldo-medio.js  v1.0.0
 * Modal de Análise de Saldo Médio – padrão IIFE do projeto
 * Acionado pelo clique no card #cardResultadoMedioCard
 */
(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Estado local                                                         */
    /* ------------------------------------------------------------------ */
    const charts = { gPoP: null, gWin: null, gRet: null, gRet2: null, donut: null, bar: null };
    let apexLoaded = false;
    let currentOps = [];
    let activeFilter = 'all';

    /* ------------------------------------------------------------------ */
    /* Formatadores                                                         */
    /* ------------------------------------------------------------------ */
    function smFmt(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    }

    function smFmtK(v) {
        const n = Math.abs(v);
        if (n >= 1000) return (v < 0 ? '-' : '') + 'R$' + (n / 1000).toFixed(1) + 'k';
        return smFmt(v);
    }

    function smPctFmt(v) {
        return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
    }

    function getSaldoCorretora() {
        const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
        const saldo = parseFloat(config.saldoAcoes || config.saldo_corretora || 0);
        return Number.isNaN(saldo) ? 0 : saldo;
    }

    /* ------------------------------------------------------------------ */
    /* Lazy-load ApexCharts                                                 */
    /* ------------------------------------------------------------------ */
    function ensureApex(cb) {
        if (typeof ApexCharts !== 'undefined') { apexLoaded = true; cb(); return; }
        if (apexLoaded) { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3/dist/apexcharts.min.js';
        s.onload = function () { apexLoaded = true; cb(); };
        s.onerror = function () {
            console.error('[modal-saldo-medio] Falha ao carregar ApexCharts');
        };
        document.head.appendChild(s);
    }

    /* ------------------------------------------------------------------ */
    /* Auxiliar: tooltip ApexCharts dark-theme                             */
    /* ------------------------------------------------------------------ */
    function apexTheme() {
        return {
            theme: { mode: 'dark' },
            chart: { background: 'transparent', foreColor: '#94a3b8' },
        };
    }

    /* ------------------------------------------------------------------ */
    /* Cria / atualiza um gauge radial                                      */
    /* ------------------------------------------------------------------ */
    function makeGauge(elId, value, color) {
        const el = document.getElementById(elId);
        if (!el) return null;
        el.innerHTML = '';
        const chart = new ApexCharts(el, {
            ...apexTheme(),
            chart: {
                ...apexTheme().chart,
                type: 'radialBar',
                height: 120,
                sparkline: { enabled: true },
                animations: { enabled: true, speed: 800 },
            },
            series: [Math.min(100, Math.max(0, parseFloat(value.toFixed(1))))],
            plotOptions: {
                radialBar: {
                    startAngle: -120,
                    endAngle: 120,
                    hollow: { size: '52%' },
                    track: { background: 'rgba(255,255,255,.07)' },
                    dataLabels: {
                        name: { show: false },
                        value: {
                            fontSize: '18px',
                            fontWeight: 700,
                            color: color,
                            offsetY: 8,
                            formatter: function (v) { return v.toFixed(0) + '%'; },
                        },
                    },
                },
            },
            fill: { colors: [color] },
        });
        chart.render();
        return chart;
    }

    /* ------------------------------------------------------------------ */
    /* Abre a modal                                                         */
    /* ------------------------------------------------------------------ */
    function openModal() {
        const modalEl = document.getElementById('modalSaldoMedio');
        if (!modalEl) {
            console.warn('[modal-saldo-medio] Elemento #modalSaldoMedio não encontrado');
            return;
        }
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl, { keyboard: true });
        modal.show();

        // Registrar listener de resize dos gráficos uma única vez
        const collapseEl = document.getElementById('smChartsCollapse');
        if (collapseEl && !collapseEl._smBound) {
            collapseEl._smBound = true;
            collapseEl.addEventListener('shown.bs.collapse', function () {
                if (charts.donut) { try { charts.donut.updateOptions({}); } catch (e) { /* */ } }
                if (charts.bar)   { try { charts.bar.updateOptions({});   } catch (e) { /* */ } }
                window.dispatchEvent(new Event('resize'));
            });
        }

        loadAndRender(false);
    }

    /* ------------------------------------------------------------------ */
    /* Busca dados e renderiza                                              */
    /* ------------------------------------------------------------------ */
    function loadAndRender(showSpinner) {
        if (showSpinner) {
            const tbody = document.getElementById('smOpsTbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">'
                    + '<span class="spinner-border spinner-border-sm me-2"></span>Carregando...</td></tr>';
            }
        }

        fetch('/api/opcoes')
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                currentOps = Array.isArray(data) ? data : (data.data || []);
                ensureApex(function () { render(applyFilter(currentOps, activeFilter)); });
            })
            .catch(function (err) {
                console.error('[modal-saldo-medio]', err);
                if (typeof iziToast !== 'undefined') {
                    iziToast.warning({
                        title: 'Atenção',
                        message: 'Não foi possível carregar os dados de saldo médio.',
                        position: 'topRight',
                    });
                }
            });
    }

    /* ------------------------------------------------------------------ */
    /* Renderiza toda a modal                                               */
    /* ------------------------------------------------------------------ */
    function render(ops) {
        ops = Array.isArray(ops) ? ops : [];
        const saldoCorretora = getSaldoCorretora();

        /* ── Métricas agregadas ── */
        const fechadas  = ops.filter(o => (o.status || '').toUpperCase() === 'FECHADA');
        const abertas   = ops.filter(o => (o.status || '').toUpperCase() === 'ABERTA');
        const vencidas  = ops.filter(o => (o.status || '').toUpperCase() === 'VENCIDA');
        const ganhos    = fechadas.filter(o => parseFloat(o.resultado || 0) >= 0);
        const perdas    = fechadas.filter(o => parseFloat(o.resultado || 0) < 0);

        // premio é preço unitário → multiplicar por quantidade para obter prêmio total real
        const totalPremio   = ops.reduce(function (a, o) { return a + parseFloat(o.premio || 0) * parseFloat(o.quantidade || 1); }, 0);
        const totalResultado= ops.reduce(function (a, o) { return a + parseFloat(o.resultado || 0); }, 0);
        const totalSaldo    = ops.reduce(function (a, o) { return a + parseFloat(o.saldo_abertura || 0); }, 0);
        const mediaSaldo    = ops.length ? totalSaldo / ops.length : 0;

        // pop: só considera valores > 0 (sem dados nulos ou zerados)
        const popVals   = ops.filter(function (o) { return o.pop != null && o.pop !== '' && parseFloat(o.pop) > 0; }).map(function (o) { return parseFloat(o.pop); });
        const popMedio  = popVals.length ? popVals.reduce(function (a, b) { return a + b; }, 0) / popVals.length : 0;
        const winRate   = fechadas.length ? (ganhos.length / fechadas.length) * 100 : 0;
        // retenção: resultado / prêmio_total (premio unit × qtd) × 100
        const retPremio = totalPremio ? (totalResultado / totalPremio) * 100 : 0;
        // retorno sobre saldo médio da conta
        const retSaldo  = mediaSaldo  ? (totalResultado / mediaSaldo) * 100 : 0;

        const pctStr = mediaSaldo ? smPctFmt(retSaldo) : '';

        /* ── Header ── */
        _setText('smAmount', smFmt(totalResultado));
        _setText('smPct',    pctStr);
        _setText('smSub',    ops.length + ' operações · saldo médio ' + smFmt(mediaSaldo));

        /* Pills status */
        const pillsEl = document.getElementById('smPills');
        if (pillsEl) {
            pillsEl.innerHTML = ''
                + _pill(abertas.length,  'Abertas',  '#206bc4')
                + _pill(ganhos.length,   'Ganhos',   '#2fb344')
                + _pill(perdas.length,   'Perdas',   '#d63939')
                + _pill(vencidas.length, 'Vencidas', '#94a3b8');
        }

        /* ── Gauges ── */
        _destroyCharts();

        charts.gPoP  = makeGauge('smGPoP',  Math.min(100, popMedio),              '#206bc4');
        charts.gWin  = makeGauge('smGWin',  winRate,                              '#2fb344');
        charts.gRet  = makeGauge('smGRet',  Math.min(100, Math.max(0, retPremio)),'#f59f00');
        charts.gRet2 = makeGauge('smGRet2', Math.min(100, Math.max(0, retSaldo)), '#6366f1');

        _setText('smGPoPsub',  popMedio > 0 ? popMedio.toFixed(1) + '%' : 'sem dados');
        _setText('smGWinsub',  ganhos.length + '/' + fechadas.length + ' ops');
        _setText('smGRetsub',  retPremio.toFixed(1) + '%');
        _setText('smGRet2sub', retSaldo.toFixed(2) + '%');

        /* ── Tabela ── */
        const tbody = document.getElementById('smOpsTbody');
        if (tbody) {
            if (!ops.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Nenhuma operação encontrada.</td></tr>';
            } else {
                tbody.innerHTML = ops.map(function (o) {
                    const res     = parseFloat(o.resultado || 0);
                    const prem    = parseFloat(o.premio || 0);
                    const qtd     = parseFloat(o.quantidade || 1);
                    const premTot = prem * qtd;
                    const pctBase = saldoCorretora || parseFloat(o.saldo_abertura || 0);
                    const pct     = pctBase ? (premTot / pctBase) * 100 : 0;
                    const statusCls = {
                        FECHADA: 'text-success', ABERTA: 'text-primary',
                        VENCIDA: 'text-secondary', PERDIDA: 'text-danger',
                    }[(o.status || '').toUpperCase()] || '';
                    const ativoNome = o.ativo || o.codigo || o.ativo_base || '—';
                    return '<tr>'
                        + '<td><strong>' + _esc(ativoNome) + '</strong></td>'
                        + '<td>' + _esc(o.tipo || '—') + '</td>'
                        + '<td title="Unit: ' + smFmt(prem) + ' × ' + qtd + '">' + smFmt(premTot) + '</td>'
                        + '<td class="' + (pct >= 0 ? 'text-success' : 'text-danger') + '">' + pct.toFixed(1) + '%</td>'
                        + '<td>' + (o.pop != null && parseFloat(o.pop) > 0 ? parseFloat(o.pop).toFixed(0) + '%' : '—') + '</td>'
                        + '<td>' + (o.dias != null ? o.dias : '—') + '</td>'
                        + '<td class="' + (res >= 0 ? 'text-success' : 'text-danger') + '">' + smFmt(res) + '</td>'
                        + '<td><span class="badge ' + _statusBadge(o.status) + '">' + _esc(o.status || '—') + '</span></td>'
                        + '</tr>';
                }).join('');
            }
        }

        /* ── Métricas Status Geral ── */
        const metricsEl = document.getElementById('smMetricList');
        if (metricsEl) {
            metricsEl.innerHTML = [
                { lbl: 'Total operações',    val: ops.length,            cls: '' },
                { lbl: 'Abertas',            val: abertas.length,        cls: 'text-primary' },
                { lbl: 'Fechadas',           val: fechadas.length,       cls: '' },
                { lbl: 'Ganhos',             val: ganhos.length,         cls: 'text-success' },
                { lbl: 'Perdas',             val: perdas.length,         cls: 'text-danger' },
                { lbl: 'Vencidas',           val: vencidas.length,       cls: 'text-secondary' },
                { lbl: 'Prêmio total',       val: smFmt(totalPremio),    cls: '' },
                { lbl: 'Resultado total',    val: smFmt(totalResultado), cls: totalResultado >= 0 ? 'text-success' : 'text-danger' },
                { lbl: 'Saldo médio',        val: smFmt(mediaSaldo),     cls: '' },
                { lbl: 'PoP médio',          val: popMedio > 0 ? popMedio.toFixed(1) + '%' : '—',  cls: '' },
                { lbl: 'Win rate',           val: winRate.toFixed(1) + '%',  cls: winRate >= 60 ? 'text-success' : winRate >= 40 ? 'text-warning' : 'text-danger' },
                { lbl: 'Retenção prêmio',    val: retPremio.toFixed(1) + '%', cls: retPremio >= 0 ? 'text-success' : 'text-danger' },
            ].map(function (m) {
                return '<div class="sm-mline"><span class="sm-mline-lbl">' + m.lbl + '</span>'
                     + '<span class="sm-mline-val ' + m.cls + '">' + m.val + '</span></div>';
            }).join('');
        }

        /* ── Cards com all inicial ── */
        renderCards(ops);

        /* ── Donut por tipo ── */
        const byTipo = _groupBy(ops, 'tipo');
        const donutEl = document.getElementById('smChartDonut');
        if (donutEl) {
            donutEl.innerHTML = '';
            if (ops.length) {
                charts.donut = new ApexCharts(donutEl, {
                    ...apexTheme(),
                    chart: {
                        ...apexTheme().chart,
                        type: 'donut',
                        height: 240,
                        animations: { enabled: true, speed: 600 },
                    },
                    series: Object.values(byTipo).map(function (arr) {
                        return arr.reduce(function (a, o) { return a + parseFloat(o.resultado || 0); }, 0);
                    }),
                    labels: Object.keys(byTipo),
                    colors: ['#206bc4', '#2fb344', '#d63939', '#f59f00', '#6366f1', '#06b6d4'],
                    dataLabels: { enabled: true },
                    legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
                    plotOptions: { pie: { donut: { size: '60%' } } },
                    tooltip: {
                        y: { formatter: function (v) { return smFmt(v); } },
                    },
                });
                charts.donut.render();
            }
        }

        /* ── Barras por ativo base ── */
        const byAtivo = _groupBy(ops, 'ativo_base');
        const barEl   = document.getElementById('smChartBar');
        if (barEl) {
            barEl.innerHTML = '';
            if (ops.length) {
                const cats = Object.keys(byAtivo);
                const vals = cats.map(function (k) {
                    return byAtivo[k].reduce(function (a, o) { return a + parseFloat(o.premio || 0); }, 0);
                });
                charts.bar = new ApexCharts(barEl, {
                    ...apexTheme(),
                    chart: {
                        ...apexTheme().chart,
                        type: 'bar',
                        height: 240,
                        toolbar: { show: false },
                        animations: { enabled: true, speed: 600 },
                    },
                    series: [{ name: 'Prêmio', data: vals }],
                    xaxis: { categories: cats, labels: { style: { colors: '#94a3b8' } } },
                    yaxis: { labels: { formatter: function (v) { return smFmtK(v); }, style: { colors: '#94a3b8' } } },
                    colors: ['#206bc4'],
                    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
                    dataLabels: { enabled: false },
                    tooltip: {
                        y: { formatter: function (v) { return smFmt(v); } },
                    },
                });
                charts.bar.render();
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* Cards de operação                                                    */
    /* ------------------------------------------------------------------ */
    function renderCards(ops) {
        const el = document.getElementById('smOpStrip');
        if (!el) return;
        const saldoCorretora = getSaldoCorretora();

        if (!ops.length) {
            el.innerHTML = '<div class="text-muted ps-1">Nenhuma operação neste filtro.</div>';
            return;
        }

        el.innerHTML = ops.map(function (o) {
            const res      = parseFloat(o.resultado || 0);
            const prem     = parseFloat(o.premio || 0);
            const qtd      = parseFloat(o.quantidade || 1);
            const premTot  = prem * qtd;
            const status   = (o.status || '').toUpperCase();
            const cardCls  = status === 'ABERTA' ? 'c-open' : (res >= 0 ? 'c-win' : 'c-loss');
            const resCls   = res >= 0 ? 'text-success' : 'text-danger';
            const pctBase  = saldoCorretora || parseFloat(o.saldo_abertura || 0);
            const pct      = pctBase ? ((premTot / pctBase) * 100).toFixed(2) + '%' : '—';
            const ativoNome = o.ativo || o.codigo || o.ativo_base || '—';
            const dataRef  = o.data_fechamento || o.data_operacao || o.vencimento || '';
            return '<div class="sm-op-card ' + cardCls + '">'
                + '<div class="sm-op-card-top">'
                + '<span class="sm-op-ativo">' + _esc(ativoNome) + '</span>'
                + '<span class="badge ' + _statusBadge(o.status) + ' ms-1">' + _esc(status) + '</span>'
                + '</div>'
                + '<div class="sm-op-tipo text-muted">' + _esc(o.tipo || '—')
                + (o.strike ? ' · K ' + _esc(String(o.strike)) : '')
                + (dataRef ? ' · ' + _esc(dataRef) : '') + '</div>'
                + '<div class="sm-op-res ' + resCls + '">' + smFmt(res) + ' <small>(' + pct + ')</small></div>'
                + '<div class="sm-op-prem text-muted">Prêmio: ' + smFmt(prem) + '</div>'
                + '</div>';
        }).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Filtro público (chamado pelo onclick inline do HTML)                 */
    /* ------------------------------------------------------------------ */
    function filterCard(f, btn) {
        /* atualiza tab ativa */
        var tabs = document.querySelectorAll('#smFtabs .sm-ftab');
        tabs.forEach(function (t) { t.classList.remove('active'); });
        if (btn) btn.classList.add('active');
        activeFilter = f;
        render(applyFilter(currentOps, activeFilter));
    }

    /* expõe para o onclick inline do HTML */
    window.smFilterCard = filterCard;

    /* ------------------------------------------------------------------ */
    /* Helpers internos                                                     */
    /* ------------------------------------------------------------------ */
    function _destroyCharts() {
        Object.keys(charts).forEach(function (k) {
            if (charts[k]) { try { charts[k].destroy(); } catch (e) { /* ignore */ } charts[k] = null; }
        });
    }

    function _setText(id, txt) {
        var el = document.getElementById(id);
        if (el) el.textContent = txt;
    }

    function _esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _pill(n, label, color) {
        return '<span class="sm-pill" style="background:' + color + '20;color:' + color + ';border:1px solid ' + color + '55">'
            + n + ' ' + label + '</span>';
    }

    function _statusBadge(status) {
        const map = {
            ABERTA: 'bg-blue-lt text-primary',
            FECHADA: 'bg-green-lt text-success',
            VENCIDA: 'bg-secondary-lt text-secondary',
            PERDIDA: 'bg-red-lt text-danger',
        };
        return map[(status || '').toUpperCase()] || 'bg-secondary-lt text-secondary';
    }

    function _groupBy(arr, key) {
        return arr.reduce(function (acc, o) {
            const k = o[key] || 'Outro';
            (acc[k] = acc[k] || []).push(o);
            return acc;
        }, {});
    }

    function applyFilter(ops, f) {
        if (!f || f === 'all') return ops;
        if (f === 'ABERTA' || f === 'FECHADA' || f === 'VENCIDA') {
            return ops.filter(function (o) { return (o.status || '').toUpperCase() === f; });
        }
        if (f === 'CALL' || f === 'PUT') {
            return ops.filter(function (o) { return (o.tipo || '').toUpperCase() === f; });
        }
        return ops;
    }

    /* ------------------------------------------------------------------ */
    /* Registra triggers no card da dashboard                               */
    /* ------------------------------------------------------------------ */
    function setupTriggers() {
        const card = document.getElementById('cardResultadoMedioCard');
        if (card && !card._smBound) {
            card._smBound = true;
            card.addEventListener('click', openModal);
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal();
                }
            });
        }

        const refreshBtn = document.getElementById('btnRefreshSaldoMedio');
        if (refreshBtn && !refreshBtn._smBound) {
            refreshBtn._smBound = true;
            refreshBtn.addEventListener('click', function () { loadAndRender(true); });
        }
    }

    document.addEventListener('layoutReady', function () { setupTriggers(); });
    window.addEventListener('load', function () { setupTriggers(); });

})();

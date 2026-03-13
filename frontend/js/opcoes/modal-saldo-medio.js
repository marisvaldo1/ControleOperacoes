/**
 * modal-saldo-medio.js  v1.1.0
 * Modal de Análise de Saldo Médio – padrão IIFE do projeto
 * Acionãdo pelo clique no card #cardResultadoMedioCard
 * Configurável via ModalSaldoMedio.configure(opts)
 */
(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Configuração                                                          */
    /* ------------------------------------------------------------------ */
    const cfg = {
        currency: 'BRL',
        apiEndpoint: '/api/opcoes',
        modalElId: 'modalSaldoMedio',
        containerElId: 'modalSaldoMedioContainer',
        templatePath: 'modal-saldo-medio.html',
        triggerCard: 'cardResultadoMedioCard',
        getSaldo: function() {
            const c = JSON.parse(localStorage.getItem('appConfig') || '{}');
            const v = parseFloat(c.saldoAcoes || c.saldo_corretora || 0);
            return Number.isNaN(v) ? 0 : v;
        },
        getMonetaryValue: function(op) {
            // Valor monetário total da operação
            return parseFloat(op.premio || 0) * parseFloat(op.quantidade || 1);
        },
        getUnitPremium: function(op) { return parseFloat(op.premio || 0); },
        getQuantity:    function(op) { return parseFloat(op.quantidade || 1); },
        getResultado:   function(op) { return parseFloat(op.resultado || 0); },
        getSaldoAbertura: function(op, fallback) {
            return parseFloat(op.saldo_abertura || 0) || fallback;
        },
        getPop:         function(op) { return op.pop != null && parseFloat(op.pop) > 0 ? parseFloat(op.pop) : null; },
        getAtivo:       function(op) { return op.ativo || op.codigo || op.ativo_base || '—'; },
        getTipo:        function(op) { return op.tipo || '—'; },
        getStrike:      function(op) { return op.strike || null; },
        tableHeader: function() {
            return '<th>Ativo</th><th>Tipo</th><th>Prêmio</th><th>%</th><th>PoP</th><th>Dias</th><th>Resultado</th><th>Status</th>';
        },
        tableRow: function(op, smFmt, saldoCor) {
            const res     = cfg.getResultado(op);
            const prem    = cfg.getUnitPremium(op);
            const qtd     = cfg.getQuantity(op);
            const premTot = cfg.getMonetaryValue(op);
            const saldoOp = cfg.getSaldoAbertura(op, saldoCor);
            const pct     = saldoOp ? (res / saldoOp) * 100 : 0;
            const statusCls = { FECHADA:'text-success', ABERTA:'text-primary', VENCIDA:'text-secondary', PERDIDA:'text-danger' }[(op.status||'').toUpperCase()] || '';
            const ativoNome = cfg.getAtivo(op);
            const pop = cfg.getPop(op);
            return '<tr>'
                + '<td><strong>' + _esc(ativoNome) + '</strong></td>'
                + '<td>' + _esc(cfg.getTipo(op)) + '</td>'
                + '<td title="Unit: ' + smFmt(prem) + ' × ' + qtd + '">' + smFmt(premTot) + '</td>'
                + '<td class="' + (pct >= 0 ? 'text-success' : 'text-danger') + '">' + pct.toFixed(2) + '%</td>'
                + '<td>' + (pop !== null ? pop.toFixed(0) + '%' : '—') + '</td>'
                + '<td>' + (op.dias != null ? op.dias : '—') + '</td>'
                + '<td class="' + (res >= 0 ? 'text-success' : 'text-danger') + '">' + smFmt(res) + '</td>'
                + '<td><span class="badge ' + _statusBadge(op.status) + '">' + _esc(op.status || '—') + '</span></td>'
                + '</tr>';
        },
        cardContent: function(op, smFmt, smFmtK, saldoCor) {
            const res     = cfg.getResultado(op);
            const premTot = cfg.getMonetaryValue(op);
            const status  = (op.status || '').toUpperCase();
            const cardCls = status === 'ABERTA' ? 'c-open' : (res >= 0 ? 'c-win' : 'c-loss');
            const resCls  = res >= 0 ? 'text-success' : 'text-danger';
            const pctBase = saldoCor || cfg.getSaldoAbertura(op, 0);
            const pct     = pctBase ? ((premTot / pctBase) * 100).toFixed(2) + '%' : '—';
            const ativoNome = cfg.getAtivo(op);
            const dataRef = op.data_fechamento || op.data_operacao || op.vencimento || op.exercicio || '';
            const strike  = cfg.getStrike(op);
            return '<div class="sm-op-card ' + cardCls + '">'
                + '<div class="sm-op-card-top">'
                + '<span class="sm-op-ativo">' + _esc(ativoNome) + '</span>'
                + '<span class="badge ' + _statusBadge(op.status) + ' ms-1">' + _esc(status) + '</span>'
                + '</div>'
                + '<div class="sm-op-tipo text-muted">' + _esc(cfg.getTipo(op))
                + (strike ? ' · K ' + _esc(String(strike)) : '')
                + (dataRef ? ' · ' + _esc(dataRef) : '') + '</div>'
                + '<div class="sm-op-res ' + resCls + '">' + smFmt(res) + ' <small>(' + pct + ')</small></div>'
                + '<div class="sm-op-prem text-muted">Prêmio: ' + smFmt(cfg.getUnitPremium(op)) + '</div>'
                + '</div>';
        },
    };

    function configure(opts) {
        Object.assign(cfg, opts);
        setupTriggers();
    }

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
        if (cfg.currency === 'USD') {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
        }
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    }

    function smFmtK(v) {
        const n = Math.abs(v);
        if (cfg.currency === 'USD') {
            if (n >= 1000) return (v < 0 ? '-' : '') + '$' + (n / 1000).toFixed(1) + 'k';
            return smFmt(v);
        }
        if (n >= 1000) return (v < 0 ? '-' : '') + 'R$' + (n / 1000).toFixed(1) + 'k';
        return smFmt(v);
    }

    function smPctFmt(v) {
        return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
    }

    function getSaldoCorretora() {
        return cfg.getSaldo();
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
                            formatter: function (v) { return v.toFixed(2) + '%'; },
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
    /* Lazy-load do HTML da modal                                          */
    /* ------------------------------------------------------------------ */
    let _htmlLoading = false;

    async function ensureModalLoaded() {
        if (document.getElementById(cfg.modalElId)) return true;
        const container = document.getElementById(cfg.containerElId);
        if (!container || _htmlLoading) return !!document.getElementById(cfg.modalElId);
        _htmlLoading = true;
        try {
            const r = await fetch(cfg.templatePath);
            const html = await r.text();
            container.innerHTML = html;
            return true;
        } catch (err) {
            console.error('[modal-saldo-medio] Falha ao carregar template', err);
            return false;
        } finally {
            _htmlLoading = false;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Abre a modal                                                         */
    /* ------------------------------------------------------------------ */
    async function openModal() {
        const loaded = await ensureModalLoaded();
        if (!loaded) return;
        const modalEl = document.getElementById(cfg.modalElId);
        if (!modalEl) {
            console.warn('[modal-saldo-medio] Elemento #' + cfg.modalElId + ' não encontrado');
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

        fetch(cfg.apiEndpoint)
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
        const ganhos    = fechadas.filter(o => cfg.getResultado(o) >= 0);
        const perdas    = fechadas.filter(o => cfg.getResultado(o) < 0);

        const totalPremio    = ops.reduce(function (a, o) { return a + cfg.getMonetaryValue(o); }, 0);
        const totalResultado = ops.reduce(function (a, o) { return a + cfg.getResultado(o); }, 0);
        const totalSaldo     = ops.reduce(function (a, o) { return a + (parseFloat(o.saldo_abertura || o.abertura || 0)); }, 0);
        const mediaSaldo    = ops.length ? totalSaldo / ops.length : 0;

        // pop: só considera valores > 0 (sem dados nulos ou zerados)
        const popVals   = ops.filter(function (o) { return cfg.getPop(o) !== null; }).map(function (o) { return cfg.getPop(o); });
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

        _setText('smGPoPsub',  popMedio > 0 ? popMedio.toFixed(2) + '%' : 'sem dados');
        _setText('smGWinsub',  ganhos.length + '/' + fechadas.length + ' ops');
        _setText('smGRetsub',  retPremio.toFixed(2) + '%');
        _setText('smGRet2sub', retSaldo.toFixed(2) + '%');

        /* ── Tabela ── */
        const tbody = document.getElementById('smOpsTbody');
        if (tbody) {
            if (!ops.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Nenhuma operação encontrada.</td></tr>';
            } else {
                tbody.innerHTML = ops.map(function (o) {
                    return cfg.tableRow(o, smFmt, saldoCorretora);
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
                { lbl: 'Win rate',           val: winRate.toFixed(2) + '%',  cls: winRate >= 60 ? 'text-success' : winRate >= 40 ? 'text-warning' : 'text-danger' },
                { lbl: 'Retenção prêmio',    val: retPremio.toFixed(2) + '%', cls: retPremio >= 0 ? 'text-success' : 'text-danger' },
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
                        return arr.reduce(function (a, o) { return a + cfg.getResultado(o); }, 0);
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
        const byAtivo = _groupByFn(ops, function(o) { return o.ativo_base || o.ativo || 'Outro'; });
        const barEl   = document.getElementById('smChartBar');
        if (barEl) {
            barEl.innerHTML = '';
            if (ops.length) {
                const cats = Object.keys(byAtivo);
                const vals = cats.map(function (k) {
                    return byAtivo[k].reduce(function (a, o) { return a + cfg.getMonetaryValue(o); }, 0);
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
            return cfg.cardContent(o, smFmt, smFmtK, saldoCorretora);
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

    function _groupByFn(arr, fn) {
        return arr.reduce(function (acc, o) {
            const k = fn(o);
            (acc[k] = acc[k] || []).push(o);
            return acc;
        }, {});
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
        const card = document.getElementById(cfg.triggerCard);
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

    window.ModalSaldoMedio = { configure: configure, openModal: openModal };

})();

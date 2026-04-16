/**
 * modal-saldo-medio-crypto.js  v2.0.0
 * Mapa de Ativos para operações crypto com filtros no padrão da modal Resultados.
 */
(function () {
    'use strict';

    const cfg = {
        currency: 'USD',
        apiEndpoint: '/api/crypto',
        modalElId: 'modalSaldoMedio',
        containerElId: 'modalSaldoMedioCryptoContainer',
        templatePath: 'modal-saldo-medio-crypto.html',
        triggerCard: 'cardResultadoMedioCryptoCard',
        getSaldo: function () {
            try {
                const c = JSON.parse(localStorage.getItem('cryptoConfig') || '{}');
                const a = JSON.parse(localStorage.getItem('appConfig') || '{}');
                const v = parseFloat(c.saldoCrypto || a.saldoCrypto || 0);
                return Number.isNaN(v) ? 0 : v;
            } catch (e) {
                return 0;
            }
        },
        getMonetaryValue: function (op) { return parseFloat(op.premio_us || 0); },
        getUnitPremium: function (op) { return parseFloat(op.premio_us || 0); },
        getQuantity: function () { return 1; },
        getResultado: function (op) { return parseFloat(op.premio_us || 0); },
        getSaldoAbertura: function (op, fallback) {
            return parseFloat(op.abertura || 0) || fallback;
        },
        getPop: function () { return null; },
        getAtivo: function (op) { return op.ativo || op.ativo_base || '—'; },
        getTipo: function (op) { return op.tipo || '—'; },
        getStrike: function (op) { return op.strike || null; },
        tableRow: function (op, smFmt, saldoCor) {
            const res = cfg.getResultado(op);
            const prem = cfg.getUnitPremium(op);
            const qtd = cfg.getQuantity(op);
            const premTot = cfg.getMonetaryValue(op);
            const saldoOp = cfg.getSaldoAbertura(op, saldoCor);
            const pct = saldoOp ? (res / saldoOp) * 100 : 0;
            const pop = cfg.getPop(op);

            return '<tr>'
                + '<td><strong>' + esc(cfg.getAtivo(op)) + '</strong></td>'
                + '<td>' + esc(cfg.getTipo(op)) + '</td>'
                + '<td title="Unit: ' + smFmt(prem) + ' × ' + qtd + '">' + smFmt(premTot) + '</td>'
                + '<td class="' + (pct >= 0 ? 'text-success' : 'text-danger') + '">' + pct.toFixed(2) + '%</td>'
                + '<td>' + (pop !== null ? pop.toFixed(0) + '%' : '—') + '</td>'
                + '<td>' + (op.dias != null ? op.dias : '—') + '</td>'
                + '<td class="' + (res >= 0 ? 'text-success' : 'text-danger') + '">' + smFmt(res) + '</td>'
                + '<td><span class="badge ' + statusBadge(op.status) + '">' + esc(op.status || '—') + '</span></td>'
                + '</tr>';
        },
    };

    const charts = { donut: null, bar: null };
    const FILTER_DEFAULTS = {
        period: 'all',
        status: 'aberta',
        tipo: null,
        coins: null,
    };
    let apexLoaded = false;
    let htmlLoading = false;
    let currentOps = [];
    let activePeriod = FILTER_DEFAULTS.period;
    let activeStatus = FILTER_DEFAULTS.status;
    let activeTipo = FILTER_DEFAULTS.tipo;
    let activeCoins = FILTER_DEFAULTS.coins;

    function configure(opts) {
        Object.assign(cfg, opts);
        setupTriggers();
    }

    function smFmt(v) {
        if (window.CryptoExerciseStatus?.formatUsd) {
            return window.CryptoExerciseStatus.formatUsd(v);
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
    }

    function smFmtK(v) {
        const n = Math.abs(v);
        if (n >= 1000) return (v < 0 ? '-' : '') + 'US$ ' + (n / 1000).toFixed(1) + 'k';
        return smFmt(v);
    }

    function smPctFmt(v) {
        return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
    }

    function ensureApex(cb) {
        if (typeof ApexCharts !== 'undefined') {
            apexLoaded = true;
            cb();
            return;
        }
        if (apexLoaded) {
            cb();
            return;
        }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3/dist/apexcharts.min.js';
        s.onload = function () {
            apexLoaded = true;
            cb();
        };
        s.onerror = function () {
            console.error('[modal-saldo-medio] Falha ao carregar ApexCharts');
        };
        document.head.appendChild(s);
    }

    function apexTheme() {
        return {
            theme: { mode: 'dark' },
            chart: { background: 'transparent', foreColor: '#94a3b8' },
        };
    }

    async function ensureModalLoaded() {
        if (document.getElementById(cfg.modalElId)) return true;
        const container = document.getElementById(cfg.containerElId);
        if (!container || htmlLoading) return !!document.getElementById(cfg.modalElId);
        htmlLoading = true;
        try {
            const r = await fetch(cfg.templatePath);
            const html = await r.text();
            container.innerHTML = html;
            return true;
        } catch (err) {
            console.error('[modal-saldo-medio] Falha ao carregar template', err);
            return false;
        } finally {
            htmlLoading = false;
        }
    }

    async function openModal() {
        const loaded = await ensureModalLoaded();
        if (!loaded) return;

        const modalEl = document.getElementById(cfg.modalElId);
        if (!modalEl) return;

        const refreshBtn = document.getElementById('btnRefreshSaldoMedio');
        if (refreshBtn && !refreshBtn._smBound) {
            refreshBtn._smBound = true;
            refreshBtn.addEventListener('click', function () { loadAndRender(true); });
        }

        setupFilterListeners(modalEl);
        resetFilters();
        updateFilterUi(modalEl);

        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl, { keyboard: true });
        modal.show();
        loadAndRender(false);
    }

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
                ensureApex(function () { render(); });
                const tsEl = document.getElementById('smLastUpdated');
                if (tsEl) {
                    const now = new Date();
                    tsEl.textContent = 'Atualizado: ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                }
            })
            .catch(function (err) {
                console.error('[modal-saldo-medio]', err);
                if (typeof iziToast !== 'undefined') {
                    iziToast.warning({
                        title: 'Atenção',
                        message: 'Não foi possível carregar os dados do mapa de ativos.',
                        position: 'topRight',
                    });
                }
            });
    }

    function render() {
        const saldoCorretora = cfg.getSaldo();
        const opsNoCoinFilter = applyFilters(currentOps, true);
        const ops = applyFilters(currentOps, false);

        renderCoinPills(opsNoCoinFilter);

        const fechadas = ops.filter(function (o) { return (o.status || '').toUpperCase() === 'FECHADA'; });
        const abertas = ops.filter(function (o) { return (o.status || '').toUpperCase() === 'ABERTA'; });
        const exercidas = ops.filter(isExercised);
        const totalPremio = ops.reduce(function (s, o) { return s + cfg.getMonetaryValue(o); }, 0);
        const totalResultado = ops.reduce(function (s, o) { return s + cfg.getResultado(o); }, 0);
        const mediaSaldo = ops.length
            ? ops.reduce(function (s, o) { return s + (parseFloat(o.saldo_abertura || o.abertura || 0) || 0); }, 0) / ops.length
            : 0;
        const baseRetorno = saldoCorretora > 0 ? saldoCorretora : mediaSaldo;
        const retSaldo = baseRetorno ? (totalResultado / baseRetorno) * 100 : 0;

        setText('smAmount', smFmt(totalResultado));
        setText('smPct', baseRetorno ? smPctFmt(retSaldo) : '');
        setText('smSub', ops.length + ' operações filtradas · saldo médio ' + smFmt(mediaSaldo));

        const pillsEl = document.getElementById('smPills');
        if (pillsEl) {
            pillsEl.innerHTML = ''
                + pill(abertas.length, 'Abertas', '#206bc4')
                + pill(fechadas.length, 'Fechadas', '#94a3b8')
                + pill(exercidas.length, 'Exercidas', '#2fb344')
                + pill(ops.length - exercidas.length, 'Não Exercidas', '#d63939');
        }

        setText('smKpiOps', String(ops.length));
        setText('smKpiEx', String(exercidas.length));
        setText('smKpiPremio', smFmt(totalPremio));
        setText('smKpiResultado', smFmt(totalResultado));

        const exercisedWithStrike = exercidas.filter(function (o) {
            return Number.isFinite(parseFloat(cfg.getStrike(o)));
        });
        const custoMedio = exercisedWithStrike.length
            ? exercisedWithStrike.reduce(function (s, o) { return s + parseFloat(cfg.getStrike(o)); }, 0) / exercisedWithStrike.length
            : 0;
        setText('smKpiCusto', custoMedio > 0 ? smFmt(custoMedio) : '—');

        const totalEl = document.getElementById('smOpsTotal');
        if (totalEl) {
            totalEl.innerHTML = 'Total do filtro: <strong class="' + (totalResultado >= 0 ? 'text-success' : 'text-danger') + '">' + smFmt(totalResultado) + '</strong>';
        }

        renderAssetMap(ops);
        renderTable(ops, saldoCorretora);
        renderCharts(ops);
    }

    function renderAssetMap(ops) {
        const grid = document.getElementById('smAssetMapGrid');
        if (!grid) return;

        const grouped = groupByCoin(ops);
        const assets = Object.keys(grouped).sort();
        if (!assets.length) {
            grid.innerHTML = '<div class="text-muted ps-1">Nenhuma operação encontrada para os filtros atuais.</div>';
            return;
        }

        const maiorPremio = Math.max.apply(null, assets.map(function (c) { return grouped[c].premio; }));
        grid.innerHTML = assets.map(function (coin) {
            const a = grouped[coin];
            const exRate = a.ops ? (a.exercidas / a.ops) * 100 : 0;
            const premioPct = maiorPremio > 0 ? (a.premio / maiorPremio) * 100 : 0;

            return '<article class="sm-asset-card">'
                + '<div class="sm-asset-head"><span class="sm-asset-name">' + esc(coin) + '</span><span class="sm-asset-count">' + a.ops + ' ops</span></div>'
                + '<div class="sm-asset-metrics">'
                + '<div><span>Exercidas</span><strong>' + a.exercidas + '</strong></div>'
                + '<div><span>Prêmio</span><strong>' + smFmt(a.premio) + '</strong></div>'
                + '<div><span>Resultado</span><strong class="' + (a.resultado >= 0 ? 'text-success' : 'text-danger') + '">' + smFmt(a.resultado) + '</strong></div>'
                + '<div><span>Custo Médio</span><strong>' + (a.custo > 0 ? smFmt(a.custo) : '—') + '</strong></div>'
                + '</div>'
                + '<div class="sm-asset-bars">'
                + '<div class="sm-asset-bar"><span>Taxa de exercício</span><div><i style="width:' + exRate.toFixed(1) + '%"></i></div><strong>' + exRate.toFixed(1) + '%</strong></div>'
                + '<div class="sm-asset-bar sm-asset-bar-gold"><span>Peso no prêmio</span><div><i style="width:' + premioPct.toFixed(1) + '%"></i></div><strong>' + premioPct.toFixed(1) + '%</strong></div>'
                + '</div>'
                + '</article>';
        }).join('');
    }

    function renderTable(ops, saldoCorretora) {
        const tbody = document.getElementById('smOpsTbody');
        if (!tbody) return;
        if (!ops.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Nenhuma operação encontrada.</td></tr>';
            return;
        }
        tbody.innerHTML = ops.map(function (o) {
            return cfg.tableRow(o, smFmt, saldoCorretora);
        }).join('');
    }

    function renderCharts(ops) {
        destroyCharts();

        const byCoin = groupByCoin(ops);
        const labels = Object.keys(byCoin);
        const donutEl = document.getElementById('smChartDonut');
        const barEl = document.getElementById('smChartBar');

        if (donutEl) {
            donutEl.innerHTML = '';
            if (labels.length) {
                charts.donut = new ApexCharts(donutEl, {
                    ...apexTheme(),
                    chart: {
                        ...apexTheme().chart,
                        type: 'donut',
                        height: 240,
                        animations: { enabled: true, speed: 600 },
                    },
                    labels: labels,
                    series: labels.map(function (k) { return byCoin[k].resultado; }),
                    colors: ['#00d4e8', '#2fb344', '#f59f00', '#6366f1', '#ff4d6a', '#94a3b8'],
                    dataLabels: { enabled: true },
                    legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
                    plotOptions: { pie: { donut: { size: '60%' } } },
                    tooltip: { y: { formatter: function (v) { return smFmt(v); } } },
                });
                charts.donut.render();
            }
        }

        if (barEl) {
            barEl.innerHTML = '';
            if (labels.length) {
                charts.bar = new ApexCharts(barEl, {
                    ...apexTheme(),
                    chart: {
                        ...apexTheme().chart,
                        type: 'bar',
                        height: 240,
                        toolbar: { show: false },
                        animations: { enabled: true, speed: 600 },
                    },
                    series: [{ name: 'Prêmio', data: labels.map(function (k) { return byCoin[k].premio; }) }],
                    xaxis: { categories: labels, labels: { style: { colors: '#94a3b8' } } },
                    yaxis: {
                        labels: {
                            formatter: function (v) { return smFmtK(v); },
                            style: { colors: '#94a3b8' },
                        },
                    },
                    colors: ['#f59f00'],
                    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
                    dataLabels: { enabled: false },
                    tooltip: { y: { formatter: function (v) { return smFmt(v); } } },
                });
                charts.bar.render();
            }
        }
    }

    function setupFilterListeners(modalEl) {
        if (modalEl._smFilterBound) return;
        modalEl._smFilterBound = true;

        modalEl.querySelectorAll('#smPeriodPills .rmc-pill[data-period]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activePeriod = this.dataset.period || 'all';
                updateFilterUi(modalEl);
                render();
            });
        });

        modalEl.querySelectorAll('#smStatusPills .rmc-pill[data-type]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const t = this.dataset.type;
                activeStatus = activeStatus === t ? null : t;
                updateFilterUi(modalEl);
                render();
            });
        });

        modalEl.querySelectorAll('#smTipoPills .rmc-pill[data-tipo]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const t = this.dataset.tipo;
                activeTipo = activeTipo === t ? null : t;
                updateFilterUi(modalEl);
                render();
            });
        });
    }

    function renderCoinPills(baseOps) {
        const wrap = document.getElementById('smCoinPills');
        if (!wrap) return;

        const coins = Array.from(new Set((baseOps || []).map(getCoinSymbol))).filter(Boolean).sort();
        if (activeCoins instanceof Set) {
            activeCoins = new Set(Array.from(activeCoins).filter(function (coin) { return coins.includes(coin); }));
            if (!activeCoins.size || activeCoins.size === coins.length) activeCoins = null;
        }

        let html = '<button class="rmc-pill' + (activeCoins === null ? ' active' : '') + '" data-coin="all">Todas moedas</button>';
        html += coins.map(function (coin) {
            const cls = activeCoins instanceof Set && activeCoins.has(coin) ? ' active' : '';
            return '<button class="rmc-pill sm-coin-pill' + cls + '" data-coin="' + esc(coin) + '">' + esc(coin) + '</button>';
        }).join('');
        wrap.innerHTML = html;

        wrap.querySelectorAll('.rmc-pill[data-coin]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const coin = this.dataset.coin;
                if (coin === 'all') {
                    activeCoins = null;
                } else if (!(activeCoins instanceof Set)) {
                    activeCoins = new Set([coin]);
                } else if (activeCoins.has(coin)) {
                    activeCoins.delete(coin);
                    if (!activeCoins.size) activeCoins = null;
                } else {
                    activeCoins.add(coin);
                    if (activeCoins.size === coins.length) activeCoins = null;
                }
                render();
            });
        });
    }

    function updateFilterUi(modalEl) {
        modalEl.querySelectorAll('#smPeriodPills .rmc-pill[data-period]').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.period === activePeriod);
        });
        modalEl.querySelectorAll('#smStatusPills .rmc-pill[data-type]').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.type === activeStatus);
        });
        modalEl.querySelectorAll('#smTipoPills .rmc-pill[data-tipo]').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.tipo === activeTipo);
        });
    }

    function resetFilters() {
        activePeriod = FILTER_DEFAULTS.period;
        activeStatus = FILTER_DEFAULTS.status;
        activeTipo = FILTER_DEFAULTS.tipo;
        activeCoins = FILTER_DEFAULTS.coins;
    }

    function applyFilters(ops, ignoreCoinFilter) {
        let result = Array.isArray(ops) ? ops.slice() : [];
        result = filterByPeriod(result, activePeriod);

        if (activeStatus) {
            result = result.filter(function (o) {
                return (o.status || 'ABERTA').toUpperCase() === activeStatus.toUpperCase();
            });
        }
        if (activeTipo) {
            result = result.filter(function (o) {
                return (o.tipo || '').toUpperCase() === activeTipo;
            });
        }
        if (!ignoreCoinFilter && activeCoins instanceof Set && activeCoins.size > 0) {
            result = result.filter(function (o) {
                return activeCoins.has(getCoinSymbol(o));
            });
        }
        return result;
    }

    function filterByPeriod(ops, period) {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const y = now.getFullYear();
        const m = now.getMonth();

        function after(days) {
            const d = new Date(now);
            d.setDate(d.getDate() - days);
            return d;
        }

        return ops.filter(function (op) {
            const raw = op.data_operacao || op.data_abertura || op.exercicio || op.vencimento || '';
            const d = dateOf(raw);
            if (!d && period !== 'all') return false;

            switch (period) {
                case 'all': return true;
                case 'today': return raw.slice(0, 10) === todayStr;
                case '7d': return d >= after(7);
                case '15d': return d >= after(15);
                case '30d': return d >= after(30);
                case '90d': return d >= after(90);
                case '12m': return d >= after(365);
                case 'mes': return d.getFullYear() === y && d.getMonth() === m;
                case 'ano': return d.getFullYear() === y;
                default: return true;
            }
        });
    }

    function groupByCoin(ops) {
        return (ops || []).reduce(function (acc, op) {
            const coin = getCoinSymbol(op);
            if (!acc[coin]) {
                acc[coin] = { ops: 0, exercidas: 0, premio: 0, resultado: 0, strikeSum: 0, strikeCount: 0 };
            }
            const row = acc[coin];
            row.ops += 1;
            row.premio += cfg.getMonetaryValue(op);
            row.resultado += cfg.getResultado(op);
            if (isExercised(op)) row.exercidas += 1;

            const strike = parseFloat(cfg.getStrike(op));
            if (Number.isFinite(strike)) {
                row.strikeSum += strike;
                row.strikeCount += 1;
            }

            row.custo = row.strikeCount ? row.strikeSum / row.strikeCount : 0;
            return acc;
        }, {});
    }

    function getCoinSymbol(op) {
        const raw = String(op.ativo_base || op.ativo || '').toUpperCase();
        if (!raw) return 'OUTROS';
        if (raw.includes('/')) return raw.split('/')[0] || 'OUTROS';
        if (raw.includes('-')) return raw.split('-')[0] || 'OUTROS';
        if (raw.startsWith('BTC')) return 'BTC';
        if (raw.startsWith('ETH')) return 'ETH';
        if (raw.startsWith('SOL')) return 'SOL';
        return raw.slice(0, 6);
    }

    function isExercised(op) {
        if (window.CryptoExerciseStatus?.isExercised) {
            return !!window.CryptoExerciseStatus.isExercised(op);
        }
        const ex = String(op.exercicio || '').trim().toUpperCase();
        return ex === 'SIM' || ex === 'TRUE' || ex === 'EXERCIDO';
    }

    function dateOf(str) {
        if (!str) return null;
        const d = new Date(String(str).includes('T') ? str : String(str) + 'T00:00:00');
        return Number.isNaN(d.getTime()) ? null : d;
    }

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

    }

    function destroyCharts() {
        Object.keys(charts).forEach(function (k) {
            if (!charts[k]) return;
            try { charts[k].destroy(); } catch (e) { /* ignore */ }
            charts[k] = null;
        });
    }

    function setText(id, txt) {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    }

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function pill(n, label, color) {
        return '<span class="sm-pill" style="background:' + color + '20;color:' + color + ';border:1px solid ' + color + '55">'
            + n + ' ' + label + '</span>';
    }

    function statusBadge(status) {
        const map = {
            ABERTA: 'bg-blue-lt text-primary',
            FECHADA: 'bg-green-lt text-success',
            VENCIDA: 'bg-secondary-lt text-secondary',
            PERDIDA: 'bg-red-lt text-danger',
        };
        return map[(status || '').toUpperCase()] || 'bg-secondary-lt text-secondary';
    }

    document.addEventListener('layoutReady', function () { setupTriggers(); });
    window.addEventListener('load', function () { setupTriggers(); });

    window.ModalSaldoMedioCrypto = { configure: configure, openModal: openModal };
})();

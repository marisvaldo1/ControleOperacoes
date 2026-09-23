// posicoes-abertas.js — Tela de Posições Abertas (mobile-first)
// v1.2.0 — accordion da 1ª posição aberto por default + cotações em tempo real (CryptoLive)
(function () {
    'use strict';

    var _currentFilter = 'ALL';
    var _allOps = [];
    var _liveBound = false;
    var _quoteThrottle = {};

    function usd(n) {
        return 'US$ ' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtShort(n) {
        var abs = Math.abs(n);
        if (abs >= 1000) return (n / 1000).toFixed(2) + 'k';
        return n.toFixed(2);
    }

    function isOpen(op) {
        var s = String(op.status || '').toUpperCase();
        return s === 'ABERTA' || s === 'ABERTO';
    }

    function normalizeAsset(op) {
        return String(op.ativo || '').toUpperCase().replace('USDT', '').replace('/', '').trim();
    }

    function getRiskStatus(op) {
        var strike = parseFloat(op.strike || 0);
        var cot = parseFloat(op.cotacao_atual || 0);
        var tipo = String(op.tipo || '').toUpperCase();
        if (!strike || !cot) return { cls: 'segura', label: 'SEGURA' };
        var dist = ((cot - strike) / strike) * 100;

        if (tipo === 'PUT') {
            if (dist < -3) return { cls: 'risco', label: 'EM RISCO' };
            if (dist < 0) return { cls: 'cuidado', label: 'CUIDADO' };
            return { cls: 'segura', label: 'SEGURA' };
        }
        if (dist > 3) return { cls: 'risco', label: 'EM RISCO' };
        if (dist > 0) return { cls: 'cuidado', label: 'CUIDADO' };
        return { cls: 'segura', label: 'SEGURA' };
    }

    function calcDistancia(op) {
        var strike = parseFloat(op.strike || 0);
        var cot = parseFloat(op.cotacao_atual || 0);
        if (!strike || !cot) return 0;
        return ((cot - strike) / strike) * 100;
    }

    function computePM(asset) {
        if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.computeData === 'function') {
            try {
                var d = window.ModalPrecoMedioAtivo.computeData(asset);
                return d && d.pm > 0 ? d.pm : 0;
            } catch (e) { return 0; }
        }
        return 0;
    }

    function thermoStatus(strike, cot, tipo) {
        if (!strike || !cot) return { cls: 'itm', pct: '0.00' };
        var diff = cot - strike;
        var pct = (diff / strike * 100).toFixed(2);
        var isCall = String(tipo || '').toUpperCase() === 'CALL';
        var isITM = isCall ? (diff >= 0) : (diff <= 0);
        return { cls: isITM ? 'otm' : 'itm', pct: pct };
    }

    function buildThermoSvg(strike, cot, tipo) {
        if (!strike || !cot) return '';
        var spread = Math.abs(cot - strike);
        var margin = Math.max(spread * 1.5, Math.max(strike, cot) * 0.08);
        var MIN = Math.max(0, Math.min(strike, cot) - margin);
        var MAX = Math.max(strike, cot) + margin;
        var clamp = function (v) { return Math.max(0, Math.min(1, (v - MIN) / (MAX - MIN))); };

        var totalH = 140, barW = 48, y0 = 22;
        var sx = 110, qx = 210;
        var sh = clamp(strike) * totalH;
        var qh = clamp(cot) * totalH;
        var sy0 = y0 + totalH - sh;
        var qy0 = y0 + totalH - qh;

        var st = thermoStatus(strike, cot, tipo);
        var statusColor = st.cls === 'otm' ? '#ef4444' : '#22c55e';
        var zoneH = totalH / 3;
        var zoneColors = ['#991b1b', '#a16207', '#166534'];

        var h = '';
        for (var i = 0; i <= 6; i++) {
            var gy = y0 + totalH - (i / 6) * totalH;
            var val = MIN + (MAX - MIN) / 6 * i;
            var label = val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0);
            h += '<line x1="48" y1="' + gy + '" x2="272" y2="' + gy + '" stroke="#334d6e" stroke-width="1"/>';
            h += '<text x="40" y="' + (gy + 3) + '" fill="#8aa4c0" font-size="9" text-anchor="end">' + label + '</text>';
            h += '<text x="278" y="' + (gy + 3) + '" fill="#8aa4c0" font-size="9">' + label + '</text>';
        }

        function tube(cx) {
            var t = '';
            for (var z = 0; z < 3; z++) {
                var zy = y0 + totalH - (z + 1) * zoneH;
                t += '<rect x="' + (cx - barW / 2) + '" y="' + zy + '" width="' + barW + '" height="' + zoneH + '" fill="' + zoneColors[z] + '" opacity=".6" rx="2"/>';
            }
            t += '<rect x="' + (cx - barW / 2) + '" y="' + y0 + '" width="' + barW + '" height="' + totalH + '" fill="none" stroke="#334155" stroke-width="1.5" rx="8"/>';
            return t;
        }

        h += tube(sx);
        h += tube(qx);
        h += '<rect x="' + (sx - barW / 2 + 3) + '" y="' + sy0 + '" width="' + (barW - 6) + '" height="' + sh + '" fill="#60a5fa" rx="5"/>';
        h += '<circle cx="' + sx + '" cy="' + sy0 + '" r="5" fill="#93c5fd"/>';
        h += '<rect x="' + (qx - barW / 2 + 3) + '" y="' + qy0 + '" width="' + (barW - 6) + '" height="' + qh + '" fill="' + statusColor + '" rx="5"/>';
        h += '<circle cx="' + qx + '" cy="' + qy0 + '" r="5" fill="' + statusColor + '"/>';
        h += '<line x1="' + sx + '" y1="' + sy0 + '" x2="' + qx + '" y2="' + qy0 + '" stroke="' + statusColor + '" stroke-width="2" stroke-dasharray="5,4" opacity=".8"/>';

        var midX = (sx + qx) / 2;
        var arrowY = Math.min(sy0, qy0) - 16;
        var diff = cot - strike;
        var sign = diff > 0 ? '\u25B2' : diff < 0 ? '\u25BC' : '=';
        h += '<text x="' + midX + '" y="' + arrowY + '" fill="' + statusColor + '" font-size="14" text-anchor="middle">' + sign + '</text>';
        h += '<text x="' + midX + '" y="' + (arrowY + 14) + '" fill="' + statusColor + '" font-size="11" text-anchor="middle" font-weight="700">' + (diff > 0 ? '+' : '') + fmtShort(diff) + '</text>';

        h += '<text x="' + sx + '" y="' + (y0 - 6) + '" fill="#60a5fa" font-size="11" text-anchor="middle" font-weight="700">Strike</text>';
        h += '<text x="' + qx + '" y="' + (y0 - 6) + '" fill="' + statusColor + '" font-size="11" text-anchor="middle" font-weight="700">Cotação</text>';
        h += '<text x="' + sx + '" y="' + (y0 + totalH + 18) + '" fill="#60a5fa" font-size="11" text-anchor="middle" font-weight="700">' + usd(strike) + '</text>';
        h += '<text x="' + qx + '" y="' + (y0 + totalH + 18) + '" fill="' + statusColor + '" font-size="11" text-anchor="middle" font-weight="700">' + usd(cot) + '</text>';

        return '<svg class="pa-thermo-svg" viewBox="0 0 320 ' + (y0 + totalH + 28) + '" width="100%" height="auto">' + h + '</svg>';
    }

    function calcPop(strike, cot, tipo) {
        if (!strike || !cot) return 50;
        var diff = cot - strike;
        var distPct = Math.abs(diff) / strike * 100;
        var isCall = String(tipo || '').toUpperCase() === 'CALL';
        var isITM = isCall ? (diff > 0) : (diff < 0);
        var pop = isITM ? Math.max(5, 50 - distPct * 4) : Math.min(95, 50 + distPct * 4);
        return Math.round(pop);
    }

    function buildMiniChart(asset, strike, cot, tipo) {
        var chartId = 'pa-tv-' + Math.random().toString(36).substr(2, 9);
        return '<div class="pa-tv-wrap"><div id="' + chartId + '" data-ticker="' + asset + 'USDT" data-theme="' +
            (document.body.getAttribute('data-bs-theme') || 'dark') + '"></div></div>';
    }

    function ensureTradingView(onReady) {
        if (globalThis.TradingView) { onReady(); return; }
        var existing = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
        if (existing && !existing.dataset.paBound) {
            existing.dataset.paBound = 'true';
            existing.addEventListener('load', onReady);
        } else if (!existing) {
            var s = document.createElement('script');
            s.src = 'https://s3.tradingview.com/tv.js';
            s.async = true;
            s.onload = onReady;
            document.head.appendChild(s);
        }
    }

    function mountMiniCharts(root) {
        if (!root) return;
        root.querySelectorAll('.pa-tv-wrap > div[id]').forEach(function (el) {
            if (el.dataset.mounted) return;
            ensureTradingView(function () {
                try {
                    new TradingView.widget({
                        symbol: el.getAttribute('data-ticker') || 'BTCUSDT',
                        interval: '60',
                        container_id: el.id,
                        locale: 'pt_BR',
                        theme: el.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
                        style: '1',
                        enable_publishing: false,
                        allow_symbol_change: false,
                        hide_side_toolbar: true,
                        hide_top_toolbar: true,
                        hide_legend: true,
                        save_image: false,
                        fullscreen: false,
                        autosize: true,
                        studies: []
                    });
                    el.dataset.mounted = '1';
                } catch (e) { /* TradingView indisponível */ }
            });
        });
    }

    function renderCard(op, idx) {
        var asset = normalizeAsset(op);
        var tipo = String(op.tipo || '').toUpperCase();
        var risk = getRiskStatus(op);
        var dist = calcDistancia(op);
        var premio = parseFloat(op.premio_us || 0);
        var strike = parseFloat(op.strike || 0);
        var cot = parseFloat(op.cotacao_atual || 0);
        var corr = String(op.corretora || 'BINANCE').toUpperCase();
        var corrLabel = corr === 'BINANCE' ? 'BNC' : corr === 'BYBIT' ? 'BB' : corr;
        var seal = thermoStatus(strike, cot, tipo);
        var sealColor = seal.cls === 'otm' ? '#ef4444' : '#22c55e';
        var sealLabel = seal.cls === 'otm' ? 'EM EXERCÍCIO' : 'SEGURA';
        var sealSign = parseFloat(seal.pct) >= 0 ? '+' : '';
        var pop = calcPop(strike, cot, tipo);
        var popColor = pop >= 50 ? '#22c55e' : '#ef4444';
        var pm = computePM(asset);
        var diff = cot - strike;
        var diffColor = sealColor;
        var bodyId = 'pa-body-' + (op.id || idx);

        var pmHtml = '';
        if (pm > 0) {
            if (window.CryptoUtils && window.CryptoUtils.renderPmLink) {
                pmHtml = '<div class="pa-td-badge"><span>PM:</span> ' + window.CryptoUtils.renderPmLink(asset, pm) + '</div>';
            } else {
                pmHtml = '<div class="pa-td-badge"><span>PM:</span> <span class="pa-td-val" style="color:#f2a900">' + usd(pm) + '</span></div>';
            }
        }

        return '' +
            '<div class="pa-card" data-asset="' + asset + '" data-id="' + (op.id || '') + '" data-idx="' + idx + '"' +
                ' data-strike="' + strike + '" data-tipo="' + tipo + '" data-cot="' + cot + '">' +
                '<div class="pa-card-header" data-toggle="' + bodyId + '">' +
                    '<span class="pa-asset-badge">' + asset + '</span>' +
                    '<span class="pa-type-badge ' + tipo.toLowerCase() + '">' + tipo + '</span>' +
                    '<span class="pa-corr-badge">' + corrLabel + '</span>' +
                    '<span class="pa-status-badge ' + risk.cls + '">' + risk.label + '</span>' +
                    '<span class="pa-seal-badge" style="background:rgba(' + (seal.cls === 'otm' ? '239,68,68' : '34,197,94') + ',.15);color:' + sealColor + ';border:1px solid ' + sealColor + '">' +
                        '<span class="pa-seal-dot" style="background:' + sealColor + '"></span>' +
                        sealLabel + ' ' + sealSign + seal.pct + '%' +
                    '</span>' +
                    '<span class="pa-premio-info">' +
                        '<span class="label">Prêmio Recebido:</span>' +
                        '<span class="value">+' + usd(premio) + '</span>' +
                    '</span>' +
                    '<span class="pa-toggle-ico">&#9654;</span>' +
                '</div>' +
                '<div class="pa-card-body hide" id="' + bodyId + '" style="display:none">' +
                    '<div class="pa-thermo-wrap">' +
                        buildThermoSvg(strike, cot, tipo) +
                    '</div>' +
                    '<div class="pa-tv-section">' +
                        buildMiniChart(asset, strike, cot, tipo) +
                    '</div>' +
                    '<div class="pa-diff-row">' +
                        '<div class="pa-td-badge"><span>Diferença:</span> <span class="pa-td-val" style="color:' + diffColor + '">' + (diff >= 0 ? '+' : '') + fmtShort(diff) + '</span></div>' +
                        '<div class="pa-td-badge"><span>PoP:</span> <span class="pa-td-val" style="color:' + popColor + '">' + pop + '%</span></div>' +
                        pmHtml +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function render() {
        var list = document.getElementById('paList');
        if (!list) return;

        var filtered = _allOps.filter(function (op) {
            if (!isOpen(op)) return false;
            if (_currentFilter !== 'ALL') {
                if (normalizeAsset(op) !== _currentFilter) return false;
            }
            return true;
        });

        var totalEl = document.getElementById('paTotalAbertas');
        var premioEl = document.getElementById('paPremioTotal');
        if (totalEl) totalEl.textContent = filtered.length;
        if (premioEl) {
            var totalPremio = filtered.reduce(function (s, op) { return s + (parseFloat(op.premio_us) || 0); }, 0);
            premioEl.textContent = usd(totalPremio);
        }

        if (!filtered.length) {
            list.innerHTML = '' +
                '<div class="pa-empty">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>' +
                    '<p>Nenhuma posição aberta encontrada</p>' +
                '</div>';
            return;
        }

        filtered.sort(function (a, b) {
            var ra = getRiskStatus(a).cls === 'risco' ? 0 : 1;
            var rb = getRiskStatus(b).cls === 'risco' ? 0 : 1;
            if (ra !== rb) return ra - rb;
            return String(b.ativo || '').localeCompare(String(a.ativo || ''));
        });

        list.innerHTML = filtered.map(renderCard).join('');
        bindCardToggles(list);
        openFirstCard(list);
        registerLiveAssets(filtered);
        syncLivePrices();
    }

    function openFirstCard(root) {
        var header = root.querySelector('.pa-card-header[data-toggle]');
        if (!header) return;
        var bodyId = header.getAttribute('data-toggle');
        var body = document.getElementById(bodyId);
        if (!body) return;
        body.style.display = 'block';
        body.classList.remove('hide');
        var ico = header.querySelector('.pa-toggle-ico');
        if (ico) ico.innerHTML = '&#9660;';
        var card = header.closest('.pa-card');
        if (card) card.classList.add('pa-card-active');
        setTimeout(function () { mountMiniCharts(body); }, 30);
    }

    function bindCardToggles(root) {
        root.querySelectorAll('.pa-card-header[data-toggle]').forEach(function (header) {
            header.addEventListener('click', function () {
                var bodyId = header.getAttribute('data-toggle');
                var body = document.getElementById(bodyId);
                if (!body) return;
                var isOpen = body.style.display !== 'none';

                root.querySelectorAll('.pa-card-body').forEach(function (b) {
                    if (b.id !== bodyId) {
                        b.style.display = 'none';
                        b.classList.add('hide');
                        var h = b.previousElementSibling;
                        if (h) {
                            var ico = h.querySelector('.pa-toggle-ico');
                            if (ico) ico.innerHTML = '&#9654;';
                        }
                    }
                });

                body.style.display = isOpen ? 'none' : 'block';
                body.classList.toggle('hide', isOpen);
                var toggleIco = header.querySelector('.pa-toggle-ico');
                if (toggleIco) toggleIco.innerHTML = isOpen ? '&#9654;' : '&#9660;';

                if (!isOpen) {
                    root.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('pa-card-active'); });
                    header.closest('.pa-card').classList.add('pa-card-active');
                    setTimeout(function () { mountMiniCharts(body); }, 30);
                }
            });
        });
    }

    function loadData() {
        var list = document.getElementById('paList');
        if (list) list.innerHTML = '<div class="pa-loading">Carregando posições...</div>';

        fetch(API_BASE + '/api/crypto', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                _allOps = Array.isArray(data) ? data : (data.operacoes || data.data || []);
                window.cryptoOperacoes = _allOps;
                render();
                refreshNavbarQuotes();
            })
            .catch(function (err) {
                console.error('[Posições Abertas] Erro ao carregar:', err);
                if (list) list.innerHTML = '<div class="pa-loading">Erro ao carregar dados. Verifique a conexão.</div>';
            });
    }

    // Cotações da navbar — leve, sem dependência de crypto.js
    function refreshNavbarQuotes() {
        var container = document.getElementById('navbarCryptoPrices');
        if (!container) return;

        var cfg = {};
        try { cfg = JSON.parse(localStorage.getItem('cryptoConfig') || '{}'); } catch (e) {}
        var ativosStr = cfg.navbarAtivos || 'BTC';
        var ativos = ativosStr.split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean).slice(0, 5);
        if (!ativos.length) ativos = ['BTC'];

        var COLORS = { BTC: '#f7931a', ETH: '#627eea', BNB: '#f3ba2f', SOL: '#9945ff', ADA: '#0033ad', USDT: '#26a17b' };
        var DEFAULTS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

        Promise.allSettled(ativos.map(function (ativo) {
            if (window.CryptoLive) {
                var p = window.CryptoLive.getPrice(ativo);
                if (p) return Promise.resolve({ price: parseFloat(p) });
            }
            if (ativo === 'USDT') return Promise.resolve({ price: 1.0 });
            return fetch(API_BASE + '/api/proxy/crypto/' + ativo + 'USDT').then(function (r) { return r.json(); });
        })).then(function (results) {
            var html = '';
            ativos.forEach(function (ativo, i) {
                var price = 0;
                var r = results[i];
                if (r && r.status === 'fulfilled' && r.value && r.value.price) {
                    price = parseFloat(r.value.price);
                } else if (window.CryptoLive && window.CryptoLive.getPrice(ativo)) {
                    price = parseFloat(window.CryptoLive.getPrice(ativo));
                }
                var color = COLORS[ativo] || DEFAULTS[i % DEFAULTS.length];
                var formatted = price > 0 ? 'US$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';
                html += '<span class="badge crypto-nav-badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '55;font-size:.78rem;cursor:pointer;padding:4px 10px;" data-nav-ativo="' + ativo + '">' + ativo + ' ' + formatted + '</span>';
            });
            container.innerHTML = html;
        }).catch(function () {});
    }

    function initFilters() {
        document.querySelectorAll('.pa-filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.pa-filter-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                _currentFilter = btn.getAttribute('data-asset') || 'ALL';
                render();
            });
        });
    }

    function initRefresh() {
        var btn = document.getElementById('btnRefreshPosicoes');
        if (btn) btn.addEventListener('click', loadData);

        var navRefresh = document.getElementById('btnRefresh');
        if (navRefresh && !navRefresh.dataset.paBound) {
            navRefresh.dataset.paBound = '1';
            navRefresh.addEventListener('click', function () {
                loadData();
                refreshNavbarQuotes();
            });
        }
    }

    /* ---------- Tempo real (CryptoLive — mesmo padrão do desktop) ---------- */

    function registerLiveAssets(ops) {
        if (!window.CryptoLive) return;
        var ativos = [];
        (ops || _allOps).forEach(function (op) {
            if (!isOpen(op)) return;
            var a = normalizeAsset(op);
            if (a && ativos.indexOf(a) === -1) ativos.push(a);
        });
        window.CryptoLive.ensureAssets(ativos);
    }

    function syncLivePrices() {
        if (!window.CryptoLive) return;
        document.querySelectorAll('#paList .pa-card[data-asset]').forEach(function (card) {
            var asset = card.getAttribute('data-asset');
            if (!asset) return;
            var cached = window.CryptoLive.getPrice(asset);
            if (cached) {
                updateCardLive(card, parseFloat(cached));
                return;
            }
            window.CryptoLive.fetchPrice(asset).then(function (price) {
                if (price) updateCardLive(card, parseFloat(price));
            });
        });
    }

    function updateCardLive(card, price) {
        if (!card || !isFinite(price) || price <= 0) return;
        var strike = parseFloat(card.getAttribute('data-strike') || 0);
        var tipo = card.getAttribute('data-tipo') || '';
        if (!strike) return;
        card.setAttribute('data-cot', price);

        var opId = card.getAttribute('data-id');
        var asset = card.getAttribute('data-asset');
        _allOps.forEach(function (op) {
            var match = (opId && String(op.id) === String(opId)) ||
                (!opId && normalizeAsset(op) === asset);
            if (match && isOpen(op)) op.cotacao_atual = price;
        });

        var risk = getRiskStatus({ strike: strike, cotacao_atual: price, tipo: tipo });
        var statusEl = card.querySelector('.pa-status-badge');
        if (statusEl) {
            statusEl.className = 'pa-status-badge ' + risk.cls;
            statusEl.textContent = risk.label;
        }

        var seal = thermoStatus(strike, price, tipo);
        var sealColor = seal.cls === 'otm' ? '#ef4444' : '#22c55e';
        var sealLabel = seal.cls === 'otm' ? 'EM EXERCÍCIO' : 'SEGURA';
        var sealSign = parseFloat(seal.pct) >= 0 ? '+' : '';
        var sealEl = card.querySelector('.pa-seal-badge');
        if (sealEl) {
            sealEl.style.background = 'rgba(' + (seal.cls === 'otm' ? '239,68,68' : '34,197,94') + ',.15)';
            sealEl.style.color = sealColor;
            sealEl.style.border = '1px solid ' + sealColor;
            sealEl.innerHTML = '<span class="pa-seal-dot" style="background:' + sealColor + '"></span>' +
                sealLabel + ' ' + sealSign + seal.pct + '%';
        }

        var body = card.querySelector('.pa-card-body');
        if (!body || body.style.display === 'none') return;

        var thermoWrap = body.querySelector('.pa-thermo-wrap');
        if (thermoWrap) thermoWrap.innerHTML = buildThermoSvg(strike, price, tipo);

        var diff = price - strike;
        var diffEl = body.querySelector('.pa-diff-row .pa-td-badge .pa-td-val');
        if (diffEl) {
            diffEl.style.color = sealColor;
            diffEl.textContent = (diff >= 0 ? '+' : '') + fmtShort(diff);
        }

        var pop = calcPop(strike, price, tipo);
        var popBadges = body.querySelectorAll('.pa-diff-row .pa-td-badge .pa-td-val');
        if (popBadges[1]) {
            popBadges[1].style.color = pop >= 50 ? '#22c55e' : '#ef4444';
            popBadges[1].textContent = pop + '%';
        }
    }

    function onLiveQuote(asset, price) {
        var norm = String(asset || '').toUpperCase().replace('USDT', '').replace('/', '');
        if (!norm || !isFinite(price) || price <= 0) return;
        document.querySelectorAll('#paList .pa-card[data-asset="' + norm + '"]').forEach(function (card) {
            updateCardLive(card, price);
        });
        refreshNavbarPriceLive(norm, price);
    }

    function refreshNavbarPriceLive(asset, price) {
        var badge = document.querySelector('#navbarCryptoPrices [data-nav-ativo="' + asset + '"]');
        if (!badge) return;
        badge.innerHTML = asset + ' US$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    function initLiveQuotes() {
        if (_liveBound) return;
        _liveBound = true;

        // cryptoLiveQuote é despachado em document (sem bubbles) — escutar em document
        document.addEventListener('cryptoLiveQuote', function (ev) {
            var d = ev.detail;
            if (!d || !d.asset || !d.price) return;
            var now = Date.now();
            var key = String(d.asset).toUpperCase();
            if (now - (_quoteThrottle[key] || 0) < 400) return;
            _quoteThrottle[key] = now;
            onLiveQuote(d.asset, d.price);
        });

        // Ticker de segurança (mesmo padrão da visão geral desktop, 2.5s):
        // garante atualização mesmo se o WS estiver bloqueado e o cache já tiver preço
        setInterval(function () {
            if (!window.CryptoLive || !document.getElementById('paList')) return;
            document.querySelectorAll('#paList .pa-card[data-asset]').forEach(function (card) {
                var asset = card.getAttribute('data-asset');
                var cached = asset ? window.CryptoLive.getPrice(asset) : null;
                if (cached) updateCardLive(card, parseFloat(cached));
            });
        }, 2500);
    }

    function init() {
        initFilters();
        initRefresh();
        initLiveQuotes();
        loadData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

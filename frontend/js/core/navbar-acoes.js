/**
 * navbar-acoes.js — Cotações de AÇÕES na navbar (paridade com CryptoNavbar).
 *
 * Lê a lista de ativos de `appConfig.navbarAtivosAcoes` (fallback:
 * `cryptoConfig.navbarAtivosAcoes`) e busca a cotação em
 * GET /api/cotacao/realtime/<ticker> (yfinance).
 *
 * Clique no badge abre o mapa de calor anual do ativo (paridade com o crypto).
 *
 * O container #navbarAcoesPrices é injetado por core/layout.js.
 * API pública: window.AcoesNavbar = { refresh }
 */
;(function () {
    'use strict';

    var DEFAULT_ACOES = ['PETR4', 'BBAS3', 'ITUB4', 'VALE3'];
    var POLL_MS = 5 * 60 * 1000;
    var COLORS = {
        PETR4: '#00915f', BBAS3: '#1e5fb4', ITUB4: '#ec7000', VALE3: '#0b8f5a',
        BBSE3: '#0f766e', BBDC4: '#b91c1c', ITSA4: '#f59e0b', ABEV3: '#2563eb',
        B3SA3: '#7c3aed', WEGE3: '#0891b2', RENT3: '#db2777', SUZB3: '#65a30d'
    };
    var FALLBACK_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

    var _timer = null;
    var _running = false;

    function tickers() {
        var raw = '';
        try {
            var app = JSON.parse(localStorage.getItem('appConfig') || '{}');
            var crypt = JSON.parse(localStorage.getItem('cryptoConfig') || '{}');
            raw = app.navbarAtivosAcoes || crypt.navbarAtivosAcoes || '';
        } catch (e) { /* noop */ }
        var list = String(raw).toUpperCase().split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 5);
        return list.length ? list : DEFAULT_ACOES.slice();
    }

    function colorFor(ticker, idx) {
        return COLORS[ticker] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
    }

    function brl(v) {
        return 'R$' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function pctLabel(v) {
        if (!isFinite(v)) return '';
        return (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(2).replace('.', ',') + '%';
    }

    function badgeHtml(ticker, idx, price, pct) {
        var color = colorFor(ticker, idx);
        var value = (price > 0) ? brl(price) : '—';
        var pctHtml = '';
        if (isFinite(pct)) {
            var pctColor = pct >= 0 ? '#22c55e' : '#ef4444';
            pctHtml = ' <i style="font-style:normal;color:' + pctColor + ';font-size:.68rem;">' + pctLabel(pct) + '</i>';
        }
        return '<span class="badge acoes-nav-badge" data-nav-acao="' + ticker + '" ' +
            'title="' + ticker + ' — clique para abrir o mapa de calor anual"' +
            'style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '55;' +
            'font-size:.78rem;padding:4px 10px;cursor:pointer;">' +
            ticker + ' ' + value + pctHtml + '</span>';
    }

    /* ── Mapa de calor anual do ativo (paridade com o crypto) ── */
    function abrirMapaCalor(ticker) {
        if (!ticker) return false;
        var mod = window.ModalPrecoMedioOpcoes;
        if (mod && typeof mod.open === 'function') {
            mod.open(ticker);
            return true;
        }
        mod = window.ModalPrecoMedioAtivoOpcoes;
        if (mod && typeof mod.openModal === 'function') {
            mod.openModal(ticker);
            return true;
        }
        return false;
    }

    function bindContainerClick(container) {
        if (!container || container.dataset.navAcoesBound === 'true') return;
        container.dataset.navAcoesBound = 'true';
        container.addEventListener('click', function (e) {
            var badge = e.target.closest ? e.target.closest('[data-nav-acao]') : null;
            if (!badge || !container.contains(badge)) return;
            e.preventDefault();
            var ticker = badge.getAttribute('data-nav-acao');
            if (!abrirMapaCalor(ticker)) {
                console.warn('[AcoesNavbar] Mapa de calor indisponível para ' + ticker);
            }
        });
    }

    async function update() {
        var container = document.getElementById('navbarAcoesPrices');
        if (!container || _running) return;
        _running = true;
        var list = tickers();
        try {
            bindContainerClick(container);
            // Placeholder enquanto carrega
            container.innerHTML = list.map(function (t, i) { return badgeHtml(t, i, 0, NaN); }).join('');

            var results = await Promise.all(list.map(function (t) {
                return fetch(window.API_BASE + '/api/cotacao/realtime/' + t, { cache: 'no-store' })
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .catch(function () { return null; });
            }));

            var html = '';
            list.forEach(function (t, i) {
                var d = results[i] || {};
                var price = parseFloat(d.price);
                var pct = parseFloat(d.change_percent);
                html += badgeHtml(t, i, isFinite(price) ? price : 0, isFinite(pct) ? pct : NaN);
            });
            container.innerHTML = html;
        } catch (e) {
            // falha silenciosa: a navbar não é crítica
        } finally {
            _running = false;
        }
    }

    function start() {
        update();
        if (_timer) clearInterval(_timer);
        _timer = setInterval(update, POLL_MS);
    }

    function onReady() {
        if (!document.getElementById('navbarAcoesPrices')) {
            // layout ainda não injetou a navbar: tenta novamente em breve
            setTimeout(onReady, 400);
            return;
        }
        start();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
    document.addEventListener('layoutReady', onReady);
    document.addEventListener('opcoesConfigUpdated', update);
    document.addEventListener('cryptoConfigUpdated', update);

    window.AcoesNavbar = { refresh: update };
})();

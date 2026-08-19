/** crypto-live.js v1.3.0 - Serviço global de cotações em tempo real via WebSocket Binance (porta 443) + fallback polling por proxy */
(function (global) {
    'use strict';

    var WS_URL = 'wss://stream.binance.com/stream?streams='; // combo stream (porta 443 padrão)
    var _ws = null;
    var _cache = {};            // { BTC: { price, ts }, ETH: ... }
    var _assets = {};           // { BTC: true, ... } — ativos monitorados
    var _retryTimer = null;
    var _retryCount = 0;
    var _connected = false;
    var _subscribers = [];      // callbacks(asset, price)
    var _fallbackTimer = null;
    var _FALLBACK_TTL = 10000;     // ms — se o ativo recebeu tick via WS recentemente, pula o fetch

    // Lê o intervalo configurável (segundos) do localStorage → ms. Padrão 15s.
    function readPollInterval() {
        try {
            var cfg = JSON.parse(global.localStorage.getItem('cryptoConfig') || '{}');
            var sec = parseInt(cfg.pollInterval, 10);
            if (isFinite(sec) && sec >= 3 && sec <= 600) return sec * 1000;
        } catch (e) {}
        return 5000;
    }
    var _fallbackInterval = readPollInterval();
    var _fallbackKickTimer = null;

    function normalizeAsset(asset) {
        return String(asset || '').trim().toUpperCase().replace(/USDT$/g, '').replace('/', '');
    }

    function buildStreams() {
        return Object.keys(_assets)
            .map(function (a) { return a.toLowerCase() + 'usdt@ticker'; })
            .join('/');
    }

    function publish(asset, price) {
        _cache[asset] = { price: price, ts: Date.now() };
        for (var i = 0; i < _subscribers.length; i++) {
            try { _subscribers[i](asset, price); } catch (e) {}
        }
        global.document.dispatchEvent(new global.CustomEvent('cryptoLiveQuote', {
            detail: { asset: asset, price: price }
        }));
    }

    function connect() {
        var streams = buildStreams();
        if (!streams) {
            _connected = false;
            dispatchStatus();
            return;
        }
        if (_ws) { try { _ws.close(); } catch (e) {} _ws = null; }
        try {
            _ws = new WebSocket(WS_URL + streams);
        } catch (e) {
            scheduleRetry();
            return;
        }
        _ws.onopen = function () {
            _connected = true;
            _retryCount = 0;
            dispatchStatus();
        };
        _ws.onmessage = function (ev) {
            try {
                var msg = JSON.parse(ev.data);
                if (!msg || !msg.data) return;
                var d = msg.data;
                if (d.e !== '24hrTicker' || !d.s || !d.c) return;
                var asset = normalizeAsset(d.s.replace('USDT', ''));
                var price = parseFloat(d.c);
                if (!isFinite(price) || price <= 0) return;
                publish(asset, price);
            } catch (e) {}
        };
        _ws.onclose = function () {
            _connected = false;
            dispatchStatus();
            scheduleRetry();
        };
        _ws.onerror = function () {};
    }

    function scheduleRetry() {
        if (_retryTimer) return;
        var delay = Math.min(15000, 2000 * Math.pow(2, _retryCount));
        _retryCount++;
        _retryTimer = setTimeout(function () {
            _retryTimer = null;
            connect();
        }, delay);
    }

    function dispatchStatus() {
        global.document.dispatchEvent(new global.CustomEvent('cryptoLiveStatus', {
            detail: { connected: _connected }
        }));
    }

    // Fallback: consulta o proxy do backend (HTTP) para cada ativo que não recebeu
    // tick do WS recentemente. Garante atualização automática mesmo se o WS
    // estiver bloqueado pela rede (firewall/proxy corporativo).
    function fallbackPoll() {
        var list = Object.keys(_assets);
        if (!list.length) return;
        list.forEach(function (a) {
            var last = _cache[a] ? _cache[a].ts : 0;
            if (_connected && (Date.now() - last) < _FALLBACK_TTL) return;
            var sym = a + 'USDT';
            global.fetch((global.API_BASE || '') + '/api/proxy/crypto/' + sym, { cache: 'no-store' })
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    var raw = d && (d.price || d.lastPrice || d.last || d.c || d.close);
                    var price = parseFloat(raw);
                    if (isFinite(price) && price > 0) publish(a, price);
                })
                .catch(function () {});
        });
    }

    // Dispara um poll imediato (sem esperar o primeiro tick do intervalo).
    // Garante que, ao registrar ativos, a primeira atualização chegue na hora.
    function kickFallback() {
        if (_fallbackKickTimer) return;
        _fallbackKickTimer = setTimeout(function () {
            _fallbackKickTimer = null;
            fallbackPoll();
        }, 0);
    }

    function startFallbackPolling() {
        if (_fallbackTimer) return;
        _fallbackInterval = readPollInterval(); // sempre re-lê caso a config tenha mudado
        _fallbackTimer = setInterval(fallbackPoll, _fallbackInterval);
        kickFallback();
    }

    // Permite alterar o intervalo em tempo de execução (após salvar config)
    function setPollInterval(seconds) {
        var sec = parseInt(seconds, 10);
        if (!isFinite(sec)) sec = 15;
        sec = Math.max(3, Math.min(600, sec));
        _fallbackInterval = sec * 1000;
        if (_fallbackTimer) { clearInterval(_fallbackTimer); _fallbackTimer = null; }
        _fallbackTimer = setInterval(fallbackPoll, _fallbackInterval);
        kickFallback();
        return sec;
    }

    function addAsset(asset) {
        var a = normalizeAsset(asset);
        if (!a) return;
        if (_assets[a]) return;
        _assets[a] = true;
        startFallbackPolling();
        connect();
    }

    function ensureAssets(list) {
        if (!Array.isArray(list)) return;
        var changed = false;
        list.forEach(function (a) {
            var n = normalizeAsset(a);
            if (n && !_assets[n]) { _assets[n] = true; changed = true; }
        });
        if (changed) {
            startFallbackPolling();
            connect();
        }
    }

    function getPrice(asset) {
        var a = normalizeAsset(asset);
        return _cache[a] ? _cache[a].price : null;
    }

    // Retorna o preço do cache (instantâneo) ou, se não houver, busca via proxy HTTP (fallback)
    function fetchPrice(asset) {
        var a = normalizeAsset(asset);
        var cached = getPrice(a);
        if (cached) return Promise.resolve(cached);
        var sym = a + 'USDT';
        return global.fetch((global.API_BASE || '') + '/api/proxy/crypto/' + sym, { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var raw = d && (d.price || d.lastPrice || d.last || d.c || d.close);
                var price = parseFloat(raw);
                if (isFinite(price) && price > 0) {
                    _cache[a] = { price: price, ts: Date.now() };
                    addAsset(a);
                    return price;
                }
                return null;
            })
            .catch(function () { return null; });
    }

    function onChange(cb) {
        if (typeof cb === 'function') _subscribers.push(cb);
    }

    function isConnected() {
        return _connected;
    }

    // Força reconexão imediata
    function refresh() { connect(); }

    // Permitido a outros módulos publicarem um preço externo (ex.: feed em tempo real do
    // widget TradingView) no mesmo evento global usado por tabelas/navbar/termômetro.
    function publishFromExternal(asset, price) {
        var a = normalizeAsset(asset);
        var p = parseFloat(price);
        if (!a || !isFinite(p) || p <= 0) return;
        // Não sobrescreve um tick do WS Binance mais recente (fonte canônica)
        var cached = _cache[a];
        if (cached && (Date.now() - cached.ts) < 2000 && cached.price !== p) return;
        publish(a, p);
    }

    global.CryptoLive = {
        addAsset: addAsset,
        ensureAssets: ensureAssets,
        getPrice: getPrice,
        fetchPrice: fetchPrice,
        onChange: onChange,
        isConnected: isConnected,
        refresh: refresh,
        setPollInterval: setPollInterval,
        publishFromExternal: publishFromExternal
    };

    // Fallback: se o servidor/servidor proxy da Binance não responder via WS, o sistema
    // mantém as funções existentes de fetch (resiliente).
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', function () { startFallbackPolling(); connect(); });
    } else {
        startFallbackPolling();
        connect();
    }
})(window);
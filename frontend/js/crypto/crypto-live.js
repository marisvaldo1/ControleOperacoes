/** crypto-live.js v1.0.0 - Serviço global de cotações em tempo real via WebSocket Binance (porta 443) */
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

    function normalizeAsset(asset) {
        return String(asset || '').trim().toUpperCase().replace(/USDT$/g, '').replace('/', '');
    }

    function buildStreams() {
        return Object.keys(_assets)
            .map(function (a) { return a.toLowerCase() + 'usdt@ticker'; })
            .join('/');
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
                _cache[asset] = { price: price, ts: Date.now() };
                for (var i = 0; i < _subscribers.length; i++) {
                    try { _subscribers[i](asset, price); } catch (e) {}
                }
                global.document.dispatchEvent(new global.CustomEvent('cryptoLiveQuote', {
                    detail: { asset: asset, price: price }
                }));
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

    function addAsset(asset) {
        var a = normalizeAsset(asset);
        if (!a) return;
        if (_assets[a]) return;
        _assets[a] = true;
        connect();
    }

    function ensureAssets(list) {
        if (!Array.isArray(list)) return;
        var changed = false;
        list.forEach(function (a) {
            var n = normalizeAsset(a);
            if (n && !_assets[n]) { _assets[n] = true; changed = true; }
        });
        if (changed) connect();
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

    global.CryptoLive = {
        addAsset: addAsset,
        ensureAssets: ensureAssets,
        getPrice: getPrice,
        fetchPrice: fetchPrice,
        onChange: onChange,
        isConnected: isConnected,
        refresh: refresh
    };

    // Fallback: se o servidor/servidor proxy da Binance não responder via WS, o sistema
    // mantém as funções existentes de fetch (resiliente).
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', function () { connect(); });
    } else {
        connect();
    }
})(window);
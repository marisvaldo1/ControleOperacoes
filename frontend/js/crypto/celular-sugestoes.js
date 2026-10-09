// celular-sugestoes.js — Estado vazio "Moedas para abrir CALL e PUT"
// v1.3.0 — Layout: ideias/claude-celular1.html | Dados: /api/crypto (última operação de cada ativo)
//          Suporte/Resistência/Tendência: klines 1h (48 barras) + TechnicalAnalysis
//          v1.3.0: uma única card por ativo (sem separar CALL/PUT); ativos dos últimos 30 dias
// Uso: window.CelularSugestoes.mount(hostElement, operacoes)
(function () {
    'use strict';

    var API = (typeof API_BASE !== 'undefined') ? API_BASE : (window.API_BASE || '');
    var CSS_ID = 'cs-style';
    var INST = 0;

    /* ------------------------------------------------------------------ */
    /* CSS (escopado .cs-scope para não colidir com o tema da página)      */
    /* ------------------------------------------------------------------ */
    var CSS = '' +
        '.cs-scope{--bg:#141c2b;--card:#0c1426;--tile:#111b30;--line:#243050;--fg:#e8edf7;--mut:#8d99b3;--call:#f59e0b;--put:#3b82f6;--w:380px;' +
        'box-sizing:border-box;display:block;padding:10px;margin:0;background:var(--bg);color:var(--fg);' +
        'font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left;opacity:1;align-items:stretch;}' +
        '.cs-scope *,.cs-scope *:before,.cs-scope *:after{box-sizing:border-box}' +
        '.ma-pos-empty.cs-scope,.pa-empty.cs-scope{display:block;padding:10px;opacity:1;text-align:left;color:var(--fg);font-size:14px;align-items:stretch}' +
        '.cs-scope .wrap{max-width:560px;margin:0 auto}' +
        '.cs-scope h1{font-size:17px;margin:2px 0;color:var(--fg)}' +
        '.cs-scope .sm,.cs-scope .s{font-size:11px;color:var(--mut)}' +
        '.cs-scope .num{font-variant-numeric:tabular-nums}' +
        '.cs-scope button:focus-visible{outline:2px solid #fff;outline-offset:1px}' +
        '.cs-scope .strip{width:min(var(--w),100%);font-size:12px;color:var(--mut);margin:4px 0 8px}' +
        '.cs-scope .strip b{color:var(--fg)}' +
        '.cs-scope .list{display:flex;flex-direction:column;gap:8px;width:min(var(--w),100%)}' +
        '.cs-scope .cs-none{font-size:12px;color:var(--mut);padding:6px 0}' +
        '.cs-scope .cc{background:var(--card);border:1px solid var(--line);border-top:3px solid var(--ac);border-radius:12px;padding:8px;font-size:11.5px}' +
        '.cs-scope .chd{display:flex;align-items:center;gap:6px;margin-bottom:6px}.cs-scope .grow{flex:1}' +
        '.cs-scope .coin{font-weight:800;font-size:14px}' +
        '.cs-scope .mode{font-size:10px;font-weight:800;color:#0a0f1c;background:var(--ac);border-radius:5px;padding:1px 6px}' +
        '.cs-scope .vp{font-size:11px;font-weight:700;border:1px solid var(--kc);color:var(--kc);border-radius:10px;padding:1px 8px;white-space:nowrap}' +
        '.cs-scope .k-ok{--kc:#22c55e}.cs-scope .k-warn{--kc:#f59e0b}.cs-scope .k-bad{--kc:#ef4444}.cs-scope .k-info{--kc:#60a5fa}' +
        '.cs-scope .t-ok{color:#22c55e}.cs-scope .t-warn{color:#f59e0b}.cs-scope .t-bad{color:#ef4444}.cs-scope .t-info{color:#60a5fa}' +
        '.cs-scope .l{font-size:10px;color:var(--mut)}' +
        '.cs-scope .sum{display:grid;grid-template-columns:1fr auto 14px;gap:8px;align-items:center;width:100%;min-height:52px;text-align:left;background:var(--tile);border:1px solid var(--line);border-left:3px solid var(--ac);border-radius:8px;color:var(--fg);font:inherit;padding:6px 8px;cursor:pointer}' +
        '.cs-scope .sum .big{display:block;font-size:17px;line-height:1.15}' +
        '.cs-scope .sum .l,.cs-scope .sum .s{display:block}' +
        '.cs-scope .sr div{display:flex;justify-content:space-between;gap:8px;font-size:11.5px}' +
        '.cs-scope .tg{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:5px}' +
        '.cs-scope .tg[hidden]{display:none}' +
        '.cs-scope .tl{background:var(--tile);border-radius:8px;padding:5px 7px}' +
        '.cs-scope .tl b{display:block;font-size:14px;line-height:1.2}' +
        '.cs-scope .tl .l,.cs-scope .tl .s{display:block}' +
        '@media (max-width:420px){.cs-scope .cc{font-size:11px}}' +
        // mobile: componente ocupa toda a área da tela
        '@media (max-width:768px){' +
        '.cs-scope,.ma-pos-empty.cs-scope,.pa-empty.cs-scope{--w:100%;padding:0}' +
        '.cs-scope .wrap{max-width:none}' +
        '}';

    function injectCss() {
        if (document.getElementById(CSS_ID)) return;
        var s = document.createElement('style');
        s.id = CSS_ID;
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    /* ------------------------------------------------------------------ */
    /* Formatação (idêntica ao template)                                   */
    /* ------------------------------------------------------------------ */
    var fmt = function (n) { var d = Math.abs(n) < 1 ? 4 : 2; return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var fc = function (n) { return n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : fmt(n); };
    var sg = function (n) { return (n > 0 ? '+' : n < 0 ? '\u2212' : '') + fmt(Math.abs(n)); };
    var pct = function (n, d) { return n.toFixed(d === undefined ? 1 : d) + '%'; };
    var spc = function (n, d) { return (n > 0 ? '+' : n < 0 ? '\u2212' : '') + Math.abs(n).toFixed(d === undefined ? 1 : d) + '%'; };

    var EMJ = { ok: '\uD83D\uDE04', warn: '\uD83D\uDE10', bad: '\uD83D\uDE1F' };
    var RANK = { ok: 0, info: 0, warn: 1, bad: 2 };
    var TR = { alta: 'Alta', lateral: 'Lateral', baixa: 'Baixa' };
    var CC = { ETH: '#818cf8', BNB: '#f3ba2f', BTC: '#f7931a', SOL: '#14c4a0' };

    /* ------------------------------------------------------------------ */
    /* Klines + análise técnica (suporte / resistência / tendência)        */
    /* ------------------------------------------------------------------ */
    var _klCache = {};

    function fetchKlines(asset) {
        var now = Date.now();
        var hit = _klCache[asset];
        if (hit && now - hit.ts < 300000) return Promise.resolve(hit);
        return fetch(API + '/api/proxy/crypto/' + asset + 'USDT/klines?interval=1h&limit=48', { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (rows) {
                var highs = [], lows = [], closes = [], vols = [];
                (Array.isArray(rows) ? rows : []).forEach(function (k) {
                    var h = parseFloat(k && k[1]), l = parseFloat(k && k[2]), c = parseFloat(k && k[4]), v = parseFloat(k && k[5]);
                    if (isFinite(h) && isFinite(l) && isFinite(c) && c > 0) {
                        highs.push(h); lows.push(l); closes.push(c); vols.push(isFinite(v) ? v : 0);
                    }
                });
                if (!closes.length) throw new Error('sem candles');
                var data = { highs: highs, lows: lows, closes: closes, vols: vols, ts: now };
                _klCache[asset] = data;
                return data;
            })
            .catch(function () { return null; });
    }

    function analyze(asset) {
        return fetchKlines(asset).then(function (k) {
            var out = { sup: 0, res: 0, tr: 'lateral', cot: 0 };
            if (!k) return out;
            out.sup = Math.min.apply(null, k.lows);
            out.res = Math.max.apply(null, k.highs);
            out.cot = k.closes[k.closes.length - 1];
            if (window.TechnicalAnalysis) {
                try {
                    var a = new window.TechnicalAnalysis().analyzeAll(k.highs, k.lows, k.closes, k.vols);
                    var sig = a && a.summary && a.summary.overall ? a.summary.overall.signal : 'NEUTRAL';
                    out.tr = (sig === 'BUY' || sig === 'STRONG_BUY') ? 'alta'
                        : (sig === 'SELL' || sig === 'STRONG_SELL') ? 'baixa' : 'lateral';
                } catch (e) { /* indicador indisponível -> lateral */ }
            }
            return out;
        });
    }

    /* ------------------------------------------------------------------ */
    /* Lista a partir das operações do banco                               */
    /* ------------------------------------------------------------------ */
    function normCoin(op) {
        return String(op.ativo || '').toUpperCase().replace('USDT', '').replace('/', '').replace('-USDT', '').trim();
    }

    function ord(op) {
        return String(op.data_operacao || op.exercicio || op.created_at || '') + '|' + String(op.id || 0);
    }

    function computePm(coin) {
        if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.computeData === 'function') {
            try {
                var d = window.ModalPrecoMedioAtivo.computeData(coin);
                return d && d.pm > 0 ? d.pm : 0;
            } catch (e) { return 0; }
        }
        return 0;
    }

    function livePrice(coin) {
        if (window.CryptoLive && typeof window.CryptoLive.getPrice === 'function') {
            var p = parseFloat(window.CryptoLive.getPrice(coin));
            if (isFinite(p) && p > 0) return p;
        }
        return 0;
    }

    // Considera apenas operações dos últimos 30 dias (1 dia extra de folga por fuso)
    function isRecent(op) {
        var raw = op.data_operacao || op.created_at || '';
        var m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
        if (!m) return true; // sem data utilizável -> mantém
        var t = new Date(m[1] + 'T00:00:00').getTime();
        if (!isFinite(t)) return true;
        return (Date.now() - t) <= 31 * 86400000;
    }

    function buildList(ops) {
        var map = {};
        (ops || []).forEach(function (op) {
            var coin = normCoin(op);
            var m = String(op.tipo || '').toUpperCase();
            if (!coin || (m !== 'CALL' && m !== 'PUT')) return;
            if (!isRecent(op)) return;
            // somente a última operação de cada ativo (sem repetir CALL e PUT)
            if (!map[coin] || ord(op) > ord(map[coin])) map[coin] = op;
        });

        return Object.keys(map).sort().map(function (coin) {
            var op = map[coin];
            var qty = parseFloat(op.crypto) || 0;
            var usdt = parseFloat(op.abertura) || 0;
            var pm = computePm(coin) || (qty > 0 ? usdt / qty : 0);
            return {
                m: String(op.tipo || '').toUpperCase(), coin: coin, pm: pm, qty: qty, usdt: usdt,
                cot: livePrice(coin),          // ao vivo (WS); se 0, cai para o fechamento das klines
                cotSaved: parseFloat(op.cotacao_atual) || 0, // último recurso (valor salvo na operação)
                sup: 0, res: 0, tr: 'lateral', op: op
            };
        });
    }

    /* ------------------------------------------------------------------ */
    /* Cálculo / markup dos cards (idêntico ao template)                   */
    /* ------------------------------------------------------------------ */
    function calc(d) {
        var m = d.m, pm = +d.pm || 0, cot = +d.cot || 0, sup = +d.sup || 0, res = +d.res || 0, tr = d.tr, qty = +d.qty || 0, usdt = +d.usdt || 0;
        var o = { m: m, d: d, pm: pm, cot: cot, sup: sup, res: res, tr: tr, conds: [], extras: [] };
        var C = o.conds;
        o.ratio = pm > 0 ? pm / cot * 100 : null;
        if (m === 'CALL') {
            o.diff = cot - pm; o.edge = Math.max(pm, cot); o.edgeDist = (o.edge / cot - 1) * 100; o.lo = o.edge; o.hi = res > o.edge ? res : o.edge;
            C.push(pm <= cot ? ['PM x cota\u00e7\u00e3o', 'ok'] : ['PM x cota\u00e7\u00e3o', o.edgeDist <= 5 ? 'warn' : 'bad']);
            C.push(!res ? ['Resist\u00eancia', 'info'] : o.edge >= res ? ['Resist\u00eancia', 'ok'] : ['Resist\u00eancia', 'info']);
            if (!sup) C.push(['Suporte', 'info']); else { var x = (cot - sup) / cot * 100; C.push(['Suporte', x < 1 ? 'bad' : x < 3 ? 'warn' : 'ok']); }
            C.push(['Tend\u00eancia', tr === 'lateral' ? 'ok' : tr === 'alta' ? 'info' : 'warn']);
            if (qty > 0) o.extras.push({ l: 'Resultado latente', v: sg(o.diff * qty), s: fmt(qty) + ' moedas' });
        } else {
            var has = pm > 0;
            o.diff = has ? pm - cot : null; o.edge = has ? Math.min(pm, cot) : cot; o.edgeDist = (1 - o.edge / cot) * 100; o.hi = o.edge; o.lo = sup > 0 && sup < o.edge ? sup : o.edge;
            C.push(!has ? ['PM x cota\u00e7\u00e3o', 'info'] : pm >= cot ? ['PM x cota\u00e7\u00e3o', 'ok'] : ['PM x cota\u00e7\u00e3o', o.edgeDist <= 5 ? 'warn' : 'bad']);
            C.push(!sup ? ['Suporte', 'info'] : o.edge <= sup ? ['Suporte', 'ok'] : ['Suporte', 'info']);
            if (!res) C.push(['Resist\u00eancia', 'info']); else { var y = (res - cot) / cot * 100; C.push(['Resist\u00eancia', y <= 0 ? 'info' : y < 1.5 ? 'warn' : 'ok']); }
            C.push(['Tend\u00eancia', tr === 'lateral' ? 'ok' : tr === 'baixa' ? 'warn' : 'info']);
            if (usdt > 0) {
                var b = usdt / o.edge, nq = qty + b, npm = (qty * pm + usdt) / nq, ch = pm > 0 && qty > 0 ? (npm / pm - 1) * 100 : null;
                o.extras.push({ l: 'PM projetado', v: fmt(npm), s: ch == null ? 'se exercer' : Math.abs(ch) < 0.05 ? 'PM n\u00e3o muda' : spc(ch) + ' se exercer' });
            }
        }
        var w = Math.max.apply(null, [0].concat(C.filter(function (c) { return c[1] !== 'info'; }).map(function (c) { return RANK[c[1]]; })));
        o.v = ['ok', 'warn', 'bad'][w];
        o.vt = { ok: 'Favor\u00e1vel', warn: 'Aten\u00e7\u00e3o', bad: 'Desfavor\u00e1vel' }[o.v];
        return o;
    }

    function mt(o) {
        var isC = o.m === 'CALL';
        var K = function (n) { return o.conds.find(function (c) { return c[0] === n; })[1]; };
        var dS = o.sup > 0 ? pct(Math.abs(o.cot - o.sup) / o.cot * 100) + ' ' + (o.sup <= o.cot ? 'abaixo' : 'acima') : '';
        var dR = o.res > 0 ? pct(Math.abs(o.res / o.cot - 1) * 100) + ' ' + (o.res >= o.cot ? 'acima' : 'abaixo') : '';
        var rng = isC
            ? (o.lo === o.hi ? '\u2265 ' + fc(o.lo) : fc(o.lo) + ' \u2013 ' + fc(o.hi))
            : (o.lo === o.hi ? '\u2264 ' + fc(o.hi) : fc(o.lo) + ' \u2013 ' + fc(o.hi));
        return {
            cot: ['Cota\u00e7\u00e3o', fmt(o.cot), '', ''],
            pm: ['Pre\u00e7o m\u00e9dio', o.pm > 0 ? fmt(o.pm) : '\u2014', '', ''],
            dif: [isC ? 'Cot \u2212 PM' : 'PM \u2212 Cot', o.diff == null ? '\u2014' : sg(o.diff), isC ? '+ = cota\u00e7\u00e3o acima' : '+ = cota\u00e7\u00e3o abaixo', K('PM x cota\u00e7\u00e3o')],
            rat: ['PM \u00f7 Cot', o.ratio == null ? '\u2014' : pct(o.ratio), isC ? '< 100% = folga' : '> 100% = folga', K('PM x cota\u00e7\u00e3o')],
            edge: [isC ? 'Strike m\u00edn.' : 'Strike m\u00e1x.', fmt(o.edge)],
            rng: rng,
            sup: ['Suporte', o.sup ? fmt(o.sup) : '\u2014', dS, K('Suporte')],
            res: ['Resist\u00eancia', o.res ? fmt(o.res) : '\u2014', dR, K('Resist\u00eancia')],
            tr: ['Tend\u00eancia', TR[o.tr] || '\u2014', '', K('Tend\u00eancia')],
            ex: o.extras[0] ? [o.extras[0].l, o.extras[0].v, o.extras[0].s, ''] : null
        };
    }

    var tc = function (a) { return a[3] ? 't-' + a[3] : ''; };

    function tile(a) {
        return '<div class="tl"><span class="l">' + a[0] + '</span><b class="num ' + tc(a) + '">' + a[1] + '</b>' +
            (a[2] ? '<span class="s">' + a[2] + '</span>' : '') + '</div>';
    }

    function card(st, d, i) {
        var o = calc(d), m = mt(o), open = st.OPEN.has(i), id = st.uid + 'det' + i;
        return '<div class="cc" style="--ac:' + (d.m === 'CALL' ? 'var(--call)' : 'var(--put)') + '">' +
            '<div class="chd"><span class="coin" style="color:' + (CC[d.coin] || '#94a3b8') + '">' + d.coin + '</span>' +
            '<span class="mode">' + d.m + '</span><span class="grow"></span>' +
            '<span class="vp k-' + o.v + '">' + EMJ[o.v] + ' ' + o.vt + '</span></div>' +
            '<button class="sum" data-tg="' + i + '" aria-expanded="' + open + '" aria-controls="' + id + '">' +
            '<div><span class="l">' + m.edge[0] + '</span><b class="big num">' + m.edge[1] + '</b>' +
            '<span class="s">Faixa ' + m.rng + '</span></div>' +
            '<div class="sr">' +
            '<div><span class="l">' + m.dif[0] + '</span><b class="num ' + tc(m.dif) + '">' + m.dif[1] + '</b></div>' +
            '<div><span class="l">' + m.rat[0] + '</span><b class="num ' + tc(m.rat) + '">' + m.rat[1] + '</b></div>' +
            '</div><span class="s" aria-hidden="true">' + (open ? '\u25B2' : '\u25BC') + '</span></button>' +
            '<div class="tg" id="' + id + '"' + (open ? '' : ' hidden') + '>' +
            [m.cot, m.pm, m.dif, m.rat, m.sup, m.res, m.tr, m.ex].filter(Boolean).map(tile).join('') +
            '</div></div>';
    }

    function draw(host, st) {
        var V = { ok: 0, warn: 0, bad: 0 };
        st.list.forEach(function (d) { V[calc(d).v]++; });
        var strip = host.querySelector('.cs-strip');
        if (strip) strip.innerHTML = '<b>' + V.ok + '</b> favor\u00e1vel \u00b7 <b>' + V.warn + '</b> aten\u00e7\u00e3o \u00b7 <b>' + V.bad + '</b> desfavor\u00e1vel';
        var out = host.querySelector('.cs-out');
        if (out) out.innerHTML = st.list.map(function (d, i) { return card(st, d, i); }).join('');
    }

    function onClick(e) {
        var host = e.currentTarget;
        var st = host._csState;
        if (!st) return;
        var b = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!b || !host.contains(b)) return;
        if (b.dataset.tg !== undefined) { var k = +b.dataset.tg; if (st.OPEN.has(k)) st.OPEN.delete(k); else st.OPEN.add(k); }
        else return;
        draw(host, st);
    }

    var STRUCT = '<div class="wrap">' +
        '<h1>Moedas para abrir CALL e PUT</h1>' +
        '<div class="sm"> \u00daltima opera\u00e7\u00e3o (30 dias) de cada ativo.</div>' +
        '<div class="strip cs-strip"></div>' +
        '<div class="list cs-out"></div>' +
        '</div>';

    /* ------------------------------------------------------------------ */
    /* API pública                                                         */
    /* ------------------------------------------------------------------ */
    function mount(host, ops) {
        if (!host) return;
        injectCss();
        host.classList.add('cs-scope');
        if (!host._csBound) {
            host._csBound = true;
            host.addEventListener('click', onClick);
        }

        host.innerHTML = STRUCT;
        var st = { OPEN: new Set(), list: [], uid: 'cs' + (++INST) };
        host._csState = st;

        var list = buildList(ops);
        var out = host.querySelector('.cs-out');
        if (!list.length) {
            if (out) out.innerHTML = '<div class="cs-none">Nenhuma opera\u00e7\u00e3o nos \u00faltimos 30 dias no banco.</div>';
            return;
        }
        if (out) out.innerHTML = '<div class="cs-none">Carregando an\u00e1lise t\u00e9cnica\u2026</div>';

        var coins = [];
        list.forEach(function (d) { if (coins.indexOf(d.coin) < 0) coins.push(d.coin); });

        Promise.all(coins.map(analyze)).then(function (arr) {
            if (host._csState !== st) return; // outro mount sobrescreveu este
            var byCoin = {};
            coins.forEach(function (c, i) { byCoin[c] = arr[i] || {}; });
            list.forEach(function (d) {
                var a = byCoin[d.coin] || {};
                d.sup = a.sup || 0;
                d.res = a.res || 0;
                d.tr = a.tr || 'lateral';
                if (!d.cot && a.cot) d.cot = a.cot;          // fechamento recente das klines
                if (!d.cot) d.cot = d.cotSaved || 0;         // valor salvo na operação (desatualizado)
            });
            st.list = list;
            draw(host, st);
        });
    }

    window.CelularSugestoes = { mount: mount };
})();

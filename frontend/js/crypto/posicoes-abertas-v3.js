// posicoes-abertas-v3.js — Demo "Layout C evoluído" (6 opções de distância)
// v2.1.0 — Termômetro sempre visível no card (fora do accordion); accordion abre só o TradingView.
// v2.0.0 — Dados REAIS:
//          • operações abertas do banco → GET /api/crypto (mesma fonte da tela Posições Abertas)
//          • cotações ao vivo → window.CryptoLive (WebSocket Binance + fallback proxy)
//          • candles reais → GET /api/proxy/crypto/<PAR>/klines (1h × 28)
//          • preço médio → ModalPrecoMedioAtivo.computeData (mesmo cálculo do site)
(function () {
    'use strict';

    /* ═══════════════ Estado ═══════════════ */
    var D = [];              // posições abertas (modelos normalizados)
    var _allOps = [];        // operações cruas da API
    var _kcache = {};        // cache de klines por símbolo
    var loading = true;
    var err = null;
    var V = 0;               // opção ativa (aba)
    var open = null;         // id do card expandido
    var filt = 'Todos';      // filtro de ativo
    var last = Date.now();   // última atualização (fetch ou cotação)
    var _rt = null;          // timer de re-render (throttle)

    // As 6 opções (abas)
    var N = [
        ['Histórico da distância', 'Uma linha mostra como a distância até o strike evoluiu nas últimas horas. A linha de 0% é o strike, com faixas de atenção e perigo.', 'No C você vê só a distância de agora. Aqui vê se ela está encolhendo, e isso pesa mais que o número isolado.'],
        ['Tendência e falta', 'Um selo de tendência (aproximando, afastando, estável), quanto falta em dólares e, se der, em quantas horas o preço tocaria o strike no ritmo atual.', 'Transforma o percentual em uma resposta pronta: "estou seguro por quanto tempo?".'],
        ['Faixa de 24h', 'A barra do termômetro ganha uma moldura com o mínimo e o máximo do período, além da cotação atual.', 'Mostra se o preço já chegou perto do strike e recuou, o que dá contexto sem abrir o gráfico.'],
        ['Folga', 'Cinco blocos medem a distância em múltiplos do movimento típico do ativo, e não só em %.', '1% é muito para o ouro e pouco para o BTC. A folga compara ativos diferentes na mesma régua.'],
        ['Fita de segurança', 'Uma fita com um segmento por hora, colorido pela situação naquele momento (verde, âmbar, vermelho).', 'Em um segundo você vê se a operação passou sustos, algo que o número atual esconde.'],
        ['Cone até o vencimento', 'Histórico à esquerda e um cone que se abre até o vencimento, com o strike como linha. Mostra também uma estimativa de chance de passar do strike.', 'É o único que olha para frente. Se o cone cruza o strike, o risco é visível de longe.']
    ];

    /* ═══════════════ Helpers ═══════════════ */
    function $(s) { return document.querySelector(s); }

    function fmt(n, d) {
        if (d === undefined) d = 2;
        return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
    }

    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function rnd(s) { return function () { return (s = (s * 16807) % 2147483647) / 2147483647; }; }

    function Phi(z) {
        var t = 1 / (1 + .2316419 * Math.abs(z)),
            d = .3989423 * Math.exp(-z * z / 2),
            p = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return z > 0 ? 1 - p : p;
    }

    function normAsset(op) {
        return String(typeof op === 'string' ? op : (op && op.ativo) || '')
            .toUpperCase().replace('USDT', '').replace('/', '').trim();
    }

    function isOpen(op) {
        var s = String(op.status || '').toUpperCase();
        return s === 'ABERTA' || s === 'ABERTO';
    }

    /* ── Distância ──
       dist = sinal real (price-strike)/strike*100.
       drm  = métrica de risco espelhada para PUT (m > 0 = no strike/lado ruim;
              m ≈ 0 = em cima do strike). Cor/barra/faixas usam drm/dhr;
       o texto do chip mantém o sinal real. */
    function dist(p) { return p.strike ? (p.price - p.strike) / p.strike * 100 : 0; }
    function mir(p) { return p.tipo === 'PUT' ? -1 : 1; }
    function drm(p) { return mir(p) * dist(p); }
    function dh(p) { return (p.c || []).map(function (c) { return (c.c - p.strike) / p.strike * 100; }); }
    function dhr(p) { var m = mir(p); return dh(p).map(function (v) { return v * m; }); }

    function stv(m) { return m >= -0.2 ? 'bad' : m >= -1 ? 'warn' : 'ok'; }
    function st(p) { return stv(drm(p)); }

    var cls = { ok: 'c-ok', warn: 'c-warn', bad: 'c-bad' };
    var lbl = { ok: 'Segura', warn: 'Atenção', bad: 'No strike' };
    var col = { ok: '#22c55e', warn: '#f59e0b', bad: '#ef4444' };

    function left(h) {
        if (h < 24) return Math.floor(h) + 'h' + String(Math.round(h % 1 * 60)).padStart(2, '0');
        return Math.floor(h / 24) + 'd ' + Math.round(h % 24) + 'h';
    }

    function sg(d) { return (d > 0 ? '+' : '') + fmt(d) + '%'; }
    function pos(m) { return Math.max(2, Math.min(98, 50 + m / 7 * 100)); }

    /* ═══════════════ Banco → modelo ═══════════════ */
    function parseDate(raw) {
        if (!raw) return null;
        var str = String(raw).trim();
        var d = /^\d{4}-\d{2}-\d{2}/.test(str) ? new Date(str.slice(0, 10) + 'T23:59:59') : new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    // horas até o vencimento: exercicio (settle YYYY-MM-DD) → fim do dia;
    // senão data_operacao + prazo (dias); senão prazo em horas; fallback 72h
    function hoursLeft(op) {
        var d = parseDate(op.exercicio);
        if (d) return Math.max(0, (d.getTime() - Date.now()) / 3600000);
        var prazo = parseFloat(op.prazo) || 0;
        if (prazo > 0) {
            var ab = parseDate(op.data_operacao);
            if (ab) return Math.max(0, (ab.getTime() + prazo * 86400000 - Date.now()) / 3600000);
            return prazo * 24;
        }
        return 72;
    }

    // mesma heurística da tela Posições Abertas (posicoes-abertas.js calcPop)
    function calcPop(strike, cot, tipo) {
        if (!strike || !cot) return 50;
        var distPct = Math.abs(cot - strike) / strike * 100;
        var isITM = String(tipo || 'CALL').toUpperCase() === 'CALL' ? (cot - strike > 0) : (cot - strike < 0);
        return isITM ? Math.max(5, Math.round(50 - distPct * 4)) : Math.min(95, Math.round(50 + distPct * 4));
    }

    function computePM(sym) {
        if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.computeData === 'function') {
            try {
                var d = window.ModalPrecoMedioAtivo.computeData(sym);
                return d && d.pm > 0 ? d.pm : 0;
            } catch (e) { /* sem PM */ }
        }
        return 0;
    }

    function toModel(op) {
        var sym = normAsset(op);
        var strike = parseFloat(op.strike) || 0;
        var price = parseFloat(op.cotacao_atual) || 0;
        if (window.CryptoLive) {
            var lp = window.CryptoLive.getPrice(sym);
            if (lp > 0) price = lp;
        }
        var p = {
            id: op.id,
            sym: sym,
            ativo: op.ativo,
            tipo: String(op.tipo || 'CALL').toUpperCase(),
            corretora: op.corretora || '',
            strike: strike,
            price: price,
            prem: parseFloat(op.premio_us) || 0,
            pm: 0,
            pop: 50,
            h: hoursLeft(op),
            c: null,
            real: false
        };
        p.pop = calcPop(strike, price, p.tipo);
        p.c = synth(p);
        return p;
    }

    // desvio-padrão dos retornos dos candles (volatilidade horária) — cone
    function sig(p) {
        var r = (p.c || []).map(function (c) { return c.o ? (c.c - c.o) / c.o : 0; });
        if (!r.length) return 0;
        var m = r.reduce(function (a, b) { return a + b; }, 0) / r.length;
        return Math.sqrt(r.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / r.length);
    }

    /* Histórico sintético (fallback quando klines indisponível) */
    function synth(p) {
        var r = rnd((p.id || 1) * 97 + 13), v = p.price || p.strike, out = [], i, o;
        for (i = 0; i < 28; i++) {
            o = v;
            v += ((p.price || v) - v) * .06 + (r() - .5) * (p.price || v) * .0035;
            out.push({ o: o, c: v, h: Math.max(o, v) + r() * v * .0012, l: Math.min(o, v) - r() * v * .0012, v: r() });
        }
        if (p.price > 0) {
            var l = out[27];
            l.c = p.price;
            if (p.price > l.h) l.h = p.price;
            if (p.price < l.l) l.l = p.price;
        }
        return out;
    }

    /* ═══════════════ Klines reais (Binance 1h × 28) ═══════════════ */
    function loadKlines(p) {
        var key = p.sym;
        var cached = _kcache[key];
        if (cached && Date.now() - cached.ts < 300000) {
            p.c = cached.c;
            p.real = true;
            return Promise.resolve();
        }
        var url = (window.API_BASE || '') + '/api/proxy/crypto/' + key + 'USDT/klines?interval=1h&limit=28';
        return fetch(url, { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('klines HTTP ' + r.status); return r.json(); })
            .then(function (rows) {
                if (!Array.isArray(rows) || !rows.length || !Array.isArray(rows[0])) throw new Error('klines inválidas');
                var c = rows.slice(-28).map(function (k) {
                    return { o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] };
                }).filter(function (x) { return isFinite(x.c) && x.c > 0; });
                if (!c.length) throw new Error('klines vazias');
                var mx = Math.max.apply(null, c.map(function (x) { return x.v; })) || 1;
                c.forEach(function (x) { x.v = x.v / mx; });
                var l = c[c.length - 1];
                if (p.price > 0) {
                    l.c = p.price;
                    if (p.price > l.h) l.h = p.price;
                    if (p.price < l.l) l.l = p.price;
                }
                _kcache[key] = { ts: Date.now(), c: c };
                p.c = c;
                p.real = true;
            })
            .catch(function () {
                p.c = p.c || synth(p);
                p.real = false;
            });
    }

    /* ═══════════════ Carga da API (banco) ═══════════════ */
    function loadAll() {
        loading = true;
        err = null;
        renderList();
        return fetch((window.API_BASE || '') + '/api/crypto', { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (ops) {
                if (!Array.isArray(ops)) throw new Error('resposta inesperada da API');
                _allOps = ops;
                window.cryptoOperacoes = ops;   // fonte do ModalPrecoMedioAtivo

                D = ops.filter(isOpen).map(toModel);

                var pm = {};
                D.forEach(function (p) {
                    if (!(p.sym in pm)) pm[p.sym] = computePM(p.sym);
                    p.pm = pm[p.sym];
                });

                if (filt !== 'Todos' && !D.some(function (p) { return p.sym === filt; })) filt = 'Todos';

                if (window.CryptoLive) {
                    window.CryptoLive.ensureAssets(D.map(function (p) { return p.sym; }));
                }

                loading = false;
                last = Date.now();
                renderAll();
                syncLive();
                applySavedLive();

                // candles reais em segundo plano (enquanto isso, o histórico sintético já renderizou)
                Promise.all(D.map(loadKlines)).then(function () {
                    if (D.some(function (p) { return p.real; })) {
                        last = Date.now();
                        renderList();
                        renderUpd();
                    }
                });
            })
            .catch(function (e) {
                loading = false;
                err = (e && e.message) || String(e);
                renderAll();
            });
    }

    /* ═══════════════ Tempo real (CryptoLive) ═══════════════ */
    function applyLive(asset, price) {
        if (!asset || !(price > 0)) return;
        var changed = false;
        D.forEach(function (p) {
            if (p.sym !== asset || p.price === price) return;
            p.price = price;
            p.pop = calcPop(p.strike, price, p.tipo);
            if (p.c && p.c.length) {
                var l = p.c[p.c.length - 1];
                l.c = price;
                if (price > l.h) l.h = price;
                if (price < l.l) l.l = price;
            }
            changed = true;
        });
        if (!changed) return;
        last = Date.now();
        scheduleRender();
    }

    function scheduleRender() {
        if (_rt) return;
        _rt = setTimeout(function () {
            _rt = null;
            renderSum();
            renderChips();
            updateHeaders();
            renderUpd();
        }, 500);
    }

    // Atualiza só os cabeçalhos dos cards (não toca no .body → o TradingView aberto sobrevive)
    function updateHeaders() {
        var el = $('#list');
        if (!el || typeof el.querySelectorAll !== 'function') { renderList(); return; }
        var arts = el.querySelectorAll('.pos');
        if (!arts || !arts.length) { renderList(); return; }
        for (var i = 0; i < arts.length; i++) {
            var art = arts[i];
            var id = +art.getAttribute('data-id');
            var p = null;
            for (var j = 0; j < D.length; j++) if (D[j].id === id) p = D[j];
            if (!p) continue;
            var hd = art.querySelector ? art.querySelector('.hd') : null;
            if (hd) hd.innerHTML = head(p);
            art.className = 'pos s-' + st(p) + (open === p.id ? ' open' : '');
        }
    }

    // aplica cache do CryptoLive e busca quem ainda não tem preço
    function syncLive() {
        if (!window.CryptoLive) return;
        D.forEach(function (p) {
            var cached = window.CryptoLive.getPrice(p.sym);
            if (cached) applyLive(p.sym, cached);
            else window.CryptoLive.fetchPrice(p.sym).then(function (pr) { if (pr) applyLive(p.sym, pr); });
        });
    }

    // reaproveita preços já publicados antes deste carregar
    function applySavedLive() {
        if (!window.CryptoLive) return;
        D.forEach(function (p) {
            var c = window.CryptoLive.getPrice(p.sym);
            if (c > 0) applyLive(p.sym, c);
        });
    }

    // segurança: 2.5s — mesma rotina da tela real (sync do cache publicado)
    function syncTick() {
        if (!window.CryptoLive || !D.length) return;
        D.forEach(function (p) {
            var c = window.CryptoLive.getPrice(p.sym);
            if (c > 0) applyLive(p.sym, c);
        });
    }

    /* ═══════════════ Termômetro (SVG) ═══════════════ */
    function thermo(p) {
        var lo = p.strike * .93, hi = p.strike * 1.07, T = 18, B = 150, s = st(p);
        function y(v) { return B - Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * (B - T); }
        function k(v) { return (v / 1000).toFixed(1) + 'k'; }
        var g = '';
        for (var i = 0; i < 5; i++) {
            var v = lo + (hi - lo) * i / 4, yy = y(v);
            g += '<line x1="34" x2="266" y1="' + yy + '" y2="' + yy + '" stroke="#2a3654"/>' +
                 '<text x="28" y="' + (yy + 3) + '" fill="#8d99b3" font-size="9" text-anchor="end">' + k(v) + '</text>' +
                 '<text x="272" y="' + (yy + 3) + '" fill="#8d99b3" font-size="9">' + k(v) + '</text>';
        }
        var bar = function (x, v, c, id) {
            return '<clipPath id="k' + p.id + id + '"><rect x="' + x + '" y="' + T + '" width="64" height="' + (B - T) + '" rx="9"/></clipPath>' +
                '<g clip-path="url(#k' + p.id + id + ')">' +
                '<rect x="' + x + '" y="' + T + '" width="64" height="' + (y(p.strike * 1.01) - T) + '" fill="#14532d"/>' +
                '<rect x="' + x + '" y="' + y(p.strike * 1.01) + '" width="64" height="' + (y(p.strike * .99) - y(p.strike * 1.01)) + '" fill="#7a4a0c"/>' +
                '<rect x="' + x + '" y="' + y(p.strike * .99) + '" width="64" height="' + (B - y(p.strike * .99)) + '" fill="#1a2238"/>' +
                '<rect x="' + (x + 4) + '" y="' + y(v) + '" width="56" height="' + (B - y(v)) + '" rx="6" fill="' + c + '"/></g>';
        };
        var ys = y(p.strike), yp = y(p.price);
        return '<svg viewBox="0 0 300 190" role="img" aria-label="Comparação strike e cotação">' +
            '<text x="88" y="11" fill="#60a5fa" font-size="11" font-weight="700" text-anchor="middle">Strike</text>' +
            '<text x="212" y="11" fill="' + col[s] + '" font-size="11" font-weight="700" text-anchor="middle">Cotação</text>' +
            g + bar(56, p.strike, '#60a5fa', 'a') + bar(180, p.price, col[s], 'b') +
            '<line x1="88" y1="' + ys + '" x2="212" y2="' + yp + '" stroke="' + col[s] + '" stroke-dasharray="4 3" stroke-width="1.5"/>' +
            '<text x="150" y="' + (Math.min(ys, yp) - 8) + '" fill="' + col[s] + '" font-size="11" font-weight="700" text-anchor="middle">' + fmt(p.price - p.strike) + '</text>' +
            '<text x="88" y="172" fill="#60a5fa" font-size="11" font-weight="700" text-anchor="middle">US$ ' + fmt(p.strike) + '</text>' +
            '<text x="212" y="172" fill="' + col[s] + '" font-size="11" font-weight="700" text-anchor="middle">US$ ' + fmt(p.price) + '</text></svg>';
    }

    /* ═══════════════ Gráfico de candles (SVG) ═══════════════ */
    function candles(p) {
        var a = p.c || [];
        var mn0 = Math.min.apply(null, a.map(function (c) { return c.l; }).concat([p.strike])),
            mx0 = Math.max.apply(null, a.map(function (c) { return c.h; }).concat([p.strike])),
            pd = (mx0 - mn0) * .08, mn = mn0 - pd, mx = mx0 + pd;
        function y(v) { return 6 + (1 - (v - mn) / (mx - mn)) * 88; }
        var w = 250 / a.length, s = '';
        for (var i = 0; i < 4; i++) {
            var v = mn + (mx - mn) * i / 3;
            s += '<line x1="0" x2="250" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#1c1f26"/>' +
                 '<text x="254" y="' + (y(v) + 3) + '" fill="#8b93a3" font-size="8">' + fmt(v, 0) + '</text>';
        }
        a.forEach(function (c, i) {
            var x = i * w + w / 2, u = c.c >= c.o, cc = u ? '#22c55e' : '#ef4444';
            s += '<line x1="' + x + '" x2="' + x + '" y1="' + y(c.h) + '" y2="' + y(c.l) + '" stroke="' + cc + '"/>' +
                 '<rect x="' + (x - w * .3) + '" y="' + y(Math.max(c.o, c.c)) + '" width="' + (w * .6) + '" height="' + Math.max(1, Math.abs(y(c.o) - y(c.c))) + '" fill="' + cc + '"/>' +
                 '<rect x="' + (x - w * .3) + '" y="' + (126 - c.v * 22) + '" width="' + (w * .6) + '" height="' + (c.v * 22) + '" fill="' + cc + '" opacity=".45"/>';
        });
        var l = a[a.length - 1], lc = l.c >= l.o ? '#22c55e' : '#ef4444';
        return '<svg viewBox="0 0 300 130" role="img" aria-label="Gráfico de candles">' + s +
            '<line x1="0" x2="250" y1="' + y(p.strike) + '" y2="' + y(p.strike) + '" stroke="#60a5fa" stroke-dasharray="4 3"/>' +
            '<text x="3" y="' + (y(p.strike) - 3) + '" fill="#60a5fa" font-size="8">Strike</text>' +
            '<rect x="251" y="' + (y(l.c) - 6) + '" width="47" height="12" rx="2" fill="' + lc + '"/>' +
            '<text x="254" y="' + (y(l.c) + 3) + '" fill="#fff" font-size="8" font-weight="700">' + fmt(l.c) + '</text></svg>';
    }

    /* ═══════════════ Corpo expandido: somente o gráfico TradingView ═══════════════ */
    function body(p) {
        return '<div class="body">' +
            '<div class="tv-box" id="tvBox" aria-label="Gráfico TradingView ' + esc(p.sym) + '"></div>' +
            '</div>';
    }

    /* ═══════════════ TradingView (padrão do projeto: s3.tradingview.com/tv.js) ═══════════════ */
    var _tvWidget = null;
    var _tvLoading = false;

    function removeTV() {
        if (_tvWidget && typeof _tvWidget.remove === 'function') {
            try { _tvWidget.remove(); } catch (e) { /* widget já removido */ }
        }
        _tvWidget = null;
    }

    function findOpen() {
        for (var i = 0; i < D.length; i++) if (D[i].id === open) return D[i];
        return null;
    }

    function mountTV() {
        var p = findOpen();
        if (!p || !document.querySelector('.tv-box')) return;
        var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        var symbol = 'BINANCE:' + p.sym + 'USDT';
        var boot = function () {
            var box = document.querySelector('.tv-box');
            if (!box) return;   // card fechou antes de o script carregar
            try {
                removeTV();
                _tvWidget = new TradingView.widget({
                    width: '100%',
                    height: 340,
                    symbol: symbol,
                    interval: '60',
                    timezone: 'America/Sao_Paulo',
                    theme: theme,
                    style: '1',
                    locale: 'pt_BR',
                    toolbar_bg: theme === 'dark' ? '#131722' : '#f1f3f6',
                    enable_publishing: false,
                    allow_symbol_change: false,
                    container_id: 'tvBox',
                    hide_side_toolbar: true,
                    hide_top_toolbar: true,
                    hide_legend: false,
                    save_image: false
                });
            } catch (e) {
                box.innerHTML = '<div class="cap">Gráfico indisponível no momento.</div>';
            }
        };
        if (globalThis.TradingView) { boot(); return; }
        if (_tvLoading) return;   // onload reexecuta mountTV com o card atual
        _tvLoading = true;
        var s = document.createElement('script');
        s.src = 'https://s3.tradingview.com/tv.js';
        s.async = true;
        s.onload = function () { _tvLoading = false; mountTV(); };
        s.onerror = function () {
            _tvLoading = false;
            var b = document.querySelector('.tv-box');
            if (b) b.innerHTML = '<div class="cap">Não foi possível carregar o TradingView (verifique a internet).</div>';
        };
        document.head.appendChild(s);
    }

    /* ═══════════════ As 6 opções (extra) ═══════════════ */
    function extra(p) {
        var m = drm(p), s = st(p), H = dhr(p);
        var lastH = H.length ? H[H.length - 1] : 0;
        var prevH = H.length ? H[Math.max(0, H.length - 7)] : 0;
        var dt = lastH - prevH;
        var tr = dt > .05 ? ['▲ Aproximando', 'warn'] : dt < -.05 ? ['▼ Afastando', 'ok'] : ['● Estável', 'ok'];
        var nH = H.length || 28;

        // 0 — Histórico da distância
        if (V === 0) {
            var mn = Math.min.apply(null, [-3].concat(H)),
                mx = Math.max.apply(null, [.5].concat(H)),
                y = function (v) { return 4 + (mx - v) / (mx - mn) * 36; };
            var pts = H.map(function (v, i) { return (i * 300 / (nH - 1 || 1)) + ',' + y(v); }).join(' ');
            return '<div class="x"><svg viewBox="0 0 300 44" preserveAspectRatio="none" style="height:44px" role="img" aria-label="Histórico da distância">' +
                '<rect x="0" y="0" width="300" height="' + y(0) + '" fill="#ef4444" opacity=".14"/>' +
                '<rect x="0" y="' + y(0) + '" width="300" height="' + (y(-1) - y(0)) + '" fill="#f59e0b" opacity=".12"/>' +
                '<line x1="0" x2="300" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#fff" stroke-dasharray="3 3" opacity=".7"/>' +
                '<polyline points="' + pts + '" fill="none" stroke="' + col[s] + '" stroke-width="2"/>' +
                '<circle cx="300" cy="' + y(lastH) + '" r="3.5" fill="' + col[s] + '"/></svg>' +
                '<div class="r1 sm"><span>Distância nas últimas ' + nH + 'h</span><span class="grow"></span>' +
                '<span class="' + cls[tr[1]] + '">' + tr[0].slice(2) + ' ' + fmt(Math.abs(dt)) + '% em 6h</span></div></div>';
        }

        // 1 — Tendência e falta
        if (V === 1) {
            var rate = dt / 6,
                eta = m < 0 && rate > .005 ? -m / rate : null,
                passed = m >= -0.2;
            return '<div class="x r1 sm"><span class="pill ' + cls[tr[1]] + '">' + tr[0] + '</span><span class="grow"></span>' +
                '<span>' + (passed ? 'Passou' : 'Faltam') + ' <b class="num">US$ ' + fmt(Math.abs(p.strike - p.price)) + '</b></span></div>' +
                '<div class="sm" style="margin-top:4px">' +
                (eta !== null
                    ? (eta < p.h
                        ? 'No ritmo atual, toca o strike em <b>~' + left(eta) + '</b>, antes do vencimento'
                        : 'No ritmo atual, não toca o strike até vencer')
                    : 'Sem aproximação relevante no ritmo atual') +
                '</div>';
        }

        // 3 — Folga (V===2 é o overlay no head)
        if (V === 3) {
            var a = (p.c || []).reduce(function (t, c) { return t + (c.h - c.l) / (p.price || 1); }, 0) / nH * 100 * 4,
                f = Math.abs(m) / (a || 1),
                nb = Math.max(0, Math.min(5, Math.round(f)));
            var blocks = '';
            for (var bi = 0; bi < 5; bi++) {
                blocks += '<span style="' + (bi < nb ? 'background:' + col[s] : '') + '"></span>';
            }
            return '<div class="x"><div class="blk">' + blocks + '</div>' +
                '<div class="r1 sm" style="margin-top:4px"><span>Folga</span>' +
                '<b class="' + cls[s] + '">' + (m >= 0 ? 'sem folga' : fmt(f, 1) + 'x o movimento típico') + '</b>' +
                '<span class="grow"></span><span>vence ' + left(p.h) + '</span></div></div>';
        }

        // 4 — Fita de segurança
        if (V === 4) {
            var c = { ok: 0, warn: 0, bad: 0 };
            H.forEach(function (v) { c[stv(v)]++; });
            var strip = H.map(function (v) {
                return '<span style="background:' + col[stv(v)] + ';opacity:' + (stv(v) === 'ok' ? '.55' : '1') + '"></span>';
            }).join('');
            return '<div class="x"><div class="strip">' + strip + '</div>' +
                '<div class="r1 sm" style="margin-top:4px"><span>' + nH + 'h atrás</span><span class="grow"></span><span>' +
                (c.bad ? '<b class="c-bad">' + c.bad + 'h no strike</b>, ' : '') +
                (c.warn ? '<b class="c-warn">' + c.warn + 'h em atenção</b>' : '<b class="c-ok">sem sustos</b>') +
                '</span></div></div>';
        }

        // 5 — Cone até o vencimento
        if (V === 5) {
            var sgz = sig(p), hh = Math.max(p.h, .5),
                z = Math.log(p.strike / (p.price || p.strike)) / ((sgz || .01) * Math.sqrt(hh)),
                prCall = 1 - Phi(z),
                pr = p.tipo === 'PUT' ? 1 - prCall : prCall,
                band = function (f) { return (p.price || p.strike) * 1.28 * (sgz || .01) * Math.sqrt(hh * f); },
                ups = [], dns = [];
            for (var i2 = 0; i2 <= 10; i2++) {
                ups.push([120 + i2 * 17.6, p.price + band(i2 / 10)]);
                dns.push([120 + i2 * 17.6, p.price - band(i2 / 10)]);
            }
            var all = (p.c || []).map(function (c2) { return c2.c; })
                .concat([p.strike])
                .concat(ups.map(function (u) { return u[1]; }))
                .concat(dns.map(function (u2) { return u2[1]; }));
            var mn2 = Math.min.apply(null, all), mx2 = Math.max.apply(null, all),
                y2 = function (v) { return 4 + (mx2 - v) / (mx2 - mn2 || 1) * 52; };
            var hist = (p.c || []).map(function (c3, i3) { return (i3 * 120 / ((p.c.length - 1) || 1)) + ',' + y2(c3.c); }).join(' ');
            var poly = ups.concat(dns.slice().reverse()).map(function (q) { return q[0] + ',' + y2(q[1]); }).join(' ');
            return '<div class="x"><svg viewBox="0 0 300 60" preserveAspectRatio="none" style="height:60px" role="img" aria-label="Cone até o vencimento">' +
                '<polygon points="' + poly + '" fill="' + col[s] + '" opacity=".22"/>' +
                '<line x1="0" x2="300" y1="' + y2(p.strike) + '" y2="' + y2(p.strike) + '" stroke="#fff" stroke-dasharray="3 3" opacity=".75"/>' +
                '<polyline points="' + hist + '" fill="none" stroke="' + col[s] + '" stroke-width="2"/>' +
                '<line x1="120" x2="120" y1="0" y2="60" stroke="#243050"/></svg>' +
                '<div class="r1 sm"><span>Agora</span><span class="grow"></span>' +
                '<span>Chance de exercício <b class="' + (pr > .35 ? 'c-bad' : pr > .15 ? 'c-warn' : 'c-ok') + ' num">' + fmt(pr * 100, 0) + '%</b> (estimativa)</span></div></div>';
        }

        return '';
    }

    /* ═══════════════ Header do card ═══════════════ */
    function head(p) {
        var d = dist(p), s = st(p), c = cls[s], H = dhr(p), ov = '';

        // 2 — Faixa de 24h (overlay na barra)
        if (V === 2 && H.length) {
            var a = pos(Math.min.apply(null, H)), b = pos(Math.max.apply(null, H));
            ov = '<s style="left:' + a + '%;width:' + Math.max(3, b - a) + '%"></s>';
        }
        var mx = H.length ? Math.max.apply(null, H) : 0;

        var note2 = '';
        if (V === 2) {
            note2 = '<div class="sm" style="margin-top:4px">Moldura: mín. e máx. das últimas ' + (H.length || 28) + 'h. O máximo chegou a <b class="' + cls[stv(mx)] + '">' + fmt(Math.abs(mx)) + '% do strike</b>.</div>';
        }

        return '<div class="r1">' +
            '<span class="sym">' + esc(p.sym) + '</span>' +
            '<span class="chip">' + esc(p.tipo) + '</span>' +
            (p.corretora ? '<span class="chip">' + esc(p.corretora) + '</span>' : '') +
            '<span class="grow"></span>' +
            '<span class="dist num ' + c + '">' + sg(d) + '</span>' +
            '<span class="chev" aria-hidden="true">›</span>' +
            '</div>' +
            '<div class="hbar"><u style="width:' + pos(drm(p)) + '%"></u><i></i>' + ov + '</div>' +
            '<div class="r1 sm num"><span>Cot. ' + fmt(p.price) + '</span><span class="grow"></span>' +
            '<span>Strike ' + fmt(p.strike, 0) + '</span><span class="c-ok">+' + fmt(p.prem) + '</span></div>' +
            note2 + extra(p) +
            '<div class="tw">' + thermo(p) + '</div>';
    }

    /* ═══════════════ Renders ═══════════════ */
    function filtered() {
        return D.filter(function (p) { return filt === 'Todos' || p.sym === filt; })
            .sort(function (x, y) { return drm(y) - drm(x); });
    }

    function renderSum() {
        var el = $('#sum');
        if (!el) return;
        if (loading || err || !D.length) { el.innerHTML = ''; return; }
        var a = filtered();
        var bad = a.filter(function (p) { return st(p) === 'bad'; }).length,
            w = a.filter(function (p) { return st(p) !== 'ok'; }).length,
            c = bad ? 'bad' : w ? 'warn' : '';
        if (!a.length) { el.innerHTML = ''; return; }

        var minH = Math.min.apply(null, a.map(function (p) { return p.h; }));
        el.innerHTML = '<div class="sum ' + c + '">' +
            '<div class="big"><span class="dot"></span>' +
            (bad ? bad + ' no strike' : w ? w + ' perto do strike' : 'Tudo seguro') + '</div>' +
            '<div class="kp"><span>Prêmio total <b class="c-ok num">US$ ' + fmt(a.reduce(function (s, p) { return s + p.prem; }, 0)) + '</b></span>' +
            '<span>Próx. vencimento <b>' + left(minH) + '</b></span></div></div>';
    }

    function renderChips() {
        var el = $('#chips');
        if (!el) return;
        if (!D.length) { el.innerHTML = ''; return; }
        var counts = {};
        D.forEach(function (p) { counts[p.sym] = (counts[p.sym] || 0) + 1; });
        var syms = Object.keys(counts).sort();
        var h = '<button class="chip-btn' + (filt === 'Todos' ? ' on' : '') + '" data-f="Todos">Todos <span class="cnt">' + D.length + '</span></button>';
        syms.forEach(function (s) {
            h += '<button class="chip-btn' + (filt === s ? ' on' : '') + '" data-f="' + esc(s) + '">' + esc(s) +
                 ' <span class="cnt">' + counts[s] + '</span></button>';
        });
        el.innerHTML = h;
    }

    function renderList() {
        var el = $('#list');
        if (!el) return;
        removeTV();   // destrói o widget anterior antes de reconstruir o DOM

        if (loading) {
            el.innerHTML = '<div class="pa3-empty">Carregando posições…</div>';
            return;
        }
        if (err) {
            el.innerHTML = '<div class="pa3-empty">Falha ao carregar: ' + esc(err) +
                '<div style="margin-top:10px"><button class="chip-btn on" id="btnRetry">Tentar de novo</button></div></div>';
            return;
        }

        var a = filtered();
        var scrollY = window.scrollY;

        if (!a.length) {
            el.innerHTML = '<div class="pa3-empty">' +
                (D.length ? 'Nenhuma posição neste filtro' : 'Nenhuma posição aberta no banco') + '</div>';
            return;
        }

        el.innerHTML = a.map(function (p) {
            var isOpenCard = open === p.id;
            return '<article class="pos s-' + st(p) + (isOpenCard ? ' open' : '') + '" data-id="' + p.id + '">' +
                '<div class="hd" tabindex="0" role="button" aria-expanded="' + isOpenCard + '">' + head(p) + '</div>' +
                (isOpenCard ? body(p) : '') +
                '</article>';
        }).join('');

        window.scrollTo(0, scrollY);
        mountTV();   // se há card aberto, monta o TradingView no .body
    }

    function renderNote() {
        var el = $('#note');
        if (!el) return;
        el.innerHTML = '<span class="gain">Opção ' + (V + 1) + ' de 6</span>' +
            '<h2>' + N[V][0] + '</h2><p>' + N[V][1] + '</p>' +
            '<p class="mut"><b>Ganho sobre o C:</b> ' + N[V][2] + '</p>';
    }

    function renderTabs() {
        var el = $('#tabs');
        if (!el) return;
        el.innerHTML = N.map(function (n, i) {
            return '<button role="tab" aria-selected="' + (i === V) + '" data-v="' + i + '">' + (i + 1) + '. ' + n[0] + '</button>';
        }).join('');
    }

    function renderAll() {
        renderTabs();
        renderNote();
        renderSum();
        renderChips();
        renderList();
        renderUpd();
    }

    function renderUpd() {
        var s = Math.round((Date.now() - last) / 1000);
        var el = $('#upd'), sub = $('#hdrSub');
        if (!el) return;
        if (loading) { el.textContent = 'carregando…'; return; }
        if (err) { el.textContent = 'erro ao carregar'; return; }
        el.textContent = s < 5 ? 'atualizado agora' : ('atualizado há ' + s + 's');
        if (sub) sub.classList.toggle('stale', s > 30);
    }

    /* ═══════════════ Atualização manual ═══════════════ */
    function refreshNow() {
        var btn = $('#btnRefreshV3');
        if (btn) btn.classList.add('spin');
        var done = function () { if (btn) btn.classList.remove('spin'); };
        _kcache = {};
        loadAll().then(done, done);
    }

    /* ═══════════════ Tema ═══════════════ */
    var ICO_MOON = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
    var ICO_SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';

    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        var ico = document.getElementById('themeIco');
        if (ico) ico.innerHTML = t === 'dark' ? ICO_MOON : ICO_SUN;
        try { localStorage.setItem('pa3Theme', t); } catch (e) { /* sem storage */ }
    }

    function initTheme() {
        var saved = null;
        try { saved = localStorage.getItem('pa3Theme'); } catch (e) { /* sem storage */ }
        applyTheme(saved || 'dark');
    }

    /* ═══════════════ Eventos ═══════════════ */
    function bind() {
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;

            if (t.closest('#btnRetry')) { loadAll(); return; }

            var v = t.closest('[data-v]');
            if (v) {
                V = +v.getAttribute('data-v');
                open = null;
                renderAll();
                return;
            }

            var f = t.closest('[data-f]');
            if (f) {
                filt = f.getAttribute('data-f');
                renderSum();
                renderChips();
                renderList();
                return;
            }

            var c = t.closest('.hd');
            if (c && c.parentElement && c.parentElement.hasAttribute('data-id')) {
                var id = +c.parentElement.getAttribute('data-id');
                open = (open === id) ? null : id;
                renderList();
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                var c = e.target && e.target.closest && e.target.closest('.hd');
                if (c) {
                    e.preventDefault();
                    c.click();
                }
            }
        });

        var br = $('#btnRefreshV3');
        if (br) br.addEventListener('click', refreshNow);
        var bt = $('#btnTheme');
        if (bt) bt.addEventListener('click', function () {
            var cur = document.documentElement.getAttribute('data-theme');
            applyTheme(cur === 'dark' ? 'light' : 'dark');
            if (open !== null) renderList();   // recria o widget TV com o novo tema
        });

        // cotações ao vivo (WebSocket Binance via CryptoLive)
        document.addEventListener('cryptoLiveQuote', function (ev) {
            var d = ev && ev.detail;
            if (d && d.asset) applyLive(d.asset, parseFloat(d.price));
        });
    }

    /* ═══════════════ Boot ═══════════════ */
    initTheme();
    bind();
    renderAll();   // estado inicial: carregando
    loadAll();

    // frescor do texto "atualizado há Xs"
    setInterval(renderUpd, 1000);
    // segurança: 2.5s — sync do cache do CryptoLive (mesmo padrão da tela real)
    setInterval(syncTick, 2500);
})();

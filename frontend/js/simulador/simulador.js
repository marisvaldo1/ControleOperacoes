/* ============================================================================
   simulador.js — Tela Simulador (The Wheel) · v3.1.0
   Reescrita igual ao protótipo ideias/scannerClaude2.html, com dados REAIS
   da tastytrade (zero mock) e interface somente leitura.

   Novidades v3.1.0:
     1) Input de ticker direto no scanner (ignora filtros)
     2) Radar com toggle Bolhas ↔ DataTable
     3) Loading em todas as chamadas de API
     4) Aba do ativo abre em Tabela por padrão
     5) Cartão do contrato destaca: data exercício, strike, prêmio, break-even
     6) Saldo do scanner usado nas consultas iniciais
   ========================================================================== */
(function () {
    'use strict';

    const MAX_POR_RODADA = 15;
    const DIST_PADRAO     = 5.0;
    const HV_PADRAO       = 50;
    const TD              = 252;
    const EPS             = 1e-9;

    const $  = (id) => document.getElementById(id);
    const q  = (sel, r) => (r || document).querySelector(sel);
    const qa = (sel, r) => Array.from((r || document).querySelectorAll(sel));

    // ─── Estado global ───────────────────────────────────────────────────────
    const G = {
        saldo: 10000,
        fill:  'mid',
        hv:    HV_PADRAO,
        dte:   5,
        dMin:  2,
        dMax:  8,
        dlt:   0.30,
        sort:  'ann',
        radarView: 'bubbles', // 'bubbles' | 'table'
        updated: null,
    };

    const D = {
        status:   null,
        universo: [],
        premios:  {},
        saldoOk:  false,
    };

    let abas = ['scan'];
    const ativos = {};
    let abaAtual = 'scan';

    let seqPremios = 0;
    let seqStrikes = 0;
    let loadingCount = 0; // contador global de requisições em andamento

    // ─── Formatação ──────────────────────────────────────────────────────────
    function fmt(n, casas) {
        casas = (casas === undefined) ? 2 : casas;
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        return Number(n).toLocaleString('pt-BR', {
            minimumFractionDigits: casas, maximumFractionDigits: casas,
        });
    }
    function usd(n, casas) {
        casas = (casas === undefined) ? 2 : casas;
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        const v = Number(n);
        return (v < 0 ? '−' : '') + 'US$ ' + fmt(Math.abs(v), casas);
    }
    function sg(n, casas) {
        casas = (casas === undefined) ? 2 : casas;
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        const v = Number(n);
        return (v > 0.0000001 ? '+' : v < -0.0000001 ? '−' : '') + 'US$ ' + fmt(Math.abs(v), casas);
    }
    function pct(n, casas) {
        casas = (casas === undefined) ? 1 : casas;
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        return fmt(Number(n), casas) + '%';
    }
    function kfmt(k) {
        if (k === null || k === undefined || isNaN(Number(k))) return '—';
        const v = Number(k);
        return fmt(v, v % 1 === 0 ? 0 : 1);
    }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
    }
    function fmtDataBR(iso) {
        if (!iso) return '—';
        const [a, m, d] = String(iso).split('-');
        return `${d}/${m}/${a}`;
    }

    // ─── Loading global ──────────────────────────────────────────────────────
    function showGlobalLoading(on) {
        loadingCount += on ? 1 : -1;
        if (loadingCount < 0) loadingCount = 0;
        const el = $('simLoading');
        if (el) el.classList.toggle('sim-on', loadingCount > 0);
    }

    // ─── Infra ───────────────────────────────────────────────────────────────
    async function api(caminho, opcoes) {
        showGlobalLoading(true);
        try {
            const resp = await fetch(caminho, opcoes);
            let corpo = null;
            try { corpo = await resp.json(); } catch (_) { }
            if (!resp.ok || (corpo && corpo.success === false)) {
                throw new Error((corpo && (corpo.message || corpo.error)) || ('HTTP ' + resp.status));
            }
            return corpo;
        } finally {
            showGlobalLoading(false);
        }
    }

    function toastErro(titulo, mensagem) {
        if (typeof iziToast !== 'undefined') {
            iziToast.error({ title: titulo, message: String(mensagem).slice(0, 300) });
        } else { console.error(titulo, mensagem); }
    }
    function toastAviso(titulo, mensagem) {
        if (typeof iziToast !== 'undefined') {
            iziToast.warning({ title: titulo, message: String(mensagem).slice(0, 300) });
        } else { console.warn(titulo, mensagem); }
    }
    function debounce(fn, ms) {
        let t = null;
        return function () { const args = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, args), ms); };
    }
    function chunk(lista, tamanho) {
        const partes = [];
        for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho));
        return partes;
    }

    // ─── Identificação visual do ativo ──────────────────────────────────────
    const CORES = ['#f59e0b', '#818cf8', '#fb923c', '#22d3ee', '#60a5fa',
                   '#a78bfa', '#f87171', '#9ca3af', '#3b82f6', '#ef4444',
                   '#fbbf24', '#4ade80'];
    function corDe(simbolo) {
        let h = 0;
        for (let i = 0; i < simbolo.length; i++) h = (h * 31 + simbolo.charCodeAt(i)) >>> 0;
        return CORES[h % CORES.length];
    }
    function icoDe(simbolo) { return (simbolo || '?')[0]; }

    // ─── Helpers de UI ──────────────────────────────────────────────────────
    const FM = {
        pct:  (v) => pct(v, 1), pct0: (v) => pct(v, 0),
        usd:  (v) => usd(v), usd0: (v) => usd(v, 0),
        d2:   (v) => fmt(v, 2),
        dte:  (v) => Math.round(v) + (Math.round(v) === 1 ? ' pregão' : ' pregões'),
        ct:   (v) => v + (v === 1 ? ' contrato' : ' contratos'),
    };
    function sl(k, label, min, max, step, f) {
        return '<div class="sc-sl"><div class="sc-sl__t"><label>' + label +
            '</label><b data-vk="' + k + '"></b></div>' +
            '<input type="range" data-k="' + k + '" data-f="' + f + '" min="' + min +
            '" max="' + max + '" step="' + step + '"></div>';
    }
    function dual(label, k1, k2, min, max, step, f) {
        return '<div class="sc-sl"><div class="sc-sl__t"><label>' + label +
            '</label><b data-dv="' + k1 + '"></b></div>' +
            '<div class="sc-dual" data-f="' + f + '"><div class="sc-tr"></div><div class="sc-fl"></div>' +
            '<input type="range" data-dual="lo" data-k="' + k1 + '" min="' + min + '" max="' + max + '" step="' + step + '">' +
            '<input type="range" data-dual="hi" data-k="' + k2 + '" min="' + min + '" max="' + max + '" step="' + step + '">' +
            '</div></div>';
    }
    function seg(k, opts, cur) {
        return '<div class="sc-seg">' + opts.map(function (o) {
            return '<button type="button" data-seg="' + k + '" data-v="' + o[0] + '" class="' +
                (String(o[0]) === String(cur) ? 'sc-on' : '') + '">' + o[1] + '</button>';
        }).join('') + '</div>';
    }
    function kpi(l, v, s) {
        return '<div class="sc-kpi"><div class="sc-kpi__l">' + l + '</div><div class="sc-kpi__v">' +
            v + '</div>' + (s ? '<div class="sc-kpi__s">' + s + '</div>' : '') + '</div>';
    }
    function paint(inp) {
        const min = parseFloat(inp.min), max = parseFloat(inp.max);
        inp.style.setProperty('--p', ((inp.value - min) / (max - min) * 100) + '%');
    }
    function paintDual(du) {
        const lo = q('[data-dual=lo]', du), hi = q('[data-dual=hi]', du);
        const mn = parseFloat(lo.min), mx = parseFloat(lo.max);
        const a = (parseFloat(lo.value) - mn) / (mx - mn) * 100;
        const b = (parseFloat(hi.value) - mn) / (mx - mn) * 100;
        const fl = q('.sc-fl', du);
        fl.style.left = a + '%'; fl.style.width = Math.max(0, b - a) + '%';
        const lab = du.parentNode.querySelector('[data-dv]');
        if (lab) lab.textContent = FM[du.dataset.f](parseFloat(lo.value)) + ' a ' + FM[du.dataset.f](parseFloat(hi.value));
    }
    function sync(root, st) {
        qa('input[type=range][data-k]:not([data-dual])', root).forEach(function (inp) {
            const k = inp.dataset.k;
            if (st[k] === undefined) return;
            if (document.activeElement !== inp) inp.value = st[k];
            const v = q('[data-vk="' + k + '"]', root);
            if (v) v.textContent = FM[inp.dataset.f](parseFloat(inp.value));
            paint(inp);
        });
        qa('.sc-dual', root).forEach(function (du) {
            qa('input', du).forEach(function (i) {
                if (st[i.dataset.k] !== undefined && document.activeElement !== i) i.value = st[i.dataset.k];
            });
            paintDual(du);
        });
        qa('[data-seg]', root).forEach(function (b) {
            const k = b.dataset.seg;
            if (st[k] !== undefined) b.classList.toggle('sc-on', String(st[k]) === b.dataset.v);
        });
    }
    function wire(root, st, cb) {
        sync(root, st);
        qa('input[type=range][data-k]:not([data-dual])', root).forEach(function (inp) {
            inp.addEventListener('input', function () {
                const k = inp.dataset.k; st[k] = parseFloat(inp.value);
                const v = q('[data-vk="' + k + '"]', root);
                if (v) v.textContent = FM[inp.dataset.f](st[k]);
                paint(inp); cb(k);
            });
        });
        qa('.sc-dual', root).forEach(function (du) {
            const lo = q('[data-dual=lo]', du), hi = q('[data-dual=hi]', du);
            const upd = function (who) {
                let a = parseFloat(lo.value), b = parseFloat(hi.value);
                if (a > b) { if (who === 'lo') { a = b; lo.value = a; } else { b = a; hi.value = b; } }
                st[lo.dataset.k] = a; st[hi.dataset.k] = b; paintDual(du);
                cb(who === 'lo' ? lo.dataset.k : hi.dataset.k);
            };
            lo.addEventListener('input', function () { upd('lo'); });
            hi.addEventListener('input', function () { upd('hi'); });
        });
        qa('[data-seg]', root).forEach(function (b) {
            b.addEventListener('click', function () {
                const k = b.dataset.seg, v = b.dataset.v;
                st[k] = /^-?\d+(\.\d+)?$/.test(v) ? parseFloat(v) : v;
                qa('[data-seg="' + k + '"]', root).forEach(function (x) { x.classList.toggle('sc-on', x === b); });
                cb(k);
            });
        });
    }
    function tween(el, to, f) {
        const from = el._v == null ? 0 : el._v; el._v = to;
        const t0 = performance.now();
        (function step(t) {
            const k = Math.min(1, Math.max(0, (t - t0) / 380)), e = 1 - Math.pow(1 - k, 3);
            el.textContent = f(from + (to - from) * e);
            if (k < 1) requestAnimationFrame(step); else el.textContent = f(to);
        })(t0);
    }
    function ring(svg, p, color) {
        const s = 120, w = 11, r = (s - w) / 2, c = 2 * Math.PI * r;
        svg.setAttribute('viewBox', '0 0 ' + s + ' ' + s);
        svg.innerHTML = '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#1f2d4d" stroke-width="' + w + '"/>' +
            '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + w +
            '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' +
            (c * (1 - Math.max(0, Math.min(1, p)))) + '" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .5s"/>';
    }
    function ticks(a, b, n) {
        n = n || 5; const span = b - a || 1, raw = span / n;
        const mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
        const st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
        const out = []; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10));
        return out;
    }
    function plot(cfg) {
        const w = cfg.w || 640, h = cfg.h || 260;
        const l = cfg.l === undefined ? 52 : cfg.l, r = cfg.r === undefined ? 16 : cfg.r;
        const t = cfg.t === undefined ? 14 : cfg.t, b = cfg.b === undefined ? 28 : cfg.b;
        const m = { l: l, r: r, t: t, b: b, w: w, h: h };
        const X = function (x) { return l + (x - cfg.x0) / (cfg.x1 - cfg.x0) * (w - l - r); };
        const Y = function (y) { return t + (cfg.y1 - y) / (cfg.y1 - cfg.y0) * (h - t - b); };
        let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" class="sc-plot">';
        (cfg.yt || []).forEach(function (v) {
            s += '<line x1="' + l + '" x2="' + (w - r) + '" y1="' + Y(v) + '" y2="' + Y(v) +
                '" class="sc-gl' + (v === 0 ? ' sc-z' : '') + '"/><text x="' + (l - 6) + '" y="' + (Y(v) + 3.5) +
                '" text-anchor="end" class="sc-ax">' + (cfg.yf ? cfg.yf(v) : v) + '</text>';
        });
        (cfg.xt || []).forEach(function (v) {
            s += '<text x="' + X(v) + '" y="' + (h - 8) + '" text-anchor="middle" class="sc-ax">' +
                (cfg.xf ? cfg.xf(v) : v) + '</text>';
        });
        (cfg.layers || []).forEach(function (f) { s += f(X, Y, m); });
        return s + '</svg>';
    }

    // ─── Regras de filtro / zonas / melhor strike ───────────────────────────
    function noFiltro(r, f) {
        return (r.dist || 0) >= f.dMin - EPS && (r.dist || 0) <= f.dMax + EPS &&
            r.delta !== null && r.delta !== undefined &&
            Math.abs(r.delta) <= f.dlt + EPS && (r.premio || 0) >= 0.01;
    }
    function cabe(r, f) { return (r.capital || 0) <= f.saldo; }
    function okFiltro(r, f) { return noFiltro(r, f) && cabe(r, f); }
    function melhorDe(strikes, f) {
        const validos = (strikes || []).filter(function (r) { return noFiltro(r, f); });
        if (!validos.length) return null;
        return validos.slice().sort(function (a, b) {
            return (b.anualizado || 0) * (b.pop_lucro || 0) - (a.anualizado || 0) * (a.pop_lucro || 0);
        })[0];
    }
    function marcarZonas(strikes, preco) {
        if (!strikes || !strikes.length) return strikes || [];
        const proximos = strikes.slice().sort(function (a, b) {
            return Math.abs(a.strike - preco) - Math.abs(b.strike - preco);
        }).slice(0, 3).map(function (r) { return r.strike; });
        strikes.forEach(function (r) {
            if (proximos.indexOf(r.strike) >= 0) r.zona = 'ATM';
            else if (r.strike > preco) r.zona = 'ITM';
            else r.zona = 'OTM';
        });
        return strikes;
    }
    function strikeMaisProximo(strikes) {
        if (!strikes || !strikes.length) return null;
        let melhor = null, melhorD = Infinity;
        strikes.forEach(function (r) {
            const d = Math.abs(r.dist || 0);
            if (d < melhorD) { melhorD = d; melhor = r; }
        });
        return melhor;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ABA: SCANNER
    // ══════════════════════════════════════════════════════════════════════
    const SC = {
        root: null, scans: [],

        mount: function (el) {
            this.root = el;
            el.innerHTML =
                '<div class="sc-split"><aside class="sc-side">' +
                '<h4>💼 Saldo na corretora</h4>' +
                '<div class="sc-money"><span>US$</span><input id="scSaldo" type="number" min="0" step="500" value="' + G.saldo + '"></div>' +
                '<div class="sc-qk">' + [2000, 5000, 10000, 25000, 50000, 100000].map(function (v) {
                    return '<button type="button" data-qk="' + v + '">' + (v / 1000) + 'k</button>';
                }).join('') + '</div>' +
                '<div class="sc-tank" data-tank></div><hr class="sc-sep">' +
                // Ticker direto
                '<div class="sc-sl"><div class="sc-sl__t"><label>🎯 Ticker direto (ignora filtros)</label></div>' +
                '<input type="text" id="scTickerDireto" placeholder="Ex: SPY, AAPL, TSLA" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--sc-border);background:var(--sc-panel3);color:var(--sc-text);font-family:inherit;font-size:13px;text-transform:uppercase;">' +
                '<div class="sc-hint" style="margin-top:4px">Pressione Enter para analisar o ativo direto, pulando os filtros de saldo.</div>' +
                '<hr class="sc-sep">' +
                sl('dte', 'DTE da PUT', 1, 45, 1, 'dte') +
                dual('Distância do strike (mín. a máx.)', 'dMin', 'dMax', -5, 25, 0.5, 'pct') +
                sl('dlt', 'Delta máximo (|Δ|)', 0.05, 0.6, 0.01, 'd2') +
                '<hr class="sc-sep"><div class="sc-gl">Preço de venda da PUT</div>' +
                seg('fill', [['mid', 'Mid (cotação atual)'], ['bid', 'Bid']], G.fill) +
                '</aside><section>' +
                '<div class="sc-kpis" data-k></div>' +
                '<div class="sc-card"><div class="sc-card__h">' +
                '📡 Radar de ativos <small>eixo X: capital usado pelo lote · eixo Y: melhor retorno anual · bolha: prêmio líquido</small>' +
                '<div style="margin-left:auto"><label class="sc-seg" style="padding:2px;background:transparent;border:none"><button type="button" data-seg="radarView" data-v="bubbles" class="sc-on">🫧 Bolhas</button><button type="button" data-seg="radarView" data-v="table">📋 Tabela</button></label></div>' +
                '</div><div data-radar></div></div>' +
                '<div class="sc-card" style="background:none;border:none;padding:0">' +
                '<div class="sc-card__h">🧩 Ativos que cabem no seu saldo <small data-cnt></small>' +
                seg('sort', [['ann', 'Anualizado'], ['pop', 'PoP'], ['prem', 'Prêmio'], ['lot', 'Menor lote']], G.sort) +
                '</div><div class="sc-agrid" data-grid></div><div data-hid></div></div>' +
                '</section></div>';

            wire(el, G, (k) => this.aoMudar(k));

            q('#scSaldo', el).addEventListener('input', (e) => {
                G.saldo = Math.max(0, parseFloat(e.target.value) || 0);
                this.aoMudar('saldo');
            });
            qa('[data-qk]', el).forEach((b) => b.addEventListener('click', () => {
                G.saldo = parseFloat(b.dataset.qk);
                q('#scSaldo', el).value = G.saldo;
                this.aoMudar('saldo');
            }));

            // Ticker direto - Enter para analisar
            q('#scTickerDireto', el).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const ticker = e.target.value.trim().toUpperCase();
                    if (ticker) { abrirAba(ticker); e.target.value = ''; }
                }
            });

            el.addEventListener('click', (e) => {
                const o = e.target.closest('[data-open]');
                if (o) { abrirAba(o.dataset.open, o.dataset.strike != null ? o.dataset.strike : null); return; }
                const c = e.target.closest('circle[data-sym]');
                if (c) abrirAba(c.dataset.sym);
            });
        },

        aoMudar: function (k) {
            if (k === 'dMin' || k === 'dMax' || k === 'dlt' || k === 'sort' || k === 'radarView') {
                this.update();
            } else if (k === 'saldo') {
                this.update();
                carregarPremios(false);
            } else if (k === 'dte' || k === 'fill') {
                this.update();
                recarregarPremios();
            }
        },

        candidatos: function () {
            return D.universo.filter(function (i) { return (i.capital_lote || 0) <= G.saldo; });
        },

        update: function () {
            const el = this.root;
            if (!el) return;
            const f = G;
            qa('[data-qk]', el).forEach(function (b) {
                b.classList.toggle('sc-on', parseFloat(b.dataset.qk) === G.saldo);
            });

            const candidatos = this.candidatos();
            const prontos = candidatos.filter(function (i) { return D.premios[i.simbolo]; });
            const scans = prontos.map(function (item) {
                const p = D.premios[item.simbolo];
                const strikes = p.strikes || [];
                const best = melhorDe(strikes, f);
                const inF = strikes.filter(function (r) { return noFiltro(r, f); });
                const minLot = inF.length ? Math.min.apply(null, inF.map(function (r) { return r.capital; })) : null;
                const z = {
                    ITM: strikes.filter(function (r) { return r.zona === 'ITM'; }).sort(function (a, b) { return a.strike - b.strike; }).slice(0, 4),
                    ATM: strikes.filter(function (r) { return r.zona === 'ATM'; }).sort(function (a, b) { return b.strike - a.strike; }),
                    OTM: strikes.filter(function (r) { return r.zona === 'OTM'; }).sort(function (a, b) { return b.strike - a.strike; }).slice(0, 4),
                };
                return { item: item, simbolo: item.simbolo, strikes: strikes, best: best, minLot: minLot, z: z, iv: p.iv_atm, ok: best && cabe(best, f), dte: p.dte };
            });
            this.scans = scans;

            const vis = scans.filter(function (s) { return s.ok; });
            const lockCap = scans.filter(function (s) { return !s.ok && s.minLot !== null && s.minLot > f.saldo; });
            const nof = scans.filter(function (s) { return !s.ok && lockCap.indexOf(s) < 0; });

            const key = { ann: s => s.best ? s.best.anualizado : -Infinity, pop: s => s.best ? s.best.pop_lucro : -Infinity, prem: s => s.best ? s.best.premio_liquido : -Infinity, lot: s => s.best ? -s.best.capital : Infinity }[G.sort] || (s => s.best ? s.best.anualizado : -Infinity);
            vis.sort(function (a, b) { return key(b) - key(a); });

            const total = D.universo.length;
            const faltando = candidatos.length - prontos.length;
            q('[data-tank]', el).innerHTML =
                '<b>' + vis.length + ' de ' + total + ' ativos</b> cabem no filtro' +
                '<div class="sc-bar"><i style="width:' + (total ? vis.length / total * 100 : 0) + '%"></i></div>' +
                (vis.length ? 'Com ' + usd(f.saldo, 0) + ' você opera até <b>' +
                 Math.max.apply(null, vis.map(function (s) { return Math.floor(f.saldo / s.best.capital); })) + '</b> contratos do lote mais barato.'
                 : 'Aumente o saldo ou relaxe os filtros.') +
                (faltando > 0 ? '<br>' + faltando + ' ativo(s) carregando…' : '');

            // KPIs
            const nStr = vis.reduce(function (n, s) { return n + (s.ok ? 1 : 0); }, 0);
            if (!vis.length) { q('[data-k]', el).innerHTML = ''; }
            else {
                const comBest = vis.filter(function (s) { return s.best; });
                const topAnn = comBest.slice().sort(function (a, b) { return (b.best.anualizado || 0) - (a.best.anualizado || 0); })[0];
                const topPop = comBest.slice().sort(function (a, b) { return (b.best.pop_lucro || 0) - (a.best.pop_lucro || 0); })[0];
                const topPrem = comBest.slice().sort(function (a, b) { return (b.best.premio_liquido || 0) - (a.best.premio_liquido || 0); })[0];
                q('[data-k]', el).innerHTML =
                    kpi('🧩 Ativos elegíveis', vis.length, nStr + ' strikes dentro do filtro') +
                    kpi('🚀 Maior anualizado', topAnn.simbolo + ' ' + kfmt(topAnn.best.strike), pct((topAnn.best.anualizado || 0) * 100, 0) + ' a.a. bruto') +
                    kpi('🛡️ Maior PoP', topPop.simbolo + ' ' + kfmt(topPop.best.strike), 'PoP ' + pct((topPop.best.pop_lucro || 0) * 100, 0)) +
                    kpi('💰 Maior prêmio', topPrem.simbolo + ' ' + kfmt(topPrem.best.strike), sg(topPrem.best.premio_liquido) + ' líquido');
            }

            // Radar - Bolhas ou Tabela
            const allBest = vis.map(function (s) { return s.best; }).filter(Boolean);
            const maxY = Math.max.apply(null, [10].concat(allBest.map(function (b) { return (b.anualizado || 0) * 100; }))) * 1.18;
            const maxNet = Math.max.apply(null, [1].concat(allBest.map(function (b) { return Math.max(0, b.premio_liquido || 0); })));

            if (G.radarView === 'table') {
                // DataTable do radar
                q('[data-radar]', el).innerHTML = vis.length
                    ? '<div style="overflow-x:auto"><table class="sc-t" style="font-size:11px"><thead><tr>' +
                      '<th>Ativo</th><th>Preço</th><th>Lote</th><th>% Saldo</th><th>Strike</th><th>Prêmio</th><th>Anual.</th><th>PoP</th><th>Δ</th><th>Ação</th></tr></thead><tbody>' +
                      vis.map(function (s) {
                          const b = s.best;
                          const use = b.capital / Math.max(1, f.saldo) * 100;
                          return '<tr><td><b>' + esc(s.simbolo) + '</b></td><td>' + usd(s.item.preco) + '</td><td>' + usd(b.capital, 0) + '</td><td>' + pct(use, 1) + '</td><td><b>' + kfmt(b.strike) + '</b></td><td class="sc-up">' + sg(b.premio_liquido) + '</td><td>' + pct((b.anualizado || 0) * 100, 1) + '</td><td>' + pct((b.pop_lucro || 0) * 100, 0) + '</td><td>' + fmt(b.delta, 2) + '</td><td><button class="sc-btn sc-btn-blue sc-btn-sm" data-open="' + esc(s.simbolo) + '">Abrir</button></td></tr>';
                      }).join('') + '</tbody></table></div>'
                    : '<div class="sc-empty">Nenhum ativo dentro do filtro e do saldo.</div>';
            } else {
                // Bolhas (original)
                q('[data-radar]', el).innerHTML = vis.length
                    ? plot({ w: 820, h: 250, x0: 0, x1: 100, y0: 0, y1: maxY, xt: [0, 25, 50, 75, 100], yt: ticks(0, maxY, 4), xf: v => v + '%', yf: v => fmt(v, 0) + '%', b: 30,
                        layers: [function (X, Y) {
                            return vis.map(function (s) {
                                const b = s.best;
                                const x = Math.min(100, b.capital / Math.max(1, f.saldo) * 100);
                                const y = (b.anualizado || 0) * 100;
                                const r = 6 + Math.sqrt(Math.max(0, b.premio_liquido || 0) / maxNet) * 15;
                                const col = corDe(s.simbolo);
                                return '<circle data-sym="' + s.simbolo + '" cx="' + X(x) + '" cy="' + Y(y) + '" r="' + r + '" fill="' + col + '" opacity=".72" stroke="#0a0f1c" stroke-width="2"/><text x="' + X(x) + '" y="' + (Y(y) + 3.5) + '" text-anchor="middle" style="font-size:9.5px;font-weight:800;fill:#0a0f1c;pointer-events:none">' + esc(s.simbolo) + '</text>';
                            }).join('');
                        }]
                    })
                    : '<div class="sc-empty">Nenhum ativo dentro do filtro e do saldo.</div>';
            }

            // Cards
            q('[data-cnt]', el).textContent = '— ' + vis.length + ' visíveis';
            q('[data-grid]', el).innerHTML = vis.map(function (s) {
                const b = s.best;
                const lote = b.capital;
                const use = lote / Math.max(1, f.saldo) * 100;
                const zr = function (z) {
                    return '<div class="sc-zr"><span class="sc-zl sc-z-' + z + '" title="' + (z === 'ITM' ? 'acima do preço' : z === 'ATM' ? '3 mais próximos do preço' : 'abaixo do preço') + '">' + z + '</span><div class="sc-chips">' + (s.z[z].map(function (r) { return chip(s.simbolo, r, f); }).join('') || '<span class="sc-dim" style="font-size:10.5px">sem strikes</span>') + '</div></div>';
                };
                const sub = [s.item.setor, s.item.perfil].filter(Boolean).join(' · ') || (s.item.atividade || '—');
                const titulo = [s.item.empresa, s.item.atividade].filter(Boolean).join(' · ');
                return '<div class="sc-ac"><div class="sc-ac__h"><span class="sc-ac__i" style="background:' + corDe(s.simbolo) + '">' + esc(icoDe(s.simbolo)) + '</span><div><b>' + esc(s.simbolo) + '</b><small title="' + esc(titulo) + '">' + esc(sub) + '</small></div><div class="sc-ac__p"><b>' + usd(s.item.preco) + '</b><small>IV ' + pct(s.iv != null ? s.iv * 100 : null, 0) + '</small></div><button class="sc-btn sc-btn-blue sc-btn-sm" data-open="' + esc(s.simbolo) + '">Abrir ›</button></div><div class="sc-ac__use"><div class="sc-use' + (use > 60 ? ' sc-hi' : '') + '"><i style="width:' + Math.min(100, use) + '%"></i></div><small>Melhor lote ' + usd(lote, 0) + ' · usa ' + pct(use, 0) + ' do saldo · cabe ' + Math.floor(f.saldo / lote) + ' contrato(s)</small></div><div class="sc-ac__best">⭐ <b>PUT ' + kfmt(b.strike) + '</b> · ' + sg(b.premio_liquido) + ' · PoP <b>' + pct((b.pop_lucro || 0) * 100, 0) + '</b> · <b>' + pct((b.anualizado || 0) * 100, 0) + '</b> a.a.</div>' + zr('ITM') + zr('ATM') + zr('OTM') + '</div>';
            }).join('') || '<div class="sc-empty" style="grid-column:1/-1">Nenhum ativo comporta o filtro atual.</div>';

            // Ocultos
            const hid = [];
            lockCap.forEach(function (s) { hid.push('<span>🔒 ' + esc(s.simbolo) + ' · mín. ' + usd(s.minLot, 0) + '</span>'); });
            nof.forEach(function (s) { hid.push('<span>∅ ' + esc(s.simbolo) + ' · sem strike no filtro</span>'); });
            q('[data-hid]', el).innerHTML = hid.length ? '<div class="sc-hidden-note"><b>Ocultos:</b> ' + hid.join(' ') + '</div>' : '';
        },
    };

    function chip(simbolo, r, f) {
        const lote = r.capital || 0;
        const ok = okFiltro(r, f);
        const afford = cabe(r, f);
        const cls = ok ? '' : (!afford ? 'sc-lock' : 'sc-hidden');
        const em = !afford ? '🔒' : ((r.premio || 0) >= 0.01 ? sg(r.premio_liquido, 0) : '—');
        return '<button type="button" class="sc-chip ' + cls + '" data-open="' + esc(simbolo) + '" data-strike="' + r.strike + '" style="--pop:' + Math.round((r.pop_lucro || 0) * 100) + '" title="PoP ' + pct((r.pop_lucro || 0) * 100, 0) + ' · Δ ' + fmt(r.delta, 2) + '"><b>' + kfmt(r.strike) + '</b><span>lote ' + fmt(lote, 0) + '</span><em>' + em + '</em></button>';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ABA: ATIVO
    // ══════════════════════════════════════════════════════════════════════
    function abrirAba(simbolo, strike) {
        if (!simbolo) return;
        simbolo = String(simbolo).toUpperCase();
        if (simbolo === 'scan') { mostrarAba('scan'); return; }

        if (!ativos[simbolo]) {
            const d = document.createElement('div');
            d.style.display = 'none';
            $('scHost').appendChild(d);
            ativos[simbolo] = {
                sym: simbolo,
                root: d,
                st: {
                    sym: simbolo,
                    dte: G.dte, dMin: G.dMin, dMax: G.dMax, dlt: G.dlt, strikeLimit: 50,
                    view: 'tbl', K: null, n: 1, showAll: 0, sort: 'K', dir: -1,
                    strikes: null, preco: null, iv: null, carregando: false,
                    vencimentos: [], vencSelecionado: null,
                },
            };
            abas.push(simbolo);
            AssetView.mount(ativos[simbolo]);
        }
        const t = ativos[simbolo];
        if (strike != null) t.st.K = Number(strike);
        mostrarAba(simbolo);
        garantirAtivo(simbolo);
        if (!t.st.strikes && !t.st.carregando) AssetView.carregar(t);
        history.replaceState(null, '', location.pathname + '?ativo=' + encodeURIComponent(simbolo));
    }

    function fecharAba(simbolo) {
        const t = ativos[simbolo];
        if (!t) return;
        t.root.remove(); delete ativos[simbolo];
        abas = abas.filter(function (a) { return a !== simbolo; });
        mostrarAba('scan');
        history.replaceState(null, '', location.pathname);
    }

    function mostrarAba(id) {
        abaAtual = id; renderAbas();
        SC.root.style.display = id === 'scan' ? '' : 'none';
        Object.keys(ativos).forEach(function (k) { ativos[k].root.style.display = k === id ? '' : 'none'; });
        if (id === 'scan') SC.update(); else AssetView.update(ativos[id]);
    }

    function renderAbas() {
        $('scTabs').innerHTML = abas.map(function (id) {
            if (id === 'scan') return '<button type="button" class="sc-tab' + (abaAtual === 'scan' ? ' sc-on' : '') + '" data-t="scan">🔎 Scanner</button>';
            const item = itemDe(id);
            const preco = item ? item.preco : (ativos[id] && ativos[id].st.preco);
            return '<button type="button" class="sc-tab' + (abaAtual === id ? ' sc-on' : '') + '" data-t="' + esc(id) + '"><i style="background:' + corDe(id) + '"></i>' + esc(id) + '<small>' + (preco != null ? fmt(preco, 2) : '—') + '</small><span class="sc-x" data-x="' + esc(id) + '">✕</span></button>';
        }).join('');
    }

    function itemDe(simbolo) {
        const u = D.universo.find(function (i) { return i.simbolo === simbolo; });
        if (u) return u;
        const p = D.premios[simbolo];
        if (p) return { simbolo: simbolo, preco: p.preco, capital_lote: p.capital_lote };
        return null;
    }

    const AssetView = {
        mount: function (t) {
            const el = t.root, st = t.st, sym = t.sym;
            el.innerHTML =
                '<div class="sc-ah" data-ah></div>' +
                '<div class="sc-split"><aside class="sc-side"><h4>🎚️ Filtros de ' + esc(sym) + '</h4>' +
                sl('dte', 'DTE da PUT', 1, 45, 1, 'dte') +
                dual('Distância do strike (mín. a máx.)', 'dMin', 'dMax', -5, 25, 0.5, 'pct') +
                sl('dlt', 'Delta máximo (|Δ|)', 0.05, 0.6, 0.01, 'd2') +
                '<label class="sc-chk"><input type="checkbox" data-showall> Mostrar strikes fora do filtro</label>' +
                '<hr class="sc-sep">' +
                sl('strikeLimit', 'Qtd. de strikes exibidos', 10, 200, 10, 'ct') +
                '<hr class="sc-sep">' +
                '<button class="sc-btn sc-btn-gray sc-btn-sm" data-reset type="button" style="width:100%">↺ Usar filtros do scanner</button>' +
                '<hr class="sc-sep">' +
                '<div class="sc-gl">Visualização dos strikes</div>' +
                seg('view', [['tbl', '📋 Tabela'], ['lad', '🪜 Escada']], st.view) +
                '<div class="sc-note">PoP = chance de lucro no vencimento (preço final acima do break-even). Os strikes fora do filtro aparecem esmaecidos quando a caixa está marcada.</div>' +
                '</aside><section>' +
                '<div class="sc-card"><div class="sc-card__h" data-vt></div><div data-view></div></div>' +
                '<div class="sc-card sc-cc"><div class="sc-cc__top"><div>' +
                '<div class="sc-cc__t" data-ct></div><small data-cz></small></div>' +
                '<div style="width:250px">' + sl('n', 'Contratos (limitado pelo saldo)', 1, 10, 1, 'ct') + '</div></div>' +
                '<div class="sc-cc__g">' +
                '<div><div class="sc-cc__l">Prêmio líquido</div><div class="sc-cc__v sc-up" data-prem>0</div><div class="sc-cc__s" data-prems></div></div>' +
                '<div class="sc-cc__ring"><svg data-r1></svg><div class="sc-rt"><b data-pop>0%</b><span>PoP</span></div></div>' +
                '<div class="sc-cc__ring"><svg data-r2></svg><div class="sc-rt"><b data-use>0%</b><span>saldo usado</span></div></div>' +
                '<div class="sc-cc__m" data-m></div></div>' +
                '<div class="sc-ruler" data-ruler></div><div class="sc-ins" data-ins></div></div>' +
                '</section></div>';

            wire(el, st, () => this.onMudou(t));
            q('[data-showall]', el).addEventListener('change', (e) => { st.showAll = e.target.checked ? 1 : 0; this.update(t); });
            q('[data-reset]', el).addEventListener('click', () => { Object.assign(st, { dte: G.dte, dMin: G.dMin, dMax: G.dMax, dlt: G.dlt, strikeLimit: 50 }); sync(el, st); this.onMudou(t); });
            el.addEventListener('click', (e) => {
                const r = e.target.closest('[data-pk]');
                if (r) { st.K = parseFloat(r.dataset.pk); this.update(t); return; }
                const th = e.target.closest('th[data-s]');
                if (th) { const k = th.dataset.s; if (st.sort === k) st.dir *= -1; else { st.sort = k; st.dir = -1; } this.update(t); }
            });
        },

        onMudou: function (t) {
            // Se DTE mudou, reseta o vencimento selecionado
            if (t.st.dte !== this.dteCarregado(t)) {
                t.st.vencSelecionado = null;
            }
            if (t.st.dte !== this.dteCarregado(t) || G.fill !== this.fillCarregado(t)) this.carregar(t);
            else this.update(t);
        },

        dteCarregado: function (t) { return t._dte; },
        fillCarregado: function (t) { return t._fill; },

        carregar: async function (t) {
            const st = t.st;
            const meu = t._seq = (t._seq || 0) + 1;
            st.carregando = true;
            this.update(t);
            try {
                // Busca com dte OU vencimento específico
                const params = 'tipo=PUT&dist_min=0&dist_max=100&delta_max=1' +
                    '&hv=' + G.hv + '&fill=' + encodeURIComponent(G.fill) +
                    '&contratos=1&comissao=0&incluir_itm=1';
                let url = API_BASE + '/api/simulador/strikes?simbolo=' + encodeURIComponent(t.sym) + '&' + params;
                if (st.vencSelecionado) {
                    url += '&vencimento=' + encodeURIComponent(st.vencSelecionado);
                } else {
                    url += '&dte=' + st.dte;
                }
                const r = await api(url);
                if (meu !== t._seq) return;
                st.strikes   = marcarZonas(r.strikes || [], r.preco);
                st.preco     = r.preco;
                st.venc      = r.vencimento;
                st.vencimentos = r.vencimentos || [];
                st._dte      = st.dte;
                st._fill     = G.fill;
                st.carregando = false;
                // Se não tem vencimento selecionado, usa o primeiro do DTE
                if (!st.vencSelecionado && r.vencimento) {
                    st.vencSelecionado = r.vencimento.data;
                }
                if (st.K == null || !st.strikes.some(function (s) { return s.strike === st.K; })) st.K = null;
                renderAbas(); this.update(t);
            } catch (e) {
                if (meu !== t._seq) return;
                st.strikes = []; st.carregando = false; this.update(t);
                toastErro('Erro ao carregar strikes de ' + t.sym, e.message);
            }
        },

        linhas: function (t) {
            const st = t.st, todas = st.strikes || [];
            const filtradas = todas.filter(function (r) { return noFiltro(r, st); });
            const base = st.showAll ? todas : filtradas;
            // Limita a quantidade de strikes centrados no preço atual (spot)
            const limit = st.strikeLimit || 50;
            const spot = st.preco != null ? st.preco : 0;
            const limitadas = base.slice()
                .sort(function (a, b) { return Math.abs((a.strike || 0) - spot) - Math.abs((b.strike || 0) - spot); })
                .slice(0, limit)
                .sort(function (a, b) { return (b.strike || 0) - (a.strike || 0); });
            return { todas: limitadas, filtradas: limitadas };
        },

        update: function (t) {
            const el = t.root, st = t.st; if (!el) return;
            const l = this.linhas(t);
            const rows = st.showAll ? l.todas : l.filtradas;
            const ordenadas = rows.slice().sort(function (a, b) { return b.strike - a.strike; });
            const disponiveis = st.showAll ? l.todas : l.filtradas;
            if (st.K == null || !disponiveis.some(function (r) { return r.strike === st.K; })) {
                const best = melhorDe(l.filtradas, st);
                st.K = best ? best.strike : (disponiveis.length ? disponiveis[0].strike : null);
            }
            const sel = (st.strikes || []).find(function (r) { return r.strike === st.K; }) || null;
            const near = strikeMaisProximo(disponiveis);
            this.renderAh(t, l.filtradas.length);
            this.renderView(t, ordenadas, sel, near, l.filtradas.length);
            this.renderCard(t, sel, l.filtradas);
        },

        renderAh: function (t, nFiltro) {
            const st = t.st;
            const item = itemDe(t.sym);
            const preco = st.preco != null ? st.preco : (item ? item.preco : null);
            const best = melhorDe(this.linhas(t).filtradas, st);
            const sub = [item && item.setor, item && item.atividade].filter(Boolean).join(' · ');
            
            // Todas as datas de vencimento disponíveis
            const todasDatas = st.vencimentos || [];
            const temMultiplasDatas = st.dte > 1 && todasDatas.length > 1;
            
            // Vencimento selecionado (se não definido, usa o mais próximo do DTE)
            const vencSel = st.vencSelecionado || (st.venc ? st.venc.data : null);
            const vencObj = todasDatas.find(function (v) { return v.data === vencSel; }) || st.venc;
            const venc = vencObj ? fmtDataBR(vencObj.data) + ' (' + vencObj.dias + 'd · ' + vencObj.tipo + ')' : '—';

            let vencHtml = '<div>Vencimento<b>' + venc + '</b></div>';
            if (temMultiplasDatas) {
                const opts = todasDatas.map(function (v) {
                    return '<option value="' + v.data + '"' + (v.data === vencSel ? ' selected' : '') +
                        '>' + fmtDataBR(v.data) + ' (' + v.dias + 'd · ' + v.tipo + ')' + '</option>';
                }).join('');
                vencHtml = '<div>Vencimento<select class="sc-venc-select" data-venc-sel style="margin-left:8px;padding:4px 8px;border-radius:6px;border:1px solid var(--sc-border);background:var(--sc-panel3);color:var(--sc-text);font-family:inherit;font-size:12px;">' + opts + '</select></div>';
            }

            q('[data-ah]', t.root).innerHTML =
                '<span class="sc-ac__i" style="background:' + corDe(t.sym) + '">' + esc(icoDe(t.sym)) + '</span>' +
                '<div><h3>' + esc(t.sym) + ' <small>' + esc((item && item.empresa) || '') + '</small></h3>' +
                '<small><span class="sc-pulse"></span>cotação ao vivo · ' + esc(sub || '—') + (st.iv != null ? ' · IV ' + pct(st.iv * 100, 0) : '') + '</small></div>' +
                '<div class="sc-ah__s">' +
                '<div class="sc-cot sc-flash">Cotação<b>' + usd(preco) + '</b></div>' +
                vencHtml +
                '<div>Saldo na corretora<b>' + usd(G.saldo, 0) + '</b></div>' +
                '<div>Strikes no filtro<b>' + nFiltro + '</b></div>' +
                '<div>Melhor (anual × PoP)<b>' + (best ? 'PUT ' + kfmt(best.strike) : '—') + '</b></div>' +
                '</div>';

            // Event listener para mudança de vencimento
            if (temMultiplasDatas) {
                const sel = q('[data-venc-sel]', t.root);
                if (sel) sel.addEventListener('change', function () {
                    st.vencSelecionado = this.value;
                    AssetView.carregar(t);
                });
            }
        },

        renderView: function (t, rows, sel, near, nFiltro) {
            const st = t.st, el = t.root;
            const vt = q('[data-vt]', el);
            vt.innerHTML = nFiltro + ' strike(s) dentro do filtro e do saldo <small>' + (st.showAll ? '· mostrando também os de fora (esmaecidos)' : '') + '</small>';
            const host = q('[data-view]', el);
            if (st.carregando || st.strikes === null) { host.innerHTML = '<div class="sc-empty">Carregando strikes de ' + esc(t.sym) + '…</div>'; return; }
            if (!st.strikes.length) { host.innerHTML = '<div class="sc-empty">Erro ao carregar strikes de ' + esc(t.sym) + '. Verifique a conexão e tente atualizar.</div>'; return; }
            if (!rows.length) { host.innerHTML = '<div class="sc-empty">Nenhum strike atende aos filtros e ao saldo. Abra a distância, aumente o delta máximo ou marque "Mostrar strikes fora do filtro".</div>'; return; }
            host.innerHTML = st.view === 'tbl' ? this.tabela(rows, st, sel, near) : this.escada(rows, st, sel, near);
        },

        escada: function (rows, st, sel, near) {
            const maxN = Math.max.apply(null, [1].concat(rows.map(function (r) { return Math.max(0, r.premio_liquido || 0); })));
            const simbolo = st.sym || '';
            let h = '<div class="sc-lad__r sc-hd"><span>Strike</span><span>Prêmio líquido</span><span>Delta</span><span>PoP</span><span>Anual.</span><span></span></div>';
            let spotDone = false;
            const spot = function () { return '<div class="sc-spotline">▶ ' + esc(simbolo) + ' ' + usd(st.preco) + ' (cotação)</div>'; };
            rows.forEach(function (r) {
                if (!spotDone && st.preco != null && r.strike < st.preco) { h += spot(); spotDone = true; }
                const fora = !noFiltro(r, st);
                const cls = ['sc-lad__r'];
                if (sel && r.strike === sel.strike) cls.push('sc-sel');
                if (fora) cls.push('sc-out');
                if (near && r.strike === near.strike) cls.push('sc-near');
                h += '<div class="' + cls.join(' ') + '" data-pk="' + r.strike + '"><span class="sc-k">' + kfmt(r.strike) + '<span class="sc-badge sc-z-' + r.zona + '">' + r.zona + '</span></span><span class="sc-bar"><i style="width:' + (Math.max(0, r.premio_liquido || 0) / maxN * 100) + '%"></i><span>' + sg(r.premio_liquido) + '</span></span><span>' + fmt(r.delta, 2) + '</span><span class="' + ((r.pop_lucro || 0) >= 0.85 ? 'sc-up' : (r.pop_lucro || 0) < 0.7 ? 'sc-amb' : '') + '">' + pct((r.pop_lucro || 0) * 100, 0) + '</span><span>' + pct((r.anualizado || 0) * 100, 0) + '</span><span>' + (cabe(r, st) ? '' : '🔒') + '</span></div>';
            });
            if (!spotDone) h += spot();
            return h;
        },

        tabela: function (rows, st, sel, near) {
            const key = st.sort;
            const campo = { K: 'strike', lot: 'capital', net: 'premio_liquido', dist: 'dist', delta: 'delta', pop: 'pop_lucro', pITM: 'pop', ann: 'anualizado', be: 'breakeven' }[key] || 'strike';
            const s = rows.slice().sort(function (a, b) { return ((a[campo] || 0) - (b[campo] || 0)) * st.dir; });
            const th = function (k, l) { return '<th data-s="' + k + '" class="' + (st.sort === k ? 'sc-on' : '') + '">' + l + (st.sort === k ? (st.dir < 0 ? ' ▼' : ' ▲') : '') + '</th>'; };
            return '<div style="overflow-x:auto"><table class="sc-t"><thead><tr>' +
                th('K', 'Strike') + '<th>Zona</th>' + th('lot', 'Lote') + th('net', 'Prêmio') +
                th('dist', 'Dist.') + th('delta', 'Delta') + th('pop', 'PoP') +
                th('pITM', 'Exerc.') + th('ann', 'Anual.') + th('be', 'Break-even') +
                '</tr></thead><tbody>' +
                s.map(function (r) {
                    const cls = ['sc-row'];
                    if (sel && r.strike === sel.strike) cls.push('sc-sel');
                    if (!noFiltro(r, st)) cls.push('sc-out');
                    if (near && r.strike === near.strike) cls.push('sc-near');
                    return '<tr class="' + cls.join(' ') + '" data-pk="' + r.strike + '"><td><b>' + kfmt(r.strike) + '</b></td><td><span class="sc-badge sc-z-' + r.zona + '">' + r.zona + '</span></td><td>' + usd(r.capital, 0) + (cabe(r, st) ? '' : ' 🔒') + '</td><td class="sc-up">' + sg(r.premio_liquido) + '</td><td>' + pct(r.dist, 2) + '</td><td>' + fmt(r.delta, 2) + '</td><td>' + pct((r.pop_lucro || 0) * 100, 0) + '</td><td>' + pct((r.pop || 0) * 100, 1) + '</td><td>' + pct((r.anualizado || 0) * 100, 0) + '</td><td>' + usd(r.breakeven) + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        },

        renderCard: function (t, r, filtradas) {
            const el = t.root, st = t.st;
            const nInput = q('input[data-k="n"]', el);
            if (!r) {
                q('[data-ct]', el).textContent = 'Selecione um strike';
                q('[data-cz]', el).textContent = '';
                q('[data-ins]', el).innerHTML = 'Nenhum strike selecionado.';
                q('[data-ruler]', el).innerHTML = ''; q('[data-m]', el).innerHTML = ''; return;
            }
            const lote = r.capital || r.strike * 100;
            const maxN = Math.max(1, Math.min(10, Math.floor(G.saldo / Math.max(1, lote))));
            nInput.max = maxN; if (st.n > maxN) st.n = maxN; if (st.n < 1) st.n = 1; sync(el, st);
            const c = st.n, net = (r.premio_liquido || 0) * c, lotT = lote * c, pctS = net / Math.max(1, G.saldo) * 100;
            const annLot = (r.anualizado || 0) * 100, annS = pctS * TD / Math.max(1, st.dte);
            const popLucro = r.pop_lucro || 0, pExerc = r.pop || 0, perMes = 21 / Math.max(1, st.dte) * pExerc;
            const venc = st.venc ? fmtDataBR(st.venc.data) : '—';

            // Título do contrato - DESTAQUE: Data exercício, Strike, Prêmio
            q('[data-ct]', el).innerHTML =
                '<span style="font-size:15px;font-weight:800">PUT ' + t.sym + ' ' + kfmt(r.strike) + '</span>' +
                '<span style="margin-left:12px;color:var(--sc-cyan)">' + venc + '</span>';
            q('[data-cz]', el).innerHTML =
                '<span class="sc-badge sc-z-' + r.zona + '">' + r.zona + '</span> ' +
                pct(Math.abs(r.dist || 0), 2) + ' ' + ((r.dist || 0) >= 0 ? 'abaixo' : 'acima') +
                ' da cotação · Lote <b>' + usd(lote, 0) + '</b> · Prêmio unitário <b>' + usd(r.premio) + '</b> · ' +
                (cabe(r, st) ? 'Cabe no saldo (até ' + Math.floor(G.saldo / lote) + ' contratos)' : '🔒 Não cabe no saldo');

            const premEl = q('[data-prem]', el);
            tween(premEl, net, function (v) { return sg(v); });
            premEl.className = 'sc-cc__v ' + (net >= 0 ? 'sc-up' : 'sc-down');
            q('[data-prems]', el).textContent = pct(pctS, 2) + ' do saldo · ' + c + ' contrato(s) · Preço ' + (G.fill === 'mid' ? 'Mid' : 'Bid') + ' ' + fmt(r.premio, 3);

            tween(q('[data-pop]', el), popLucro * 100, function (v) { return pct(v, 0); });
            ring(q('[data-r1]', el), popLucro, popLucro >= 0.85 ? '#22c55e' : popLucro >= 0.7 ? '#f59e0b' : '#ef4444');
            const use = lotT / Math.max(1, G.saldo);
            tween(q('[data-use]', el), use * 100, function (v) { return pct(v, 0); });
            ring(q('[data-r2]', el), use, use > 0.6 ? '#f59e0b' : '#22d3ee');

            // Métricas detalhadas
            q('[data-m]', el).innerHTML =
                '<div><span>Prêmio total</span><b>' + sg(net) + '</b></div>' +
                '<div><span>% s/ saldo</span><b>' + pct(pctS, 2) + '</b></div>' +
                '<div><span>% Anual (lote)</span><b>' + pct(annLot, 1) + '</b></div>' +
                '<div><span>% Anual (saldo)</span><b>' + pct(annS, 1) + '</b></div>' +
                '<div><span>Prob. Exercício</span><b class="' + (pExerc > 0.2 ? 'sc-amb' : '') + '">' + pct(pExerc * 100, 1) + '</b></div>' +
                '<div><span>Break-even</span><b>' + usd(r.breakeven) + '</b></div>' +
                '<div><span>Delta · Bid/Ask</span><b>' + fmt(r.delta, 2) + ' · ' + fmt(r.bid) + '/' + fmt(r.ask) + '</b></div>' +
                '<div><span>Data Exercício</span><b>' + venc + '</b></div>' +
                '<div><span>Strike</span><b>' + usd(r.strike) + '</b></div>';

            // Régua break-even
            const be = r.breakeven, K = r.strike, spot = st.preco;
            const lo = Math.min(be, K, spot) * 0.985, hi = Math.max(K, spot) * 1.015;
            const P = function (v) { return (v - lo) / (hi - lo) * 100; };
            q('[data-ruler]', el).innerHTML =
                '<div class="sc-rz sc-r1" style="left:0;width:' + P(be) + '%"></div>' +
                '<div class="sc-rz sc-r2" style="left:' + P(be) + '%;width:' + Math.max(0, P(K) - P(be)) + '%"></div>' +
                '<div class="sc-rz sc-r3" style="left:' + P(K) + '%;width:' + (100 - P(K)) + '%"></div>' +
                '<div class="sc-rm" style="left:' + P(be) + '%;color:#fca5a5">' + usd(be) + '<small>Break-even</small></div>' +
                '<div class="sc-rm sc-low" style="left:' + P(K) + '%;color:#fcd34d"><small>Strike</small>' + usd(K) + '</div>' +
                '<div class="sc-rm" style="left:' + P(spot) + '%;color:#67e8f9;top:-4px">▼ ' + usd(spot) + '<small>Cotação</small></div>' +
                '<span class="sc-rl" style="left:0">Prejuízo</span>' +
                '<span class="sc-rl" style="right:0">Expira sem valor: fica o prêmio</span>';

            q('[data-ins]', el).innerHTML =
                '💡 Você recebe <b>' + sg(net) + '</b> (' + pct(pctS, 2) + ' do saldo). ' +
                'Há <b>' + pct(pExerc * 100, 1) + '</b> de chance de exercício (≈ ' + fmt(perMes, 1) +
                ' por mês repetindo a cada ' + st.dte + ' pregão(ões)) e <b>' + pct(popLucro * 100, 0) +
                '</b> de chance de lucro (preço final acima de ' + usd(be) + '). ' +
                'Se exercido, custo efetivo = <b>' + usd(be) + '</b> e CALL de saída ≥ <b>' + usd(K) + '</b>.';
        },
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Dados: status, conta, universo e prêmios
    // ═══════════════════════════════════════════════════════════════════════
    async function carregarStatus() {
        const s = await api(API_BASE + '/api/simulador/status');
        D.status = s;
        const badge = $('simStatusBadge');
        if (s.configurado) { badge.className = 'badge bg-success-lt'; badge.textContent = 'tastytrade conectado'; }
        else { badge.className = 'badge bg-warning-lt'; badge.textContent = 'credenciais incompletas'; }
        $('simStatusDetalhe').textContent = s.ambiente + ' · ' + String(s.base_url || '').replace('https://', '');
        const aviso = $('simAvisoConfig');
        if (!s.configurado) {
            const faltando = [];
            if (!s.tem_client_id) faltando.push('TASTYTRADE_CLIENT_ID');
            if (!s.tem_client_secret) faltando.push('TASTYTRADE_CLIENT_SECRET');
            if (!s.tem_refresh_token) faltando.push('TASTYTRADE_REFRESH_TOKEN');
            $('simAvisoConfigTexto').textContent = ' Preencha ' + faltando.join(', ') + ' em backend/.env. Até lá nenhuma cotação é retornada — a tela não usa dados fictícios.';
            aviso.classList.remove('d-none');
        } else { aviso.classList.add('d-none'); }
        return s;
    }

    async function carregarConta() {
        try {
            const r = await api(API_BASE + '/api/simulador/conta');
            if (r.saldo != null && !D.saldoOk) {
                G.saldo = Number(r.saldo); D.saldoOk = true;
                const inp = $('scSaldo'); if (inp && document.activeElement !== inp) inp.value = G.saldo;
            }
        } catch (e) { console.warn('Sem saldo da conta:', e.message); }
    }

    async function carregarUniverso() {
        const r = await api(API_BASE + '/api/simulador/universo?max_preco=1000&max_lote=1000000'); // Sem limite inicial
        D.universo = r.itens || []; renderAbas();
    }

    function candidatosPremios() {
        return D.universo.filter(function (i) { return (i.capital_lote || 0) <= G.saldo && !D.premios[i.simbolo]; }).map(function (i) { return i.simbolo; });
    }

    async function carregarPremios(limpar) {
        if (limpar) D.premios = {};
        const meu = ++seqPremios;
        const pendentes = candidatosPremios();
        if (!pendentes.length) { SC.update(); return; }
        const rodadas = chunk(pendentes, MAX_POR_RODADA);
        for (const rodada of rodadas) {
            if (meu !== seqPremios) return;
            try {
                const r = await api(API_BASE + '/api/simulador/premios?simbolos=' + encodeURIComponent(rodada.join(',')) + '&distancia_pct=' + DIST_PADRAO + '&com_strikes=1&dte=' + G.dte + '&hv=' + G.hv + '&fill=' + encodeURIComponent(G.fill));
                (r.itens || []).forEach(function (i) { D.premios[i.simbolo] = i; });
            } catch (e) { console.warn('Falha ao carregar prêmios:', e.message); }
        }
        if (meu === seqPremios) SC.update();
    }

    const recarregarPremios = debounce(function () { carregarPremios(true); }, 450);

    async function garantirAtivo(simbolo) {
        if (!D.universo.some(function (i) { return i.simbolo === simbolo; })) {
            try {
                const r = await api(API_BASE + '/api/simulador/universo?simbolos=' + encodeURIComponent(simbolo));
                (r.itens || []).forEach(function (i) { if (!D.universo.some(function (u) { return u.simbolo === i.simbolo; })) D.universo.push(i); });
                renderAbas();
            } catch (_) { }
        }
        if (!D.premios[simbolo]) {
            try {
                const r = await api(API_BASE + '/api/simulador/premios?simbolos=' + encodeURIComponent(simbolo) + '&distancia_pct=' + DIST_PADRAO + '&com_strikes=1&dte=' + G.dte + '&hv=' + G.hv + '&fill=' + encodeURIComponent(G.fill));
                (r.itens || []).forEach(function (i) { D.premios[i.simbolo] = i; }); renderAbas(); SC.update();
            } catch (_) { }
        }
        const t = ativos[simbolo];
        if (t && !t.st.strikes && !t.st.carregando) AssetView.carregar(t);
    }

    async function atualizarTudo() {
        try { showGlobalLoading(true); await Promise.all([carregarStatus(), carregarConta()]); await carregarUniverso(); await carregarPremios(true); G.updated = new Date(); marcarAtualizado(); renderAbas(); if (abaAtual === 'scan') SC.update(); else if (ativos[abaAtual]) AssetView.carregar(ativos[abaAtual]); }
        catch (e) { toastErro('Erro ao consultar a tastytrade', e.message); }
        finally { showGlobalLoading(false); }
    }

    function marcarAtualizado() { $('scUpd').textContent = 'Atualizado: ' + (G.updated ? G.updated.toTimeString().slice(0, 5) : '--:--'); }

    // ═══════════════════════════════════════════════════════════════════════
    // Eventos globais
    // ══════════════════════════════════════════════════════════════════════
    function bindGlobal() {
        $('btnSimular').addEventListener('click', atualizarTudo);
        $('scRefresh').addEventListener('click', atualizarTudo);

        document.addEventListener('click', function (e) {
            const b = e.target.closest('[data-sem-acesso]');
            if (!b) return;
            toastAviso('Não disponível', '"' + b.getAttribute('data-sem-acesso') + '" não está disponível: o sistema é somente leitura e não envia ordens à corretora.');
        });
        ['bClose', 'bCalc', 'bUse'].forEach(function (id) {
            $(id).addEventListener('click', function () {
                const rotulo = id === 'bClose' ? 'Fechar' : id === 'bCalc' ? 'Calcular' : 'Usar como Nova Operação';
                toastAviso('Não disponível', '"' + rotulo + '" não está disponível: o sistema é somente leitura e não envia ordens à corretora.');
            });
        });

        $('scTabs').addEventListener('click', function (e) {
            const x = e.target.closest('[data-x]');
            if (x) { e.stopPropagation(); fecharAba(x.dataset.x); return; }
            const b = e.target.closest('[data-t]');
            if (b) { mostrarAba(b.dataset.t); if (b.dataset.t !== 'scan') history.replaceState(null, '', location.pathname + '?ativo=' + encodeURIComponent(b.dataset.t)); else history.replaceState(null, '', location.pathname); }
        });
    }

    // ─── Inicialização ───────────────────────────────────────────────────────
    function init() {
        const host = $('scHost');
        const sroot = document.createElement('div');
        host.appendChild(sroot);
        SC.mount(sroot);
        bindGlobal();

        (async () => {
            try { await carregarStatus(); } catch (e) { toastErro('Erro ao carregar status', e.message); }
            await carregarConta();
            await atualizarTudo();

            const ativoUrl = new URLSearchParams(location.search).get('ativo');
            if (ativoUrl) abrirAba(ativoUrl.toUpperCase());
        })();
    }

    if (window.__appLayoutReady) init(); else document.addEventListener('layoutReady', init, { once: true });
})();
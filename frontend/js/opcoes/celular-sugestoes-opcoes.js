// celular-sugestoes-opcoes.js — Estado vazio do card "Posições Abertas Agora"
// v1.0.0 — Paridade com o crypto (frontend/js/crypto/celular-sugestoes.js)
//
// Quando não há operação ABERTA, o card mostra sugestões por ATIVO BASE,
// usando a última operação de cada ativo (últimos 30 dias) do banco + cotação
// realtime (yfinance). Cada card traz strike, prêmio, PoP, vencimento e botões
// para abrir a simulação ou o mapa de calor anual.
//
// Uso: window.CelularSugestoesOpcoes.mount(hostElement, operacoes)
(function () {
    'use strict';

    var CSS_ID = 'cso-style';
    var INST = 0;
    var R = 0.1075; // risk-free (Selic) — mesmo padrão do restante do app

    /* ------------------------------------------------------------------ */
    /* CSS (escopo .cso-scope)                                             */
    /* ------------------------------------------------------------------ */
    var CSS = '' +
        '.cso-scope{--bg:transparent;--card:#0c1426;--tile:#111b30;--line:#243050;--fg:#e8edf7;--mut:#8d99b3;--call:#f59e0b;--put:#3b82f6;--ok:#22c55e;--bad:#ef4444;' +
        'box-sizing:border-box;display:block;padding:4px 0;margin:0;color:var(--fg);font-size:.78rem}' +
        '.cso-scope *{box-sizing:border-box}' +
        '.cso-title{font-family:Syne,sans-serif;font-size:.82rem;font-weight:700;color:var(--fg);margin:2px 0 2px}' +
        '.cso-sub{font-size:.66rem;color:var(--mut);margin-bottom:10px}' +
        '.cso-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}' +
        '.cso-card{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--call);border-radius:10px;padding:10px 11px;display:flex;flex-direction:column;gap:6px}' +
        '.cso-card.put{border-left-color:var(--put)}' +
        '.cso-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
        '.cso-ativo{font-family:Syne,sans-serif;font-weight:700;font-size:.85rem;letter-spacing:.02em}' +
        '.cso-tag{font-size:.58rem;font-weight:700;padding:2px 6px;border-radius:5px;border:1px solid var(--line);background:var(--tile);color:var(--mut)}' +
        '.cso-tag.call{color:var(--call);border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.1)}' +
        '.cso-tag.put{color:var(--put);border-color:rgba(59,130,246,.4);background:rgba(59,130,246,.1)}' +
        '.cso-tag.itm{color:var(--bad);border-color:rgba(239,68,68,.45);background:rgba(239,68,68,.12)}' +
        '.cso-tag.otm{color:var(--ok);border-color:rgba(34,197,94,.4);background:rgba(34,197,94,.1)}' +
        '.cso-rows{display:flex;flex-direction:column;gap:3px}' +
        '.cso-row{display:flex;justify-content:space-between;gap:8px;font-size:.66rem;border-bottom:1px dashed rgba(255,255,255,.06);padding-bottom:2px}' +
        '.cso-row:last-child{border-bottom:none}' +
        '.cso-k{color:var(--mut)}' +
        '.cso-v{font-family:JetBrains Mono,monospace;font-weight:700;color:var(--fg)}' +
        '.cso-v.pos{color:var(--ok)}.cso-v.neg{color:var(--bad)}' +
        '.cso-pop{height:6px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden}' +
        '.cso-pop i{display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#22c55e)}' +
        '.cso-actions{display:flex;gap:6px;margin-top:2px}' +
        '.cso-btn{flex:1;font-size:.6rem;font-weight:600;padding:5px 8px;border-radius:6px;cursor:pointer;border:1px solid rgba(59,130,246,.35);background:rgba(59,130,246,.12);color:#93b8ff}' +
        '.cso-btn:hover{background:rgba(59,130,246,.24)}' +
        '.cso-btn.ghost{border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.1);color:#f5c26b}' +
        '.cso-btn.ghost:hover{background:rgba(245,158,11,.2)}' +
        '.cso-none{font-size:.7rem;color:var(--mut);padding:10px 2px}' +
        '[data-bs-theme="light"] .cso-card{background:var(--bs-body-bg,#fff);border-color:rgba(0,0,0,.12)}' +
        '[data-bs-theme="light"] .cso-k{color:#6c757d}' +
        '[data-bs-theme="light"] .cso-v{color:#1f2937}' +
        '[data-bs-theme="light"] .cso-tag{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.12)}';

    function injectCss() {
        if (document.getElementById(CSS_ID)) return;
        var s = document.createElement('style');
        s.id = CSS_ID;
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    /* ------------------------------------------------------------------ */
    /* Helpers                                                             */
    /* ------------------------------------------------------------------ */
    function num(v) {
        var n = parseFloat(v);
        return isFinite(n) ? n : 0;
    }

    function brl(v) {
        return 'R$ ' + num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function pct(v) {
        return num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }

    function esc(s) {
        var amp = String.fromCharCode(38);
        return String(s == null ? '' : s)
            .replace(/&/g, amp + 'amp;')
            .replace(/</g, amp + 'lt;')
            .replace(/>/g, amp + 'gt;')
            .replace(/"/g, amp + 'quot;')
            .replace(/'/g, amp + '#39;');
    }

    function normAtivo(op) {
        return String((op && (op.ativo_base || op.ativo)) || '').toUpperCase().trim();
    }

    function tipoOf(op) {
        var t = String((op && op.tipo) || '').toUpperCase();
        if (t !== 'CALL' && t !== 'PUT') t = String((op && op.ativo) || '').toUpperCase().indexOf('PUT') >= 0 ? 'PUT' : 'CALL';
        return t;
    }

    function isVenda(op) {
        var tp = String((op && op.tipo_operacao) || '').toUpperCase();
        if (tp) return tp === 'VENDA';
        return num((op && op.quantidade)) < 0;
    }

    function ord(op) {
        return String((op && (op.data_operacao || op.created_at)) || '') + '|' + String((op && op.id) || 0);
    }

    function isRecent(op) {
        var raw = String((op && (op.data_operacao || op.created_at)) || '');
        var m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
        if (!m) return true;
        var t = new Date(m[1] + 'T00:00:00').getTime();
        if (!isFinite(t)) return true;
        return (Date.now() - t) <= 31 * 86400000;
    }

    function diasAte(venc) {
        if (!venc) return null;
        var fim = new Date(String(venc).substring(0, 10) + 'T00:00:00');
        if (isNaN(fim.getTime())) return null;
        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return Math.round((fim - hoje) / 86400000);
    }

    function diasUteisAte(venc) {
        var dias = diasAte(venc);
        if (dias === null || dias <= 0) return 0;
        // dias úteis aproximados (sem calendário de feriados)
        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        var uteis = 0;
        for (var i = 0; i < dias; i++) {
            var d = new Date(hoje.getTime() + i * 86400000).getDay();
            if (d !== 0 && d !== 6) uteis++;
        }
        return uteis;
    }

    function cdf(x) {
        if (typeof window.cdf === 'function') return window.cdf(x);
        // Aproximação de Abramowitz & Stegun 7.1.26
        var t = 1 / (1 + 0.2316419 * Math.abs(x));
        var d = 0.3989422804014327 * Math.exp(-x * x / 2);
        var p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
        return x > 0 ? 1 - p : p;
    }

    /* PoP (probabilidade de lucro) — Black-Scholes no ponto de equilíbrio */
    function calcPoP(spread, preco, spot, sigma, venc, tipo, venda) {
        if (!spot || spot <= 0 || !preco) return null;
        var dias = diasAte(venc);
        if (dias === null || dias <= 0) return null; // vencimento expirado/sem data
        var be = tipo === 'PUT' ? preco - spread : preco + spread;
        if (be <= 0.001) return null;
        var T = Math.max(diasUteisAte(venc) / 252, 0.0001);
        var sig = sigma > 0 ? sigma : 0.3;
        var d1 = (Math.log(spot / be) + (R + sig * sig / 2) * T) / (sig * Math.sqrt(T));
        var d2 = d1 - sig * Math.sqrt(T);
        var pop;
        if (tipo === 'CALL') pop = venda ? cdf(-d2) : cdf(d2);
        else pop = venda ? cdf(d2) : cdf(-d2);
        return Math.max(0, Math.min(1, pop)) * 100;
    }

    /* ------------------------------------------------------------------ */
    /* Dados                                                               */
    /* ------------------------------------------------------------------ */
    function buildList(ops) {
        var map = {};
        (ops || []).forEach(function (op) {
            // Ignora espelhos de fechamento parcial (premio zerado)
            if (op && num(op.op_fechamento) > 0) return;
            var ativo = normAtivo(op);
            if (!ativo || !isRecent(op)) return;
            if (!map[ativo] || ord(op) > ord(map[ativo])) map[ativo] = op;
        });
        return Object.keys(map).sort().map(function (ativo) {
            var op = map[ativo];
            var premio = Math.abs(num(op.premio || op.preco_entrada));
            return {
                ativo: ativo,
                tipo: tipoOf(op),
                venda: isVenda(op),
                strike: num(op.strike),
                premio: premio,
                preco: num(op.preco_entrada) || premio,
                venc: op.vencimento || '',
                qtd: Math.abs(parseInt(op.quantidade || 0, 10)) || 0,
                resultado: num(op.resultado),
                data: String(op.data_operacao || op.created_at || '').substring(0, 10),
                spot: 0
            };
        });
    }

    function fetchSpot(ativo) {
        var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : (window.API_BASE || '');
        return fetch(base + '/api/cotacao/realtime/' + ativo, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { return d ? num(d.price) : 0; })
            .catch(function () { return 0; });
    }

    /* ------------------------------------------------------------------ */
    /* Markup                                                              */
    /* ------------------------------------------------------------------ */
    function card(d) {
        var spot = d.spot;
        var dias = diasAte(d.venc);
        var expirada = dias !== null && dias < 0;
        var dist = (spot > 0 && d.strike > 0) ? ((spot - d.strike) / d.strike) * 100 : null;
        var itm = null;
        if (spot > 0 && d.strike > 0) {
            var diff = spot - d.strike;
            if (d.venda) itm = (d.tipo === 'CALL') ? diff >= 0 : diff <= 0;
            else itm = (d.tipo === 'CALL') ? diff <= 0 : diff >= 0;
        }
        var sigma = 0.3;
        var pop = expirada ? null : calcPoP(d.premio, d.strike, spot, sigma, d.venc, d.tipo, d.venda);
        var resCls = d.resultado >= 0 ? 'pos' : 'neg';

        var h = '<div class="cso-card ' + (d.tipo === 'PUT' ? 'put' : 'call') + '" data-ativo="' + esc(d.ativo) + '">';
        h += '<div class="cso-head"><span class="cso-ativo">' + esc(d.ativo) + '</span>' +
             '<span class="cso-tag ' + (d.tipo === 'PUT' ? 'put' : 'call') + '">' + d.tipo + '</span>' +
             '<span class="cso-tag">' + (d.venda ? 'VENDA' : 'COMPRA') + '</span>' +
             (expirada ? '<span class="cso-tag itm">VENCIDO</span>' :
                 (itm === null ? '' : '<span class="cso-tag ' + (itm ? 'itm' : 'otm') + '">' + (itm ? 'ITM' : 'OTM') + '</span>')) +
             '</div>';
        h += '<div class="cso-rows">';
        h += row('Cotação do ativo', spot > 0 ? brl(spot) : '—');
        h += row('Strike', d.strike > 0 ? brl(d.strike) : '—');
        h += row('Prêmio de entrada', d.premio > 0 ? brl(d.premio) : '—');
        h += row('Distância do strike', dist === null ? '—' : (dist >= 0 ? '+' : '') + pct(dist));
        h += row('PoP estimada', pop === null ? '—' : pop.toFixed(1) + '%');
        h += row('Vencimento', d.venc ? d.venc.substring(0, 10).split('-').reverse().join('/') + (dias === null ? '' : (dias < 0 ? ' (vencido)' : ' (' + dias + 'd)')) : '—');
        h += row('Última operação', d.data ? d.data.split('-').reverse().join('/') : '—');
        h += row('Resultado', d.resultado ? brl(d.resultado) : '—', resCls);
        h += '</div>';
        if (pop !== null) {
            h += '<div class="cso-pop"><i style="width:' + Math.max(2, Math.min(100, pop)) + '%"></i></div>';
        }
        h += '<div class="cso-actions">' +
             '<button type="button" class="cso-btn" data-cso-action="simular">Simular</button>' +
             '<button type="button" class="cso-btn ghost" data-cso-action="heatmap">Mapa de calor</button>' +
             '</div>';
        h += '</div>';
        return h;
    }

    function row(k, v, cls) {
        return '<div class="cso-row"><span class="cso-k">' + k + '</span><span class="cso-v ' + (cls || '') + '">' + v + '</span></div>';
    }

    function draw(host, list) {
        var out = host.querySelector('.cso-grid');
        if (!out) return;
        if (!list.length) {
            out.innerHTML = '<div class="cso-none">Nenhuma operação nos últimos 30 dias para sugerir.</div>';
            return;
        }
        out.innerHTML = list.map(card).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Ações                                                               */
    /* ------------------------------------------------------------------ */
    function abrirSimulacao(ativo) {
        var input = document.getElementById('simAtivoBase');
        if (input) input.value = ativo;
        if (typeof window.openSimularModal === 'function') {
            window.openSimularModal();
        }
        if (typeof window.buscarOpcoesSimulacaoHibrida === 'function') {
            setTimeout(function () { window.buscarOpcoesSimulacaoHibrida(); }, 350);
        }
    }

    function abrirMapaCalor(ativo) {
        var mod = window.ModalPrecoMedioOpcoes;
        if (mod && typeof mod.open === 'function') { mod.open(ativo); return; }
        mod = window.ModalPrecoMedioAtivoOpcoes;
        if (mod && typeof mod.openModal === 'function') mod.openModal(ativo);
    }

    function onClick(e) {
        var host = e.currentTarget;
        var btn = e.target.closest ? e.target.closest('button[data-cso-action]') : null;
        if (!btn || !host.contains(btn)) return;
        e.preventDefault();
        var box = btn.closest('[data-ativo]');
        var ativo = box ? box.getAttribute('data-ativo') : '';
        if (!ativo) return;
        if (btn.getAttribute('data-cso-action') === 'heatmap') abrirMapaCalor(ativo);
        else abrirSimulacao(ativo);
    }

    /* ------------------------------------------------------------------ */
    /* API pública                                                         */
    /* ------------------------------------------------------------------ */
    function mount(host, ops) {
        if (!host) return;
        injectCss();
        host.classList.add('cso-scope');
        if (!host._csoBound) {
            host._csoBound = true;
            host.addEventListener('click', onClick);
        }

        host.innerHTML =
            '<div class="cso-title">Sugestões para abrir posição</div>' +
            '<div class="cso-sub">Última operação (30 dias) de cada ativo base, com cotação, PoP e strike.</div>' +
            '<div class="cso-grid"></div>';

        var list = buildList(ops);
        if (!list.length) {
            draw(host, list);
            return;
        }

        draw(host, list);

        Promise.all(list.map(function (d) { return fetchSpot(d.ativo); })).then(function (spots) {
            list.forEach(function (d, i) { d.spot = spots[i] || 0; });
            draw(host, list);
        });
    }

    window.CelularSugestoesOpcoes = { mount: mount };
})();

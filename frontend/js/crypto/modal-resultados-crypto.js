/** modal-resultados-crypto.js v4.0.0
 *  Modal de Resultados Crypto — 5 abas (Desempenho, Comparativos,
 *  Posições, Evolução, Risco) com sidebar de 8 cards.
 *  Padrão IIFE + window.ModalResultadosCrypto = { configure, open }
 */
(function () {
    'use strict';

    // ── Configuração ──────────────────────────────────────────────────────────
    const cfg = {
        triggerBtnId:  'btnResultadosCryptoDetalhado',  // disparado pelo botão dentro do modal compacto
        containerElId: 'modalResultadosCryptoContainer',
        modalElId:     'modalResultadosCrypto',
        templatePath:  '../components/modals/crypto/modal-resultados-crypto.html',
        getOperacoes:  () => Array.isArray(window.cryptoOperacoes) ? window.cryptoOperacoes : []
    };

    // ── Estado ────────────────────────────────────────────────────────────────
    let filteredOps = [];
    let currentIdx  = 0;
    let activePeriod = 'all';
    let activeType   = 'aberta';  // 'aberta' | 'fechada' | null
    let activeTipo   = null;  // 'CALL' | 'PUT' | null
    let loaded       = false;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const setEl = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
    const setTx = (id, txt)  => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    const setCss = (id, prop, val) => { const e = document.getElementById(id); if (e) e.style[prop] = val; };
    const fmtUsd = v => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(+v||0);
    const fmtUsdShort = v => { const n = +v||0; const a = Math.abs(n); const p = n<0?'-':''; return a>=1e6? p+'$'+(a/1e6).toFixed(1)+'M' : a>=1e3? p+'$'+(a/1e3).toFixed(1)+'K' : fmtUsd(n); };
    const fmtPct = v => (Number.isFinite(+v) ? (+v).toFixed(2) : '0.00') + '%';
    const esc    = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const clamp  = (v, min, max) => Math.min(Math.max(v, min), max);

    function dateOf(str) {
        if (!str) return null;
        const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
        return isNaN(d) ? null : d;
    }
    function daysBetween(d1, d2) { return Math.round((d2 - d1) / 86400000); }

    const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

    // ── Arc gauge (r=38, circunferência=238.76) ───────────────────────────────
    const CIRC = 238.76;
    function setArc(id, pct) {
        const el = document.getElementById(id);
        if (!el) return;
        const ratio = clamp((pct || 0) / 100, 0, 1);
        el.style.strokeDashoffset = (CIRC * (1 - ratio)).toFixed(2);
    }

    // ── Filtro de período ─────────────────────────────────────────────────────
    function filterByPeriod(ops, period) {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const y = now.getFullYear(), m = now.getMonth();
        const after = days => { const d = new Date(now); d.setDate(d.getDate() - days); return d; };
        return ops.filter(op => {
            const raw = op.data_operacao || op.data_abertura || op.exercicio || '';
            const d = dateOf(raw);
            if (!d && period !== 'all') return false;
            switch (period) {
                case 'all':   return true;
                case 'today': return raw.slice(0,10) === todayStr;
                case '7d':    return d >= after(7);
                case '15d':   return d >= after(15);
                case '30d':   return d >= after(30);
                case '90d':   return d >= after(90);
                case '12m':   return d >= after(365);
                case 'mes':   return d.getFullYear() === y && d.getMonth() === m;
                case 'ano':   return d.getFullYear() === y;
                default:      return true;
            }
        });
    }

    function applyFilters() {
        let ops = cfg.getOperacoes();
        ops = filterByPeriod(ops, activePeriod);
        if (activeType)  ops = ops.filter(o => (o.status || 'ABERTA').toUpperCase() === activeType.toUpperCase());
        if (activeTipo)  ops = ops.filter(o => (o.tipo || '').toUpperCase() === activeTipo);
        filteredOps = ops;
        if (currentIdx >= filteredOps.length) currentIdx = Math.max(0, filteredOps.length - 1);
    }

    // ── Resumo ────────────────────────────────────────────────────────────────
    function renderSummary() {
        const ops     = filteredOps;
        const abertas = ops.filter(o => (o.status||'ABERTA').toUpperCase() === 'ABERTA');
        const fechadas= ops.filter(o => (o.status||'').toUpperCase() === 'FECHADA');
        const premio  = ops.reduce((s,o) => s + (parseFloat(o.premio_us)||0), 0);
        setTx('rcSumTotal',    ops.length);
        setTx('rcSumAbertas',  abertas.length);
        setTx('rcSumFechadas', fechadas.length);
        setTx('rcSumPremio',   fmtUsdShort(premio));
    }

    // ── Op Tabs Row ────────────────────────────────────────────────────────────
    function renderOpTabs() {
        const row = document.getElementById('rcOpTabsRow');
        if (!row) return;
        row.innerHTML = '';
        if (!filteredOps.length) return;

        filteredOps.forEach((op, idx) => {
            const tipo   = (op.tipo    || 'CALL').toUpperCase();
            const ativo  = (op.ativo   || '?').toUpperCase();
            const strike = parseFloat(op.strike || 0);
            const dataStr = (op.data_operacao || op.data_abertura || '').slice(0,10);
            const dataFmt = dataStr ? dataStr.split('-').reverse().slice(0,2).join('/') : '—';

            const btn = document.createElement('button');
            btn.className   = 'rmc-op-tab' + (idx === currentIdx ? ' active' : '');
            btn.dataset.idx = idx;
            btn.title       = `${ativo} · ${tipo} · Strike $${strike>0?strike.toFixed(0):'—'} · ${dataFmt}`;
            const col = tipo === 'CALL' ? '#00d4e8' : '#ff4d6a';
            btn.innerHTML =
                `<span style="color:${col};font-weight:700;font-size:0.6rem;">${tipo}</span>` +
                `<span style="font-size:0.65rem;">${esc(ativo)}</span>` +
                `<span style="font-size:0.5rem;color:#5a7090;">${dataFmt}</span>`;

            btn.addEventListener('click', () => {
                currentIdx = idx; render();
            });
            row.appendChild(btn);
        });

        const active = row.querySelector('.rmc-op-tab.active');
        if (active) active.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'nearest' });
    }

    // ── Render: Sidebar (8 cards) ─────────────────────────────────────────────
    function renderSidebar(op) {
        const cotacao   = parseFloat(op.cotacao_atual || 0);
        const abertura  = parseFloat(op.abertura || 0);
        const strike    = parseFloat(op.strike || 0);
        const premio    = parseFloat(op.premio_us || 0);
        const qtd       = parseFloat(op.quantidade || 1);
        const tae       = parseFloat(op.tae_pct || op.tae || 0);
        const resultado = parseFloat(op.resultado || 0);
        const saldo     = parseFloat(op.saldo_abertura || op.saldo_corretora || (abertura * qtd) || 0);
        const tipo      = (op.tipo || 'CALL').toUpperCase();

        // Cotação
        const cotVar = abertura > 0 ? (cotacao - abertura) / abertura * 100 : 0;
        const cotBarPct = abertura > 0 ? clamp(cotacao / abertura * 50, 0, 100) : 0;
        setTx('rcSbCotacao', cotacao > 0 ? fmtUsdShort(cotacao) : '—');
        setEl('rcSbCotacaoVar', `<span class="${cotVar>=0?'rmc-c-green':'rmc-c-red'}">${cotVar>=0?'+':''}${cotVar.toFixed(2)}%</span>`);
        setCss('rcSbCotacaoBar', 'width', cotBarPct + '%');

        // Resultado
        const resUs = parseFloat(op.resultado_us || (saldo * resultado / 100) || 0);
        setEl('rcSbResultado', `<span class="${resultado>=0?'rmc-c-green':'rmc-c-red'}">${resultado>=0?'+':''}${resultado.toFixed(2)}%</span>`);
        setEl('rcSbResultadoUsd', `<span class="${resUs>=0?'rmc-c-green':'rmc-c-red'}">${fmtUsd(resUs)}</span>`);

        // TAE
        const taeBarPct = clamp(tae / 50 * 100, 0, 100);
        setEl('rcSbTae', `<span class="${tae>=0?'rmc-c-green':'rmc-c-red'}">${fmtPct(tae)}</span>`);
        setCss('rcSbTaeBar', 'width', taeBarPct + '%');

        // Strike
        setTx('rcSbStrike', strike > 0 ? fmtUsdShort(strike) : '—');
        setEl('rcSbStrikeBadge', tipo === 'CALL'
            ? '<span class="rmc-badge-call">CALL</span>'
            : '<span class="rmc-badge-put">PUT</span>');

        // Distância
        let dist = 0;
        if (cotacao > 0 && strike > 0) {
            dist = tipo === 'PUT' ? (cotacao - strike)/cotacao*100 : (strike - cotacao)/cotacao*100;
        }
        const distBarPct = clamp(Math.abs(dist) * 5, 0, 100);
        const itm = tipo === 'CALL' ? cotacao >= strike : cotacao <= strike;
        setEl('rcSbDist', `<span class="${itm?'rmc-c-red':'rmc-c-gold'}">${dist.toFixed(2)}%</span>`);
        setCss('rcSbDistBar', 'width', distBarPct + '%');

        // Prêmio
        setTx('rcSbPremio', premio > 0 ? fmtUsd(premio) : '—');
        setTx('rcSbPremioSub', qtd + ' unid.');
        setCss('rcSbPremioBar', 'width', '100%');

        // PoP
        const popPct = calcPoP(dist, Math.abs(dist));
        setEl('rcSbPoP', `<span class="${popPct>=70?'rmc-c-green':popPct>=50?'rmc-c-gold':'rmc-c-red'}">${popPct.toFixed(1)}%</span>`);
        setCss('rcSbPoPBar', 'width', popPct + '%');

        // Investido
        setTx('rcSbInvestido', saldo > 0 ? fmtUsd(saldo) : '—');
        const qtdCrypto = parseFloat(op.quantidade_crypto || qtd || 0);
        setTx('rcSbInvestidoSub', qtdCrypto > 0 ? qtdCrypto.toFixed(4) + ' ' + (op.ativo||'').toUpperCase() : '—');
    }

    // ── Render: Desempenho ────────────────────────────────────────────────────
    function renderDesempenho(op) {
        const cotacao   = parseFloat(op.cotacao_atual || 0);
        const abertura  = parseFloat(op.abertura || 0);
        const strike    = parseFloat(op.strike || 0);
        const premio    = parseFloat(op.premio_us || 0);
        const qtd       = parseFloat(op.quantidade || 1);
        const tae       = parseFloat(op.tae_pct || op.tae || 0);
        const prazo     = parseInt(op.prazo_dias || op.dias_corridos || 0, 10) || 0;
        const tipo      = (op.tipo || 'CALL').toUpperCase();
        const resultado = parseFloat(op.resultado || 0);
        const saldo     = parseFloat(op.saldo_abertura || op.saldo_corretora || (abertura * qtd) || 0);
        const hoje      = new Date(); hoje.setHours(0,0,0,0);
        const dataAbStr = op.data_operacao || op.data_abertura || '';
        const dataAb    = dateOf(dataAbStr);
        const exDateStr = op.exercicio || op.vencimento || '';
        const exDate    = dateOf(exDateStr);
        const exDay     = exDate ? (d => { d.setHours(0,0,0,0); return d; })(new Date(exDate)) : null;
        const decorrido = dataAb ? daysBetween(dataAb, hoje) : 0;
        const restantes = exDay  ? daysBetween(hoje, exDay) : null;
        const totalDias = prazo  || (dataAb && exDate ? daysBetween(dataAb, exDate) : 0);
        const itm       = tipo === 'CALL' ? cotacao >= strike : cotacao <= strike;
        const resUs     = parseFloat(op.resultado_us || (saldo * resultado / 100) || 0);

        // Distância OTM
        let dist = 0;
        if (cotacao > 0 && strike > 0)
            dist = tipo === 'PUT' ? (cotacao - strike) / cotacao * 100 : (strike - cotacao) / cotacao * 100;

        // ── Resumo da Operação ────────────────────────────────
        setTx('rcResAtivo',    (op.ativo || '').toUpperCase() || '—');
        setEl('rcResTipoBadge', tipo === 'CALL' ? '<span class="rmc-badge-call">CALL</span>' : '<span class="rmc-badge-put">PUT</span>');
        setTx('rcResStrike',   strike  > 0 ? fmtUsd(strike)   : '—');
        setTx('rcResAbertura', abertura > 0 ? fmtUsd(abertura) : '—');
        setTx('rcResCotacao',  cotacao  > 0 ? fmtUsd(cotacao)  : '—');
        setTx('rcResPremio',   premio   > 0 ? fmtUsd(premio)   : '—');
        setTx('rcResQtd',      qtd.toString());
        setTx('rcResInvestido', saldo > 0 ? fmtUsd(saldo) : '—');
        setTx('rcResExDate',   exDateStr ? exDateStr.slice(0,10).split('-').reverse().join('/') : '—');
        setTx('rcResDiasRest', restantes !== null ? String(restantes) : '—');

        // ── Performance ───────────────────────────────────────
        const popPct = calcPoP(cotacao, strike, tipo);
        setArc('rcPerfPoPArc', popPct);
        setTx('rcPerfPoP',    popPct.toFixed(0) + '%');
        setEl('rcPerfResultado', `<span class="${resultado>=0?'rmc-c-green':'rmc-c-red'}">${resultado>=0?'+':''}${resultado.toFixed(2)}%</span>`);
        setEl('rcPerfLucroUsd',  `<span class="${resUs>=0?'rmc-c-green':'rmc-c-red'}">${fmtUsd(resUs)}</span>`);
        // Sparkline simulada
        const pts = 10;
        const scaleY = y => {
            const minY = Math.min(0, resultado);
            const maxY = Math.max(0.001, resultado);
            return 50 - ((y - minY) / (maxY - minY || 1)) * 40;
        };
        const pathD = 'M' + Array.from({length: pts}, (_, i) => {
            const t = i / (pts - 1);
            return (i * (200 / (pts - 1))).toFixed(1) + ',' + scaleY(resultado * t).toFixed(1);
        }).join(' L');
        const perfPath = document.getElementById('rcPerfPath');
        const perfFill = document.getElementById('rcPerfFill');
        if (perfPath) perfPath.setAttribute('d', pathD);
        if (perfFill) perfFill.setAttribute('d', pathD + ' L200,60 L0,60Z');

        // ── Gregos ────────────────────────────────────────────
        const delta = parseFloat(op.delta || (cotacao>0&&strike>0 ? (tipo==='CALL'?0.5:-0.5) : 0));
        const gamma = parseFloat(op.gamma || 0.02);
        const theta = parseFloat(op.theta || (totalDias>0 ? -(premio/totalDias) : -0.1));
        const vega  = parseFloat(op.vega  || 0.1);
        const iv    = parseFloat(op.iv    || op.volatilidade || 60);
        setTx('rcGreeksDelta', delta.toFixed(2));
        setTx('rcGreeksGamma', gamma.toFixed(3));
        setEl('rcGreeksTheta', `<span class="rmc-c-red">${theta.toFixed(2)}</span>`);
        setTx('rcGreeksVega',  vega.toFixed(2));
        setEl('rcGreeksIV',    `<span class="rmc-c-purple">${iv.toFixed(0)}%</span>`);

        // ── Probabilidades ────────────────────────────────────
        const probITM = clamp(50 - Math.abs(dist) * 2, 3, 97);
        const probOTM = 100 - probITM;
        setTx('rcProbPoP',   popPct.toFixed(0) + '%');
        setEl('rcProbITM',   `<span class="rmc-c-red">${probITM.toFixed(1)}%</span>`);
        setEl('rcProbOTM',   `<span class="rmc-c-green">${probOTM.toFixed(1)}%</span>`);
        setEl('rcProbDist',  `<span class="rmc-c-gold">${dist.toFixed(2)}%</span>`);

        // ── Risco/Retorno ──────────────────────────────────────
        const ganhoMax  = premio * qtd;
        const perdaMax  = saldo > ganhoMax ? saldo - ganhoMax : saldo;
        const rrRatio   = ganhoMax > 0 && perdaMax > 0 ? ganhoMax / perdaMax : 0;
        const breakEven = tipo === 'CALL' ? strike + premio : strike - premio;
        setEl('rcRRGanhoMax',  `<span class="rmc-c-gold">${fmtUsd(ganhoMax)}</span>`);
        setEl('rcRRPerdaMax',  `<span class="rmc-c-red">${fmtUsd(perdaMax)}</span>`);
        setTx('rcRRRatio',    rrRatio > 0 ? '1:' + (1/rrRatio).toFixed(1) : '—');
        setTx('rcRRBreakeven', strike > 0 ? fmtUsd(breakEven) : '—');

        // ── Decaimento Theta ──────────────────────────────────
        const thetaDay   = Math.abs(theta);
        const thetaTotal = thetaDay * (totalDias || 30);
        setEl('rcThetaDaily', `<span class="rmc-c-red">${fmtUsd(thetaDay)}</span>`);
        setEl('rcThetaTotal', `<span class="rmc-c-red">${fmtUsd(thetaTotal)}</span>`);

        // ── Cotação vs Strike ─────────────────────────────────
        const pctStrike = strike > 0 ? (cotacao / strike) * 100 : 0;
        setArc('rcVsArc', clamp(pctStrike / 1.5, 0, 100));
        setTx('rcVsPct',    pctStrike.toFixed(1) + '%');
        setTx('rcVsCot',    cotacao > 0 ? fmtUsd(cotacao) : '—');
        setTx('rcVsStrike', strike  > 0 ? fmtUsd(strike)  : '—');
        const diff = strike - cotacao;
        setEl('rcVsDiff', `<span class="${diff>0?'rmc-c-gold':'rmc-c-red'}">${fmtUsd(Math.abs(diff))} ${diff>0?'acima':'abaixo'}</span>`);
    }

    // ── Render: Comparativos ──────────────────────────────────────────────────
    function renderComparativos(op) {
        const cotacao  = parseFloat(op.cotacao_atual || 0);
        const abertura = parseFloat(op.abertura || 0);
        const strike   = parseFloat(op.strike || 0);
        const tipo     = (op.tipo || 'CALL').toUpperCase();
        const itm      = tipo === 'CALL' ? cotacao >= strike : cotacao <= strike;

        // Barra comparativa: posicionamento %
        if (abertura > 0 && strike > 0 && cotacao > 0) {
            const mn = Math.min(abertura, strike, cotacao) * 0.97;
            const mx = Math.max(abertura, strike, cotacao) * 1.03;
            const range = mx - mn;
            const pAb  = range > 0 ? clamp((abertura - mn)/range*100, 4, 96) : 4;
            const pSt  = range > 0 ? clamp((strike   - mn)/range*100, 4, 96) : 96;
            const pCot = range > 0 ? clamp((cotacao  - mn)/range*100, 4, 96) : 50;
            setCss('rcCbarAbertura', 'left', pAb  + '%');
            setCss('rcCbarStrike',   'left', pSt  + '%');
            setCss('rcCbarCotacao',  'left', pCot + '%');
        }
        setTx('rcCbAbert',  abertura > 0 ? fmtUsd(abertura) : '—');
        setTx('rcCbStrike', strike   > 0 ? fmtUsd(strike)   : '—');
        setTx('rcLegAb',    abertura > 0 ? fmtUsd(abertura) : '—');
        setTx('rcLegCot',   cotacao  > 0 ? fmtUsd(cotacao)  : '—');
        setTx('rcLegStrike',strike   > 0 ? fmtUsd(strike)   : '—');

        // Delta vs abertura
        const varAb  = abertura > 0 ? (cotacao - abertura) / abertura * 100 : 0;
        const deltaAb = cotacao - abertura;
        setTx('rcDAbVal',    abertura > 0 ? fmtUsd(abertura) : '—');
        setEl('rcDCotVal',   `<span class="${cotacao>=abertura?'rmc-c-green':'rmc-c-red'}">${fmtUsd(cotacao)}</span>`);
        setEl('rcDCotPct',   `<span class="${varAb>=0?'rmc-c-green':'rmc-c-red'}">${varAb>=0?'+':''}${varAb.toFixed(2)}%</span>`);
        setEl('rcDDeltaVal', `<span class="${deltaAb>=0?'rmc-c-green':'rmc-c-red'}">${deltaAb>=0?'+':''}${fmtUsd(deltaAb)}</span>`);
        const pbVsAb = abertura > 0 ? clamp((cotacao/abertura)*50, 0, 100) : 0;
        setCss('rcPbVsAb', 'width', pbVsAb + '%');
        setTx('rcPbAbLabel',  abertura > 0 ? fmtUsd(abertura) : '—');
        setTx('rcPbCotLabel', cotacao  > 0 ? fmtUsd(cotacao)  : '—');

        // Delta vs strike
        const distStrike = strike > 0 ? (strike - cotacao) / strike * 100 : 0;
        setEl('rcD2Cot',     `<span class="rmc-c-green">${fmtUsd(cotacao)}</span>`);
        setEl('rcD2Strike',  `<span class="rmc-c-gold">${fmtUsd(strike)}</span>`);
        setEl('rcD2Badge',   tipo === 'CALL' ? '<span class="rmc-badge-call">CALL</span>' : '<span class="rmc-badge-put">PUT</span>');
        setEl('rcD2Dist',    `<span class="${itm?'rmc-c-red':'rmc-c-gold'}">${Math.abs(strike-cotacao)>0?fmtUsd(Math.abs(strike-cotacao)):'—'}</span>`);
        setEl('rcD2DistPct', `<span class="${itm?'rmc-c-red':'rmc-c-gold'}">${distStrike.toFixed(2)}%</span>`);
        const pbVsSt = strike > 0 ? clamp(cotacao/strike*100, 0, 100) : 0;
        setCss('rcPbVsStrike', 'width', pbVsSt + '%');
        setTx('rcPbCotLbl',   cotacao > 0 ? fmtUsd(cotacao) : '—');
        setTx('rcPbStrikeLbl',strike  > 0 ? fmtUsd(strike)  : '—');

        // Gauge: % cot/strike
        const pctCS = strike > 0 ? clamp(cotacao/strike*100, 0, 150) : 0;
        setArc('rcArcCotStrike', clamp(pctCS/1.5, 0, 100));
        setEl('rcGcPctStrike', `<span class="${itm?'rmc-c-red':'rmc-c-green'}">${pctCS.toFixed(1)}%</span>`);
        setTx('rcGcCot1',   fmtUsd(cotacao));
        setTx('rcGcStrike1',fmtUsd(strike));
        setEl('rcGcFalta',  `<span class="rmc-c-gold">${strike > cotacao ? fmtUsd(strike-cotacao) : '—'}</span>`);

        // Gauge: cot vs abertura multiplier
        const mult = abertura > 0 ? cotacao / abertura : 1;
        setArc('rcArcCotAb', clamp((mult-1)*100, 0, 100));
        setEl('rcGcPctAb', `<span class="${mult>=1?'rmc-c-cyan':'rmc-c-red'}">${mult.toFixed(2)}x</span>`);
        setTx('rcGcAb2',   fmtUsd(abertura));
        setTx('rcGcCot2',  fmtUsd(cotacao));
        setEl('rcGcMult',  `<span class="${mult>=1?'rmc-c-green':'rmc-c-red'}">${mult.toFixed(3)}x</span>`);

        // Gauge: distância ao strike
        let dist = 0;
        if (cotacao > 0 && strike > 0)
            dist = tipo === 'PUT' ? (cotacao-strike)/cotacao*100 : (strike-cotacao)/cotacao*100;
        setArc('rcArcDist2', clamp(Math.abs(dist)*5, 0, 100));
        setEl('rcGcDistPct', `<span class="${itm?'rmc-c-red':'rmc-c-gold'}">${dist.toFixed(2)}%</span>`);
        setEl('rcGcDistUsd', `<span class="rmc-c-gold">${fmtUsd(Math.abs(strike-cotacao))}</span>`);
        setEl('rcGcDistStatus', itm ? '<span class="rmc-c-red">ITM</span>' : '<span class="rmc-c-gold">OTM</span>');
        setTx('rcGcDistTipo', tipo);
    }

    // ── Render: Posições Abertas ──────────────────────────────────────────────
    function renderPosicoes() {
        const rows = document.getElementById('rcPosRows');
        if (!rows) return;
        const ops = filteredOps;
        if (!ops.length) { rows.innerHTML = '<div style="text-align:center;color:#5a7090;padding:1rem;font-size:0.65rem;">Nenhuma posição</div>'; return; }

        rows.innerHTML = ops.map((op, idx) => {
            const tipo    = (op.tipo || 'CALL').toUpperCase();
            const ativo   = (op.ativo || '?').toUpperCase();
            const cotacao = parseFloat(op.cotacao_atual || 0);
            const abertura= parseFloat(op.abertura || 0);
            const strike  = parseFloat(op.strike || 0);
            const tae     = parseFloat(op.tae_pct || op.tae || 0);
            const res     = parseFloat(op.resultado || 0);
            const isActive= idx === currentIdx;
            const typeBadge = tipo === 'CALL' ? '<span class="rmc-badge-call">CALL</span>' : '<span class="rmc-badge-put">PUT</span>';
            return `<div class="rmc-pos-row${isActive?' active':''} rmc-pos-row-selectable" data-idx="${idx}" style="cursor:pointer;">
                <span style="font-weight:700;">${esc(ativo)}</span>
                <span>${typeBadge}</span>
                <span class="rmc-c-cyan">${abertura>0?fmtUsd(abertura):'—'}</span>
                <span class="rmc-c-gold">${strike>0?fmtUsd(strike):'—'}</span>
                <span class="${tae>=0?'rmc-c-green':'rmc-c-red'}">${fmtPct(tae)}</span>
                <span class="${res>=0?'rmc-c-green':'rmc-c-red'}">${res>=0?'+':''}${res.toFixed(2)}%</span>
            </div>`;
        }).join('');

        // PoP cards para primeiras 2 operações abertas
        const abertas = ops.filter(o => (o.status||'ABERTA').toUpperCase() === 'ABERTA').slice(0,2);
        const poPCards = document.getElementById('rcPoPCards');
        if (poPCards) {
            if (abertas.length) {
                poPCards.innerHTML = abertas.map(op => {
                    const cot   = parseFloat(op.cotacao_atual || 0);
                    const stk   = parseFloat(op.strike || 0);
                    const tipo_ = (op.tipo || 'CALL').toUpperCase();
                    let dist_ = 0;
                    if (cot > 0 && stk > 0)
                        dist_ = tipo_ === 'PUT' ? (cot-stk)/cot*100 : (stk-cot)/cot*100;
                    const pop_ = calcPoP(dist_, Math.abs(dist_));
                    return buildPoPCard(op, pop_);
                }).join('');
            } else {
                poPCards.innerHTML = '';
            }
        }
    }

    function calcPoP(distPct, absDist) {
        // Estimativa simplificada: quanto maior OTM, maior PoP
        const base = 50;
        const bonus= absDist > 0 ? Math.min(absDist * 2, 45) : 0;
        return clamp(base + bonus, 5, 97);
    }

    function buildPoPCard(op, pop) {
        const ativo = (op.ativo || '?').toUpperCase();
        const popClass = pop >= 70 ? 'high' : pop >= 50 ? 'mid' : 'low';
        const popLabel = pop >= 70 ? 'ALTA PROBABILIDADE' : pop >= 50 ? 'PROBABILIDADE MÉDIA' : 'BAIXA PROBABILIDADE';
        // semicircle arc circumference ≈ 141.37
        const arcCirc = 141.37;
        const offset  = arcCirc * (1 - pop/100);
        const needleDeg = pop * 1.8 - 90;
        const cot = parseFloat(op.cotacao_atual || 0);
        const stk = parseFloat(op.strike || 0);
        const tipo_ = (op.tipo || 'CALL').toUpperCase();
        let dist_ = 0;
        if (cot > 0 && stk > 0)
            dist_ = tipo_ === 'PUT' ? (cot-stk)/cot*100 : (stk-cot)/cot*100;

        return `<div class="rmc-pop-card">
            <div class="rmc-card-label"><span class="rmc-card-label-dot" style="background:#00e87a"></span>PoP — ${esc(ativo)}</div>
            <div class="rmc-pop-gauge-wrap">
                <svg viewBox="0 0 110 60">
                    <path d="M 10,55 A 45,45 0 0,1 100,55" fill="none" stroke="#1a2540" stroke-width="7" stroke-linecap="round"/>
                    <path d="M 10,55 A 45,45 0 0,1 100,55" fill="none" stroke="${pop>=70?'#00e87a':pop>=50?'#f5a623':'#ff4d6a'}"
                        stroke-width="7" stroke-linecap="round"
                        stroke-dasharray="${arcCirc}" stroke-dashoffset="${offset.toFixed(2)}"
                        style="transition:stroke-dashoffset 0.8s ease"/>
                </svg>
                <div class="rmc-pop-needle" style="transform:rotate(${needleDeg}deg)"></div>
            </div>
            <div class="rmc-pop-val-big ${pop>=70?'rmc-c-green':pop>=50?'rmc-c-gold':'rmc-c-red'}">${pop.toFixed(1)}%</div>
            <div class="rmc-pop-status ${popClass}">${popLabel}</div>
            <div class="rmc-pop-breakdown">
                <div class="rmc-pop-item"><span class="rmc-pop-item-lbl">Distância OTM</span><span class="rmc-pop-item-val rmc-c-gold">${dist_.toFixed(2)}%</span></div>
                <div class="rmc-pop-item"><span class="rmc-pop-item-lbl">Cotação</span><span class="rmc-pop-item-val rmc-c-cyan">${cot>0?fmtUsd(cot):'—'}</span></div>
                <div class="rmc-pop-item"><span class="rmc-pop-item-lbl">Strike</span><span class="rmc-pop-item-val rmc-c-gold">${stk>0?fmtUsd(stk):'—'}</span></div>
                <div class="rmc-pop-item"><span class="rmc-pop-item-lbl">Tipo</span><span class="rmc-pop-item-val">${esc(tipo_)}</span></div>
            </div>
        </div>`;
    }

    // ── Render: Evolução ──────────────────────────────────────────────────────
    function renderEvolucao(op) {
        const cotacao   = parseFloat(op.cotacao_atual || 0);
        const abertura  = parseFloat(op.abertura || 0);
        const premio    = parseFloat(op.premio_us || 0);
        const resultado = parseFloat(op.resultado || 0);
        const prazo     = parseInt(op.prazo_dias || 30, 10);
        const now       = new Date();
        const dataAbStr = op.data_operacao || op.data_abertura || '';
        const dataAb    = dateOf(dataAbStr);
        const exDateStr = op.exercicio || op.vencimento || '';

        // Evolução resultado (curva simples de 0 até resultado%)
        // Gera pontos lineares simulados para visualização
        const pts = 12;
        const evoPoints = Array.from({length: pts}, (_, i) => {
            const t = i / (pts - 1);
            // curva ligeiramente côncava para cima (theta decay beneficia o escritor)
            const y = resultado * Math.pow(t, 0.7);
            return { t, y };
        });
        const margin = 10;
        const w = 600, h = 120;
        const minY = Math.min(0, ...evoPoints.map(p=>p.y));
        const maxY = Math.max(0.001, ...evoPoints.map(p=>p.y));
        const scaleX = x => margin + x * (w - 2*margin);
        const scaleY = y => h - margin - ((y - minY) / (maxY - minY || 1)) * (h - 2*margin);
        const toSvgPts = pts => pts.map(p=>`${scaleX(p.t).toFixed(1)},${scaleY(p.y).toFixed(1)}`).join(' ');

        const linePts  = toSvgPts(evoPoints);
        const pathD    = `M${linePts.split(' ').map((p,i)=>(i===0?'':' L')+p).join('')}`;
        const fillD    = pathD + ` L${scaleX(1)},${h} L${scaleX(0)},${h}Z`;

        const evoPath = document.getElementById('rcEvoPath');
        const evoFill = document.getElementById('rcEvoFill');
        if (evoPath) evoPath.setAttribute('d', pathD);
        if (evoFill) evoFill.setAttribute('d', fillD);
        setEl('rcEvoLabel', `<span class="${resultado>=0?'rmc-c-green':'rmc-c-red'}">${resultado>=0?'+':''}${resultado.toFixed(2)}%</span>`);
        setTx('rcEvoDateStart', dataAbStr ? dataAbStr.slice(0,10).split('-').reverse().join('/') : 'Início');
        setTx('rcEvoDateEnd',   exDateStr ? exDateStr.slice(0,10).split('-').reverse().join('/') : 'Venc.');

        // Mini chart: cotação — mostra como % de abertura
        setTx('rcEvoMin', abertura > 0 ? fmtUsd(abertura * 0.9) : '—');
        setTx('rcEvoMax', cotacao  > 0 ? fmtUsd(cotacao)        : '—');

        // Theta decay mini chart (linear)
        setTx('rcThetaInicio', premio > 0 ? fmtUsd(premio) : '—');
        const thetaDiario = prazo > 0 && premio > 0 ? premio / prazo : 0;
        const dataAbDays  = dataAb ? daysBetween(dataAb, now) : 0;
        const premioAtual = Math.max(premio - thetaDiario * dataAbDays, 0);
        setEl('rcThetaAtual', `<span class="rmc-c-gold">${fmtUsd(premioAtual)}</span>`);

        // PoP hist
        const dist0 = op._distInicio ? parseFloat(op._distInicio) : 5;
        const cotacao_  = cotacao, stk = parseFloat(op.strike||0), tipo_ = (op.tipo||'CALL').toUpperCase();
        let distAtual = 0;
        if (cotacao_ > 0 && stk > 0)
            distAtual = tipo_ === 'PUT' ? (cotacao_-stk)/cotacao_*100 : (stk-cotacao_)/cotacao_*100;
        const popInicio = calcPoP(dist0, Math.abs(dist0));
        const popAtual  = calcPoP(distAtual, Math.abs(distAtual));
        setEl('rcPoPHistInicio', `<span class="${popInicio>=70?'rmc-c-green':'rmc-c-gold'}">${popInicio.toFixed(1)}%</span>`);
        setEl('rcPoPHistAtual',  `<span class="${popAtual>=70?'rmc-c-green':'rmc-c-gold'}">${popAtual.toFixed(1)}%</span>`);
    }

    // ── Render: Risco ─────────────────────────────────────────────────────────
    function renderRisco(op) {
        const cotacao  = parseFloat(op.cotacao_atual || 0);
        const abertura = parseFloat(op.abertura || 0);
        const strike   = parseFloat(op.strike || 0);
        const premio   = parseFloat(op.premio_us || 0);
        const qtd      = parseFloat(op.quantidade || 1);
        const saldo    = parseFloat(op.saldo_abertura || op.saldo_corretora || (abertura * qtd) || 0);
        const tipo     = (op.tipo || 'CALL').toUpperCase();
        const itm      = tipo === 'CALL' ? cotacao >= strike : cotacao <= strike;

        let dist = 0;
        if (cotacao > 0 && strike > 0)
            dist = tipo === 'PUT' ? (cotacao-strike)/cotacao*100 : (strike-cotacao)/cotacao*100;

        const probITM    = clamp(50 - Math.abs(dist) * 2, 3, 97);
        const probLucro  = 100 - probITM;
        const perdaMax   = saldo > 0 ? saldo - premio : 0;
        const ganhoMax   = premio;
        const rr         = ganhoMax > 0 && perdaMax > 0 ? ganhoMax / perdaMax : 0;
        const iv         = parseFloat(op.iv || op.volatilidade || 60);
        const delta      = parseFloat(op.delta || clamp(itm ? 65 : 35, 5, 95));
        const theta      = premio > 0 ? premier => (op.prazo_dias > 0 ? -premio / op.prazo_dias : -0.5) : () => -0.5;
        const thetaVal   = op.prazo_dias > 0 ? -(premio / op.prazo_dias) : -0.5;
        const breakeven  = tipo === 'CALL' ? strike + premio : strike - premio;

        // Risk arc (ITM probability)
        const riscoArcPct = clamp(probITM, 0, 100);
        setArc('rcArcRisco', riscoArcPct);
        setEl('rcRiscoGPct',     `<span class="${probITM>=50?'rmc-c-red':'rmc-c-gold'}">${probITM.toFixed(0)}%</span>`);
        setEl('rcRiscoProbEx',   `<span class="${probITM>=50?'rmc-c-red':'rmc-c-gold'}">${probITM.toFixed(1)}%</span>`);
        setEl('rcRiscoProbLucro',`<span class="${probLucro>=70?'rmc-c-green':'rmc-c-gold'}">${probLucro.toFixed(1)}%</span>`);
        setEl('rcRiscoPerdaMax', `<span class="rmc-c-red">${fmtUsd(perdaMax)}</span>`);
        setEl('rcRiscoGanhoMax', `<span class="rmc-c-gold">${fmtUsd(ganhoMax)}</span>`);
        setEl('rcRiscoRR',       `<span class="rmc-c-gold">1:${(1/rr||0).toFixed(1)}</span>`);
        setEl('rcRiscoDist',     `<span class="rmc-c-green">${dist.toFixed(2)}%</span>`);

        // Cenários
        setTx('rcCenarioOTM', `Cotação ${fmtUsd(cotacao)} < Strike ${fmtUsd(strike)} → prêmio ${fmtUsd(ganhoMax)} retido`);
        setTx('rcCenarioITM', `Cotação ${fmtUsd(cotacao)} > Strike ${fmtUsd(strike)} → exercício, perda potencial ${fmtUsd(perdaMax)}`);
        setTx('rcCenarioEq',  `Break-even: ${fmtUsd(breakeven)} (strike ${fmtUsd(strike)} ${tipo==='CALL'?'+':'-'} prêmio ${fmtUsd(premio)})`);

        // IV gauge
        const ivPct = clamp(iv / 150 * 100, 0, 100);
        setArc('rcArcIV', ivPct);
        setEl('rcRiscoIV',     `<span class="rmc-c-purple">${iv.toFixed(0)}%</span>`);
        setEl('rcRiscoIVRank', `<span class="rmc-c-purple">${iv>80?'ALTO':iv>40?'MÉDIO':'BAIXO'}</span>`);

        // Delta gauge
        const deltaPct = clamp(Math.abs(delta), 0, 100);
        setArc('rcArcDelta', deltaPct);
        setEl('rcRiscoDelta',    `<span class="rmc-c-blue">${delta.toFixed(0)}</span>`);
        setEl('rcRiscoDeltaSens',`<span class="rmc-c-blue">${delta>70?'ALTA':delta>30?'MÉDIA':'BAIXA'}</span>`);

        // Theta gauge
        const thetaAbs = Math.abs(thetaVal);
        const thetaPct = clamp(thetaAbs / 50 * 100, 0, 100);
        setArc('rcArcTheta', thetaPct);
        setEl('rcRiscoTheta',      `<span class="rmc-c-red">${thetaVal.toFixed(2)}</span>`);
        setEl('rcRiscoThetaTotal', `<span class="rmc-c-red">${fmtUsd(thetaAbs * (op.prazo_dias||30))}</span>`);

        // Alerta de risco
        const warnEl = document.getElementById('rcRiscoWarn');
        if (warnEl) warnEl.style.display = probITM > 40 ? 'inline' : 'none';
    }

    // ── Render central ────────────────────────────────────────────────────────
    function render() {
        applyFilters();
        renderSummary();
        renderOpTabs();

        const empty  = document.getElementById('rcEmptyState');
        const body   = document.getElementById('rcDashBody');
        const secTab = document.getElementById('rcSectionTabs');
        const sidebar= document.getElementById('rcSidebar');

        if (!filteredOps.length) {
            if (empty)  empty.classList.remove('d-none');
            if (body)   body.classList.add('d-none');
            if (secTab) secTab.style.display = 'none';
            return;
        }

        if (empty)  empty.classList.add('d-none');
        if (body)   body.classList.remove('d-none');
        if (secTab) secTab.style.display = '';

        const op = filteredOps[currentIdx];
        renderSidebar(op);
        renderDesempenho(op);
        renderComparativos(op);
        renderPosicoes();
        renderRisco(op);
            setupRowSelectListeners();
    }

    // ── Listeners ─────────────────────────────────────────────────────────────
    function setupRowSelectListeners() {
        document.querySelectorAll('.rmc-pos-row-selectable').forEach((row) => {
            if (row.dataset.listenerBound) return;

            row.addEventListener('click', function (e) {
                e.preventDefault();
                const idx = this.getAttribute('data-idx');
                if (idx === null || idx === undefined) return;

                currentIdx = parseInt(idx, 10);
                document.querySelectorAll('.rmc-pos-row').forEach(r => r.classList.remove('active'));
                this.classList.add('active');
                render();
            });

            row.dataset.listenerBound = 'true';
        });
    }

    function setupFilterListeners() {
        const modal = document.getElementById(cfg.modalElId);
        if (!modal) return;
        if (modal.dataset.listenersBound === 'true') return;
        modal.dataset.listenersBound = 'true';

        // Período pills
        modal.querySelectorAll('.rmc-pill[data-period]').forEach(btn => {
            btn.addEventListener('click', function () {
                modal.querySelectorAll('.rmc-pill[data-period]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                activePeriod = this.dataset.period || 'all';
                currentIdx = 0;
                render();
            });
        });

        // Status pills
        modal.querySelectorAll('.rmc-pill[data-type]').forEach(btn => {
            btn.addEventListener('click', function () {
                const t = this.dataset.type;
                if (activeType === t) {
                    activeType = null;
                    this.classList.remove('active');
                } else {
                    modal.querySelectorAll('.rmc-pill[data-type]').forEach(b => b.classList.remove('active'));
                    activeType = t;
                    this.classList.add('active');
                }
                currentIdx = 0;
                render();
            });
        });

        // Tipo pills (CALL/PUT)
        modal.querySelectorAll('.rmc-pill[data-tipo]').forEach(btn => {
            btn.addEventListener('click', function () {
                const t = this.dataset.tipo;
                if (activeTipo === t) {
                    activeTipo = null;
                    this.classList.remove('active');
                } else {
                    modal.querySelectorAll('.rmc-pill[data-tipo]').forEach(b => b.classList.remove('active'));
                    activeTipo = t;
                    this.classList.add('active');
                }
                currentIdx = 0;
                render();
            });
        });

        // Section tabs
        modal.querySelectorAll('.rmc-section-tab').forEach(btn => {
            btn.addEventListener('click', function () {
                const sec = this.dataset.sec;
                modal.querySelectorAll('.rmc-section-tab').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                modal.querySelectorAll('.rmc-tab-panel').forEach(p => p.classList.remove('active'));
                const panel = document.getElementById('rcSec' + sec.charAt(0).toUpperCase() + sec.slice(1));
                if (panel) panel.classList.add('active');
            });
        });

        // Refresh
        document.getElementById('rcRefreshBtn')?.addEventListener('click', function () {
            this.classList.add('spinning');
            setTimeout(() => this.classList.remove('spinning'), 800);
            currentIdx = 0;
            render();
            updateTimestamp('rcLastUpdate');
        });
    }

    function updateTimestamp(id) {
        const now = new Date();
        const el = document.getElementById(id);
        if (el) el.textContent = `Atualizado: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // ── Template loading ──────────────────────────────────────────────────────
    async function ensureTemplate() {
        if (loaded) return true;
        const container = document.getElementById(cfg.containerElId);
        if (!container) {
            console.error('[ModalResultadosCrypto] Container #' + cfg.containerElId + ' não encontrado.');
            return false;
        }
        try {
            const res = await fetch(cfg.templatePath, { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            container.innerHTML = await res.text();
            loaded = true;
            setupFilterListeners();
            return true;
        } catch (e) {
            console.error('[ModalResultadosCrypto] Erro ao carregar template:', e);
            return false;
        }
    }

    async function openModal() {
        const ok = await ensureTemplate();
        if (!ok) return;
        // Reset state on open
        activePeriod = 'all';
        activeType   = 'aberta';
        activeTipo   = null;
        currentIdx   = 0;
        // Sync filter UI
        document.querySelectorAll('#modalResultadosCrypto .rmc-pill[data-period]').forEach(b => {
            b.classList.toggle('active', b.dataset.period === 'all');
        });
        document.querySelectorAll('#modalResultadosCrypto .rmc-pill[data-type]').forEach(b => b.classList.remove('active'));
        document.querySelector('#modalResultadosCrypto .rmc-pill[data-type="aberta"]')?.classList.add('active');
        document.querySelectorAll('#modalResultadosCrypto .rmc-pill[data-tipo]').forEach(b => b.classList.remove('active'));
        // Show first section tab
        document.querySelectorAll('#modalResultadosCrypto .rmc-section-tab').forEach((b, i) => b.classList.toggle('active', i===0));
        document.querySelectorAll('#modalResultadosCrypto .rmc-tab-panel').forEach((p, i) => p.classList.toggle('active', i===0));
        render();
        updateTimestamp('rcLastUpdate');
        const modalEl = document.getElementById(cfg.modalElId);
        if (!modalEl) return;
        let bsModal = bootstrap.Modal.getInstance(modalEl);
        if (!bsModal) bsModal = new bootstrap.Modal(modalEl, { keyboard: true });
        bsModal.show();
    }

    // ── Setup triggers ────────────────────────────────────────────────────────
    function setupTriggers() {
        const btn = document.getElementById(cfg.triggerBtnId);
        if (btn && !btn._rcResHandled) {
            btn.addEventListener('click', openModal);
            btn._rcResHandled = true;
        }
    }

    document.addEventListener('layoutReady', setupTriggers);
    document.addEventListener('DOMContentLoaded', setupTriggers);

    // ── API pública ───────────────────────────────────────────────────────────
    function configure(opts) { Object.assign(cfg, opts); setupTriggers(); }

    window.ModalResultadosCrypto = { configure, open: openModal };
})();

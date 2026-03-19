/** modal-resultados-opcoes.js v3.0.0
 *  Modal de Resultados para página Opções — layout 5 abas idêntico ao Crypto.
 *  Lê window.allOperacoes (carregado pelo opcoes.js).
 *  Padrão IIFE + window.ModalResultadosOpcoes = { configure, open }
 */
(function () {
    'use strict';

    // ── Configuração ──────────────────────────────────────────────────────────
    const cfg = {
        triggerBtnId:  'btnResultadosOpcoes',
        containerElId: 'modalResultadosOpcoesContainer',
        modalElId:     'modalResultadosOpcoes',
        templatePath:  '../components/modals/opcoes/modal-resultados-opcoes.html',
        getOperacoes:  () => Array.isArray(window.allOperacoes) ? window.allOperacoes : []
    };

    // ── Estado ────────────────────────────────────────────────────────────────
    let filteredOps   = [];
    let currentIdx    = 0;
    let activePeriod  = 'all';
    let activeType    = 'aberta';
    let activeTipo    = null;
    let activeSection = 'desempenho';
    let loaded        = false;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const el     = id => document.getElementById(id);
    const setEl  = (id, html) => { const e = el(id); if (e) e.innerHTML = html; };
    const setTx  = (id, txt)  => { const e = el(id); if (e) e.textContent = txt; };
    const fmtBrl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(+v || 0);
    const fmtPct = v => (Number.isFinite(+v) ? ((+v >= 0 ? '+' : '') + (+v).toFixed(2)) : '0.00') + '%';
    const esc    = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const clr    = v => v >= 0 ? 'rmc-c-green' : 'rmc-c-red';

    // r=38 -> circumference = 238.76
    const CIRC38 = 238.76;
    function setArc(arcId, pct, color) {
        const arc = el(arcId);
        if (!arc) return;
        const v = Math.min(Math.max(pct || 0, 0), 100);
        arc.style.strokeDashoffset = (CIRC38 * (1 - v / 100)).toFixed(2);
        if (color) arc.style.stroke = color;
    }
    function calcPoP(cotacao, strike, tipo) {
        if (!cotacao || !strike) return 50;
        const dist = tipo === 'PUT' ? (cotacao - strike) / cotacao * 100 : (strike - cotacao) / cotacao * 100;
        return Math.min(Math.max(50 + dist * 1.5, 5), 95);
    }

    function dateOf(str) {
        if (!str) return null;
        const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
        return isNaN(d) ? null : d;
    }
    function daysBetween(d1, d2) { return Math.round((d2 - d1) / 86400000); }

    // ── Filtro de período ─────────────────────────────────────────────────────
    function filterByPeriod(ops, period) {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const y = now.getFullYear();
        const m = now.getMonth();

        const after = days => {
            const d = new Date(now);
            d.setDate(d.getDate() - days);
            return d;
        };

        return ops.filter(op => {
            const raw = op.data_operacao || op.data_abertura || op.exercicio || '';
            const d = dateOf(raw);
            if (!d && period !== 'all') return false;
            switch (period) {
                case 'all':     return true;
                case 'today':   return raw.slice(0,10) === todayStr;
                case '7d':      return d >= after(7);
                case '15d':     return d >= after(15);
                case '30d':     return d >= after(30);
                case '90d':     return d >= after(90);
                case '12m':     return d >= after(365);
                case 'mes':     return d.getFullYear() === y && d.getMonth() === m;
                case 'ano':     return d.getFullYear() === y;
                case 'ano-ant': return d.getFullYear() === y - 1;
                default:        return true;
            }
        });
    }

    function applyFilters() {
        let ops = cfg.getOperacoes();
        ops = filterByPeriod(ops, activePeriod);
        if (activeType) {
            ops = ops.filter(o => (o.status || 'ABERTA').toUpperCase() === activeType.toUpperCase());
        }
        if (activeTipo) {
            ops = ops.filter(o => (o.tipo || '').toUpperCase() === activeTipo);
        }
        filteredOps = ops;
        if (currentIdx >= filteredOps.length) currentIdx = Math.max(0, filteredOps.length - 1);
    }

    // ── Resumo (pills) ────────────────────────────────────────────────────────
    function renderSummary() {
        const ops      = filteredOps;
        const abertas  = ops.filter(o => (o.status || 'ABERTA').toUpperCase() === 'ABERTA');
        const fechadas = ops.filter(o => (o.status || '').toUpperCase() === 'FECHADA');
        const premioTotal = ops.reduce((s, o) => s + (parseFloat(o.premio) || 0) * (parseFloat(o.quantidade) || 1), 0);
        setTx('roSumTotal',    ops.length);
        setTx('roSumAbertas',  abertas.length);
        setTx('roSumFechadas', fechadas.length);
        setTx('roSumPremio',   fmtBrl(premioTotal));
    }

    // ── Sidebar ───────────────────────────────────────────────────────────────
    function renderSidebar(op) {
        if (!op) return;
        const cotacao   = parseFloat(op.cotacao_atual || op.preco_atual || 0);
        const cotAb     = parseFloat(op.abertura_cotacao || op.cotacao_abertura || 0);
        const strike    = parseFloat(op.strike || 0);
        const premio    = parseFloat(op.premio || 0);
        const qtd       = parseFloat(op.quantidade || 1);
        const tipo      = (op.tipo || 'CALL').toUpperCase();
        const saldo     = parseFloat(op.saldo_base || op.abertura || 0);
        const resultado = parseFloat(op.resultado || 0);
        const cotVar    = cotAb > 0 ? (cotacao - cotAb) / cotAb * 100 : 0;
        const pop       = calcPoP(cotacao, strike, tipo);
        const tae       = parseFloat(op.tae || op.tae_pct || 0);
        const itm       = tipo === 'CALL' ? cotacao >= strike : cotacao <= strike;
        const distPct   = cotacao > 0 && strike > 0
            ? (tipo === 'PUT' ? (cotacao - strike) / cotacao * 100 : (strike - cotacao) / cotacao * 100)
            : 0;

        setTx('roSbCotacao',    cotacao > 0 ? fmtBrl(cotacao) : '—');
        setEl('roSbCotacaoVar', cotAb > 0 ? `<span class="${clr(cotVar)}">${cotVar >= 0?'+':''}${cotVar.toFixed(2)}%</span>` : '—');
        const cotBar = el('roSbCotacaoBar');
        if (cotBar) { const p = cotAb > 0 ? Math.min((cotacao/cotAb)*50, 100) : 50; setTimeout(() => cotBar.style.width = p + '%', 100); }
        const resBrl = saldo > 0 ? saldo * resultado / 100 : 0;
        setEl('roSbResultado',    `<span class="${clr(resultado)}">${fmtPct(resultado)}</span>`);
        setEl('roSbResultadoBrl', `<span class="${clr(resBrl)}">${fmtBrl(resBrl)}</span>`);
        setEl('roSbTae', `<span class="${clr(tae)}">${fmtPct(tae)}</span>`);
        const taeBar = el('roSbTaeBar');
        if (taeBar) setTimeout(() => taeBar.style.width = Math.min(Math.abs(tae), 100) + '%', 100);
        setTx('roSbStrike', strike > 0 ? fmtBrl(strike) : '—');
        setEl('roSbStrikeBadge', `<span class="rmc-badge-${tipo.toLowerCase()}">${tipo}</span>`);
        setEl('roSbDist', `<span class="${itm ? 'rmc-c-red' : 'rmc-c-gold'}">${distPct >= 0 ? '+' : ''}${distPct.toFixed(2)}%</span>`);
        const distBar = el('roSbDistBar');
        if (distBar) setTimeout(() => distBar.style.width = Math.min(Math.abs(distPct) * 3, 100) + '%', 100);
        setTx('roSbPremio',    premio > 0 ? fmtBrl(premio) : '—');
        setTx('roSbPremioSub', `x${qtd} = ${fmtBrl(premio * qtd)}`);
        setEl('roSbPoP', `<span class="${clr(pop - 50)}">${pop.toFixed(1)}%</span>`);
        const popBar = el('roSbPoPBar');
        if (popBar) setTimeout(() => popBar.style.width = pop + '%', 100);
        setTx('roSbSaldo',    saldo > 0 ? fmtBrl(saldo) : '—');
        setTx('roSbSaldoSub', (op.ativo_base || op.ativo || '').toUpperCase());
    }

    // ── ABA: Desempenho ───────────────────────────────────────────────────────
    function renderDesempenho(op) {
        if (!op) return;
        const cotacao   = parseFloat(op.cotacao_atual || op.preco_atual || 0);
        const cotAb     = parseFloat(op.abertura_cotacao || op.cotacao_abertura || 0);
        const strike    = parseFloat(op.strike || 0);
        const premio    = parseFloat(op.premio || 0);
        const qtd       = parseFloat(op.quantidade || 1);
        const tipo      = (op.tipo || 'CALL').toUpperCase();
        const saldo     = parseFloat(op.saldo_base || op.abertura || 0);
        const resultado = parseFloat(op.resultado || 0);
        const now       = new Date();
        const dataAb    = dateOf(op.data_operacao || op.data_abertura || '');
        const exDate    = dateOf(op.exercicio || '');
        const decorrido = dataAb ? daysBetween(dataAb, now) : 0;
        const totalDias = dataAb && exDate ? daysBetween(dataAb, exDate) : 0;
        const restantes = exDate ? Math.max(0, daysBetween(now, exDate)) : 0;
        const itm       = tipo === 'CALL' ? cotacao >= strike : cotacao <= strike;

        // Resumo
        setTx('roResAtivo',    op.ativo || op.ativo_ref || '—');
        setEl('roResTipoBadge', `<span class="rmc-badge-${tipo.toLowerCase()}">${tipo}</span>${op.subopcao ? `<span class="rmc-badge-sub">${esc(op.subopcao)}</span>` : ''}`);
        setTx('roResStrike',   strike  > 0 ? fmtBrl(strike)  : '—');
        setTx('roResAbertura', cotAb   > 0 ? fmtBrl(cotAb)   : '—');
        setTx('roResCotacao',  cotacao > 0 ? fmtBrl(cotacao) : '—');
        setTx('roResPremio',   premio  > 0 ? fmtBrl(premio)  : '—');
        setTx('roResQtd',      qtd);
        setTx('roResInvestido', saldo > 0 ? fmtBrl(saldo) : fmtBrl(premio * qtd));
        setTx('roResExDate',   op.exercicio ? op.exercicio.slice(0,10).split('-').reverse().join('/') : '—');
        setTx('roResDiasRest', restantes > 0 ? restantes + ' dias' : restantes === 0 && exDate ? 'Expirado' : '—');

        // Performance
        const popPct = calcPoP(cotacao, strike, tipo);
        setArc('roPerfPoPArc', popPct, popPct >= 60 ? '#00e87a' : popPct >= 40 ? '#f5a623' : '#ff4d6a');
        setEl('roPerfPoP', `<span class="${popPct >= 60 ? 'rmc-c-green' : popPct >= 40 ? 'rmc-c-gold' : 'rmc-c-red'}">${popPct.toFixed(0)}%</span>`);
        const lucroBrl = saldo > 0 ? saldo * resultado / 100 : premio * qtd;
        setEl('roPerfResultado', `<span class="${clr(resultado)}">${resultado >= 0 ? '+' : ''}${resultado.toFixed(2)}%</span>`);
        setEl('roPerfLucroBrl',  `<span class="${clr(lucroBrl)}">${fmtBrl(lucroBrl)}</span>`);

        // Sparkline
        const pts = [cotAb||cotacao, ...([1,2,3,4,5,6,7,8,9].map(i => {
            const w = i / 9; return cotAb * (1 - w) + cotacao * w + (Math.random() - 0.5) * (cotAb||cotacao) * 0.02;
        })), cotacao].filter(v => v > 0);
        if (pts.length >= 2) {
            const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
            const pathPts = pts.map((v, i) => `${(i / (pts.length - 1) * 200).toFixed(1)},${(60 - (v - mn) / rng * 55 - 2).toFixed(1)}`);
            const d = 'M' + pathPts.join(' L');
            const last = pathPts[pathPts.length - 1].split(',');
            const fill = d + ` L${last[0]},60 L0,60Z`;
            const pathEl = document.getElementById('roPerfPath');
            const fillEl = document.getElementById('roPerfFill');
            if (pathEl) pathEl.setAttribute('d', d);
            if (fillEl) fillEl.setAttribute('d', fill);
        }

        // Gregos
        const delta = parseFloat(op.delta || 0);
        const gamma = parseFloat(op.gamma || 0);
        const theta = parseFloat(op.theta || 0);
        const vega  = parseFloat(op.vega  || 0);
        const iv    = parseFloat(op.iv || op.volatilidade || 0);
        setEl('roGreeksDelta', `<span class="${delta >= 0 ? 'rmc-c-green' : 'rmc-c-red'}">${delta !== 0 ? delta.toFixed(4) : '—'}</span>`);
        setTx('roGreeksGamma', gamma !== 0 ? gamma.toFixed(4) : '—');
        setEl('roGreeksTheta', `<span class="rmc-c-red">${theta !== 0 ? theta.toFixed(4) : '—'}</span>`);
        setEl('roGreeksVega',  `<span class="rmc-c-cyan">${vega  !== 0 ? vega.toFixed(4)  : '—'}</span>`);
        setTx('roGreeksIV',    iv > 0 ? iv.toFixed(1) + '%' : '—');

        // Probabilidades
        const dist    = cotacao > 0 && strike > 0
            ? (tipo === 'PUT' ? (cotacao - strike) / cotacao * 100 : (strike - cotacao) / cotacao * 100)
            : 0;
        const probITM = Math.min(Math.max(50 - dist * 2, 3), 97);
        const probOTM = 100 - probITM;
        setEl('roProbPoP', `<span class="${popPct >= 60 ? 'rmc-c-green' : popPct >= 40 ? 'rmc-c-gold' : 'rmc-c-red'}">${popPct.toFixed(1)}%</span>`);
        setEl('roProbITM', `<span class="${probITM >= 50 ? 'rmc-c-red' : 'rmc-c-green'}">${probITM.toFixed(1)}%</span>`);
        setEl('roProbOTM', `<span class="${probOTM >= 50 ? 'rmc-c-green' : 'rmc-c-red'}">${probOTM.toFixed(1)}%</span>`);
        setEl('roProbDist', `<span class="${itm ? 'rmc-c-red' : 'rmc-c-gold'}">${dist >= 0 ? '+' : ''}${dist.toFixed(1)}%</span>`);

        // Risco/Retorno
        const ganhoMax  = premio * qtd;
        const perdaMax  = saldo > ganhoMax ? saldo - ganhoMax : ganhoMax;
        const rrRatio   = perdaMax > 0 ? ganhoMax / perdaMax : 0;
        const breakEven = tipo === 'CALL' ? strike + premio : strike - premio;
        setEl('roRRGanhoMax',  `<span class="rmc-c-green">${fmtBrl(ganhoMax)}</span>`);
        setEl('roRRPerdaMax',  `<span class="rmc-c-red">${fmtBrl(perdaMax)}</span>`);
        setEl('roRRRatio',     `<span class="${rrRatio >= 1 ? 'rmc-c-green' : 'rmc-c-gold'}">${rrRatio.toFixed(2)}</span>`);
        setTx('roRRBreakeven', breakEven > 0 ? fmtBrl(breakEven) : '—');

        // Theta Decay
        const thetaDay   = Math.abs(theta) > 0 ? Math.abs(theta) : premio * 0.02;
        const thetaTotal = thetaDay * (totalDias || 30);
        const thetaPct   = thetaTotal > 0 ? Math.min(Math.max((thetaDay * restantes) / thetaTotal * 100, 0), 100) : 0;
        const thetaPathEl = document.getElementById('roThetaDecayPath');
        const thetaFillEl = document.getElementById('roThetaDecayFill');
        if (thetaPathEl && thetaFillEl) {
            const px = (100 - thetaPct) / 100 * 300;
            thetaPathEl.setAttribute('d', `M0,50 Q${px},50 300,10`);
            thetaFillEl.setAttribute('d', `M0,50 Q${px},50 300,10 L300,60 L0,60Z`);
        }
        setEl('roThetaDaily', `<span class="rmc-c-red">${thetaDay.toFixed(4)}</span>`);
        setEl('roThetaTotal', `<span class="rmc-c-gold">${fmtBrl(thetaTotal)}</span>`);

        // Cotação vs Strike
        const pctStrike = strike > 0 ? cotacao / strike * 100 : 100;
        setArc('roVsArc', Math.min(Math.max(pctStrike / 1.5, 0), 100), itm ? '#ff4d6a' : '#00e87a');
        setEl('roVsPct',    `<span class="${itm ? 'rmc-c-red' : 'rmc-c-green'}">${pctStrike.toFixed(1)}%</span>`);
        setTx('roVsCot',   cotacao > 0 ? fmtBrl(cotacao) : '—');
        setTx('roVsStrike', strike > 0 ? fmtBrl(strike)  : '—');
        setEl('roVsDiff',  `<span class="${itm ? 'rmc-c-red' : 'rmc-c-gold'}">${fmtBrl(Math.abs(cotacao - strike))}</span>`);
    }

    // ── ABA: Comparativos ─────────────────────────────────────────────────────
    function renderComparativos(op) {
        if (!op) return;
        const cotacao = parseFloat(op.cotacao_atual || op.preco_atual || 0);
        const cotAb   = parseFloat(op.abertura_cotacao || op.cotacao_abertura || 0);
        const strike  = parseFloat(op.strike || 0);
        const tipo    = (op.tipo || 'CALL').toUpperCase();
        const itm     = tipo === 'CALL' ? cotacao >= strike : cotacao <= strike;

        const vals = [cotAb, cotacao, strike].filter(v => v > 0);
        const minV = vals.length ? Math.min(...vals) : 0;
        const maxV = vals.length ? Math.max(...vals) : 1;
        const range = maxV - minV || 1;
        const pctOf = v => ((v - minV) / range * 92 + 4).toFixed(1);

        const bAb  = el('roCbarAbertura');
        const bStr = el('roCbarStrike');
        const bCot = el('roCbarCotacao');
        if (bAb  && cotAb   > 0) bAb.style.left   = pctOf(cotAb)   + '%';
        if (bStr && strike  > 0) bStr.style.left   = pctOf(strike)  + '%';
        if (bCot && cotacao > 0) bCot.style.left   = pctOf(cotacao) + '%';

        setTx('roCbAbert',   cotAb   > 0 ? fmtBrl(cotAb)   : '—');
        setTx('roCbStrike',  strike  > 0 ? fmtBrl(strike)  : '—');
        setTx('roLegAb',     cotAb   > 0 ? fmtBrl(cotAb)   : '—');
        setTx('roLegCot',    cotacao > 0 ? fmtBrl(cotacao) : '—');
        setTx('roLegStrike', strike  > 0 ? fmtBrl(strike)  : '—');

        const deltaAb    = cotAb > 0 ? cotacao - cotAb : 0;
        const deltaAbPct = cotAb > 0 ? deltaAb / cotAb * 100 : 0;
        setTx('roDAbVal',    cotAb   > 0 ? fmtBrl(cotAb)   : '—');
        setTx('roDCotVal',   cotacao > 0 ? fmtBrl(cotacao) : '—');
        setEl('roDCotPct',   `<span class="${clr(deltaAbPct)}">${deltaAbPct >= 0 ? '+' : ''}${deltaAbPct.toFixed(2)}%</span>`);
        setEl('roDDeltaVal', `<span class="${clr(deltaAb)}">${deltaAb >= 0 ? '+' : ''}${fmtBrl(deltaAb)}</span>`);
        const pbAb = el('roPbVsAb');
        if (pbAb) setTimeout(() => pbAb.style.width = Math.min(Math.abs(deltaAbPct) * 2, 100) + '%', 100);

        const distBrl = cotacao - strike;
        const distPct = strike > 0 ? distBrl / strike * 100 : 0;
        setTx('roD2Cot',     cotacao > 0 ? fmtBrl(cotacao) : '—');
        setTx('roD2Strike',  strike  > 0 ? fmtBrl(strike)  : '—');
        setEl('roD2Badge',   `<span class="rmc-badge-${tipo.toLowerCase()}">${tipo}</span>`);
        setEl('roD2Dist',    `<span class="${itm ? 'rmc-c-red' : 'rmc-c-gold'}">${fmtBrl(Math.abs(distBrl))}</span>`);
        setEl('roD2DistPct', `<span class="${itm ? 'rmc-c-red' : 'rmc-c-gold'}">${Math.abs(distPct).toFixed(2)}%</span>`);
        const pbStr = el('roPbVsStrike');
        if (pbStr) setTimeout(() => pbStr.style.width = Math.min(Math.abs(distPct) * 3, 100) + '%', 100);

        const pctStrike = strike > 0 ? Math.min(cotacao / strike * 100, 200) : 0;
        setArc('roArcCotStrike', Math.min(pctStrike / 2, 100), itm ? '#ff4d6a' : '#00e87a');
        setEl('roGcPctStrike', `<span class="${itm ? 'rmc-c-red' : 'rmc-c-green'}">${pctStrike.toFixed(1)}%</span>`);
        setTx('roGcCot1',    cotacao > 0 ? fmtBrl(cotacao) : '—');
        setTx('roGcStrike1', strike  > 0 ? fmtBrl(strike)  : '—');
        setEl('roGcFalta',   `<span class="rmc-c-gold">${fmtBrl(Math.abs(distBrl))}</span>`);

        const multAb = cotAb > 0 ? cotacao / cotAb : 1;
        setArc('roArcCotAb', Math.min(Math.abs(deltaAbPct), 100), deltaAbPct >= 0 ? '#00d4e8' : '#ff4d6a');
        setEl('roGcPctAb', `<span class="${clr(deltaAbPct)}">${deltaAbPct >= 0 ? '+' : ''}${deltaAbPct.toFixed(1)}%</span>`);
        setTx('roGcAb2',   cotAb   > 0 ? fmtBrl(cotAb)   : '—');
        setTx('roGcCot2',  cotacao > 0 ? fmtBrl(cotacao) : '—');
        setTx('roGcMult',  multAb.toFixed(3) + 'x');

        const distFromStrike = cotacao > 0 && strike > 0
            ? (tipo === 'PUT' ? (cotacao - strike) / cotacao * 100 : (strike - cotacao) / cotacao * 100)
            : 0;
        setArc('roArcDist2', Math.min(Math.abs(distFromStrike) * 3, 100), itm ? '#ff4d6a' : '#f5a623');
        setEl('roGcDistPct',    `<span class="${itm ? 'rmc-c-red' : 'rmc-c-gold'}">${distFromStrike >= 0 ? '+' : ''}${distFromStrike.toFixed(1)}%</span>`);
        setEl('roGcDistBrl',    `<span class="rmc-c-gold">${fmtBrl(Math.abs(distBrl))}</span>`);
        setEl('roGcDistStatus', `<span class="${itm ? 'rmc-c-red' : 'rmc-c-green'}">${itm ? 'ITM' : 'OTM'}</span>`);
        setEl('roGcDistTipo',   `<span class="rmc-badge-${tipo.toLowerCase()}">${tipo}</span>`);
    }

    // ── ABA: Posicoes Abertas ─────────────────────────────────────────────────
    function renderPosicoes() {
        const rows = el('roPosRows');
        if (!rows) return;
        const abertas = filteredOps.filter(o => (o.status || 'ABERTA').toUpperCase() === 'ABERTA');

        if (!abertas.length) {
            rows.innerHTML = '<div style="padding:1rem;color:#5a7090;text-align:center;font-size:0.82rem;">Nenhuma posicao aberta com os filtros atuais</div>';
            setEl('roPoPCards', '');
            return;
        }

        rows.innerHTML = abertas.map((op) => {
            const tipo      = (op.tipo || 'CALL').toUpperCase();
            const ativo     = (op.ativo || op.papel || '—').toUpperCase();
            const cotacao   = parseFloat(op.cotacao_atual || op.preco_atual || 0);
            const strike    = parseFloat(op.strike || 0);
            const tae       = parseFloat(op.tae || op.tae_pct || 0);
            const resultado = parseFloat(op.resultado || 0);
            const dataStr   = (op.data_operacao || op.data_abertura || '').slice(0,10);
            const dataFmt   = dataStr ? dataStr.split('-').reverse().join('/') : '—';
            const globalIdx = filteredOps.indexOf(op);
            const isActive  = globalIdx === currentIdx;
            return `<div class="rmc-pos-row${isActive ? ' rmc-pos-row-active' : ''}" onclick="window._roPosSelect(${globalIdx})">
                <span class="rmc-pos-ativo">${esc(ativo)}</span>
                <span><span class="rmc-badge-${tipo.toLowerCase()}">${tipo}</span></span>
                <span style="color:#7a9ab8;font-size:0.78rem;">${dataFmt}</span>
                <span class="rmc-c-gold">${strike > 0 ? fmtBrl(strike) : '—'}</span>
                <span class="${clr(tae)}">${fmtPct(tae)}</span>
                <span class="${clr(resultado)}">${fmtPct(resultado)}</span>
            </div>`;
        }).join('');

        const popCards = el('roPoPCards');
        if (popCards) {
            popCards.innerHTML = abertas.slice(0, 4).map(op => {
                const tipo    = (op.tipo || 'CALL').toUpperCase();
                const cotacao = parseFloat(op.cotacao_atual || op.preco_atual || 0);
                const strike  = parseFloat(op.strike || 0);
                const pop     = calcPoP(cotacao, strike, tipo);
                const ativo   = (op.ativo || '?').toUpperCase();
                const offset  = (CIRC38 * (1 - pop / 100)).toFixed(2);
                const clrPop  = pop >= 70 ? '#00e87a' : pop >= 50 ? '#f5a623' : '#ff4d6a';
                return `<div class="rmc-card">
                    <div class="rmc-card-label"><span class="rmc-card-label-dot" style="background:${clrPop}"></span>PoP - ${esc(String(ativo))}</div>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <div class="rmc-gauge-wrap rmc-gauge-sm">
                            <svg viewBox="0 0 100 100"><circle class="rmc-g-track-sm" cx="50" cy="50" r="38"/><circle class="rmc-g-arc-sm" cx="50" cy="50" r="38" stroke="${clrPop}" style="stroke-dasharray:${CIRC38};stroke-dashoffset:${offset};transform-origin:center;transform:rotate(-90deg)"/></svg>
                            <div class="rmc-gauge-inner"><div class="rmc-g-val-sm" style="color:${clrPop}">${pop.toFixed(0)}%</div><div class="rmc-g-sub">PoP</div></div>
                        </div>
                        <div style="flex:1;">
                            <div class="rmc-info-row"><span class="rmc-ik">Tipo</span><span class="rmc-iv"><span class="rmc-badge-${tipo.toLowerCase()}">${tipo}</span></span></div>
                            <div class="rmc-info-row"><span class="rmc-ik">Cotacao</span><span class="rmc-iv rmc-c-cyan">${cotacao > 0 ? fmtBrl(cotacao) : '—'}</span></div>
                            <div class="rmc-info-row"><span class="rmc-ik">Strike</span><span class="rmc-iv rmc-c-gold">${strike > 0 ? fmtBrl(strike) : '—'}</span></div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    window._roPosSelect = function(idx) { currentIdx = idx; renderOpTabs(); renderAll(); };

    // ── ABA: Evolucao ─────────────────────────────────────────────────────────
    function renderEvolucao(op) {
        if (!op) return;
        const cotacao = parseFloat(op.cotacao_atual || op.preco_atual || 0);
        const cotAb   = parseFloat(op.abertura_cotacao || op.cotacao_abertura || 0);
        const strike  = parseFloat(op.strike || 0);
        const premio  = parseFloat(op.premio || 0);
        const dataAb  = dateOf(op.data_operacao || op.data_abertura || '');
        const exDate  = dateOf(op.exercicio || '');
        const now     = new Date();

        if (cotAb > 0 && cotacao > 0) {
            const pts    = [[0, cotAb], [300, cotAb * 0.98], [600, cotacao]];
            const minP   = Math.min(...pts.map(p => p[1])) * 0.99;
            const maxP   = Math.max(...pts.map(p => p[1])) * 1.01;
            const scaleY = v => (120 - ((v - minP) / (maxP - minP)) * 110).toFixed(1);
            const pathD  = 'M' + pts.map(p => p[0] + ',' + scaleY(p[1])).join(' L');
            const fillD  = 'M0,' + scaleY(pts[0][1]) + ' L' + pts.map(p => p[0] + ',' + scaleY(p[1])).join(' L') + ' L600,120 L0,120Z';
            const pathEl = el('roEvoPath'); if (pathEl) pathEl.setAttribute('d', pathD);
            const fillEl = el('roEvoFill'); if (fillEl) fillEl.setAttribute('d', fillD);
        }

        const resultado = parseFloat(op.resultado || 0);
        setEl('roEvoLabel', `<span class="${clr(resultado)}">${fmtPct(resultado)}</span>`);
        setTx('roEvoDateStart', dataAb ? dataAb.toLocaleDateString('pt-BR') : '—');
        setTx('roEvoDateEnd',   exDate ? exDate.toLocaleDateString('pt-BR') : '—');
        setTx('roEvoMin', cotAb   > 0 ? fmtBrl(Math.min(cotAb, cotacao)) : '—');
        setTx('roEvoMax', cotacao > 0 ? fmtBrl(Math.max(cotAb || cotacao, cotacao)) : '—');
        setTx('roThetaInicio', fmtBrl(premio * 1.3));
        setTx('roThetaAtual',  fmtBrl(premio));
        const popAtual = calcPoP(cotacao, strike, (op.tipo || 'CALL').toUpperCase());
        setTx('roPoPHistInicio', '65.0%');
        setEl('roPoPHistAtual', `<span class="${clr(popAtual - 50)}">${popAtual.toFixed(1)}%</span>`);
    }

    // ── ABA: Risco ────────────────────────────────────────────────────────────
    function renderRisco(op) {
        if (!op) return;
        const cotacao = parseFloat(op.cotacao_atual || op.preco_atual || 0);
        const strike  = parseFloat(op.strike || 0);
        const premio  = parseFloat(op.premio || 0);
        const qtd     = parseFloat(op.quantidade || 1);
        const tipo    = (op.tipo || 'CALL').toUpperCase();
        const saldo   = parseFloat(op.saldo_base || op.abertura || 0);
        const itm     = tipo === 'CALL' ? cotacao >= strike : cotacao <= strike;
        const pop     = calcPoP(cotacao, strike, tipo);
        const probEx  = 100 - pop;

        setArc('roArcRisco', probEx, probEx > 40 ? '#ff4d6a' : probEx > 20 ? '#f5a623' : '#00e87a');
        setEl('roRiscoGPct',      `<span class="${probEx > 40 ? 'rmc-c-red' : 'rmc-c-gold'}">${probEx.toFixed(1)}%</span>`);
        setEl('roRiscoProbEx',    `<span class="${probEx > 40 ? 'rmc-c-red' : 'rmc-c-gold'}">${probEx.toFixed(1)}%</span>`);
        setEl('roRiscoProbLucro', `<span class="rmc-c-green">${pop.toFixed(1)}%</span>`);

        const ganhoMax = premio * qtd;
        const perdaMax = saldo > 0 ? Math.min(saldo * 0.15, saldo) : ganhoMax * 5;
        const rr       = perdaMax > 0 ? ganhoMax / perdaMax : 0;
        setEl('roRiscoPerdaMax', `<span class="rmc-c-red">-${fmtBrl(perdaMax)}</span>`);
        setEl('roRiscoGanhoMax', `<span class="rmc-c-gold">${fmtBrl(ganhoMax)}</span>`);
        setEl('roRiscoRR',       `<span class="rmc-c-gold">${rr.toFixed(2)}</span>`);

        const distBrl = cotacao > 0 && strike > 0 ? Math.abs(tipo === 'CALL' ? strike - cotacao : cotacao - strike) : 0;
        setEl('roRiscoDist', `<span class="${itm ? 'rmc-c-red' : 'rmc-c-green'}">${itm ? 'ITM' : fmtBrl(distBrl)}</span>`);

        const breakEven = tipo === 'CALL' ? strike + premio : strike - premio;
        setTx('roCenarioOTM', tipo === 'CALL'
            ? `Cotacao (${fmtBrl(cotacao)}) abaixo do strike (${fmtBrl(strike)}) -> premio ${fmtBrl(ganhoMax)} retido`
            : `Cotacao (${fmtBrl(cotacao)}) acima do strike (${fmtBrl(strike)}) -> premio ${fmtBrl(ganhoMax)} retido`);
        setTx('roCenarioITM', tipo === 'CALL'
            ? `Cotacao ultrapassa ${fmtBrl(strike)} -> risco de exercicio (perda pot. ${fmtBrl(perdaMax)})`
            : `Cotacao cai abaixo de ${fmtBrl(strike)} -> risco de exercicio (perda pot. ${fmtBrl(perdaMax)})`);
        setTx('roCenarioEq', `Break-even: ${fmtBrl(breakEven)} - Premio/saldo: ${saldo > 0 ? (ganhoMax/saldo*100).toFixed(2) : '—'}%`);

        const warn = el('roRiscoWarn');
        if (warn) warn.style.display = itm ? 'inline' : 'none';

        const iv   = Math.min(20 + Math.abs(100 - pop) * 0.5, 80);
        const delta = tipo === 'CALL' ? (1 - pop / 100) : -(1 - pop / 100);
        const exDate = dateOf(op.exercicio);
        const now = new Date();
        const restDias = exDate ? Math.max(0, daysBetween(now, exDate)) : 30;
        const theta = restDias > 0 ? premio / restDias : 0;
        const thetaPct = premio > 0 ? theta / premio * 100 : 0;

        setArc('roArcIV',    Math.min(iv, 100),               '#a855f7');
        setArc('roArcDelta', Math.abs(delta) * 100,           '#4d9eff');
        setArc('roArcTheta', Math.min(thetaPct * 3, 100),     '#ff4d6a');
        setEl('roRiscoIV',       `<span class="rmc-c-purple">${iv.toFixed(1)}%</span>`);
        setEl('roRiscoIVRank',   `<span class="rmc-c-purple">${iv > 40 ? 'Alto' : iv > 20 ? 'Medio' : 'Baixo'}</span>`);
        setEl('roRiscoDelta',     `<span class="rmc-c-blue">${delta.toFixed(3)}</span>`);
        setEl('roRiscoDeltaSens', `<span class="rmc-c-blue">${Math.abs(delta) > 0.5 ? 'Alta' : Math.abs(delta) > 0.3 ? 'Media' : 'Baixa'}</span>`);
        setEl('roRiscoTheta',      `<span class="rmc-c-red">-${theta.toFixed(4)}</span>`);
        setEl('roRiscoThetaTotal', `<span class="rmc-c-red">-${fmtBrl(theta * restDias)}</span>`);
    }

    // ── OP Tabs Row ───────────────────────────────────────────────────────────
    function renderOpTabs() {
        const row = el('roOpTabsRow');
        if (!row) return;
        row.innerHTML = '';
        if (!filteredOps.length) return;

        filteredOps.forEach((op, idx) => {
            const tipo    = (op.tipo || 'CALL').toUpperCase();
            const status  = (op.status || 'ABERTA').toUpperCase();
            const ativo   = (op.ativo || op.papel || '?').toUpperCase();
            const strike  = parseFloat(op.strike || 0);
            const dataStr = (op.data_operacao || op.data_abertura || '').slice(0, 10);
            const dataFmt = dataStr ? dataStr.split('-').reverse().slice(0, 2).join('/') : '—';

            const btn = document.createElement('button');
            btn.className  = 'rmc-op-tab' + (idx === currentIdx ? ' active' : '');
            btn.dataset.idx    = idx;
            btn.dataset.status = status === 'ABERTA' ? 'aberta' : 'fechada';
            btn.title = `${ativo} · ${tipo} · Strike ${strike > 0 ? 'R$' + strike.toFixed(2) : '—'} · ${dataFmt}`;
            const badgeColor = tipo === 'CALL' ? '#3b82f6' : '#a855f7';
            btn.innerHTML =
                `<span style="color:${badgeColor};font-weight:700;">${tipo}</span>` +
                `<span style="font-size:0.8rem;">${esc(ativo)}</span>` +
                `<span class="rmc-op-tab-badge">${dataFmt}</span>`;
            btn.addEventListener('click', () => {
                currentIdx = idx;
                renderOpTabs();
                renderAll();
            });
            row.appendChild(btn);
        });

        const activeTab = row.querySelector('.rmc-op-tab.active');
        if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    // ── Render por secao ──────────────────────────────────────────────────────
    function renderAll() {
        const op      = filteredOps[currentIdx] || null;
        const empty   = el('roEmptyState');
        const dashBody = el('roDashBody');
        const content  = el('roContent');

        if (!filteredOps.length) {
            if (empty)    empty.classList.remove('d-none');
            if (dashBody) dashBody.style.opacity = '0.3';
            return;
        }
        if (empty)    empty.classList.add('d-none');
        if (dashBody) dashBody.style.opacity = '1';

        renderSidebar(op);
        switch (activeSection) {
            case 'desempenho':   renderDesempenho(op);   break;
            case 'comparativos': renderComparativos(op); break;
            case 'posicoes':     renderPosicoes();       break;
            case 'risco':        renderRisco(op);        break;
        }
        ['desempenho','comparativos','posicoes','risco'].forEach(sec => {
            const panel = el('roSec' + sec.charAt(0).toUpperCase() + sec.slice(1));
            if (panel) panel.classList.toggle('active', sec === activeSection);
        });
    }

    // ── Render completo ───────────────────────────────────────────────────────
    function render() {
        applyFilters();
        renderSummary();
        renderOpTabs();
        renderAll();
    }

    // ── Setup filtros ─────────────────────────────────────────────────────────
    function setupFilterListeners() {
        // Period pills
        document.querySelectorAll('#modalResultadosOpcoes [data-period]').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('#modalResultadosOpcoes [data-period]')
                    .forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                activePeriod = this.dataset.period || 'all';
                currentIdx = 0;
                render();
            });
        });

        // Type pills (Abertas/Fechadas/Todas)
        document.querySelectorAll('#modalResultadosOpcoes [data-type]').forEach(btn => {
            btn.addEventListener('click', function () {
                const t = this.dataset.type;
                document.querySelectorAll('#modalResultadosOpcoes [data-type]')
                    .forEach(b => b.classList.remove('active'));
                if (activeType === t) {
                    activeType = null;
                } else {
                    activeType = t;
                    this.classList.add('active');
                }
                currentIdx = 0;
                render();
            });
        });

        // Tipo pills (CALL/PUT)
        document.querySelectorAll('#modalResultadosOpcoes [data-tipo]').forEach(btn => {
            btn.addEventListener('click', function () {
                const t = this.dataset.tipo;
                document.querySelectorAll('#modalResultadosOpcoes [data-tipo]')
                    .forEach(b => b.classList.remove('active'));
                if (activeTipo === t) {
                    activeTipo = null;
                } else {
                    activeTipo = t;
                    this.classList.add('active');
                }
                currentIdx = 0;
                render();
            });
        });

        // Section tabs
        document.querySelectorAll('#modalResultadosOpcoes .rmc-section-tab[data-sec]').forEach(btn => {
            btn.addEventListener('click', function () {
                activeSection = this.dataset.sec;
                document.querySelectorAll('#modalResultadosOpcoes .rmc-section-tab[data-sec]')
                    .forEach(b => b.classList.toggle('active', b.dataset.sec === activeSection));
                renderAll();
            });
        });

        // Compat nav buttons (hidden)
        el('roPrevOp')?.addEventListener('click', () => {
            if (currentIdx > 0) { currentIdx--; renderOpTabs(); renderAll(); }
        });
        el('roNextOp')?.addEventListener('click', () => {
            if (currentIdx < filteredOps.length - 1) { currentIdx++; renderOpTabs(); renderAll(); }
        });

        // Refresh
        el('roRefreshBtn')?.addEventListener('click', function () {
            this.classList.add('spinning');
            setTimeout(() => this.classList.remove('spinning'), 800);
            currentIdx = 0;
            render();
            updateTimestamp('roLastUpdate');
        });
    }

    function updateTimestamp(id) {
        const now = new Date();
        const e = el(id);
        if (e) e.textContent = `Atualizado: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // ── Template loading ──────────────────────────────────────────────────────
    async function ensureTemplate() {
        if (loaded) return true;
        const container = el(cfg.containerElId);
        if (!container) {
            console.error('[ModalResultadosOpcoes] Container #' + cfg.containerElId + ' nao encontrado.');
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
            console.error('[ModalResultadosOpcoes] Erro ao carregar template:', e);
            return false;
        }
    }

    async function openModal() {
        const ok = await ensureTemplate();
        if (!ok) return;
        activePeriod  = 'all';
        activeType    = 'aberta';
        activeTipo    = null;
        activeSection = 'desempenho';
        currentIdx    = 0;

        // Sync period pills
        document.querySelectorAll('#modalResultadosOpcoes [data-period]').forEach(b => {
            b.classList.toggle('active', b.dataset.period === 'all');
        });
        // Sync type pills — activate 'aberta' by default
        document.querySelectorAll('#modalResultadosOpcoes [data-type]').forEach(b => b.classList.remove('active'));
        document.querySelector('#modalResultadosOpcoes [data-type="aberta"]')?.classList.add('active');
        // Sync section tabs — activate 'desempenho'
        document.querySelectorAll('#modalResultadosOpcoes .rmc-section-tab[data-sec]').forEach(b => {
            b.classList.toggle('active', b.dataset.sec === 'desempenho');
        });
        // Reset active panel
        document.querySelectorAll('#modalResultadosOpcoes .rmc-tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector('#modalResultadosOpcoes #roSecDesempenho')?.classList.add('active');

        render();
        updateTimestamp('roLastUpdate');

        const modalEl = el(cfg.modalElId);
        if (!modalEl) return;
        let bsModal = bootstrap.Modal.getInstance(modalEl);
        if (!bsModal) bsModal = new bootstrap.Modal(modalEl, { keyboard: true });
        bsModal.show();
    }

    function setupTriggers() {
        const btn = el(cfg.triggerBtnId);
        if (btn && !btn._roResHandled) {
            btn.addEventListener('click', openModal);
            btn._roResHandled = true;
        }
    }

    document.addEventListener('layoutReady', setupTriggers);
    document.addEventListener('DOMContentLoaded', setupTriggers);

    function configure(opts) { Object.assign(cfg, opts); setupTriggers(); }

    window.ModalResultadosOpcoes = { configure, open: openModal };
})();

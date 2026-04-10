/**
 * modal-analise-detalhe-crypto.js  v1.0.0
 * Modal de Análise Completa da Operação Crypto
 *
 * Combina o painel de Detalhes (esquerda) com análise gráfica completa (direita):
 *  - KPIs: Prêmio Est. · ROI · Distância · TAE
 *  - Card Previsão / POP com arco SVG
 *  - Card Preço Médio do portfólio
 *  - Card Risco da Operação
 *  - Card "Retorno ao Vencimento" (dinâmico por ativo)
 *
 * Usa: window.cryptoOperacoes, buildGaugeSVG (de modal-detalhe-crypto.js via IIFE)
 * Expõe: window.ModalAnalise = { open }
 */
(function () {
    'use strict';

    const MODAL_ID      = 'modalAnaliseCompleta';
    const CONTAINER_ID  = 'modalAnaliseCompletaContainer';
    const TEMPLATE_PATH = 'modal-analise-detalhe-crypto.html';

    let _loadPromise      = null;
    let _macCountdownTimer = null;

    // ─── Formatadores ────────────────────────────────────────────────────────
    function fmtUsd(v) {
        return 'US$\u00a0' + (parseFloat(v) || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function fmtDate(s) {
        if (!s) return '—';
        const parts = s.split('-');
        return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : s;
    }

    // ─── Tempo ───────────────────────────────────────────────────────────────
    function getVencEnd(exercicioStr) {
        if (!exercicioStr) return null;
        const [y, m, d] = exercicioStr.split('-').map(Number);
        return new Date(y, m - 1, d, 5, 0, 0, 0).getTime();
    }

    function calcTimePct(dataOperacao, exercicio) {
        const start = dataOperacao ? new Date(dataOperacao + 'T00:00:00').getTime() : null;
        const end   = getVencEnd(exercicio);
        if (!start || !end) return null;
        const total = end - start;
        if (total <= 0) return 100;
        return Math.max(0, Math.min(100, ((Date.now() - start) / total) * 100));
    }

    function formatCountdown(ms) {
        if (ms <= 0) return '00:00:00';
        const totalSec = Math.floor(ms / 1000);
        const d  = Math.floor(totalSec / 86400);
        const h  = Math.floor((totalSec % 86400) / 3600);
        const mi = Math.floor((totalSec % 3600) / 60);
        const s  = totalSec % 60;
        const hms = String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        return d > 0 ? d + 'd ' + hms : hms;
    }

    // ─── Risk level ──────────────────────────────────────────────────────────
    function getRisk(distNum) {
        if (distNum < 0)  return { color: '#e85d4a', bg: 'rgba(232,93,74,0.12)',   label: 'ITM — EXERCÍCIO PROVÁVEL',    level: 'danger'  };
        if (distNum < 2)  return { color: '#f59f00', bg: 'rgba(245,159,0,0.12)',   label: 'ATENÇÃO — PRÓXIMO DO STRIKE', level: 'warning' };
        if (distNum < 5)  return { color: '#4da6ff', bg: 'rgba(77,166,255,0.12)',  label: 'MODERADO — MONITORAR',        level: 'info'    };
        return              { color: '#47b96c', bg: 'rgba(71,185,108,0.12)', label: 'SEGURO — OTM CONFORTÁVEL',    level: 'success' };
    }

    function assetPulseClass(ativo) {
        const a = (ativo || '').toUpperCase();
        if (a === 'BTC') return 'mdc-pulse-btc';
        if (a === 'ETH') return 'mdc-pulse-eth';
        if (a === 'BNB') return 'mdc-pulse-bnb';
        if (a === 'SOL') return 'mdc-pulse-sol';
        return 'mdc-pulse-xrp';
    }

    // ─── Gauge SVG (mesma lógica do modal-detalhe-crypto.js) ─────────────────
    function buildGaugeSVG(distRaw, tipo) {
        const dist = parseFloat(distRaw) || 0;
        let zoneColor, zoneLabel, zoneEmoji;
        if (dist < 0)      { zoneColor = '#e85d4a'; zoneLabel = 'ITM — Exercício Provável';    zoneEmoji = '🔴'; }
        else if (dist < 2) { zoneColor = '#f59f00'; zoneLabel = 'Zona de Atenção';             zoneEmoji = '🟡'; }
        else if (dist < 5) { zoneColor = '#4da6ff'; zoneLabel = 'Moderadamente Seguro';        zoneEmoji = '🔵'; }
        else               { zoneColor = '#47b96c'; zoneLabel = 'OTM — Seguro';                zoneEmoji = '🟢'; }

        const cx = 100, cy = 100, r = 78;
        const START_DEG = 200, ARC = 140, RANGE = 20;
        function toRad(deg) { return deg * Math.PI / 180; }
        function pt(deg)    { return { x: cx + r * Math.cos(toRad(deg)), y: cy + r * Math.sin(toRad(deg)) }; }
        const clamped   = Math.max(-RANGE, Math.min(RANGE, dist));
        const needleDeg = START_DEG + ((clamped + RANGE) / (2 * RANGE)) * ARC;
        const np        = pt(needleDeg);

        function arcSeg(a1, a2, color) {
            const p1 = pt(a1), p2 = pt(a2);
            const lg = (a2 - a1) > 180 ? 1 : 0;
            return `<path d="M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${lg} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}"
              stroke="${color}" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.32"/>`;
        }

        return `
<svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" class="mdc-gauge-svg">
  ${arcSeg(200, 223, '#e85d4a')}
  ${arcSeg(223, 252, '#f59f00')}
  ${arcSeg(252, 288, '#4da6ff')}
  ${arcSeg(288, 340, '#47b96c')}
  <path d="M ${pt(200).x.toFixed(2)} ${pt(200).y.toFixed(2)} A ${r} ${r} 0 0 1 ${pt(340).x.toFixed(2)} ${pt(340).y.toFixed(2)}"
    stroke="rgba(255,255,255,0.06)" stroke-width="12" fill="none" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${np.x.toFixed(2)}" y2="${np.y.toFixed(2)}"
    stroke="${zoneColor}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="7" fill="${zoneColor}" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy}" r="3" fill="#fff"/>
  <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="15" font-weight="bold" fill="${zoneColor}" font-family="monospace">${dist >= 0 ? '+' : ''}${dist.toFixed(2)}%</text>
  <text x="13"  y="112" text-anchor="middle" font-size="8.5" fill="#e85d4a" font-family="monospace">ITM</text>
  <text x="187" y="112" text-anchor="middle" font-size="8.5" fill="#47b96c" font-family="monospace">OTM</text>
</svg>
<div class="mdc-gauge-label" style="color:${zoneColor}">${zoneEmoji}&nbsp;${zoneLabel}</div>`;
    }

    // ─── Timestamp do header ──────────────────────────────────────────────────
    function _updateTs() {
        const el = document.getElementById('macLastUpdated');
        if (!el) return;
        const now = new Date();
        el.textContent = 'Atualizado: ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');
    }

    // ─── Cálculo POP ─────────────────────────────────────────────────────────
    function calcPOP(tipo, cotacao, strike) {
        if (!cotacao || !strike) return null;
        const dist = tipo === 'CALL'
            ? (cotacao - strike) / strike * 100
            : (strike - cotacao) / cotacao * 100;
        return Math.max(5, Math.min(95, 50 + dist * 2.5));
    }

    function calcRetornoVencimentoData(op, cotacao) {
        const strike = parseFloat(op.strike) || 0;
        const price  = parseFloat(cotacao) || 0;
        const premio = parseFloat(op.premio_us) || 0;
        const tipo   = (op.tipo || 'PUT').toUpperCase();
        const ativo  = ((op.ativo || 'CRYPTO').toUpperCase()).replace('USDT', '').replace('/', '');

        if (!strike || !price) return null;

        const favorDist = tipo === 'CALL'
            ? ((price - strike) / strike) * 100
            : ((strike - price) / price) * 100;

        const diffAbs = price - strike;
        const diffPctStrike = ((price - strike) / strike) * 100;

        let zone;
        if (favorDist < 0) {
            zone = {
                level: 0,
                accent: '#e85d4a',
                pill: 'Fora da Zona',
                riskTitle: 'Risco Elevado',
                riskDesc: 'Cotação em zona desfavorável para exercício.'
            };
        } else if (favorDist < 2) {
            zone = {
                level: 1,
                accent: '#f59f00',
                pill: 'Margem Curta',
                riskTitle: 'Atenção',
                riskDesc: 'Próximo ao strike. Pequeno movimento pode inverter cenário.'
            };
        } else if (favorDist < 5) {
            zone = {
                level: 2,
                accent: '#4da6ff',
                pill: 'Monitorar',
                riskTitle: 'Moderado',
                riskDesc: 'Há folga, mas ainda exige acompanhamento.'
            };
        } else {
            zone = {
                level: 3,
                accent: '#47b96c',
                pill: 'Confortável',
                riskTitle: 'Segurança',
                riskDesc: 'Distância saudável em relação ao strike.'
            };
        }

        return {
            ativo: ativo || 'CRYPTO',
            tipo,
            strike,
            cotacao: price,
            premio,
            favorDist,
            diffAbs,
            diffPctStrike,
            zone
        };
    }

    function getProbabilityTone(probExercicio) {
        const p = Number.isFinite(probExercicio) ? probExercicio : 50;
        if (p >= 65) {
            return {
                bg: 'rgba(248,81,73,0.14)',
                border: 'rgba(248,81,73,0.34)'
            };
        }
        if (p >= 45) {
            return {
                bg: 'rgba(245,159,0,0.12)',
                border: 'rgba(245,159,0,0.32)'
            };
        }
        return {
            bg: 'rgba(63,185,80,0.10)',
            border: 'rgba(63,185,80,0.28)'
        };
    }

    // ─── Helper: aplica cor contextual no mac-kpi-card ───────────────────────
    function _setKpiCard(cardId, valEl, text, color) {
        const card = document.getElementById(cardId);
        const val  = document.getElementById(valEl);
        if (val) {
            val.textContent = text;
            val.style.color = color;
        }
        if (card) {
            card.style.borderLeftColor = color;
            card.style.setProperty('--mac-kpi-color', color);
            // fundo levíssimo com a cor contextual
            card.style.background = color !== 'rgba(255,255,255,.3)'
                ? color.replace(')', ', 0.05)').replace('rgb', 'rgba').replace('#', '')
                    // fallback: usa o color como hex → converte simples
                    .startsWith('#') ? color + '0d' : color
                : 'rgba(255,255,255,.04)';
            // forma mais segura:
            const alpha = '0d'; // ~5%
            if (color.startsWith('#')) {
                card.style.background = color + alpha;
            } else {
                // rgba/rgb: não altera fundo para evitar cálculo
                card.style.background = '';
            }
        }
    }

    // ─── KPIs ─────────────────────────────────────────────────────────────────
    function _renderKPIs(op, cotacao) {
        const valor  = parseFloat(op.abertura) || 0;
        const tae    = parseFloat(op.tae) || 0;
        const prazo  = parseFloat(op.prazo) || 30;
        const strike = parseFloat(op.strike) || 0;
        const tipo   = (op.tipo || 'PUT').toUpperCase();

        const premioEst = valor > 0 && tae > 0 ? valor * (tae / 100) * (prazo / 365) : 0;
        const roi       = valor > 0 && premioEst ? (premioEst / valor) * 100 : 0;
        const distancia = (cotacao && strike)
            ? (tipo === 'CALL'
                ? ((strike - cotacao) / cotacao) * 100
                : ((cotacao - strike) / strike) * 100)
            : null;

        // Prêmio Est. — verde se positivo, cinza se sem dados
        _setKpiCard('macKpiPremioCard', 'macSimPremio',
            premioEst > 0 ? '+$' + premioEst.toFixed(2) : '—',
            premioEst > 0 ? '#3fb950' : 'rgba(255,255,255,.3)');

        // ROI — verde se positivo
        _setKpiCard('macKpiRoiCard', 'macSimRoi',
            roi > 0 ? '+' + roi.toFixed(2) + '%' : '—',
            roi > 0 ? '#3fb950' : 'rgba(255,255,255,.3)');

        // Distância — semáforo: verde ≥5%, amarelo 2–5%, vermelho <2%/negativo
        const distColor = distancia === null ? 'rgba(255,255,255,.3)'
            : distancia >= 5 ? '#3fb950'
            : distancia >= 2 ? '#f59f00'
            : '#f85149';
        _setKpiCard('macKpiDistCard', 'macSimDist',
            distancia !== null ? (distancia >= 0 ? '+' : '') + distancia.toFixed(2) + '%' : '—',
            distColor);

        // TAE Anual — sempre azul (é dado de entrada)
        _setKpiCard('macKpiTaeCard', 'macSimTae',
            tae > 0 ? tae.toFixed(2) + '%' : '—',
            tae > 0 ? '#4da6ff' : 'rgba(255,255,255,.3)');
    }

    // ─── Previsão / POP ───────────────────────────────────────────────────────
    function _renderPrevisao(op, cotacao) {
        const body  = document.getElementById('macSimPrevBody');
        const badge = document.getElementById('macSimPrevBadge');
        const strike = parseFloat(op.strike) || 0;
        const tipo   = (op.tipo || 'PUT').toUpperCase();
        const premio = parseFloat(op.premio_us) || 0;
        const pop    = calcPOP(tipo, cotacao, strike);

        if (!body) return;
        if (!pop || !cotacao || !strike) {
            body.innerHTML = '<div class="sim-empty-state" style="min-height:60px">Dados insuficientes para previsão</div>';
            if (badge) { badge.textContent = ''; badge.style.cssText = ''; }
            return;
        }

        const arcColor = pop >= 65 ? '#3fb950' : pop >= 35 ? '#f59f00' : '#4da6ff';
        const CIRC = 175.93;
        const dashOffset = CIRC * (1 - pop / 100);

        let badgeText, badgeColor, badgeBg;
        if (pop >= 65) {
            badgeText = 'Exercício Provável'; badgeColor = '#3fb950'; badgeBg = 'rgba(47,179,68,.15)';
        } else if (pop >= 35) {
            badgeText = 'Zona Neutra'; badgeColor = '#f59f00'; badgeBg = 'rgba(245,159,0,.15)';
        } else {
            badgeText = tipo === 'CALL' ? 'Retorno em USDT' : 'Retorno em Crypto';
            badgeColor = '#4da6ff'; badgeBg = 'rgba(77,166,255,.15)';
        }
        if (badge) {
            badge.textContent = badgeText;
            badge.style.cssText = `color:${badgeColor};background:${badgeBg};border:1px solid ${badgeColor};padding:2px 9px;border-radius:10px;font-size:.63rem;font-weight:700`;
        }

        const pMin = strike * 0.85, pMax = strike * 1.15;
        const markerPct = Math.max(2, Math.min(98, (cotacao - pMin) / (pMax - pMin) * 100));
        const barFillPct = Math.max(0, Math.min(100, (strike - pMin) / (pMax - pMin) * 100));

        const dist = tipo === 'CALL'
            ? (cotacao - strike) / strike * 100
            : (strike - cotacao) / cotacao * 100;
        const distSign = dist > 0 ? '+' : '';

        let riskMsg, msgBg, msgColor;
        if (pop >= 65) {
            const retorno = tipo === 'CALL' ? 'BTC' : 'USDT';
            riskMsg = `✅ Cotação ${distSign}${dist.toFixed(2)}% do Strike — alta probabilidade de exercício (retorno em ${retorno})`;
            msgBg = 'rgba(47,179,68,.10)'; msgColor = '#3fb950';
        } else if (pop >= 35) {
            riskMsg = `⚖️ Zona de indefinição — Cotação ${distSign}${dist.toFixed(2)}% do Strike`;
            msgBg = 'rgba(245,159,0,.10)'; msgColor = '#f59f00';
        } else {
            const retorno = tipo === 'CALL' ? 'USDT' : 'BTC';
            riskMsg = `💵 Cotação ${distSign}${dist.toFixed(2)}% do Strike — baixa probabilidade de exercício (retorno em ${retorno})`;
            msgBg = 'rgba(77,166,255,.10)'; msgColor = '#4da6ff';
        }

        const fmt  = v => v ? v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
        const fmtK = v => v >= 1000 ? '$' + (v/1000).toFixed(0) + 'k' : '$' + v.toFixed(0);

        // Break-even para PUT DI
        const valor  = parseFloat(op.abertura) || 0;
        const prazo  = parseFloat(op.prazo) || 30;
        const tae    = parseFloat(op.tae) || 0;
        const premioEst = valor > 0 && tae > 0 ? valor * (tae / 100) * (prazo / 365) : 0;
        const qty    = strike > 0 ? valor / strike : 0;
        const breakEven = tipo === 'PUT' && qty > 0 ? strike - (premioEst / qty) : 0;

        body.innerHTML = `
            <div style="display:flex;gap:12px;align-items:center">
                <div class="sim-pop-wrap">
                    <svg width="72" height="72" viewBox="0 0 72 72">
                        <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="6"/>
                        <circle cx="36" cy="36" r="28" fill="none" stroke="${arcColor}" stroke-width="6"
                            stroke-linecap="round" stroke-dasharray="${CIRC.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}"
                            transform="rotate(-90 36 36)"/>
                    </svg>
                    <div class="sim-pop-center">
                        <div class="sim-pop-pct" style="color:${arcColor}">${pop.toFixed(1)}%</div>
                        <div class="sim-pop-lbl">POP</div>
                    </div>
                </div>
                <div style="flex:1">
                    <div class="sim-prev-item">
                        <span class="sim-prev-item-dot" style="background:#4da6ff"></span>
                        <span class="sim-prev-item-lbl">Cotação Atual</span>
                        <span class="sim-prev-item-val" style="color:#4da6ff">$${fmt(cotacao)}</span>
                    </div>
                    <div class="sim-prev-item">
                        <span class="sim-prev-item-dot" style="background:#f59f00"></span>
                        <span class="sim-prev-item-lbl">Strike</span>
                        <span class="sim-prev-item-val" style="color:#f59f00">$${fmt(strike)}</span>
                    </div>
                    ${premio > 0 ? `<div class="sim-prev-item">
                        <span class="sim-prev-item-dot" style="background:#3fb950"></span>
                        <span class="sim-prev-item-lbl">Prêmio</span>
                        <span class="sim-prev-item-val" style="color:#3fb950">+$${premio.toFixed(2)}</span>
                    </div>` : ''}
                    ${breakEven > 0 ? `<div class="sim-prev-item">
                        <span class="sim-prev-item-dot" style="background:rgba(255,255,255,.3)"></span>
                        <span class="sim-prev-item-lbl">Break-Even</span>
                        <span class="sim-prev-item-val">$${fmt(breakEven)}</span>
                    </div>` : ''}
                </div>
            </div>
            <div class="sim-prev-bar-track">
                <div class="sim-prev-bar-fill" style="width:${barFillPct.toFixed(1)}%;background:${arcColor};opacity:.45"></div>
                <div class="sim-prev-bar-marker" style="left:${markerPct.toFixed(1)}%"></div>
            </div>
            <div class="sim-prev-bar-lbl">
                <span>${fmtK(pMin)}</span><span>Strike ${fmtK(strike)}</span><span>${fmtK(pMax)}</span>
            </div>
            <div class="sim-prev-msg" style="background:${msgBg};color:${msgColor}">${riskMsg}</div>
        `;
    }

    // ─── Preço Médio do portfólio ─────────────────────────────────────────────
    function _renderPmCard(op, cotacao) {
        const body  = document.getElementById('macSimPmBody');
        const title = document.getElementById('macSimPmCardTitle');
        if (!body) return;

        const par = (op.ativo || 'BTC').toUpperCase().replace('USDT','').replace('/','').trim();
        const ops = (window.cryptoOperacoes || []).filter(o => {
            const a = (o.ativo || '').toUpperCase().replace('USDT','').replace('/','').trim();
            return a === par;
        });

        if (!ops.length) {
            body.innerHTML = `<div class="sim-empty-state" style="min-height:60px">Sem operações de ${par} no portfólio</div>`;
            if (title) title.textContent = `📊 Preço Médio ${par}`;
            return;
        }

        const callsExercidas = ops.filter(o => window.CryptoExerciseStatus?.isExercised
            ? window.CryptoExerciseStatus.isExercised(o, 'CALL')
            : false);
        const strikeExercida = callsExercidas.length
            ? Math.max(...callsExercidas.map(o => parseFloat(o.strike||0)))
            : parseFloat(ops.reduce((max, o) => parseFloat(o.strike||0) > parseFloat(max.strike||0) ? o : max, ops[0])?.strike || 0);

        const totalPremios = ops.reduce((s, o) => s + (parseFloat(o.premio_us)||0), 0);
        const pm = strikeExercida - totalPremios;
        const cot = cotacao || parseFloat(ops.find(o => parseFloat(o.cotacao_atual||0) > 0)?.cotacao_atual || 0);
        const pctVsPm = cot && pm ? ((cot - pm) / pm) * 100 : null;

        const acCor = par === 'BTC' ? '#f59f00' : par === 'ETH' ? '#4da6ff' : '#3fb950';
        const icone = par === 'BTC' ? '₿' : par === 'ETH' ? 'Ξ' : '◎';
        const pctColor = pctVsPm === null ? '' : pctVsPm >= 0 ? 'color:#3fb950' : pctVsPm > -3 ? 'color:#f59f00' : 'color:#f85149';
        const pctSign  = pctVsPm === null ? '?' : (pctVsPm >= 0 ? '+' : '') + pctVsPm.toFixed(2) + '%';

        if (title) title.textContent = `${icone} PREÇO MÉDIO ${par}`;

        body.innerHTML = `
            <div class="sim-pm-val" style="color:${acCor}">$${pm.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div class="sim-pm-row"><span class="sim-pm-key">● Strike Exercido</span><span class="sim-pm-v" style="color:var(--tblr-warning)">$${strikeExercida.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
            <div class="sim-pm-row"><span class="sim-pm-key">− Prêmios</span><span class="sim-pm-v" style="color:#3fb950">−$${totalPremios.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
            ${cot ? `<div class="sim-pm-row"><span class="sim-pm-key">● Cotação</span><span class="sim-pm-v" style="${pctColor}">$${cot.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>` : ''}
            ${pctVsPm !== null ? `<div class="sim-pm-row"><span class="sim-pm-key">● vs PM</span><span class="sim-pm-v" style="${pctColor}">${pctSign}</span></div>` : ''}
        `;
    }

    // ─── Risco da Operação ────────────────────────────────────────────────────
    function _renderNextOpCard(op, cotacao) {
        const body  = document.getElementById('macSimNextOpBody');
        if (!body) return;

        const strike = parseFloat(op.strike) || 0;
        const tipo   = (op.tipo || 'PUT').toUpperCase();

        if (!strike || !cotacao) {
            body.innerHTML = `<div class="sim-empty-state" style="min-height:60px">Dados insuficientes para análise de risco</div>`;
            return;
        }

        const dist = tipo === 'CALL'
            ? (cotacao - strike) / strike * 100
            : (strike - cotacao) / cotacao * 100;
        const absDist = Math.abs(dist);

        let riskClass, riskLabel, riskMsg;
        if (absDist < 1) {
            riskClass = 'danger'; riskLabel = '🔴 RISCO ALTO';
            riskMsg = 'Strike muito próximo da cotação. Exercício imediato possível.';
        } else if (absDist < 5) {
            riskClass = 'warn'; riskLabel = '🟡 RISCO MÉDIO';
            riskMsg = dist > 0
                ? 'Cotação favorável ao exercício. Monitorar de perto.'
                : 'Margem moderada de segurança. Atenção ao movimento.';
        } else {
            riskClass = 'safe'; riskLabel = '🟢 RISCO BAIXO';
            riskMsg = dist > 0
                ? 'Boa probabilidade de exercício — retorno em ' + (tipo === 'CALL' ? 'BTC' : 'USDT') + ' esperado.'
                : 'Baixa probabilidade de exercício — retorno em ' + (tipo === 'CALL' ? 'USDT' : 'BTC') + ' esperado.';
        }

        const distSign  = dist > 0 ? '+' : '';
        const distColor = riskClass === 'danger' ? '#f85149' : riskClass === 'warn' ? '#f59f00' : '#3fb950';

        body.innerHTML = `
            <div class="sim-zone ${riskClass}" style="margin-bottom:8px">
                <span style="font-weight:700;font-size:.75rem">${riskLabel}</span>
            </div>
            <div class="sim-pm-row">
                <span class="sim-pm-key">● Cotação</span>
                <span class="sim-pm-v">$${cotacao.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            </div>
            <div class="sim-pm-row">
                <span class="sim-pm-key">● Strike</span>
                <span class="sim-pm-v">$${strike.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            </div>
            <div class="sim-pm-row">
                <span class="sim-pm-key">● Distância</span>
                <span class="sim-pm-v" style="color:${distColor}">${distSign}${dist.toFixed(2)}%</span>
            </div>
            <div style="margin-top:7px;font-size:.68rem;color:var(--tblr-secondary)">${riskMsg}</div>
        `;
    }

    // ─── Card Retorno ao Vencimento ──────────────────────────────────────────
    function _renderPnLChart(op, cotacao) {
        const body = document.getElementById('macSimRetBody');
        if (!body) return;

        const data = calcRetornoVencimentoData(op, cotacao);
        if (!data) {
            body.innerHTML = '<div class="sim-empty-state" style="min-height:60px">Dados insuficientes para análise de retorno</div>';
            return;
        }

        const dist = data.favorDist;
        const probExercicio = calcPOP(data.tipo, data.cotacao, data.strike);
        const probTone = getProbabilityTone(probExercicio);
        const signedDist = (dist >= 0 ? '+' : '') + dist.toFixed(2) + '%';
        const diffAbs = (data.diffAbs >= 0 ? '+' : '-') + fmtUsd(Math.abs(data.diffAbs));
        const diffPctStrike = (data.diffPctStrike >= 0 ? '+' : '') + data.diffPctStrike.toFixed(2) + '%';
        const premioFmt = data.premio > 0 ? '+' + fmtUsd(data.premio) : '—';

        const segHtml = [0, 1, 2, 3].map(function (idx) {
            const active = idx <= data.zone.level;
            return `<span class="mac-ret-seg ${active ? 'active' : ''}"></span>`;
        }).join('');

        const barsHtml = [1, 2, 3, 4].map(function (idx) {
            const active = idx <= (data.zone.level + 1);
            return `<span class="mac-ret-risk-bar ${active ? 'active' : ''}"></span>`;
        }).join('');

        body.innerHTML = `
            <div class="mac-ret-card" style="--mac-ret-accent:${data.zone.accent};--mac-ret-prob-bg:${probTone.bg};--mac-ret-prob-border:${probTone.border}">
                <div class="mac-ret-top">
                    <div>
                        <div class="mac-ret-ticker">${data.ativo}</div>
                        <div class="mac-ret-sub">${data.tipo} · Resultado atual</div>
                    </div>
                    <div class="mac-ret-pill">
                        <span class="mac-ret-led"></span>
                        ${data.zone.pill}
                    </div>
                </div>

                <div class="mac-ret-segments">${segHtml}</div>

                <div class="mac-ret-pct-block">
                    <div class="mac-ret-pct">${signedDist}</div>
                    <div class="mac-ret-pct-lbl">Distância Favorável para Exercício</div>
                </div>

                <div class="mac-ret-divider"></div>

                <div class="mac-ret-metrics-lines">
                    <div class="mac-ret-metric-line">
                        <span><i class="mac-ret-dot mac-ret-dot-cot"></i>Cotação Atual</span>
                        <strong class="mac-ret-metric-cot">${fmtUsd(data.cotacao)}</strong>
                    </div>
                    <div class="mac-ret-metric-line">
                        <span><i class="mac-ret-dot mac-ret-dot-strike"></i>Strike</span>
                        <strong class="mac-ret-metric-strike">${fmtUsd(data.strike)}</strong>
                    </div>
                    <div class="mac-ret-metric-line">
                        <span><i class="mac-ret-dot mac-ret-dot-diff"></i>Diferença vs Strike</span>
                        <strong class="mac-ret-metric-diff">${diffPctStrike}</strong>
                    </div>
                    <div class="mac-ret-metric-line">
                        <span><i class="mac-ret-dot mac-ret-dot-premio"></i>Prêmio</span>
                        <strong class="mac-ret-metric-premio">${premioFmt}</strong>
                    </div>
                </div>

                <div class="mac-ret-risk">
                    <div class="mac-ret-risk-bars">${barsHtml}</div>
                    <div>
                        <div class="mac-ret-risk-title">${data.zone.riskTitle}</div>
                        <div class="mac-ret-risk-desc">${data.zone.riskDesc}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ─── Painel esquerdo: conteúdo de Detalhes ────────────────────────────────
    function _renderDetalhesPanel(op, cotacao) {
        const panel = document.getElementById('macDetalhesPanel');
        if (!panel) return;

        if (_macCountdownTimer) { clearInterval(_macCountdownTimer); _macCountdownTimer = null; }

        const dist     = op._liveDist !== undefined ? op._liveDist
            : (cotacao && op.strike
                ? ((op.tipo||'').toUpperCase() === 'CALL'
                    ? ((parseFloat(op.strike) - cotacao) / cotacao) * 100
                    : ((cotacao - parseFloat(op.strike)) / parseFloat(op.strike)) * 100)
                : op.distancia);
        const isClosed = (op.status || 'ABERTA') === 'FECHADA';
        const isLive   = !!cotacao;
        const distNum  = parseFloat(dist) || 0;
        const tae      = parseFloat(op.tae) || 0;
        const premio   = parseFloat(op.premio_us) || 0;
        const ativo    = (op.ativo || 'BTC').toUpperCase();
        const tipo     = (op.tipo || 'PUT').toUpperCase();
        const risk     = getRisk(distNum);

        const timePct       = calcTimePct(op.data_operacao, op.exercicio) || 0;
        const vcEnd         = getVencEnd(op.exercicio);
        const msLeft        = vcEnd ? Math.max(0, vcEnd - Date.now()) : 0;
        const startTs       = op.data_operacao ? new Date(op.data_operacao + 'T00:00:00').getTime() : null;
        const corridosDias  = startTs ? Math.max(0, Math.floor((Date.now() - startTs) / 86400000)) : '—';
        const restantesDias = vcEnd   ? Math.max(0, Math.ceil((vcEnd - Date.now()) / 86400000))    : '—';

        const tipoBadge = tipo === 'CALL'
            ? "<span class='badge crypto-badge-high ms-1'>▲ HIGH (CALL)</span>"
            : "<span class='badge crypto-badge-low ms-1'>▼ LOW (PUT)</span>";

        const isRed = distNum < 2, isAmb = distNum >= 2 && distNum < 5, isGrn = distNum >= 5;
        const semaforoHTML = `
<div class="mdc-semaforo">
  <div class="mdc-sema-dot" style="background:#e85d4a;box-shadow:${isRed?'0 0 10px #e85d4a':'none'};opacity:${isRed?'1':'0.2'}"></div>
  <div class="mdc-sema-dot" style="background:#f59f00;box-shadow:${isAmb?'0 0 10px #f59f00':'none'};opacity:${isAmb?'1':'0.2'}"></div>
  <div class="mdc-sema-dot" style="background:#47b96c;box-shadow:${isGrn?'0 0 10px #47b96c':'none'};opacity:${isGrn?'1':'0.2'}"></div>
</div>`;

        let c1emoji, c1label, c1val, c2emoji, c2label, c2val;
        const premioFmt = premio ? '+' + fmtUsd(premio) : (tae ? tae.toFixed(2) + '% aa' : '—');
        if (tipo === 'CALL') {
            c1emoji = '✅'; c1label = 'BTC fica abaixo do Strike';
            c1val   = premioFmt + ' de prêmio em USDT';
            c2emoji = '🔄'; c2label = 'BTC sobe acima do Strike';
            c2val   = 'Recebe USD ou vende pelo valor do strike';
        } else {
            c1emoji = '✅'; c1label = 'BTC permanece acima do Strike';
            c1val   = premioFmt + ' de prêmio em USDT';
            c2emoji = '🔄'; c2label = 'BTC cai abaixo do Strike';
            c2val   = 'Recebe BTC ao preço do strike (custo médio reduzido)';
        }

        const probLucro = op.pop != null ? op.pop + '%'
            : Math.min(95, Math.max(5, 50 + distNum * 3)).toFixed(0) + '% <small style="opacity:.6">(estimado)</small>';

        panel.innerHTML = `

<!-- Hero -->
<div class="mdc-hero" style="background:${risk.bg};border:1px solid ${risk.color}44">
  <div class="d-flex align-items-center gap-3">
    <div class="mdc-pulse-ring ${assetPulseClass(ativo)}">${ativo.slice(0,3)}</div>
    <div class="flex-grow-1" style="min-width:0">
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="mdc-hero-title" style="flex:1;min-width:0">${op.ativo || 'CRYPTO'}/USDT${tipoBadge}</div>
        <div class="d-flex align-items-center gap-2 flex-shrink-0">${semaforoHTML}</div>
      </div>
      <div class="mdc-hero-sub mt-1">${isClosed ? '🔒' : '🟢'} <b>${op.status || 'ABERTA'}</b></div>
      <div class="mdc-risk-label mt-1" style="color:${risk.color}">${risk.label}</div>
    </div>
  </div>
</div>

<!-- Cards financeiros -->
<div class="row g-2 mb-3">
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Investido</div><div class="mdc-card-value">${op.abertura ? fmtUsd(op.abertura) : '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Strike</div><div class="mdc-card-value">${op.strike ? fmtUsd(op.strike) : '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Cotação${isLive ? ' 🟢' : ''}</div><div class="mdc-card-value" id="macCardCotacao">${cotacao ? fmtUsd(cotacao) : '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">TAE</div><div class="mdc-card-value" style="color:#4da6ff">${tae ? tae.toFixed(2) + '%' : '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Prêmio</div><div class="mdc-card-value" style="color:#47b96c">${op.premio_us ? fmtUsd(op.premio_us) : '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Qtd Crypto</div><div class="mdc-card-value">${op.crypto ? parseFloat(op.crypto).toFixed(5) : '—'}</div></div></div>
</div>

<!-- Gauge + Progresso -->
<div class="row g-3 mb-3">
  <div class="col-5">
    <div class="mdc-section-box h-100">
      <div class="mdc-section-title">🎯 Distância do Strike</div>
      <div id="macGaugeArea">${buildGaugeSVG(dist, tipo)}</div>
      <div class="mdc-prob-row mt-2" id="macProbLucro">
        <span class="mdc-info-label">📐 Prob. Lucro</span>
        <span class="mdc-info-value" style="color:${distNum>=5?'#47b96c':distNum>=2?'#4da6ff':'#f59f00'}">${probLucro}</span>
      </div>
    </div>
  </div>
  <div class="col-7">
    <div class="mdc-section-box h-100">
      <div class="mdc-section-title">⏳ Progresso do Prazo</div>
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span style="font-size:.82rem;color:var(--tblr-secondary)">Tempo decorrido</span>
        <span class="badge" style="background:${risk.color}22;color:${risk.color};font-size:.8rem;font-weight:700">${timePct.toFixed(1)}%</span>
      </div>
      <div class="mdc-progress-track mb-1">
        <div class="mdc-progress-fill" style="width:${timePct.toFixed(2)}%;background:linear-gradient(90deg,${risk.color}99,${risk.color})"></div>
      </div>
      <div class="d-flex justify-content-between mb-3" style="font-size:.72rem;color:var(--tblr-secondary)">
        <span>📌 ${fmtDate(op.data_operacao)}</span>
        <span>🏁 ${fmtDate(op.exercicio)} <span style="color:#f59f00;font-weight:700">05:00 AM</span></span>
      </div>
      <div class="mdc-countdown-box" style="border-color:${risk.color}44">
        <div class="mdc-countdown-sub">${isClosed ? '⏸ Operação encerrada' : '⏰ Tempo restante até fechamento (05:00 AM)'}</div>
        <div class="mdc-countdown-value" id="macCountdown" style="color:${risk.color}">${isClosed ? '—' : formatCountdown(msLeft)}</div>
        <div class="mdc-countdown-dias">
          ${!isClosed ? `<span>${corridosDias} dias corridos</span>&nbsp;·&nbsp;<b style="color:${risk.color}">${restantesDias} dias restantes</b>` : ''}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Cenários -->
<div class="mdc-section-box mb-3">
  <div class="mdc-section-title">🔮 Cenários Possíveis na Data de Vencimento</div>
  <div class="row g-2">
    <div class="col-md-6">
      <div class="mdc-scenario mdc-scenario-good">
        <div class="mdc-scenario-icon">${c1emoji}</div>
        <div>
          <div class="mdc-scenario-title">${c1label}</div>
          <div class="mdc-scenario-val mdc-val-green">${c1val}</div>
        </div>
      </div>
    </div>
    <div class="col-md-6">
      <div class="mdc-scenario mdc-scenario-neutral">
        <div class="mdc-scenario-icon">${c2emoji}</div>
        <div>
          <div class="mdc-scenario-title">${c2label}</div>
          <div class="mdc-scenario-val mdc-val-orange">${c2val}</div>
        </div>
      </div>
    </div>
  </div>
</div>
${op.observacoes ? `<div class="mdc-info-row" style="flex-direction:column;align-items:flex-start;gap:4px"><span class="mdc-info-label">📝 Observações</span><span style="font-size:.84rem;color:var(--tblr-secondary);line-height:1.5">${op.observacoes}</span></div>` : ''}
`;

        // Countdown ticker
        if (!isClosed && vcEnd) {
            _macCountdownTimer = setInterval(function () {
                const msNow = Math.max(0, vcEnd - Date.now());
                const el    = document.getElementById('macCountdown');
                if (!el) { clearInterval(_macCountdownTimer); _macCountdownTimer = null; return; }
                el.textContent = formatCountdown(msNow);
                if (msNow <= 0) { clearInterval(_macCountdownTimer); _macCountdownTimer = null; }
            }, 1000);
        }
    }

    // ─── Buscar cotação ao vivo ───────────────────────────────────────────────
    async function _fetchLivePrice(op) {
        const sym = ((op.ativo || '') + 'USDT').replace(/USDTUSDT$/i, 'USDT');
        try {
            const r = await fetch((window.API_BASE || '') + '/api/proxy/crypto/' + sym, { cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();
            const rawPrice = d.price ?? d.lastPrice ?? d.last ?? d.c ?? d.close;
            if (!rawPrice) throw new Error('Preço não retornado');
            const price = parseFloat(rawPrice);
            op._livePrice    = price;
            op.cotacao_atual = price;
            // Recalcula distância
            const tipo   = (op.tipo || 'PUT').toUpperCase();
            const strike = parseFloat(op.strike) || 0;
            if (strike) {
                op._liveDist = tipo === 'CALL'
                    ? ((strike - price) / price) * 100
                    : ((price - strike) / strike) * 100;
            }
            return price;
        } catch (e) {
            console.warn('[ModalAnalise] Falha ao buscar cotação ao vivo:', e.message);
            return op._livePrice || parseFloat(op.cotacao_atual) || null;
        }
    }

    // ─── Renderiza todo o conteúdo do modal ───────────────────────────────────
    async function _renderAll(op) {
        const skeleton = document.getElementById('macBodySkeleton');
        const content  = document.getElementById('macBodyContent');

        if (skeleton) skeleton.style.display = '';
        if (content)  content.style.display  = 'none';

        const cotacao = await _fetchLivePrice(op);
        _updateTs();

        if (skeleton) skeleton.style.display = 'none';
        if (content)  content.style.display  = '';

        _renderDetalhesPanel(op, cotacao);
        _renderKPIs(op, cotacao);
        _renderPmCard(op, cotacao);
        _renderNextOpCard(op, cotacao);
        _renderPnLChart(op, cotacao);

        // Título do header
        const titleEl = document.getElementById('macTitle');
        if (titleEl) {
            const ativo = (op.ativo || 'CRYPTO').toUpperCase();
            const tipo  = (op.tipo  || '').toUpperCase();
            const bColor = tipo === 'CALL' ? '#206bc4' : '#ae3ec9';
            titleEl.innerHTML = `${ativo}/USDT — Análise <span class="badge ms-1" style="background:${bColor}22;color:${bColor};font-size:.7rem">${tipo}</span>`;
        }
    }

    // ─── Wire botão refresh ───────────────────────────────────────────────────
    function _wireRefresh(op) {
        const btn = document.getElementById('macBtnRefresh');
        if (!btn) return;

        // Remove listener antigo
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', async function () {
            this.classList.add('mdh-spin');
            this.disabled = true;
            const tsEl = document.getElementById('macLastUpdated');
            if (tsEl) tsEl.textContent = 'Atualizando...';

            try {
                // Re-render completo com skeleton para garantir atualização de todos os componentes.
                await _renderAll(op);
            } catch(e) {
                console.error('[macRefresh]', e);
                _updateTs();
            } finally {
                this.classList.remove('mdh-spin');
                this.disabled = false;
            }
        });
    }

    // ─── Template loader ─────────────────────────────────────────────────────
    function _ensureLoaded() {
        if (_loadPromise) return _loadPromise;
        _loadPromise = (async function () {
            if (document.getElementById(MODAL_ID)) return true;
            const container = document.getElementById(CONTAINER_ID);
            if (!container) return false;
            try {
                const r = await fetch(TEMPLATE_PATH + '?v=1.0.0', { cache: 'no-store' });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                container.innerHTML = await r.text();
                return !!document.getElementById(MODAL_ID);
            } catch (err) {
                console.error('[ModalAnalise] Falha ao carregar template', err);
                _loadPromise = null;
                return false;
            }
        }());
        return _loadPromise;
    }

    // ─── Ponto de entrada ────────────────────────────────────────────────────
    async function open(opId) {
        if (!opId) return;
        const ops = window.cryptoOperacoes || [];
        const op  = ops.find(o => String(o.id) === String(opId));
        if (!op) { console.warn('[ModalAnalise] Operação #' + opId + ' não encontrada'); return; }

        const loaded = await _ensureLoaded();
        if (!loaded) { console.error('[ModalAnalise] Falha ao carregar template'); return; }

        _wireRefresh(op);

        const modalEl = document.getElementById(MODAL_ID);
        modalEl.addEventListener('hidden.bs.modal', function () {
            if (_macCountdownTimer) { clearInterval(_macCountdownTimer); _macCountdownTimer = null; }
        }, { once: true });

        new bootstrap.Modal(modalEl).show();

        // Renderiza após o modal estar visível (evita bug de canvas com display:none)
        modalEl.addEventListener('shown.bs.modal', function () {
            _renderAll(op);
        }, { once: true });
    }

    window.ModalAnaliseCrypto = { open: open };

}());

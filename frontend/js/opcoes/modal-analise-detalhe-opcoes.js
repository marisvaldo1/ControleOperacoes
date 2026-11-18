/**
 * modal-analise-detalhe-opcoes.js  v1.0.0
 * Modal de Análise Completa da Operação de Opções (BRL)
 *
 * Adaptado de modal-analise-detalhe-crypto.js v1.0.0 para o domínio de opções
 * de ações/ETFs em BRL. Combina o painel de Detalhes (esquerda) com análise
 * completa (direita):
 *  - KPIs: Prêmio Total · ROI · Distância · Resultado
 *  - Card Previsão / POP com arco SVG
 *  - Card Resultado Atual (Retorno ao Vencimento)
 *  - Card Preço Médio do portfólio
 *  - Card Risco da Operação
 *
 * Fontes (sem APIs externas):
 *  - window.opcoesOperacoes | window.allOperacoes | evento 'opcoesDataUpdated'
 *  - Fallback de detalhe: GET /api/opcoes/<id>
 *  - Cotação: window.buscarCotacaoAtivo (de opcoes.js)
 *  - Preço médio: window.ModalPrecoMedioAtivoOpcoes.computeData (fallback local)
 *
 * Expõe: window.ModalAnaliseDetalheOpcoes = { open, close }
 */
(function () {
    'use strict';

    const MODAL_ID      = 'modalAnaliseCompleta';
    const CONTAINER_ID  = 'modalAnaliseCompletaContainer';
    const TEMPLATE_PATH = 'modal-analise-detalhe-opcoes.html';

    let _loadPromise       = null;
    let _macCountdownTimer = null;
    let _openPending       = null;

    // ─── Formatadores ────────────────────────────────────────────────────────

    function fmtBrl(v) {
        const n = parseF(v);
        if (typeof window.formatCurrency === 'function') {
            return window.formatCurrency(n, 'BRL');
        }
        return 'R$\u00a0' + n.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function parseF(v) {
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        if (!v) return 0;
        if (typeof window.parseFloatSafe === 'function') {
            const r = window.parseFloatSafe(v);
            return isFinite(r) ? r : 0;
        }
        const s = String(v).trim();
        if (s.includes(',') && s.includes('.')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        if (s.includes(',')) return parseFloat(s.replace(',', '.')) || 0;
        return parseFloat(s) || 0;
    }

    function fmtDate(s) {
        if (!s) return '—';
        const parts = String(s).split('T')[0].split('-');
        return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : s;
    }

    // ─── Tempo ───────────────────────────────────────────────────────────────
    // Vencimento de opções: fechamento BM&FBOVESPA às 18:00
    function getVencEnd(vencStr) {
        if (!vencStr) return null;
        const [y, m, d] = String(vencStr).split('T')[0].split('-').map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d, 18, 0, 0, 0).getTime();
    }

    function calcTimePct(dataOperacao, vencimento) {
        const start = dataOperacao ? new Date(String(dataOperacao).split('T')[0] + 'T00:00:00').getTime() : null;
        const end   = getVencEnd(vencimento);
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

    // ─── Risk level (binário: ITM/OTM) ───────────────────────────────────────
    function getRisk(distNum) {
        if (distNum < 0) return { color: '#e85d4a', bg: 'rgba(232,93,74,0.12)', label: 'ITM — EXERCÍCIO PROVÁVEL', level: 'danger' };
        return { color: '#47b96c', bg: 'rgba(71,185,108,0.12)', label: 'SEGURO — OTM', level: 'success' };
    }

    // ─── Anel pulsante por ativo base ────────────────────────────────────────
    function assetPulseClass(ativo) {
        const a = (ativo || '').toUpperCase();
        if (a.startsWith('PETR')) return 'mdo-pulse-petr';
        if (a.startsWith('VALE')) return 'mdo-pulse-vale';
        if (a.startsWith('ITUB')) return 'mdo-pulse-itub';
        if (a.startsWith('BBAS') || a.startsWith('BBDC')) return 'mdo-pulse-bbas';
        if (a.startsWith('ABEV')) return 'mdo-pulse-abev';
        if (a.startsWith('WEGE') || a.startsWith('EGIE')) return 'mdo-pulse-enrg';
        return 'mdo-pulse-default';
    }

    // ─── Distância (cotação vs strike) ───────────────────────────────────────
    // CALL OTM: spot < strike → dist = (strike - spot) / spot * 100 > 0 (seguro)
    // PUT  OTM: spot > strike → dist = (spot - strike) / strike * 100 > 0 (seguro)
    function calcDist(tipo, spot, strike) {
        const s = parseF(strike);
        const c = parseF(spot);
        if (!s || !c) return null;
        return (tipo || '').toUpperCase() === 'CALL'
            ? ((s - c) / c) * 100
            : ((c - s) / s) * 100;
    }

    // ─── Gauge SVG (arco semicircular com ponteiro) ──────────────────────────
    function buildGaugeSVG(distRaw, tipo) {
        const dist = parseF(distRaw);
        let zoneColor, zoneLabel, zoneEmoji;
        if (dist < 0) {
            zoneColor = '#e85d4a'; zoneLabel = 'ITM — Exercício Provável'; zoneEmoji = '🔴';
        } else if (dist < 2) {
            zoneColor = '#f59f00'; zoneLabel = 'Zona de Atenção'; zoneEmoji = '🟡';
        } else if (dist < 5) {
            zoneColor = '#4da6ff'; zoneLabel = 'Moderadamente Seguro'; zoneEmoji = '🔵';
        } else {
            zoneColor = '#47b96c'; zoneLabel = 'OTM — Seguro'; zoneEmoji = '🟢';
        }
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
        const dist = calcDist(tipo, cotacao, strike);
        if (dist === null) return null;
        return Math.max(5, Math.min(95, 50 + dist * 2.5));
    }

    // ─── Prêmio total (unitário × quantidade) ────────────────────────────────
    function premioTotalOf(op) {
        const premio = Math.abs(parseF(op.premio || op.preco_entrada));
        const qty    = Math.abs(parseInt(op.quantidade) || 0);
        return premio * qty;
    }

    function isVenda(op) {
        const tipoOperacao = String(op.tipo_operacao || '').toUpperCase();
        const qtd = parseInt(op.quantidade) || 0;
        return tipoOperacao === 'VENDA' || (!tipoOperacao && qtd < 0);
    }

    function calcRetornoVencimentoData(op, cotacao) {
        const strike = parseF(op.strike);
        const price  = parseF(cotacao);
        const premio = Math.abs(parseF(op.premio || op.preco_entrada));
        const tipo   = (op.tipo || 'PUT').toUpperCase();
        const ativo  = ((op.ativo_base || op.ativo || 'ATIVO').toUpperCase());

        if (!strike || !price) return null;

        const favorDist     = calcDist(tipo, price, strike);
        const diffAbs       = price - strike;
        const diffPctStrike = ((price - strike) / strike) * 100;

        let zone;
        if (favorDist < 0) {
            zone = { level: 0, accent: '#e85d4a', pill: 'Fora da Zona' };
        } else if (favorDist < 2) {
            zone = { level: 1, accent: '#f59f00', pill: 'Margem Curta' };
        } else if (favorDist < 5) {
            zone = { level: 2, accent: '#4da6ff', pill: 'Monitorar' };
        } else {
            zone = { level: 3, accent: '#47b96c', pill: 'Confortável' };
        }

        return {
            ativo: ativo || 'ATIVO',
            tipo,
            strike,
            cotacao: price,
            premio,
            favorDist,
            diffAbs,
            diffPctStrike,
            zone,
        };
    }

    function resolveExerciseDisplayStatus(op, cotacao) {
        const tipo = String(op?.tipo || '').toUpperCase();
        const strike = parseF(op?.strike);
        const current = parseF(cotacao);
        if (!(strike > 0) || !(current > 0)) return 'NAO';
        if (tipo === 'CALL') return current > strike ? 'SIM' : 'NAO';
        if (tipo === 'PUT') return current < strike ? 'SIM' : 'NAO';
        return 'NAO';
    }

    function getResultCardState(op, favorDist, cotacao) {
        const status = String(op?.status || 'ABERTA').trim().toUpperCase();
        const isClosed = status === 'FECHADA' || status === 'EXERCIDA' || status === 'ENCERRADA' || status === 'VENCIDA';
        const displayStatus = resolveExerciseDisplayStatus(op, cotacao);
        const nearBoundary = Number.isFinite(favorDist) ? Math.abs(favorDist) < 2 : false;

        if (isClosed) {
            if (displayStatus === 'SIM') {
                return {
                    isClosed, displayStatus, toneLevel: 'risk', accent: '#e85d4a',
                    probBg: 'rgba(232,93,74,0.14)', probBorder: 'rgba(232,93,74,0.38)',
                    pill: 'Fechada · Exercida', subLabel: 'Resultado consolidado',
                    metricLabel: 'Resultado Final de Exercício',
                    riskTitle: 'Exercício Confirmado',
                    riskDesc: 'Operação encerrada com exercício. Resultado já consolidado.',
                };
            }
            return {
                isClosed, displayStatus, toneLevel: 'safe', accent: '#47b96c',
                probBg: 'rgba(71,185,108,0.12)', probBorder: 'rgba(71,185,108,0.32)',
                pill: 'Fechada · Não Exercida', subLabel: 'Resultado consolidado',
                metricLabel: 'Resultado Final de Exercício',
                riskTitle: 'Sem Exercício',
                riskDesc: 'Operação encerrada sem exercício. Retorno consolidado em prêmio.',
            };
        }

        if (displayStatus === 'SIM') {
            return {
                isClosed, displayStatus, toneLevel: 'risk', accent: '#e85d4a',
                probBg: 'rgba(232,93,74,0.14)', probBorder: 'rgba(232,93,74,0.36)',
                pill: 'Exercício Provável', subLabel: 'Em andamento',
                metricLabel: 'Distância Favorável para Exercício',
                riskTitle: 'Atenção',
                riskDesc: 'Operação em zona favorável ao exercício no momento.',
            };
        }

        if (nearBoundary) {
            return {
                isClosed, displayStatus, toneLevel: 'neutral', accent: '#f59f00',
                probBg: 'rgba(245,159,0,0.12)', probBorder: 'rgba(245,159,0,0.32)',
                pill: 'Margem Curta', subLabel: 'Em andamento',
                metricLabel: 'Distância para Exercício',
                riskTitle: 'Atenção',
                riskDesc: 'Próximo ao strike. Pequeno movimento pode inverter cenário.',
            };
        }

        return {
            isClosed, displayStatus, toneLevel: 'safe', accent: '#47b96c',
            probBg: 'rgba(71,185,108,0.10)', probBorder: 'rgba(71,185,108,0.30)',
            pill: 'Sem Exercício Provável', subLabel: 'Em andamento',
            metricLabel: 'Distância para Exercício',
            riskTitle: 'Segurança',
            riskDesc: 'Distância saudável em relação ao strike para evitar exercício.',
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
            card.style.background = (typeof color === 'string' && color.startsWith('#')) ? color + '0d' : '';
        }
    }

    // ─── KPIs ─────────────────────────────────────────────────────────────────
    function _renderKPIs(op, cotacao) {
        const strike   = parseF(op.strike);
        const tipo     = (op.tipo || 'PUT').toUpperCase();
        const qty      = Math.abs(parseInt(op.quantidade) || 0);
        const premioUn = Math.abs(parseF(op.premio || op.preco_entrada));
        const premioTot = premioUn * qty;
        const colateral = strike > 0 && qty > 0 ? strike * qty : 0;
        const roi       = colateral > 0 && premioTot > 0 ? (premioTot / colateral) * 100 : 0;
        const distancia = (cotacao && strike) ? calcDist(tipo, cotacao, strike) : null;
        const resultado = parseF(op.resultado);

        // Prêmio Total — valor recebido/pago na operação
        _setKpiCard('macKpiPremioCard', 'macSimPremio',
            premioTot > 0 ? '+' + fmtBrl(premioTot) : '—',
            premioTot > 0 ? '#3fb950' : 'rgba(255,255,255,.3)');

        // ROI — verde se positivo
        _setKpiCard('macKpiRoiCard', 'macSimRoi',
            roi > 0 ? '+' + roi.toFixed(2) + '%' : '—',
            roi > 0 ? '#3fb950' : 'rgba(255,255,255,.3)');

        // Distância — semáforo: verde ≥5%, azul 2–5%, amarelo <2%, vermelho negativo
        const distColor = distancia === null ? 'rgba(255,255,255,.3)'
            : distancia >= 5 ? '#3fb950'
            : distancia >= 2 ? '#4da6ff'
            : distancia >= 0 ? '#f59f00'
            : '#f85149';
        _setKpiCard('macKpiDistCard', 'macSimDist',
            distancia !== null ? (distancia >= 0 ? '+' : '') + distancia.toFixed(2) + '%' : '—',
            distColor);

        // Resultado — verde se positivo, vermelho se negativo
        const hasResult = op.resultado !== null && op.resultado !== undefined && op.resultado !== '';
        const resColor  = !hasResult ? 'rgba(255,255,255,.3)' : resultado >= 0 ? '#3fb950' : '#f85149';
        _setKpiCard('macKpiResultCard', 'macSimResult',
            hasResult ? (resultado > 0 ? '+' : '') + fmtBrl(resultado) : '—',
            resColor);
    }

    // ─── Previsão / POP ───────────────────────────────────────────────────────
    function _renderPrevisao(op, cotacao) {
        const body  = document.getElementById('macSimPrevBody');
        const badge = document.getElementById('macSimPrevBadge');
        const strike = parseF(op.strike);
        const tipo   = (op.tipo || 'PUT').toUpperCase();
        const premio = Math.abs(parseF(op.premio || op.preco_entrada));
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
            badgeText = 'Improvável Exercício'; badgeColor = '#4da6ff'; badgeBg = 'rgba(77,166,255,.15)';
        }
        if (badge) {
            badge.textContent = badgeText;
            badge.style.cssText = `color:${badgeColor};background:${badgeBg};border:1px solid ${badgeColor};padding:2px 9px;border-radius:10px;font-size:.63rem;font-weight:700`;
        }

        const pMin = strike * 0.85, pMax = strike * 1.15;
        const markerPct = Math.max(2, Math.min(98, (cotacao - pMin) / (pMax - pMin) * 100));
        const barFillPct = Math.max(0, Math.min(100, (strike - pMin) / (pMax - pMin) * 100));

        const dist = calcDist(tipo, cotacao, strike) || 0;
        const distSign = dist > 0 ? '+' : '';

        let riskMsg, msgBg, msgColor;
        if (pop >= 65) {
            riskMsg = `✅ Cotação ${distSign}${dist.toFixed(2)}% do Strike — alta probabilidade de exercício`;
            msgBg = 'rgba(47,179,68,.10)'; msgColor = '#3fb950';
        } else if (pop >= 35) {
            riskMsg = `⚖️ Zona de indefinição — Cotação ${distSign}${dist.toFixed(2)}% do Strike`;
            msgBg = 'rgba(245,159,0,.10)'; msgColor = '#f59f00';
        } else {
            riskMsg = `💵 Cotação ${distSign}${dist.toFixed(2)}% do Strike — baixa probabilidade de exercício`;
            msgBg = 'rgba(77,166,255,.10)'; msgColor = '#4da6ff';
        }

        const fmt  = v => v ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
        const fmtK = v => v >= 1000 ? 'R$ ' + (v / 1000).toFixed(0) + 'k' : 'R$ ' + v.toFixed(0);

        // Break-even (à vista do titular): CALL = strike + prêmio; PUT = strike − prêmio
        const breakEven = tipo === 'CALL' ? strike + premio : strike - premio;

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
                        <span class="sim-prev-item-val" style="color:#4da6ff">R$ ${fmt(cotacao)}</span>
                    </div>
                    <div class="sim-prev-item">
                        <span class="sim-prev-item-dot" style="background:#f59f00"></span>
                        <span class="sim-prev-item-lbl">Strike</span>
                        <span class="sim-prev-item-val" style="color:#f59f00">R$ ${fmt(strike)}</span>
                    </div>
                    ${premio > 0 ? `<div class="sim-prev-item">
                        <span class="sim-prev-item-dot" style="background:#3fb950"></span>
                        <span class="sim-prev-item-lbl">Prêmio</span>
                        <span class="sim-prev-item-val" style="color:#3fb950">+R$ ${premio.toFixed(2)}</span>
                    </div>` : ''}
                    ${breakEven > 0 ? `<div class="sim-prev-item">
                        <span class="sim-prev-item-dot" style="background:rgba(255,255,255,.3)"></span>
                        <span class="sim-prev-item-lbl">Break-Even</span>
                        <span class="sim-prev-item-val">R$ ${fmt(breakEven)}</span>
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
    // Usa window.ModalPrecoMedioAtivoOpcoes.computeData quando disponível;
    // fallback: média ponderada de preco_entrada das posições ABERTA do ativo base.
    function _computePmData(ativoBase, cotacao) {
        const par = String(ativoBase || '').toUpperCase().trim();
        let pm = 0, entrada = 0, premios = 0;

        const mod = window.ModalPrecoMedioAtivoOpcoes;
        if (mod && typeof mod.computeData === 'function') {
            try {
                const d = mod.computeData(par);
                if (typeof d === 'number') {
                    pm = d; entrada = d;
                } else if (d) {
                    pm = parseF(d.pm || d.precoMedio || d.preco_medio || d.medio || d.preco || d.preco_medio_ativo);
                    entrada = parseF(d.ultimoExercicio || d.entrada || d.entradaPut || d.entrada_put || d.strikeEntrada) || pm;
                    premios = parseF(d.totalPremios || d.premiosAcumulados || d.premios_acumulados);
                    if (!premios && Array.isArray(d.premios)) {
                        premios = d.premios.reduce((s, p) => s + Math.abs(parseF(p && p.v)), 0);
                    }
                }
            } catch (e) { /* módulo ausente/erro → fallback */ }
        }

        if (!(pm > 0)) {
            const ops = (window.opcoesOperacoes || window.allOperacoes || []);
            let totQ = 0, tot = 0;
            ops.forEach(o => {
                if (String(o.ativo_base || o.ativo || '').toUpperCase() !== par) return;
                if (String(o.status || '').toUpperCase() !== 'ABERTA') return;
                const q = Math.abs(parseInt(o.quantidade) || 0);
                const p = parseF(o.preco_entrada);
                if (q > 0 && p > 0) { totQ += q; tot += p * q; }
            });
            if (totQ > 0) { pm = tot / totQ; entrada = pm; }
        }

        return { pm, ultimoExercicio: entrada || pm, totalPremios: premios, cotacao };
    }

    function _renderPmCard(op, cotacao) {
        const body  = document.getElementById('macSimPmBody');
        const title = document.getElementById('macSimPmCardTitle');
        if (!body) return;

        const par = (op.ativo_base || op.ativo || '').toUpperCase().replace('USDT', '').replace('/', '').trim();

        const d = _computePmData(par, cotacao);
        if (!d || !(d.pm > 0)) {
            body.innerHTML = `<div class="sim-empty-state" style="min-height:60px">Sem posição aberta para ${par}</div>`;
            if (title) title.textContent = `📊 Preço Médio ${par}`;
            return;
        }

        const pm = d.pm;
        const cot = d.cotacao || cotacao || 0;
        const strikeAtual = parseF(op.strike);
        const pctVsPm = cot && pm ? ((cot - pm) / pm) * 100 : null;
        const resultadoExercicio = strikeAtual && pm ? (strikeAtual - pm) : null;

        const acCor = '#4da6ff';
        const pctColor = pctVsPm === null ? '' : pctVsPm >= 0 ? 'color:#3fb950' : pctVsPm > -3 ? 'color:#f59f00' : 'color:#f85149';
        const pctSign  = pctVsPm === null ? '?' : (pctVsPm >= 0 ? '+' : '') + pctVsPm.toFixed(2) + '%';
        const resultadoColor = resultadoExercicio === null ? '' : resultadoExercicio > 0 ? 'color:#3fb950' : resultadoExercicio < 0 ? 'color:#f85149' : 'color:#c9d1d9';
        const resultadoSign = resultadoExercicio === null ? '—' : (resultadoExercicio > 0 ? '+' : '-') + fmtBrl(Math.abs(resultadoExercicio));

        if (title) title.textContent = `📊 PREÇO MÉDIO ${par}`;

        const pmLink = `<span class="mac-pm-link" style="color:${acCor};cursor:pointer;text-decoration:underline dotted ${acCor}80;text-underline-offset:4px;font-weight:700;font-size:1.4rem" role="button" tabindex="0">${fmtBrl(pm)}</span>`;

        body.innerHTML = `
            <div class="sim-pm-val">${pmLink}</div>
            <div class="sim-pm-row"><span class="sim-pm-key">● Entrada</span><span class="sim-pm-v" style="color:var(--tblr-warning)">${fmtBrl(d.ultimoExercicio)}</span></div>
            <div class="sim-pm-row"><span class="sim-pm-key">− Prêmios</span><span class="sim-pm-v" style="color:#3fb950">−${fmtBrl(d.totalPremios)}</span></div>
            ${cot ? `<div class="sim-pm-row"><span class="sim-pm-key">● Cotação</span><span class="sim-pm-v" style="${pctColor}">${fmtBrl(cot)}</span></div>` : ''}
            ${pctVsPm !== null ? `<div class="sim-pm-row"><span class="sim-pm-key">● vs PM</span><span class="sim-pm-v" style="${pctColor}">${pctSign}</span></div>` : ''}
            ${resultadoExercicio !== null ? `<div class="sim-pm-row"><span class="sim-pm-key">● Resultado se exercido</span><span class="sim-pm-v" style="${resultadoColor}">${resultadoSign}</span></div>` : ''}
        `;

        const link = body.querySelector('.mac-pm-link');
        if (link) {
            const openPm = function () {
                if (window.ModalPrecoMedioOpcoes && typeof window.ModalPrecoMedioOpcoes.open === 'function') {
                    window.ModalPrecoMedioOpcoes.open(par);
                }
            };
            link.addEventListener('click', openPm);
            link.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPm(); }
            });
        }
    }

    // ─── Risco da Operação ────────────────────────────────────────────────────
    function _renderNextOpCard(op, cotacao) {
        const body = document.getElementById('macSimNextOpBody');
        if (!body) return;

        const strike = parseF(op.strike);
        const tipo   = (op.tipo || 'PUT').toUpperCase();

        if (!strike || !cotacao) {
            body.innerHTML = `<div class="sim-empty-state" style="min-height:60px">Dados insuficientes para análise de risco</div>`;
            return;
        }

        const dist = calcDist(tipo, cotacao, strike) || 0;

        let riskClass, riskLabel, riskMsg;
        if (dist < 0) {
            riskClass = 'danger'; riskLabel = '🔴 RISCO ALTO';
            riskMsg = 'Operação ITM — exercício provável no momento.';
        } else if (dist < 2) {
            riskClass = 'warn'; riskLabel = '🟡 RISCO MÉDIO';
            riskMsg = 'Operação OTM mas próxima ao strike. Monitorar.';
        } else {
            riskClass = 'safe'; riskLabel = '🟢 RISCO BAIXO';
            riskMsg = 'Operação OTM — baixa probabilidade de exercício.';
        }

        const distSign  = dist > 0 ? '+' : '';
        const distColor = riskClass === 'danger' ? '#f85149' : riskClass === 'warn' ? '#f59f00' : '#3fb950';

        body.innerHTML = `
            <div class="sim-zone ${riskClass}" style="margin-bottom:8px">
                <span style="font-weight:700;font-size:.75rem">${riskLabel}</span>
            </div>
            <div class="sim-pm-row">
                <span class="sim-pm-key">● Cotação</span>
                <span class="sim-pm-v">${fmtBrl(cotacao)}</span>
            </div>
            <div class="sim-pm-row">
                <span class="sim-pm-key">● Strike</span>
                <span class="sim-pm-v">${fmtBrl(strike)}</span>
            </div>
            <div class="sim-pm-row">
                <span class="sim-pm-key">● Distância</span>
                <span class="sim-pm-v" style="color:${distColor}">${distSign}${dist.toFixed(2)}%</span>
            </div>
            <div style="margin-top:7px;font-size:.68rem;color:var(--tblr-secondary)">${riskMsg}</div>
        `;
    }

    // ─── Card Resultado Atual (Retorno ao Vencimento) ────────────────────────
    function _renderPnLChart(op, cotacao) {
        const body = document.getElementById('macSimRetBody');
        if (!body) return;

        const data = calcRetornoVencimentoData(op, cotacao);
        if (!data) {
            body.innerHTML = '<div class="sim-empty-state" style="min-height:60px">Dados insuficientes para análise de retorno</div>';
            return;
        }

        const dist = data.favorDist;
        const cardState = getResultCardState(op, dist, cotacao);
        const signedDist = (dist >= 0 ? '+' : '') + dist.toFixed(2) + '%';
        const diffPctStrike = (data.diffPctStrike >= 0 ? '+' : '') + data.diffPctStrike.toFixed(2) + '%';
        const premioFmt = data.premio > 0 ? '+' + fmtBrl(data.premio) : '—';

        const segHtml = [0, 1, 2, 3].map(function (idx) {
            const active = idx <= (cardState.toneLevel === 'risk' ? 3 : cardState.toneLevel === 'neutral' ? 2 : 1);
            return `<span class="mac-ret-seg ${active ? 'active' : ''}"></span>`;
        }).join('');

        const barsHtml = [1, 2, 3, 4].map(function (idx) {
            const active = idx <= (cardState.toneLevel === 'risk' ? 4 : cardState.toneLevel === 'neutral' ? 3 : 2);
            return `<span class="mac-ret-risk-bar ${active ? 'active' : ''}"></span>`;
        }).join('');

        body.innerHTML = `
            <div class="mac-ret-card ${cardState.isClosed ? 'mac-ret-card-closed' : 'mac-ret-card-open'} mac-ret-tone-${cardState.toneLevel}" style="--mac-ret-accent:${cardState.accent};--mac-ret-prob-bg:${cardState.probBg};--mac-ret-prob-border:${cardState.probBorder}">
                <div class="mac-ret-top">
                    <div>
                        <div class="mac-ret-ticker">${data.ativo}</div>
                        <div class="mac-ret-sub">${data.tipo} · ${cardState.subLabel}</div>
                    </div>
                    <div class="mac-ret-pill">
                        <span class="mac-ret-led"></span>
                        ${cardState.pill}
                    </div>
                </div>

                <div class="mac-ret-mode ${cardState.isClosed ? 'is-closed' : 'is-open'}">
                    ${cardState.isClosed ? 'Operação encerrada: leitura de resultado final' : 'Operação em andamento: leitura de cenário atual'}
                </div>

                <div class="mac-ret-segments">${segHtml}</div>

                <div class="mac-ret-pct-block">
                    <div class="mac-ret-pct">${signedDist}</div>
                    <div class="mac-ret-pct-lbl">${cardState.metricLabel}</div>
                </div>

                <div class="mac-ret-divider"></div>

                <div class="mac-ret-metrics-lines">
                    <div class="mac-ret-metric-line">
                        <span><i class="mac-ret-dot mac-ret-dot-cot"></i>Cotação Atual</span>
                        <strong class="mac-ret-metric-cot">${fmtBrl(data.cotacao)}</strong>
                    </div>
                    <div class="mac-ret-metric-line">
                        <span><i class="mac-ret-dot mac-ret-dot-strike"></i>Strike</span>
                        <strong class="mac-ret-metric-strike">${fmtBrl(data.strike)}</strong>
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
                        <div class="mac-ret-risk-title">${cardState.riskTitle}</div>
                        <div class="mac-ret-risk-desc">${cardState.riskDesc}</div>
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

        const tipo      = (op.tipo || 'PUT').toUpperCase();
        const ativoBase = (op.ativo_base || op.ativo || '').toUpperCase();
        const spot      = (cotacao !== null && cotacao !== undefined) ? cotacao : parseF(op.preco_atual);
        const strike    = parseF(op.strike);
        const dist      = op._liveDist !== undefined ? op._liveDist : calcDist(tipo, spot, strike);
        const isClosed  = !['ABERTA'].includes((op.status || 'ABERTA').toUpperCase());
        const isLive    = !!op._liveSpot;
        const distNum   = parseFloat(dist) || 0;
        const premio    = Math.abs(parseF(op.premio || op.preco_entrada));
        const quantidade = Math.abs(parseInt(op.quantidade) || 0);
        const resultado = parseF(op.resultado);
        const venda     = isVenda(op);

        const risk = getRisk(distNum);
        const timePct       = calcTimePct(op.data_operacao, op.vencimento) || 0;
        const vcEnd         = getVencEnd(op.vencimento);
        const msLeft        = vcEnd ? Math.max(0, vcEnd - Date.now()) : 0;
        const startTs       = op.data_operacao ? new Date(String(op.data_operacao).split('T')[0] + 'T00:00:00').getTime() : null;
        const corridosDias  = startTs ? Math.max(0, Math.floor((Date.now() - startTs) / 86400000)) : '—';
        const restantesDias = vcEnd   ? Math.max(0, Math.ceil((vcEnd - Date.now()) / 86400000))    : '—';

        const tipoBadge = tipo === 'CALL'
            ? "<span class='badge crypto-badge-high ms-1'>▲ CALL</span>"
            : "<span class='badge crypto-badge-low ms-1'>▼ PUT</span>";
        const opBadge = venda
            ? "<span class='badge ms-1' style='background:rgba(71,185,108,.15);color:#47b96c;border:1px solid rgba(71,185,108,.35)'>VENDA</span>"
            : "<span class='badge ms-1' style='background:rgba(77,166,255,.15);color:#4da6ff;border:1px solid rgba(77,166,255,.35)'>COMPRA</span>";

        // Semáforo de 3 dots (distância ao strike)
        const isRed = distNum < 2;
        const isAmb = distNum >= 2 && distNum < 5;
        const isGrn = distNum >= 5;
        const semaforoHTML = `
<div class="mdc-semaforo" title="Semáforo de Distância ao Strike · Atual: ${distNum.toFixed(1)}%">
  <div class="mdc-sema-dot" title="🔴 Perigo — distância < 2%: risco elevado de exercício" style="background:#e85d4a;box-shadow:${isRed ? '0 0 10px #e85d4a' : 'none'};opacity:${isRed ? '1' : '0.2'}"></div>
  <div class="mdc-sema-dot" title="🟡 Atenção — distância entre 2% e 5%: monitorar de perto" style="background:#f59f00;box-shadow:${isAmb ? '0 0 10px #f59f00' : 'none'};opacity:${isAmb ? '1' : '0.2'}"></div>
  <div class="mdc-sema-dot" title="🟢 Seguro — distância ≥ 5%: baixo risco de exercício" style="background:#47b96c;box-shadow:${isGrn ? '0 0 10px #47b96c' : 'none'};opacity:${isGrn ? '1' : '0.2'}"></div>
</div>`;

        const probLucro = op.pop != null ? op.pop + '%'
            : (dist !== null && dist !== undefined
                ? Math.min(95, Math.max(5, 50 + distNum * 3)).toFixed(0) + '% <small style="opacity:.6">(estimado)</small>'
                : '—');

        const premioTotal = premio * quantidade;
        const premioFmt   = premioTotal ? '+' + fmtBrl(premioTotal) : '—';
        let c1emoji, c1label, c1val, c2emoji, c2label, c2val;
        if (tipo === 'CALL') {
            if (venda) {
                c1emoji = '✅'; c1label = ativoBase + ' fica abaixo do Strike';
                c1val   = premioFmt + ' mantido como prêmio';
                c2emoji = '🔄'; c2label = ativoBase + ' sobe acima do Strike';
                c2val   = 'Obrigação de vender as ações ao preço do strike';
            } else {
                c1emoji = '✅'; c1label = ativoBase + ' sobe acima do Strike';
                c1val   = 'Direito de comprar ações ao preço do strike';
                c2emoji = '❌'; c2label = ativoBase + ' fica abaixo do Strike';
                c2val   = 'Perde o prêmio pago (' + fmtBrl(premioTotal) + ')';
            }
        } else { // PUT
            if (venda) {
                c1emoji = '✅'; c1label = ativoBase + ' permanece acima do Strike';
                c1val   = premioFmt + ' mantido como prêmio';
                c2emoji = '🔄'; c2label = ativoBase + ' cai abaixo do Strike';
                c2val   = 'Obrigação de comprar ação pelo strike';
            } else {
                c1emoji = '✅'; c1label = ativoBase + ' cai abaixo do Strike';
                c1val   = 'Direito de vender ações ao preço do strike';
                c2emoji = '❌'; c2label = ativoBase + ' permanece acima do Strike';
                c2val   = 'Perde o prêmio pago (' + fmtBrl(premioTotal) + ')';
            }
        }

        const resultadoColor = resultado >= 0 ? '#47b96c' : '#e85d4a';
        const hasResult = op.resultado !== null && op.resultado !== undefined && op.resultado !== '';
        const resultadoFmt = hasResult ? ((resultado >= 0 ? '+' : '') + fmtBrl(resultado)) : null;

        panel.innerHTML = `

<!-- Hero -->
<div class="mdc-hero" style="background:${risk.bg};border:1px solid ${risk.color}44">
  <div class="d-flex align-items-center gap-3">
    <div class="mdc-pulse-ring ${assetPulseClass(ativoBase)}">${ativoBase.slice(0, 4)}</div>
    <div class="flex-grow-1" style="min-width:0">
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="mdc-hero-title" style="flex:1;min-width:0">${op.ativo || ativoBase}${tipoBadge}${opBadge}</div>
        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          ${semaforoHTML}
        </div>
      </div>
      <div class="mdc-hero-sub mt-1">${isClosed ? '🔒' : '🟢'} <b>${op.status || 'ABERTA'}</b></div>
      <div class="mdc-risk-label mt-1" style="color:${risk.color}">${risk.label}</div>
    </div>
  </div>
</div>

<!-- Cards financeiros -->
<div class="row g-2 mb-3">
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Strike</div><div class="mdc-card-value">${strike ? fmtBrl(strike) : '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Cotação${isLive ? ' 🟢' : ''}</div><div class="mdc-card-value" id="macCardCotacao">${spot ? fmtBrl(spot) : '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Prêmio unit.</div><div class="mdc-card-value" style="color:#47b96c">${premio ? fmtBrl(premio) : '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Quantidade</div><div class="mdc-card-value">${quantidade || '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Total Prêmio</div><div class="mdc-card-value" style="color:#4da6ff">${premioTotal ? fmtBrl(premioTotal) : '—'}</div></div></div>
  <div class="col-4"><div class="mdc-card text-center"><div class="mdc-card-label">Resultado</div><div class="mdc-card-value" style="color:${hasResult ? resultadoColor : 'inherit'}">${resultadoFmt || '—'}</div></div></div>
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
        <span>🏁 ${fmtDate(op.vencimento)} <span style="color:#f59f00;font-weight:700">18:00</span></span>
      </div>
      <div class="mdc-countdown-box" style="border-color:${risk.color}44">
        <div class="mdc-countdown-sub">${isClosed ? '⏸ Operação encerrada' : '⏰ Tempo restante até o vencimento (18:00)'}</div>
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
        const ativoBase = (op.ativo_base || op.ativo || '').toUpperCase().trim();
        try {
            if (ativoBase && typeof window.buscarCotacaoAtivo === 'function') {
                const price = await window.buscarCotacaoAtivo(ativoBase);
                if (price) {
                    const p = parseF(price);
                    op._liveSpot    = p;
                    op.cotacao_atual = p;
                    const tipo   = (op.tipo || 'PUT').toUpperCase();
                    const strike = parseF(op.strike);
                    if (strike) op._liveDist = calcDist(tipo, p, strike);
                    return p;
                }
            }
        } catch (e) {
            console.warn('[ModalAnaliseOpcoes] Falha ao buscar cotação ao vivo:', e && e.message);
        }
        return op._liveSpot || parseF(op.preco_atual) || parseF(op.preco_entrada) || null;
    }

    // ─── Renderiza todo o conteúdo do modal ───────────────────────────────────
    async function _renderAll(op) {
        const cotacao = await _fetchLivePrice(op);
        _updateTs();

        _renderDetalhesPanel(op, cotacao);
        _renderKPIs(op, cotacao);
        _renderPrevisao(op, cotacao);
        _renderPmCard(op, cotacao);
        _renderNextOpCard(op, cotacao);
        _renderPnLChart(op, cotacao);

        // Título do header
        const titleEl = document.getElementById('macTitle');
        if (titleEl) {
            const ativo = (op.ativo || op.ativo_base || 'OPÇÃO').toUpperCase();
            const tipo  = (op.tipo  || '').toUpperCase();
            const bColor = tipo === 'CALL' ? '#206bc4' : '#ae3ec9';
            titleEl.innerHTML = `${ativo} — Análise <span class="badge ms-1" style="background:${bColor}22;color:${bColor};font-size:.7rem">${tipo}</span>`;
        }
    }

    // ─── Wire botão refresh ───────────────────────────────────────────────────
    function _wireRefresh(op) {
        const btn = document.getElementById('macBtnRefresh');
        if (!btn) return;

        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', async function () {
            this.classList.add('mdh-spin');
            this.disabled = true;
            const tsEl = document.getElementById('macLastUpdated');
            if (tsEl) tsEl.textContent = 'Atualizando...';

            try {
                await _renderAll(op);
            } catch (e) {
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
                console.error('[ModalAnaliseOpcoes] Falha ao carregar template', err);
                _loadPromise = null;
                return false;
            }
        }());
        return _loadPromise;
    }

    // ─── Ponto de entrada ────────────────────────────────────────────────────
    function _findOp(opId) {
        const ops = window.opcoesOperacoes || window.allOperacoes || [];
        return ops.find(o => String(o.id) === String(opId));
    }

    async function _fetchOpDetail(opId) {
        try {
            const base = window.API_BASE || '';
            const r = await fetch(base + '/api/opcoes/' + encodeURIComponent(opId), { cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } catch (e) {
            console.warn('[ModalAnaliseOpcoes] Falha ao obter detalhe da operação #' + opId, e && e.message);
            return null;
        }
    }

    async function open(opId) {
        if (!opId) return;
        if (_openPending === opId) return;
        _openPending = opId;
        try {
            let op = _findOp(opId);
            if (!op) op = await _fetchOpDetail(opId);
            if (!op) { console.warn('[ModalAnaliseOpcoes] Operação #' + opId + ' não encontrada'); return; }

            const loaded = await _ensureLoaded();
            if (!loaded) { console.error('[ModalAnaliseOpcoes] Falha ao carregar template'); return; }

            _wireRefresh(op);

            const modalEl = document.getElementById(MODAL_ID);
            modalEl.addEventListener('hidden.bs.modal', function () {
                if (_macCountdownTimer) { clearInterval(_macCountdownTimer); _macCountdownTimer = null; }
            }, { once: true });

            const existing = bootstrap.Modal.getInstance(modalEl);
            if (existing) existing.dispose();

            new bootstrap.Modal(modalEl).show();

            modalEl.addEventListener('shown.bs.modal', function () {
                _renderAll(op);
            }, { once: true });
        } finally {
            _openPending = null;
        }
    }

    function close() {
        const modalEl = document.getElementById(MODAL_ID);
        if (!modalEl) return;
        const inst = (window.bootstrap && bootstrap.Modal) ? bootstrap.Modal.getInstance(modalEl) : null;
        if (inst) inst.hide();
    }

    // ─── Auto-init ───────────────────────────────────────────────────────────
    function _init() {
        // Pré-carrega o template (o container #modalAnaliseCompletaContainer já
        // está presente no DOM de opcoes.html).
        _ensureLoaded();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init, { once: true });
    } else {
        _init();
    }

    // ─── Exposição pública ───────────────────────────────────────────────────
    window.ModalAnaliseDetalheOpcoes = { open: open, close: close };

}());

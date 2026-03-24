/**
 * modal-detalhe-crypto.js  v3.0.0
 * Modal de Detalhes da Operação Crypto — Com Anel Pulsante + Semáforo
 *
 * 7 Melhorias + Anel Pulsante + Semáforo Visual:
 *  1. Hero Header com anel pulsante por ativo e semáforo de 3 dots
 *  2. Cards principais com ícones grandes e fontes maiores
 *  3. Gauge SVG semicircular de distância ao strike (OTM/ITM)
 *  4. Progress bar de tempo real com contagem regressiva até 05:00 AM do vencimento
 *  5. Timeline visual Abertura → Hoje → Vencimento
 *  6. Cards de cenários possíveis (exercido vs não exercido)
 *  7. Painel de informações adicionais com layout limpo
 *
 * Usa: window.cryptoOperacoes, window.editOperacao (de crypto.js)
 * Expõe: window.ModalDetalheCrypto = { show, ensureLoaded }
 */
(function () {
    'use strict';

    const TEMPLATE_PATH = 'modal-detalhe-crypto.html';
    const CONTAINER_ID  = 'modalDetalheCryptoContainer';
    const MODAL_ID      = 'modalDetalhesCrypto';

    let _loadPromise    = null;
    let _countdownTimer = null;
    let _currentOpId    = null;
    let _buttonsWired   = false;

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

    // ─── Helpers de ativo (anel pulsante) ────────────────────────────────────
    function assetPulseClass(ativo) {
        const a = (ativo || '').toUpperCase();
        if (a === 'BTC') return 'mdc-pulse-btc';
        if (a === 'ETH') return 'mdc-pulse-eth';
        if (a === 'BNB') return 'mdc-pulse-bnb';
        if (a === 'SOL') return 'mdc-pulse-sol';
        return 'mdc-pulse-xrp';
    }

    // ─── Lógica de Tempo ─────────────────────────────────────────────────────
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

    // ─── Gauge SVG ───────────────────────────────────────────────────────────
    function buildGaugeSVG(distRaw, tipo) {
        const dist = parseFloat(distRaw) || 0;
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

    // ─── Risk level ──────────────────────────────────────────────────────────
    function getRisk(distNum) {
        if (distNum < 0)  return { color: '#e85d4a', bg: 'rgba(232,93,74,0.12)',   label: 'ITM — EXERCÍCIO PROVÁVEL',    level: 'danger'  };
        if (distNum < 2)  return { color: '#f59f00', bg: 'rgba(245,159,0,0.12)',   label: 'ATENÇÃO — PRÓXIMO DO STRIKE', level: 'warning' };
        if (distNum < 5)  return { color: '#4da6ff', bg: 'rgba(77,166,255,0.12)',  label: 'MODERADO — MONITORAR',        level: 'info'    };
        return              { color: '#47b96c', bg: 'rgba(71,185,108,0.12)', label: 'SEGURO — OTM CONFORTÁVEL',    level: 'success' };
    }

    // ─── Timestamp do header do modal ────────────────────────────────────────
    function _updateModalTs() {
        const el = document.getElementById('mdcLastUpdated');
        if (!el) return;
        const now = new Date();
        el.textContent = 'Atualizado: ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');
    }

    // ─── Skeleton de loading no corpo do modal ────────────────────────────────
    function _showBodySkeleton() {
        const body = document.getElementById('modalDetalhesBody');
        if (!body) return;
        const row6 = Array(6).fill('<div class="mdc-skel mdc-skel-card flex-fill"></div>').join('');
        body.innerHTML = `
<div class="mdc-skel mdc-skel-hero mb-2"></div>
<div class="d-flex gap-2 mb-3">${row6}</div>
<div class="d-flex gap-3 mb-3">
  <div class="mdc-skel flex-fill" style="height:190px"></div>
  <div class="mdc-skel flex-fill" style="height:190px"></div>
</div>
<div class="mdc-skel" style="height:70px"></div>`;
    }

    // ─── Wire botões do header (executado uma única vez após template carregado) ─
    function _wireButtons() {
        if (_buttonsWired) return;
        _buttonsWired = true;

        document.getElementById('mdcBtnRefresh')?.addEventListener('click', async function () {
            const id = _currentOpId;
            if (!id) return;
            this.classList.add('mdh-spin');
            this.disabled = true;
            const tsEl = document.getElementById('mdcLastUpdated');
            if (tsEl) tsEl.textContent = 'Atualizando...';

            // Skeleton apenas nos 3 campos dinâmicos — mantém altura da janela
            const cotEl   = document.getElementById('mdcCardCotacao');
            const gaugeEl = document.getElementById('mdcGaugeArea');
            const probEl  = document.getElementById('mdcProbLucro');
            const skelInline = '<span class="mdc-skel d-inline-block" style="width:70%;height:1em;border-radius:4px"></span>';
            const skelGauge  = '<div class="mdc-skel" style="height:130px;border-radius:8px"></div>';
            if (cotEl)   cotEl.innerHTML   = skelInline;
            if (gaugeEl) gaugeEl.innerHTML = skelGauge;
            if (probEl)  probEl.innerHTML  = skelInline;

            try {
                const ops = window.cryptoOperacoes || [];
                const op  = ops.find(o => String(o.id) === String(id));
                if (!op) throw new Error('Operação #' + id + ' não encontrada');
                const sym = ((op.ativo || '') + 'USDT').replace(/USDTUSDT$/i, 'USDT');
                const r   = await fetch((window.API_BASE || '') + '/api/proxy/crypto/' + sym, { cache: 'no-store' });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const d   = await r.json();
                const rawPrice = d.price ?? d.lastPrice ?? d.last ?? d.c ?? d.close;
                if (!rawPrice) throw new Error('Preço não retornado pela API');
                op._livePrice    = parseFloat(rawPrice);
                op.cotacao_atual = parseFloat(rawPrice);
                const tipo   = (op.tipo || '').toUpperCase();
                const strike = parseFloat(op.strike) || 0;
                if (strike) {
                    op._liveDist = tipo === 'CALL'
                        ? ((strike - op._livePrice) / op._livePrice) * 100
                        : ((op._livePrice - strike) / strike) * 100;
                }
                // Atualiza apenas os 3 campos dinâmicos
                const dist2    = op._liveDist !== undefined ? op._liveDist : op.distancia;
                const distNum2 = parseFloat(dist2) || 0;
                const probLucro2 = op.pop != null ? op.pop + '%'
                    : Math.min(95, Math.max(5, 50 + distNum2 * 3)).toFixed(0) + '% <small style="opacity:.6">(estimado)</small>';
                const isLive2 = true;
                if (cotEl)  cotEl.innerHTML  = fmtUsd(op._livePrice) 
                if (gaugeEl) gaugeEl.innerHTML = buildGaugeSVG(dist2, tipo);
                if (probEl)  probEl.innerHTML  =
                    `<span class="mdc-info-label">📐 Prob. Lucro</span>
                     <span class="mdc-info-value" style="color:${distNum2 >= 5 ? '#47b96c' : distNum2 >= 2 ? '#4da6ff' : '#f59f00'}">${probLucro2}</span>`;
                _updateModalTs();
            } catch (e) {
                console.error('[mdcRefresh]', e);
                // Restaura conteúdo sem re-render completo
                const ops = window.cryptoOperacoes || [];
                const op  = ops.find(o => String(o.id) === String(id));
                if (op) {
                    const dist2    = op._liveDist !== undefined ? op._liveDist : op.distancia;
                    const distNum2 = parseFloat(dist2) || 0;
                    const tipo2    = (op.tipo || '').toUpperCase();
                    const cotacao2 = op._livePrice || op.cotacao_atual;
                    const probLucro2 = op.pop != null ? op.pop + '%'
                        : Math.min(95, Math.max(5, 50 + distNum2 * 3)).toFixed(0) + '% <small style="opacity:.6">(estimado)</small>';
                    if (cotEl)  cotEl.textContent  = cotacao2 ? fmtUsd(cotacao2) : '—';
                    if (gaugeEl) gaugeEl.innerHTML = buildGaugeSVG(dist2, tipo2);
                    if (probEl)  probEl.innerHTML  =
                        `<span class="mdc-info-label">📐 Prob. Lucro</span>
                         <span class="mdc-info-value" style="color:${distNum2 >= 5 ? '#47b96c' : distNum2 >= 2 ? '#4da6ff' : '#f59f00'}">${probLucro2}</span>`;
                }
                _updateModalTs();
                const body = document.getElementById('modalDetalhesBody');
                if (body) {
                    const err = document.createElement('div');
                    err.className = 'alert alert-warning py-2 px-3 mt-2';
                    err.style.cssText = 'font-size:.8rem;border-radius:6px;position:sticky;top:0;z-index:1';
                    err.textContent = '⚠ Não foi possível atualizar: ' + e.message;
                    body.insertAdjacentElement('afterbegin', err);
                    setTimeout(() => err.remove(), 5000);
                }
            } finally {
                this.classList.remove('mdh-spin');
                this.disabled = false;
            }
        });

        document.getElementById('mdcBtnAnalise')?.addEventListener('click', function () {
            if (window.ModalAnalise) window.ModalAnalise.open();
        });
    }

    // ─── Template loader ─────────────────────────────────────────────────────
    function ensureLoaded() {
        if (_loadPromise) return _loadPromise;
        _loadPromise = (async function () {
            if (document.getElementById(MODAL_ID)) return true;
            const container = document.getElementById(CONTAINER_ID);
            if (!container) return false;
            try {
                const r = await fetch(TEMPLATE_PATH + '?v=3.1.0', { cache: 'no-store' });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                container.innerHTML = await r.text();
                return !!document.getElementById(MODAL_ID);
            } catch (err) {
                console.error('[ModalDetalheCrypto] Falha ao carregar template', err);
                _loadPromise = null;
                return false;
            }
        }());
        return _loadPromise;
    }

    // ─── Render content (sem re-abrir o modal) ──────────────────────────────────────────────────
    function _renderContent(op) {
        if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }

        const dist      = op._liveDist !== undefined ? op._liveDist : op.distancia;
        const cotacao   = op._livePrice || op.cotacao_atual;
        const isClosed  = (op.status || 'ABERTA') === 'FECHADA';
        const isLive    = !!op._livePrice;
        const distNum   = parseFloat(dist) || 0;
        const tae       = parseFloat(op.tae) || 0;
        const premio    = parseFloat(op.premio_us) || 0;
        const ativo     = (op.ativo || 'BTC').toUpperCase();

        const risk = getRisk(distNum);

        const timePct       = calcTimePct(op.data_operacao, op.exercicio) || 0;
        const vcEnd         = getVencEnd(op.exercicio);
        const msLeft        = vcEnd ? Math.max(0, vcEnd - Date.now()) : 0;
        const startTs       = op.data_operacao ? new Date(op.data_operacao + 'T00:00:00').getTime() : null;
        const corridosDias  = startTs ? Math.max(0, Math.floor((Date.now() - startTs) / 86400000)) : '—';
        const restantesDias = vcEnd   ? Math.max(0, Math.ceil((vcEnd - Date.now()) / 86400000))    : '—';

        const tipoBadge = (op.tipo || '').toUpperCase() === 'CALL'
            ? "<span class='badge crypto-badge-high ms-1'>▲ HIGH (CALL)</span>"
            : "<span class='badge crypto-badge-low ms-1'>▼ LOW (PUT)</span>";

        // Semáforo de 3 dots baseado na distância
        const isRed = distNum < 2;
        const isAmb = distNum >= 2 && distNum < 5;
        const isGrn = distNum >= 5;
        const semaforoHTML = `
<div class="mdc-semaforo">
  <div class="mdc-sema-dot" style="background:#e85d4a;box-shadow:${isRed ? '0 0 10px #e85d4a' : 'none'};opacity:${isRed ? '1' : '0.2'}"></div>
  <div class="mdc-sema-dot" style="background:#f59f00;box-shadow:${isAmb ? '0 0 10px #f59f00' : 'none'};opacity:${isAmb ? '1' : '0.2'}"></div>
  <div class="mdc-sema-dot" style="background:#47b96c;box-shadow:${isGrn ? '0 0 10px #47b96c' : 'none'};opacity:${isGrn ? '1' : '0.2'}"></div>
</div>`;

        // Cenários
        const tipo = (op.tipo || '').toUpperCase();
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

        const resultadoColor = (parseFloat(op.resultado) || 0) >= 0 ? '#47b96c' : '#e85d4a';
        const resultadoFmt   = op.resultado != null
            ? ((parseFloat(op.resultado) >= 0 ? '+' : '') + parseFloat(op.resultado).toFixed(2) + '%')
            : null;
        const exercidoBadge = op.exercicio_status === 'SIM'
            ? "<span class='badge bg-warning text-dark' style='font-size:0.7rem'>✅ SIM</span>"
            : "<span class='badge bg-secondary' style='font-size:0.7rem'>❌ NÃO</span>";
        const probLucro = op.pop != null ? op.pop + '%'
            : (dist !== null && dist !== undefined
                ? Math.min(95, Math.max(5, 50 + parseFloat(dist) * 3)).toFixed(0) + '% <small style="opacity:.6">(estimado)</small>'
                : '—');

        const html = `

<!-- ══════════ 1. HERO HEADER ══════════ -->
<div class="mdc-hero" style="background:${risk.bg};border:1px solid ${risk.color}44">
  <div class="d-flex align-items-center gap-3">
    <div class="mdc-pulse-ring ${assetPulseClass(ativo)}">${ativo.slice(0, 3)}</div>
    <div class="flex-grow-1" style="min-width:0">
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="mdc-hero-title" style="flex:1;min-width:0">${op.ativo || 'CRYPTO'}/USDT${tipoBadge}</div>
        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          <div style="text-align:right;line-height:1.3">
            <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:.05em;color:var(--tblr-secondary);margin-bottom:2px">🏁 Exercido</div>
            ${exercidoBadge}
          </div>
          ${semaforoHTML}
        </div>
      </div>
      <div class="mdc-hero-sub mt-1">
        ${isClosed ? '🔒' : '🟢'} <b>${op.status || 'ABERTA'}</b>
      </div>
      <div class="mdc-risk-label mt-1" style="color:${risk.color}">${risk.label}</div>
    </div>
  </div>
</div>

<!-- ══════════ 2. CARDS FINANCEIROS ══════════ -->
<div class="row g-2 mb-3">
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-label">Investido</div>
      <div class="mdc-card-value">${op.abertura ? fmtUsd(op.abertura) : '—'}</div>
    </div>
  </div>
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-label">Strike</div>
      <div class="mdc-card-value">${op.strike ? fmtUsd(op.strike) : '—'}</div>
    </div>
  </div>
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-label">TAE</div>
      <div class="mdc-card-value" style="color:#4da6ff">${tae ? tae.toFixed(2) + '%' : '—'}</div>
    </div>
  </div>
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-icon">💵${isLive ? "<sup><span class='badge bg-success' style='font-size:.45rem;padding:1px 3px'>LIVE</span></sup>" : ''}</div>
      <div class="mdc-card-label">Cotação</div>
      <div class="mdc-card-value" id="mdcCardCotacao">${cotacao ? fmtUsd(cotacao) : '—'}</div>
    </div>
  </div>
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-icon">💎</div>
      <div class="mdc-card-label">Prêmio</div>
      <div class="mdc-card-value" style="color:#47b96c">${op.premio_us ? fmtUsd(op.premio_us) : '—'}</div>
    </div>
  </div>
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-icon">🪙</div>
      <div class="mdc-card-label">Qtd Crypto</div>
      <div class="mdc-card-value">${op.crypto ? parseFloat(op.crypto).toFixed(5) : '—'}<br><small style="font-size:0.65rem;opacity:.6"></small></div>
    </div>
  </div>
</div>

<!-- ══════════ 3+4+5. GAUGE + PROGRESSO + TIMELINE ══════════ -->
<div class="row g-3 mb-3">
  <div class="col-md-5">
    <div class="mdc-section-box h-100">
      <div class="mdc-section-title">🎯 Distância do Strike</div>
      <div id="mdcGaugeArea">${buildGaugeSVG(dist, tipo)}</div>
      <div style="font-size:0.8rem;line-height:1rem">&nbsp;</div>
      <div class="mdc-prob-row mt-2" id="mdcProbLucro">
        <span class="mdc-info-label">📐 Prob. Lucro</span>
        <span class="mdc-info-value" style="color:${distNum >= 5 ? '#47b96c' : distNum >= 2 ? '#4da6ff' : '#f59f00'}">${probLucro}</span>
      </div>
    </div>
  </div>
  <div class="col-md-7">
    <div class="mdc-section-box h-100">
      <div class="mdc-section-title">⏳ Progresso do Prazo</div>
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span style="font-size:0.82rem;color:var(--tblr-secondary)">Tempo decorrido</span>
        <span id="mdcPctLabel" class="badge" style="background:${risk.color}22;color:${risk.color};font-size:0.8rem;font-weight:700">${timePct.toFixed(1)}%</span>
      </div>
      <div class="mdc-progress-track mb-1">
        <div class="mdc-progress-fill" id="mdcProgressBar"
          style="width:${timePct.toFixed(2)}%;background:linear-gradient(90deg,${risk.color}99,${risk.color});">
        </div>
      </div>
      <div class="d-flex justify-content-between mb-3" style="font-size:0.72rem;color:var(--tblr-secondary)">
        <span>📌 ${fmtDate(op.data_operacao)}</span>
        <span>🏁 ${fmtDate(op.exercicio)} <span style="color:#f59f00;font-weight:700">05:00 AM</span></span>
      </div>
      <div class="mdc-countdown-box" style="border-color:${risk.color}44">
        <div class="mdc-countdown-sub">${isClosed ? '⏸ Operação encerrada' : '⏰ Tempo restante até fechamento (05:00 AM)'}</div>
        <div class="mdc-countdown-value" id="mdcCountdown" style="color:${risk.color}">${isClosed ? '—' : formatCountdown(msLeft)}</div>
        <div class="mdc-countdown-dias" id="mdcDiasInfo">
          ${!isClosed ? `<span>${corridosDias} dias corridos</span>&nbsp;·&nbsp;<b style="color:${risk.color}">${restantesDias} dias restantes</b>` : ''}
        </div>
      </div>
      <div class="mdc-dotline mt-3">
        <div class="mdc-dotline-bar">
          <div class="mdc-dotline-fill" style="width:${Math.min(timePct, 100).toFixed(1)}%;background:${risk.color}"></div>
        </div>
        <div class="mdc-dotline-labels">
          <span>📌 Abertura</span>
          <span style="color:${risk.color}">▼ Agora</span>
          <span>🏁 Venc.</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ══════════ 6. CENÁRIOS ══════════ -->
<div class="row g-2 mb-3">
  <div class="col-12">
    <div class="mdc-section-box">
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
  </div>
</div>

${op.observacoes ? `
<div class="mdc-info-row" style="flex-direction:column;align-items:flex-start;gap:4px;margin-top:8px">
  <span class="mdc-info-label">📝 Observações</span>
  <span style="font-size:0.84rem;color:var(--tblr-secondary);line-height:1.5">${op.observacoes}</span>
</div>` : ''}
`;

        document.getElementById('modalDetalhesBody').innerHTML = html;
        document.getElementById('modalDetalhesTitle').innerHTML =
            '<span style="color:var(--tblr-warning);margin-right:6px">₿</span>' +
            (op.ativo || 'CRYPTO') + '/USDT';

        if (!isClosed && vcEnd) {
            _countdownTimer = setInterval(function () {
                const msNow  = Math.max(0, vcEnd - Date.now());
                const pctNow = calcTimePct(op.data_operacao, op.exercicio) || 0;
                const cdEl   = document.getElementById('mdcCountdown');
                const pbEl   = document.getElementById('mdcProgressBar');
                const pctEl  = document.getElementById('mdcPctLabel');
                if (!cdEl) { clearInterval(_countdownTimer); _countdownTimer = null; return; }
                cdEl.textContent = formatCountdown(msNow);
                if (pbEl)  pbEl.style.width  = pctNow.toFixed(3) + '%';
                if (pctEl) pctEl.textContent = pctNow.toFixed(1) + '%';
                if (msNow <= 0) { clearInterval(_countdownTimer); _countdownTimer = null; }
            }, 1000);
        }

    }

    // ─── show() principal ──────────────────────────────────────────────────────────────────────────
    async function show(id) {
        const ops = window.cryptoOperacoes || [];
        const op  = ops.find(o => o.id === id);
        if (!op) return;
        _currentOpId = id;

        const loaded = await ensureLoaded();
        if (!loaded) return;

        _wireButtons();
        _renderContent(op);
        _updateModalTs();

        const modalEl = document.getElementById(MODAL_ID);
        modalEl.addEventListener('hidden.bs.modal', function () {
            if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
            _currentOpId = null;
        }, { once: true });

        new bootstrap.Modal(modalEl).show();
    }

    window.ModalDetalheCrypto = { show: show, ensureLoaded: ensureLoaded };

    // Badge do ativo abre esta janela (7-melhorias)
    window.showDetalhesOperacao = function (id) { show(id); };

}());
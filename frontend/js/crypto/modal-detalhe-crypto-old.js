/**
 * modal-detalhe-crypto.js  v2.0.0
 * Modal de Detalhes da Operação Crypto — Redesign Profissional
 *
 * 7 Melhorias implementadas:
 *  1. Hero Header com semáforo de risco visual
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

    // ─── Lógica de Tempo ─────────────────────────────────────────────────────

    /** Retorna o timestamp de fechamento: exercicio às 05:00 AM local */
    function getVencEnd(exercicioStr) {
        if (!exercicioStr) return null;
        const [y, m, d] = exercicioStr.split('-').map(Number);
        return new Date(y, m - 1, d, 5, 0, 0, 0).getTime();
    }

    /** Porcentagem do tempo decorrido de data_operacao 00:00 até exercicio 05:00 AM */
    function calcTimePct(dataOperacao, exercicio) {
        const start = dataOperacao ? new Date(dataOperacao + 'T00:00:00').getTime() : null;
        const end   = getVencEnd(exercicio);
        if (!start || !end) return null;
        const total = end - start;
        if (total <= 0) return 100;
        return Math.max(0, Math.min(100, ((Date.now() - start) / total) * 100));
    }

    /** Formata milissegundos em "Xd HH:MM:SS" ou "HH:MM:SS" */
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

    /** Gera SVG semicircular de distância ao strike */
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

        // Arco de 200° a 340°, total 140°
        const cx = 100, cy = 100, r = 78;
        const START_DEG = 200, END_DEG = 340, ARC = 140;
        const RANGE = 20; // ±20% mapeado ao arco

        function toRad(deg) { return deg * Math.PI / 180; }
        function pt(deg) {
            return { x: cx + r * Math.cos(toRad(deg)), y: cy + r * Math.sin(toRad(deg)) };
        }

        const clamped    = Math.max(-RANGE, Math.min(RANGE, dist));
        const needleDeg  = START_DEG + ((clamped + RANGE) / (2 * RANGE)) * ARC;
        const np         = pt(needleDeg);

        // Faixas de cor (background arco)
        function arcSegment(a1, a2, color) {
            const p1 = pt(a1), p2 = pt(a2);
            const large = (a2 - a1) > 180 ? 1 : 0;
            return `<path d="M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}"
                stroke="${color}" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.32"/>`;
        }

        return `
<svg viewBox="0 0 200 115" xmlns="http://www.w3.org/2000/svg" class="mdc-gauge-svg">
  ${arcSegment(200, 223, '#e85d4a')}
  ${arcSegment(223, 252, '#f59f00')}
  ${arcSegment(252, 288, '#4da6ff')}
  ${arcSegment(288, 340, '#47b96c')}
  <!-- trilho transparente -->
  <path d="M ${pt(200).x.toFixed(2)} ${pt(200).y.toFixed(2)} A ${r} ${r} 0 0 1 ${pt(340).x.toFixed(2)} ${pt(340).y.toFixed(2)}"
    stroke="rgba(255,255,255,0.06)" stroke-width="12" fill="none" stroke-linecap="round"/>
  <!-- agulha -->
  <line x1="${cx}" y1="${cy}" x2="${np.x.toFixed(2)}" y2="${np.y.toFixed(2)}"
    stroke="${zoneColor}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="7" fill="${zoneColor}" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy}" r="3" fill="#fff"/>
  <!-- valor central -->
  <text x="${cx}" y="${cy - 15}" text-anchor="middle" font-size="9.5" fill="rgba(255,255,255,0.5)" font-family="monospace">DISTÂNCIA</text>
  <text x="${cx}" y="${cy +  2}" text-anchor="middle" font-size="15" font-weight="bold" fill="${zoneColor}" font-family="monospace">${dist >= 0 ? '+' : ''}${dist.toFixed(2)}%</text>
  <!-- labels extremos -->
  <text x="13"  y="112" text-anchor="middle" font-size="8.5" fill="#e85d4a" font-family="monospace">ITM</text>
  <text x="187" y="112" text-anchor="middle" font-size="8.5" fill="#47b96c" font-family="monospace">OTM</text>
</svg>
<div class="mdc-gauge-label" style="color:${zoneColor}">${zoneEmoji}&nbsp;${zoneLabel}</div>`;
    }

    // ─── Risk level ─────────────────────────────────────────────────────────
    function getRisk(distNum) {
        if (distNum < 0)  return { color: '#e85d4a', bg: 'rgba(232,93,74,0.12)',    label: 'ITM — EXERCÍCIO PROVÁVEL',    emoji: '🔴', level: 'danger'  };
        if (distNum < 2)  return { color: '#f59f00', bg: 'rgba(245,159,0,0.12)',    label: 'ATENÇÃO — PRÓXIMO DO STRIKE', emoji: '🟡', level: 'warning' };
        if (distNum < 5)  return { color: '#4da6ff', bg: 'rgba(77,166,255,0.12)',   label: 'MODERADO — MONITORAR',        emoji: '🔵', level: 'info'    };
        return              { color: '#47b96c', bg: 'rgba(71,185,108,0.12)',  label: 'SEGURO — OTM CONFORTÁVEL',    emoji: '🟢', level: 'success' };
    }

    // ─── Template loader ─────────────────────────────────────────────────────
    function ensureLoaded() {
        if (_loadPromise) return _loadPromise;
        _loadPromise = (async function () {
            if (document.getElementById(MODAL_ID)) return true;
            const container = document.getElementById(CONTAINER_ID);
            if (!container) return false;
            try {
                const r = await fetch(TEMPLATE_PATH + '?v=2.0.0', { cache: 'no-store' });
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

    // ─── show() principal ────────────────────────────────────────────────────
    async function show(id) {
        const ops = window.cryptoOperacoes || [];
        const op  = ops.find(o => o.id === id);
        if (!op) return;

        const loaded = await ensureLoaded();
        if (!loaded) return;

        // Para timer anterior se existir
        if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }

        // Valores base
        const dist      = op._liveDist !== undefined ? op._liveDist : op.distancia;
        const cotacao   = op._livePrice || op.cotacao_atual;
        const isClosed  = (op.status || 'ABERTA') === 'FECHADA';
        const isLive    = !!op._livePrice;
        const distNum   = parseFloat(dist) || 0;
        const tae       = parseFloat(op.tae) || 0;
        const investido = parseFloat(op.abertura) || 0;
        const premio    = parseFloat(op.premio_us) || 0;

        // Risco
        const risk = getRisk(distNum);

        // Tempo
        const timePct  = calcTimePct(op.data_operacao, op.exercicio) || 0;
        const vcEnd    = getVencEnd(op.exercicio);
        const msLeft   = vcEnd ? Math.max(0, vcEnd - Date.now()) : 0;

        // Dias corridos e restantes
        const startTs      = op.data_operacao ? new Date(op.data_operacao + 'T00:00:00').getTime() : null;
        const corridosDias = startTs ? Math.max(0, Math.floor((Date.now() - startTs) / 86400000)) : '—';
        const restantesDias = vcEnd   ? Math.max(0, Math.ceil((vcEnd - Date.now()) / 86400000)) : '—';

        // Badges
        const tipoBadge = (op.tipo || '').toUpperCase() === 'CALL'
            ? "<span class='badge crypto-badge-high ms-1'>▲ HIGH (CALL)</span>"
            : "<span class='badge crypto-badge-low ms-1'>▼ LOW (PUT)</span>";

        // Cenários
        const tipo = (op.tipo || '').toUpperCase();
        let c1emoji, c1label, c1val, c2emoji, c2label, c2val;
        const premioFmt = premio ? '+' + fmtUsd(premio) : (tae ? tae.toFixed(2) + '% aa' : '—');
        if (tipo === 'CALL') {
            c1emoji = '✅'; c1label = 'BTC fica abaixo do Strike';
            c1val   = premioFmt + ' de prêmio em USDT';
            c2emoji = '🔄'; c2label = 'BTC sobe acima do Strike';
            c2val   = 'Recebe em USD ou vende BTC ao preço do strike';
        } else {
            c1emoji = '✅'; c1label = 'BTC permanece acima do Strike';
            c1val   = premioFmt + ' de prêmio em USDT';
            c2emoji = '🔄'; c2label = 'BTC cai abaixo do Strike';
            c2val   = 'Recebe BTC ao preço do strike (custo médio reduzido)';
        }

        // ── HTML ──────────────────────────────────────────────────────────────
        const html = `

<!-- ══════════ 1. HERO HEADER ══════════ -->
<div class="mdc-hero" style="background:${risk.bg};border:1px solid ${risk.color}44">
  <div class="d-flex align-items-start justify-content-between flex-wrap gap-2">
    <div>
      <div class="mdc-hero-title">${op.ativo || 'CRYPTO'}/USDT${tipoBadge}</div>
      <div class="mdc-hero-sub">
        ${isClosed ? '🔒' : '🟢'} <b>${op.status || 'ABERTA'}</b>
        &nbsp;·&nbsp; 📌 Abertura: <b>${fmtDate(op.data_operacao)}</b>
        &nbsp;·&nbsp; 🏁 Venc: <b>${fmtDate(op.exercicio)} <span style="color:#f59f00">05:00</span></b>
        &nbsp;·&nbsp; 🆔 #${op.id}
      </div>
    </div>
    <div class="text-end">
      <div class="mdc-risk-emoji">${risk.emoji}</div>
      <div class="mdc-risk-label" style="color:${risk.color}">${risk.label}</div>
    </div>
  </div>
</div>

<!-- ══════════ 2. CARDS FINANCEIROS ══════════ -->
<div class="row g-2 mb-3">
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-icon">💰</div>
      <div class="mdc-card-label">Investido</div>
      <div class="mdc-card-value">${op.abertura ? fmtUsd(op.abertura) : '—'}</div>
    </div>
  </div>
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-icon">🎯</div>
      <div class="mdc-card-label">Strike</div>
      <div class="mdc-card-value">${op.strike ? fmtUsd(op.strike) : '—'}</div>
    </div>
  </div>
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-icon">📈</div>
      <div class="mdc-card-label">TAE</div>
      <div class="mdc-card-value" style="color:#4da6ff">${tae ? tae.toFixed(2) + '%' : '—'}</div>
    </div>
  </div>
  <div class="col-4 col-md-2">
    <div class="mdc-card text-center">
      <div class="mdc-card-icon">💵${isLive ? "<sup><span class='badge bg-success' style='font-size:.45rem;padding:1px 3px'>LIVE</span></sup>" : ''}</div>
      <div class="mdc-card-label">Cotação</div>
      <div class="mdc-card-value">${cotacao ? fmtUsd(cotacao) : '—'}</div>
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
      <div class="mdc-card-value">${op.crypto ? parseFloat(op.crypto).toFixed(5) : '—'}<br><small style="font-size:0.65rem;opacity:.6">${op.ativo || ''}</small></div>
    </div>
  </div>
</div>

<!-- ══════════ 3+4+5. GAUGE + PROGRESSO + TIMELINE ══════════ -->
<div class="row g-3 mb-3">

  <!-- Gauge Distância -->
  <div class="col-md-5">
    <div class="mdc-section-box h-100">
      <div class="mdc-section-title">🎯 Distância do Strike</div>
      ${buildGaugeSVG(dist, tipo)}
      <div class="d-flex justify-content-between px-1 mt-2" style="font-size:0.8rem">
        <span class="text-muted">Strike:&nbsp;<b style="color:var(--tblr-body-color)">${op.strike ? fmtUsd(op.strike) : '—'}</b></span>
        <span class="text-muted">Atual:&nbsp;<b style="color:var(--tblr-body-color)">${cotacao ? fmtUsd(cotacao) : '—'}</b></span>
      </div>
    </div>
  </div>

  <!-- Progress + Countdown -->
  <div class="col-md-7">
    <div class="mdc-section-box h-100">
      <div class="mdc-section-title">⏳ Progresso do Prazo</div>

      <!-- Barra de progresso com animação -->
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

      <!-- Contagem Regressiva -->
      <div class="mdc-countdown-box" style="border-color:${risk.color}44">
        <div class="mdc-countdown-sub">${isClosed ? '⏸ Operação encerrada' : '⏰ Tempo restante até fechamento (05:00 AM)'}</div>
        <div class="mdc-countdown-value" id="mdcCountdown" style="color:${risk.color}">${isClosed ? '—' : formatCountdown(msLeft)}</div>
        <div class="mdc-countdown-dias" id="mdcDiasInfo">
          ${!isClosed ? `<span>${corridosDias} dias corridos</span>&nbsp;·&nbsp;<b style="color:${risk.color}">${restantesDias} dias restantes</b>` : ''}
        </div>
      </div>

      <!-- Mini Timeline pontinhos -->
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

<!-- ══════════ 7. INFO EXTRA ══════════ -->
<div class="row g-2">
  <div class="col-md-6">
    <div class="mdc-info-row">
      <span class="mdc-info-label">🏷️ Estratégia</span>
      <span class="mdc-info-value">${op.tipo_estrategia || 'DUAL_INVESTMENT'}</span>
    </div>
    <div class="mdc-info-row">
      <span class="mdc-info-label">📅 Prazo Total</span>
      <span class="mdc-info-value">${op.prazo ? op.prazo + ' dias' : (op.dias ? op.dias + ' dias' : '—')}</span>
    </div>
    <div class="mdc-info-row">
      <span class="mdc-info-label">🏁 Exercido</span>
      <span class="mdc-info-value">${op.exercicio_status === 'SIM'
        ? "<span class='badge bg-warning text-dark'>✅ SIM</span>"
        : "<span class='badge bg-secondary'>❌ NÃO</span>"}</span>
    </div>
  </div>
  <div class="col-md-6">
    <div class="mdc-info-row">
      <span class="mdc-info-label">📊 Resultado</span>
      <span class="mdc-info-value" style="color:${(parseFloat(op.resultado) || 0) >= 0 ? '#47b96c' : '#e85d4a'};font-weight:700">
        ${op.resultado != null ? ((parseFloat(op.resultado) >= 0 ? '+' : '') + parseFloat(op.resultado).toFixed(2) + '%') : '—'}
      </span>
    </div>
    <div class="mdc-info-row">
      <span class="mdc-info-label">🔢 ID Operação</span>
      <span class="mdc-info-value">#${op.id}</span>
    </div>
    <div class="mdc-info-row">
      <span class="mdc-info-label">📐 Prob Lucro</span>
      <span class="mdc-info-value">${op.pop != null ? op.pop + '%' : (dist !== null && dist !== undefined ? (Math.min(95, Math.max(5, 50 + parseFloat(dist) * 3)).toFixed(0) + '% <small style="opacity:.6">(estimado)</small>') : '—')}</span>
    </div>
  </div>
  ${op.observacoes ? `
  <div class="col-12">
    <div class="mdc-info-row" style="flex-direction:column;align-items:flex-start;gap:6px">
      <span class="mdc-info-label">📝 Observações</span>
      <span style="font-size:0.88rem;color:var(--tblr-secondary);line-height:1.5">${op.observacoes}</span>
    </div>
  </div>` : ''}
</div>`;

        // Injeta HTML
        document.getElementById('modalDetalhesBody').innerHTML = html;
        document.getElementById('modalDetalhesTitle').innerHTML =
            '<span style="color:var(--tblr-warning);margin-right:6px">₿</span>' +
            (op.ativo || 'CRYPTO') + '/USDT &mdash; #' + op.id;
        document.getElementById('modalDetalhesEditBtn').onclick = function () {
            bootstrap.Modal.getInstance(document.getElementById(MODAL_ID)).hide();
            setTimeout(() => { if (typeof window.editOperacao === 'function') window.editOperacao(id); }, 350);
        };

        // ── Timer de countdown (atualiza a cada segundo) ──────────────────────
        if (!isClosed && vcEnd) {
            _countdownTimer = setInterval(function () {
                const msNow  = Math.max(0, vcEnd - Date.now());
                const pctNow = calcTimePct(op.data_operacao, op.exercicio) || 0;

                const cdEl  = document.getElementById('mdcCountdown');
                const pbEl  = document.getElementById('mdcProgressBar');
                const pctEl = document.getElementById('mdcPctLabel');

                if (!cdEl) { clearInterval(_countdownTimer); _countdownTimer = null; return; }

                cdEl.textContent = formatCountdown(msNow);
                if (pbEl)  pbEl.style.width  = pctNow.toFixed(3) + '%';
                if (pctEl) pctEl.textContent = pctNow.toFixed(1) + '%';

                if (msNow <= 0) { clearInterval(_countdownTimer); _countdownTimer = null; }
            }, 1000);
        }

        // Para timer quando o modal fecha
        const modalEl = document.getElementById(MODAL_ID);
        modalEl.addEventListener('hidden.bs.modal', function () {
            if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
        }, { once: true });

        new bootstrap.Modal(modalEl).show();
    }

    window.ModalDetalheCrypto = { show: show, ensureLoaded: ensureLoaded };

    // Retrocompatibilidade
    window.showDetalhes = function (id) { show(id); };

}());


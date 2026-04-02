/**
 * Modal Resultados Crypto — Dashboard Analítico v7
 * Layout: metric-gauge row (7 semi-gauges + totals)
 *         → chart grande + painel resumo analítico
 *         → grid 3 cols op cards
 *         → closed footer (accordion)
 */
(function () {
    'use strict';

    /* ── Configuração ── */
    const cfg = {
        triggerBtnId:  'btnResultadosCrypto',
        containerElId: 'modalResultadosCryptoCompactContainer',
        modalElId:     'modalResultadosCryptoCompact',
        templatePath:  '../components/modals/crypto/modal-resultados-crypto-compact.html',
        getOperacoes:  () => Array.isArray(window.cryptoOperacoes) ? window.cryptoOperacoes : []
    };

    let _loaded  = false;
    let _period  = 'all';
    let _statusF = null;
    let _tipoF   = null;
    let _assetF  = null; // filtro de ativo (BTC, ETH, etc.)
    let _bsModal = null;
    let _charts  = {};
    let _selIdx  = 0;   // índice da operação selecionada para o gauge row

    /* ─────────────────────────────
       Formatadores
    ───────────────────────────── */
    const fmtUsd = v => {
        if (v == null || isNaN(Number(v))) return '—';
        const n = Number(v);
        const s = Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
        return (n < 0 ? '-' : '') + '$' + s;
    };
    // fmtK agora aponta para fmtUsd — mostra valor completo
    const fmtK = v => fmtUsd(v);
    const pp   = v => (Number(v) >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';
    const fmtDate = s => {
        if (!s) return '—';
        try { return new Date(s.split('T')[0]+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}); }
        catch { return s; }
    };

    const colDist  = d => d < 2 ? 'var(--dsh-red)' : d < 5 ? 'var(--dsh-amber)' : 'var(--dsh-green)';
    const colDelta = d => d >= 0 ? 'var(--dsh-green)' : 'var(--dsh-red)';
    const assetColor = a => a === 'BTC' ? 'var(--dsh-amber)' : a === 'ETH' ? 'var(--dsh-blue)' : 'var(--dsh-purple)';

    const getAsset = ativo => {
        const a = (ativo || '').toUpperCase();
        return a.split('/')[0].replace(/USDT$/, '').trim() || '?';
    };

    const getValorInvestido = op => {
        const abr = parseFloat(op.abertura)      || 0;
        const cot = parseFloat(op.cotacao_atual)  || 0;
        const qty = parseFloat(op.crypto)         || 0;
        if (abr <= 0) return 0;
        return (cot > 0 && abr < cot * 0.1) ? abr : abr * qty;
    };

    /* ─────────────────────────────
       Filtros
    ───────────────────────────── */
    const inPeriod = (op, p) => {
        if (!p || p === 'all') return true;
        const d = op.data_operacao || op.criado_em || '';
        if (!d) return true;
        const dt  = new Date(d.split('T')[0] + 'T00:00:00');
        const now = new Date(); now.setHours(0,0,0,0);
        if (p === 'today') return dt >= now;
        if (p === '7d')  { const t = new Date(now); t.setDate(t.getDate()-7);  return dt >= t; }
        if (p === '30d') { const t = new Date(now); t.setDate(t.getDate()-30); return dt >= t; }
        if (p === 'mes') { const t = new Date(now.getFullYear(), now.getMonth(), 1); return dt >= t; }
        if (p === 'ano') { const t = new Date(now.getFullYear(), 0, 1); return dt >= t; }
        return true;
    };
    const filterOps = ops => ops.filter(op => {
        if (!inPeriod(op, _period)) return false;
        if (_statusF && (op.status||'').toLowerCase() !== _statusF.toLowerCase()) return false;
        if (_tipoF   && (op.tipo||'').toUpperCase()   !== _tipoF.toUpperCase())   return false;
        if (_assetF  && getAsset(op.ativo)            !== _assetF)                return false;
        return true;
    });
    // Gráfico: filtra por período + ativo selecionado (ignora status/tipo)
    const filterForChart = ops => ops.filter(op =>
        inPeriod(op, _period) && (!_assetF || getAsset(op.ativo) === _assetF)
    );

    /* ─────────────────────────────
       Badges
    ───────────────────────────── */
    function typeBadge(tipo, isOpen) {
        if (!isOpen) return `<span class="dsh-badge db-cl">${tipo}</span>`;
        return (tipo||'').toUpperCase() === 'CALL'
            ? `<span class="dsh-badge db-call">CALL</span>`
            : `<span class="dsh-badge db-put">PUT</span>`;
    }
    function exBadge(ex, isOpen) {
        if (!isOpen) return `<span class="dsh-badge db-cl">${ex}</span>`;
        return (ex||'').toUpperCase() === 'SIM'
            ? `<span class="dsh-badge db-itm">ITM</span>`
            : `<span class="dsh-badge db-otm">OTM</span>`;
    }

    /* ─────────────────────────────
       Semi-gauge SVG
    ───────────────────────────── */
    function sg(pct, col, val, lbl, size=90) {
        pct = Math.max(0, Math.min(pct, 1));
        const r = size * .42, cx = size / 2, cy = size * .62;
        const c = Math.PI * r, off = c * (1 - pct);
        return `<svg width="${size}" height="${(size*.65).toFixed(0)}" viewBox="0 0 ${size} ${(size*.65).toFixed(0)}" style="display:block;margin:0 auto;overflow:visible;">
            <path d="M${(cx-r).toFixed(1)},${cy} A${r},${r} 0 0,1 ${(cx+r).toFixed(1)},${cy}" fill="none" stroke="#263347" stroke-width="6" stroke-linecap="round"/>
            <path d="M${(cx-r).toFixed(1)},${cy} A${r},${r} 0 0,1 ${(cx+r).toFixed(1)},${cy}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>
            <text x="${cx}" y="${(cy-3).toFixed(0)}" text-anchor="middle"
              font-family="JetBrains Mono,monospace" font-size="11" font-weight="700" fill="${col}">${val}</text>
          </svg>
          <div class="dsh-mg-lbl">${lbl}</div>`;
    }

    /* ─────────────────────────────
       Metric-gauge row (7 gauges + totals)
    ───────────────────────────── */
    function mgRow(op, allOps) {
        if (!op) return `<div style="padding:1.2rem;font-family:var(--dsh-mono);font-size:.80rem;color:var(--dsh-tx2);">Selecione uma operação acima.</div>`;

        const cotacao  = parseFloat(op.cotacao_atual) || 0;
        const abertura = parseFloat(op.abertura)      || 0;
        const strike   = parseFloat(op.strike)        || 0;
        const dist     = parseFloat(op.distancia)     || 0;
        const premU    = parseFloat(op.premio_us)     || 0;
        const premPct  = parseFloat(op.premio_pct)    || 0;
        const tipo     = (op.tipo||'').toUpperCase();
        const asset    = getAsset(op.ativo);
        const ac       = assetColor(asset);
        const am       = asset === 'BTC' ? 100000 : 5000;

        const delta    = abertura > 0 ? cotacao - abertura : 0;
        const dPct     = abertura > 0 ? (delta / abertura) * 100 : 0;
        const dCol     = colDelta(delta);
        const exData   = fmtDate(op.data_vencimento || op.data_operacao || op.criado_em);
        const exStr    = (op.exercicio_status || (op.exercido === true || op.exercido === 'SIM' ? 'SIM' : 'NÃO')).toUpperCase();

        const open   = allOps.filter(o => (o.status||'').toUpperCase() === 'ABERTA');
        const closed = allOps.filter(o => (o.status||'').toUpperCase() !== 'ABERTA');
        const tp     = allOps.reduce((a,o) => a + (parseFloat(o.premio_us)||0), 0);
        const exQty  = allOps.filter(o => (o.exercicio_status||'').toUpperCase() === 'SIM' || o.exercido === true || o.exercido === 'SIM').length;

        const cells = [
            { p: Math.min(cotacao  / am, 1),        c: ac,                    v: fmtUsd(cotacao),                       l: 'Cotação Atual',  s: asset },
            { p: Math.min(abertura / am, 1),        c: 'var(--dsh-tx2)',      v: fmtUsd(abertura),                      l: 'Abertura Op.',   s: tipo + ' · ' + exData },
            { p: Math.min(Math.abs(dPct)/25, 1),    c: dCol,                  v: (delta>=0?'+':'') + fmtUsd(delta),     l: 'Δ Cot. vs Ab.',  s: pp(dPct) },
            { p: Math.min(strike   / am, 1),        c: 'var(--dsh-amber)',    v: fmtUsd(strike),                        l: 'Strike',         s: tipo },
            { p: Math.min(dist     / 20, 1),        c: colDist(dist),         v: dist.toFixed(2) + '%',                 l: 'Dist. OTM',      s: dist < 2 ? 'RISCO' : dist < 5 ? 'ATENÇÃO' : 'SEGURO' },
            { p: Math.min(premU    / 25, 1),        c: 'var(--dsh-amber)',    v: fmtUsd(premU),                         l: 'Prêmio Rec.',    s: premPct.toFixed(3) + '%' },
            { p: Math.min(premPct  / 1.5, 1),       c: 'var(--dsh-purple)',   v: premPct.toFixed(3) + '%',              l: '% do Prêmio',    s: exStr === 'SIM' ? 'EXERCIDO' : 'SEGURO' },
        ];

        const cellsHtml = cells.map(cc => `
            <div class="dsh-mg-cell">
              ${sg(cc.p, cc.c, cc.v, cc.l, 90)}
              <div class="dsh-mg-sub" style="color:${cc.c === 'var(--dsh-tx2)' ? 'var(--dsh-tx2)' : cc.c};">${cc.s}</div>
            </div>`).join('');

        return `<div class="dsh-mg-row cols-8">
          ${cellsHtml}
          <div class="dsh-mg-cell dsh-mg-text">
            <div class="dsh-mg-plbl">Prêmio Total</div>
            <div class="dsh-mg-pval">${fmtUsd(tp)}</div>
            <div class="dsh-mg-psub">${open.length}A · ${closed.length}F<br>${exQty} exercício${exQty!==1?'s':''}</div>
          </div>
        </div>`;
    }

    /* ─────────────────────────────
       Op card
    ───────────────────────────── */
    function opCard(op) {
        const asset    = getAsset(op.ativo);
        const ac       = assetColor(asset);
        const isOpen   = (op.status||'').toUpperCase() === 'ABERTA';
        const cotacao  = parseFloat(op.cotacao_atual) || 0;
        const abertura = parseFloat(op.abertura)      || 0;
        const strike   = parseFloat(op.strike)        || 0;
        const dist     = parseFloat(op.distancia)     || 0;
        const premU    = parseFloat(op.premio_us)     || 0;
        const prazo    = parseInt(op.prazo)            || 0;
        const corridos = parseInt(op.dias)             || 0;
        const tipo     = (op.tipo||'').toUpperCase();
        const exData   = fmtDate(op.data_vencimento || op.data_operacao || op.criado_em);
        const exStr    = (op.exercicio_status || (op.exercido === true || op.exercido === 'SIM' ? 'SIM' : 'NÃO')).toUpperCase();
        const isItm    = exStr === 'SIM';

        const dias  = Math.max(prazo - corridos, 0);
        const bw    = prazo > 0 ? Math.min(Math.round((corridos/prazo)*100), 100) : 0;
        const dc    = dias === 0 ? 'var(--dsh-red)' : dias === 1 ? 'var(--dsh-amber)' : 'var(--dsh-green)';

        const delta = abertura > 0 && cotacao > 0 ? cotacao - abertura : 0;
        const dPct  = delta !== 0 && abertura > 0 ? (delta/abertura)*100 : 0;

        return `<div class="dsh-op-card ${isItm ? 'itm' : 'otm'}">
          <div class="dsh-oc-head">
            <span class="dsh-oc-asset" style="color:${ac};">${asset}</span>
            ${typeBadge(tipo, isOpen)}
            ${exBadge(exStr, isOpen)}
            <span class="dsh-oc-date">${exData}</span>
          </div>
          <div class="dsh-oc-row"><span class="dsh-oc-k">Cotação</span><span class="dsh-oc-v" style="color:${ac};">${fmtUsd(cotacao)}</span></div>
          <div class="dsh-oc-row"><span class="dsh-oc-k">Abertura</span><span class="dsh-oc-v" style="color:var(--dsh-tx2);">${cotacao>0&&abertura>0?fmtUsd(abertura):'—'}</span></div>
          ${delta!==0?`<div class="dsh-oc-row"><span class="dsh-oc-k">Δ Ab→Cot</span><span class="dsh-oc-v" style="color:${colDelta(delta)};">${pp(dPct)}</span></div>`:''}
          <div class="dsh-oc-row"><span class="dsh-oc-k">Strike</span><span class="dsh-oc-v" style="color:var(--dsh-amber);">${fmtUsd(strike)}</span></div>
          <div class="dsh-oc-row"><span class="dsh-oc-k">Dist. OTM</span><span class="dsh-oc-v" style="color:${colDist(dist)};">${dist.toFixed(2)}%</span></div>
          <div class="dsh-oc-row"><span class="dsh-oc-k">Prêmio</span><span class="dsh-oc-v" style="color:var(--dsh-amber);">${fmtUsd(premU)}</span></div>
          ${prazo>0?`<div class="dsh-oc-days">
            <div class="dsh-oc-days-top"><span>Prazo ${prazo}d</span><span style="color:${dc};">${dias}d rest.</span></div>
            <div class="dsh-oc-days-bar"><div class="dsh-oc-days-fill" style="width:${bw}%;background:${dc};"></div></div>
          </div>`:''}
        </div>`;
    }

    /* ─────────────────────────────
       Prob bar
    ───────────────────────────── */
    function probBar(op) {
        if (!op) return '';
        const dist   = parseFloat(op.distancia) || 0;
        const strike = parseFloat(op.strike)    || 0;
        const premU  = parseFloat(op.premio_us) || 0;
        const pop = Math.max(0, Math.min(100, Math.round(40 + dist * 4)));
        const col = pop >= 70 ? 'var(--dsh-green)' : pop >= 50 ? 'var(--dsh-amber)' : 'var(--dsh-red)';
        return `<div class="dsh-prob">
          <div class="dsh-prob-head">
            <span class="dsh-prob-lbl">Probabilidade de Lucro Total</span>
            <span class="dsh-prob-pct" style="color:${col};">${pop}%</span>
          </div>
          <div class="dsh-prob-track"><div class="dsh-prob-fill" style="width:${pop}%;background:${col};"></div></div>
          <div class="dsh-prob-foot">
            <span>0%</span>
            <span>Break: ${fmtUsd(strike + premU)}</span>
            <span>Strike: ${fmtUsd(strike)}</span>
            <span>100%</span>
          </div>
        </div>`;
    }

    /* ─────────────────────────────
       Loading skeleton
    ───────────────────────────── */
    function showLoading() {
        const bodyEl = document.getElementById('dshBody');
        if (!bodyEl) return;
        const sk = h => '<div class="dsh-skeleton" style="height:' + h + ';"></div>';
        bodyEl.innerHTML =
            sk('108px') +
            '<div style="display:grid;grid-template-columns:1fr 260px;gap:.6rem;margin:.55rem 0;">' +
            sk('200px') + sk('200px') +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;">' +
            sk('160px') + sk('160px') + sk('160px') +
            '</div>';
    }

    /* ─────────────────────────────
       Closed footer — accordion Bootstrap collapse
    ───────────────────────────── */
    function closedFoot(closed) {
        if (!closed.length) return '';
        const gridHtml = closed.map(op => `<div class="dsh-cf-item">
              <span class="dsh-cf-asset" style="color:${assetColor(getAsset(op.ativo))};">${getAsset(op.ativo)}</span>
              ${typeBadge(op.tipo, false)}
              <span style="font-family:var(--dsh-mono);font-size:.72rem;color:var(--dsh-tx2);">${fmtDate(op.data_vencimento||op.data_operacao||op.criado_em)}</span>
              <span class="dsh-cf-val">${fmtUsd(op.premio_us)}</span>
            </div>`).join('');
        return `<div class="dsh-closed" style="margin-top:.55rem;">
          <button class="dsh-closed-toggle" type="button"
            data-bs-toggle="collapse" data-bs-target="#dshClosedBody"
            aria-expanded="false" aria-controls="dshClosedBody">
            <span>Fechadas (${closed.length})</span>
            <svg class="dsh-toggle-caret" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div id="dshClosedBody" class="collapse">
            <div class="dsh-closed-grid" style="margin-top:.4rem;">
              ${gridHtml}
            </div>
          </div>
        </div>`;
    }

    /* ─────────────────────────────
       Chart (line)
    ───────────────────────────── */
    function buildChart(ops) {
        if (_charts.line) { try { _charts.line.destroy(); } catch(e) {} }
        const el = document.getElementById('dshChartLine');
        if (!el || typeof Chart === 'undefined') return;

        // Agrupa prêmio por data de vencimento
        const dm = {};
        ops.forEach(op => {
            const d = fmtDate(op.data_vencimento || op.data_operacao || op.criado_em);
            if (!dm[d]) dm[d] = 0;
            dm[d] += parseFloat(op.premio_us) || 0;
        });
        const labs = Object.keys(dm).sort();
        const daily = labs.map(l => +dm[l].toFixed(2));

        // Calcula acumulado progressivo
        let sum = 0;
        const accumulated = daily.map(v => +(sum += v).toFixed(2));

        _charts.line = new Chart(el, {
            type: 'bar',
            data: {
                labels: labs,
                datasets: [
                    {
                        // Linha de acumulado (eixo esquerdo — valor maior)
                        type: 'line',
                        label: 'Acumulado',
                        data: accumulated,
                        borderColor: '#e8a830',
                        backgroundColor: 'rgba(232,168,48,.12)',
                        borderWidth: 2.5,
                        pointBackgroundColor: '#e8a830',
                        pointRadius: 4, pointHoverRadius: 6,
                        fill: true, tension: .32,
                        yAxisID: 'yAcc',
                        order: 1,
                    },
                    {
                        // Barras de prêmio diário (eixo direito — valor menor)
                        type: 'bar',
                        label: 'Prêmio do dia',
                        data: daily,
                        backgroundColor: 'rgba(77,166,255,0.45)',
                        borderColor: 'rgba(77,166,255,0.75)',
                        borderWidth: 1,
                        borderRadius: 3,
                        yAxisID: 'yDay',
                        order: 2,
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: { color: '#6b82a0', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10, padding: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => (ctx.dataset.label === 'Acumulado' ? 'Total: $' : 'Dia:   $') + ctx.raw.toFixed(2)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#6b82a0', font: { family: 'JetBrains Mono', size: 11 }, maxRotation: 0 }
                    },
                    yAcc: {
                        type: 'linear',
                        position: 'left',
                        grid: { color: 'rgba(38,51,71,.8)' },
                        ticks: { color: '#e8a830', font: { family: 'JetBrains Mono', size: 11 }, callback: v => '$' + v.toFixed(1) }
                    },
                    yDay: {
                        type: 'linear',
                        position: 'right',
                        grid: { display: false },
                        ticks: { color: 'rgba(77,166,255,0.7)', font: { family: 'JetBrains Mono', size: 10 }, callback: v => '$' + v.toFixed(1) }
                    }
                }
            }
        });
    }

    /* ─────────────────────────────
       Op tabs row — abertas como tabs, fechadas como select
    ───────────────────────────── */
    function buildTabs(ops) {
        const el = document.getElementById('dshOpRow');
        if (!el) return;
        const open   = ops.filter(o => (o.status||'').toUpperCase() === 'ABERTA');
        const closed = ops.filter(o => (o.status||'').toUpperCase() !== 'ABERTA');
        const tp     = ops.reduce((a,o) => a + (parseFloat(o.premio_us)||0), 0);

        const tabsHtml = open.map((op, idx) => {
            const sel = idx === _selIdx ? ' sel' : '';
            return `<div class="dsh-op-tab${sel}" data-dsh-idx="${idx}">
              <div class="dsh-ot-t">${op.tipo||'—'}</div>
              <div class="dsh-ot-a">${getAsset(op.ativo)}</div>
              <div class="dsh-ot-d">${fmtDate(op.data_vencimento||op.data_operacao||op.criado_em)}</div>
            </div>`;
        }).join('');

        let closedHtml = '';
        if (closed.length) {
            closedHtml = `<div class="dsh-closed-sel-wrap">
              <select id="dshClosedSelect" class="dsh-closed-sel">
                <option value="">▾ Fechadas (${closed.length})</option>
                ${closed.map((op, idx) => {
                    const realIdx   = open.length + idx;
                    const isSel     = realIdx === _selIdx ? ' selected' : '';
                    return `<option value="${realIdx}"${isSel}>${getAsset(op.ativo)} ${(op.tipo||'').toUpperCase()} ${fmtDate(op.data_vencimento||op.data_operacao||op.criado_em)}</option>`;
                }).join('')}
              </select>
            </div>`;
        }

        el.innerHTML = tabsHtml + closedHtml
            + `<div class="dsh-op-sum">
                <span class="dsh-tag dsh-tag-b">TOTAL ${ops.length}</span>
                <span class="dsh-tag dsh-tag-g">ABERTAS ${open.length}</span>
                <span class="dsh-tag dsh-tag-r">FECHADAS ${closed.length}</span>
                <span class="dsh-tag dsh-tag-a">PRÊMIO ${fmtUsd(tp)}</span>
               </div>`;
    }

    /* ─────────────────────────────
       Accordion operações abertas
    ───────────────────────────── */
    function openAcc(open) {
        if (!open.length) return '<div style="padding:.8rem 0;font-family:var(--dsh-mono);font-size:.80rem;color:var(--dsh-tx2);text-align:center;">Nenhuma posição aberta</div>';
        return `<div class="dsh-opened">
          <button class="dsh-closed-toggle" type="button"
            data-bs-toggle="collapse" data-bs-target="#dshOpenedBody"
            aria-expanded="false" aria-controls="dshOpenedBody">
            <span>Abertas (${open.length})</span>
            <svg class="dsh-toggle-caret" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div id="dshOpenedBody" class="collapse">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin-top:.4rem;">
              ${open.map(opCard).join('')}
            </div>
          </div>
        </div>`;
    }

    /* ─────────────────────────────
       Render principal
    ───────────────────────────── */
    function render() {
        const allOps = cfg.getOperacoes();
        const ops    = filterOps(allOps);
        const open   = ops.filter(o => (o.status||'').toUpperCase() === 'ABERTA');
        const closed = ops.filter(o => (o.status||'').toUpperCase() !== 'ABERTA');

        // Atualiza pills de ativo no filtro
        const assetPillsEl = document.getElementById('dshAssetPills');
        if (assetPillsEl) {
            const assets = [...new Set(allOps.map(o => getAsset(o.ativo)))].sort();
            if (assets.length > 1) {
                assetPillsEl.innerHTML = '<div class="dsh-fsep"></div>'
                    + assets.map(a => `<button class="dsh-pill${_assetF===a?' aa':''}" data-dsh-a="${a}">${a}</button>`).join('');
            }
        }

        const sortedOps = [...open, ...closed];
        if (_selIdx >= sortedOps.length) _selIdx = 0;
        const cur = sortedOps[_selIdx] || open[0] || null;

        // Tabs
        buildTabs(ops);

        // Métricas resumo
        const tp   = ops.reduce((a,o) => a + (parseFloat(o.premio_us)||0), 0);
        const avgD = ops.length ? ops.reduce((a,o) => a+(parseFloat(o.distancia)||0),0) / ops.length : 0;
        const avgT = ops.length ? ops.reduce((a,o) => a+(parseFloat(o.tae)||0),0) / ops.length : 0;
        const best = open.length ? Math.max(...open.map(o => parseFloat(o.resultado)||0)) : 0;
        const exQty = ops.filter(o => (o.exercicio_status||'').toUpperCase() === 'SIM' || o.exercido === true || o.exercido === 'SIM').length;

        const resumoRows = [
            { l: 'Prêmio Total',     v: fmtUsd(tp),                     c: 'var(--dsh-amber)' },
            { l: 'Dist. Média OTM',  v: avgD.toFixed(2) + '%',          c: avgD < 3 ? 'var(--dsh-red)' : avgD < 6 ? 'var(--dsh-amber)' : 'var(--dsh-green)' },
            { l: 'TAE Médio',        v: avgT.toFixed(0) + '%',          c: 'var(--dsh-green)' },
            { l: 'Melhor Resultado', v: best > 0 ? '+' + best.toFixed(2) + '%' : '—', c: 'var(--dsh-green)' },
            { l: 'Em Risco (ITM)',   v: exQty + '',                     c: exQty > 0 ? 'var(--dsh-red)' : 'var(--dsh-green)' },
            { l: 'Total Operações',  v: ops.length + '',                c: 'var(--dsh-blue)' },
        ].map(i => `<div class="dsh-resumo-row">
            <span class="dsh-resumo-k">${i.l}</span>
            <span class="dsh-resumo-v" style="color:${i.c};">${i.v}</span>
          </div>`).join('');

        // Gráfico sempre segue o ativo da op selecionada; cai no _assetF se não houver op
        const chartAsset = cur ? getAsset(cur.ativo) : _assetF;
        const assetLabel = chartAsset ? ' · ' + chartAsset : '';

        const bodyEl = document.getElementById('dshBody');
        if (!bodyEl) return;

        bodyEl.innerHTML = `
          <!-- Metric-gauge row (7 semi-gauges + totals) -->
          ${mgRow(cur, ops)}

          <!-- Chart grande + Painel Resumo Analítico -->
          <div class="dsh-grid-main" style="display:grid;grid-template-columns:1fr 260px;gap:.6rem;margin-bottom:.55rem;">
            <div class="dsh-chart-card">
              <div class="dsh-chart-title">Resultado acumulado × prêmio diário${assetLabel}</div>
              <div style="position:relative;flex:1;min-height:110px;"><canvas id="dshChartLine"></canvas></div>
            </div>
            <div class="dsh-resumo">
              <div class="dsh-resumo-title">Resumo Analítico</div>
              ${resumoRows}
              ${cur ? `<div style="margin-top:.22rem;">${probBar(cur)}</div>` : ''}
            </div>
          </div>

          <!-- Operações abertas (accordion) -->
          ${openAcc(open)}

          <!-- Operações fechadas (accordion) -->
          ${closedFoot(closed)}`;

        // Hora
        const timeEl = document.getElementById('dshTime');
        if (timeEl) {
            const n = new Date();
            timeEl.textContent = 'Atualizado: ' + n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
        }

        // Chart: filtra pelo período + ativo da op selecionada (ou pill de ativo)
        setTimeout(() => buildChart(allOps.filter(op =>
            inPeriod(op, _period) && (!chartAsset || getAsset(op.ativo) === chartAsset)
        )), 50);
    }

    /* ─────────────────────────────
       Bind filtros
    ───────────────────────────── */
    function bindFilters() {
        const fbar = document.getElementById('dshFbar');
        if (!fbar) return;
        fbar.addEventListener('click', e => {
            const btn = e.target.closest('[data-dsh-p],[data-dsh-s],[data-dsh-t],[data-dsh-a]');
            if (!btn) return;
            if (btn.hasAttribute('data-dsh-p')) {
                _period = btn.getAttribute('data-dsh-p');
                fbar.querySelectorAll('[data-dsh-p]').forEach(b => b.classList.remove('ap'));
                btn.classList.add('ap');
            } else if (btn.hasAttribute('data-dsh-s')) {
                const v = btn.getAttribute('data-dsh-s');
                if (_statusF === v) {
                    _statusF = null;
                    fbar.querySelectorAll('[data-dsh-s]').forEach(b => b.classList.remove('aa','af'));
                } else {
                    _statusF = v;
                    fbar.querySelectorAll('[data-dsh-s]').forEach(b => b.classList.remove('aa','af'));
                    btn.classList.add(v === 'aberta' ? 'aa' : 'af');
                }
            } else if (btn.hasAttribute('data-dsh-t')) {
                const v = btn.getAttribute('data-dsh-t');
                if (_tipoF === v) {
                    _tipoF = null;
                    fbar.querySelectorAll('[data-dsh-t]').forEach(b => b.classList.remove('ac','apu'));
                } else {
                    _tipoF = v;
                    fbar.querySelectorAll('[data-dsh-t]').forEach(b => b.classList.remove('ac','apu'));
                    btn.classList.add(v === 'CALL' ? 'ac' : 'apu');
                }
            } else if (btn.hasAttribute('data-dsh-a')) {
                const v = btn.getAttribute('data-dsh-a');
                if (_assetF === v) {
                    _assetF = null;
                    fbar.querySelectorAll('[data-dsh-a]').forEach(b => b.classList.remove('aa'));
                } else {
                    _assetF = v;
                    fbar.querySelectorAll('[data-dsh-a]').forEach(b => b.classList.remove('aa'));
                    btn.classList.add('aa');
                }
            }
            _selIdx = 0;
            render();
        });
    }

    /* ─────────────────────────────
       Bind botões header
    ───────────────────────────── */
    function bindButtons() {
        const refreshBtn = document.getElementById('btnDshRefresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.classList.add('spin');
                showLoading();
                try {
                    await fetch('/api/crypto/refresh', {method:'POST'}).catch(()=>{});
                    const r = await fetch('/api/crypto').catch(()=>null);
                    if (r && r.ok) {
                        const data = await r.json().catch(()=>null);
                        if (Array.isArray(data)) window.cryptoOperacoes = data;
                        else if (data && Array.isArray(data.operacoes)) window.cryptoOperacoes = data.operacoes;
                    }
                } catch(e) { /* silent */ }
                render();
                setTimeout(() => refreshBtn.classList.remove('spin'), 400);
            });
        }
        const detBtn = document.getElementById('btnResultadosCryptoDetalhado');
        if (detBtn) {
            detBtn.addEventListener('click', () => {
                if (_bsModal) _bsModal.hide();
                setTimeout(() => {
                    if (window.ModalResultadosCrypto && typeof window.ModalResultadosCrypto.open === 'function') {
                        window.ModalResultadosCrypto.open();
                    }
                }, 400);
            });
        }
        // Listener único para tabs de abertas e select de fechadas
        const opRow = document.getElementById('dshOpRow');
        if (opRow) {
            opRow.addEventListener('click', e => {
                const tab = e.target.closest('[data-dsh-idx]');
                if (!tab) return;
                _selIdx = parseInt(tab.getAttribute('data-dsh-idx'));
                render();
            });
            opRow.addEventListener('change', e => {
                if (e.target.id === 'dshClosedSelect') {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) { _selIdx = v; render(); }
                }
            });
        }
    }

    /* ─────────────────────────────
       Carregar template e abrir
    ───────────────────────────── */
    function openModal() {
        if (_loaded) {
            render();
            if (_bsModal) _bsModal.show();
            return;
        }
        const container = document.getElementById(cfg.containerElId);
        if (!container) { console.error('DSH: container não encontrado:', cfg.containerElId); return; }

        fetch(cfg.templatePath)
            .then(r => { if (!r.ok) throw new Error('Template não encontrado: ' + cfg.templatePath); return r.text(); })
            .then(html => {
                container.innerHTML = html;
                _loaded = true;
                const modalEl = document.getElementById(cfg.modalElId);
                if (!modalEl) { console.error('DSH: modal element não encontrado:', cfg.modalElId); return; }
                _bsModal = new bootstrap.Modal(modalEl);
                bindFilters();
                bindButtons();
                render();
                _bsModal.show();
            })
            .catch(err => console.error('DSH: erro ao carregar template:', err));
    }

    function configure(opts) { if (opts) Object.assign(cfg, opts); }

    function setupTriggers() {
        const attach = () => {
            const btn = document.getElementById(cfg.triggerBtnId);
            if (btn) btn.addEventListener('click', openModal);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
        else attach();
    }

    setupTriggers();
    window.ModalResultadosCryptoCompact = { configure, open: openModal };

})();

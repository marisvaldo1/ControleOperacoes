/**
 * crypto-utils.js  v1.2.0
 * Funções globais compartilhadas para cálculos de risco, distância, gauge e
 * lucro projetado (exercício + prêmio) com tooltip desktop/mobile.
 * Evita divergências entre modal-detalhe, modal-analise, visão-geral, etc.
 */
(function () {
    'use strict';

    // ─── Risk level binário ──────────────────────────────────────────────────
    // Retorna { color, bg, label, level } baseado na distância.
    // distNum < 0 → ITM (vermelho); distNum >= 0 → OTM (verde)
    function getRisk(distNum) {
        if (distNum < 0) return {
            color: '#e85d4a',
            bg: 'rgba(232,93,74,0.12)',
            label: 'ITM — EXERCÍCIO PROVÁVEL',
            level: 'danger'
        };
        return {
            color: '#47b96c',
            bg: 'rgba(71,185,108,0.12)',
            label: 'SEGURO — OTM',
            level: 'success'
        };
    }

    // ─── Gauge SVG binário ──────────────────────────────────────────────────
    // Gauge com apenas 2 zonas: vermelho (ITM) e verde (OTM)
    function buildGaugeSVG(distRaw) {
        const dist = parseFloat(distRaw) || 0;
        let zoneColor, zoneLabel, zoneEmoji;
        if (dist < 0) {
            zoneColor = '#e85d4a'; zoneLabel = 'ITM — Exercício Provável'; zoneEmoji = '🔴';
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
            return '<path d="M ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2) + ' A ' + r + ' ' + r + ' 0 ' + lg + ' 1 ' + p2.x.toFixed(2) + ' ' + p2.y.toFixed(2) + '" stroke="' + color + '" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.32"/>';
        }
        return '<svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" class="mdc-gauge-svg">' +
            arcSeg(200, 270, '#e85d4a') +
            arcSeg(270, 340, '#47b96c') +
            '<path d="M ' + pt(200).x.toFixed(2) + ' ' + pt(200).y.toFixed(2) + ' A ' + r + ' ' + r + ' 0 0 1 ' + pt(340).x.toFixed(2) + ' ' + pt(340).y.toFixed(2) + '" stroke="rgba(255,255,255,0.06)" stroke-width="12" fill="none" stroke-linecap="round"/>' +
            '<line x1="' + cx + '" y1="' + cy + '" x2="' + np.x.toFixed(2) + '" y2="' + np.y.toFixed(2) + '" stroke="' + zoneColor + '" stroke-width="3" stroke-linecap="round"/>' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="' + zoneColor + '" opacity="0.9"/>' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#fff"/>' +
            '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" font-size="15" font-weight="bold" fill="' + zoneColor + '" font-family="monospace">' + (dist >= 0 ? '+' : '') + dist.toFixed(2) + '%</text>' +
            '<text x="13"  y="112" text-anchor="middle" font-size="8.5" fill="#e85d4a" font-family="monospace">ITM</text>' +
            '<text x="187" y="112" text-anchor="middle" font-size="8.5" fill="#47b96c" font-family="monospace">OTM</text>' +
            '</svg>' +
            '<div class="mdc-gauge-label" style="color:' + zoneColor + '">' + zoneEmoji + '&nbsp;' + zoneLabel + '</div>';
    }

    // ─── Semáforo binário (3 dots) ──────────────────────────────────────────
    // Retorna { isRed, isAmb, isGrn, html } — amarelo sempre desligado
    function buildSemaforo(distNum) {
        const isRed = distNum < 0;
        const isGrn = distNum >= 0;
        return {
            isRed: isRed,
            isAmb: false,
            isGrn: isGrn,
            html: '<div class="mdc-semaforo" title="Semáforo de Distância ao Strike · Atual: ' + distNum.toFixed(1) + '%">' +
                '<div class="mdc-sema-dot" title="🔴 ITM — exercício provável" style="background:#e85d4a;box-shadow:' + (isRed ? '0 0 10px #e85d4a' : 'none') + ';opacity:' + (isRed ? '1' : '0.2') + '"></div>' +
                '<div class="mdc-sema-dot" title="🟡 Atenção" style="background:#f59f00;box-shadow:none;opacity:0.2"></div>' +
                '<div class="mdc-sema-dot" title="🟢 OTM — seguro, sem exercício" style="background:#47b96c;box-shadow:' + (isGrn ? '0 0 10px #47b96c' : 'none') + ';opacity:' + (isGrn ? '1' : '0.2') + '"></div>' +
                '</div>'
        };
    }

    // ─── Distância (cotação vs strike) ──────────────────────────────────────
    // Retorna distância percentual com sinal.
    // CALL: (strike - cotação) / cotação * 100
    // PUT:  (cotação - strike) / strike * 100
    function calcDistancia(tipo, strike, cotacao) {
        const s = parseFloat(strike) || 0;
        const c = parseFloat(cotacao) || 0;
        if (!s || !c) return 0;
        const t = (tipo || '').toUpperCase();
        return t === 'CALL'
            ? ((s - c) / c) * 100
            : ((c - s) / s) * 100;
    }

    // ─── Cálculo do _liveDist (atualização de cotação ao vivo) ──────────────
    function calcLiveDist(tipo, strike, livePrice) {
        return calcDistancia(tipo, strike, livePrice);
    }

    // ─── Renderiza link clicável do Preço Médio ──────────────────────────────
    // Retorna HTML do PM estilizado como link que abre o modal Raio-X.
    // Uso: CryptoUtils.renderPmLink('BTC', 58000) ou CryptoUtils.renderPmLink('ETH', 2400, { fontSize: '18px' })
    function renderPmLink(ativo, pmValue, opts) {
        const par = (ativo || '').toUpperCase().replace('USDT','').replace('/','').trim();
        const pm  = parseFloat(pmValue) || 0;
        const cor = par === 'BTC' ? '#f59f00' : par === 'ETH' ? '#4da6ff' : '#3fb950';
        const formatted = '$' + pm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fontSize = (opts && opts.fontSize) || 'inherit';
        const uid = 'pm-link-' + par + '-' + Date.now();
        return '<span class="crypto-pm-link" id="' + uid + '" ' +
            'data-par="' + par + '" ' +
            'data-pm="' + pm + '" ' +
            'style="color:' + cor + ';cursor:pointer;text-decoration:underline dotted ' + cor + '80;text-underline-offset:4px;font-weight:700;font-size:' + fontSize + '" ' +
            'role="button" ' +
            'tabindex="0" ' +
            'onclick="if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.openModal === \'function\') { event.preventDefault(); event.stopPropagation(); ModalPrecoMedioAtivo.openModal(\'' + par + '\'); }" ' +
            'onkeydown="if (event.key === \'Enter\' || event.key === \' \') { event.preventDefault(); if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.openModal === \'function\') { ModalPrecoMedioAtivo.openModal(\'' + par + '\'); } }">' +
            formatted + '</span>';
    }

    // Vincula tooltips aos links de PM após renderização
    function bindPmTooltips() {
        if (!window.SharedTooltip) return;
        document.querySelectorAll('.crypto-pm-link[data-par][data-pm]').forEach(function(el) {
            // Remove listeners anteriores para evitar duplicação
            el.removeEventListener('mouseenter', _pmTooltipEnter);
            el.removeEventListener('mouseleave', _pmTooltipLeave);
            el.addEventListener('mouseenter', _pmTooltipEnter);
            el.addEventListener('mouseleave', _pmTooltipLeave);
        });
    }

    function _pmTooltipEnter(e) {
        var el = e.currentTarget;
        var par = el.getAttribute('data-par') || '';
        var pm = parseFloat(el.getAttribute('data-pm') || 0);
        if (!pm || !window.SharedTooltip) return;

        // Usa a mesma fonte da verdade do modal Raio-X para garantir consistência
        var d = null;
        if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.computeData === 'function') {
            try { d = window.ModalPrecoMedioAtivo.computeData(par); } catch (err) { d = null; }
        }

        var lines;
        if (d && d.pm > 0) {
            lines = [
                { key: '📊 Fórmula', value: 'Entrada (PUT) − Prêmios do ciclo' },
                { key: '🎯 Entrada (PUT)', value: 'US$ ' + d.ultimoExercicio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                { key: '💰 Prêmios acumulados', value: 'US$ ' + d.totalPremios.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                { key: '🧮 PM', value: 'US$ ' + d.pm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                { key: '🔢 PUTs no ciclo', value: (d.premios ? d.premios.length : 0) + ' lançamento' + ((d.premios && d.premios.length !== 1) ? 's' : '') },
            ];
        } else {
            // Fallback: exibe apenas o PM já renderizado no link
            lines = [
                { key: '📊 Fórmula', value: 'Entrada (PUT) − Prêmios do ciclo' },
                { key: '🧮 PM', value: 'US$ ' + pm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            ];
        }

        window.SharedTooltip.show(el, {
            type: 'default',
            title: 'Preço Médio — ' + par,
            lines: lines,
            note: 'PM = strike da última PUT exercida − prêmios recebidos desde o exercício. Clique para ver detalhes.',
        });
    }

    function _pmTooltipLeave() {
        if (window.SharedTooltip) window.SharedTooltip.hide();
    }

    // ─── Lucro projetado (exercício + prêmio) ───────────────────────────────
    // Fórmula única para CALL e PUT:
    //   Lucro se Exercido = Strike − PM
    //   Lucro Total       = Lucro se Exercido + Prêmio recebido
    function calcProfit(strike, pm, premio) {
        const s = parseFloat(strike) || 0;
        const m = parseFloat(pm) || 0;
        const p = parseFloat(premio) || 0;
        if (!s || !m) return null;
        const exercicio = s - m;
        return { strike: s, pm: m, premio: p, exercicio: exercicio, total: exercicio + p };
    }

    function fmtUsd(n) {
        return 'US$ ' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtSigned(n) {
        return (n >= 0 ? '+' : '-') + fmtUsd(n);
    }

    function buildProfitRowHtml(strike, pm, premio, tipo) {
        const d = calcProfit(strike, pm, premio);
        if (!d || d.pm <= 0) return '';
        const t = (tipo || '').toUpperCase();
        const data = ' data-strike="' + d.strike + '" data-pm="' + d.pm + '" data-premio="' + d.premio + '" data-tipo="' + t + '"';
        const box = (lbl, val, pg, highlight) =>
            '<div class="pg-td-box' + (highlight ? ' pg-td-box-total' : '') + '" data-pg="' + pg + '"' + data + '>' +
            '<span class="pg-td-lbl">' + lbl + '</span>' +
            '<span class="pg-td-big" style="color:' + (val >= 0 ? '#22c55e' : '#ef4444') + '">' + fmtSigned(val) + '</span>' +
            '</div>';
        return box('Lucro se Exercido (Strike \u2212 PM)', d.exercicio, 'exercicio', false) +
               box('Lucro Total (Pr\u00eAmio + Exerc\u00edcio)', d.total, 'total', true);
    }

    // Tooltip das caixas de lucro projetado (desktop: hover | mobile: toque).
    // Delegação de eventos: o innerHTML da linha é reescrito a cada cotação ao vivo.
    const PG_SELECTOR = '.pg-td-box[data-pg]';

    function bindProfitTooltips(root) {
        if (!root || !window.SharedTooltip || root.__pgTipBound) return;
        root.__pgTipBound = true;
        let tipEl = null;
        let touchLock = 0;

        const findBox = (target) =>
            (target && target.closest) ? target.closest(PG_SELECTOR) : null;

        const hide = () => { tipEl = null; window.SharedTooltip.hide(); };

        root.addEventListener('mouseover', function (e) {
            if (Date.now() - touchLock < 800) return; // evento sintético pós-toque
            const el = findBox(e.target);
            if (!el || el === tipEl) return;
            tipEl = el;
            showProfitTooltip(el);
        });

        root.addEventListener('mouseout', function (e) {
            if (Date.now() - touchLock < 800) return;
            const el = findBox(e.target);
            if (!el || el !== tipEl) return;
            if (e.relatedTarget && el.contains(e.relatedTarget)) return;
            hide();
        });

        // Mobile: sem hover — toque abre/fecha, toque fora fecha
        root.addEventListener('touchstart', function (e) {
            const el = findBox(e.target);
            touchLock = Date.now();
            if (!el) { if (tipEl) hide(); return; }
            if (el === tipEl) { hide(); return; }
            tipEl = el;
            showProfitTooltip(el);
        }, { passive: true });

        document.addEventListener('touchstart', function (e) {
            if (!tipEl || (e.target && root.contains(e.target))) return;
            touchLock = Date.now();
            hide();
        }, { passive: true });
    }

    function showProfitTooltip(el) {
        const d = calcProfit(el.getAttribute('data-strike'), el.getAttribute('data-pm'), el.getAttribute('data-premio'));
        if (!d || !window.SharedTooltip) return;
        const tipo = (el.getAttribute('data-tipo') || '').toLowerCase();
        const isTotal = el.getAttribute('data-pg') === 'total';
        const cls = (v) => (v >= 0 ? 'tt-positive' : 'tt-negative');

        const lines = [
            { key: '📌 Strike', value: fmtUsd(d.strike) },
            { key: '🧮 PM (Preço Médio)', value: fmtUsd(d.pm) },
            { key: '💰 Prêmio Recebido', value: fmtSigned(d.premio), className: cls(d.premio) },
            { key: '🧾 Lucro se Exercido', value: fmtSigned(d.exercicio), className: cls(d.exercicio) }
        ];
        let formula = 'Strike ' + fmtUsd(d.strike) + ' \u2212 PM ' + fmtUsd(d.pm) + ' = <b>' + fmtSigned(d.exercicio) + '</b>';
        let note = 'Lucro Total = ' + fmtSigned(d.exercicio) + ' + Pr\u00eAmio ' + fmtSigned(d.premio) + ' = ' + fmtSigned(d.total);

        if (isTotal) {
            lines.push({ key: '🎯 Lucro Total', value: fmtSigned(d.total), className: cls(d.total) });
            formula = '(Strike \u2212 PM) + Pr\u00eAmio = (' + fmtUsd(d.strike) + ' \u2212 ' + fmtUsd(d.pm) +
                ') + ' + fmtUsd(d.premio) + ' = <b>' + fmtSigned(d.total) + '</b>';
            note = 'Lucro do exerc\u00edcio somado ao pr\u00eAmio j\u00e1 recebido na venda da opera\u00e7\u00e3o.';
        }

        window.SharedTooltip.show(el, {
            type: tipo === 'put' || tipo === 'call' ? tipo : 'default',
            title: (isTotal ? 'Lucro Total' : 'Lucro se Exercido') + ' — ' + (tipo ? tipo.toUpperCase() : 'Operação'),
            lines: lines,
            formula: formula,
            note: note
        });
    }

    // ─── Expor globalmente ──────────────────────────────────────────────────
    window.CryptoUtils = {
        getRisk: getRisk,
        buildGaugeSVG: buildGaugeSVG,
        buildSemaforo: buildSemaforo,
        calcDistancia: calcDistancia,
        calcLiveDist: calcLiveDist,
        calcProfit: calcProfit,
        buildProfitRowHtml: buildProfitRowHtml,
        bindProfitTooltips: bindProfitTooltips,
        renderPmLink: renderPmLink,
        bindPmTooltips: bindPmTooltips,
    };

})();

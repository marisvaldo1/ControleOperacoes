/**
 * crypto-utils.js  v1.0.0
 * Funções globais compartilhadas para cálculos de risco, distância e gauge.
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

        var ops = window.cryptoOperacoes || [];
        var assetOps = ops.filter(function(o) {
            return (o.ativo || '').toUpperCase().replace('USDT','').replace('/','').trim() === par;
        });

        var putsExercidas = assetOps.filter(function(o) {
            return (o.tipo || '').toUpperCase() === 'PUT' && 
                   (o.exercicio_status || '').toUpperCase() === 'SIM';
        });

        var custoTotal = 0;
        var qtyTotal = 0;
        putsExercidas.forEach(function(op) {
            var strike = parseFloat(op.strike || 0);
            var crypto = parseFloat(op.crypto || 0);
            var premio = parseFloat(op.premio_us || 0);
            if (strike > 0 && crypto > 0) {
                custoTotal += strike * crypto - premio;
                qtyTotal += crypto;
            }
        });

        var lines = [
            { key: '📊 Fórmula', value: 'Custo Total / Qtd Total' },
            { key: '💰 Custo Total', value: 'US$ ' + custoTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) },
            { key: '📦 Quantidade', value: qtyTotal.toFixed(6) + ' ' + par },
            { key: '🧮 PM', value: 'US$ ' + pm.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) },
            { key: '🔢 PUTs Exercidas', value: putsExercidas.length.toString() },
        ];

        window.SharedTooltip.show(el, {
            type: 'default',
            title: 'Preço Médio — ' + par,
            lines: lines,
            note: 'PM ponderado de todas as PUTs exercidas. Clique para ver detalhes.',
        });
    }

    function _pmTooltipLeave() {
        if (window.SharedTooltip) window.SharedTooltip.hide();
    }

    // ─── Expor globalmente ──────────────────────────────────────────────────
    window.CryptoUtils = {
        getRisk: getRisk,
        buildGaugeSVG: buildGaugeSVG,
        buildSemaforo: buildSemaforo,
        calcDistancia: calcDistancia,
        calcLiveDist: calcLiveDist,
        renderPmLink: renderPmLink,
        bindPmTooltips: bindPmTooltips,
    };

})();

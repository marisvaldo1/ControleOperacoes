/**
 * modal-captura.js  v2.0.0
 * Modal de Captura de Operações Binance (Dual Investment)
 * Padrão IIFE + namespace ModalCaptura — Streaming SSE
 */
;(function () {
    'use strict';

    var COIN_COLORS = {
        BTC: '#f0b90b',
        ETH: '#4f9dde',
        SOL: '#3ecf8e',
        BNB: '#ef5b5b',
        XRP: '#e2b93b',
        USDT: '#26a17b',
        _default: '#6fd3ff',
    };

    var PERIOD_LABELS = {
        today: 'Hoje',
        '7d': 'Últimos 7 dias',
        '30d': 'Últimos 30 dias',
        '90d': 'Últimos 90 dias',
    };

    var selectedPeriod = null;
    var importAllSelected = false;
    var simPaused = false;
    var simTotal = 0;
    var simDone = 0;
    var simCoinCounts = {};
    var simLog = [];
    var syncResult = null;
    var speedHistory = [];
    var lastDone = 0;
    var lastTime = Date.now();
    var abortController = null;

    /* ── Helpers ─────────────────────────────────────────────── */
    function fmtTime(d) {
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function $(id) { return document.getElementById(id); }

    function show(id) {
        ['capturaTelaPeriodo', 'capturaTelaConfirmacao', 'capturaTelaProgresso', 'capturaTelaConcluido'].forEach(function (el) {
            var e = $(el);
            if (e) e.style.display = 'none';
        });
        var target = $(id);
        if (target) target.style.display = '';
    }

    /* ── Tela de período ─────────────────────────────────────── */
    function showPeriodo() {
        selectedPeriod = null;
        importAllSelected = false;
        document.querySelectorAll('#modalCaptura .captura-period-opt').forEach(function (el) {
            el.classList.remove('selected');
        });
        var danger = $('capturaImportAll');
        if (danger) danger.classList.remove('selected');
        var btn = $('capturaStartBtn');
        if (btn) btn.disabled = true;
        show('capturaTelaPeriodo');
    }

    function choosePeriod(id) {
        selectedPeriod = id;
        importAllSelected = false;
        document.querySelectorAll('#modalCaptura .captura-period-opt').forEach(function (el) {
            el.classList.toggle('selected', el.getAttribute('data-period') === id);
        });
        var danger = $('capturaImportAll');
        if (danger) danger.classList.remove('selected');
        var btn = $('capturaStartBtn');
        if (btn) btn.disabled = false;
    }

    function chooseImportAll() {
        importAllSelected = true;
        selectedPeriod = null;
        document.querySelectorAll('#modalCaptura .captura-period-opt').forEach(function (el) {
            el.classList.remove('selected');
        });
        var danger = $('capturaImportAll');
        if (danger) danger.classList.add('selected');
        var btn = $('capturaStartBtn');
        if (btn) btn.disabled = false;
    }

    function handleStart() {
        if (importAllSelected) {
            show('capturaTelaConfirmacao');
        } else {
            startImport();
        }
    }

    /* ── Importação via SSE ──────────────────────────────────── */
    function startImport() {
        show('capturaTelaProgresso');
        simDone = 0;
        simTotal = 0;
        simPaused = false;
        simCoinCounts = {};
        simLog = [];
        syncResult = null;
        speedHistory = [];
        lastDone = 0;
        lastTime = Date.now();

        $('capturaPctLabel').textContent = '0%';
        $('capturaCountLabel').textContent = 'Buscando...';
        $('capturaProgFill').style.width = '0%';
        $('capturaStatusBadge').textContent = 'Importando';
        $('capturaStatusBadge').className = 'captura-status-badge captura-status-running';
        $('capturaEtaLabel').textContent = 'conectando à Binance...';
        $('capturaLogBox').innerHTML = '<div class="captura-log-line">Conectando à API Binance...</div>';
        $('capturaSpeedNow').textContent = '0/s';

        drawSpeedChart();
        drawBarsChart();

        abortController = new AbortController();

        fetch('/api/crypto/dual-investment/stream', {
            method: 'POST',
            signal: abortController.signal,
        }).then(function (response) {
            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';

            function read() {
                return reader.read().then(function (result) {
                    if (result.done) return;
                    buffer += decoder.decode(result.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop();
                    lines.forEach(function (line) {
                        if (line.trim()) processEvent(line);
                    });
                    return read();
                });
            }
            return read();
        }).catch(function (err) {
            if (err.name === 'AbortError') return;
            $('capturaPctLabel').textContent = 'Erro';
            $('capturaLogBox').innerHTML = '<div class="captura-log-line" style="color:#ef4444">Erro: ' + (err.message || 'Falha na conexão') + '</div>';
            $('capturaStatusBadge').textContent = 'Erro';
            $('capturaStatusBadge').className = 'captura-status-badge captura-status-paused';
        });
    }

    function processEvent(line) {
        try {
            var evt = JSON.parse(line);
        } catch (e) {
            return;
        }

        if (evt.event === 'progress') {
            simTotal = evt.total || simTotal;
            simDone = evt.done || simDone;

            if (evt.total) {
                $('capturaCountLabel').textContent = simDone + ' / ' + simTotal;
            }
            if (evt.pct !== undefined) {
                $('capturaPctLabel').textContent = evt.pct + '%';
                $('capturaProgFill').style.width = evt.pct + '%';
            }
            if (evt.msg) {
                $('capturaEtaLabel').textContent = evt.msg;
            }

            // Velocidade
            var now = Date.now();
            var elapsed = (now - lastTime) / 1000;
            if (elapsed >= 0.5) {
                var batch = simDone - lastDone;
                var speed = Math.round(batch / elapsed);
                speedHistory.push(speed);
                if (speedHistory.length > 30) speedHistory.shift();
                lastDone = simDone;
                lastTime = now;

                var avgSpeed = Math.round(speedHistory.reduce(function (a, b) { return a + b; }, 0) / speedHistory.length);
                $('capturaSpeedNow').textContent = avgSpeed + '/s';

                var remaining = simTotal - simDone;
                if (avgSpeed > 0) {
                    $('capturaEtaLabel').textContent = '~' + Math.max(1, Math.round(remaining / avgSpeed)) + 's restantes';
                }

                drawSpeedChart();
            }

            // Contagem por moeda e log
            if (evt.coin) {
                simCoinCounts[evt.coin] = (simCoinCounts[evt.coin] || 0) + 1;
                drawBarsChart();
            }

            if (evt.coin && evt.type) {
                var logEntry = { t: fmtTime(new Date()), coin: evt.coin, type: evt.type, status: evt.op_status || '' };
                simLog.push(logEntry);
                renderLog();
            }
        }

        if (evt.event === 'done') {
            syncResult = evt;
            simTotal = evt.found || simTotal;
            simDone = simTotal;
            simCoinCounts = evt.coins || simCoinCounts;

            $('capturaPctLabel').textContent = '100%';
            $('capturaProgFill').style.width = '100%';
            $('capturaCountLabel').textContent = simDone + ' / ' + simTotal;
            $('capturaSpeedNow').textContent = '0/s';
            $('capturaEtaLabel').textContent = 'concluído';
            $('capturaStatusBadge').textContent = 'Concluído';
            $('capturaStatusBadge').className = 'captura-status-badge captura-status-running';

            drawBarsChart();
            drawSpeedChart();
            // Não fechar automaticamente - modal permanece aberta
            // O usuário pode clicar no "X" para fechar e atualizar o dashboard
        }
    }

    /* ── Gráfico de velocidade (linha) ───────────────────────── */
    function drawSpeedChart() {
        var svg = $('capturaSpeedChart');
        if (!svg) return;
        var w = 300, h = 70;
        var vals = speedHistory.length ? speedHistory : [0];
        var max = Math.max.apply(null, vals.concat([1]));
        var stepX = w / Math.max(vals.length - 1, 1);
        var points = vals.map(function (v, i) {
            var x = i * stepX;
            var y = h - (v / max) * h * 0.85 - 4;
            return x + ',' + y;
        }).join(' ');
        svg.innerHTML =
            '<polyline points="' + points + '" fill="none" stroke="#f0b90b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<polygon points="0,' + h + ' ' + points + ' ' + w + ',' + h + '" fill="#f0b90b" opacity="0.12"/>';
    }

    /* ── Gráfico de barras por moeda ─────────────────────────── */
    function drawBarsChart() {
        var svg = $('capturaBarsChart');
        if (!svg) return;

        var coins = Object.keys(simCoinCounts).sort(function (a, b) {
            return (simCoinCounts[b] || 0) - (simCoinCounts[a] || 0);
        });

        if (coins.length === 0) {
            svg.innerHTML = '<text x="150" y="60" text-anchor="middle" font-size="11" fill="#64748b">Aguardando dados...</text>';
            return;
        }

        var max = Math.max.apply(null, coins.map(function (c) { return simCoinCounts[c] || 0; }).concat([1]));
        var barW = 40, gap = 18, baseY = 95;
        var x = 15;
        var bars = '';

        coins.forEach(function (coin) {
            var v = simCoinCounts[coin] || 0;
            var h = (v / max) * 70;
            var color = COIN_COLORS[coin] || COIN_COLORS._default;
            bars += '<rect x="' + x + '" y="' + (baseY - h) + '" width="' + barW + '" height="' + h + '" rx="4" fill="' + color + '"/>';
            bars += '<text x="' + (x + barW / 2) + '" y="' + (baseY + 14) + '" text-anchor="middle" font-size="10" fill="#94a3b8">' + coin + '</text>';
            bars += '<text x="' + (x + barW / 2) + '" y="' + (baseY - h - 6) + '" text-anchor="middle" font-size="10" fill="#f1f5f9" font-weight="700">' + v + '</text>';
            x += barW + gap;
        });

        svg.innerHTML = bars;
    }

    /* ── Log ──────────────────────────────────────────────────── */
    function renderLog() {
        var box = $('capturaLogBox');
        if (!box) return;
        var lines = simLog.slice(-12).map(function (l) {
            var cls = l.status === 'FECHADA' ? 'captura-sell' : 'captura-buy';
            return '<div class="captura-log-line">' + l.t + ' · <span class="captura-sym">' + l.coin + '-USDT</span> · <span class="' + cls + '">' + l.type + ' ' + l.status + '</span></div>';
        });
        box.innerHTML = lines.join('');
    }

    /* ── Pausar / Retomar ────────────────────────────────────── */
    function togglePause() {
        simPaused = !simPaused;
        var btn = $('capturaPauseBtn');
        var badge = $('capturaStatusBadge');
        if (simPaused) {
            if (btn) btn.textContent = 'Continuar';
            if (badge) { badge.textContent = 'Pausado'; badge.className = 'captura-status-badge captura-status-paused'; }
        } else {
            if (btn) btn.textContent = 'Pausar';
            if (badge) { badge.textContent = 'Importando'; badge.className = 'captura-status-badge captura-status-running'; }
        }
    }

    function cancelImport() {
        if (abortController) abortController.abort();
        show('capturaTelaPeriodo');
    }

    /* ── Fechar ──────────────────────────────────────────────── */
    function close() {
        if (abortController) abortController.abort();
        var modal = $('modalCaptura');
        if (modal && window.bootstrap) {
            var inst = bootstrap.Modal.getInstance(modal);
            if (inst) inst.hide();
        }
        if (typeof window.renderCryptoTable === 'function') window.renderCryptoTable();
    }

    /* ── Abrir ───────────────────────────────────────────────── */
    function open() {
        showPeriodo();
        var modal = $('modalCaptura');
        if (modal && window.bootstrap) {
            var inst = bootstrap.Modal.getOrCreateInstance(modal);
            inst.show();
        }
    }

    /* ── API pública ─────────────────────────────────────────── */
    window.ModalCaptura = {
        open: open,
        close: close,
        showPeriodo: showPeriodo,
        choosePeriod: choosePeriod,
        chooseImportAll: chooseImportAll,
        handleStart: handleStart,
        startImport: startImport,
        togglePause: togglePause,
        cancelImport: cancelImport,
    };

    // Garante que o dashboard seja atualizado quando a modal for fechada
    var modalEl = document.getElementById('modalCaptura');
    if (modalEl && window.bootstrap) {
        modalEl.addEventListener('hidden.bs.modal', function () {
            close();
        });
    }
})();

(function () {
    'use strict';

    let tradingViewWidgetCrypto = null;
    let chartTecnicalGaugeCrypto = null;
    let chartTecnicalOscillatorsCrypto = null;
    let chartTecnicalMACrypto = null;
    let technicalAnalyzerCrypto = null;
    let currentAnalysisContextCrypto = null;

    function getActiveTickerCrypto() {
        return currentAnalysisContextCrypto?.ticker || '';
    }

    function normalizeNumber(value) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function formatPriceLabel(value) {
        const normalized = normalizeNumber(value);
        if (normalized === null) return '-';
        return normalized.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function normalizeAnalysisContextCrypto(input) {
        if (typeof input === 'string') {
            return {
                ticker: input.trim().toUpperCase().replace('/USDT', '').replace('USDT', '').replace('/', ''),
                strike: null,
                currentPrice: null,
                operationType: null,
                distancePct: null
            };
        }

        const source = input || {};
        const ticker = String(source.ticker || source.ativo || '').trim().toUpperCase()
            .replace('/USDT', '').replace('USDT', '').replace('/', '');
        const strike = normalizeNumber(source.strike);
        const currentPrice = normalizeNumber(source.currentPrice ?? source.cotacaoAtual ?? source.cotacao_atual);
        const providedDistancePct = normalizeNumber(source.distancePct);
        let distancePct = null;

        if (providedDistancePct !== null) {
            distancePct = Math.abs(providedDistancePct);
        } else if (strike && currentPrice) {
            distancePct = Math.abs(((currentPrice - strike) / strike) * 100);
        }

        return {
            ticker,
            strike,
            currentPrice,
            operationType: source.operationType ? String(source.operationType).toUpperCase() : null,
            distancePct
        };
    }

    function getStrikeLinePalette(distancePct) {
        const distance = normalizeNumber(distancePct);
        if (distance === null) {
            return {
                color: '#facc15',
                glow: 'rgba(250, 204, 21, 0.28)',
                label: 'Distância indisponível'
            };
        }

        if (distance < 2) {
            return {
                color: '#ef4444',
                glow: 'rgba(239, 68, 68, 0.28)',
                label: 'Muito próximo do strike'
            };
        }

        if (distance < 5) {
            return {
                color: '#facc15',
                glow: 'rgba(250, 204, 21, 0.28)',
                label: 'Faixa de atenção'
            };
        }

        return {
            color: '#22c55e',
            glow: 'rgba(34, 197, 94, 0.28)',
            label: 'Distância confortável'
        };
    }

    async function refreshCurrentPriceFromApiCrypto(context) {
        if (!context?.ticker) return;

        try {
            const symbol = `${context.ticker}USDT`;
            const response = await fetch((globalThis.API_BASE || '') + '/api/proxy/crypto/' + symbol, { cache: 'no-store' });
            const payload = await response.json();
            const livePrice = normalizeNumber(payload?.price);

            if (livePrice !== null && livePrice > 0) {
                context.currentPrice = livePrice;
                if (context.strike && context.strike > 0) {
                    context.distancePct = Math.abs(((livePrice - context.strike) / context.strike) * 100);
                }
            }
        } catch (error) {
            console.warn('[CryptoTechnicalAnalysis] Falha ao atualizar cotação ao vivo para overlay:', error?.message || error);
        }
    }

    function ensureStrikeOverlayHostCrypto() {
        const chartContainer = document.getElementById('tradingview_chart_crypto');
        const wrapper = chartContainer?.parentElement;
        if (!chartContainer || !wrapper) return null;

        wrapper.style.position = 'relative';

        let overlay = document.getElementById('tradingview_strike_overlay_crypto');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'tradingview_strike_overlay_crypto';
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '5';
        overlay.style.display = 'none';

        overlay.innerHTML = `
            <div id="tradingview_strike_line_crypto" style="position:absolute;left:14px;right:14px;top:50%;border-top:2px solid #facc15;box-shadow:0 0 0 1px transparent"></div>
            <div id="tradingview_strike_label_crypto" style="position:absolute;right:14px;top:calc(50% - 17px);padding:4px 10px;border-radius:999px;background:rgba(15,23,42,0.96);border:1px solid rgba(250,204,21,0.55);color:#fde68a;font-size:11px;font-weight:700;letter-spacing:0.02em;box-shadow:0 8px 18px rgba(0,0,0,0.26)"></div>
        `;

        wrapper.appendChild(overlay);
        return overlay;
    }

    function clearStrikeOverlayCrypto() {
        const overlay = document.getElementById('tradingview_strike_overlay_crypto');
        if (overlay) overlay.style.display = 'none';
    }

    function renderStrikeOverlayCrypto() {
        const overlay = ensureStrikeOverlayHostCrypto();
        if (!overlay) return;

        const context = currentAnalysisContextCrypto;
        if (!context || context.strike === null || context.currentPrice === null || context.strike <= 0 || context.currentPrice <= 0) {
            clearStrikeOverlayCrypto();
            return;
        }

        const strikeLine = document.getElementById('tradingview_strike_line_crypto');
        const strikeLabel = document.getElementById('tradingview_strike_label_crypto');
        if (!strikeLine || !strikeLabel) return;

        const distancePct = context.distancePct === null
            ? Math.abs(((context.currentPrice - context.strike) / context.strike) * 100)
            : context.distancePct;
        const diffPct = Math.abs(((context.strike - context.currentPrice) / context.currentPrice) * 100);
        const strikeAboveCurrent = context.strike > context.currentPrice;
        const offsetRatio = Math.max(0.02, Math.min(0.4, diffPct / 12));
        const topRatio = Math.min(0.92, Math.max(0.08, 0.5 + (strikeAboveCurrent ? -offsetRatio : offsetRatio)));
        const topPercent = topRatio * 100;
        const palette = getStrikeLinePalette(distancePct);

        overlay.style.display = 'block';

        strikeLine.style.top = `${topPercent}%`;
        strikeLine.style.borderTopColor = palette.color;
        strikeLine.style.boxShadow = `0 0 14px ${palette.glow}`;

        strikeLabel.style.top = `calc(${topPercent}% - 17px)`;
        strikeLabel.style.borderColor = palette.glow;
        strikeLabel.style.color = palette.color;
        strikeLabel.textContent = `Strike ${formatPriceLabel(context.strike)}`;
    }

    function resolveTickerSymbol(ticker) {
        const base = String(ticker || '').trim().toUpperCase().replace('/USDT', '').replace('USDT', '').replace('/', '');
        const cryptoSet = new Set(['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE']);
        if (cryptoSet.has(base)) {
            return `BINANCE:${base}USDT`;
        }
        return `BMFBOVESPA:${base}`;
    }

    function getRecommendationColor(signal) {
        const colors = {
            STRONG_BUY: 'success',
            BUY: 'success',
            NEUTRAL: 'secondary',
            SELL: 'danger',
            STRONG_SELL: 'danger'
        };
        return colors[signal] || 'secondary';
    }

    function getSignalColor(signal) {
        if (signal === 'Compra') return 'success';
        if (signal === 'Venda') return 'danger';
        return 'secondary';
    }

    function getGaugeColor(strength) {
        if (strength > 20) return '#22c55e';
        if (strength < -20) return '#ef4444';
        return '#94a3b8';
    }

    function getOscillatorSignal(type, value) {
        if (value === null || value === undefined) return 'Neutro';

        switch(type) {
            case 'rsi':
                if (value < 30) return 'Compra';
                if (value > 70) return 'Venda';
                return 'Neutro';
            case 'stochastic':
                if (value < 20) return 'Compra';
                if (value > 80) return 'Venda';
                return 'Neutro';
            case 'cci':
                if (value < -100) return 'Compra';
                if (value > 100) return 'Venda';
                return 'Neutro';
            case 'williamsR':
                if (value < -80) return 'Compra';
                if (value > -20) return 'Venda';
                return 'Neutro';
            default:
                return 'Neutro';
        }
    }

    function getSelectedTimeframeCrypto() {
        const selected = document.querySelector('input[name="timeframeCrypto"]:checked');
        return selected ? selected.value : '15m';
    }

    function resetInitialTimeframeCrypto() {
        const initial = document.getElementById('tf-crypto-15m');
        if (initial) initial.checked = true;
    }

    async function reloadTradingViewChartCrypto() {
        const ativoBase = getActiveTickerCrypto();
        if (!ativoBase) return;

        await refreshCurrentPriceFromApiCrypto(currentAnalysisContextCrypto);
        loadTradingViewChartCrypto(ativoBase, getSelectedTimeframeCrypto());
        renderStrikeOverlayCrypto();
    }

    function bindReloadChartButtonCrypto() {
        const reloadBtn = document.getElementById('btnReloadTradingViewCrypto');
        const reloadTopBtn = document.getElementById('btnReloadTradingViewCryptoTop');

        [reloadBtn, reloadTopBtn].forEach((btn) => {
            if (!btn || btn.dataset.bound === 'true') return;
            btn.dataset.bound = 'true';
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                try {
                    await reloadTradingViewChartCrypto();
                } finally {
                    btn.disabled = false;
                }
            });
        });
    }

    function initTradingViewWidgetCrypto(symbol, interval, theme) {
        try {
            tradingViewWidgetCrypto = new TradingView.widget({
                width: '100%',
                height: 500,
                symbol: symbol,
                interval: interval,
                timezone: 'America/Sao_Paulo',
                theme: theme,
                style: '1',
                locale: 'pt_BR',
                toolbar_bg: theme === 'dark' ? '#131722' : '#f1f3f6',
                enable_publishing: false,
                allow_symbol_change: false,
                container_id: 'tradingview_chart_crypto',
                hide_side_toolbar: false,
                hide_top_toolbar: false,
                hide_legend: false,
                save_image: false,
                studies_overrides: {},
                overrides: {
                    'mainSeriesProperties.candleStyle.upColor': '#26a69a',
                    'mainSeriesProperties.candleStyle.downColor': '#ef5350',
                    'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
                    'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
                    'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
                    'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350'
                }
            });
        } catch (error) {
            console.error('[CryptoTechnicalAnalysis] Erro ao criar widget TradingView:', error);
        }
    }

    function loadTradingViewChartCrypto(ticker, timeframe) {
        const container = document.getElementById('tradingview_chart_crypto');
        if (!container) return;

        container.innerHTML = '';

        if (tradingViewWidgetCrypto && typeof tradingViewWidgetCrypto.remove === 'function') {
            try {
                tradingViewWidgetCrypto.remove();
            } catch (e) {
                console.warn('[CryptoTechnicalAnalysis] Erro ao remover widget antigo', e);
            }
            tradingViewWidgetCrypto = null;
        }

        const isDarkMode = document.body.dataset.bsTheme === 'dark';
        const theme = isDarkMode ? 'dark' : 'light';
        const intervalMap = {
            '1m': '1',
            '5m': '5',
            '15m': '15',
            '1h': '60',
            '4h': '240',
            '1D': 'D',
            '1W': 'W',
            '1M': 'M'
        };
        const interval = intervalMap[timeframe] || 'M';
        const symbol = resolveTickerSymbol(ticker);

        renderStrikeOverlayCrypto();

        setTimeout(() => {
            if (!globalThis.TradingView) {
                const script = document.createElement('script');
                script.src = 'https://s3.tradingview.com/tv.js';
                script.async = true;
                script.onload = () => {
                    initTradingViewWidgetCrypto(symbol, interval, theme);
                    renderStrikeOverlayCrypto();
                };
                document.head.appendChild(script);
                return;
            }
            initTradingViewWidgetCrypto(symbol, interval, theme);
            renderStrikeOverlayCrypto();
        }, 80);
    }

    function generateMockHistoricalDataCrypto(periods) {
        const closes = [];
        const highs = [];
        const lows = [];
        const volumes = [];

        let price = 100 + Math.random() * 100;
        for (let i = 0; i < periods; i += 1) {
            const change = (Math.random() - 0.5) * 6;
            const open = price;
            price = Math.max(1, price + change);
            const high = Math.max(open, price) * (1 + Math.random() * 0.01);
            const low = Math.min(open, price) * (1 - Math.random() * 0.01);
            const volume = Math.floor(1000 + Math.random() * 10000);
            closes.push(price);
            highs.push(high);
            lows.push(low);
            volumes.push(volume);
        }

        return { closes, highs, lows, volumes };
    }

    function createGaugeChartCrypto(strength, textColor) {
        const canvas = document.getElementById('chartTecnicalGaugeCrypto');
        if (!canvas || typeof Chart === 'undefined') return;
        if (chartTecnicalGaugeCrypto) chartTecnicalGaugeCrypto.destroy();

        const normalizedValue = ((strength + 100) / 2);

        chartTecnicalGaugeCrypto = new Chart(canvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [normalizedValue, 100 - normalizedValue],
                    backgroundColor: [
                        getGaugeColor(strength),
                        'rgba(148, 163, 184, 0.1)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                circumference: 180,
                rotation: -90,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                    title: {
                        display: true,
                        text: strength.toFixed(1),
                        color: textColor,
                        font: { size: 28, weight: 'bold' },
                        padding: { top: 70 }
                    }
                }
            }
        });
    }

    function createOscillatorsChartCrypto(oscillators, textColor, gridColor) {
        const canvas = document.getElementById('chartTecnicalOscillatorsCrypto');
        if (!canvas || typeof Chart === 'undefined') return;
        if (chartTecnicalOscillatorsCrypto) chartTecnicalOscillatorsCrypto.destroy();

        chartTecnicalOscillatorsCrypto = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Compra', 'Neutro', 'Venda'],
                datasets: [{
                    data: [oscillators.buy, oscillators.neutral, oscillators.sell],
                    backgroundColor: ['#22c55e', '#94a3b8', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: textColor, stepSize: 1 },
                        grid: { color: gridColor }
                    },
                    y: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function createMovingAveragesChartCrypto(movingAverages, textColor, gridColor) {
        const canvas = document.getElementById('chartTecnicalMACrypto');
        if (!canvas || typeof Chart === 'undefined') return;
        if (chartTecnicalMACrypto) chartTecnicalMACrypto.destroy();

        chartTecnicalMACrypto = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Compra', 'Neutro', 'Venda'],
                datasets: [{
                    data: [movingAverages.buy, movingAverages.neutral, movingAverages.sell],
                    backgroundColor: ['#22c55e', '#94a3b8', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: textColor, stepSize: 1 },
                        grid: { color: gridColor }
                    },
                    y: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function fillOscillatorsTableCrypto(oscillators) {
        const tbody = document.querySelector('#tableOscillatorsCrypto tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const indicators = [
            { name: 'RSI (14)', value: oscillators.rsi?.toFixed(2) || '-', signal: getOscillatorSignal('rsi', oscillators.rsi) },
            { name: 'Stochastic %K', value: oscillators.stochastic?.k?.toFixed(2) || '-', signal: getOscillatorSignal('stochastic', oscillators.stochastic?.k) },
            { name: 'CCI (20)', value: oscillators.cci?.toFixed(2) || '-', signal: getOscillatorSignal('cci', oscillators.cci) },
            { name: 'ADX (14)', value: oscillators.adx?.toFixed(2) || '-', signal: 'Neutro' },
            { name: 'Williams %R', value: oscillators.williamsR?.toFixed(2) || '-', signal: getOscillatorSignal('williamsR', oscillators.williamsR) },
            { name: 'MACD', value: oscillators.macd?.histogram?.toFixed(4) || '-', signal: oscillators.macd?.histogram > 0 ? 'Compra' : 'Venda' }
        ];

        indicators.forEach(ind => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${ind.name}</td>
                <td>${ind.value}</td>
                <td><span class="badge bg-${getSignalColor(ind.signal)}">${ind.signal}</span></td>
            `;
        });
    }

    function fillMovingAveragesTableCrypto(movingAverages) {
        const tbody = document.querySelector('#tableMovingAveragesCrypto tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const currentPrice = movingAverages.sma20 || movingAverages.ema20 || 0;
        const mas = [
            { name: 'SMA (10)', value: movingAverages.sma10 },
            { name: 'SMA (20)', value: movingAverages.sma20 },
            { name: 'SMA (50)', value: movingAverages.sma50 },
            { name: 'SMA (100)', value: movingAverages.sma100 },
            { name: 'SMA (200)', value: movingAverages.sma200 },
            { name: 'EMA (10)', value: movingAverages.ema10 },
            { name: 'EMA (20)', value: movingAverages.ema20 },
            { name: 'EMA (50)', value: movingAverages.ema50 },
            { name: 'EMA (100)', value: movingAverages.ema100 },
            { name: 'EMA (200)', value: movingAverages.ema200 },
            { name: 'VWMA (20)', value: movingAverages.vwma },
            { name: 'HullMA (9)', value: movingAverages.hullma }
        ];

        mas.forEach(ma => {
            if (ma.value === null || ma.value === undefined) return;
            const signal = currentPrice > ma.value ? 'Compra' : 'Venda';
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${ma.name}</td>
                <td>${ma.value.toFixed(2)}</td>
                <td><span class="badge bg-${getSignalColor(signal)}">${signal}</span></td>
            `;
        });
    }

    async function loadAndAnalyzeTechnicalDataCrypto(ticker, timeframe) {
        try {
            const historicalData = generateMockHistoricalDataCrypto(220);
            const { highs, lows, closes, volumes } = historicalData;
            const analysis = technicalAnalyzerCrypto.analyzeAll(highs, lows, closes, volumes);
            const formatted = technicalAnalyzerCrypto.formatAnalysisForDisplay(analysis);

            const recEl = document.getElementById('tecnicalRecommendationCrypto');
            const recSubEl = document.getElementById('tecnicalRecommendationSubtextCrypto');
            if (recEl) {
                recEl.textContent = formatted.recommendation;
                recEl.className = `mb-2 text-${getRecommendationColor(formatted.overall.signal)}`;
            }
            if (recSubEl) {
                recSubEl.textContent = `Baseado em ${formatted.oscillators.total + formatted.movingAverages.total} indicadores`;
            }

            const oscBuy = document.getElementById('oscBuyCountCrypto');
            const oscNeutral = document.getElementById('oscNeutralCountCrypto');
            const oscSell = document.getElementById('oscSellCountCrypto');
            const maBuy = document.getElementById('maBuyCountCrypto');
            const maNeutral = document.getElementById('maNeutralCountCrypto');
            const maSell = document.getElementById('maSellCountCrypto');
            if (oscBuy) oscBuy.textContent = `${formatted.oscillators.buy} Compra`;
            if (oscNeutral) oscNeutral.textContent = `${formatted.oscillators.neutral} Neutro`;
            if (oscSell) oscSell.textContent = `${formatted.oscillators.sell} Venda`;
            if (maBuy) maBuy.textContent = `${formatted.movingAverages.buy} Compra`;
            if (maNeutral) maNeutral.textContent = `${formatted.movingAverages.neutral} Neutro`;
            if (maSell) maSell.textContent = `${formatted.movingAverages.sell} Venda`;

            const isDarkMode = document.body.dataset.bsTheme === 'dark';
            const textColor = isDarkMode ? '#f8f9fa' : '#666666';
            const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

            createGaugeChartCrypto(formatted.strength, textColor);
            createOscillatorsChartCrypto(formatted.oscillators, textColor, gridColor);
            createMovingAveragesChartCrypto(formatted.movingAverages, textColor, gridColor);
            fillOscillatorsTableCrypto(analysis.raw.oscillators);
            fillMovingAveragesTableCrypto(analysis.raw.movingAverages);

            const loadingEl = document.getElementById('tecnicalLoadingCrypto');
            const contentEl = document.getElementById('tecnicalContentCrypto');
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
        } catch (error) {
            console.error('[CryptoTechnicalAnalysis] Erro na análise técnica:', error);
            const loadingEl = document.getElementById('tecnicalLoadingCrypto');
            if (loadingEl) loadingEl.style.display = 'none';
            if (globalThis.iziToast) {
                iziToast.error({ title: 'Erro', message: 'Erro ao processar análise técnica.' });
            }
        }
    }

    function bindTimeframeHandlersCrypto() {
        document.querySelectorAll('input[name="timeframeCrypto"]').forEach(radio => {
            if (radio.dataset.bound === 'true') return;
            radio.dataset.bound = 'true';
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                const ativoBase = getActiveTickerCrypto();
                if (!ativoBase) return;
                const tf = radio.value;
                if (tradingViewWidgetCrypto) {
                    loadTradingViewChartCrypto(ativoBase, tf);
                }
                const loadingEl = document.getElementById('tecnicalLoadingCrypto');
                const contentEl = document.getElementById('tecnicalContentCrypto');
                if (loadingEl) loadingEl.style.display = 'block';
                if (contentEl) contentEl.style.display = 'none';
                loadAndAnalyzeTechnicalDataCrypto(ativoBase, tf);
            });
        });
    }

    async function openTechnicalAnalysisModalCrypto(ativoBaseInput) {
        const context = normalizeAnalysisContextCrypto(ativoBaseInput);
        const ativoBase = context.ticker;
        if (!ativoBase) {
            if (globalThis.iziToast) iziToast.warning({ title: 'Atenção', message: 'Ativo não informado para análise técnica.' });
            return;
        }

        currentAnalysisContextCrypto = context;

        await refreshCurrentPriceFromApiCrypto(currentAnalysisContextCrypto);

        const modalEl = document.getElementById('modalAnaliseTecnicaCrypto');
        if (!modalEl) {
            if (globalThis.iziToast) iziToast.error({ title: 'Erro', message: 'Modal de análise técnica crypto não encontrado.' });
            return;
        }

        if (!technicalAnalyzerCrypto) {
            if (typeof globalThis.TechnicalAnalysis !== 'function') {
                if (globalThis.iziToast) iziToast.error({ title: 'Erro', message: 'Módulo de análise técnica não carregado.' });
                return;
            }
            technicalAnalyzerCrypto = new globalThis.TechnicalAnalysis();
        }

        const titleEl = document.getElementById('tecnicalAtivoTitleCrypto');
        if (titleEl) titleEl.textContent = ativoBase;

        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl, {
            backdrop: true,
            keyboard: true
        });

        const loadingEl = document.getElementById('tecnicalLoadingCrypto');
        const contentEl = document.getElementById('tecnicalContentCrypto');
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';

        resetInitialTimeframeCrypto();

        const accordionCollapse = document.getElementById('collapseTradingViewCrypto');
        if (accordionCollapse && accordionCollapse.dataset.bound !== 'true') {
            accordionCollapse.dataset.bound = 'true';
            accordionCollapse.addEventListener('shown.bs.collapse', () => {
                reloadTradingViewChartCrypto();
            });
        }

        bindTimeframeHandlersCrypto();
        bindReloadChartButtonCrypto();
        modal.show();

        if (accordionCollapse?.classList.contains('show') || tradingViewWidgetCrypto) {
            await reloadTradingViewChartCrypto();
        } else {
            renderStrikeOverlayCrypto();
        }

        await loadAndAnalyzeTechnicalDataCrypto(ativoBase, getSelectedTimeframeCrypto());
    }

    globalThis.CryptoTechnicalAnalysis = {
        open: openTechnicalAnalysisModalCrypto,
        openFromOperation: openTechnicalAnalysisModalCrypto,
        reloadChart: reloadTradingViewChartCrypto
    };
})();
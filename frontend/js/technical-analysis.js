/**
 * Technical Analysis Module
 * Cálculos de indicadores técnicos baseados no padrão TradingView
 * Osciladores, Médias Móveis e Indicadores de Tendência
 */

class TechnicalAnalysis {
    constructor() {
        this.timeframes = {
            '1m': 1,
            '5m': 5,
            '15m': 15,
            '1h': 60,
            '4h': 240,
            '1D': 1440
        };
    }

    // ============= MÉDIAS MÓVEIS =============
    
    /**
     * Calcula SMA (Simple Moving Average)
     */
    calculateSMA(data, period) {
        if (data.length < period) return null;
        const sum = data.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    /**
     * Calcula EMA (Exponential Moving Average)
     */
    calculateEMA(data, period) {
        if (data.length < period) return null;
        
        const multiplier = 2 / (period + 1);
        let ema = this.calculateSMA(data.slice(0, period), period);
        
        for (let i = period; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }
        
        return ema;
    }

    // ============= OSCILADORES =============
    
    /**
     * Calcula RSI (Relative Strength Index)
     */
    calculateRSI(data, period = 14) {
        if (data.length < period + 1) return null;

        let gains = 0;
        let losses = 0;

        // Primeira média
        for (let i = 1; i <= period; i++) {
            const change = data[i] - data[i - 1];
            if (change >= 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        // RSI subsequentes com smoothing
        for (let i = period + 1; i < data.length; i++) {
            const change = data[i] - data[i - 1];
            if (change >= 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - change) / period;
            }
        }

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    /**
     * Calcula MACD (Moving Average Convergence Divergence)
     */
    calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (data.length < slowPeriod) return null;

        const emaFast = this.calculateEMA(data, fastPeriod);
        const emaSlow = this.calculateEMA(data, slowPeriod);
        
        if (!emaFast || !emaSlow) return null;
        
        const macdLine = emaFast - emaSlow;
        
        // Calcular Signal Line (EMA do MACD)
        const macdHistory = [];
        for (let i = slowPeriod - 1; i < data.length; i++) {
            const fast = this.calculateEMA(data.slice(0, i + 1), fastPeriod);
            const slow = this.calculateEMA(data.slice(0, i + 1), slowPeriod);
            macdHistory.push(fast - slow);
        }
        
        const signalLine = this.calculateEMA(macdHistory, signalPeriod);
        const histogram = macdLine - signalLine;

        return {
            macd: macdLine,
            signal: signalLine,
            histogram: histogram
        };
    }

    /**
     * Calcula Stochastic Oscillator
     */
    calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
        if (closes.length < kPeriod) return null;

        const lastClose = closes[closes.length - 1];
        const periodHigh = Math.max(...highs.slice(-kPeriod));
        const periodLow = Math.min(...lows.slice(-kPeriod));

        const k = ((lastClose - periodLow) / (periodHigh - periodLow)) * 100;
        
        // %D é a média móvel de %K
        const kValues = [];
        for (let i = kPeriod - 1; i < closes.length; i++) {
            const high = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
            const low = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
            const close = closes[i];
            kValues.push(((close - low) / (high - low)) * 100);
        }
        
        const d = this.calculateSMA(kValues.slice(-dPeriod), dPeriod);

        return { k, d };
    }

    /**
     * Calcula CCI (Commodity Channel Index)
     */
    calculateCCI(highs, lows, closes, period = 20) {
        if (closes.length < period) return null;

        const typicalPrices = closes.map((close, i) => 
            (highs[i] + lows[i] + close) / 3
        );

        const sma = this.calculateSMA(typicalPrices, period);
        
        // Mean Deviation
        const deviations = typicalPrices.slice(-period).map(tp => Math.abs(tp - sma));
        const meanDeviation = deviations.reduce((a, b) => a + b, 0) / period;

        const currentTypicalPrice = typicalPrices[typicalPrices.length - 1];
        const cci = (currentTypicalPrice - sma) / (0.015 * meanDeviation);

        return cci;
    }

    /**
     * Calcula ADX (Average Directional Index)
     */
    calculateADX(highs, lows, closes, period = 14) {
        if (closes.length < period + 1) return null;

        const trueRanges = [];
        const plusDMs = [];
        const minusDMs = [];

        for (let i = 1; i < closes.length; i++) {
            const high = highs[i];
            const low = lows[i];
            const prevHigh = highs[i - 1];
            const prevLow = lows[i - 1];
            const prevClose = closes[i - 1];

            // True Range
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trueRanges.push(tr);

            // Directional Movement
            const plusDM = high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0;
            const minusDM = prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0;
            
            plusDMs.push(plusDM);
            minusDMs.push(minusDM);
        }

        const atr = this.calculateSMA(trueRanges.slice(-period), period);
        const plusDI = (this.calculateSMA(plusDMs.slice(-period), period) / atr) * 100;
        const minusDI = (this.calculateSMA(minusDMs.slice(-period), period) / atr) * 100;

        const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
        
        // ADX é a média móvel do DX
        const dxValues = [];
        for (let i = period; i < trueRanges.length; i++) {
            const atr_i = this.calculateSMA(trueRanges.slice(i - period, i), period);
            const plusDI_i = (this.calculateSMA(plusDMs.slice(i - period, i), period) / atr_i) * 100;
            const minusDI_i = (this.calculateSMA(minusDMs.slice(i - period, i), period) / atr_i) * 100;
            dxValues.push((Math.abs(plusDI_i - minusDI_i) / (plusDI_i + minusDI_i)) * 100);
        }

        const adx = this.calculateSMA(dxValues.slice(-period), period);

        return adx;
    }

    /**
     * Calcula Williams %R
     */
    calculateWilliamsR(highs, lows, closes, period = 14) {
        if (closes.length < period) return null;

        const highestHigh = Math.max(...highs.slice(-period));
        const lowestLow = Math.min(...lows.slice(-period));
        const lastClose = closes[closes.length - 1];

        return ((highestHigh - lastClose) / (highestHigh - lowestLow)) * -100;
    }

    /**
     * Calcula Bull/Bear Power
     */
    calculateBullBearPower(highs, lows, closes, period = 13) {
        if (closes.length < period) return null;

        const ema = this.calculateEMA(closes, period);
        const lastHigh = highs[highs.length - 1];
        const lastLow = lows[lows.length - 1];

        return {
            bull: lastHigh - ema,
            bear: lastLow - ema
        };
    }

    // ============= ANÁLISE DE TENDÊNCIA =============

    /**
     * Calcula Ichimoku Cloud
     */
    calculateIchimoku(highs, lows, closes) {
        if (closes.length < 52) return null;

        // Tenkan-sen (9 períodos)
        const tenkanHigh = Math.max(...highs.slice(-9));
        const tenkanLow = Math.min(...lows.slice(-9));
        const tenkan = (tenkanHigh + tenkanLow) / 2;

        // Kijun-sen (26 períodos)
        const kijunHigh = Math.max(...highs.slice(-26));
        const kijunLow = Math.min(...lows.slice(-26));
        const kijun = (kijunHigh + kijunLow) / 2;

        // Senkou Span A
        const senkouA = (tenkan + kijun) / 2;

        // Senkou Span B (52 períodos)
        const senkouBHigh = Math.max(...highs.slice(-52));
        const senkouBLow = Math.min(...lows.slice(-52));
        const senkouB = (senkouBHigh + senkouBLow) / 2;

        const currentPrice = closes[closes.length - 1];
        
        return {
            tenkan,
            kijun,
            senkouA,
            senkouB,
            signal: currentPrice > Math.max(senkouA, senkouB) ? 'BUY' : 
                   currentPrice < Math.min(senkouA, senkouB) ? 'SELL' : 'NEUTRAL'
        };
    }

    /**
     * Calcula VWMA (Volume Weighted Moving Average)
     */
    calculateVWMA(closes, volumes, period = 20) {
        if (closes.length < period) return null;

        const recentCloses = closes.slice(-period);
        const recentVolumes = volumes.slice(-period);

        const sumPriceVolume = recentCloses.reduce((sum, price, i) => 
            sum + (price * recentVolumes[i]), 0
        );
        const sumVolume = recentVolumes.reduce((a, b) => a + b, 0);

        return sumPriceVolume / sumVolume;
    }

    /**
     * Calcula HullMA (Hull Moving Average)
     */
    calculateHullMA(data, period = 9) {
        if (data.length < period) return null;

        const halfPeriod = Math.floor(period / 2);
        const sqrtPeriod = Math.floor(Math.sqrt(period));

        const wma1 = this.calculateWMA(data, halfPeriod);
        const wma2 = this.calculateWMA(data, period);
        
        if (!wma1 || !wma2) return null;

        const rawHull = 2 * wma1 - wma2;
        
        // WMA do resultado
        return rawHull; // Simplificado
    }

    /**
     * Calcula WMA (Weighted Moving Average)
     */
    calculateWMA(data, period) {
        if (data.length < period) return null;

        const recentData = data.slice(-period);
        const weights = Array.from({length: period}, (_, i) => i + 1);
        const weightedSum = recentData.reduce((sum, value, i) => 
            sum + (value * weights[i]), 0
        );
        const sumWeights = weights.reduce((a, b) => a + b, 0);

        return weightedSum / sumWeights;
    }

    // ============= ANÁLISE CONSOLIDADA =============

    /**
     * Analisa todos os indicadores e retorna recomendação consolidada
     */
    analyzeAll(highs, lows, closes, volumes) {
        const currentPrice = closes[closes.length - 1];
        
        // OSCILADORES
        const oscillators = {
            rsi: this.calculateRSI(closes, 14),
            stochastic: this.calculateStochastic(highs, lows, closes, 14, 3),
            cci: this.calculateCCI(highs, lows, closes, 20),
            adx: this.calculateADX(highs, lows, closes, 14),
            williamsR: this.calculateWilliamsR(highs, lows, closes, 14),
            macd: this.calculateMACD(closes, 12, 26, 9),
            bullBear: this.calculateBullBearPower(highs, lows, closes, 13)
        };

        // MÉDIAS MÓVEIS
        const movingAverages = {
            sma10: this.calculateSMA(closes, 10),
            sma20: this.calculateSMA(closes, 20),
            sma30: this.calculateSMA(closes, 30),
            sma50: this.calculateSMA(closes, 50),
            sma100: this.calculateSMA(closes, 100),
            sma200: this.calculateSMA(closes, 200),
            ema10: this.calculateEMA(closes, 10),
            ema20: this.calculateEMA(closes, 20),
            ema30: this.calculateEMA(closes, 30),
            ema50: this.calculateEMA(closes, 50),
            ema100: this.calculateEMA(closes, 100),
            ema200: this.calculateEMA(closes, 200),
            vwma: this.calculateVWMA(closes, volumes, 20),
            hullma: this.calculateHullMA(closes, 9),
            ichimoku: this.calculateIchimoku(highs, lows, closes)
        };

        // SINAIS DOS OSCILADORES
        const oscillatorSignals = this.evaluateOscillators(oscillators);
        
        // SINAIS DAS MÉDIAS MÓVEIS
        const maSignals = this.evaluateMovingAverages(movingAverages, currentPrice);

        // CONSOLIDAÇÃO FINAL
        const summary = {
            oscillators: oscillatorSignals,
            movingAverages: maSignals,
            overall: this.calculateOverallSignal(oscillatorSignals, maSignals)
        };

        return {
            summary,
            raw: {
                oscillators,
                movingAverages
            }
        };
    }

    /**
     * Avalia sinais dos osciladores
     */
    evaluateOscillators(osc) {
        let buy = 0, sell = 0, neutral = 0;

        // RSI
        if (osc.rsi < 30) buy++;
        else if (osc.rsi > 70) sell++;
        else neutral++;

        // Stochastic
        if (osc.stochastic && osc.stochastic.k < 20) buy++;
        else if (osc.stochastic && osc.stochastic.k > 80) sell++;
        else neutral++;

        // CCI
        if (osc.cci < -100) buy++;
        else if (osc.cci > 100) sell++;
        else neutral++;

        // ADX (força da tendência, não direção)
        if (osc.adx > 25) {
            // Tendência forte, mas precisamos de outro indicador para direção
            neutral++;
        } else {
            neutral++;
        }

        // Williams %R
        if (osc.williamsR < -80) buy++;
        else if (osc.williamsR > -20) sell++;
        else neutral++;

        // MACD
        if (osc.macd && osc.macd.histogram > 0) buy++;
        else if (osc.macd && osc.macd.histogram < 0) sell++;
        else neutral++;

        // Bull/Bear Power
        if (osc.bullBear && osc.bullBear.bull > 0 && osc.bullBear.bear > 0) buy++;
        else if (osc.bullBear && osc.bullBear.bull < 0 && osc.bullBear.bear < 0) sell++;
        else neutral++;

        return { buy, sell, neutral, total: buy + sell + neutral };
    }

    /**
     * Avalia sinais das médias móveis
     */
    evaluateMovingAverages(ma, currentPrice) {
        let buy = 0, sell = 0, neutral = 0;

        const mas = [
            ma.sma10, ma.sma20, ma.sma30, ma.sma50, ma.sma100, ma.sma200,
            ma.ema10, ma.ema20, ma.ema30, ma.ema50, ma.ema100, ma.ema200,
            ma.vwma, ma.hullma
        ];

        mas.forEach(value => {
            if (value === null) {
                neutral++;
            } else if (currentPrice > value) {
                buy++;
            } else {
                sell++;
            }
        });

        // Ichimoku
        if (ma.ichimoku) {
            if (ma.ichimoku.signal === 'BUY') buy++;
            else if (ma.ichimoku.signal === 'SELL') sell++;
            else neutral++;
        } else {
            neutral++;
        }

        return { buy, sell, neutral, total: buy + sell + neutral };
    }

    /**
     * Calcula sinal geral consolidado
     */
    calculateOverallSignal(oscSignals, maSignals) {
        const totalBuy = oscSignals.buy + maSignals.buy;
        const totalSell = oscSignals.sell + maSignals.sell;
        const totalNeutral = oscSignals.neutral + maSignals.neutral;
        const total = totalBuy + totalSell + totalNeutral;

        const buyPercent = (totalBuy / total) * 100;
        const sellPercent = (totalSell / total) * 100;

        let signal = 'NEUTRAL';
        if (buyPercent > 60) signal = 'STRONG_BUY';
        else if (buyPercent > 50) signal = 'BUY';
        else if (sellPercent > 60) signal = 'STRONG_SELL';
        else if (sellPercent > 50) signal = 'SELL';

        return {
            signal,
            buy: totalBuy,
            sell: totalSell,
            neutral: totalNeutral,
            total,
            buyPercent: buyPercent.toFixed(1),
            sellPercent: sellPercent.toFixed(1)
        };
    }

    /**
     * Formata o resultado da análise para exibição
     */
    formatAnalysisForDisplay(analysis) {
        const { summary } = analysis;
        
        return {
            overall: summary.overall,
            oscillators: summary.oscillators,
            movingAverages: summary.movingAverages,
            recommendation: this.getRecommendationText(summary.overall.signal),
            strength: this.getStrengthValue(summary.overall)
        };
    }

    /**
     * Retorna texto de recomendação
     */
    getRecommendationText(signal) {
        const texts = {
            'STRONG_BUY': 'Compra Forte',
            'BUY': 'Compra',
            'NEUTRAL': 'Neutro',
            'SELL': 'Venda',
            'STRONG_SELL': 'Venda Forte'
        };
        return texts[signal] || 'Neutro';
    }

    /**
     * Retorna valor numérico de força (-100 a +100)
     */
    getStrengthValue(overall) {
        const buyPercent = parseFloat(overall.buyPercent);
        const sellPercent = parseFloat(overall.sellPercent);
        return buyPercent - sellPercent; // -100 (venda forte) a +100 (compra forte)
    }
}

// Exportar para uso global
window.TechnicalAnalysis = TechnicalAnalysis;

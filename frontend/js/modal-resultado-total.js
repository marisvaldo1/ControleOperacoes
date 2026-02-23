(function () {
    const state = {
        period: '60d',
        chart: null,
        loading: false,
        updating: false
    };

    function parseDate(value) {
        if (!value) return null;
        if (typeof parseDateInput === 'function') {
            const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
            const dateTime = /^\d{4}-\d{2}-\d{2}T/;
            const brDate = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;
            const str = String(value).trim();
            if (dateOnly.test(str) || dateTime.test(str)) {
                const dateStr = dateTime.test(str) ? str.slice(0, 10) : str;
                const parsed = parseDateInput(dateStr);
                if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
            }
            const brMatch = str.match(brDate);
            if (brMatch) {
                const day = Number(brMatch[1]);
                const month = Number(brMatch[2]) - 1;
                const year = Number(brMatch[3]);
                const hour = Number(brMatch[4] || 0);
                const minute = Number(brMatch[5] || 0);
                const second = Number(brMatch[6] || 0);
                return new Date(year, month, day, hour, minute, second);
            }
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return date;
    }

    function getOpDate(op) {
        if (op.data_operacao) return parseDate(op.data_operacao);
        return parseDate(op.created_at) || parseDate(op.data_fechamento) || parseDate(op.vencimento);
    }

    function getOpVencimentoDate(op) {
        return parseDate(op.vencimento);
    }

    function getOpResultado(op) {
        const status = String(op.status || '').toUpperCase();
        const tipoOperacao = String(op.tipo_operacao || '').toUpperCase();
        const qtd = parseFloat(op.quantidade) || 0;
        const premio = parseFloat(op.premio) || 0;
        const resultado = parseFloat(op.resultado);
        const isVenda = tipoOperacao === 'VENDA' || (!tipoOperacao && qtd < 0);
        if (status === 'ABERTA' && isVenda) {
            const esperado = Math.abs(qtd) * Math.abs(premio);
            if (Number.isFinite(esperado) && esperado > 0) return esperado;
            if (Number.isFinite(resultado)) return Math.abs(resultado);
            return 0;
        }
        return Number.isFinite(resultado) ? resultado : 0;
    }

    function formatPercent(value) {
        return `${value.toFixed(2)}%`;
    }

    function formatCurrency(value, currency = 'BRL') {
        if (typeof window.formatCurrency === 'function') return window.formatCurrency(value, currency);
        if (value === null || value === undefined) return '-';
        const numeric = Number.isFinite(value) ? value : parseFloat(value) || 0;
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2
        }).format(numeric);
    }

    function normalizeDateKey(date) {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function setLoadingState(isLoading) {
        const modal = document.getElementById('modalResultadoTotal');
        if (!modal) return;
        modal.classList.toggle('rt-loading', isLoading);

        const refreshBtn = document.getElementById('rtRefreshButton');
        if (refreshBtn) {
            refreshBtn.disabled = isLoading;
            refreshBtn.classList.toggle('is-loading', isLoading);
        }

        const statusEl = document.getElementById('rtRefreshStatus');
        if (statusEl && isLoading) statusEl.textContent = 'Atualizando...';

        const aiStatus = document.getElementById('rtAiStatus');
        if (aiStatus && isLoading) aiStatus.textContent = 'Atualizando insights...';

        const textIds = [
            'rtHeroTotal', 'rtHeroSaldo', 'rtHeroRoi', 'rtHeroOps', 'rtHeroWinRate', 'rtHeroProfitFactor',
            'rtHeroStreak', 'rtHeroBestDay',
            'rtTotal', 'rtMediaDia', 'rtDiasUteis', 'rtWinRate', 'rtRoi',
            'rtCatAcerto', 'rtCatRent', 'rtCatConsistencia', 'rtCatRisco',
            'rtSumGains', 'rtSumLosses', 'rtSumNet', 'rtSumPerDay',
            'rtWinCount', 'rtLossCount', 'rtWinLossHint',
            'rtChartWinRate', 'rtChartLossRate', 'rtBestDay', 'rtCalendarTitle',
            'rtMetricGains', 'rtMetricLosses', 'rtMetricNet', 'rtMetricPerDay', 'rtMetricRoi',
            'rtMetricWinRate', 'rtMetricProfitFactor', 'rtMetricExpectancy', 'rtMetricPayoff', 'rtMetricConsistency',
            'rtMetricDrawdown', 'rtMetricDrawdownAvg', 'rtMetricRiskReward', 'rtMetricLossSeq', 'rtMetricVolatility',
            'rtMetricAvgOp', 'rtMetricAvgWin', 'rtMetricAvgLoss', 'rtMetricOpsPerDay', 'rtMetricAvgDuration', 'rtMetricDaysOperated',
            'rtMonthPositiveDays', 'rtMonthNegativeDays', 'rtMonthPositiveRate', 'rtMonthAvgDay'
        ];

        textIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (isLoading) {
                el.dataset.previous = el.textContent || '';
                el.textContent = '...';
                el.classList.add('rt-loading-text');
            } else {
                el.classList.remove('rt-loading-text');
            }
        });

        const barIds = [
            'rtWinBar', 'rtLossBar', 'rtChartWinBar', 'rtChartLossBar',
            'rtCatAcertoBar', 'rtCatRentBar', 'rtCatConsistenciaBar', 'rtCatRiscoBar'
        ];
        if (isLoading) {
            barIds.forEach(id => {
                const bar = document.getElementById(id);
                if (bar) bar.style.width = '0%';
            });

            const containers = [
                { id: 'rtAiInsights', text: '<div class="rt-ai-card"><div class="rt-ai-title">Insights</div><div class="rt-ai-list"><div class="rt-ai-item">Carregando insights...</div></div></div>' },
                { id: 'rtAssetPerformance', text: 'Carregando...' },
                { id: 'rtRecordsBest', text: 'Carregando...' },
                { id: 'rtRecordsWorst', text: 'Carregando...' },
                { id: 'rtGoalsGrid', text: 'Carregando...' },
                { id: 'rtComparisonList', text: 'Carregando...' },
                { id: 'rtHistoryBody', text: '<tr><td colspan="8" class="text-muted">Carregando...</td></tr>' }
            ];
            containers.forEach(item => {
                const el = document.getElementById(item.id);
                if (el) el.innerHTML = item.text;
            });
        }
    }

    function getPeriodRange(period) {
        const now = new Date();
        let start = null;
        let end = new Date(now);

        if (period === '7d') start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (period === '30d') start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (period === '60d') start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        if (period === '90d') start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        if (period === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }

        if (period === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        }

        if (period === 'lastyear') {
            const year = now.getFullYear() - 1;
            start = new Date(year, 0, 1);
            end = new Date(year, 11, 31, 23, 59, 59, 999);
        }

        if (period === '12m') {
            start = new Date(now);
            start.setMonth(start.getMonth() - 12);
        }

        return { start, end };
    }

    function filterOpsByRange(ops, range) {
        if (!range || !range.start || !range.end) return ops;
        return ops.filter(op => {
            const date = getOpDate(op);
            return date && date >= range.start && date <= range.end;
        });
    }

    function getFilteredOps() {
        const ops = Array.isArray(window.allOperacoes) ? window.allOperacoes : [];
        const period = state.period;
        const range = getPeriodRange(period);
        return filterOpsByRange(ops, range);
    }

    function getPreviousOps() {
        const ops = Array.isArray(window.allOperacoes) ? window.allOperacoes : [];
        const period = state.period;
        const range = getPeriodRange(period);
        if (!range.start || !range.end) return [];
        const diff = range.end.getTime() - range.start.getTime();
        const prevEnd = new Date(range.start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - diff);
        return filterOpsByRange(ops, { start: prevStart, end: prevEnd });
    }

    function getOpCloseDate(op) {
        return parseDate(op.data_fechamento) || parseDate(op.closed_at) || parseDate(op.updated_at);
    }

    function getEntryPrice(op) {
        const value = op.preco_entrada ?? op.premio ?? op.preco_abertura ?? op.preco;
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getExitPrice(op) {
        const value = op.preco_saida ?? op.preco_fechamento ?? op.preco_atual;
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getOpType(op) {
        const tipo = String(op.tipo || '').toUpperCase();
        const operacao = String(op.tipo_operacao || '').toUpperCase();
        if (operacao) return `${operacao}${tipo ? ` ${tipo}` : ''}`.trim();
        if (tipo) return tipo;
        return 'OPÇÃO';
    }

    function formatDurationDays(days) {
        if (!Number.isFinite(days)) return '-';
        return `${days} dias`;
    }

    function getOpDurationDays(op) {
        const start = parseDate(op.data_operacao);
        const end = getOpVencimentoDate(op);
        if (!start || !end) return null;
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
        if (!Number.isFinite(diff) || diff < 0) return null;
        return diff;
    }

    function formatDateTime(value) {
        const date = parseDate(value);
        if (!date) return '-';
        return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function stripMarkdown(text) {
        return text
            .replace(/[*_`]/g, '')
            .replace(/\*\*/g, '')
            .replace(/#+\s*/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function calcSummary(ops) {
        const totals = {
            total: 0,
            wins: 0,
            losses: 0,
            winSum: 0,
            lossSum: 0,
            totalOps: ops.length,
            positiveDays: 0,
            daysWithOps: 0
        };

        const dailyMap = new Map();

        ops.forEach(op => {
            const result = getOpResultado(op);
            totals.total += result;
            if (result > 0) {
                totals.wins += 1;
                totals.winSum += result;
            }
            if (result < 0) {
                totals.losses += 1;
                totals.lossSum += result;
            }

            const date = getOpDate(op);
            if (date) {
                const key = normalizeDateKey(date);
                dailyMap.set(key, (dailyMap.get(key) || 0) + result);
            }
        });

        dailyMap.forEach(value => {
            totals.daysWithOps += 1;
            if (value > 0) totals.positiveDays += 1;
        });

        totals.dailyMap = dailyMap;
        return totals;
    }

    function updateSummaryCards(summary, metrics) {
        const mediaDia = metrics.mediaDia;
        const winRate = metrics.winRate;
        const roi = metrics.roi;

        const totalEl = document.getElementById('rtTotal');
        const mediaEl = document.getElementById('rtMediaDia');
        const diasEl = document.getElementById('rtDiasUteis');
        const winEl = document.getElementById('rtWinRate');
        const roiEl = document.getElementById('rtRoi');

        if (totalEl) {
            totalEl.textContent = formatCurrency(summary.total, 'BRL');
            totalEl.classList.toggle('text-danger', summary.total < 0);
            totalEl.classList.toggle('text-green', summary.total >= 0);
        }
        if (mediaEl) mediaEl.textContent = formatCurrency(mediaDia, 'BRL');
        if (diasEl) diasEl.textContent = summary.daysWithOps.toString();
        if (winEl) winEl.textContent = formatPercent(winRate);
        if (roiEl) roiEl.textContent = formatPercent(roi);

        updateCategoryMetrics(summary, winRate, roi);
    }

    function updateCategoryMetrics(summary, winRate, roi) {
        const avgWin = summary.wins > 0 ? summary.winSum / summary.wins : 0;
        const avgLoss = summary.losses > 0 ? Math.abs(summary.lossSum / summary.losses) : 0;
        const payoff = avgLoss > 0 ? avgWin / avgLoss : 0;
        const consistencia = summary.daysWithOps > 0 ? (summary.positiveDays / summary.daysWithOps) * 100 : 0;

        const acertoEl = document.getElementById('rtCatAcerto');
        const rentEl = document.getElementById('rtCatRent');
        const consEl = document.getElementById('rtCatConsistencia');
        const riscoEl = document.getElementById('rtCatRisco');

        const acertoBar = document.getElementById('rtCatAcertoBar');
        const rentBar = document.getElementById('rtCatRentBar');
        const consBar = document.getElementById('rtCatConsistenciaBar');
        const riscoBar = document.getElementById('rtCatRiscoBar');

        if (acertoEl) acertoEl.textContent = formatPercent(winRate);
        if (rentEl) rentEl.textContent = formatPercent(roi);
        if (consEl) consEl.textContent = formatPercent(consistencia);
        if (riscoEl) riscoEl.textContent = Number.isFinite(payoff) ? payoff.toFixed(2) : '0';

        if (acertoBar) acertoBar.style.width = `${Math.min(100, winRate)}%`;
        if (rentBar) rentBar.style.width = `${Math.min(100, Math.max(0, roi))}%`;
        if (consBar) consBar.style.width = `${Math.min(100, consistencia)}%`;
        if (riscoBar) {
            const ratioWidth = Math.min(100, (payoff / 3) * 100);
            riscoBar.style.width = `${Math.max(0, ratioWidth)}%`;
        }
    }

    function renderCalendar(summary, ops) {
        const calendarTitle = document.getElementById('rtCalendarTitle');
        const calendarGrid = document.getElementById('rtCalendarGrid');
        if (!calendarGrid) return;

        const referenceDate = (() => {
            if (ops.length > 0) {
                const sorted = [...ops].sort((a, b) => getOpDate(b) - getOpDate(a));
                const date = getOpDate(sorted[0]);
                return date || new Date();
            }
            return new Date();
        })();

        const year = referenceDate.getFullYear();
        const month = referenceDate.getMonth();
        const monthName = referenceDate.toLocaleString('pt-BR', { month: 'long' });
        if (calendarTitle) {
            calendarTitle.textContent = `Calendário de Performance - ${monthName} ${year}`;
        }

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startWeekday = firstDay.getDay();
        const totalDays = lastDay.getDate();

        calendarGrid.innerHTML = '';
        for (let i = 0; i < startWeekday; i += 1) {
            const empty = document.createElement('div');
            empty.className = 'rt-day empty';
            calendarGrid.appendChild(empty);
        }

        let maxPositive = 0;
        summary.dailyMap.forEach(value => {
            if (value > maxPositive) maxPositive = value;
        });

        for (let day = 1; day <= totalDays; day += 1) {
            const date = new Date(year, month, day);
            const key = normalizeDateKey(date);
            const value = summary.dailyMap.get(key) || 0;
            const dayEl = document.createElement('div');
            dayEl.className = 'rt-day';

            if (value > 0) {
                dayEl.classList.add('positive');
                if (maxPositive > 0) {
                    const ratio = value / maxPositive;
                    if (ratio > 0.66) dayEl.classList.add('high');
                    else if (ratio > 0.33) dayEl.classList.add('mid');
                    else dayEl.classList.add('low');
                } else {
                    dayEl.classList.add('low');
                }
            } else if (value < 0) {
                dayEl.classList.add('negative');
            }

            const today = new Date();
            if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
                dayEl.classList.add('today');
            }

            const dayNumber = document.createElement('div');
            dayNumber.className = 'rt-day-number';
            dayNumber.textContent = day.toString();

            const dayValue = document.createElement('div');
            dayValue.className = 'rt-day-value';
            dayValue.textContent = value !== 0 ? formatCurrency(value, 'BRL') : '';

            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            dayEl.classList.add('rt-week-clickable');
            dayEl.addEventListener('click', () => {
                if (typeof showWeekOperations === 'function') {
                    showWeekOperations(weekStart, weekEnd);
                }
            });

            dayEl.appendChild(dayNumber);
            dayEl.appendChild(dayValue);
            calendarGrid.appendChild(dayEl);
        }
    }

    function renderWeekdayList(summary) {
        const container = document.getElementById('rtWeekdayList');
        if (!container) return;

        const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const totals = new Array(7).fill(0);

        summary.dailyMap.forEach((value, key) => {
            const date = new Date(`${key}T00:00:00`);
            const dayIndex = date.getDay();
            totals[dayIndex] += value;
        });

        const maxAbs = Math.max(...totals.map(v => Math.abs(v)), 1);
        container.innerHTML = '';

        let bestIndex = -1;
        let bestValue = -Infinity;
        totals.forEach((value, idx) => {
            if (value > bestValue) {
                bestValue = value;
                bestIndex = idx;
            }
        });

        totals.forEach((value, idx) => {
            const item = document.createElement('div');
            item.className = 'rt-weekday-item';

            const label = document.createElement('div');
            label.className = 'rt-weekday-label';
            label.textContent = labels[idx];

            const bar = document.createElement('div');
            bar.className = 'rt-weekday-bar';
            const barFill = document.createElement('span');
            const width = Math.min(100, Math.abs(value) / maxAbs * 100);
            barFill.style.width = `${width}%`;
            barFill.style.background = value >= 0 ? '#2fb344' : '#d63939';
            bar.appendChild(barFill);

            const val = document.createElement('div');
            val.className = 'rt-weekday-value';
            val.textContent = formatCurrency(value, 'BRL');
            if (value < 0) val.classList.add('text-danger');
            if (value > 0) val.classList.add('text-green');

            item.appendChild(label);
            item.appendChild(bar);
            item.appendChild(val);
            container.appendChild(item);
        });

        const bestDayEl = document.getElementById('rtBestDay');
        if (bestDayEl) {
            bestDayEl.textContent = bestIndex >= 0 && bestValue > -Infinity ? labels[bestIndex] : '-';
        }
    }

    function renderSaldoChart(ops) {
        const canvas = document.getElementById('rtSaldoChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const sorted = [...ops].filter(op => getOpDate(op)).sort((a, b) => getOpDate(a) - getOpDate(b));
        const labels = [];
        const data = [];
        let acc = 0;

        sorted.forEach(op => {
            const date = getOpDate(op);
            if (!date) return;
            const value = getOpResultado(op);
            acc += value;
            labels.push(date.toLocaleDateString('pt-BR'));
            data.push(acc);
        });

        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }

        state.chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Saldo Acumulado',
                    data,
                    borderColor: '#206bc4',
                    backgroundColor: 'rgba(32, 107, 196, 0.15)',
                    tension: 0.3,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => formatCurrency(context.parsed.y, 'BRL')
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(148,163,184,0.12)' }
                    },
                    y: {
                        ticks: {
                            color: '#94a3b8',
                            callback: value => formatCurrency(value, 'BRL')
                        },
                        grid: { color: 'rgba(148,163,184,0.12)' }
                    }
                }
            }
        });
    }

    function buildMetrics(ops, summary) {
        const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
        const saldoCorretora = parseFloat(config.saldoAcoes || 0);
        const mediaDia = summary.daysWithOps > 0 ? summary.total / summary.daysWithOps : 0;
        const winRate = summary.totalOps > 0 ? (summary.wins / summary.totalOps) * 100 : 0;
        const roi = saldoCorretora > 0 ? (summary.total / saldoCorretora) * 100 : 0;
        const avgWin = summary.wins > 0 ? summary.winSum / summary.wins : 0;
        const avgLoss = summary.losses > 0 ? Math.abs(summary.lossSum / summary.losses) : 0;
        const payoff = avgLoss > 0 ? avgWin / avgLoss : 0;
        const profitFactor = summary.lossSum < 0 ? summary.winSum / Math.abs(summary.lossSum) : (summary.winSum > 0 ? Infinity : 0);
        const expectancy = summary.totalOps > 0 ? summary.total / summary.totalOps : 0;
        const consistency = summary.daysWithOps > 0 ? (summary.positiveDays / summary.daysWithOps) * 100 : 0;

        const sorted = [...ops].filter(op => getOpDate(op)).sort((a, b) => getOpDate(a) - getOpDate(b));
        let equity = 0;
        let peak = 0;
        let maxDrawdown = 0;
        const drawdowns = [];
        let currentLossStreak = 0;
        let maxLossStreak = 0;

        sorted.forEach(op => {
            const result = getOpResultado(op);
            equity += result;
            if (equity > peak) peak = equity;
            const dd = peak - equity;
            if (dd > 0) drawdowns.push(dd);
            if (dd > maxDrawdown) maxDrawdown = dd;
            if (result < 0) {
                currentLossStreak += 1;
                if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
            } else {
                currentLossStreak = 0;
            }
        });

        const drawdownPct = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
        const drawdownAvg = drawdowns.length > 0 ? drawdowns.reduce((acc, val) => acc + val, 0) / drawdowns.length : 0;

        const dailyValues = Array.from(summary.dailyMap.values());
        const dailyMean = dailyValues.length > 0 ? dailyValues.reduce((acc, val) => acc + val, 0) / dailyValues.length : 0;
        const dailyVariance = dailyValues.length > 1
            ? dailyValues.reduce((acc, val) => acc + Math.pow(val - dailyMean, 2), 0) / (dailyValues.length - 1)
            : 0;
        const dailyStd = Math.sqrt(dailyVariance);
        const volatility = dailyMean !== 0 ? (dailyStd / Math.abs(dailyMean)) * 100 : 0;

        let durationSum = 0;
        let durationCount = 0;
        ops.forEach(op => {
            const days = getOpDurationDays(op);
            if (days === null) return;
            durationSum += days;
            durationCount += 1;
        });
        const avgDuration = durationCount > 0 ? formatDurationDays(Math.round(durationSum / durationCount)) : '-';

        return {
            saldoCorretora,
            mediaDia,
            winRate,
            roi,
            avgWin,
            avgLoss,
            payoff,
            profitFactor,
            expectancy,
            consistency,
            drawdownPct,
            drawdownAvg,
            maxLossStreak,
            volatility,
            avgDuration
        };
    }

    function updateHero(summary, metrics) {
        const saldoAtual = metrics.saldoCorretora + summary.total;
        const bestDay = [...summary.dailyMap.entries()].reduce((acc, item) => {
            if (!acc || item[1] > acc[1]) return item;
            return acc;
        }, null);

        let streak = 0;
        const sortedDates = [...summary.dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        for (let i = sortedDates.length - 1; i >= 0; i -= 1) {
            if (sortedDates[i][1] > 0) streak += 1;
            else break;
        }

        setText('rtHeroTotal', formatCurrency(summary.total, 'BRL'));
        setText('rtHeroSaldo', formatCurrency(saldoAtual, 'BRL'));
        setText('rtHeroRoi', formatPercent(metrics.roi));
        setText('rtHeroOps', summary.totalOps.toString());
        setText('rtHeroWinRate', formatPercent(metrics.winRate));
        setText('rtHeroProfitFactor', Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : '∞');

        const streakEl = document.getElementById('rtHeroStreak');
        if (streakEl) streakEl.textContent = `Sequência: ${streak}`;
        const bestEl = document.getElementById('rtHeroBestDay');
        if (bestEl) {
            bestEl.textContent = bestDay ? `Melhor dia: ${formatCurrency(bestDay[1], 'BRL')}` : 'Melhor dia: -';
        }
    }

    function updateOverview(summary, metrics) {
        setText('rtSumGains', formatCurrency(summary.winSum, 'BRL'));
        setText('rtSumLosses', formatCurrency(Math.abs(summary.lossSum), 'BRL'));
        setText('rtSumNet', formatCurrency(summary.total, 'BRL'));
        setText('rtSumPerDay', formatCurrency(metrics.mediaDia, 'BRL'));

        const winRate = metrics.winRate;
        const lossRate = 100 - winRate;
        setText('rtWinCount', summary.wins.toString());
        setText('rtLossCount', summary.losses.toString());
        const winBar = document.getElementById('rtWinBar');
        const lossBar = document.getElementById('rtLossBar');
        if (winBar) winBar.style.width = `${Math.min(100, winRate)}%`;
        if (lossBar) lossBar.style.width = `${Math.min(100, Math.max(0, lossRate))}%`;
        const hintEl = document.getElementById('rtWinLossHint');
        if (hintEl) {
            const hint = summary.totalOps > 0 ? `${summary.wins} wins vs ${summary.losses} losses` : 'Sem operações no período';
            hintEl.textContent = hint;
        }

        setText('rtChartWinRate', formatPercent(winRate));
        setText('rtChartLossRate', formatPercent(lossRate));
        const winChartBar = document.getElementById('rtChartWinBar');
        const lossChartBar = document.getElementById('rtChartLossBar');
        if (winChartBar) winChartBar.style.width = `${Math.min(100, winRate)}%`;
        if (lossChartBar) lossChartBar.style.width = `${Math.min(100, Math.max(0, lossRate))}%`;
    }

    function updateMetricsTab(summary, metrics) {
        setText('rtMetricGains', formatCurrency(summary.winSum, 'BRL'));
        setText('rtMetricLosses', formatCurrency(Math.abs(summary.lossSum), 'BRL'));
        setText('rtMetricNet', formatCurrency(summary.total, 'BRL'));
        setText('rtMetricPerDay', formatCurrency(metrics.mediaDia, 'BRL'));
        setText('rtMetricRoi', formatPercent(metrics.roi));

        setText('rtMetricWinRate', formatPercent(metrics.winRate));
        setText('rtMetricProfitFactor', Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : '∞');
        setText('rtMetricExpectancy', formatCurrency(metrics.expectancy, 'BRL'));
        setText('rtMetricPayoff', Number.isFinite(metrics.payoff) ? metrics.payoff.toFixed(2) : '0');
        setText('rtMetricConsistency', formatPercent(metrics.consistency));

        setText('rtMetricDrawdown', formatPercent(metrics.drawdownPct));
        setText('rtMetricDrawdownAvg', formatCurrency(metrics.drawdownAvg, 'BRL'));
        setText('rtMetricRiskReward', Number.isFinite(metrics.payoff) ? metrics.payoff.toFixed(2) : '0');
        setText('rtMetricLossSeq', metrics.maxLossStreak.toString());
        setText('rtMetricVolatility', formatPercent(metrics.volatility));

        setText('rtMetricAvgOp', formatCurrency(metrics.expectancy, 'BRL'));
        setText('rtMetricAvgWin', formatCurrency(metrics.avgWin, 'BRL'));
        setText('rtMetricAvgLoss', formatCurrency(metrics.avgLoss, 'BRL'));
        setText('rtMetricOpsPerDay', summary.daysWithOps > 0 ? (summary.totalOps / summary.daysWithOps).toFixed(2) : '0');
        setText('rtMetricAvgDuration', metrics.avgDuration);
        setText('rtMetricDaysOperated', summary.daysWithOps.toString());
    }

    function updateMonthSummary(summary) {
        const positiveDays = summary.positiveDays;
        const negativeDays = summary.daysWithOps - positiveDays;
        const positiveRate = summary.daysWithOps > 0 ? (positiveDays / summary.daysWithOps) * 100 : 0;
        const avgDay = summary.daysWithOps > 0 ? summary.total / summary.daysWithOps : 0;
        setText('rtMonthPositiveDays', positiveDays.toString());
        setText('rtMonthNegativeDays', negativeDays.toString());
        setText('rtMonthPositiveRate', formatPercent(positiveRate));
        setText('rtMonthAvgDay', formatCurrency(avgDay, 'BRL'));
    }

    function updateComparison(summary, metrics) {
        const prevOps = getPreviousOps();
        const prevSummary = calcSummary(prevOps);
        const prevMetrics = buildMetrics(prevOps, prevSummary);
        const comparisons = [
            { label: 'Resultado', current: summary.total, previous: prevSummary.total, format: v => formatCurrency(v, 'BRL') },
            { label: 'Win Rate', current: metrics.winRate, previous: prevMetrics.winRate, format: v => formatPercent(v) },
            { label: 'ROI', current: metrics.roi, previous: prevMetrics.roi, format: v => formatPercent(v) },
            { label: 'Operações', current: summary.totalOps, previous: prevSummary.totalOps, format: v => v.toString() }
        ];

        const container = document.getElementById('rtComparisonList');
        if (!container) return;
        container.innerHTML = '';

        comparisons.forEach(item => {
            const diff = item.current - item.previous;
            const diffText = item.label === 'Operações' ? diff.toString() : formatPercent(item.previous !== 0 ? (diff / Math.abs(item.previous)) * 100 : 0);
            const diffClass = diff >= 0 ? 'text-green' : 'text-danger';
            const row = document.createElement('div');
            row.className = 'rt-compare-item';
            row.innerHTML = `
                <div class="rt-compare-label">${item.label}</div>
                <div class="rt-compare-values">
                    <span class="rt-compare-current">${item.format(item.current)}</span>
                    <span class="rt-compare-prev">(${item.format(item.previous)})</span>
                </div>
                <div class="rt-compare-diff ${diffClass}">${diffText}</div>
            `;
            container.appendChild(row);
        });
    }

    function renderAssetPerformance(ops) {
        const container = document.getElementById('rtAssetPerformance');
        if (!container) return;
        const map = new Map();
        ops.forEach(op => {
            const key = op.ativo_base || op.ativo || 'N/A';
            const entry = map.get(key) || { total: 0, wins: 0, losses: 0, ops: 0 };
            const result = getOpResultado(op);
            entry.total += result;
            entry.ops += 1;
            if (result > 0) entry.wins += 1;
            if (result < 0) entry.losses += 1;
            map.set(key, entry);
        });

        const items = [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6);
        container.innerHTML = '';
        if (items.length === 0) {
            container.textContent = 'Sem dados no período selecionado.';
            return;
        }

        items.forEach(([asset, data]) => {
            const winRate = data.ops > 0 ? (data.wins / data.ops) * 100 : 0;
            const card = document.createElement('div');
            const tone = data.total > 0 ? 'positive' : data.total < 0 ? 'negative' : 'neutral';
            card.className = `financial-card ${tone} rt-asset-card`;
            card.innerHTML = `
                <div class="rt-asset-header">
                    <div class="rt-asset-name">${asset}</div>
                    <div class="rt-asset-total">${formatCurrency(data.total, 'BRL')}</div>
                </div>
                <div class="rt-asset-meta">
                    <span>${data.ops} ops</span>
                    <span>Win ${formatPercent(winRate)}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function renderRecords(ops) {
        const bestContainer = document.getElementById('rtRecordsBest');
        const worstContainer = document.getElementById('rtRecordsWorst');
        if (!bestContainer || !worstContainer) return;
        const sorted = [...ops].sort((a, b) => getOpResultado(b) - getOpResultado(a));
        const best = sorted.slice(0, 4);
        const worst = sorted.slice(-4).reverse();

        const buildCard = (op, tone) => {
            const result = getOpResultado(op);
            const date = formatDateTime(op.data_operacao || op.created_at || op.data_fechamento || op.vencimento);
            return `
                <div class="rt-record-card ${tone}">
                    <div class="rt-record-main">
                        <div>
                            <div class="rt-record-asset">${op.ativo || op.ativo_base || 'Ativo'}</div>
                            <div class="rt-record-date">${date}</div>
                        </div>
                        <div class="rt-record-value">${formatCurrency(result, 'BRL')}</div>
                    </div>
                    <div class="rt-record-meta">${getOpType(op)}</div>
                </div>
            `;
        };

        bestContainer.innerHTML = best.length ? best.map(op => buildCard(op, 'positive')).join('') : '<div class="text-muted">Sem registros.</div>';
        worstContainer.innerHTML = worst.length ? worst.map(op => buildCard(op, 'negative')).join('') : '<div class="text-muted">Sem registros.</div>';
    }

    function renderGoals(summary, metrics) {
        const container = document.getElementById('rtGoalsGrid');
        if (!container) return;
        const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
        const metaMensal = parseFloat(config.meta || 0);
        const goals = [
            { label: 'Win Rate Alvo', current: metrics.winRate, target: 60, format: v => formatPercent(v) },
            { label: 'Operações/Mês', current: summary.totalOps, target: 50, format: v => v.toString() }
        ];
        if (metaMensal > 0) {
            goals.unshift({ label: 'Meta Mensal (R$)', current: summary.total, target: metaMensal, format: v => formatCurrency(v, 'BRL') });
        }

        container.innerHTML = '';
        goals.forEach(goal => {
            const progress = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
            const tone = goal.current >= goal.target ? 'success' : 'warning';
            const col = document.createElement('div');
            col.className = 'col-md-4';
            col.innerHTML = `
                <div class="card rt-goal-card">
                    <div class="card-body">
                        <div class="rt-goal-label">${goal.label}</div>
                        <div class="rt-goal-values">
                            <span>${goal.format(goal.current)}</span>
                            <span class="text-muted">/ ${goal.format(goal.target)}</span>
                        </div>
                        <div class="progress rt-goal-progress">
                            <div class="progress-bar bg-${tone}" style="width: ${progress}%"></div>
                        </div>
                        <div class="rt-goal-meta text-muted">${progress.toFixed(0)}%</div>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });
    }

    function renderHistory(ops) {
        const body = document.getElementById('rtHistoryBody');
        if (!body) return;
        const searchEl = document.getElementById('rtHistorySearch');
        const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
        const filtered = query
            ? ops.filter(op => {
                const text = `${op.ativo || ''} ${op.ativo_base || ''} ${op.tipo || ''} ${op.tipo_operacao || ''}`.toLowerCase();
                return text.includes(query);
            })
            : ops;

        const rows = filtered.slice().sort((a, b) => {
            const da = getOpDate(a);
            const db = getOpDate(b);
            if (!da || !db) return 0;
            return db - da;
        }).map(op => {
            const entry = getEntryPrice(op);
            const exit = getExitPrice(op);
            const type = getOpType(op);
            const result = getOpResultado(op);
            const duration = (() => {
                const days = getOpDurationDays(op);
                return days !== null ? formatDurationDays(days) : '-';
            })();

            return `
                <tr>
                    <td>${formatDateTime(op.data_operacao || op.created_at || op.data_fechamento || op.vencimento)}</td>
                    <td>${op.ativo || op.ativo_base || '-'}</td>
                    <td>${type}</td>
                    <td>${entry !== null ? formatCurrency(entry, 'BRL') : '-'}</td>
                    <td>${exit !== null ? formatCurrency(exit, 'BRL') : '-'}</td>
                    <td class="${result >= 0 ? 'text-green' : 'text-danger'}">${formatCurrency(result, 'BRL')}</td>
                    <td>${duration}</td>
                </tr>
            `;
        }).join('');

        body.innerHTML = rows || '<tr><td colspan="7" class="text-muted">Sem operações no período.</td></tr>';
    }

    async function fetchIAInsights(summary, metrics, ops) {
        const container = document.getElementById('rtAiInsights');
        const statusEl = document.getElementById('rtAiStatus');
        if (!container || !statusEl) return;
        if (!ops.length) {
            container.innerHTML = '';
            statusEl.textContent = 'Sem operações para análise.';
            return;
        }

        const requestId = (state.aiRequestId = (state.aiRequestId || 0) + 1);
        statusEl.textContent = 'Consultando IA...';
        container.innerHTML = '';

        try {
            const bestDay = [...summary.dailyMap.entries()].reduce((acc, item) => {
                if (!acc || item[1] > acc[1]) return item;
                return acc;
            }, null);
            const worstDay = [...summary.dailyMap.entries()].reduce((acc, item) => {
                if (!acc || item[1] < acc[1]) return item;
                return acc;
            }, null);

            const prompt = `
Você é um analista quantitativo. Gere 4 insights curtos e objetivos sobre o desempenho.
Formato: frases curtas sem markdown. Use português.

Resumo do período:
- Resultado total: ${formatCurrency(summary.total, 'BRL')}
- Win Rate: ${metrics.winRate.toFixed(2)}%
- ROI: ${metrics.roi.toFixed(2)}%
- Operações: ${summary.totalOps}
- Média por dia: ${formatCurrency(metrics.mediaDia, 'BRL')}
- Profit Factor: ${Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : '∞'}
- Melhor dia: ${bestDay ? formatCurrency(bestDay[1], 'BRL') : '-'}
- Pior dia: ${worstDay ? formatCurrency(worstDay[1], 'BRL') : '-'}
`;

            const apiBase = typeof API_BASE !== 'undefined' ? API_BASE : (window.API_BASE || '');
            const res = await fetch(`${apiBase}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
            });

            if (!res.ok) throw new Error('Erro ao consultar IA');
            const data = await res.json();
            const response = (data.analysis || data.response || '').trim();
            if (!response) throw new Error('IA retornou resposta vazia');
            if (requestId !== state.aiRequestId) return;

            const lines = response.split('\n').map(line => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
            let items = lines.length ? lines : stripMarkdown(response).split(/(?<=[.!?])\s+/).filter(Boolean);
            items = items.map(item => stripMarkdown(item)).filter(Boolean);
            if (!items.length) items = ['Sem insights disponíveis.'];
            items = items.slice(0, 4).map(item => item.length > 220 ? `${item.slice(0, 217)}...` : item);
            const list = items.map(text => `<div class="rt-ai-item">${text}</div>`).join('');
            container.innerHTML = `
                <div class="rt-ai-card">
                    <div class="rt-ai-title">Insights</div>
                    <div class="rt-ai-list">${list}</div>
                </div>
            `;
            statusEl.textContent = 'Insights atualizados.';
        } catch (error) {
            if (requestId !== state.aiRequestId) return;
            statusEl.textContent = 'Não foi possível gerar insights.';
            container.innerHTML = '';
        }
    }

    async function updateModal(options = {}) {
        const { showLoading = true, refreshAI = true } = options;
        if (state.updating) return;
        state.updating = true;
        if (showLoading) setLoadingState(true);
        const ops = getFilteredOps();
        const summary = calcSummary(ops);
        const metrics = buildMetrics(ops, summary);
        updateSummaryCards(summary, metrics);
        updateHero(summary, metrics);
        updateOverview(summary, metrics);
        updateMetricsTab(summary, metrics);
        updateMonthSummary(summary);
        renderCalendar(summary, ops);
        renderWeekdayList(summary);
        renderSaldoChart(ops);
        renderAssetPerformance(ops);
        renderRecords(ops);
        renderGoals(summary, metrics);
        renderHistory(ops);
        updateComparison(summary, metrics);
        try {
            if (refreshAI) {
                await fetchIAInsights(summary, metrics, ops);
            } else {
                const statusEl = document.getElementById('rtAiStatus');
                if (statusEl) statusEl.textContent = 'Filtro aplicado.';
            }
        } finally {
            state.updating = false;
            if (showLoading) setLoadingState(false);
            const statusEl = document.getElementById('rtRefreshStatus');
            if (statusEl) {
                const now = new Date();
                statusEl.textContent = `Atualizado ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }
        }
    }

    async function ensureModalLoaded() {
        if (document.getElementById('modalResultadoTotal')) return true;
        const container = document.getElementById('modalResultadoTotalContainer');
        if (!container || state.loading) return false;
        state.loading = true;
        try {
            const response = await fetch('../components/modals/opcoes/modal-resultado-total.html');
            const html = await response.text();
            container.innerHTML = html;
            return true;
        } catch (error) {
            console.error(error);
            return false;
        } finally {
            state.loading = false;
        }
    }

    async function openResultadoTotalModal() {
        const loaded = await ensureModalLoaded();
        if (!loaded) return;
        const modalEl = document.getElementById('modalResultadoTotal');
        if (!modalEl) return;
        setupFilterButtons();
        setupRefreshButton();
        setupHistorySearch();
        updateModal();
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }

    function setupFilterButtons() {
        const container = document.getElementById('rtFilterButtons');
        if (!container || container.dataset.bound === 'true') return;
        container.dataset.bound = 'true';
        container.addEventListener('click', event => {
            const button = event.target.closest('button[data-period]');
            if (!button) return;
            const period = button.dataset.period;
            if (!period || state.period === period) return;
            state.period = period;
            container.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateModal({ showLoading: false, refreshAI: false });
        });
    }

    function setupRefreshButton() {
        const button = document.getElementById('rtRefreshButton');
        if (!button || button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', () => {
            updateModal({ showLoading: true, refreshAI: true });
        });
    }

    function setupHistorySearch() {
        const input = document.getElementById('rtHistorySearch');
        if (!input || input.dataset.bound === 'true') return;
        input.dataset.bound = 'true';
        input.addEventListener('input', () => {
            renderHistory(getFilteredOps());
        });
    }

    function setupTriggers() {
        const card = document.getElementById('cardResultadoTotalCard');
        if (card) {
            card.addEventListener('click', openResultadoTotalModal);
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openResultadoTotalModal();
                }
            });
        }
    }

    document.addEventListener('layoutReady', () => {
        setupTriggers();
    });

    window.addEventListener('load', () => {
        setupTriggers();
    });
})();

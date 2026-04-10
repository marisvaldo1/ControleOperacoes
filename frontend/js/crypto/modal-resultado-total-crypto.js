/** modal-resultado-total-crypto.js v1.0.0
 *  Versão crypto do modal Análise Temporal de Performance.
 *  Lê window.cryptoOperacoes em vez de window.allOperacoes.
 */
(function () {
    const state = {
        period: '60d',
        chart: null,
        finalChart: null,
        loading: false,
        updating: false
    };

    // ── Configuração padrão para crypto ──────────────────────────────────────
    const cfg = {
        currency: 'USD',
        getSaldo: function () {
            try {
                const c = JSON.parse(localStorage.getItem('cryptoConfig') || '{}');
                const a = JSON.parse(localStorage.getItem('appConfig') || '{}');
                return parseFloat(c.saldoCrypto || a.saldoCrypto || 0) || 0;
            } catch (e) { return 0; }
        },
        getResultValue: function (op) {
            // Prioriza premio_us (valor USD real); resultado é percentual sobre o saldo
            const v = parseFloat(op.premio_us ?? op.resultado);
            return Number.isFinite(v) ? v : 0;
        },
        triggerCard: 'cardResultadoTotalCryptoCard',
        templatePath: '../components/modals/opcoes/modal-resultado-total.html',
        containerElId: 'modalResultadoTotalCryptoContainer',
        modalElId: 'modalResultadoTotal',
        metaKey: 'metaCrypto',
    };

    function fmtC(value) {
        return formatCurrency(value, cfg.currency);
    }

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
        return parseDate(op.vencimento) || parseDate(op.exercicio);
    }

    function getOpResultadoFinal(op) {
        return cfg.getResultValue(op);
    }

    function formatPercent(value) {
        return value.toFixed(2) + '%';
    }

    function formatCurrency(value, currency = 'USD') {
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
        const modal = document.getElementById(cfg.modalElId);
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
                { id: 'rtHistoryBody', text: '<tr><td colspan="9" class="text-muted">Carregando...</td></tr>' }
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

        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        return { start, end };
    }

    function filterOpsByRange(ops, range) {
        if (!range || !range.start || !range.end) return ops;
        return ops.filter(op => {
            const date = getOpDate(op);
            return date && date >= range.start && date <= range.end;
        });
    }

    // ── DIFERENÇA PRINCIPAL: lê window.cryptoOperacoes ────────────────────
    function getCryptoOps() {
        return Array.isArray(window.cryptoOperacoes) ? window.cryptoOperacoes : [];
    }

    function getFilteredOps() {
        const ops = getCryptoOps();
        const period = state.period;
        const range = getPeriodRange(period);
        return filterOpsByRange(ops, range);
    }

    function getPreviousOps() {
        const ops = getCryptoOps();
        const period = state.period;
        const range = getPeriodRange(period);
        if (!range.start || !range.end) return [];
        const diff = range.end.getTime() - range.start.getTime();
        const prevEnd = new Date(range.start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - diff);
        return filterOpsByRange(ops, { start: prevStart, end: prevEnd });
    }

    function getEntryPrice(op) {
        const value = op.abertura ?? op.preco_entrada ?? op.preco;
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getExitPrice(op) {
        const value = op.cotacao_atual ?? op.strike ?? op.preco_atual;
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getOpType(op) {
        const tipo = String(op.tipo || '').toUpperCase();
        if (tipo) return tipo;
        return 'CRYPTO';
    }

    function getDisplayExerciseStatus(op) {
        if (window.CryptoExerciseStatus?.resolveDisplayStatus) {
            return window.CryptoExerciseStatus.resolveDisplayStatus(op);
        }
        return 'NAO';
    }

    function isPutExercised(op) {
        return window.CryptoExerciseStatus?.isExercised
            ? window.CryptoExerciseStatus.isExercised(op, 'PUT')
            : (getOpType(op) === 'PUT' && getDisplayExerciseStatus(op) === 'SIM');
    }

    function getDaysToExpiry(op) {
        const due = getOpVencimentoDate(op);
        if (!due) return null;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    function getDistanceToStrikePct(op) {
        const current = parseFloat(op.cotacao_atual ?? op.preco_atual ?? op.preco ?? NaN);
        const strike = parseFloat(op.strike ?? NaN);
        if (!Number.isFinite(current) || !Number.isFinite(strike) || current <= 0) return null;
        const type = getOpType(op);
        if (type === 'PUT') return ((current - strike) / current) * 100;
        return ((strike - current) / current) * 100;
    }

    function getPremiumPct(op) {
        const premio = parseFloat(op.premio_us ?? NaN);
        const abertura = parseFloat(op.abertura ?? NaN);
        if (!Number.isFinite(premio) || !Number.isFinite(abertura) || abertura <= 0) return null;
        return (premio / abertura) * 100;
    }

    function evaluateUrgency(op) {
        const days = getDaysToExpiry(op);
        const distance = getDistanceToStrikePct(op);
        const premiumPct = getPremiumPct(op);

        let level = 'safe';
        if ((days !== null && days <= 2) || (distance !== null && distance <= 1.5)) level = 'risk';
        else if ((days !== null && days <= 5) || (distance !== null && distance <= 4)) level = 'warn';

        if (premiumPct !== null && premiumPct < 0.8 && level === 'safe') level = 'warn';

        const riskBase = level === 'risk' ? 90 : level === 'warn' ? 60 : 25;
        const daysScore = days === null ? 0 : Math.max(0, 15 - days);
        const distanceScore = distance === null ? 0 : Math.max(0, 12 - distance);
        const score = riskBase + daysScore + distanceScore;

        return { level, days, distance, premiumPct, score };
    }

    function isCallExercised(op) {
        return window.CryptoExerciseStatus?.isExercised
            ? window.CryptoExerciseStatus.isExercised(op, 'CALL')
            : (getOpType(op) === 'CALL' && getDisplayExerciseStatus(op) === 'SIM');
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

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isOpenOperation(op) {
        return (op.status || 'ABERTA') === 'ABERTA';
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
            const result = getOpResultadoFinal(op);
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
            totalEl.textContent = fmtC(summary.total);
            totalEl.classList.toggle('text-danger', summary.total < 0);
            totalEl.classList.toggle('text-green', summary.total >= 0);
        }
        if (mediaEl) mediaEl.textContent = fmtC(mediaDia);
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

        const dayOperationsMap = new Map();
        ops.forEach(op => {
            const opDate = getOpDate(op);
            if (!opDate) return;
            const key = normalizeDateKey(opDate);
            if (!dayOperationsMap.has(key)) {
                dayOperationsMap.set(key, []);
            }
            dayOperationsMap.get(key).push(op);
        });

        for (let day = 1; day <= totalDays; day += 1) {
            const date = new Date(year, month, day);
            const key = normalizeDateKey(date);
            const value = summary.dailyMap.get(key) || 0;
            const dayOps = dayOperationsMap.get(key) || [];
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
            dayValue.textContent = value !== 0 ? fmtC(value) : '';

            dayEl.classList.add('rt-week-clickable');
            dayEl.addEventListener('click', () => {
                showDayOperations(date, dayOps);
            });

            dayEl.appendChild(dayNumber);
            dayEl.appendChild(dayValue);
            calendarGrid.appendChild(dayEl);
        }
    }

    function ensureDayOperationsModal() {
        let modalEl = document.getElementById('rtDayOperationsModal');
        if (modalEl) return modalEl;

        const modalHtml = `
            <div class="modal modal-blur fade" id="rtDayOperationsModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content rt-dayops-modal">
                        <div class="modal-header">
                            <h5 class="modal-title" id="rtDayOperationsTitle">Operações do dia</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="rtDayOperationsSummary" class="rt-dayops-summary"></div>
                            <div class="table-responsive">
                                <table class="table table-sm table-vcenter rt-dayops-table mb-0">
                                    <thead>
                                        <tr>
                                            <th>Hora</th>
                                            <th>Ativo</th>
                                            <th>Tipo</th>
                                            <th>Entrada</th>
                                            <th>Atual / Strike</th>
                                            <th>Resultado</th>
                                            <th>Status</th>
                                            <th class="text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody id="rtDayOperationsBody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modalEl = document.getElementById('rtDayOperationsModal');
        if (modalEl && modalEl.dataset.bound !== 'true') {
            modalEl.dataset.bound = 'true';
            modalEl.addEventListener('click', event => {
                const button = event.target.closest('[data-open-crypto-op]');
                if (!button) return;
                const opId = button.getAttribute('data-open-crypto-op');
                if (!opId) return;

                const launchDetail = () => {
                    if (window.ModalAnaliseCrypto && typeof window.ModalAnaliseCrypto.open === 'function') {
                        window.ModalAnaliseCrypto.open(opId);
                    }
                };

                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (!modalInstance) {
                    launchDetail();
                    return;
                }

                modalEl.addEventListener('hidden.bs.modal', launchDetail, { once: true });
                modalInstance.hide();
            });
        }

        return modalEl;
    }

    function showDayOperations(date, ops) {
        const modalEl = ensureDayOperationsModal();
        if (!modalEl) return;

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        const titleEl = document.getElementById('rtDayOperationsTitle');
        const summaryEl = document.getElementById('rtDayOperationsSummary');
        const bodyEl = document.getElementById('rtDayOperationsBody');
        if (!bodyEl) return;

        const sortedOps = [...ops].sort((a, b) => {
            const aOpen = isOpenOperation(a) ? 0 : 1;
            const bOpen = isOpenOperation(b) ? 0 : 1;
            if (aOpen !== bOpen) return aOpen - bOpen;

            const da = getOpDate(a);
            const db = getOpDate(b);
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return db - da;
        });

        const openOps = sortedOps.filter(isOpenOperation);
        const closedOps = sortedOps.length - openOps.length;
        const displayOps = openOps.length > 0 ? openOps : sortedOps;
        const total = displayOps.reduce((acc, op) => acc + getOpResultadoFinal(op), 0);
        const saldoBase = cfg.getSaldo();
        const roiDay = saldoBase > 0 ? (total / saldoBase) * 100 : 0;

        if (titleEl) {
            titleEl.textContent = `Operações do Dia (${date.toLocaleDateString('pt-BR')})`;
        }
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="row g-2 rt-dayops-cards">
                    <div class="col-6 col-lg-3">
                        <div class="card rt-dayops-card">
                            <div class="card-body p-2">
                                <div class="subheader small">Registros no dia</div>
                                <div class="h2 mb-0">${displayOps.length}</div>
                                <div class="small text-muted">${sortedOps.length} registro${sortedOps.length === 1 ? '' : 's'} no dia</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card rt-dayops-card">
                            <div class="card-body p-2">
                                <div class="subheader small">Abertas</div>
                                <div class="h2 mb-0 text-success">${openOps.length}</div>
                                <div class="small text-muted">${closedOps} fechada${closedOps === 1 ? '' : 's'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card rt-dayops-card">
                            <div class="card-body p-2">
                                <div class="subheader small">Resultado do dia</div>
                                <div class="h2 mb-0 ${total >= 0 ? 'text-success' : 'text-danger'}">${fmtC(total)}</div>
                                <div class="small text-muted">${displayOps.length === 1 ? '1 operação exibida' : `${displayOps.length} operações exibidas`}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card rt-dayops-card">
                            <div class="card-body p-2">
                                <div class="subheader small">ROI sobre saldo</div>
                                <div class="h2 mb-0 ${roiDay >= 0 ? 'text-success' : 'text-danger'}">${roiDay.toFixed(2)}%</div>
                                <div class="small text-muted">Base atual ${fmtC(saldoBase)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        bodyEl.innerHTML = displayOps.length > 0
            ? displayOps.map(op => {
                const opDate = getOpDate(op);
                const entry = getEntryPrice(op);
                const exit = getExitPrice(op);
                const result = getOpResultadoFinal(op);
                const type = escapeHtml(getOpType(op));
                const ativo = escapeHtml(op.ativo || '-');
                const status = escapeHtml(op.status || 'ABERTA');
                const statusBadge = isOpenOperation(op)
                    ? '<span class="badge bg-success text-white rt-dayops-status">ABERTA</span>'
                    : `<span class="badge bg-azure text-white rt-dayops-status">${status}</span>`;
                const tipoBadgeClass = type === 'CALL'
                    ? 'bg-green-lt text-green'
                    : (type === 'PUT' ? 'bg-red-lt text-red' : 'bg-secondary-lt text-secondary');
                return `
                    <tr>
                        <td>${opDate ? opDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td>
                            <div class="fw-semibold">${ativo}</div>
                            <div class="small text-muted">ID ${escapeHtml(op.id || '-')}</div>
                        </td>
                        <td><span class="badge ${tipoBadgeClass}">${type}</span></td>
                        <td>${entry !== null ? fmtC(entry) : '-'}</td>
                        <td>${exit !== null ? fmtC(exit) : '-'}</td>
                        <td class="${result >= 0 ? 'text-green' : 'text-danger'} fw-semibold">${fmtC(result)}</td>
                        <td>${statusBadge}</td>
                        <td class="text-center">
                            <button type="button" class="btn btn-sm btn-info btn-icon" data-open-crypto-op="${escapeHtml(op.id || '')}" title="Abrir análise completa">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="8" class="text-muted text-center py-3">Nenhuma operação registrada neste dia.</td></tr>';

        modal.show();
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
            val.textContent = fmtC(value);
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
            const value = getOpResultadoFinal(op);
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
                    borderColor: '#f6c23e',
                    backgroundColor: 'rgba(246, 194, 62, 0.15)',
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
                            label: context => fmtC(context.parsed.y)
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
                            callback: value => fmtC(value)
                        },
                        grid: { color: 'rgba(148,163,184,0.12)' }
                    }
                }
            }
        });
    }

    function buildMetrics(ops, summary) {
        const saldoCorretora = cfg.getSaldo();
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
            const result = getOpResultadoFinal(op);
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

        setText('rtHeroTotal', fmtC(summary.total));
        setText('rtHeroSaldo', fmtC(saldoAtual));
        setText('rtHeroRoi', formatPercent(metrics.roi));
        setText('rtHeroOps', summary.totalOps.toString());
        setText('rtHeroWinRate', formatPercent(metrics.winRate));
        setText('rtHeroProfitFactor', Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : '∞');

        const streakEl = document.getElementById('rtHeroStreak');
        if (streakEl) streakEl.textContent = `Sequência: ${streak}`;
        const bestEl = document.getElementById('rtHeroBestDay');
        if (bestEl) {
            bestEl.textContent = bestDay ? `Melhor dia: ${fmtC(bestDay[1])}` : 'Melhor dia: -';
        }
    }

    function updateOverview(summary, metrics) {
        setText('rtSumGains', fmtC(summary.winSum));
        setText('rtSumLosses', fmtC(Math.abs(summary.lossSum)));
        setText('rtSumNet', fmtC(summary.total));
        setText('rtSumPerDay', fmtC(metrics.mediaDia));

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
        setText('rtMetricGains', fmtC(summary.winSum));
        setText('rtMetricLosses', fmtC(Math.abs(summary.lossSum)));
        setText('rtMetricNet', fmtC(summary.total));
        setText('rtMetricPerDay', fmtC(metrics.mediaDia));
        setText('rtMetricRoi', formatPercent(metrics.roi));

        setText('rtMetricWinRate', formatPercent(metrics.winRate));
        setText('rtMetricProfitFactor', Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : '∞');
        setText('rtMetricExpectancy', fmtC(metrics.expectancy));
        setText('rtMetricPayoff', Number.isFinite(metrics.payoff) ? metrics.payoff.toFixed(2) : '0');
        setText('rtMetricConsistency', formatPercent(metrics.consistency));

        setText('rtMetricDrawdown', formatPercent(metrics.drawdownPct));
        setText('rtMetricDrawdownAvg', fmtC(metrics.drawdownAvg));
        setText('rtMetricRiskReward', Number.isFinite(metrics.payoff) ? metrics.payoff.toFixed(2) : '0');
        setText('rtMetricLossSeq', metrics.maxLossStreak.toString());
        setText('rtMetricVolatility', formatPercent(metrics.volatility));

        setText('rtMetricAvgOp', fmtC(metrics.expectancy));
        setText('rtMetricAvgWin', fmtC(metrics.avgWin));
        setText('rtMetricAvgLoss', fmtC(metrics.avgLoss));
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
        setText('rtMonthAvgDay', fmtC(avgDay));
    }

    function updateComparison(summary, metrics) {
        const prevOps = getPreviousOps();
        const prevSummary = calcSummary(prevOps);
        const prevMetrics = buildMetrics(prevOps, prevSummary);
        const comparisons = [
            { label: 'Resultado', current: summary.total, previous: prevSummary.total, format: v => fmtC(v) },
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
        // Ordena: abertas primeiro, depois por data decrescente
        const sorted = [...ops].sort((a, b) => {
            const aOpen = (a.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
            const bOpen = (b.status || 'ABERTA') === 'ABERTA' ? 0 : 1;
            if (aOpen !== bOpen) return aOpen - bOpen;
            return (getOpDate(b) || 0) - (getOpDate(a) || 0);
        });
        sorted.forEach(op => {
            const key = op.ativo || 'N/A';
            const entry = map.get(key) || { total: 0, wins: 0, losses: 0, ops: 0, lastOpId: op.id };
            const result = getOpResultadoFinal(op);
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
            card.style.cursor = 'pointer';
            card.title = `Ver detalhes de ${asset}`;
            card.innerHTML = `
                <div class="rt-asset-header">
                    <div class="rt-asset-name">${asset}</div>
                    <div class="rt-asset-total">${fmtC(data.total)}</div>
                </div>
                <div class="rt-asset-meta">
                    <span>${data.ops} ops</span>
                    <span>Win ${formatPercent(winRate)}</span>
                </div>
            `;
            // Abre o modal-detalhe-crypto da operação mais recente deste ativo
            if (data.lastOpId && typeof window.showDetalhes === 'function') {
                card.addEventListener('click', () => window.showDetalhes(data.lastOpId));
            }
            container.appendChild(card);
        });
    }

    function renderRecords(ops) {
        const bestContainer = document.getElementById('rtRecordsBest');
        const worstContainer = document.getElementById('rtRecordsWorst');
        if (!bestContainer || !worstContainer) return;
        const sorted = [...ops].sort((a, b) => getOpResultadoFinal(b) - getOpResultadoFinal(a));
        const best = sorted.slice(0, 4);
        const worst = sorted.slice(-4).reverse();

        const buildCard = (op, tone) => {
            const result = getOpResultadoFinal(op);
            const date = formatDateTime(op.data_operacao || op.created_at || op.data_fechamento || op.vencimento);
            return `
                <div class="rt-record-card ${tone}">
                    <div class="rt-record-main">
                        <div>
                            <div class="rt-record-asset">${op.ativo || 'Ativo'}</div>
                            <div class="rt-record-date">${date}</div>
                        </div>
                        <div class="rt-record-value">${fmtC(result)}</div>
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
        const metaMensal = parseFloat(config[cfg.metaKey] || 0);
        const goals = [
            { label: 'Win Rate Alvo', current: metrics.winRate, target: 60, format: v => formatPercent(v) },
            { label: 'Operações/Mês', current: summary.totalOps, target: 50, format: v => v.toString() }
        ];
        if (metaMensal > 0) {
            goals.unshift({ label: `Meta Mensal (${cfg.currency})`, current: summary.total, target: metaMensal, format: v => fmtC(v) });
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
        const saldoCorretoraFallback = cfg.getSaldo();
        const searchEl = document.getElementById('rtHistorySearch');
        const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
        const filtered = query
            ? ops.filter(op => {
                const text = `${op.ativo || ''} ${op.tipo || ''}`.toLowerCase();
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
            const result = getOpResultadoFinal(op);
            const duration = (() => {
                const days = getOpDurationDays(op);
                return days !== null ? formatDurationDays(days) : '-';
            })();
            const saldoOp = parseFloat(op.saldo_abertura || 0) || saldoCorretoraFallback;
            const pct = saldoOp > 0 ? (result / saldoOp) * 100 : null;
            const pctText = pct !== null ? formatPercent(pct) : '-';
            const pctCls = pct === null ? '' : (pct >= 0 ? 'text-green' : 'text-danger');

            return `
                <tr>
                    <td>${formatDateTime(op.data_operacao || op.created_at || op.data_fechamento || op.vencimento)}</td>
                    <td>${op.ativo || '-'}</td>
                    <td>${type}</td>
                    <td>${entry !== null ? fmtC(entry) : '-'}</td>
                    <td>${exit !== null ? fmtC(exit) : '-'}</td>
                    <td class="${result >= 0 ? 'text-green' : 'text-danger'}">${fmtC(result)}</td>
                    <td class="${pctCls}">${pctText}</td>
                    <td>${duration}</td>
                </tr>
            `;
        }).join('');

        body.innerHTML = rows || '<tr><td colspan="8" class="text-muted">Sem operações no período.</td></tr>';
    }

    function renderCockpitBlend(ops) {
        const container = document.getElementById('rtCockpitBlendBody');
        const stampEl = document.getElementById('rtCockpitLastUpdate');
        if (!container) return;

        const openOps = ops.filter(isOpenOperation);
        if (stampEl) {
            const now = new Date();
            stampEl.textContent = `Atualizado ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }

        if (!openOps.length) {
            container.innerHTML = '<div class="text-muted">Sem operações abertas no período selecionado.</div>';
            return;
        }

        const byAsset = new Map();
        const ranked = openOps.map(op => ({ op, urgency: evaluateUrgency(op) }))
            .sort((a, b) => b.urgency.score - a.urgency.score);

        ranked.forEach(item => {
            const asset = item.op.ativo || 'N/A';
            if (!byAsset.has(asset)) {
                byAsset.set(asset, { total: 0, safe: 0, warn: 0, risk: 0, avgDistance: 0, _distanceCount: 0 });
            }
            const agg = byAsset.get(asset);
            agg.total += 1;
            agg[item.urgency.level] += 1;
            if (Number.isFinite(item.urgency.distance)) {
                agg.avgDistance += item.urgency.distance;
                agg._distanceCount += 1;
            }
        });

        const healthHtml = [...byAsset.entries()].map(([asset, agg]) => {
            const safePct = agg.total > 0 ? (agg.safe / agg.total) * 100 : 0;
            const warnPct = agg.total > 0 ? (agg.warn / agg.total) * 100 : 0;
            const avgDistance = agg._distanceCount > 0 ? agg.avgDistance / agg._distanceCount : null;
            const tone = agg.risk > 0 ? 'risk' : agg.warn > 0 ? 'warn' : 'safe';
            return `
                <div class="rt-cockpit-card ${tone}">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="fw-bold">${escapeHtml(asset)}</div>
                        <span class="badge bg-dark-lt">${agg.total} aberta(s)</span>
                    </div>
                    <div class="rt-health-track mb-2">
                        <div class="rt-health-fill" style="width:${safePct.toFixed(1)}%"></div>
                    </div>
                    <div class="small text-muted d-flex justify-content-between">
                        <span>Seguras: ${agg.safe}</span>
                        <span>Atenção: ${agg.warn}</span>
                        <span>Risco: ${agg.risk}</span>
                    </div>
                    <div class="small text-muted mt-1">Distância média strike: ${avgDistance === null ? '-' : `${avgDistance.toFixed(2)}%`}</div>
                    <div class="small text-muted">Saúde operacional: ${(100 - warnPct - (agg.risk / agg.total) * 100).toFixed(1)}%</div>
                </div>
            `;
        }).join('');

        const timelineHtml = ranked.slice(0, 8).map(({ op, urgency }) => {
            const days = urgency.days;
            const daysLabel = days === null ? '-' : `${days}d`;
            const severity = urgency.level;
            const fill = severity === 'risk' ? 100 : severity === 'warn' ? 65 : 35;
            return `
                <div class="rt-timeline-row">
                    <div class="small">
                        <span class="fw-semibold">${escapeHtml(op.ativo || 'N/A')}</span>
                        <span class="text-muted">#${escapeHtml(op.id || '-')}</span>
                    </div>
                    <div class="rt-timeline-track">
                        <div class="rt-timeline-fill ${severity}" style="width:${fill}%"></div>
                    </div>
                    <div class="text-end small ${severity === 'risk' ? 'text-danger' : severity === 'warn' ? 'text-warning' : 'text-green'}">${daysLabel}</div>
                </div>
            `;
        }).join('');

        const cockpitHtml = ranked.slice(0, 6).map(({ op, urgency }) => {
            const result = getOpResultadoFinal(op);
            const levelLabel = urgency.level === 'risk' ? 'P1 Risco' : urgency.level === 'warn' ? 'P2 Atenção' : 'P3 OK';
            const levelClass = urgency.level;
            return `
                <div class="rt-cockpit-card ${levelClass}">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="fw-bold">${escapeHtml(op.ativo || 'N/A')} <span class="text-muted">#${escapeHtml(op.id || '-')}</span></div>
                        <span class="badge ${levelClass === 'risk' ? 'bg-danger' : levelClass === 'warn' ? 'bg-warning text-dark' : 'bg-success'}">${levelLabel}</span>
                    </div>
                    <div class="small text-muted">Tipo: ${escapeHtml(getOpType(op))} · Venc.: ${formatDateTime(op.exercicio || op.vencimento)}</div>
                    <div class="small text-muted">Distância: ${Number.isFinite(urgency.distance) ? `${urgency.distance.toFixed(2)}%` : '-'} · Prêmio: ${Number.isFinite(urgency.premiumPct) ? `${urgency.premiumPct.toFixed(2)}%` : '-'}</div>
                    <div class="small mt-1">Resultado atual: <span class="value ${result >= 0 ? 'text-green' : 'text-danger'}">${fmtC(result)}</span></div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="mb-2 small text-muted">Mesclagem de Barra de Saúde Operacional + Modo Cockpit por Criticidade + Timeline de Vencimento.</div>
            <div class="rt-cockpit-grid">${healthHtml}</div>
            <div class="row g-3">
                <div class="col-lg-6">
                    <div class="card bg-transparent border">
                        <div class="card-body">
                            <div class="fw-semibold mb-2">Cockpit por criticidade</div>
                            <div class="rt-cockpit-grid">${cockpitHtml}</div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card bg-transparent border h-100">
                        <div class="card-body">
                            <div class="fw-semibold mb-2">Timeline de vencimento (abertas)</div>
                            <div class="rt-timeline-list">${timelineHtml}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderExercisedCallsCoverage(ops) {
        const container = document.getElementById('rtExercisedCallsBody');
        if (!container) return;

        const exercisedCalls = ops
            .filter(isCallExercised)
            .map(op => ({
                op,
                eventDate: getOpVencimentoDate(op) || getOpDate(op)
            }))
            .filter(item => !!item.eventDate)
            .sort((a, b) => b.eventDate - a.eventDate)
            .slice(0, 6);

        if (!exercisedCalls.length) {
            container.innerHTML = '<div class="text-muted">Nenhuma CALL exercida identificada no período selecionado.</div>';
            return;
        }

        const rows = exercisedCalls.map(({ op, eventDate }) => {
            const pnl = getOpResultadoFinal(op);
            const afterOps = ops.filter(candidate => {
                if (candidate.id === op.id) return false;
                const candidateDate = getOpDate(candidate);
                return candidateDate && candidateDate > eventDate;
            });
            const afterNet = afterOps.reduce((acc, item) => acc + getOpResultadoFinal(item), 0);
            const afterCount = afterOps.length;

            let coverageHtml = '<div class="meta">Sem necessidade de cobertura.</div>';
            if (pnl < 0) {
                const loss = Math.abs(pnl);
                const coveredValue = Math.max(0, afterNet);
                const remaining = Math.max(0, loss - coveredValue);
                const coveredPct = loss > 0 ? Math.min(100, (coveredValue / loss) * 100) : 100;
                const remainingPct = loss > 0 ? (remaining / loss) * 100 : 0;
                coverageHtml = `
                    <div class="meta">Cobertura por operações posteriores (${afterCount}): <span class="${coveredValue > 0 ? 'text-green' : 'text-muted'}">${fmtC(coveredValue)}</span></div>
                    <div class="meta">Falta cobrir: <span class="${remaining > 0 ? 'text-danger' : 'text-green'}">${fmtC(remaining)} (${remainingPct.toFixed(2)}%)</span></div>
                    <div class="progress mt-1" style="height: 6px;">
                        <div class="progress-bar ${coveredPct >= 100 ? 'bg-success' : 'bg-warning'}" style="width:${coveredPct.toFixed(2)}%"></div>
                    </div>
                `;
            }

            return `
                <div class="rt-exercised-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="fw-semibold">${escapeHtml(op.ativo || 'N/A')} <span class="text-muted">#${escapeHtml(op.id || '-')}</span></div>
                        <span class="badge ${pnl >= 0 ? 'bg-success' : 'bg-danger'}">${pnl >= 0 ? 'Lucro' : 'Prejuízo'}</span>
                    </div>
                    <div class="meta">Exercida em ${eventDate.toLocaleDateString('pt-BR')} · Strike ${Number.isFinite(parseFloat(op.strike)) ? fmtC(op.strike) : '-'}</div>
                    <div class="mt-1">Resultado da CALL exercida: <span class="value ${pnl >= 0 ? 'text-green' : 'text-danger'}">${fmtC(pnl)}</span></div>
                    ${coverageHtml}
                </div>
            `;
        }).join('');

        const totalPnl = exercisedCalls.reduce((acc, item) => acc + getOpResultadoFinal(item.op), 0);
        const losses = exercisedCalls.filter(item => getOpResultadoFinal(item.op) < 0);
        const totalRemaining = losses.reduce((acc, item) => {
            const loss = Math.abs(getOpResultadoFinal(item.op));
            const afterNet = ops.filter(candidate => {
                if (candidate.id === item.op.id) return false;
                const candidateDate = getOpDate(candidate);
                return candidateDate && candidateDate > item.eventDate;
            }).reduce((sum, op) => sum + getOpResultadoFinal(op), 0);
            const remaining = Math.max(0, loss - Math.max(0, afterNet));
            return acc + remaining;
        }, 0);

        container.innerHTML = `
            <div class="row g-2 mb-3">
                <div class="col-sm-4"><div class="card bg-dark-lt"><div class="card-body p-2 text-center"><div class="subheader">CALLs Exercidas (últimas)</div><div class="h3 mb-0">${exercisedCalls.length}</div></div></div></div>
                <div class="col-sm-4"><div class="card bg-dark-lt"><div class="card-body p-2 text-center"><div class="subheader">Resultado agregado</div><div class="h3 mb-0 ${totalPnl >= 0 ? 'text-green' : 'text-danger'}">${fmtC(totalPnl)}</div></div></div></div>
                <div class="col-sm-4"><div class="card bg-dark-lt"><div class="card-body p-2 text-center"><div class="subheader">Prejuízo pendente de cobrir</div><div class="h3 mb-0 ${totalRemaining > 0 ? 'text-danger' : 'text-green'}">${fmtC(totalRemaining)}</div></div></div></div>
            </div>
            <div class="rt-exercised-list">${rows}</div>
        `;
    }

    function calculateFinalResultModel(opsForPeriod, allOps) {
        // Ciclo correto em Dual Investment:
        // 1. PUT exercida  = compra do ativo ao strike da PUT
        // 2. Coleta de prêmios de opções sobre o ativo em carteira
        // 3. CALL exercida = venda do ativo ao strike da CALL
        // Resultado do ciclo = (CALL strike − PUT strike) + prêmios coletados
        const sortedPeriod = [...opsForPeriod]
            .map(op => ({ op, eventDate: getOpVencimentoDate(op) || getOpDate(op) }))
            .filter(item => !!item.eventDate)
            .sort((a, b) => a.eventDate - b.eventDate);

        const exercisedCalls = sortedPeriod.filter(item => isCallExercised(item.op));
        const exercisedPuts  = sortedPeriod.filter(item => isPutExercised(item.op));

        const periodTotal  = opsForPeriod.reduce((acc, op) => acc + getOpResultadoFinal(op), 0);
        const historyTotal = allOps.reduce((acc, op) => acc + getOpResultadoFinal(op), 0);

        if (!exercisedPuts.length) {
            return {
                hasCycle: false,
                reason: 'Nenhuma PUT exercida identificada no período. Sem posição de compra para calcular o ciclo.',
                periodTotal,
                historyTotal
            };
        }

        // Busca o par mais recente PUT→CALL, priorizando mesmo ativo
        let lastPut  = null;
        let lastCall = null;

        for (let i = exercisedPuts.length - 1; i >= 0; i--) {
            const candidatePut = exercisedPuts[i];
            const asset = candidatePut.op.ativo;
            const matchingCalls = exercisedCalls.filter(item =>
                item.eventDate > candidatePut.eventDate &&
                (!asset || item.op.ativo === asset)
            );
            if (matchingCalls.length) {
                lastPut  = candidatePut;
                lastCall = matchingCalls[matchingCalls.length - 1];
                break;
            }
        }

        // Fallback: PUT sem CALL correspondente → ciclo ainda aberto
        if (!lastPut) {
            lastPut = exercisedPuts[exercisedPuts.length - 1];
        }

        const putStrike  = parseFloat(lastPut.op.strike || 0)  || 0;
        const callStrike = lastCall ? (parseFloat(lastCall.op.strike || 0) || 0) : 0;

        // betweenOps: operações desde a PUT até a CALL (inclusive)
        const betweenOps = sortedPeriod.filter(item => {
            const isAfterOrAtPut = item.eventDate >= lastPut.eventDate;
            if (!isAfterOrAtPut) return false;
            if (!lastCall) return true;
            return item.eventDate <= lastCall.eventDate;
        });

        const afterCallOps = lastCall
            ? sortedPeriod.filter(item => item.eventDate > lastCall.eventDate)
            : [];

        const premiumBetween = betweenOps.reduce((acc, item) =>
            acc + (parseFloat(item.op.premio_us) || 0), 0);

        // swapResult = variação do ativo na conversão (pode ser negativo)
        // diff       = resultado total do ciclo = swapResult + prêmios coletados
        const swapResult = lastCall ? (callStrike - putStrike) : null;
        const diff       = lastCall ? (swapResult + premiumBetween) : null;
        const diffPct    = lastCall && putStrike !== 0 ? (diff / putStrike) * 100 : null;
        const isLoss     = Number.isFinite(diff) ? diff < 0 : false;
        const lossValue  = isLoss ? Math.abs(diff) : 0;

        const premiumAfterCall = afterCallOps.reduce((acc, item) =>
            acc + (parseFloat(item.op.premio_us) || 0), 0);
        const recovered   = Math.max(0, premiumAfterCall);
        const missing     = Math.max(0, lossValue - recovered);
        const progressPct = lossValue > 0 ? Math.min(100, (recovered / lossValue) * 100) : 100;

        return {
            hasCycle: true,
            lastPut,
            lastCall,
            betweenOps,
            afterCallOps,
            premiumBetween,
            putStrike,
            callStrike,
            swapResult,
            diff,
            diffPct,
            isLoss,
            lossValue,
            recovered,
            missing,
            progressPct,
            periodTotal,
            historyTotal
        };
    }

    function renderFinalResultTab(opsForPeriod) {
        const container = document.getElementById('rtFinalResultBody');
        if (!container) return;

        const allOps = getCryptoOps();
        const model = calculateFinalResultModel(opsForPeriod, allOps);

        const filterTag = document.getElementById('rtFinalFilterTag');
        if (filterTag) {
            filterTag.textContent = `Período: ${state.period}`;
        }

        if (!model.hasCycle) {
            container.innerHTML = `
                <div class="row g-3">
                    <div class="col-12">
                        <div class="rt-final-card">
                            <div class="text-muted">${escapeHtml(model.reason || 'Sem dados para cálculo.')}</div>
                            <div class="mt-3 d-flex gap-3 flex-wrap">
                                <div><span class="rt-final-label">Resultado no período:</span> <span class="rt-final-value ${model.periodTotal >= 0 ? 'text-green' : 'text-danger'}">${fmtC(model.periodTotal)}</span></div>
                                <div><span class="rt-final-label">Resultado histórico:</span> <span class="rt-final-value ${model.historyTotal >= 0 ? 'text-green' : 'text-danger'}">${fmtC(model.historyTotal)}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12">
                        <div class="rt-final-card">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div class="rt-final-label">Prêmios coletados no período</div>
                                <div class="small text-muted">
                                    <span style="display:inline-block;width:10px;height:10px;background:#2fb344;border-radius:2px;"></span> Prêmio
                                    <span style="display:inline-block;width:20px;height:2px;background:#f6c23e;vertical-align:middle;margin-left:6px;"></span> Acumulado
                                </div>
                            </div>
                            <div style="position:relative;height:220px;">
                                <canvas id="rtFinalResultChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            renderFinalResultChart(opsForPeriod, model);
            return;
        }

        const lastPut  = model.lastPut;
        const lastCall = model.lastCall;
        const diffTone  = Number.isFinite(model.diff) && model.diff >= 0 ? 'text-green' : 'text-danger';
        const swapTone  = Number.isFinite(model.swapResult) && model.swapResult >= 0 ? 'text-green' : 'text-danger';

        const timelineRows = model.betweenOps.slice(0, 16).map(item => {
            const op = item.op;
            const premio = parseFloat(op.premio_us) || 0;
            const isExCall = isCallExercised(op);
            const isExPut  = isPutExercised(op);
            const badge = isExCall
                ? '<span class="badge bg-danger-lt text-danger ms-1" style="font-size:0.7rem;">CALL exercida</span>'
                : (isExPut ? '<span class="badge bg-warning-lt text-warning ms-1" style="font-size:0.7rem;">PUT exercida</span>' : '');
            return `
                <div class="rt-final-timeline-item">
                    <div class="meta">${item.eventDate.toLocaleDateString('pt-BR')}</div>
                    <div>
                        <div class="fw-semibold">${escapeHtml(op.ativo || 'N/A')} · ${escapeHtml(getOpType(op))}${badge}</div>
                        <div class="meta">Strike ${Number.isFinite(parseFloat(op.strike)) ? fmtC(op.strike) : '-'} · Status ${escapeHtml(String(op.status || 'ABERTA'))}</div>
                    </div>
                    <div class="${premio >= 0 ? 'text-green' : 'text-danger'} fw-bold">${fmtC(premio)}</div>
                </div>
            `;
        }).join('') || '<div class="text-muted">Sem operações no ciclo.</div>';

        const putCardHtml = `
            <div class="rt-final-card h-100">
                <div class="rt-final-label">PUT exercida <span class="badge bg-red-lt text-red ms-1" style="font-size:0.7rem;">Compra</span></div>
                <div class="rt-final-value text-danger">${fmtC(model.putStrike)}</div>
                <div class="meta">${escapeHtml(lastPut.op.ativo || '-')} · ${lastPut.eventDate.toLocaleDateString('pt-BR')} · ID #${escapeHtml(lastPut.op.id || '-')}</div>
            </div>`;

        const callCardHtml = lastCall
            ? `<div class="rt-final-card h-100">
                    <div class="rt-final-label">CALL exercida <span class="badge bg-green-lt text-green ms-1" style="font-size:0.7rem;">Venda</span></div>
                    <div class="rt-final-value text-green">${fmtC(model.callStrike)}</div>
                    <div class="meta">${escapeHtml(lastCall.op.ativo || '-')} · ${lastCall.eventDate.toLocaleDateString('pt-BR')} · ID #${escapeHtml(lastCall.op.id || '-')}</div>
               </div>`
            : `<div class="rt-final-card h-100">
                    <div class="rt-final-label">CALL exercida <span class="badge bg-warning-lt text-warning ms-1" style="font-size:0.7rem;">Aguardando</span></div>
                    <div class="text-warning small mt-2">Ciclo aberto — PUT exercida mas CALL ainda não exercida.<br>Ativo em carteira aguardando saída.</div>
               </div>`;

        const recoveryHtml = model.isLoss
            ? `
                <div class="rt-final-card mt-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="rt-final-label">Recuperação após ciclo fechado</div>
                        <span class="badge ${model.missing > 0 ? 'bg-danger' : 'bg-success'}">${model.missing > 0 ? 'Em recuperação' : 'Prejuízo coberto'}</span>
                    </div>
                    <div class="small text-muted mb-1">Prêmios coletados após CALL exercida: <span class="${model.recovered > 0 ? 'text-green' : 'text-muted'}">${fmtC(model.recovered)}</span></div>
                    <div class="small text-muted mb-2">Falta cobrir: <span class="${model.missing > 0 ? 'text-danger' : 'text-green'}">${fmtC(model.missing)}</span></div>
                    <div class="progress" style="height: 10px;">
                        <div class="progress-bar ${model.progressPct >= 100 ? 'bg-success' : 'bg-warning'}" style="width:${model.progressPct.toFixed(2)}%"></div>
                    </div>
                    <div class="small text-muted mt-1">${model.progressPct.toFixed(2)}% do prejuízo coberto por novos prêmios</div>
                </div>
            `
            : '';

        const chartHtml = `
            <div class="col-12">
                <div class="rt-final-card">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="rt-final-label">Prêmios coletados no período</div>
                        <div class="small text-muted">
                            <span style="display:inline-block;width:10px;height:10px;background:#2fb344;border-radius:2px;"></span> Normal
                            <span style="display:inline-block;width:10px;height:10px;background:#f59f00;border-radius:2px;margin-left:6px;"></span> PUT exercida
                            <span style="display:inline-block;width:10px;height:10px;background:#dc3545;border-radius:2px;margin-left:6px;"></span> CALL exercida
                            <span style="display:inline-block;width:20px;height:2px;background:#f6c23e;vertical-align:middle;margin-left:6px;"></span> Acumulado
                        </div>
                    </div>
                    <div style="position:relative;height:230px;">
                        <canvas id="rtFinalResultChart"></canvas>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = `
            <div class="row g-3">
                <div class="col-lg-4">${putCardHtml}</div>
                <div class="col-lg-4">
                    <div class="rt-final-card h-100">
                        <div class="rt-final-label">Prêmios coletados no ciclo</div>
                        <div class="rt-final-value text-green">${fmtC(model.premiumBetween)}</div>
                        <div class="meta">Operações no ciclo: ${model.betweenOps.length}</div>
                    </div>
                </div>
                <div class="col-lg-4">${callCardHtml}</div>
                <div class="col-12">
                    <div class="rt-final-card">
                        <div class="rt-final-label mb-2">Cálculo do ciclo${lastCall ? '' : ' <span class="badge bg-warning-lt text-warning ms-1" style="font-size:0.7rem;">Em aberto</span>'}</div>
                        <div class="row g-2">
                            <div class="col-6 col-sm-3">
                                <div class="small text-muted">CALL strike (venda)</div>
                                <div class="fw-semibold">${lastCall ? fmtC(model.callStrike) : '—'}</div>
                            </div>
                            <div class="col-6 col-sm-3">
                                <div class="small text-muted">PUT strike (compra)</div>
                                <div class="fw-semibold text-danger">− ${fmtC(model.putStrike)}</div>
                            </div>
                            <div class="col-6 col-sm-3">
                                <div class="small text-muted">Variação do ativo</div>
                                <div class="fw-semibold ${swapTone}">${Number.isFinite(model.swapResult) ? fmtC(model.swapResult) : '—'}</div>
                            </div>
                            <div class="col-6 col-sm-3">
                                <div class="small text-muted">+ Prêmios do ciclo</div>
                                <div class="fw-semibold text-green">+ ${fmtC(model.premiumBetween)}</div>
                            </div>
                        </div>
                        <hr class="my-2" style="border-color:rgba(148,163,184,0.15);">
                        <div class="d-flex align-items-center gap-4 flex-wrap">
                            <div>
                                <div class="small text-muted">Resultado do ciclo</div>
                                <div class="fw-bold ${diffTone} fs-4">${Number.isFinite(model.diff) ? fmtC(model.diff) : '—'}</div>
                            </div>
                            <div>
                                <div class="small text-muted">Variação %</div>
                                <div class="fw-semibold ${diffTone}">${Number.isFinite(model.diffPct) ? `${model.diffPct.toFixed(2)}%` : '—'}</div>
                            </div>
                            <div>
                                <div class="small text-muted">Prêmios no período</div>
                                <div class="fw-semibold ${model.periodTotal >= 0 ? 'text-green' : 'text-danger'}">${fmtC(model.periodTotal)}</div>
                            </div>
                            <div>
                                <div class="small text-muted">Histórico total</div>
                                <div class="fw-semibold ${model.historyTotal >= 0 ? 'text-green' : 'text-danger'}">${fmtC(model.historyTotal)}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-12">
                    <div class="rt-final-card">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div class="rt-final-label">Operações do ciclo (PUT exercida → CALL exercida)</div>
                            <span class="badge bg-dark-lt">${model.betweenOps.length}</span>
                        </div>
                        <div class="rt-final-timeline">${timelineRows}</div>
                    </div>
                    ${recoveryHtml}
                </div>
                ${chartHtml}
            </div>
        `;

        renderFinalResultChart(opsForPeriod, model);
    }

    function renderFinalResultChart(opsForPeriod, model) {
        const canvas = document.getElementById('rtFinalResultChart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (state.finalChart) {
            state.finalChart.destroy();
            state.finalChart = null;
        }

        const sorted = [...opsForPeriod]
            .filter(op => getOpDate(op))
            .sort((a, b) => getOpDate(a) - getOpDate(b));

        if (!sorted.length) return;

        const labels = sorted.map(op => {
            const d = getOpDate(op);
            const dateStr = d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-';
            return `${op.ativo || 'N/A'} ${getOpType(op)} ${dateStr}`;
        });

        const premios = sorted.map(op => parseFloat(op.premio_us) || 0);

        let acc = 0;
        const acumData = premios.map(v => { acc += v; return Number(acc.toFixed(2)); });

        const barColors = sorted.map(op => {
            if (isCallExercised(op)) return 'rgba(220,53,69,0.85)';
            if (isPutExercised(op)) return 'rgba(245,159,0,0.85)';
            return 'rgba(47,179,68,0.75)';
        });
        const borderColors = sorted.map(op => {
            if (isCallExercised(op)) return '#dc3545';
            if (isPutExercised(op)) return '#f59f00';
            return '#2fb344';
        });

        const datasets = [
            {
                type: 'bar',
                label: 'Prêmio (US$)',
                data: premios,
                backgroundColor: barColors,
                borderColor: borderColors,
                borderWidth: 1,
                yAxisID: 'y',
                order: 2
            },
            {
                type: 'line',
                label: 'Acumulado',
                data: acumData,
                borderColor: '#f6c23e',
                backgroundColor: 'rgba(246,194,62,0.08)',
                tension: 0.3,
                fill: true,
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#f6c23e',
                yAxisID: 'y',
                order: 1
            }
        ];

        // Linhas de referência de strike removidas: os strikes (ex: 74.000)
        // são ordens de magnitude maiores que os prêmios (~$2-30) e distorciam
        // completamente a escala do eixo Y. Os valores de strike são exibidos
        // nos cards de resumo acima do gráfico.

        state.finalChart = new Chart(canvas.getContext('2d'), {
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${fmtC(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', maxRotation: 40, font: { size: 10 } },
                        grid: { color: 'rgba(148,163,184,0.08)' }
                    },
                    y: {
                        ticks: {
                            color: '#94a3b8',
                            callback: v => fmtC(v)
                        },
                        grid: { color: 'rgba(148,163,184,0.12)' }
                    }
                }
            }
        });
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
Você é um analista quantitativo. Gere 4 insights curtos e objetivos sobre o desempenho de Dual Investment Crypto.
Formato: frases curtas sem markdown. Use português.

Resumo do período:
- Resultado total: ${fmtC(summary.total)}
- Win Rate: ${metrics.winRate.toFixed(2)}%
- ROI: ${metrics.roi.toFixed(2)}%
- Operações: ${summary.totalOps}
- Média por dia: ${fmtC(metrics.mediaDia)}
- Profit Factor: ${Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : '∞'}
- Melhor dia: ${bestDay ? fmtC(bestDay[1]) : '-'}
- Pior dia: ${worstDay ? fmtC(worstDay[1]) : '-'}
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
        renderCockpitBlend(ops);
        renderExercisedCallsCoverage(ops);
        renderFinalResultTab(ops);
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
                statusEl.textContent = `Atualizado: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }
        }
    }

    async function ensureModalLoaded() {
        if (document.getElementById(cfg.modalElId)) return true;
        const container = document.getElementById(cfg.containerElId);
        if (!container || state.loading) return false;
        state.loading = true;
        try {
            const response = await fetch(cfg.templatePath);
            const html = await response.text();
            container.innerHTML = html;
            return true;
        } catch (error) {
            console.error('[ModalResultadoTotalCrypto]', error);
            return false;
        } finally {
            state.loading = false;
        }
    }

    async function openResultadoTotalModal() {
        const loaded = await ensureModalLoaded();
        if (!loaded) return;
        const modalEl = document.getElementById(cfg.modalElId);
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
        const card = document.getElementById(cfg.triggerCard);
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

    function configure(opts) {
        Object.assign(cfg, opts);
        state.period = opts.period || state.period;
        setupTriggers();
    }

    document.addEventListener('layoutReady', () => {
        setupTriggers();
    });

    window.addEventListener('load', () => {
        setupTriggers();
    });

    window.ModalResultadoTotalCrypto = { configure, openModal: openResultadoTotalModal };
})();

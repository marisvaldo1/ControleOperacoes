/* modal-resumo-opcoes.js — Painel de Resumo de Opções (réplica do Resumo de Crypto, adaptado para BRL) */
/* Fonte de dados: GET /api/opcoes (window.opcoesOperacoes / window.allOperacoes / evento 'opcoesDataUpdated'). */
(function () {
    'use strict';

    const cfg = {
        apiEndpoint: `${window.API_BASE || ''}/api/opcoes`,
        containerId: 'modalResumoContainer',
        modalId: 'modalResumoOpcoes',
        templatePath: '../components/modals/opcoes/modal-resumo-opcoes.html'
    };
    let operations = [], activePeriod = 'mensal', charts = {};
    let _header = null;          // controlador local do header/filtros
    let _activeFullState = null; // estado completo dos filtros (CryptoFilterBar)

    const num = value => Number(value) || 0;
    const pf = value => (typeof parseFloatSafe === 'function' ? parseFloatSafe(value) : (Number(value) || 0));
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    const dateOf = op => { const raw = op?.data_operacao || op?.created_at; if (!raw) return null; const date = new Date(`${String(raw).slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; };
    const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = key => { const [year, month] = key.split('-'); return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); };
    const shortDate = key => { const [, month, day] = key.split('-'); return `${day}/${month}`; };
    // Prêmio total da operação (R$) = prêmio unitário × |quantidade|
    const premium = op => pf(op?.premio) * Math.abs(parseInt(op?.quantidade, 10) || 0);
    const result = op => num(pf(op?.resultado));

    // ── Formatação (BRL) ────────────────────────────────────────────────
    const money = value => {
        const v = num(value);
        const abs = Math.abs(v);
        const formatted = (typeof formatCurrency === 'function') ? formatCurrency(abs, 'BRL') : `R$ ${abs.toFixed(2)}`;
        return `${v >= 0 ? '+' : '-'}${formatted}`;
    };
    const pct = value => (typeof formatROIPct === 'function' ? formatROIPct(num(value)) : `${num(value).toFixed(2)}%`);

    // Resultado (%) sobre o saldo da corretora (R$)
    const saldoCorretora = () => { try { return parseFloat(JSON.parse(localStorage.getItem('appConfig') || '{}').saldoAcoes) || 0; } catch (_) { return 0; } };
    const roiOf = resTotal => { const saldo = saldoCorretora(); return saldo > 0 ? (num(resTotal) / saldo) * 100 : 0; };

    function range(period) {
        const end = new Date(); end.setHours(23, 59, 59, 999);
        const start = new Date(end); start.setHours(0, 0, 0, 0);

        if (period === 'today') return { start, end };
        if (period === 'semanal') {
            const dow = start.getDay();
            start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
            return { start, end };
        }
        if (period === 'mensal') { start.setDate(1); return { start, end }; }
        if (period === 'anual') { start.setMonth(0, 1); return { start, end }; }
        if (period === 'all' || period === 'todos') { start.setFullYear(1970, 0, 1); return { start, end }; }
        // Fallback: últimos 30 dias
        start.setDate(start.getDate() - 29);
        return { start, end };
    }

    // Aplica o estado do header (status/tipo) sobre a lista já filtrada por período
    function applyStateFilters(ops, state) {
        return ops.filter(op => {
            if (Array.isArray(state.statusList)) {
                if (state.statusList.length === 0) return false;
                const s = String(op.status || '').toLowerCase();
                const ok = state.statusList.some(v => {
                    if (v === 'exercida') return s === 'exercida';
                    if (v === 'nao_exercida') return s !== 'aberta' && s !== 'exercida';
                    return s === v.toLowerCase();
                });
                if (!ok) return false;
            }
            if (Array.isArray(state.tipoList)) {
                if (state.tipoList.length === 0) return false;
                if (!state.tipoList.some(t => String(op.tipo || '').toUpperCase() === t.toUpperCase())) return false;
            }
            return true;
        });
    }

    function filterPeriod(period) {
        let filtered = operations;
        const state = _activeFullState;
        if (state && state.period === 'custom') {
            // Período personalizado: usa dateFrom/dateTo definidos na barra de filtros.
            const start = state.dateFrom ? new Date(`${state.dateFrom}T00:00:00`) : null;
            const end = state.dateTo ? new Date(`${state.dateTo}T23:59:59`) : null;
            if (start || end) {
                filtered = filtered.filter(op => {
                    const date = dateOf(op);
                    if (!date) return false;
                    if (start && date < start) return false;
                    if (end && date > end) return false;
                    return true;
                });
            }
        } else {
            const { start, end } = range(period);
            filtered = filtered.filter(op => { const date = dateOf(op); return date && date >= start && date <= end; });
        }
        if (state) filtered = applyStateFilters(filtered, state);
        return filtered;
    }

    function aggregate(ops, kind) {
        const map = new Map();
        ops.forEach(op => {
            const date = dateOf(op); if (!date) return;
            let key = monthKey(date);
            if (kind === 'day') key = dayKey(date);
            if (kind === 'week') { const monday = new Date(date); const weekday = monday.getDay() || 7; monday.setDate(monday.getDate() - weekday + 1); key = dayKey(monday); }
            if (kind === 'individual') key = `op_${op.id || op.created_at || Math.random().toString(36).slice(2)}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(op);
        });
        return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    }

    function stats(ops) {
        const values = ops.map(result);
        const positive = values.filter(value => value > 0).length;
        const premiumTotal = ops.reduce((sum, op) => sum + premium(op), 0);
        const resultTotal = values.reduce((sum, value) => sum + value, 0);
        return {
            premium: premiumTotal,
            averagePremium: ops.length ? premiumTotal / ops.length : 0,
            result: resultTotal,
            resultPct: roiOf(resultTotal),
            total: ops.length,
            positive,
            winRate: ops.length ? positive / ops.length * 100 : 0
        };
    }

    function focusMetrics(ops, period) {
        if (period === 'mensal') {
            const groups = aggregate(ops, 'month');
            return groups.length ? stats(groups[groups.length - 1][1]) : stats(ops);
        }
        return stats(ops);
    }

    function chartOptions(extra = {}) {
        return { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e6edf3', font: { size: 11 } } } }, scales: { x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } }, y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true } }, ...extra };
    }

    function createChart(id, config) {
        if (!window.Chart) return;
        const canvas = document.getElementById(id); if (!canvas) return;
        charts[id]?.destroy(); charts[id] = new Chart(canvas.getContext('2d'), config);
    }

    function destroyCharts() { Object.values(charts).forEach(chart => chart?.destroy()); charts = {}; }

    function kpis(data, labels = {}) {
        const items = [
            ['💰', labels.premium || 'Total Prêmios', money(data.premium), 'green'],
            ['📈', labels.result || 'Resultado Médio', pct(data.resultPct), 'blue'],
            ['🏆', labels.total || 'Total Operações', String(data.total), 'gold'],
            ['📊', labels.averagePremium || 'Prêmio Médio', money(data.averagePremium), 'pink'],
        ];
        return `<div class="resumo-kpi-grid" id="resumoOpcoesKpiGrid">${items.map(([icon, label, value, color]) => `<div class="resumo-kpi"><div class="resumo-kpi-icon">${icon}</div><div class="resumo-kpi-label">${escapeHtml(label)}</div><div class="resumo-kpi-value ${color}">${escapeHtml(value)}</div></div>`).join('')}</div>`;
    }

    /** Substitui a grade de KPIs em uso pela versão referente a um período específico selecionado. */
    function setKpis(data, labels = {}) {
        const grid = document.getElementById('resumoOpcoesKpiGrid');
        if (!grid) return;
        grid.outerHTML = kpis(data, labels);
    }

    function periodLabels(label) {
        return { premium: `Prêmios (${label})`, result: `Resultado médio (${label})`, total: `Operações (${label})`, averagePremium: `Prêmio médio (${label})` };
    }

    function getPeriodLabel(period) {
        if (period === 'today') return 'Hoje';
        if (period === 'semanal') return 'Semana';
        if (period === 'mensal') return 'Mês';
        if (period === 'anual') return 'Ano';
        return '30 Dias';
    }

    function chartBox(id, icon, title) { return `<div class="resumo-chart-box"><div class="resumo-chart-title"><i class="fas ${icon}"></i> ${title}</div><div class="resumo-chart-wrapper"><canvas id="${id}"></canvas></div></div>`; }

    function chartData(groups) {
        return {
            labels: groups.map(([key, ops]) => {
                if (key.startsWith('op_') && ops.length === 1) {
                    const op = ops[0];
                    return `${(op.ativo || '?').toUpperCase()} ${(op.tipo || '').toUpperCase()}`;
                }
                return key.length === 7 ? monthLabel(key) : shortDate(key);
            }),
            premiums: groups.map(([, ops]) => stats(ops).premium),
            results: groups.map(([, ops]) => stats(ops).result),
            totals: groups.map(([, ops]) => ops.length)
        };
    }

    function renderKpiAndCharts(view, ops, period) {
        const data = focusMetrics(ops, period);
        const groups = aggregate(ops, period === 'today' ? 'individual' : period === 'diario' ? 'day' : period === 'semanal' ? 'week' : 'month');
        const series = chartData(groups);
        const periodLabel = getPeriodLabel(period);
        const labels = period === 'today'
            ? { premium: `Total Prêmios (${periodLabel})`, result: `Resultado Médio (${periodLabel})`, total: `Operações (${periodLabel})` }
            : period === 'semanal'
            ? { premium: `Total Prêmios (${periodLabel})`, result: `Resultado Médio (${periodLabel})`, total: `Operações (${periodLabel})` }
            : period === 'diario'
            ? { premium: 'Total Prêmios (30d)', result: 'Resultado Médio (30d)', total: 'Operações (30d)' }
            : period === 'mensal'
            ? { premium: `Total Prêmios (${groups.length ? monthLabel(groups[groups.length - 1][0]).toUpperCase() : 'MÊS'})`, result: 'Resultado Médio', total: 'Operações' }
            : {};
        view.insertAdjacentHTML('beforeend', kpis(data, labels));
        return { groups, series };
    }

    function renderAnual(view, ops) {
        const { series } = renderKpiAndCharts(view, ops, 'anual');
        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoOpcoesAnualLine', 'fa-chart-line', 'Evolução Anual (Prêmios + Resultado)')}${chartBox('resumoOpcoesAnualBar', 'fa-chart-bar', 'Comparação Anual')}</div>`);
        createChart('resumoOpcoesAnualLine', { type: 'line', data: { labels: series.labels, datasets: [{ label: 'Prêmios (R$)', data: series.premiums, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ff88' }, { label: 'Resultado (R$)', data: series.results, borderColor: '#00ccff', backgroundColor: 'rgba(0,204,255,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ccff' }] }, options: chartOptions() });
        createChart('resumoOpcoesAnualBar', { type: 'bar', data: { labels: series.labels, datasets: [{ label: 'Prêmios (R$)', data: series.premiums, backgroundColor: 'rgba(0,255,136,.3)', borderColor: '#00ff88', borderWidth: 1 }] }, options: chartOptions() });
    }

    function renderMensal(view, ops) {
        const data = stats(ops);
        const periodLabel = getPeriodLabel('mensal');
        const labels = { premium: `Total Prêmios (${periodLabel})`, result: `Resultado Médio (${periodLabel})`, total: `Operações (${periodLabel})` };
        view.insertAdjacentHTML('beforeend', kpis(data, labels));

        const groups = aggregate(ops, 'week');
        const series = chartData(groups);

        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoOpcoesMensalLine', 'fa-chart-line', 'Evolução Semanal (Prêmios + Resultado)')}${chartBox('resumoOpcoesMensalBar', 'fa-chart-bar', 'Prêmios por Semana')}</div><div class="resumo-premium-list" id="resumoOpcoesMensalList"></div>`);
        createChart('resumoOpcoesMensalLine', { type: 'line', data: { labels: series.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios (R$)', data: series.premiums, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ff88' }, { label: 'Resultado (R$)', data: series.results, borderColor: '#00ccff', backgroundColor: 'rgba(0,204,255,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ccff' }] }, options: chartOptions() });
        createChart('resumoOpcoesMensalBar', { type: 'bar', data: { labels: series.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios (R$)', data: series.premiums, backgroundColor: 'rgba(0,255,136,.25)', borderColor: '#00ff88', borderWidth: 2, borderRadius: 4 }] }, options: chartOptions() });
        renderCards('resumoOpcoesMensalList', groups, 'week');
    }

    function renderSemanal(view, ops) {
        const data = stats(ops);
        const periodLabel = getPeriodLabel('semanal');
        const labels = { premium: `Total Prêmios (${periodLabel})`, result: `Resultado Médio (${periodLabel})`, total: `Operações (${periodLabel})` };
        view.insertAdjacentHTML('beforeend', kpis(data, labels));

        const weekGroups = aggregate(ops, 'week');
        const weekSeries = chartData(weekGroups);
        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoOpcoesSemanalLine', 'fa-chart-line', 'Evolução Semanal (Prêmios + Resultado)')}${chartBox('resumoOpcoesSemanalBar', 'fa-chart-bar', 'Prêmios por Semana')}</div>`);
        createChart('resumoOpcoesSemanalLine', { type: 'line', data: { labels: weekSeries.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios (R$)', data: weekSeries.premiums, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.06)', fill: true, tension: .3, pointBackgroundColor: '#00ff88' }, { label: 'Resultado (R$)', data: weekSeries.results, borderColor: '#00ccff', backgroundColor: 'rgba(0,204,255,.06)', fill: true, tension: .3, pointBackgroundColor: '#00ccff' }] }, options: chartOptions() });
        createChart('resumoOpcoesSemanalBar', { type: 'bar', data: { labels: weekSeries.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios (R$)', data: weekSeries.premiums, backgroundColor: 'rgba(255,184,0,.2)', borderColor: '#ffb800', borderWidth: 2, borderRadius: 4 }] }, options: chartOptions() });

        const dayGroups = aggregate(ops, 'day');
        view.insertAdjacentHTML('beforeend', `<div class="resumo-premium-list" id="resumoOpcoesSemanalList"></div>`);
        renderCards('resumoOpcoesSemanalList', dayGroups, 'day');
    }

    function renderDiario(view, ops, isToday = false) {
        const { groups, series } = renderKpiAndCharts(view, ops, isToday ? 'today' : 'diario');
        let accumulated = 0; const accumulatedData = series.premiums.map(value => { accumulated += value; return Number(accumulated.toFixed(2)); });

        const titleSuffix = isToday ? 'Hoje' : 'Últimos 30 Dias';
        const accTitle = isToday ? 'Acumulado do Dia' : 'Acumulado Diário';

        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoOpcoesDiarioLine', 'fa-chart-line', accTitle)}${chartBox('resumoOpcoesDiarioBar', 'fa-chart-bar', titleSuffix)}</div><div class="resumo-premium-list" id="resumoOpcoesDiarioList"></div>`);
        createChart('resumoOpcoesDiarioLine', { type: 'line', data: { labels: series.labels, datasets: [{ label: 'Acumulado de Prêmios (R$)', data: accumulatedData, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.15)', fill: true, tension: .4, pointRadius: 0 }] }, options: chartOptions() });
        createChart('resumoOpcoesDiarioBar', { type: 'bar', data: { labels: series.labels, datasets: [{ label: 'Prêmios (R$)', data: series.premiums, backgroundColor: 'rgba(255,184,0,.3)', borderColor: '#ffb800', borderWidth: 1 }] }, options: chartOptions({ scales: { x: { ticks: { color: '#8b949e', maxTicksLimit: 10 }, grid: { color: '#21262d' } }, y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true } } }) });
        renderCards('resumoOpcoesDiarioList', groups, isToday ? 'individual' : 'day');
    }

    /**
     * Renderiza os cards de período (mês/semana/dia) do mais recente para o mais antigo,
     * e habilita a seleção: ao clicar em um card, os KPIs acima passam a refletir os valores
     * exatamente daquele período clicado, destacando o card selecionado.
     */
    function renderCards(containerId, groups, kind) {
        const container = document.getElementById(containerId); if (!container) return;
        const ordered = groups.slice().reverse();
        container.innerHTML = ordered.map(([key, items], index) => {
            const data = stats(items);
            let label;
            if (kind === 'individual') {
                const op = items[0];
                label = `${(op.ativo || '?').toUpperCase()} ${(op.tipo || '').toUpperCase()}`;
            } else if (kind === 'day') {
                label = shortDate(key);
            } else if (kind === 'week') {
                label = `S${ordered.length - index}`;
            } else {
                label = monthLabel(key).toUpperCase();
            }
            const badgeClass = data.premium >= 0 ? 'resumo-premium-badge' : 'resumo-premium-badge resumo-premium-badge-neg';
            return `<button type="button" class="resumo-premium-item" data-resumo-card-key="${escapeHtml(key)}"><div class="resumo-premium-info"><div class="resumo-premium-period">${escapeHtml(label)}</div><div class="resumo-premium-amount">${money(data.premium)}</div></div><span class="${badgeClass}">${pct(data.resultPct)}</span></button>`;
        }).join('');

        container.querySelectorAll('[data-resumo-card-key]').forEach(card => {
            card.addEventListener('click', () => {
                const key = card.dataset.resumoCardKey;
                const match = groups.find(([groupKey]) => groupKey === key);
                if (!match) return;
                container.querySelectorAll('.resumo-premium-item').forEach(item => item.classList.remove('active'));
                card.classList.add('active');
                const label = card.querySelector('.resumo-premium-period')?.textContent || key;
                setKpis(stats(match[1]), periodLabels(label));
            });
        });
    }

    function renderOpenOps(view, filteredOps) {
        const openOps = filteredOps.filter(op => (op.status || '').toUpperCase() === 'ABERTA');
        if (!openOps.length) return;

        view.insertAdjacentHTML('beforeend', `
            <div class="resumo-open-ops-section">
                <div class="resumo-open-ops-title">
                    <i class="fas fa-lock-open"></i> Operações Abertas (${openOps.length})
                </div>
                <div class="resumo-premium-list" id="resumoOpcoesOpenOpsList">
                    ${openOps.map(op => {
                        const ativo = (op.ativo || '?').toUpperCase();
                        const tipo = (op.tipo || '').toUpperCase();
                        const premioVal = premium(op);
                        const date = dateOf(op);
                        const dateStr = date ? shortDate(dayKey(date)) : '—';
                        const badgeClass = tipo === 'CALL' ? 'resumo-premium-badge-call' : 'resumo-premium-badge-put';
                        return `<button type="button" class="resumo-premium-item resumo-premium-item-open">
                            <div class="resumo-premium-info">
                                <div class="resumo-premium-period">${escapeHtml(ativo)} ${escapeHtml(tipo)}</div>
                                <div class="resumo-premium-amount">${money(premioVal)}</div>
                                <div class="resumo-premium-date">${dateStr}</div>
                            </div>
                            <span class="${badgeClass}">${tipo}</span>
                        </button>`;
                    }).join('')}
                </div>
            </div>
        `);
    }

    function render() {
        const view = document.getElementById('resumoOpcoesView'); if (!view) return;
        destroyCharts(); view.innerHTML = ''; const ops = filterPeriod(activePeriod);
        if (!ops.length) { view.classList.add('d-none'); document.getElementById('resumoOpcoesEmpty')?.classList.remove('d-none'); return; }
        document.getElementById('resumoOpcoesEmpty')?.classList.add('d-none'); view.classList.remove('d-none');
        if (activePeriod === 'all') renderAnual(view, ops);
        else if (activePeriod === 'anual') renderAnual(view, ops);
        else if (activePeriod === 'mensal') renderMensal(view, ops);
        else if (activePeriod === 'semanal') renderSemanal(view, ops);
        else renderDiario(view, ops, activePeriod === 'today');

        renderOpenOps(view, ops);

        const updated = document.getElementById('resumoOpcoesUpdatedAt');
        if (updated) updated.textContent = `${operations.length} operações carregadas · atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    async function loadData() {
        const cached = Array.isArray(window.opcoesOperacoes) ? window.opcoesOperacoes
            : Array.isArray(window.allOperacoes) ? window.allOperacoes
            : Array.isArray(operations) ? operations : [];
        try {
            const response = await fetch(cfg.apiEndpoint, { cache: 'no-store' });
            const data = response.ok ? await response.json() : cached;
            operations = Array.isArray(data) ? data : cached;
        } catch (_) {
            operations = cached;
        }
        document.getElementById('resumoOpcoesLoading')?.classList.add('d-none');
        render();
    }

    async function ensureLoaded() {
        if (document.getElementById(cfg.modalId)) { _mountHeader(); return; }
        const container = document.getElementById(cfg.containerId); if (!container) return;
        try {
            const response = await fetch(`${cfg.templatePath}?v=1.0.0`);
            container.innerHTML = await response.text();
        } catch (_) { return; }
        const modal = document.getElementById(cfg.modalId);
        _mountHeader();
        modal?.addEventListener('hidden.bs.modal', () => {
            destroyCharts();
            if (_header) { _header.destroy(); _header = null; }
            _activeFullState = null;
            operations = [];
        });
    }

    /** Monta o cabeçalho + barra de filtros reaproveitando o CryptoFilterBar (visual idêntico ao Resumo de Crypto). */
    function _mountHeader() {
        const root = document.getElementById('resumoOpcoesHeader');
        if (!root || !window.CryptoFilterBar) return;
        const CFB = window.CryptoFilterBar;
        CFB.injectCSS();

        const id = 'rso_' + Math.random().toString(36).slice(2, 8);
        const idTime = id + '_time';
        const idRefresh = id + '_refresh';
        const idBar = id + '_bar';
        const idBarHost = id + '_bar_host';

        // Estado dos filtros compatível com o domínio de opções (status/tipo)
        const state = CFB.createState({ period: 'mes', statusList: ['aberta', 'fechada', 'exercida'], tipoList: ['CALL', 'PUT'] });
        _activeFullState = state;

        root.innerHTML =
            CFB.renderHeader({ id_time: idTime, id_refresh: idRefresh, title: 'Resumo de Opções', icon: '💰', modal_id: cfg.modalId }) +
            `<div id="${idBarHost}"></div>`;

        const host = document.getElementById(idBarHost);
        host.innerHTML = CFB.renderFilterBar({
            id: idBar,
            state: state,
            showPeriods: true,
            showStatus: true,
            showTipo: true,
            showMoeda: false,     // não há "moeda" no domínio de opções
            showCorretora: false, // não há corretora no domínio de opções
        });
        const barEl = document.getElementById(idBar);
        if (barEl) CFB.bind(barEl, state, function (newState) { onHeaderChange(newState); });

        CFB.updateTime(idTime);

        const refreshBtn = document.getElementById(idRefresh);
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                refreshBtn.classList.add('spin');
                Promise.resolve(loadData()).finally(function () {
                    setTimeout(function () { refreshBtn.classList.remove('spin'); }, 500);
                });
            });
        }

        _header = {
            getState: () => state,
            destroy: () => { root.innerHTML = ''; }
        };
    }

    function onHeaderChange(state) {
        if (state && state.period) {
            if (state.period === 'all' || state.period === 'todos') activePeriod = 'all';
            else if (state.period === 'ano' || state.period === 'year') activePeriod = 'anual';
            else if (state.period === 'mes') activePeriod = 'mensal';
            else if (state.period === 'semana') activePeriod = 'semanal';
            else if (state.period === 'today') activePeriod = 'today';
            else activePeriod = 'diario';
        }
        render();
    }

    async function open() {
        await ensureLoaded();
        const modal = document.getElementById(cfg.modalId);
        if (!modal || !window.bootstrap?.Modal) return;
        bootstrap.Modal.getOrCreateInstance(modal).show();
        document.getElementById('resumoOpcoesLoading')?.classList.remove('d-none');
        await loadData();
    }

    function close() {
        const modal = document.getElementById(cfg.modalId);
        if (modal && window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(modal).hide();
    }

    // Auto-init: botão do header abre o modal
    document.addEventListener('DOMContentLoaded', () => document.getElementById('btnResumoOpcoes')?.addEventListener('click', open));

    // Sempre que as operações de opções recarregarem, mantém o resumo sincronizado
    document.addEventListener('opcoesDataUpdated', function (ev) {
        const ops = ev?.detail?.operacoes;
        if (!Array.isArray(ops)) return;
        operations = ops;
        const modal = document.getElementById(cfg.modalId);
        if (modal && modal.classList.contains('show')) render();
    });

    window.ModalResumoOpcoes = { open: open, close: close, reload: loadData };
})();

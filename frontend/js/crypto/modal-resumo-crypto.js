/* modal-resumo-crypto.js — Painel de Resumo Crypto inspirado em ideias/deepResumo.html */
/* v2.0: Integração com CryptoModalHeader para filtros padrão */
(function () {
    'use strict';

    const cfg = { apiEndpoint: '/api/crypto', containerId: 'modalResumoCryptoContainer', modalId: 'modalResumoCrypto', templatePath: '../components/modals/crypto/modal-resumo-crypto.html' };
    let operations = [], activePeriod = 'anual', charts = {};
    let _header = null; // controlador CryptoModalHeader
    let _activeFullState = null; // estado completo dos filtros
    const colors = ['#00ff88', '#ff4466', '#ffb800', '#00ccff', '#a855f7', '#f472b6', '#34d399', '#fbbf24', '#fb923c', '#60a5fa', '#e879f9', '#2dd4bf'];

    const num = value => Number(value) || 0;
    const money = value => `${num(value) >= 0 ? '+' : '-'}US$ ${Math.abs(num(value)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pct = value => `${num(value).toFixed(2)}%`;
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    const dateOf = op => { const raw = op?.data_operacao || op?.created_at || op?.exercicio; if (!raw) return null; const date = new Date(`${String(raw).slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; };
    const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = key => { const [year, month] = key.split('-'); return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); };
    const shortDate = key => { const [year, month, day] = key.split('-'); return `${day}/${month}`; };
    const premium = op => num(op?.premio_us);
    const result = op => num(op?.resultado);

    function range(period) {
        const end = new Date(); end.setHours(23, 59, 59, 999);
        const start = new Date(end); start.setHours(0, 0, 0, 0);
        
        // Tratamento específico para cada período
        if (period === 'today') {
            // Hoje - apenas o dia atual
            return { start, end };
        }
        if (period === 'semanal') {
            // Semana atual - de segunda a domingo
            const dow = start.getDay();
            start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
            return { start, end };
        }
        if (period === 'mensal') {
            // Mês atual - do primeiro dia do mês
            start.setDate(1);
            return { start, end };
        }
        if (period === 'anual') {
            // Ano inteiro
            start.setMonth(0, 1);
            return { start, end };
        }
        if (period === 'all' || period === 'todos') {
            // Todas as operações - sem filtro de data
            start.setFullYear(2020, 0, 1);
            return { start, end };
        }
        // Fallback para 30 dias
        start.setDate(start.getDate() - 29);
        return { start, end };
    }

    function filterPeriod(period) {
        const { start, end } = range(period);
        let filtered = operations.filter(op => { const date = dateOf(op); return date && date >= start && date <= end; });
        
        // Aplica filtros do CryptoModalHeader quando disponível
        if (_activeFullState && window.CryptoFilterBar && window.CryptoFilterBar.filter) {
            filtered = window.CryptoFilterBar.filter(filtered, _activeFullState);
        }
        
        return filtered;
    }

    function aggregate(ops, kind) {
        const map = new Map();
        ops.forEach(op => {
            const date = dateOf(op); if (!date) return;
            let key = monthKey(date);
            if (kind === 'day') key = dayKey(date);
            if (kind === 'week') { const monday = new Date(date); const weekday = monday.getDay() || 7; monday.setDate(monday.getDate() - weekday + 1); key = dayKey(monday); }
            if (kind === 'individual') {
                // Cada operação fica separada (usado para "Hoje")
                key = `op_${op.id || op.created_at || Math.random().toString(36).slice(2)}`;
            }
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(op);
        });
        return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    }

    function stats(ops) {
        const values = ops.map(result); const positive = values.filter(value => value > 0).length;
        return { premium: ops.reduce((sum, op) => sum + premium(op), 0), averagePremium: ops.length ? ops.reduce((sum, op) => sum + premium(op), 0) / ops.length : 0, result: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0, total: ops.length, positive, winRate: ops.length ? positive / ops.length * 100 : 0 };
    }

    function focusMetrics(ops, period) {
        if (period === 'anual') return stats(ops);
        if (period === 'today') return stats(ops);
        if (period !== 'mensal') return stats(ops);
        const groups = aggregate(ops, 'month');
        return groups.length ? stats(groups[groups.length - 1][1]) : stats(ops);
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
            ['📈', labels.result || 'Resultado Médio', pct(data.result), 'blue'],
            ['🏆', labels.total || 'Total Operações', String(data.total), 'gold'],
            ['📊', labels.averagePremium || 'Prêmio Médio', money(data.averagePremium), 'pink'],
        ];
        return `<div class="resumo-kpi-grid" id="resumoKpiGrid">${items.map(([icon, label, value, color]) => `<div class="resumo-kpi"><div class="resumo-kpi-icon">${icon}</div><div class="resumo-kpi-label">${escapeHtml(label)}</div><div class="resumo-kpi-value ${color}">${escapeHtml(value)}</div></div>`).join('')}</div>`;
    }

    /** Substitui a grade de KPIs em uso pela versão referente a um período específico selecionado. */
    function setKpis(data, labels = {}) {
        const grid = document.getElementById('resumoKpiGrid');
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
                // Se for operação individual (Hoje), mostra ativo + tipo
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
            ? { premium: `Total Prêmios (30d)`, result: 'Resultado Médio (30d)', total: 'Operações (30d)' } 
            : period === 'mensal' 
            ? { premium: `Total Prêmios (${groups.length ? monthLabel(groups[groups.length - 1][0]).toUpperCase() : 'MÊS'})`, result: 'Resultado Médio', total: 'Operações' } 
            : {};
        view.insertAdjacentHTML('beforeend', kpis(data, labels));
        return { groups, series };
    }

    function renderAnual(view, ops) {
        const { series } = renderKpiAndCharts(view, ops, 'anual');
        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoAnualLine', 'fa-chart-line', 'Evolução Anual (Prêmios + Resultado)')}${chartBox('resumoAnualBar', 'fa-chart-bar', 'Comparação Anual')}</div>`);
        createChart('resumoAnualLine', { type: 'line', data: { labels: series.labels, datasets: [{ label: 'Prêmios', data: series.premiums, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ff88' }, { label: 'Resultado médio (%)', data: series.results, borderColor: '#00ccff', backgroundColor: 'rgba(0,204,255,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ccff' }] }, options: chartOptions() });
        createChart('resumoAnualBar', { type: 'bar', data: { labels: series.labels, datasets: [{ label: 'Prêmios', data: series.premiums, backgroundColor: 'rgba(0,255,136,.3)', borderColor: '#00ff88', borderWidth: 1 }] }, options: chartOptions() });
    }

    function renderMensal(view, ops) {
        // KPIs com totais do mês
        const data = stats(ops);
        const periodLabel = getPeriodLabel('mensal');
        const labels = { premium: `Total Prêmios (${periodLabel})`, result: `Resultado Médio (${periodLabel})`, total: `Operações (${periodLabel})` };
        view.insertAdjacentHTML('beforeend', kpis(data, labels));

        // Gráficos e cards: agregados por semana dentro do mês
        const groups = aggregate(ops, 'week');
        const series = chartData(groups);
        let accumulated = 0; const accumulatedData = series.premiums.map(value => { accumulated += value; return Number(accumulated.toFixed(2)); });

        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoMensalLine', 'fa-chart-line', 'Evolução Semanal (Prêmios + Resultado)')}${chartBox('resumoMensalBar', 'fa-chart-bar', 'Prêmios por Semana')}</div><div class="resumo-premium-list" id="resumoMensalList"></div>`);
        createChart('resumoMensalLine', { type: 'line', data: { labels: series.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios', data: series.premiums, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ff88' }, { label: 'Resultado médio (%)', data: series.results, borderColor: '#00ccff', backgroundColor: 'rgba(0,204,255,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ccff' }] }, options: chartOptions() });
        createChart('resumoMensalBar', { type: 'bar', data: { labels: series.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios', data: series.premiums, backgroundColor: 'rgba(0,255,136,.25)', borderColor: '#00ff88', borderWidth: 2, borderRadius: 4 }] }, options: chartOptions() });
        renderCards('resumoMensalList', groups, 'week');
    }

    function renderSemanal(view, ops) {
        // KPIs com totais da semana
        const data = stats(ops);
        const periodLabel = getPeriodLabel('semanal');
        const labels = { premium: `Total Prêmios (${periodLabel})`, result: `Resultado Médio (${periodLabel})`, total: `Operações (${periodLabel})` };
        view.insertAdjacentHTML('beforeend', kpis(data, labels));

        // Gráficos: agregados por semana
        const weekGroups = aggregate(ops, 'week');
        const weekSeries = chartData(weekGroups);
        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoSemanalLine', 'fa-chart-line', 'Evolução Semanal (Prêmios + Resultado)')}${chartBox('resumoSemanalBar', 'fa-chart-bar', 'Prêmios por Semana')}</div>`);
        createChart('resumoSemanalLine', { type: 'line', data: { labels: weekSeries.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios', data: weekSeries.premiums, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.06)', fill: true, tension: .3, pointBackgroundColor: '#00ff88' }, { label: 'Resultado médio (%)', data: weekSeries.results, borderColor: '#00ccff', backgroundColor: 'rgba(0,204,255,.06)', fill: true, tension: .3, pointBackgroundColor: '#00ccff' }] }, options: chartOptions() });
        createChart('resumoSemanalBar', { type: 'bar', data: { labels: weekSeries.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios', data: weekSeries.premiums, backgroundColor: 'rgba(255,184,0,.2)', borderColor: '#ffb800', borderWidth: 2, borderRadius: 4 }] }, options: chartOptions() });

        // Cards: operações diárias da semana
        const dayGroups = aggregate(ops, 'day');
        view.insertAdjacentHTML('beforeend', `<div class="resumo-premium-list" id="resumoSemanalList"></div>`);
        renderCards('resumoSemanalList', dayGroups, 'day');
    }

    function renderDiario(view, ops, isToday = false) {
        const { groups, series } = renderKpiAndCharts(view, ops, isToday ? 'today' : 'diario');
        let accumulated = 0; const accumulatedData = series.premiums.map(value => { accumulated += value; return Number(accumulated.toFixed(2)); });
        
        const titleSuffix = isToday ? 'Hoje' : 'Últimos 30 Dias';
        const accTitle = isToday ? 'Acumulado do Dia' : 'Acumulado Diário';
        
        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoDiarioLine', 'fa-chart-line', accTitle)}${chartBox('resumoDiarioBar', 'fa-chart-bar', titleSuffix)}</div><div class="resumo-premium-list" id="resumoDiarioList"></div>`);
        createChart('resumoDiarioLine', { type: 'line', data: { labels: series.labels, datasets: [{ label: 'Acumulado de Prêmios', data: accumulatedData, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.15)', fill: true, tension: .4, pointRadius: 0 }] }, options: chartOptions() });
        createChart('resumoDiarioBar', { type: 'bar', data: { labels: series.labels, datasets: [{ label: 'Prêmios', data: series.premiums, backgroundColor: 'rgba(255,184,0,.3)', borderColor: '#ffb800', borderWidth: 1 }] }, options: chartOptions({ scales: { x: { ticks: { color: '#8b949e', maxTicksLimit: 10 }, grid: { color: '#21262d' } }, y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true } } }) });
        renderCards('resumoDiarioList', groups, isToday ? 'individual' : 'day');
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
            return `<button type="button" class="resumo-premium-item" data-resumo-card-key="${escapeHtml(key)}"><div class="resumo-premium-info"><div class="resumo-premium-period">${escapeHtml(label)}</div><div class="resumo-premium-amount">${money(data.premium)}</div></div><span class="${badgeClass}">${pct(data.result)}</span></button>`;
        }).join('');

        container.querySelectorAll('[data-resumo-card-key]').forEach((card, index) => {
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
        
        const premium = op => num(op?.premio_us);
        const dateOf = op => { const raw = op?.data_operacao || op?.created_at || op?.exercicio; if (!raw) return null; const date = new Date(`${String(raw).slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; };
        
        view.insertAdjacentHTML('beforeend', `
            <div class="resumo-open-ops-section">
                <div class="resumo-open-ops-title">
                    <i class="fas fa-lock-open"></i> Operações Abertas (${openOps.length})
                </div>
                <div class="resumo-premium-list" id="resumoOpenOpsList">
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
        const view = document.getElementById('resumoCryptoView'); if (!view) return;
        destroyCharts(); view.innerHTML = ''; const ops = filterPeriod(activePeriod);
        if (!ops.length) { view.classList.add('d-none'); document.getElementById('resumoCryptoEmpty')?.classList.remove('d-none'); return; }
        document.getElementById('resumoCryptoEmpty')?.classList.add('d-none'); view.classList.remove('d-none');
        if (activePeriod === 'all') renderAnual(view, ops);
        else if (activePeriod === 'anual') renderAnual(view, ops);
        else if (activePeriod === 'mensal') renderMensal(view, ops);
        else if (activePeriod === 'semanal') renderSemanal(view, ops);
        else renderDiario(view, ops, activePeriod === 'today');
        
        // Adiciona seção de operações abertas (apenas as do período filtrado)
        renderOpenOps(view, ops);
        
        const updated = document.getElementById('resumoCryptoUpdatedAt'); if (updated) updated.textContent = `${operations.length} operações carregadas · atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    async function loadData() {
        const cached = Array.isArray(window.cryptoOperacoes) ? window.cryptoOperacoes : [];
        try { const response = await fetch(cfg.apiEndpoint); const data = response.ok ? await response.json() : cached; operations = Array.isArray(data) ? data : cached; } catch (_) { operations = cached; }
        document.getElementById('resumoCryptoLoading')?.classList.add('d-none'); render();
    }

    async function ensureLoaded() {
        if (document.getElementById(cfg.modalId)) {
            // Modal já carregado, apenas monta o header se necessário
            _mountHeader();
            return;
        }
        const container = document.getElementById(cfg.containerId); if (!container) return;
        const response = await fetch(`${cfg.templatePath}?v=3.0.0`); container.innerHTML = await response.text();
        const modal = document.getElementById(cfg.modalId);
        _mountHeader();
        modal?.addEventListener('hidden.bs.modal', () => {
            destroyCharts();
            if (_header) { _header.destroy(); _header = null; }
        });
    }

    function _mountHeader() {
        if (!window.CryptoModalHeader) return;
        if (_header) { _header.destroy(); _header = null; }
        _header = window.CryptoModalHeader.mount('#resumoCryptoHeader', {
            title:         'Painel de Lucros',
            icon:          '💰',
            defaultPeriod: 'mes',
            closeModalId:  'modalResumoCrypto',
            defaultState: {
                statusList: ['aberta', 'fechada', 'exercida', 'nao_exercida'],
                tipoList:   ['CALL', 'PUT'],
            },
            onFilter: function (state) {
                _activeFullState = state;
                // Mapeia período do CryptoFilterBar para período do resumo
                if (state.period) {
                    if (state.period === 'all' || state.period === 'todos') {
                        activePeriod = 'all';
                    } else if (state.period === 'ano' || state.period === 'year') {
                        activePeriod = 'anual';
                    } else if (state.period === 'mes') {
                        activePeriod = 'mensal';
                    } else if (state.period === 'semana') {
                        activePeriod = 'semanal';
                    } else if (state.period === 'today') {
                        activePeriod = 'today';
                    } else {
                        activePeriod = 'diario';
                    }
                }
                render();
            },
            onRefresh: loadData,
            showTotals: false,
        });
    }

    async function open() { await ensureLoaded(); const modal = document.getElementById(cfg.modalId); if (!modal || !window.bootstrap?.Modal) return; bootstrap.Modal.getOrCreateInstance(modal).show(); document.getElementById('resumoCryptoLoading')?.classList.remove('d-none'); await loadData(); }
    document.addEventListener('DOMContentLoaded', () => document.getElementById('btnResumoCrypto')?.addEventListener('click', open));
    window.ModalResumoCrypto = { open, reload: loadData };
})();

/* modal-resumo-crypto.js — Painel de Resumo Crypto inspirado em ideias/deepResumo.html */
(function () {
    'use strict';

    const cfg = { apiEndpoint: '/api/crypto', containerId: 'modalResumoCryptoContainer', modalId: 'modalResumoCrypto', templatePath: '../components/modals/crypto/modal-resumo-crypto.html' };
    let operations = [], activePeriod = 'anual', charts = {};
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
        if (period === 'anual' || period === 'mensal') start.setMonth(0, 1);
        if (period === 'semanal') start.setDate(start.getDate() - 56);
        if (period === 'diario') start.setDate(start.getDate() - 29);
        return { start, end };
    }

    function filterPeriod(period) {
        const { start, end } = range(period);
        return operations.filter(op => { const date = dateOf(op); return date && date >= start && date <= end; });
    }

    function aggregate(ops, kind) {
        const map = new Map();
        ops.forEach(op => {
            const date = dateOf(op); if (!date) return;
            let key = monthKey(date);
            if (kind === 'day') key = dayKey(date);
            if (kind === 'week') { const monday = new Date(date); const weekday = monday.getDay() || 7; monday.setDate(monday.getDate() - weekday + 1); key = dayKey(monday); }
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

    function chartBox(id, icon, title) { return `<div class="resumo-chart-box"><div class="resumo-chart-title"><i class="fas ${icon}"></i> ${title}</div><div class="resumo-chart-wrapper"><canvas id="${id}"></canvas></div></div>`; }

    function chartData(groups) {
        return { labels: groups.map(([key]) => key.length === 7 ? monthLabel(key) : shortDate(key)), premiums: groups.map(([, ops]) => stats(ops).premium), results: groups.map(([, ops]) => stats(ops).result), totals: groups.map(([, ops]) => ops.length) };
    }

    function renderKpiAndCharts(view, ops, period) {
        const data = focusMetrics(ops, period);
        const groups = aggregate(ops, period === 'diario' ? 'day' : period === 'semanal' ? 'week' : 'month');
        const series = chartData(groups);
        const labels = period === 'semanal' ? { premium: 'Total Prêmios (8 sem.)', result: 'Resultado Médio (8 sem.)', total: 'Operações (8 sem.)' } : period === 'diario' ? { premium: 'Total Prêmios (30d)', result: 'Resultado Médio (30d)', total: 'Operações (30d)' } : period === 'mensal' ? { premium: `Total Prêmios (${groups.length ? monthLabel(groups[groups.length - 1][0]).toUpperCase() : 'MÊS'})`, result: 'Resultado Médio', total: 'Operações' } : {};
        view.insertAdjacentHTML('beforeend', kpis(data, labels));
        return { groups, series };
    }

    function renderAnual(view, ops) {
        const { series } = renderKpiAndCharts(view, ops, 'anual');
        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoAnualLine', 'fa-chart-line', 'Evolução Anual (Prêmios + Resultado)')}${chartBox('resumoAnualBar', 'fa-chart-bar', 'Comparação Anual')}</div>`);
        createChart('resumoAnualLine', { type: 'line', data: { labels: series.labels, datasets: [{ label: 'Prêmios', data: series.premiums, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ff88' }, { label: 'Resultado médio (%)', data: series.results, borderColor: '#00ccff', backgroundColor: 'rgba(0,204,255,.08)', fill: true, tension: .3, pointBackgroundColor: '#00ccff' }] }, options: chartOptions() });
        createChart('resumoAnualBar', { type: 'bar', data: { labels: series.labels, datasets: [{ label: 'Prêmios', data: series.premiums, backgroundColor: 'rgba(0,255,136,.3)', borderColor: '#00ff88', borderWidth: 1 }, { label: 'Operações', data: series.totals, backgroundColor: 'rgba(0,204,255,.3)', borderColor: '#00ccff', borderWidth: 1 }] }, options: chartOptions() });
    }

    function renderMensal(view, ops) {
        const { groups, series } = renderKpiAndCharts(view, ops, 'mensal');
        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoMensalBar', 'fa-chart-bar', 'Prêmios por Mês')}${chartBox('resumoMensalPie', 'fa-chart-pie', 'Distribuição Mensal')}</div><div class="resumo-premium-list" id="resumoMensalList"></div>`);
        createChart('resumoMensalBar', { type: 'bar', data: { labels: series.labels, datasets: [{ label: 'Prêmios', data: series.premiums, backgroundColor: 'rgba(0,255,136,.25)', borderColor: '#00ff88', borderWidth: 2, borderRadius: 4 }] }, options: chartOptions() });
        createChart('resumoMensalPie', { type: 'pie', data: { labels: series.labels, datasets: [{ data: series.premiums, backgroundColor: colors, borderColor: '#161b22', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#e6edf3', font: { size: 10 } } } } } });
        renderCards('resumoMensalList', groups, 'month');
    }

    function renderSemanal(view, ops) {
        const { groups, series } = renderKpiAndCharts(view, ops, 'semanal');
        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoSemanalLine', 'fa-chart-line', 'Tendência Semanal')}${chartBox('resumoSemanalBar', 'fa-chart-bar', 'Prêmios por Semana')}</div><div class="resumo-premium-list" id="resumoSemanalList"></div>`);
        createChart('resumoSemanalLine', { type: 'line', data: { labels: series.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios', data: series.premiums, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.06)', fill: true, tension: .3, pointBackgroundColor: '#00ff88' }, { label: 'Resultado médio (%)', data: series.results, borderColor: '#00ccff', backgroundColor: 'rgba(0,204,255,.06)', fill: true, tension: .3, pointBackgroundColor: '#00ccff' }] }, options: chartOptions() });
        createChart('resumoSemanalBar', { type: 'bar', data: { labels: series.labels.map((_, i) => `S${i + 1}`), datasets: [{ label: 'Prêmios', data: series.premiums, backgroundColor: 'rgba(255,184,0,.2)', borderColor: '#ffb800', borderWidth: 2, borderRadius: 4 }] }, options: chartOptions() });
        renderCards('resumoSemanalList', groups, 'week');
    }

    function renderDiario(view, ops) {
        const { groups, series } = renderKpiAndCharts(view, ops, 'diario');
        let accumulated = 0; const accumulatedData = series.premiums.map(value => { accumulated += value; return Number(accumulated.toFixed(2)); });
        view.insertAdjacentHTML('beforeend', `<div class="resumo-chart-grid">${chartBox('resumoDiarioLine', 'fa-chart-line', 'Últimos 30 Dias')}${chartBox('resumoDiarioArea', 'fa-chart-area', 'Acumulado Diário')}</div><div class="resumo-premium-list" id="resumoDiarioList"></div>`);
        createChart('resumoDiarioLine', { type: 'line', data: { labels: series.labels, datasets: [{ label: 'Prêmios Diários', data: series.premiums, borderColor: '#ffb800', backgroundColor: 'rgba(255,184,0,.06)', fill: true, tension: .4, pointBackgroundColor: '#ffb800', pointRadius: 2 }] }, options: chartOptions({ scales: { x: { ticks: { color: '#8b949e', maxTicksLimit: 10 }, grid: { color: '#21262d' } }, y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true } } }) });
        createChart('resumoDiarioArea', { type: 'line', data: { labels: series.labels, datasets: [{ label: 'Acumulado de Prêmios', data: accumulatedData, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.15)', fill: true, tension: .4, pointRadius: 0 }] }, options: chartOptions() });
        renderCards('resumoDiarioList', groups.slice(-7), 'day');
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
            const label = kind === 'day' ? shortDate(key) : kind === 'week' ? `S${ordered.length - index}` : monthLabel(key).toUpperCase();
            return `<button type="button" class="resumo-premium-item" data-resumo-card-key="${escapeHtml(key)}"><div class="resumo-premium-info"><div class="resumo-premium-period">${escapeHtml(label)}</div><div class="resumo-premium-amount">${money(data.premium)}</div></div><span class="resumo-premium-badge">${pct(data.result)}</span></button>`;
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

    function render() {
        const view = document.getElementById('resumoCryptoView'); if (!view) return;
        destroyCharts(); view.innerHTML = ''; const ops = filterPeriod(activePeriod);
        if (!ops.length) { view.classList.add('d-none'); document.getElementById('resumoCryptoEmpty')?.classList.remove('d-none'); return; }
        document.getElementById('resumoCryptoEmpty')?.classList.add('d-none'); view.classList.remove('d-none');
        if (activePeriod === 'anual') renderAnual(view, ops);
        else if (activePeriod === 'mensal') renderMensal(view, ops);
        else if (activePeriod === 'semanal') renderSemanal(view, ops);
        else renderDiario(view, ops);
        const updated = document.getElementById('resumoCryptoUpdatedAt'); if (updated) updated.textContent = `${operations.length} operações carregadas · atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    async function loadData() {
        const cached = Array.isArray(window.cryptoOperacoes) ? window.cryptoOperacoes : [];
        try { const response = await fetch(cfg.apiEndpoint); const data = response.ok ? await response.json() : cached; operations = Array.isArray(data) ? data : cached; } catch (_) { operations = cached; }
        document.getElementById('resumoCryptoLoading')?.classList.add('d-none'); render();
    }

    async function ensureLoaded() {
        if (document.getElementById(cfg.modalId)) return;
        const container = document.getElementById(cfg.containerId); if (!container) return;
        const response = await fetch(`${cfg.templatePath}?v=3.0.0`); container.innerHTML = await response.text();
        const modal = document.getElementById(cfg.modalId);
        document.querySelectorAll('#resumoCryptoTabs [data-resumo-period]').forEach(button => button.addEventListener('click', () => { activePeriod = button.dataset.resumoPeriod; document.querySelectorAll('#resumoCryptoTabs .resumo-tab').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); }); render(); }));
        modal?.addEventListener('hidden.bs.modal', destroyCharts);
    }

    async function open() { await ensureLoaded(); const modal = document.getElementById(cfg.modalId); if (!modal || !window.bootstrap?.Modal) return; bootstrap.Modal.getOrCreateInstance(modal).show(); document.getElementById('resumoCryptoLoading')?.classList.remove('d-none'); await loadData(); }
    document.addEventListener('DOMContentLoaded', () => document.getElementById('btnResumoCrypto')?.addEventListener('click', open));
    window.ModalResumoCrypto = { open, reload: loadData };
})();

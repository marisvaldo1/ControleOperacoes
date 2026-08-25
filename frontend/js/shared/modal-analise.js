/**
 * modal-analise.js  v1.5.0
 * Modal de Análise de Performance – padrão IIFE do projeto
 * Acionado pelo botão #btnAnalise na barra superior
 */
(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Estado                                                               */
    /* ------------------------------------------------------------------ */
    const state = {
        loading: false,
        period: 'month',
        opsSort: 'date',
        ops: [],
        chart: null,
        apexLoaded: false,
        /* configurável para reutilização em outras páginas */
        apiEndpoint: '/api/opcoes',
        containerSelector: '#modalAnaliseContainer',
        modalId: 'modalAnalise',
        /* Posições Abertas tab */
        activeTab: 'desempenho',
        posicoes: [],
        posLiveData: {},
        posBarChart: null,
        posStatusChart: null,
        posRefreshing: false,
        posPayoffCharts: {},
        posEvolutionCharts: {},
        posGaugeCharts: {},
        /* Header component */
        header: null,
        headerInitialized: false,  // ✅ Flag para evitar inicialização dupla
        /* Período customizado */
        dateFrom: null,
        dateTo: null
    };

    function configure(opts) {
        if (opts.apiEndpoint) state.apiEndpoint = opts.apiEndpoint;
        if (opts.containerSelector) state.containerSelector = opts.containerSelector;
        if (opts.modalId) state.modalId = opts.modalId;
        // Para crypto: período padrão = 'all' (exibe todas as operações)
        if (opts.apiEndpoint && opts.apiEndpoint.includes('/crypto')) {
            state.period = 'all';
        }
    }

    /* ------------------------------------------------------------------ */
    /* Formatadores                                                         */
    /* ------------------------------------------------------------------ */
    function fmtCurrency(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
    }

    function fmtCurrencyShort(v) {
        const n = Math.abs(v);
        if (n >= 1000) return (v < 0 ? '-' : '') + 'R$\u00a0' + (n / 1000).toFixed(1) + 'k';
        return fmtCurrency(v);
    }

    /* Formatadores cientes do contexto (US$ para crypto, R$ para opcoes) */
    function fmtAmount(v) {
        if (state.apiEndpoint.includes('/crypto')) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(v || 0);
        }
        return fmtCurrency(v);
    }

    function fmtAmountShort(v) {
        if (!state.apiEndpoint.includes('/crypto')) return fmtCurrencyShort(v);
        const n = Math.abs(v || 0);
        if (n >= 1000) return (v < 0 ? '-' : '') + 'US$\u00a0' + (n / 1000).toFixed(1) + 'k';
        return fmtAmount(v);
    }

    function fmtPct(v) {
        const sign = v >= 0 ? '+' : '';
        return sign + v.toFixed(2) + '%';
    }

    function getSaldoCorretora() {
        try {
            const cfg = JSON.parse(localStorage.getItem('appConfig') || '{}');
            const s = parseFloat(cfg.saldoAcoes || cfg.saldo_corretora || 0);
            return Number.isNaN(s) ? 0 : s;
        } catch (_) { return 0; }
    }

    function getSaldoCryptoConfig() {
        try {
            const cfg = JSON.parse(localStorage.getItem('cryptoConfig') || '{}');
            const s = parseFloat(cfg.saldoCrypto || 0);
            return Number.isNaN(s) ? 0 : s;
        } catch (_) { return 0; }
    }

    function getNumber(op, fields) {
        for (let i = 0; i < fields.length; i++) {
            const v = parseFloat(op[fields[i]]);
            if (!Number.isNaN(v)) {
                // Validação: alertar sobre valores suspeitos em crypto
                if (state.apiEndpoint.includes('/crypto') && fields[0] === 'premio_us') {
                    if (v > 0 && v < 0.5) {
                        console.warn('[modal-analise] ⚠️ Valor suspeito detectado:', {
                            id: op.id,
                            ativo: op.ativo_base || op.ativo,
                            tipo: op.tipo,
                            campo: fields[i],
                            valor: v,
                            premio_us: op.premio_us,
                            resultado: op.resultado,
                            cotacao_atual: op.cotacao_atual,
                            sugestao: 'Verificar se o campo correto está sendo usado'
                        });
                    }
                }
                return v;
            }
        }
        return 0;
    }

    /* ------------------------------------------------------------------ */
    /* Filtro de período                                                    */
    /* ------------------------------------------------------------------ */
    function filterByPeriod(ops, period) {
        // Delegar para CryptoFilterBar.inPeriod se disponível — garante lógica única
        if (window.CryptoFilterBar && typeof window.CryptoFilterBar.filter === 'function') {
            const filterState = {
                period: period,
                dateFrom: state.dateFrom || null,
                dateTo: state.dateTo || null,
                statusList: null,   // sem filtro de status aqui (aplicado depois)
                tipoList: null,
                status: null,
                tipo: null,
                asset: null,
                corretora: null,
            };
            // CryptoFilterBar.filter aplica período + status + tipo.
            // Como queremos só o período, passamos statusList/tipoList nulos
            // e usamos inPeriod diretamente.
            return ops.filter(op => window.CryptoFilterBar.inPeriod(op, period, filterState));
        }

        // Fallback local (caso CryptoFilterBar não esteja carregado)
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        function opDate(op) {
            const raw = op.data_operacao || op.created_at || op.data || null;
            if (!raw) return null;
            let dateStr = raw;
            if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                dateStr = raw + 'T00:00:00';
            }
            const d = new Date(dateStr);
            if (Number.isNaN(d.getTime())) return null;
            d.setHours(0, 0, 0, 0);
            return d;
        }

        if (period === 'all') return ops;

        return ops.filter(op => {
            const d = opDate(op);
            if (!d) return false;

            if (period === 'custom') {
                const dateFrom = state.dateFrom ? new Date(state.dateFrom + 'T00:00:00') : null;
                const dateTo   = state.dateTo   ? new Date(state.dateTo   + 'T23:59:59') : null;
                if (dateFrom && d < dateFrom) return false;
                if (dateTo   && d > dateTo)   return false;
                return true;
            }

            if (period === 'today')  return d >= now;
            if (period === 'semana') {
                const dow = now.getDay();
                const mon = new Date(now);
                mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
                mon.setHours(0, 0, 0, 0);
                return d >= mon;
            }
            if (period === 'mes')  { const t = new Date(now.getFullYear(), now.getMonth(), 1); return d >= t; }
            if (period === 'ano')  { const t = new Date(now.getFullYear(), 0, 1); return d >= t; }
            if (period === '7d')   { const t = new Date(now); t.setDate(t.getDate() - 7);  return d >= t; }
            if (period === '15d')  { const t = new Date(now); t.setDate(t.getDate() - 15); return d >= t; }
            if (period === '30d')  { const t = new Date(now); t.setDate(t.getDate() - 30); return d >= t; }
            if (period === '60d')  { const t = new Date(now); t.setDate(t.getDate() - 60); return d >= t; }
            if (period === '90d')  { const t = new Date(now); t.setDate(t.getDate() - 90); return d >= t; }
            return true;
        });
    }

    /* ------------------------------------------------------------------ */
    /* Cálculo de estatísticas                                              */
    /* ------------------------------------------------------------------ */
    function calcStats(ops) {
        const isCrypto = state.apiEndpoint.includes('/crypto');
        // Para crypto: resultado = P&L em US$; premio_us = prêmio USD (usa como resultado principal)
        const resultField = isCrypto
            ? ['premio_us', 'resultado']
            : ['resultado', 'resultado_total', 'resultado_op', 'resultado_fechamento'];

        const totalResult = ops.reduce((s, op) => s + getNumber(op, resultField), 0);
        const totalOps = ops.length;
        const wins = ops.filter(op => getNumber(op, resultField) > 0).length;
        const winRate = totalOps > 0 ? (wins / totalOps) * 100 : 0;
        const ticketMedio = totalOps > 0 ? totalResult / totalOps : 0;

        // Crypto: ROI = totalResult (US$) / saldoCrypto * 100
        // Opcoes: ROI = totalResult (R$) / saldo_corretora * 100
        let roi;
        if (isCrypto) {
            const saldoCrypto = getSaldoCryptoConfig();
            roi = saldoCrypto > 0 ? (totalResult / saldoCrypto) * 100
                : totalOps > 0 ? (totalResult / totalOps) : 0;
        } else {
            const saldo = getSaldoCorretora();
            roi = saldo > 0 ? (totalResult / saldo) * 100 : 0;
        }

        // Melhor trade
        const bestResult = ops.reduce((best, op) => {
            const r = getNumber(op, resultField);
            return r > best ? r : best;
        }, 0);

        // Pior trade
        const worstResult = ops.reduce((worst, op) => {
            const r = getNumber(op, resultField);
            return r < worst ? r : worst;
        }, 0);

        // Total investido (soma dos tickets / valores das operações)
        const totalInvested = ops.reduce((sum, op) => {
            return sum + getNumber(op, 'ticket') + getNumber(op, 'valor') + getNumber(op, 'investimento');
        }, 0);

        // Tempo médio das operações
        const durations = ops.map(op => {
            const abertura = op.abertura || op.data_abertura || op.openTime;
            const fechamento = op.fechamento || op.data_fechamento || op.closeTime;
            if (!abertura || !fechamento) return 0;
            const diff = (new Date(fechamento) - new Date(abertura)) / (1000 * 60 * 60);
            return diff > 0 ? diff : 0;
        }).filter(d => d > 0);
        const avgDuration = durations.length > 0 ? (durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
        const avgDurationStr = avgDuration >= 24 ? (avgDuration / 24).toFixed(1) + 'd' : avgDuration.toFixed(1) + 'h';

        // Distribuição por tipo (CALL / PUT / outros)
        const tipoMap = {};
        ops.forEach(op => {
            const tipo = (op.tipo || 'OUTRO').toUpperCase();
            tipoMap[tipo] = (tipoMap[tipo] || 0) + getNumber(op, resultField);
        });

        // Distribuição por ativo_base
        const ativoMap = {};
        ops.forEach(op => {
            const ativo = (op.ativo_base || op.ativo || 'DESCONHECIDO').toUpperCase();
            const r = getNumber(op, resultField);
            ativoMap[ativo] = (ativoMap[ativo] || 0) + r;
        });

        // Ordena ativos por resultado desc
        const ativos = Object.entries(ativoMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7);

        return { totalResult, totalOps, wins, winRate, ticketMedio, roi, bestResult, worstResult, totalInvested, avgDuration: avgDurationStr, tipoMap, ativos };
    }

    /* ------------------------------------------------------------------ */
    /* ApexCharts lazy-load                                                 */
    /* ------------------------------------------------------------------ */
    function ensureApex(cb) {
        if (typeof ApexCharts !== 'undefined') { cb(); return; }
        if (state.apexLoading) { setTimeout(() => ensureApex(cb), 200); return; }
        state.apexLoading = true;
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3/dist/apexcharts.min.js';
        s.onload = () => { state.apexLoaded = true; state.apexLoading = false; cb(); };
        s.onerror = () => { state.apexLoading = false; console.error('[modal-analise] Falha ao carregar ApexCharts'); };
        document.head.appendChild(s);
    }

    /* ------------------------------------------------------------------ */
    /* Render donut chart                                                   */
    /* ------------------------------------------------------------------ */
    function renderDonut(stats) {
        const el = document.getElementById('maDonutChart');
        if (!el) return;

        const tipos = Object.entries(stats.tipoMap).sort((a, b) => b[1] - a[1]);
        const labels = tipos.map(([k]) => k);
        const values = tipos.map(([, v]) => Math.abs(v));
        const colors = labels.map(l => l === 'CALL' ? '#2dc653' : l === 'PUT' ? '#4d9de0' : '#f76707');

        const options = {
            chart: {
                type: 'donut',
                height: 220,
                background: 'transparent',
                animations: { enabled: true, speed: 500 },
                toolbar: { show: false }
            },
            series: values.length > 0 ? values : [1],
            labels: values.length > 0 ? labels : ['Sem dados'],
            colors: values.length > 0 ? colors : ['#2b2d3e'],
            plotOptions: {
                pie: {
                    donut: {
                        size: '68%',
                        labels: { show: false }
                    }
                }
            },
            dataLabels: { enabled: false },
            legend: { show: false },
            stroke: { width: 3, colors: ['#161b27'] },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: (v, { seriesIndex }) => {
                        const total = values.reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? ((values[seriesIndex] / total) * 100).toFixed(0) : 0;
                        return `${pct}%`;
                    }
                }
            }
        };

        if (state.chart) {
            try { state.chart.destroy(); } catch (_) { }
            state.chart = null;
        }

        state.chart = new ApexCharts(el, options);
        state.chart.render();
    }

    /* ------------------------------------------------------------------ */
    /* Render tipo list (painel esquerdo)                                   */
    /* ------------------------------------------------------------------ */
    function renderTipoList(stats) {
        const el = document.getElementById('maTipoList');
        if (!el) return;

        const tipos = Object.entries(stats.tipoMap).sort((a, b) => b[1] - a[1]);
        const totalAbs = tipos.reduce((s, [, v]) => s + Math.abs(v), 0);

        if (tipos.length === 0) {
            el.innerHTML = '<div class="text-muted small">Sem dados</div>';
            return;
        }

        el.innerHTML = tipos.map(([tipo, valor]) => {
            const pct = totalAbs > 0 ? (Math.abs(valor) / totalAbs) * 100 : 0;
            const barClass = tipo === 'CALL' ? 'ma-bar-call' : 'ma-bar-put';
            const valClass = valor >= 0 ? 'text-success' : 'text-danger';
            return `
                <div class="ma-tipo-item">
                    <div class="ma-tipo-header">
                        <div class="ma-tipo-name">
                            <span class="ma-tipo-dot ${barClass}"></span>
                            Operações ${tipo}
                        </div>
                        <div class="ma-tipo-value ${valClass}">${fmtAmountShort(valor)}</div>
                    </div>
                    <div class="ma-tipo-bar-wrap">
                        <div class="ma-tipo-bar ${barClass}" style="width:${pct.toFixed(1)}%"></div>
                    </div>
                </div>`;
        }).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Render distribuição por tipo (painel direito)                        */
    /* ------------------------------------------------------------------ */
    function renderDistTipo(stats) {
        const el = document.getElementById('maDistTipo');
        if (!el) return;

        const tipos = Object.entries(stats.tipoMap).sort((a, b) => b[1] - a[1]);
        const totalAbs = tipos.reduce((s, [, v]) => s + Math.abs(v), 0);

        if (tipos.length === 0) {
            el.innerHTML = '<div class="text-muted small">Sem dados</div>';
            return;
        }

        el.innerHTML = tipos.map(([tipo, valor]) => {
            const pct = totalAbs > 0 ? (Math.abs(valor) / totalAbs) * 100 : 0;
            const barClass = tipo === 'CALL' ? 'ma-bar-call' : 'ma-bar-put';
            const dotClass = tipo === 'CALL' ? 'ma-bar-call' : 'ma-bar-put';
            const valClass = valor >= 0 ? 'text-success' : 'text-danger';
            return `
                <div class="ma-dist-item">
                    <div class="ma-dist-name">
                        <span class="ma-dist-name-dot ${dotClass}"></span>
                        ${tipo}
                    </div>
                    <div class="ma-dist-bar-wrap">
                        <div class="ma-dist-bar ${barClass}" style="width:${pct.toFixed(1)}%">
                            <span>${pct.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div class="ma-dist-value ${valClass}">${fmtAmountShort(valor)}</div>
                </div>`;
        }).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Render lista de operações individuais (painel direito)               */
    /* ------------------------------------------------------------------ */
    const OPS_SORT_FIELDS = ['date', 'result', 'pct'];

    function sortOps(ops, sortKey) {
        const isCrypto = state.apiEndpoint.includes('/crypto');
        // ✅ CORRIGIDO: Para crypto, priorizar premio_us (prêmio recebido)
        const resultField = isCrypto
            ? ['premio_us', 'resultado']
            : ['resultado', 'resultado_total', 'resultado_op', 'resultado_fechamento'];
        const saldoField = ['saldo_abertura', 'saldo', 'saldo_entrada', 'saldo_inicial'];

        function opDate(op) {
            const raw = op.data_operacao || op.created_at || op.data || op.vencimento || null;
            if (!raw) return new Date(0);
            const d = new Date(raw);
            return Number.isNaN(d.getTime()) ? new Date(0) : d;
        }

        const arr = ops.slice();
        if (sortKey === 'date') {
            return arr.sort((a, b) => opDate(b) - opDate(a));
        }
        if (sortKey === 'result') {
            return arr.sort((a, b) => getNumber(b, resultField) - getNumber(a, resultField));
        }
        if (sortKey === 'pct') {
            function opPct(op) {
                const r = getNumber(op, resultField);
                const s = getNumber(op, saldoField);
                return s > 0 ? r / s : 0;
            }
            return arr.sort((a, b) => opPct(b) - opPct(a));
        }
        return arr;
    }

    function renderOpsList(ops) {
        const el = document.getElementById('maOpsList');
        if (!el) return;

        const isCrypto = state.apiEndpoint.includes('/crypto');
        // ✅ CORRIGIDO: Para crypto, priorizar premio_us (prêmio recebido)
        const resultField = isCrypto
            ? ['premio_us', 'resultado']
            : ['resultado', 'resultado_total', 'resultado_op', 'resultado_fechamento'];
        const saldoField = ['saldo_abertura', 'saldo', 'saldo_entrada', 'saldo_inicial'];

        const sorted = sortOps(ops, state.opsSort || 'date');

        if (sorted.length === 0) {
            el.innerHTML = '<div class="ma-ops-empty">Sem operações no período</div>';
            return;
        }

        const maxAbs = sorted.reduce((m, op) => Math.max(m, Math.abs(getNumber(op, resultField))), 0);

        el.innerHTML = sorted.map((op) => {
            const resultado = getNumber(op, resultField);
            const saldo = getNumber(op, saldoField);
            const pct = saldo > 0 ? (resultado / saldo) * 100 : null;
            const barWidth = maxAbs > 0 ? (Math.abs(resultado) / maxAbs) * 100 : 0;

            const tipo = (op.tipo || '').toUpperCase();
            const ativoBase = (op.ativo_base || '').toUpperCase();
            const ativo = op.ativo || op.ativo_base || '-';
            const status = (op.status || '').toUpperCase();
            const exercicio = op.exercicio_automatico !== undefined
                ? (op.exercicio_automatico ? 'SIM' : 'NÃO')
                : (op.exercicio || '-');

            /* Vencimento formatado */
            const vencRaw = op.vencimento || op.data_vencimento || null;
            const vencDate = vencRaw ? new Date(vencRaw) : null;
            const vencStr = vencDate && !Number.isNaN(vencDate.getTime())
                ? vencDate.toLocaleDateString('pt-BR')
                : '-';

            /* Duração */
            const duracao = op.duracao !== undefined && op.duracao !== null
                ? `${op.duracao} dia${op.duracao === 1 ? '' : 's'}`
                : '-';

            /* Prêmio */
            const premio = getNumber(op, ['premio_us', 'premio', 'premio_total', 'valor_premio']);

            /* Classes de cor */
            const resClass = resultado >= 0 ? 'text-success' : 'text-danger';
            const barClass = resultado >= 0 ? 'ma-opsbar-pos' : 'ma-opsbar-neg';
            const tipoClass = tipo === 'CALL' ? 'ma-badge-call' : tipo === 'PUT' ? 'ma-badge-put' : 'ma-badge-outro';
            const statClass = status === 'FECHADA' ? 'ma-badge-fechada'
                : status === 'ABERTA' ? 'ma-badge-aberta'
                    : 'ma-badge-outro';
            const exClass = exercicio === 'SIM' ? 'ma-badge-sim' : exercicio === 'NÃO' ? 'ma-badge-nao' : '';

            const pctStr = pct !== null ? `${pct.toFixed(2)}%` : '-';
            const pctClass = pct !== null ? (pct >= 0 ? 'text-success' : 'text-danger') : '';

            return `
<div class="ma-op-item">
    <div class="ma-op-top">
        <div class="ma-op-identity">
            ${ativoBase ? `<span class="ma-op-base-badge">${ativoBase}</span>` : ''}
            <span class="ma-op-nome">${ativo}</span>
            <span class="ma-badge ${tipoClass}">${tipo || '-'}</span>
        </div>
        <div class="ma-op-values">
            <span class="ma-op-result ${resClass}">${fmtAmountShort(resultado)}</span>
            <span class="ma-op-pct ${pctClass}">${pctStr}</span>
        </div>
    </div>
    <div class="ma-op-bar-wrap">
        <div class="ma-op-bar ${barClass}" style="width:${barWidth.toFixed(1)}%"></div>
    </div>
    <div class="ma-op-bottom">
        <span class="ma-op-meta">Prêmio: <strong>${fmtAmountShort(premio)}</strong></span>
        <span class="ma-op-meta">Vcto: <strong>${vencStr}</strong></span>
        <span class="ma-op-meta">${duracao}</span>
        <span class="ma-badge ${statClass}">${status || '-'}</span>
        ${exercicio !== '-' ? `<span class="ma-badge ${exClass}">Exercício: ${exercicio}</span>` : ''}
    </div>
</div>`;
        }).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Setup botões de ordenação das operações                             */
    /* ------------------------------------------------------------------ */
    function setupOpsSortButtons() {
        const container = document.getElementById('maOpsSort');
        if (!container || container.dataset.bound === 'true') return;
        container.dataset.bound = 'true';
        container.addEventListener('click', event => {
            const btn = event.target.closest('button[data-sort]');
            if (!btn) return;
            const sort = btn.dataset.sort;
            if (!sort || state.opsSort === sort) return;
            state.opsSort = sort;
            container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filtered = filterByPeriod(state.ops, state.period);
            renderOpsList(filtered);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Render completo                                                       */
    /* ------------------------------------------------------------------ */
    function renderAll(ops) {
        // Se ops não for passado, usar state.ops e aplicar filtro de período
        const opsToRender = ops || filterByPeriod(state.ops, state.period);
        const stats = calcStats(opsToRender);

        /* Donut */
        ensureApex(() => renderDonut(stats));

        /* Centro donut */
        setEl('maDonutValue', fmtAmountShort(stats.totalResult));
        setEl('maDonutSub', `${stats.totalOps} operaç${stats.totalOps === 1 ? 'ão' : 'ões'}`);

        /* Tipo lists */
        renderTipoList(stats);
        renderDistTipo(stats);

        /* Operações individuais */
        setupOpsSortButtons();
        renderOpsList(opsToRender);

        /* Métricas esquerda */
        setEl('maWinRate', stats.winRate.toFixed(0) + '%');
        setEl('maTicketMedio', fmtAmount(stats.ticketMedio));

        /* ROI */
        const roiStr = fmtPct(stats.roi);
        setEl('maRoiValue', roiStr);
        const roiBox = document.querySelector('.ma-roi-box');
        if (roiBox) {
            roiBox.style.borderColor = stats.roi >= 0 ? '#2dc653' : '#fa5252';
        }
        const roiEl = document.getElementById('maRoiValue');
        if (roiEl) roiEl.style.color = stats.roi >= 0 ? '#2dc653' : '#fa5252';

        /* Painel direito header */
        setEl('maRightResult', fmtAmount(stats.totalResult));
        setEl('maRightSub', `Lucro Total | ${stats.totalOps} Operaç${stats.totalOps === 1 ? 'ão' : 'ões'} | ${stats.winRate.toFixed(0)}% Win Rate`);

        /* Stats bar abaixo da lista */
        setEl('maStatMelhor', fmtAmountShort(stats.bestResult));
        setEl('maStatPior', fmtAmountShort(stats.worstResult));
        setEl('maStatTicket', fmtAmountShort(stats.ticketMedio));
        setEl('maStatRoi', roiStr);

        /* Deep sections (Dashboard Cards, Chart, Parecer) */
        renderDeep(stats, opsToRender);
    }

    function setEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    /* ------------------------------------------------------------------ */
    /* Carregar dados da API                                                 */
    /* ------------------------------------------------------------------ */
    async function loadData() {
        try {
            const res = await fetch(state.apiEndpoint);
            if (!res.ok) throw new Error('API error ' + res.status);
            const data = await res.json();
            state.ops = Array.isArray(data) ? data : (data.operacoes || data.data || []);
        } catch (err) {
            console.error('[modal-analise] Erro ao carregar dados:', err);
            state.ops = [];
        }
    }

    /* ------------------------------------------------------------------ */
    /* Atualizar timestamp                                                  */
    /* ------------------------------------------------------------------ */
    function updateTimestamp() {
        // O timestamp agora é gerenciado pelo CryptoModalHeader
        // Chamamos o método tick() do header
        if (state.header && typeof state.header.tick === 'function') {
            state.header.tick();
        }
    }

    /* ------------------------------------------------------------------ */
    /* Refresh completo (carrega + renderiza)                               */
    /* ------------------------------------------------------------------ */
    const _LOADING_SPIN = '<span class="spinner-border spinner-border-sm text-secondary" role="status"></span>';
    function setMetricsLoading() {
        // Métricas principais (centro do donut)
        ['maDonutValue', 'maDonutSub'].forEach(function(id) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = _LOADING_SPIN;
        });
        
        // Métricas da esquerda
        ['maWinRate', 'maTicketMedio', 'maRoiValue'].forEach(function(id) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = _LOADING_SPIN;
        });
        
        // Painel direito header
        ['maRightResult', 'maRightSub'].forEach(function(id) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = _LOADING_SPIN;
        });
        
// Stats bar abaixo da lista
        ['maStatMelhor', 'maStatPior', 'maStatTicket', 'maStatRoi'].forEach(function(id) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = _LOADING_SPIN;
        });
        
        // Lista de operações
        const opsList = document.getElementById('maOpsList');
        if (opsList) {
            opsList.innerHTML = '<div class="text-center py-4">' + _LOADING_SPIN + '</div>';
        }
        
        // Listas de tipo (esquerda e direita)
        const tipoList = document.getElementById('maTipoList');
        if (tipoList) {
            tipoList.innerHTML = '<div class="text-center py-2">' + _LOADING_SPIN + '</div>';
        }
        
        const distTipo = document.getElementById('maDistTipo');
        if (distTipo) {
            distTipo.innerHTML = '<div class="text-center py-2">' + _LOADING_SPIN + '</div>';
        }
        
        // Badges de totalização (se existirem)
        const totalsContainer = document.querySelector('.cfb-totals');
        if (totalsContainer) {
            const badges = totalsContainer.querySelectorAll('.cfb-tag');
            badges.forEach(function(badge) {
                const originalClass = badge.className;
                badge.innerHTML = _LOADING_SPIN;
                badge.className = originalClass; // Preserva as classes de estilo
            });
        }
    }

    /* ------------------------------------------------------------------ */
    async function refresh() {
        const btn = document.querySelector('.cfb-refresh-btn');
        if (btn) btn.classList.add('spinning');
        
        if (['posicoes', 'evolucao', 'risco'].includes(state.activeTab)) {
            await refreshPosicoesCompleto();
            if (state.activeTab === 'evolucao') ensureApex(() => renderEvolucaoPane());
            else if (state.activeTab === 'risco') ensureApex(() => renderRiscoPane());
        } else {
            setMetricsLoading();
            await loadData();
            const filtered = filterByPeriod(state.ops, state.period);
            renderAll(filtered);
        }
        
        updateTimestamp();
        if (btn) btn.classList.remove('spinning');
        
        // ✅ IMPORTANTE: Atualizar header com operações para exibir badges
        if (state.header) {
            const filtered = filterByPeriod(state.ops, state.period);
            state.header.setOps(state.ops, filtered);
            state.header.tick();
        }
    }

    /* ------------------------------------------------------------------ */
    /* Carregar HTML do modal se ainda não carregado                        */
    /* ------------------------------------------------------------------ */
    let _loadPromise = null;

    async function ensureModalLoaded() {
        if (document.getElementById(state.modalId)) return true;
        const container = document.querySelector(state.containerSelector);
        if (!container) return false;
        // Se já há uma carga em andamento, aguarda a mesma promise (evita duplo-fetch)
        if (_loadPromise) return _loadPromise;
        _loadPromise = (async () => {
            try {
                const res = await fetch('../components/modals/opcoes/modal-analise.html');
                const html = await res.text();
                container.innerHTML = html;
                return true;
            } catch (err) {
                console.error('[modal-analise] Falha ao carregar HTML:', err);
                return false;
            } finally {
                _loadPromise = null;
            }
        })();
        return _loadPromise;
    }

    /* ------------------------------------------------------------------ */
    /* Abrir modal                                                           */
    /* ------------------------------------------------------------------ */
    async function openModal() {
        const loaded = await ensureModalLoaded();
        if (!loaded) {
            console.error('[modal-analise] ensureModalLoaded() retornou false — container:', state.containerSelector, '| modalId:', state.modalId);
            return;
        }

        const modalEl = document.getElementById(state.modalId);
        if (!modalEl) {
            console.error('[modal-analise] Elemento modal não encontrado no DOM: #' + state.modalId);
            return;
        }

        /* Resetar para aba Desempenho e forçar loadData ao reabrir */
        state.activeTab = 'desempenho';
        const tabNav = document.getElementById('maTabNav');
        if (tabNav) {
            tabNav.querySelectorAll('.ma-tab-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === 'desempenho');
            });
            const body = tabNav.closest('.ma-body');
            if (body) {
                body.querySelectorAll('.ma-tab-pane').forEach(p => {
                    p.classList.toggle('d-none', p.id !== 'maTabPane-desempenho');
                });
            }
        }

        /* Inicializar CryptoModalHeader se disponível */
        if (typeof CryptoModalHeader !== 'undefined') {
            // ✅ IMPORTANTE: Só inicializar header uma vez
            if (state.headerInitialized && state.header) {
                // Header já inicializado, apenas atualizar dados
            } else {
                // Destruir header anterior se existir
                if (state.header && typeof state.header.destroy === 'function') {
                    state.header.destroy();
                    state.header = null;
                }
                
                // Limpar conteúdo anterior se existir
                const headerEl = document.getElementById('maModalHeader');
                if (headerEl && headerEl.innerHTML.trim()) {
                    headerEl.innerHTML = '';
                }
                
                const isCrypto = state.apiEndpoint.includes('/crypto');
                // ✅ SINCRONIZAR: definir state.period antes do mount para que o
                // primeiro refresh() já use o período correto (sem esperar clique do usuário)
                const _defaultPeriod = 'mes';
                state.period = _defaultPeriod;

                state.header = CryptoModalHeader.mount('#maModalHeader', {
                title: isCrypto ? 'Análise de Performance · Crypto' : 'Análise de Performance · Opções',
                icon: '⚡',
                defaultPeriod: _defaultPeriod,
                closeModalId: state.modalId,
                onFilter: (filterState) => {
                    // Período do header é o mesmo usado em filterByPeriod —
                    // não há mapeamento: ambos usam os mesmos tokens ('mes', 'semana', 'today', etc.)
                    state.period = filterState.period;
                    
                    // ✅ CORRIGIDO: Capturar dateFrom e dateTo para período customizado
                    if (filterState.period === 'custom') {
                        state.dateFrom = filterState.dateFrom || null;
                        state.dateTo = filterState.dateTo || null;
                    }
                    
                    // Aplicar filtros e re-renderizar
                    let filtered = filterByPeriod(state.ops, state.period);
                    
                    // ✅ CORRIGIDO: Aplicar filtros de status usando statusList (array)
                    if (Array.isArray(filterState.statusList) && filterState.statusList.length > 0) {
                        filtered = filtered.filter(op => {
                            const status = (op.status || '').toLowerCase();
                            return filterState.statusList.some(s => s.toLowerCase() === status);
                        });
                    }
                    
                    // ✅ CORRIGIDO: Aplicar filtros de tipo usando tipoList (array)
                    if (Array.isArray(filterState.tipoList) && filterState.tipoList.length > 0) {
                        filtered = filtered.filter(op => {
                            const tipo = (op.tipo || '').toUpperCase();
                            return filterState.tipoList.some(t => t.toUpperCase() === tipo);
                        });
                    }
                    
                    if (filterState.asset) {
                        filtered = filtered.filter(op => 
                            (op.ativo_base || op.ativo || '').toUpperCase().includes(filterState.asset.toUpperCase())
                        );
                    }
                    
                    renderAll(filtered);
                    
                    // Atualizar header com operações filtradas para atualizar badges
                    if (state.header) {
                        state.header.setOps(state.ops, filtered);
                        state.header.tick();
                    }
                },
                onRefresh: async () => {
                    await refresh();
                },
                showTotals: true  // ✅ IMPORTANTE: Habilitar badges de totalização
            });
            
            state.headerInitialized = true;  // ✅ Marcar como inicializado
            }
        } else {
            console.warn('[modal-analise] CryptoModalHeader não disponível! Verifique se o script foi carregado.');
        }

        setupTabs();

        try {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        } catch (err) {
            console.error('[modal-analise] Erro ao chamar modal.show():', err);
            return;
        }

        // Carregar dados e atualizar header
        await refresh();
        
        // ✅ GARANTIR que os badges sejam exibidos após carregar os dados
        if (state.header) {
            const filtered = filterByPeriod(state.ops, state.period);
            state.header.setOps(state.ops, filtered);
            state.header.tick();
        }
    }

    /* ------------------------------------------------------------------ */
    /* ------------------------------------------------------------------ */
    /* Tab Navigation interna de cada card de posição (lazy charts)        */
    /* ------------------------------------------------------------------ */
    /* ------------------------------------------------------------------ */
    /* Tab Navigation                                                      */
    /* ------------------------------------------------------------------ */
    function setupTabs() {
        const nav = document.getElementById('maTabNav');
        if (!nav || nav.dataset.bound === 'true') return;
        nav.dataset.bound = 'true';
        nav.addEventListener('click', event => {
            const btn = event.target.closest('[data-tab]');
            if (!btn) return;
            const tab = btn.dataset.tab;
            if (tab === state.activeTab) return;
            state.activeTab = tab;
            nav.querySelectorAll('.ma-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const body = nav.closest('.ma-body');
            if (body) body.querySelectorAll('.ma-tab-pane').forEach(p => p.classList.add('d-none'));
            const pane = document.getElementById('maTabPane-' + tab);
            if (pane) pane.classList.remove('d-none');
            
            // ✅ IMPORTANTE: Manter filtros visíveis em TODAS as abas
            // (removido o código que escondia os filtros)
            
            const isPosicoesTab = ['posicoes', 'evolucao', 'risco'].includes(tab);
            if (isPosicoesTab && state.posicoes.length === 0 && !state.posRefreshing) {
                refreshPosicoesCompleto().then(() => {
                    if (tab === 'evolucao') ensureApex(() => renderEvolucaoPane());
                    else if (tab === 'risco') ensureApex(() => renderRiscoPane());
                });
            } else if (tab === 'evolucao') {
                ensureApex(() => renderEvolucaoPane());
            } else if (tab === 'risco') {
                ensureApex(() => renderRiscoPane());
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Carregar posições abertas da API                                     */
    /* ------------------------------------------------------------------ */
    async function loadPosicoesAbertas() {
        try {
            const res = await fetch(state.apiEndpoint);
            if (!res.ok) throw new Error('API error ' + res.status);
            const data = await res.json();
            const all = Array.isArray(data) ? data : (data.operacoes || data.data || []);
            const filtered = all.filter(op => (op.status || '').toUpperCase() === 'ABERTA');
            // Normalização: mapeia campos crypto para o padrão do modal (campos de opções)
            state.posicoes = filtered.map(op => {
                if (op.exercicio !== undefined && op.vencimento === undefined) {
                    return {
                        ...op,
                        vencimento: op.exercicio,
                        // CRYPTO: cotacao_atual = spot price do ativo (BTC/...), NÃO é o preço da opção.
                        // Não mapear para preco_atual (usado como fallback de option price).
                        preco_atual: null,
                        // Preço do ativo base na abertura (BTC price quando entrou na operação)
                        preco_ativo_base: op.abertura ?? op.preco_ativo_base,
                        preco_entrada: op.preco_entrada,
                        premio: op.premio_us ?? op.premio,
                        // Para crypto: quantidade = 1 (prêmio já representa o valor total em USD)
                        quantidade: 1,
                        ativo_base: op.ativo_base || op.ativo,
                        // Preserva o spot atual para exibição informativa
                        cotacao_spot_atual: op.cotacao_atual,
                    };
                }
                return op;
            });
            const badge = document.getElementById('maPosBadge');
            if (badge) badge.textContent = state.posicoes.length > 0 ? String(state.posicoes.length) : '';
        } catch (err) {
            console.error('[modal-analise] Erro ao carregar posições:', err);
            state.posicoes = [];
        }
    }

    /* ------------------------------------------------------------------ */
    /* Renderizar grid de cards (agrupado por ativo em accordion)          */
    /* ------------------------------------------------------------------ */
    function renderPosicoesGrid() {
        const container = document.getElementById('maPosCards');
        const loadingEl = document.getElementById('maPosLoading');
        const emptyEl = document.getElementById('maPosEmpty');
        const summaryEl = document.getElementById('maPosSummary');
        if (loadingEl) loadingEl.style.display = 'none';
        if (state.posicoes.length === 0) {
            if (emptyEl) emptyEl.style.display = '';
            if (container) container.style.display = 'none';
            if (summaryEl) summaryEl.style.display = 'none';
            return;
        }
        if (container) {
            // Um accordion por posição individual
            const accItems = state.posicoes.map((op, index) => {
                const id = op.id;
                const ativo = (op.ativo_base || op.ativo || 'OUTRO').substring(0, 6).toUpperCase();
                const tipo = (op.tipo || 'CALL').toUpperCase();
                const tipoColor = tipo === 'PUT' ? '#f59f00' : '#2dc653';
                const strike = parseFloat(op.strike || 0);
                const premioUs = Math.abs(parseFloat(op.premio_us || op.premio || 0));
                const vctoRaw = op.vencimento || op.exercicio || null;
                const vctoDate = vctoRaw ? new Date(vctoRaw) : null;
                const vctoStr = vctoDate && !isNaN(vctoDate)
                    ? vctoDate.toLocaleDateString('pt-BR') : '—';
                const safeId = `pos${id}`;
                                const isOpen = index === 0;
                return `<div class="accordion-item border-0 mb-2">
  <h2 class="accordion-header" id="maPosH-${safeId}">
        <button class="accordion-button${isOpen ? '' : ' collapsed'} rounded" type="button"
            data-bs-toggle="collapse" data-bs-target="#maPosPan-${safeId}"
                        aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="maPosPan-${safeId}"
            style="background:rgba(66,153,225,0.08)">
      <span class="badge me-2" style="background:#4299e122;color:#4299e1;border:1px solid #4299e144">${ativo}</span>
      <span class="badge me-2" style="background:${tipoColor}22;color:${tipoColor};border:1px solid ${tipoColor}44">${tipo}</span>
      <span class="me-2 text-muted small">K: US$&nbsp;${strike.toFixed(2)}</span>
      <span class="me-2 text-muted small">·&nbsp;Vcto ${vctoStr}</span>
      <span class="ms-auto me-2 fw-bold" style="color:#2dc653">US$&nbsp;${premioUs.toFixed(2)}</span>
    </button>
  </h2>
    <div id="maPosPan-${safeId}" class="accordion-collapse collapse${isOpen ? ' show' : ''}" aria-labelledby="maPosH-${safeId}">
    <div class="accordion-body p-0 pt-3">
      ${buildPosCard(op)}
    </div>
  </div>
</div>`;
            }).join('');

            container.innerHTML = `<div class="accordion" id="maPosicoesAcc">${accItems}</div>`;
            container.style.display = '';
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (summaryEl) summaryEl.removeAttribute('style');
    }

    /* ------------------------------------------------------------------ */
    /* Construir HTML de um card (dados estáticos de abertura)              */
    /* ------------------------------------------------------------------ */
    function buildPosCard(op) {
        const id = op.id;
        const tipo = (op.tipo || 'CALL').toUpperCase();
        const ativoBase = (op.ativo_base || op.ativo || '').substring(0, 5).toUpperCase();
        const ativo = op.ativo || ativoBase;
        const strike = parseFloat(op.strike || 0);
        const premioAb = Math.abs(parseFloat(op.premio || op.preco_entrada || 0));
        const precoAb = parseFloat(op.preco_ativo_base || 0);
        const qtdAbs = Math.abs(parseFloat(op.quantidade || 1) || 1);
        const premioTotalAb = premioAb * qtdAbs;
        const breakeven = tipo === 'PUT' ? strike - premioAb : strike + premioAb;
        const vctoDate = op.vencimento ? (() => { const d = new Date(op.vencimento); d.setHours(0, 0, 0, 0); return d; })() : null;
        const vctoStr = vctoDate && !isNaN(vctoDate) ? vctoDate.toLocaleDateString('pt-BR') : '—';
        // Dias restantes calculados estaticamente (hoje → vencimento), sem depender de refresh
        const _hojeCard = new Date(); _hojeCard.setHours(0, 0, 0, 0);
        const diasRestantesStatic = vctoDate && !isNaN(vctoDate) ? Math.max(0, Math.round((vctoDate.getTime() - _hojeCard.getTime()) / 86400000)) : null;
        let diasAbertos = 0, percTempo = 0;
        if (op.data_operacao) {
            const dAb = new Date(op.data_operacao);
            if (!isNaN(dAb)) {
                diasAbertos = Math.max(0, Math.round((new Date() - dAb) / 86400000));
                if (vctoDate && !isNaN(vctoDate)) {
                    const total = Math.max(1, Math.round((vctoDate - dAb) / 86400000));
                    percTempo = Math.min(100, Math.round(diasAbertos / total * 100));
                }
            }
        }
        const tipoColor = tipo === 'PUT' ? '#f59f00' : '#2dc653';
        const sp = '<span class="ma-spin-cell"></span>';
        return `
<div class="ma-poscard" id="maposcard-${id}">
  <div class="ma-poscard-header">
    <div class="ma-poscard-identity">
      <span class="ma-pos-base-badge">${ativoBase}</span>
      <span class="ma-poscard-nome">${ativo}</span>
      <span class="ma-poscard-tipo-badge" style="background:${tipoColor}22;color:${tipoColor};border:1px solid ${tipoColor}44">${tipo}</span>
      <span class="ma-poscard-meta">K: ${fmtCurrency(strike)}</span>
      <span class="ma-poscard-meta">Vcto: ${vctoStr}</span>
      <span class="ma-poscard-meta">${qtdAbs} contratos</span>
    </div>
    <div class="d-flex gap-2 align-items-center flex-shrink-0">
      <span class="ma-poscard-badge" id="mapos-${id}-itmotm">${sp}</span>
      <span class="ma-poscard-decisao-badge" id="mapos-${id}-decisao">${sp}</span>
    </div>
  </div>
  <div class="ma-pos-kpi-row">
    <div class="ma-pos-kpi">
      <div class="ma-kpi-lbl">LUCRO ABERTO</div>
      <div class="ma-kpi-val" id="mapos-${id}-lucroaberto">${sp}</div>
      <div class="ma-kpi-sub">P&amp;L MTM atual</div>
    </div>
    <div class="ma-pos-kpi">
      <div class="ma-kpi-lbl">PROBABILIDADE</div>
      <div class="ma-kpi-val" id="mapos-${id}-pop2">${sp}</div>
      <div class="ma-kpi-sub" id="mapos-${id}-popstatus">—</div>
    </div>
    <div class="ma-pos-kpi">
      <div class="ma-kpi-lbl">COTAÇÃO ATUAL</div>
      <div class="ma-kpi-val" id="mapos-${id}-spot2">${sp}</div>
      <div class="ma-kpi-sub" id="mapos-${id}-varspot">${sp}</div>
    </div>
    <div class="ma-pos-kpi">
      <div class="ma-kpi-lbl">DIST. STRIKE</div>
      <div class="ma-kpi-val" id="mapos-${id}-dist2">${sp}</div>
      <div class="ma-kpi-sub" id="mapos-${id}-distsub">${sp}</div>
    </div>
  </div>
  <div class="ma-poscard-tab-pane" id="maptab-${id}-visao">
  <div class="ma-pos-mid-row">
    <div class="ma-pos-comparativo-wrap">
      <div class="ma-pos-section-title">COMPARATIVO: ABERTURA VS ATUAL</div>
      <table class="ma-comp-table">
        <thead><tr><th>MÉTRICA</th><th>ABERTURA</th><th>ATUAL</th><th>Δ</th></tr></thead>
        <tbody>
          <tr>
            <td>Prêmio</td>
            <td class="text-muted">${premioAb.toFixed(2)}</td>
            <td id="mapos-${id}-cpopt">${sp}</td>
            <td id="mapos-${id}-cpopdelta">${sp}</td>
          </tr>
          <tr>
            <td>Ativo</td>
            <td class="text-muted">${precoAb > 0 ? precoAb.toFixed(2) : '—'}</td>
            <td id="mapos-${id}-cspot">${sp}</td>
            <td id="mapos-${id}-cspotdelta">${sp}</td>
          </tr>
          <tr>
            <td>Ganho Decay</td>
            <td class="text-muted">${fmtCurrency(premioTotalAb)}</td>
            <td id="mapos-${id}-gdecay">${sp}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="ma-pos-payoff-wrap">
      <div class="ma-pos-section-title">📈 DIAGRAMA DE PAYOFF</div>
      <div id="mapos-${id}-payoff" style="min-height:160px"></div>
      <div class="ma-payoff-stats">
        <span class="ma-payoff-stat text-success">Máx: <strong>${fmtCurrency(premioTotalAb)}</strong></span>
        <span class="ma-payoff-stat">BE: <strong>${fmtCurrency(breakeven)}</strong></span>
        <span class="ma-payoff-stat" id="mapos-${id}-distatual2">${sp}</span>
      </div>
    </div>
  </div>
  <div class="ma-pos-prob-section">
    <div class="ma-pos-prob-header">
      <span class="ma-pos-section-title">PROBABILIDADE DE LUCRO TOTAL</span>
      <span class="ma-pos-prob-val" id="mapos-${id}-pop3">${sp}</span>
    </div>
    <div class="progress ma-pos-prob-bar"><div class="progress-bar" id="mapos-${id}-popbar" style="width:0%;transition:width 0.7s"></div></div>
    <div class="ma-pos-prob-labels">
      <span>0%</span>
      <span>Break: ${fmtCurrency(breakeven)}</span>
      <span>Strike: ${fmtCurrency(strike)}</span>
      <span>100%</span>
    </div>
  </div>
  <div class="ma-pos-bottom3">
    <div class="ma-pos-bottom-card">
      <div class="ma-pos-section-title">📊 COMPARATIVO</div>
      <div class="ma-kv-list">
        <div class="ma-kv-row"><span>Prêmio Abertura</span><span>${fmtCurrency(premioAb)}</span></div>
        <div class="ma-kv-row"><span>Prêmio Atual</span><span class="text-info" id="mapos-${id}-premopt">${sp}</span></div>
        <div class="ma-kv-row"><span>Ação Abertura</span><span class="text-muted">${precoAb > 0 ? fmtCurrency(precoAb) : '—'}</span></div>
        <div class="ma-kv-row"><span>Ação Atual</span><span id="mapos-${id}-acaopt">${sp}</span></div>
        <div class="ma-kv-row"><span>Ganho c/ Decay</span><span class="text-success" id="mapos-${id}-gdecay2">${sp}</span></div>
        <div class="ma-kv-row"><span>Ganho c/ Ação</span><span id="mapos-${id}-gacao">${sp}</span></div>
      </div>
    </div>
    <div class="ma-pos-bottom-card">
      <div class="ma-pos-section-title">🎯 PROJEÇÃO</div>
      <div class="ma-kv-list">
        <div class="ma-kv-row"><span>Prêmio Restante</span><span class="text-info" id="mapos-${id}-premrest">${sp}</span></div>
        <div class="ma-kv-row"><span>Prêmio a Perder</span><span class="text-warning" id="mapos-${id}-premperder">${sp}</span></div>
        <div class="ma-kv-row"><span>Potencial Total</span><span class="text-success">${fmtCurrency(premioTotalAb)}</span></div>
        <div class="ma-kv-row"><span>Lucro Máximo</span><span class="text-success">${fmtCurrency(premioTotalAb)}</span></div>
      </div>
    </div>
    <div class="ma-pos-bottom-card">
      <div class="ma-pos-section-title">📋 POSIÇÃO ATUAL</div>
      <div class="ma-pos-kpi-grid">
        <div class="ma-pos-kpi-sm">
          <div class="ma-kpi-sm-val" id="mapos-${id}-lucroreal">${sp}</div>
          <div class="ma-kpi-sm-lbl">Lucro Aberto</div>
        </div>
        <div class="ma-pos-kpi-sm">
          <div class="ma-kpi-sm-val text-info" id="mapos-${id}-premopt2">${sp}</div>
          <div class="ma-kpi-sm-lbl">Prêmio Atual</div>
        </div>
        <div class="ma-pos-kpi-sm">
          <div class="ma-kpi-sm-val" id="mapos-${id}-margem">${sp}</div>
          <div class="ma-kpi-sm-lbl">Margem (Dist.)</div>
        </div>
        <div class="ma-pos-kpi-sm">
          <div class="ma-kpi-sm-val" id="mapos-${id}-roi">${sp}</div>
          <div class="ma-kpi-sm-lbl">ROI Atual</div>
        </div>
      </div>
    </div>
  </div>
  <div class="ma-poscard-bars">
    <div class="ma-poscard-bar-row">
      <span class="ma-poscard-bar-lbl">⏳ Decay capturado</span>
      <div class="progress ma-poscard-progress"><div class="progress-bar bg-success" id="mapos-${id}-decaybar" style="width:0%;transition:width 0.6s"></div></div>
      <span class="ma-poscard-bar-val" id="mapos-${id}-decaypct">${sp}</span>
    </div>
    <div class="ma-poscard-bar-row">
      <span class="ma-poscard-bar-lbl">📅 Tempo corrido</span>
      <div class="progress ma-poscard-progress"><div class="progress-bar bg-info" id="mapos-${id}-tempobar" style="width:${percTempo}%;transition:width 0.6s"></div></div>
      <span class="ma-poscard-bar-val text-info">${percTempo}%</span>
    </div>
  </div>
  <div class="ma-poscard-indicators">
    <div class="ma-poscard-ind"><div class="ma-poscard-ind-lbl">PoP</div><div class="ma-poscard-ind-val" id="mapos-${id}-pop">${sp}</div></div>
    <div class="ma-poscard-ind"><div class="ma-poscard-ind-lbl">θ/dia</div><div class="ma-poscard-ind-val" id="mapos-${id}-theta">${sp}</div></div>
    <div class="ma-poscard-ind"><div class="ma-poscard-ind-lbl">Break-even</div><div class="ma-poscard-ind-val text-muted">${fmtCurrency(breakeven)}</div></div>
    <div class="ma-poscard-ind"><div class="ma-poscard-ind-lbl">Dias Aberta</div><div class="ma-poscard-ind-val text-muted">${diasAbertos}d</div></div>
    <div class="ma-poscard-ind"><div class="ma-poscard-ind-lbl">Dias Restantes</div><div class="ma-poscard-ind-val" id="mapos-${id}-diasrest">${diasRestantesStatic !== null ? diasRestantesStatic + 'd' : '—'}</div></div>
  </div>
</div>`;
    }

    /* ------------------------------------------------------------------ */
    /* Construir HTML de seção de evolução para uma posição                 */
    /* ------------------------------------------------------------------ */
    function buildEvoSection(op) {
        const id = op.id;
        const tipo = (op.tipo || 'CALL').toUpperCase();
        const ativoBase = (op.ativo_base || op.ativo || '').substring(0, 5).toUpperCase();
        const strike = parseFloat(op.strike || 0);
        const premioAb = Math.abs(parseFloat(op.premio || op.preco_entrada || 0));
        const qtdAbs = Math.abs(parseFloat(op.quantidade || 1) || 1);
        const premioTotalAb = premioAb * qtdAbs;
        const vctoDate = op.vencimento ? new Date(op.vencimento) : null;
        const vctoStr = vctoDate && !isNaN(vctoDate) ? vctoDate.toLocaleDateString('pt-BR') : '—';
        const tipoColor = tipo === 'PUT' ? '#f59f00' : '#2dc653';
        const sp = '<span class="ma-spin-cell"></span>';
        return `
<div class="ma-pos-section-wrap" id="maposevo-${id}">
  <div class="ma-pos-section-hdr">
    <span class="ma-poscard-tipo-badge" style="background:${tipoColor}22;color:${tipoColor};border:1px solid ${tipoColor}44">${tipo}</span>
    <strong>${ativoBase}</strong>
    <span class="text-muted small">Strike ${fmtCurrency(strike)} &middot; Vcto ${vctoStr}</span>
  </div>
  <div class="ma-pos-evo-grid">
    <div class="ma-pos-evo-chart-wrap">
      <div class="ma-pos-section-title">&#128200; EVOLU&#199;&#195;O DO PR&#202;MIO</div>
      <div id="mapos-${id}-evochart" style="min-height:200px"></div>
    </div>
    <div class="ma-pos-evo-chart-wrap">
      <div class="ma-pos-section-title">&#127919; ATIVO BASE VS STRIKE</div>
      <div id="mapos-${id}-strikechart" style="min-height:200px"></div>
    </div>
  </div>
  <div class="ma-pos-milestones">
    <div class="ma-milestone ma-milestone-ab">
      <div class="ma-milestone-lbl">&#128205; ABERTURA</div>
      <div class="ma-milestone-val text-success">${fmtCurrency(premioAb)}</div>
      <div class="ma-milestone-sub">Pr\u00eamio na venda</div>
      <div class="ma-milestone-info text-success">&#10003; Recebeu ${fmtCurrency(premioTotalAb)}</div>
    </div>
    <div class="ma-milestone ma-milestone-hoje">
      <div class="ma-milestone-lbl">&#128308; HOJE</div>
      <div class="ma-milestone-val" id="mapos-${id}-evoopt">${sp}</div>
      <div class="ma-milestone-sub">Pr\u00eamio atual</div>
      <div class="ma-milestone-info" id="mapos-${id}-evorecomp">${sp}</div>
    </div>
    <div class="ma-milestone ma-milestone-vcto">
      <div class="ma-milestone-lbl">&#127919; VENCIMENTO (${vctoStr})</div>
      <div class="ma-milestone-val text-success">R$ 0,00</div>
      <div class="ma-milestone-sub">Proje\u00e7\u00e3o ideal</div>
      <div class="ma-milestone-info text-success">&#10003; Lucro total ${fmtCurrency(premioTotalAb)}</div>
    </div>
  </div>
</div>`;
    }

    /* ------------------------------------------------------------------ */
    /* Construir HTML de seção de risco para uma posição                    */
    /* ------------------------------------------------------------------ */
    function buildRiscoSection(op) {
        const id = op.id;
        const tipo = (op.tipo || 'CALL').toUpperCase();
        const ativoBase = (op.ativo_base || op.ativo || '').substring(0, 5).toUpperCase();
        const strike = parseFloat(op.strike || 0);
        const premioAb = Math.abs(parseFloat(op.premio || op.preco_entrada || 0));
        const qtdAbs = Math.abs(parseFloat(op.quantidade || 1) || 1);
        const premioTotalAb = premioAb * qtdAbs;
        const vctoDate = op.vencimento ? new Date(op.vencimento) : null;
        const vctoStr = vctoDate && !isNaN(vctoDate) ? vctoDate.toLocaleDateString('pt-BR') : '—';
        const tipoColor = tipo === 'PUT' ? '#f59f00' : '#2dc653';
        const sp = '<span class="ma-spin-cell"></span>';
        return `
                <div class="ma-pos-section-wrap" id="maposrisco-${id}">
                <div class="ma-pos-section-hdr">
                    <span class="ma-poscard-tipo-badge" style="background:${tipoColor}22;color:${tipoColor};border:1px solid ${tipoColor}44">${tipo}</span>
                    <strong>${ativoBase}</strong>
                    <span class="text-muted small">Strike ${fmtCurrency(strike)} &middot; Vcto ${vctoStr}</span>
                </div>
                <div class="ma-pos-gauges">
                    <div class="ma-gauge-wrap">
                    <div class="ma-pos-section-title">&#128202; VARIA&#199;&#195;O DO PR&#202;MIO</div>
                    <div id="mapos-${id}-gauge-var" style="min-height:160px"></div>
                    <div class="ma-gauge-footer">
                        <span class="ma-gauge-val" id="mapos-${id}-gaugelbl-var">${sp}</span>
                        <span class="ma-gauge-sub">Desde a abertura</span>
                    </div>
                    </div>
                    <div class="ma-gauge-wrap">
                    <div class="ma-pos-section-title">&#127919; DIST&#194;NCIA DO STRIKE</div>
                    <div id="mapos-${id}-gauge-dist" style="min-height:160px"></div>
                    <div class="ma-gauge-footer">
                        <span class="ma-gauge-val" id="mapos-${id}-gaugelbl-dist">${sp}</span>
                        <span class="ma-gauge-sub" id="mapos-${id}-gaugesub-dist">${sp}</span>
                    </div>
                    </div>
                    <div class="ma-gauge-wrap">
                    <div class="ma-pos-section-title">&#9200;&#65039; TEMPO RESTANTE</div>
                    <div id="mapos-${id}-gauge-tempo" style="min-height:160px"></div>
                    <div class="ma-gauge-footer">
                        <span class="ma-gauge-val" id="mapos-${id}-gaugelbl-tempo">${sp}</span>
                        <span class="ma-gauge-sub">At\u00e9 ${vctoStr}</span>
                    </div>
                    </div>
                </div>
                <div class="ma-pos-risk-grid">
                    <div class="ma-risk-scenario ma-risk-ideal">
                    <div class="ma-risk-lbl">CEN\u00c1RIO IDEAL</div>
                    <div class="ma-risk-val text-success">Ativo &gt; ${fmtCurrency(strike)}</div>
                    <div class="ma-risk-sub">Lucro m\u00e1x: ${fmtCurrency(premioTotalAb)}</div>
                    </div>
                    <div class="ma-risk-scenario ma-risk-atual">
                    <div class="ma-risk-lbl">ATUAL</div>
                    <div class="ma-risk-val" id="mapos-${id}-riskspot">${sp}</div>
                    <div class="ma-risk-sub" id="mapos-${id}-riskstatus">${sp}</div>
                    </div>
                    <div class="ma-risk-scenario ma-risk-perigo">
                    <div class="ma-risk-lbl">RISCO SE</div>
                    <div class="ma-risk-val text-danger">Ativo &lt; ${fmtCurrency(strike)}</div>
                    <div class="ma-risk-sub">Poss\u00edvel preju\u00edzo</div>
                    </div>
                    <div class="ma-risk-scenario ma-risk-pnl">
                    <div class="ma-risk-lbl">P&amp;L ATUAL</div>
                    <div class="ma-risk-val" id="mapos-${id}-riskpnl">${sp}</div>
                    <div class="ma-risk-sub" id="mapos-${id}-riskpnlsub">${sp}</div>
                    </div>
                </div>
                </div>`;
    }

    function buildLivePayload(op, live = {}) {
        const hasSpot = live.spot_price != null || live.spotPrice != null;
        const hasOption = live.option_price != null || live.optionPrice != null;

        return {
            spot_price: hasSpot ? (live.spot_price ?? live.spotPrice) : parseFloat(op.cotacao_spot_atual || op.preco_ativo_base || op.abertura || 0),
            option_price: hasOption ? (live.option_price ?? live.optionPrice) : parseFloat(op.preco_atual || op.preco_entrada || op.premio || op.premio_us || 0),
            pop: live.pop ?? live.prob_lucro ?? 0,
        };
    }

    function renderEvolucaoChartsForAtivo(ativo) {
        state.posicoes
            .filter(op => (op.ativo_base || op.ativo || '').toUpperCase() === ativo)
            .forEach(op => {
                const liveData = state.posLiveData[op.id] || state.posLiveData[parseInt(op.id, 10)];
                if (!liveData) {
                    updatePosCardLive(op, buildLivePayload(op));
                }
                const resolvedLiveData = state.posLiveData[op.id] || state.posLiveData[parseInt(op.id, 10)];
                if (!resolvedLiveData) return;
                renderEvolutionChart(op.id, op, resolvedLiveData);
                updatePosCardLive(op, buildLivePayload(op, resolvedLiveData));
            });
    }

    function renderRiscoChartsForAtivo(ativo) {
        state.posicoes
            .filter(op => (op.ativo_base || op.ativo || '').toUpperCase() === ativo)
            .forEach(op => {
                const liveData = state.posLiveData[op.id] || state.posLiveData[parseInt(op.id, 10)];
                if (!liveData) {
                    updatePosCardLive(op, buildLivePayload(op));
                }
                const resolvedLiveData = state.posLiveData[op.id] || state.posLiveData[parseInt(op.id, 10)];
                if (!resolvedLiveData) return;
                renderGaugeCharts(op.id, op, resolvedLiveData);
                updatePosCardLive(op, buildLivePayload(op, resolvedLiveData));
            });
    }

    /* ------------------------------------------------------------------ */
    /* Renderizar aba Evolução (accordion por ativo + charts lazy)         */
    /* ------------------------------------------------------------------ */
    function renderEvolucaoPane() {
        const sectionsEl = document.getElementById('maPosEvoSections');
        const loadingEl = document.getElementById('maPosEvoLoading');
        const emptyEl = document.getElementById('maPosEvoEmpty');
        if (!sectionsEl) return;
        if (state.posicoes.length === 0) {
            if (loadingEl) loadingEl.style.display = 'none';
            if (emptyEl) emptyEl.style.removeProperty('display');
            sectionsEl.style.display = 'none';
            return;
        }

        // Agrupar por ativo
        const groups = {};
        state.posicoes.forEach(op => {
            const k = (op.ativo_base || op.ativo || 'OUTRO').toUpperCase();
            if (!groups[k]) groups[k] = [];
            groups[k].push(op);
        });

        const groupEntries = Object.entries(groups);
        const accItems = groupEntries.map(([ativo, ops], index) => {
            const safeId = ativo.replace(/[^A-Za-z0-9]/g, '_');
            const sections = ops.map(op => buildEvoSection(op)).join('');
            const isOpen = index === 0;
            return `<div class="accordion-item border-0 mb-2">
                        <h2 class="accordion-header" id="maEvoH-${safeId}">
                            <button class="accordion-button${isOpen ? '' : ' collapsed'} rounded" type="button"
                                    data-bs-toggle="collapse" data-bs-target="#maEvoPan-${safeId}"
                                    aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="maEvoPan-${safeId}"
                                    style="background:rgba(45,198,83,0.08)">
                            <span class="fw-bold me-2">${ativo}</span>
                            <span class="text-muted small">${ops.length} posição${ops.length !== 1 ? 'ões' : ''}</span>
                            </button>
                        </h2>
                        <div id="maEvoPan-${safeId}" class="accordion-collapse collapse${isOpen ? ' show' : ''}" aria-labelledby="maEvoH-${safeId}"
                            data-evo-ativo="${ativo}">
                            <div class="accordion-body p-0 pt-2">
                            ${sections}
                            </div>
                        </div>
                    </div>`;
        }).join('');

        sectionsEl.innerHTML = `<div class="accordion" id="maEvoAcc">${accItems}</div>`;
        sectionsEl.style.removeProperty('display');
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';

        // Renderizar charts ao vivo para dados já carregados (accordion aberto)
        // Charts dentro de collapsed não têm dimensões; renderizamos quando abre
        const firstAtivo = groupEntries[0]?.[0];
        if (firstAtivo) {
            renderEvolucaoChartsForAtivo(firstAtivo);
        }

        document.getElementById('maEvoAcc')?.addEventListener('shown.bs.collapse', function (e) {
            if (!e.target.dataset.evoAtivo) return;
            renderEvolucaoChartsForAtivo(e.target.dataset.evoAtivo);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Renderizar aba Risco (totalizer aberto + accordion por ativo)        */
    /* ------------------------------------------------------------------ */
    function renderRiscoPane() {
        const sectionsEl = document.getElementById('maPosRiscoSections');
        const loadingEl = document.getElementById('maPosRiscoLoading');
        const emptyEl = document.getElementById('maPosRiscoEmpty');
        if (!sectionsEl) return;
        if (state.posicoes.length === 0) {
            if (loadingEl) loadingEl.style.display = 'none';
            if (emptyEl) emptyEl.style.removeProperty('display');
            sectionsEl.style.display = 'none';
            return;
        }

        // ── Totalizer (primeiro card — aberto) ───────────────────────────
        const totalOps = state.posicoes.length;
        const ativosUnicos = [...new Set(state.posicoes.map(op => (op.ativo_base || op.ativo || '').toUpperCase()))];
        const totalPremio = state.posicoes.reduce((s, op) =>
            s + Math.abs(parseFloat(op.premio || op.premio_us || 0)), 0);
        const totalAbertura = state.posicoes.reduce((s, op) =>
            s + Math.abs(parseFloat(op.preco_entrada || op.abertura || 0)), 0);
        const totalizerHtml = `<div class="card mb-3 border-primary">
            <div class="card-header bg-primary-lt">
                <h4 class="card-title mb-0">📊 Resumo de Risco — Carteira</h4>
            </div>
            <div class="card-body">
                <div class="row g-3">
                <div class="col-6 col-md-3 text-center">
                    <div class="display-6 fw-bold text-primary">${totalOps}</div>
                    <div class="text-muted small">Posições Abertas</div>
                </div>
                <div class="col-6 col-md-3 text-center">
                    <div class="display-6 fw-bold text-info">${ativosUnicos.length}</div>
                    <div class="text-muted small">Ativos Distintos</div>
                </div>
                <div class="col-6 col-md-3 text-center">
                    <div class="display-6 fw-bold text-success">US$ ${totalPremio.toFixed(2)}</div>
                    <div class="text-muted small">Total em Prêmios</div>
                </div>
                <div class="col-6 col-md-3 text-center">
                    <div class="display-6 fw-bold" id="maRiscoTotalLucro">—</div>
                    <div class="text-muted small">P&L Consolidado</div>
                </div>
                </div>
                <div class="mt-3">
                <div class="text-muted small mb-1">Ativos em carteira:</div>
                <div class="d-flex flex-wrap gap-2">
                    ${ativosUnicos.map(a => `<span class="badge bg-blue-lt text-blue">${a}</span>`).join('')}
                </div>
                </div>
            </div>
            </div>`;

        // ── Accordion por ativo (todos fechados) ─────────────────────────
        const groups = {};
        state.posicoes.forEach(op => {
            const k = (op.ativo_base || op.ativo || 'OUTRO').toUpperCase();
            if (!groups[k]) groups[k] = [];
            groups[k].push(op);
        });

        const groupEntries = Object.entries(groups);
        const accItems = groupEntries.map(([ativo, ops], index) => {
            const safeId = ativo.replace(/[^A-Za-z0-9]/g, '_');
            const sections = ops.map(op => buildRiscoSection(op)).join('');
            const isOpen = index === 0;
            return `<div class="accordion-item border-0 mb-2">
                <h2 class="accordion-header" id="maRiscoH-${safeId}">
                    <button class="accordion-button${isOpen ? '' : ' collapsed'} rounded" type="button"
                            data-bs-toggle="collapse" data-bs-target="#maRiscoPan-${safeId}"
                            aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="maRiscoPan-${safeId}"
                            style="background:rgba(250,82,82,0.08)">
                    <span class="fw-bold me-2">${ativo}</span>
                    <span class="text-muted small">${ops.length} posição${ops.length !== 1 ? 'ões' : ''}</span>
                    </button>
                </h2>
                <div id="maRiscoPan-${safeId}" class="accordion-collapse collapse${isOpen ? ' show' : ''}" aria-labelledby="maRiscoH-${safeId}"
                    data-risco-ativo="${ativo}">
                    <div class="accordion-body p-0 pt-2">
                    ${sections}
                    </div>
                </div>
                </div>`;
        }).join('');

        sectionsEl.innerHTML = totalizerHtml +
            `<div class="accordion" id="maRiscoAcc">${accItems}</div>`;
        sectionsEl.style.removeProperty('display');
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';

        // Renderizar gauges quando accordion abre
        const firstAtivo = groupEntries[0]?.[0];
        if (firstAtivo) {
            renderRiscoChartsForAtivo(firstAtivo);
        }

        document.getElementById('maRiscoAcc')?.addEventListener('shown.bs.collapse', function (e) {
            if (!e.target.dataset.riscoAtivo) return;
            renderRiscoChartsForAtivo(e.target.dataset.riscoAtivo);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Atualizar card com dados ao vivo da API                              */
    /* ------------------------------------------------------------------ */
    function updatePosCardLive(op, live) {
        if (!op || !op.id) return;
        const id = op.id;
        const spotPrice = parseFloat(live.spot_price || live.spotPrice || 0);
        const optionPrice = parseFloat(live.option_price || live.optionPrice || op.preco_atual || 0);
        const probRaw = parseFloat(live.pop || live.prob_lucro || 0);
        const strike = parseFloat(op.strike || 0);
        const premioAb = Math.abs(parseFloat(op.premio || op.preco_entrada || 0));
        const precoAb = parseFloat(op.preco_ativo_base || 0);
        const qtdAbs = Math.abs(parseFloat(op.quantidade || 1) || 1);
        const premioTotalAb = premioAb * qtdAbs;
        const tipo = (op.tipo || 'CALL').toUpperCase();
        const isVenda = (op.tipo_operacao || '').toUpperCase() === 'VENDA' || parseFloat(op.quantidade || 0) < 0;
        const distAtual = spotPrice > 0 && strike > 0 ? Math.abs((strike - spotPrice) / spotPrice * 100) : 0;
        const isITM = spotPrice > 0 ? (tipo === 'PUT' ? spotPrice < strike : spotPrice > strike) : false;
        const custoRecompra = optionPrice * qtdAbs;
        const mtm = premioTotalAb > 0 ? (isVenda ? premioTotalAb - custoRecompra : custoRecompra - premioTotalAb) : 0;
        const roiAtual = premioTotalAb > 0 ? (mtm / premioTotalAb * 100) : 0;
        const pctRestante = premioAb > 0 ? Math.max(0, Math.min(100, optionPrice / premioAb * 100)) : 100;
        const pctCapturado = 100 - pctRestante;
        const vctoDate = op.vencimento ? (() => { const d = new Date(op.vencimento); d.setHours(0, 0, 0, 0); return d; })() : null;
        const _hoje0 = new Date(); _hoje0.setHours(0, 0, 0, 0);
        const dias = vctoDate && !isNaN(vctoDate) ? Math.max(0, Math.round((vctoDate - _hoje0) / 86400000)) : 0;
        const theta = dias > 0 ? (optionPrice * qtdAbs / dias) : 0;
        const varSpot = spotPrice > 0 && precoAb > 0 ? ((spotPrice - precoAb) / precoAb * 100) : 0;
        const ganhoDecay = (premioAb - optionPrice) * qtdAbs;
        const ganhoAcao = spotPrice > 0 && precoAb > 0 ? (spotPrice - precoAb) * qtdAbs : null;
        const breakeven = tipo === 'PUT' ? strike - premioAb : strike + premioAb;

        // PoP: usa valor da API ou estima heurísticamente
        let popEst = probRaw;
        if (popEst === 0 && spotPrice > 0 && strike > 0) {
            const dist = Math.abs(spotPrice - strike) / spotPrice * 100;
            popEst = isITM ? Math.max(5.0, 50.0 - dist * 4.0) : Math.min(95.0, 50.0 + dist * 4.0);
        }

        const setH = (eid, html) => { const el = document.getElementById(eid); if (el) el.innerHTML = html; };
        const c0 = v => v >= 0 ? 'text-success' : 'text-danger';
        const distColor = isITM ? 'text-danger' : distAtual < 3 ? 'text-warning' : 'text-success';
        const popColor = popEst >= 65 ? 'text-success' : popEst >= 50 ? 'text-warning' : 'text-danger';

        // ITM/OTM + Decisão badges
        const itmEl = document.getElementById(`mapos-${id}-itmotm`);
        if (itmEl) {
            itmEl.textContent = isITM ? '⚠️ ITM' : '✅ OTM';
            itmEl.style.cssText = isITM
                ? 'background:rgba(220,53,69,0.22);color:#fa5252;border:1px solid rgba(220,53,69,0.4)'
                : 'background:rgba(45,198,83,0.18);color:#2dc653;border:1px solid rgba(45,198,83,0.35)';
        }
        const decEl = document.getElementById(`mapos-${id}-decisao`);
        if (decEl) {
            let txt, fg;
            if (isITM) { txt = '🔴 ATENÇÃO'; fg = '#fa5252'; }
            else if (distAtual < 2) { txt = '🟠 ROLAR'; fg = '#fd7e14'; }
            else if (distAtual < 5) { txt = '🟡 MONITORAR'; fg = '#f59f00'; }
            else { txt = '🟢 MANTER'; fg = '#2dc653'; }
            decEl.textContent = txt;
            decEl.style.cssText = `background:${fg}22;color:${fg};border:1px solid ${fg}55`;
        }

        // 4 KPIs
        setH(`mapos-${id}-lucroaberto`, `<span class="${c0(mtm)}" style="font-size:1.3rem;font-weight:700">${mtm >= 0 ? '+' : ''}${fmtCurrencyShort(mtm)}</span>`);
        setH(`mapos-${id}-pop2`, `<span class="${popColor}" style="font-size:1.4rem;font-weight:700">${popEst.toFixed(0)}%</span>`);
        setH(`mapos-${id}-popstatus`, `<span class="${popEst >= 50 ? 'text-success' : 'text-danger'} small">${popEst >= 50 ? 'Vencendo' : 'Perdendo'}</span>`);
        setH(`mapos-${id}-spot2`, spotPrice > 0 ? `<span style="font-size:1.3rem;font-weight:700;color:#c9d1d9">${fmtCurrency(spotPrice)}</span>` : '<span class="text-muted">—</span>');
        if (precoAb > 0 && spotPrice > 0) {
            setH(`mapos-${id}-varspot`, `<span class="${c0(varSpot)} small">${varSpot >= 0 ? '+' : ''}${varSpot.toFixed(2)}% vs abertura</span>`);
        } else {
            setH(`mapos-${id}-varspot`, '<span class="text-muted small">sem dado de abertura</span>');
        }
        setH(`mapos-${id}-dist2`, `<span class="${distColor}" style="font-size:1.3rem;font-weight:700">${isITM ? '-' : '+'}${distAtual.toFixed(2)}%</span>`);
        setH(`mapos-${id}-distsub`, `<span class="text-muted small">${isITM ? 'Dentro do strike' : 'Acima do strike'}</span>`);

        // Comparativo mid
        setH(`mapos-${id}-cpopt`, `<span class="text-info">${optionPrice.toFixed(2)}</span>`);
        const dOptPct = premioAb > 0 ? ((optionPrice - premioAb) / premioAb * 100) : 0;
        setH(`mapos-${id}-cpopdelta`, `<span class="${c0(-dOptPct)}">${dOptPct <= 0 ? '▼' : '▲'} ${Math.abs(dOptPct).toFixed(0)}%</span>`);
        if (spotPrice > 0) {
            setH(`mapos-${id}-cspot`, `<span>${spotPrice.toFixed(2)}</span>`);
            if (precoAb > 0) {
                const dSpot = ((spotPrice - precoAb) / precoAb * 100);
                setH(`mapos-${id}-cspotdelta`, `<span class="${c0(dSpot)}">${dSpot >= 0 ? '▲' : '▼'} ${Math.abs(dSpot).toFixed(2)}%</span>`);
            } else {
                setH(`mapos-${id}-cspotdelta`, '<span class="text-muted">—</span>');
            }
        }
        setH(`mapos-${id}-gdecay`, `<span class="${c0(ganhoDecay)}">${ganhoDecay >= 0 ? '+' : ''}${fmtCurrency(ganhoDecay)}</span>`);
        setH(`mapos-${id}-distatual2`, `Dist: <strong class="${distColor}">${distAtual.toFixed(2)}%</strong>`);

        // Probabilidade bar
        setH(`mapos-${id}-pop3`, `<span class="${popColor} fw-bold">${popEst.toFixed(0)}%</span>`);
        const popBar = document.getElementById(`mapos-${id}-popbar`);
        if (popBar) {
            popBar.style.width = popEst.toFixed(1) + '%';
            popBar.className = `progress-bar ${popEst >= 65 ? 'bg-success' : popEst >= 50 ? 'bg-warning' : 'bg-danger'}`;
        }

        // Bottom 3: Comparativo detalhado
        setH(`mapos-${id}-premopt`, `<span class="text-info">${fmtCurrency(optionPrice)}</span>`);
        setH(`mapos-${id}-acaopt`, spotPrice > 0 ? fmtCurrency(spotPrice) : '—');
        setH(`mapos-${id}-gdecay2`, `${ganhoDecay >= 0 ? '+' : ''}${fmtCurrency(ganhoDecay)}`);
        if (ganhoAcao !== null) {
            const gaColor = isVenda ? c0(-ganhoAcao) : c0(ganhoAcao);
            setH(`mapos-${id}-gacao`, `<span class="${gaColor}">${ganhoAcao >= 0 ? '+' : ''}${fmtCurrency(ganhoAcao)}</span>`);
        } else {
            setH(`mapos-${id}-gacao`, '<span class="text-muted">—</span>');
        }

        // Bottom 3: Projeção
        const premRestante = optionPrice * qtdAbs;
        setH(`mapos-${id}-premrest`, fmtCurrency(premRestante));
        setH(`mapos-${id}-premperder`, fmtCurrency(premRestante));

        // Bottom 3: Posição Atual
        setH(`mapos-${id}-lucroreal`, `<span class="${c0(mtm)}">${mtm >= 0 ? '+' : ''}${fmtCurrencyShort(mtm)}</span>`);
        setH(`mapos-${id}-premopt2`, fmtCurrency(optionPrice));
        setH(`mapos-${id}-margem`, `<span class="${distColor}">${isITM ? '-' : '+'}${distAtual.toFixed(2)}%</span>`);
        setH(`mapos-${id}-roi`, `<span class="${c0(roiAtual)}">${roiAtual >= 0 ? '+' : ''}${roiAtual.toFixed(1)}%</span>`);

        // Bars
        const decBar = document.getElementById(`mapos-${id}-decaybar`);
        if (decBar) decBar.style.width = Math.min(pctCapturado, 100).toFixed(1) + '%';
        setH(`mapos-${id}-decaypct`, `<span class="${pctCapturado >= 50 ? 'text-success' : 'text-warning'} fw-bold">${pctCapturado.toFixed(1)}%</span>`);

        // Indicators
        setH(`mapos-${id}-pop`, `<span class="${popColor} fw-bold">${popEst.toFixed(1)}%</span>`);
        setH(`mapos-${id}-theta`, `<span class="text-success">+${fmtCurrency(theta)}/d</span>`);
        const drEl = document.getElementById(`mapos-${id}-diasrest`);
        if (drEl) drEl.textContent = dias > 0 ? dias + 'd' : '—';

        // Aba Evolução — milestones ("Hoje")
        setH(`mapos-${id}-evoopt`, `<span style="font-size:1.15rem;font-weight:700" class="${c0((premioAb - optionPrice) * qtdAbs)}">${fmtCurrency(optionPrice)}</span>`);
        const descRecomp = isVenda
            ? (mtm >= 0 ? `✓ Lucro: ${fmtCurrency(mtm)}` : `⚠️ Pagaria ${fmtCurrency(custoRecompra)} p/ fechar`)
            : `Valor MTM: ${fmtCurrency(custoRecompra)}`;
        setH(`mapos-${id}-evorecomp`, `<span class="${c0(mtm)} small">${descRecomp}</span>`);

        // Aba Risco — cenários
        setH(`mapos-${id}-riskspot`, spotPrice > 0 ? `<span style="font-size:1.1rem;font-weight:700;color:${isITM ? '#fa5252' : '#2dc653'}">${fmtCurrency(spotPrice)}</span>` : '<span class="text-muted">—</span>');
        setH(`mapos-${id}-riskstatus`, `<span class="${isITM ? 'text-danger' : 'text-success'} small">${isITM ? '⚠️ Dentro do strike (ITM)' : '✓ Acima do strike (OTM)'}</span>`);
        setH(`mapos-${id}-riskpnl`, `<span style="font-size:1.1rem;font-weight:700" class="${c0(mtm)}">${mtm >= 0 ? '+' : ''}${fmtCurrency(mtm)}</span>`);
        setH(`mapos-${id}-riskpnlsub`, `<span class="${c0(mtm)} small">${mtm >= 0 ? 'Se fechar agora' : 'Se recomprar agora'}</span>`);

        // Enriquecer posLiveData para lazy charts
        let diasAbertos2 = 0, totalDias2 = 1;
        const vctoDate2 = op.vencimento ? new Date(op.vencimento) : null;
        if (op.data_operacao && vctoDate2 && !isNaN(vctoDate2)) {
            const dAb2 = new Date(op.data_operacao);
            if (!isNaN(dAb2)) {
                diasAbertos2 = Math.max(0, Math.round((new Date() - dAb2) / 86400000));
                totalDias2 = Math.max(1, Math.round((vctoDate2 - dAb2) / 86400000));
            }
        }
        const percTempo2 = totalDias2 > 1 ? Math.min(100, Math.round(diasAbertos2 / totalDias2 * 100)) : 0;
        const pctVariacaoPremio = premioAb > 0 ? ((optionPrice - premioAb) / premioAb * 100) : 0;

        state.posLiveData[id] = {
            spotPrice, optionPrice, mtm, roiAtual, pctCapturado, distAtual, isITM, popEst,
            dias, percTempo: percTempo2, pctVariacaoPremio,
            premioAb, premioTotalAb, breakeven, strike, qtdAbs, tipo, isVenda, custoRecompra
        };

        // Renderizar payoff chart (aba Visão Geral)
        ensureApex(() => renderPayoffChart(id, op, { spotPrice, optionPrice, premioTotalAb, strike, qtdAbs, tipo, isVenda, breakeven, premioAb }));
    }

    /* ------------------------------------------------------------------ */
    /* Diagrama de Payoff ApexCharts por posição                           */
    /* ------------------------------------------------------------------ */
    function renderPayoffChart(id, op, data) {
        const el = document.getElementById(`mapos-${id}-payoff`);
        if (!el) return;
        if (state.posPayoffCharts[id]) {
            try { state.posPayoffCharts[id].destroy(); } catch (_) { }
        }
        const { spotPrice, premioTotalAb, strike, qtdAbs, tipo, isVenda, breakeven, premioAb } = data;

        // Gerar curva de payoff
        const ref = spotPrice > 0 ? spotPrice : strike;
        const minP = Math.min(strike, ref) * 0.87;
        const maxP = Math.max(strike, ref) * 1.15;
        const steps = 36;
        const step = (maxP - minP) / steps;
        const prices = [], pnl = [];

        for (let i = 0; i <= steps; i++) {
            const price = minP + i * step;
            let profit;
            if (tipo === 'PUT') {
                if (isVenda) {
                    profit = price >= strike ? premioTotalAb
                        : price >= breakeven ? premioTotalAb - (strike - price) * qtdAbs
                            : -(strike - price) * qtdAbs + premioTotalAb;
                } else {
                    profit = price <= breakeven ? (strike - price) * qtdAbs - premioTotalAb : -premioTotalAb;
                }
            } else {
                if (isVenda) {
                    profit = price <= strike ? premioTotalAb
                        : price <= breakeven ? premioTotalAb - (price - strike) * qtdAbs
                            : -(price - strike) * qtdAbs + premioTotalAb;
                } else {
                    profit = price >= breakeven ? (price - strike) * qtdAbs - premioTotalAb : -premioTotalAb;
                }
            }
            prices.push(parseFloat(price.toFixed(2)));
            pnl.push(parseFloat(profit.toFixed(2)));
        }

        // Cores por zona (verde acima de 0, vermelho abaixo)
        const seriesColors = pnl.map(v => v >= 0 ? '#2dc653' : '#fa5252');
        const dominantColor = pnl.filter(v => v >= 0).length >= pnl.length / 2 ? '#2dc653' : '#fa5252';

        const annotations = {
            xaxis: [
                {
                    x: parseFloat(strike.toFixed(2)), strokeDashArray: 5, borderColor: '#fa5252',
                    label: { text: `Strike ${fmtCurrencyShort(strike)}`, style: { background: '#fa5252', color: '#fff', fontSize: '0.6rem', padding: { top: 2, bottom: 2, left: 4, right: 4 } }, position: 'bottom', offsetY: 0 }
                },
                ...(spotPrice > 0 ? [{
                    x: parseFloat(spotPrice.toFixed(2)), strokeDashArray: 0, borderColor: '#4d9de0', borderWidth: 2,
                    label: { text: `R$${spotPrice.toFixed(2)}`, style: { background: '#4d9de0', color: '#fff', fontSize: '0.6rem', padding: { top: 2, bottom: 2, left: 4, right: 4 } }, offsetY: -20 }
                }] : [])
            ],
            yaxis: [{ y: 0, strokeDashArray: 3, borderColor: 'rgba(255,255,255,0.25)' }]
        };

        state.posPayoffCharts[id] = new ApexCharts(el, {
            chart: { type: 'area', height: 160, background: 'transparent', toolbar: { show: false }, animations: { speed: 400, dynamicAnimation: { enabled: false } }, sparkline: { enabled: false } },
            series: [{ name: 'P&L', data: pnl }],
            xaxis: { categories: prices, labels: { formatter: v => '+R$' + parseFloat(v).toFixed(0), style: { colors: '#6e7681', fontSize: '0.6rem' }, rotate: 0, tickAmount: 5 }, axisBorder: { show: false } },
            yaxis: { labels: { formatter: v => fmtCurrencyShort(v), style: { colors: ['#8b949e'], fontSize: '0.6rem' } } },
            fill: { type: 'gradient', gradient: { shade: 'dark', type: 'vertical', shadeIntensity: 0.4, gradientToColors: ['rgba(250,82,82,0.2)'], opacityFrom: 0.5, opacityTo: 0.0 } },
            stroke: { curve: 'smooth', width: 2, colors: [dominantColor] },
            colors: [dominantColor],
            annotations,
            grid: { borderColor: 'rgba(255,255,255,0.06)', padding: { left: 2, right: 2, top: 0, bottom: 0 } },
            dataLabels: { enabled: false },
            tooltip: { theme: 'dark', y: { formatter: v => fmtCurrency(v) }, x: { formatter: v => `R$ ${v}` } },
            theme: { mode: 'dark' },
        });
        state.posPayoffCharts[id].render();
    }

    /* ------------------------------------------------------------------ */
    /* Evolução do Prêmio (3 pontos) + Strike vs Ativo (bar)               */
    /* ------------------------------------------------------------------ */
    function renderEvolutionChart(id, op, liveData) {
        const { optionPrice, premioAb, premioTotalAb, spotPrice, strike } = liveData;
        const vctoDate = op.vencimento ? new Date(op.vencimento) : null;
        const vctoStr = vctoDate && !isNaN(vctoDate) ? vctoDate.toLocaleDateString('pt-BR') : 'Vcto';
        const dataAb = op.data_operacao ? new Date(op.data_operacao).toLocaleDateString('pt-BR') : 'Abertura';
        const improved = optionPrice <= premioAb;
        const evoColor = improved ? '#2dc653' : '#fa5252';

        // Chart 1: evolução linha
        const evoEl = document.getElementById(`mapos-${id}-evochart`);
        if (evoEl) {
            if (state.posEvolutionCharts[id]) { try { state.posEvolutionCharts[id].destroy(); } catch (_) { } }
            state.posEvolutionCharts[id] = new ApexCharts(evoEl, {
                chart: { type: 'line', height: 200, background: 'transparent', toolbar: { show: false }, animations: { speed: 400 } },
                series: [{
                    name: 'Prêmio', data: [
                        { x: `Abertura\n${dataAb}`, y: parseFloat(premioAb.toFixed(4)) },
                        { x: 'Hoje', y: parseFloat(optionPrice.toFixed(4)) },
                        { x: `Vencimento\n${vctoStr}`, y: 0.00 }
                    ]
                }],
                stroke: { curve: 'smooth', width: 3, colors: [evoColor] },
                markers: { size: 8, colors: ['#2dc653', evoColor, '#2dc653'], strokeColors: '#1a2332', strokeWidth: 2 },
                annotations: {
                    yaxis: [{
                        y: premioAb, borderColor: '#2dc653', strokeDashArray: 5,
                        label: { text: `Venda: ${fmtCurrency(premioAb)}`, style: { background: '#2dc653', color: '#fff', fontSize: '0.62rem', padding: { top: 2, bottom: 2, left: 4, right: 4 } } }
                    }]
                },
                xaxis: { labels: { style: { colors: '#8b949e', fontSize: '0.65rem' } } },
                yaxis: { labels: { formatter: v => 'R$' + parseFloat(v).toFixed(2), style: { colors: ['#8b949e'], fontSize: '0.65rem' } }, min: 0 },
                grid: { borderColor: 'rgba(255,255,255,0.07)', strokeDashArray: 3 },
                tooltip: { theme: 'dark', y: { formatter: v => fmtCurrency(v) } },
                dataLabels: { enabled: false },
                theme: { mode: 'dark' },
            });
            state.posEvolutionCharts[id].render();
        }

        // Chart 2: strike vs ativo (barras)
        const strikeEl = document.getElementById(`mapos-${id}-strikechart`);
        if (strikeEl && spotPrice > 0 && strike > 0) {
            const key = `${id}-strike`;
            if (state.posGaugeCharts[key]) { try { state.posGaugeCharts[key].destroy(); } catch (_) { } }
            const minY = Math.min(strike, spotPrice) * 0.97;
            state.posGaugeCharts[key] = new ApexCharts(strikeEl, {
                chart: { type: 'bar', height: 200, background: 'transparent', toolbar: { show: false }, animations: { speed: 400 } },
                series: [{
                    name: 'Valor', data: [
                        { x: `Strike\n${fmtCurrency(strike)}`, y: parseFloat(strike.toFixed(2)) },
                        { x: `Ativo Atual\n${fmtCurrency(spotPrice)}`, y: parseFloat(spotPrice.toFixed(2)) },
                    ]
                }],
                plotOptions: { bar: { columnWidth: '55%', dataLabels: { position: 'top' }, distributed: true } },
                colors: ['#fa5252', spotPrice > strike ? '#2dc653' : '#f59f00'],
                dataLabels: { enabled: true, formatter: v => 'R$' + parseFloat(v).toFixed(2), style: { fontSize: '0.68rem', colors: ['#fff'] }, offsetY: -20 },
                xaxis: { labels: { style: { colors: '#8b949e', fontSize: '0.65rem' } } },
                yaxis: { labels: { formatter: v => 'R$' + parseFloat(v).toFixed(0), style: { colors: ['#8b949e'], fontSize: '0.65rem' } }, min: minY },
                legend: { show: false },
                grid: { borderColor: 'rgba(255,255,255,0.07)', strokeDashArray: 3 },
                tooltip: { theme: 'dark', y: { formatter: v => fmtCurrency(v) } },
                theme: { mode: 'dark' },
            });
            state.posGaugeCharts[key].render();
        }
    }

    /* ------------------------------------------------------------------ */
    /* Gauges: variação prêmio, distância strike, tempo restante           */
    /* ------------------------------------------------------------------ */
    function renderGaugeCharts(id, op, liveData) {
        const { distAtual, isITM, pctVariacaoPremio, dias } = liveData;
        const vctoDate = op.vencimento ? new Date(op.vencimento) : null;
        let totalDias = 30;
        if (op.data_operacao && vctoDate && !isNaN(vctoDate)) {
            const dAb = new Date(op.data_operacao);
            if (!isNaN(dAb)) totalDias = Math.max(1, Math.round((vctoDate - dAb) / 86400000));
        }
        const pctRestanteTempo = totalDias > 0 ? parseFloat(Math.min(100, (dias / totalDias * 100)).toFixed(1)) : 0;
        const absVar = parseFloat(Math.min(100, Math.abs(pctVariacaoPremio || 0)).toFixed(1));
        const distNorm = parseFloat(Math.min(100, ((distAtual || 0) / 20 * 100)).toFixed(1));
        const varColor = (pctVariacaoPremio || 0) <= 0 ? '#2dc653' : '#fa5252';
        const distColor2 = isITM ? '#fa5252' : (distAtual || 0) < 3 ? '#f59f00' : '#2dc653';
        const tempoColor = pctRestanteTempo < 20 ? '#fa5252' : pctRestanteTempo < 40 ? '#f59f00' : '#4d9de0';
        const setH = (eid, html) => { const el = document.getElementById(eid); if (el) el.innerHTML = html; };

        const gaugeConfig = (val, color, fmt) => ({
            chart: { type: 'radialBar', height: 160, background: 'transparent', toolbar: { show: false }, animations: { speed: 500 } },
            series: [parseFloat(val.toFixed(1))],
            plotOptions: {
                radialBar: {
                    startAngle: -135, endAngle: 135,
                    track: { background: 'rgba(255,255,255,0.08)', startAngle: -135, endAngle: 135 },
                    dataLabels: { name: { show: false }, value: { fontSize: '1.1rem', fontWeight: 700, color, formatter: v => fmt(v) } }
                }
            },
            fill: { colors: [color] },
            stroke: { lineCap: 'round' },
            theme: { mode: 'dark' },
            tooltip: { enabled: false },
        });

        const makeGauge = (elId, val, color, fmt) => {
            const el = document.getElementById(elId);
            if (!el) return;
            const existing = state.posGaugeCharts[elId];
            if (existing) { try { existing.destroy(); } catch (_) { } }
            const chart = new ApexCharts(el, gaugeConfig(val, color, fmt));
            state.posGaugeCharts[elId] = chart;
            chart.render();
        };

        makeGauge(`mapos-${id}-gauge-var`, absVar, varColor, () => `${(pctVariacaoPremio || 0) >= 0 ? '+' : ''}${parseFloat(pctVariacaoPremio || 0).toFixed(0)}%`);
        makeGauge(`mapos-${id}-gauge-dist`, distNorm, distColor2, () => `${isITM ? '-' : '+'}${(distAtual || 0).toFixed(1)}%`);
        makeGauge(`mapos-${id}-gauge-tempo`, pctRestanteTempo, tempoColor, () => `${dias}d`);

        setH(`mapos-${id}-gaugelbl-var`, `<span style="color:${varColor};font-size:0.9rem;font-weight:700">${(pctVariacaoPremio || 0) >= 0 ? '+' : ''}${(pctVariacaoPremio || 0).toFixed(1)}% do prêmio</span>`);
        setH(`mapos-${id}-gaugelbl-dist`, `<span style="color:${distColor2};font-size:0.9rem;font-weight:700">${isITM ? 'ITM ' : 'OTM '}${(distAtual || 0).toFixed(2)}%</span>`);
        setH(`mapos-${id}-gaugelbl-tempo`, `<span style="color:${tempoColor};font-size:0.9rem;font-weight:700">${dias} dias restantes</span>`);
        setH(`mapos-${id}-gaugesub-dist`, `<span class="small text-muted">${isITM ? 'Dentro do strike ⚠️' : 'OTM ✓'}</span>`);
    }

    /* ------------------------------------------------------------------ */
    /* Buscar cotações ao vivo para todas as posições                        */
    /* ------------------------------------------------------------------ */
    async function refreshPosicoesCotacoes() {
        // 1. Batch refresh (POST) — atualiza preco_atual no DB e retorna spot/pop
        let liveMap = {};
        try {
            const res = await fetch(state.apiEndpoint + '/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.data && Array.isArray(data.data)) {
                    data.data.forEach(item => { if (item.id) liveMap[item.id] = item; });
                }
            }
        } catch (err) {
            console.warn('[modal-analise] Erro no refresh batch:', err);
        }

        // 2. Recarregar ops para ter preco_atual atualizado
        await loadPosicoesAbertas();

        // 3. Atualizar cada card com dados mesclados
        state.posicoes.forEach(op => {
            const live = buildLivePayload(op, liveMap[op.id] || {});
            updatePosCardLive(op, live);
        });

        renderPosSummary();

        // Atualizar aba ativa de posições se necessário
        if (state.activeTab === 'evolucao') ensureApex(() => renderEvolucaoPane());
        else if (state.activeTab === 'risco') ensureApex(() => renderRiscoPane());

        const attEl = document.getElementById('maPosUltimaAtt');
        if (attEl) attEl.textContent = new Date().toLocaleTimeString('pt-BR',
            { hour: '2-digit', minute: '2-digit' });
    }

    /* ------------------------------------------------------------------ */
    /* Renderizar resumo (cards do topo da aba)                             */
    /* ------------------------------------------------------------------ */
    function renderPosSummary() {
        const lives = Object.values(state.posLiveData);
        const count = state.posicoes.length;
        const totalMTM = lives.reduce((s, d) => s + (d.mtm || 0), 0);
        const avgROI = lives.length > 0 ? lives.reduce((s, d) => s + (d.roiAtual || 0), 0) / lives.length : 0;
        const itmCount = lives.filter(d => d.isITM).length;
        const avgDecay = lives.length > 0 ? lives.reduce((s, d) => s + (d.pctCapturado || 0), 0) / lives.length : 0;
        const mtmColor = totalMTM >= 0 ? '#2dc653' : '#fa5252';
        const setH = (eid, html) => { const el = document.getElementById(eid); if (el) el.innerHTML = html; };
        setH('maPosCount', `<span style="color:#c9d1d9;font-weight:700">${count}</span>`);
        setH('maPosTotalMTM', `<span style="color:${mtmColor};font-weight:700">${totalMTM >= 0 ? '+' : ''}${fmtCurrencyShort(totalMTM)}</span>`);
        setH('maPosPctMedio', `<span style="color:${avgROI >= 0 ? '#2dc653' : '#fa5252'};font-weight:700">${avgROI >= 0 ? '+' : ''}${avgROI.toFixed(1)}%</span>`);
        setH('maPosRiscoCount', `<span style="color:${itmCount > 0 ? '#fa5252' : '#2dc653'};font-weight:700">${itmCount} ITM</span>`);
        setH('maPosDecayMedio', `<span style="color:#4d9de0;font-weight:700">${avgDecay.toFixed(1)}%</span>`);
    }

    /* ------------------------------------------------------------------ */
    /* Renderizar gráficos ApexCharts (bar MTM + radialBar status)          */
    /* ------------------------------------------------------------------ */
    function renderPosCharts() {
        // P&L MTM e Distribuição de Risco foram promovidos às abas principais Evolução e Risco
    }

    /* ------------------------------------------------------------------ */
    /* Refresh completo da aba Posições (dados + cotações ao vivo)         */
    /* ------------------------------------------------------------------ */
    async function refreshPosicoesCompleto() {
        if (state.posRefreshing) return;
        state.posRefreshing = true;
        try {
            state.posLiveData = {};
            // Destruir charts antigos
            Object.values(state.posPayoffCharts).forEach(ch => { try { ch.destroy(); } catch (_) { } });
            state.posPayoffCharts = {};
            Object.values(state.posEvolutionCharts).forEach(ch => { try { ch.destroy(); } catch (_) { } });
            state.posEvolutionCharts = {};
            Object.values(state.posGaugeCharts).forEach(ch => { try { ch.destroy(); } catch (_) { } });
            state.posGaugeCharts = {};
            // Reset panes de posições para estado de loading
            ['maPosSummary', 'maPosCards', 'maPosEmpty'].forEach(eid => {
                const el = document.getElementById(eid);
                if (el) el.style.display = 'none';
            });
            ['maPosEvoSections', 'maPosRiscoSections'].forEach(eid => {
                const el = document.getElementById(eid);
                if (el) { el.style.display = 'none'; el.innerHTML = ''; }
            });
            ['maPosEvoLoading', 'maPosRiscoLoading'].forEach(eid => {
                const el = document.getElementById(eid);
                if (el) el.style.removeProperty('display');
            });
            const loadingEl = document.getElementById('maPosLoading');
            if (loadingEl) loadingEl.style.removeProperty('display');
            await loadPosicoesAbertas();
            renderPosicoesGrid();
            if (state.posicoes.length > 0) {
                await refreshPosicoesCotacoes();
            } else {
                ['maPosEvoLoading', 'maPosRiscoLoading'].forEach(eid => {
                    const el = document.getElementById(eid);
                    if (el) el.style.display = 'none';
                });
            }
        } finally {
            state.posRefreshing = false;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Setup trigger (botão Análise)                                        */
    /* ------------------------------------------------------------------ */
    function setupTriggers() {
        const btn = document.getElementById('btnAnalise');
        if (btn) {
            btn.addEventListener('click', openModal);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Render Deep – Dashboard Cards, Chart, Parecer                       */
    /* ------------------------------------------------------------------ */
    function renderDeep(stats, ops) {
        const isCrypto = state.apiEndpoint.includes('/crypto');
        const resultField = isCrypto ? ['premio_us', 'resultado'] : ['resultado', 'resultado_total'];

        /* ── Dashboard Cards ── */
        const investInicial = isCrypto ? getSaldoCryptoConfig() : getSaldoCorretora();
        const investSub = isCrypto ? 'saldo configurado' : 'saldo corretora';
        setEl('maDeepInvestInicial', investInicial > 0 ? fmtAmountShort(investInicial) : '-');
        setEl('maDeepInvestSub', investSub);

        const valorFinal = investInicial + stats.totalResult;
        setEl('maDeepValorFinal', fmtAmountShort(valorFinal));
        const valorChange = investInicial > 0 ? ((valorFinal - investInicial) / investInicial * 100) : 0;
        const valorChangeEl = document.getElementById('maDeepValorChange');
        if (valorChangeEl) {
            valorChangeEl.textContent = (valorChange >= 0 ? '+' : '') + valorChange.toFixed(1) + '% vs inicial';
            valorChangeEl.style.color = valorChange >= 0 ? '#4ade80' : '#f87171';
        }
        const valorSub = isCrypto ? 'US$ ' + valorFinal.toFixed(2) : fmtAmount(valorFinal);
        setEl('maDeepValorSub', valorSub);

        const totalPremios = ops.reduce((s, op) => s + Math.abs(getNumber(op, resultField)), 0);
        setEl('maDeepResultadoBruto', fmtAmountShort(totalPremios));
        setEl('maDeepBrutoSub', stats.totalOps + ' operaç' + (stats.totalOps === 1 ? 'ão' : 'ões'));
        const brutoChangeEl = document.getElementById('maDeepBrutoChange');
        if (brutoChangeEl) {
            brutoChangeEl.textContent = 'Ticket médio: ' + fmtAmountShort(stats.ticketMedio);
        }

        setEl('maDeepResultadoLiq', fmtAmountShort(stats.totalResult));
        setEl('maDeepLiqSub', 'liquido period');
        const liqChangeEl = document.getElementById('maDeepLiqChange');
        if (liqChangeEl) {
            liqChangeEl.textContent = stats.totalResult >= 0 ? 'acima do investimento' : 'abaixo do investimento';
            liqChangeEl.style.color = stats.totalResult >= 0 ? '#4ade80' : '#f87171';
        }

        /* ── SVG Chart ── */
        renderDeepChart(ops, stats, resultField);

        /* ── Parecer Estratégico ── */
        renderDeepParecer(stats, ops, investInicial, resultField);
    }

    function renderDeepChart(ops, stats, resultField) {
        const lineEl = document.getElementById('maDeepChartLine');
        const areaEl = document.getElementById('maDeepChartArea');
        const dotEl = document.getElementById('maDeepChartDot');
        const valEl = document.getElementById('maDeepChartVal');
        const badgeEl = document.getElementById('maDeepChartBadge');
        if (!lineEl || !areaEl) return;

        const sorted = [...ops].filter(op => {
            const d = op.data_operacao || op.data || op.dt;
            return d;
        }).sort((a, b) => {
            const da = new Date(a.data_operacao || a.data || a.dt);
            const db = new Date(b.data_operacao || b.data || b.dt);
            return da - db;
        });

        if (sorted.length < 2) {
            setEl('maDeepSumLucro', '-');
            setEl('maDeepSumPrej', '-');
            setEl('maDeepSumLiq', fmtAmountShort(stats.totalResult));
            if (badgeEl) badgeEl.textContent = stats.totalResult >= 0 ? 'LUCRO' : 'PREJUIZO';
            return;
        }

        let cumulative = 0;
        const points = [];
        sorted.forEach(op => {
            cumulative += getNumber(op, resultField);
            points.push(cumulative);
        });

        const minX = 60, maxX = 760, minY = 30, maxY = 250;
        const rangeY = Math.max(Math.abs(Math.min(...points)), Math.abs(Math.max(...points)), 1);
        const baseline = (minY + maxY) / 2;

        const coords = points.map((p, i) => {
            const x = minX + (i / (points.length - 1)) * (maxX - minX);
            const y = baseline - (p / rangeY) * (baseline - minY);
            return { x, y: Math.max(minY, Math.min(maxY, y)) };
        });

        const linePoints = coords.map(c => c.x.toFixed(1) + ',' + c.y.toFixed(1)).join(' ');
        lineEl.setAttribute('points', linePoints);

        const lastCoord = coords[coords.length - 1];
        const firstCoord = coords[0];
        const areaPoints = linePoints + ' ' + lastCoord.x + ',' + maxY + ' ' + firstCoord.x + ',' + maxY;
        areaEl.setAttribute('points', areaPoints);
        areaEl.setAttribute('fill', stats.totalResult >= 0 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)');

        dotEl.setAttribute('cx', lastCoord.x);
        dotEl.setAttribute('cy', lastCoord.y);
        dotEl.setAttribute('fill', stats.totalResult >= 0 ? '#4ade80' : '#f87171');

        if (valEl) {
            valEl.setAttribute('x', lastCoord.x);
            valEl.textContent = fmtAmountShort(stats.totalResult);
            valEl.setAttribute('fill', stats.totalResult >= 0 ? '#4ade80' : '#f87171');
        }

        if (badgeEl) {
            badgeEl.textContent = stats.totalResult >= 0 ? 'LUCRO' : 'PREJUIZO';
            badgeEl.className = 'ma-deep-badge ' + (stats.totalResult >= 0 ? 'ma-deep-badge-profit' : 'ma-deep-badge-loss');
        }

        const lucros = points.filter(p => p > 0);
        const prejs = points.filter(p => p < 0);
        setEl('maDeepSumLucro', lucros.length ? fmtAmountShort(Math.max(...points)) : '-');
        setEl('maDeepSumPrej', prejs.length ? fmtAmountShort(Math.min(...points)) : '-');
        setEl('maDeepSumLiq', fmtAmountShort(stats.totalResult));
    }

    function renderDeepParecer(stats, ops, investInicial, resultField) {
        const badgeEl = document.getElementById('maDeepStatusBadge');
        if (badgeEl) {
            if (stats.totalResult > 0) {
                badgeEl.textContent = 'LUCRO';
                badgeEl.className = 'ma-deep-status-badge profit';
            } else if (stats.totalResult < 0) {
                badgeEl.textContent = 'PREJUIZO';
                badgeEl.className = 'ma-deep-status-badge loss';
            } else {
                badgeEl.textContent = 'NEUTRO';
                badgeEl.className = 'ma-deep-status-badge neutral';
            }
        }

        setEl('maDeepPiPerf', fmtAmountShort(stats.totalResult));
        const perfBar = document.getElementById('maDeepPiPerfBar');
        if (perfBar) {
            const perfPct = Math.min(100, Math.abs(stats.totalResult) / Math.max(investInicial, 1) * 100 * 10);
            perfBar.style.width = perfPct + '%';
            perfBar.style.background = stats.totalResult >= 0 ? '#4ade80' : '#f87171';
        }

        const exercidas = ops.filter(op => {
            const st = (op.status || '').toUpperCase();
            return st === 'EXERCIDA' || st === 'EXERCISED';
        });
        const exercCount = exercidas.length;
        const riscoEl = document.getElementById('maDeepPiRisco');
        const riscoDesc = document.getElementById('maDeepPiRiscoDesc');
        const riscoBar = document.getElementById('maDeepPiRiscoBar');
        if (riscoEl) {
            const riscoPct = stats.totalOps > 0 ? (exercCount / stats.totalOps * 100) : 0;
            riscoEl.textContent = riscoPct.toFixed(0) + '%';
            if (riscoDesc) riscoDesc.textContent = exercCount + ' de ' + stats.totalOps + ' operações exercidas';
            if (riscoBar) {
                riscoBar.style.width = Math.min(100, riscoPct) + '%';
                riscoBar.style.background = riscoPct > 50 ? '#f87171' : riscoPct > 25 ? '#fb923c' : '#4ade80';
            }
        }

        const acertoEl = document.getElementById('maDeepPiAcerto');
        const acertoDesc = document.getElementById('maDeepPiAcertoDesc');
        const acertoBar = document.getElementById('maDeepPiAcertoBar');
        if (acertoEl) {
            acertoEl.textContent = stats.winRate.toFixed(0) + '%';
            if (acertoDesc) acertoDesc.textContent = stats.wins + ' de ' + stats.totalOps + ' operações lucrativas';
            if (acertoBar) {
                acertoBar.style.width = Math.min(100, stats.winRate) + '%';
                acertoBar.style.background = stats.winRate >= 50 ? '#4ade80' : '#f87171';
            }
        }

        const recupEl = document.getElementById('maDeepPiRecup');
        const recupDesc = document.getElementById('maDeepPiRecupDesc');
        const recupBar = document.getElementById('maDeepPiRecupBar');
        if (recupEl) {
            const recupPct = investInicial > 0 ? Math.min(100, Math.abs(stats.totalResult) / investInicial * 100) : 0;
            recupEl.textContent = recupPct.toFixed(1) + '%';
            if (recupDesc) recupDesc.textContent = stats.totalResult >= 0 ? 'Carteira acima do investimento' : 'Necessita ' + fmtAmountShort(Math.abs(stats.totalResult)) + ' para recuperar';
            if (recupBar) {
                recupBar.style.width = Math.min(100, recupPct) + '%';
                recupBar.style.background = recupPct >= 100 ? '#4ade80' : '#fbbf24';
            }
        }

        const recList = document.getElementById('maDeepRecList');
        if (recList) {
            const recs = [];
            if (stats.winRate < 50) recs.push('<strong style="color:#f87171">Taxa de acerto abaixo de 50%</strong> — revise critérios de entrada');
            if (stats.totalResult < 0) recs.push('<strong style="color:#f87171">Resultado negativo</strong> — considere reduzir exposição ou ajustar strikes');
            if (exercCount > stats.totalOps * 0.5) recs.push('<strong style="color:#fb923c">Muitas exercidas</strong> — ajuste strikes para OTM');
            if (stats.winRate >= 70) recs.push('<strong style="color:#4ade80">Boa taxa de acerto</strong> — mantenha a estratégia atual');
            if (stats.totalResult > 0 && stats.winRate >= 50) recs.push('<strong style="color:#4ade80">Performance positiva</strong> — considere aumentar position sizing gradualmente');
            if (recs.length === 0) recs.push('<strong style="color:#94a3b8">Performance within expected parameters</strong>');
            recList.innerHTML = recs.map(r => '<li>' + r + '</li>').join('');
        }

        const resumoText = document.getElementById('maDeepResumoText');
        const resumoAcerto = document.getElementById('maDeepResumoAcerto');
        const resumoRisco = document.getElementById('maDeepResumoRisco');
        if (resumoText) {
            resumoText.textContent = stats.totalResult >= 0
                ? 'Carteira com performance positiva no período'
                : 'Carteira com prejuízo — revisar estratégia';
        }
        if (resumoAcerto) resumoAcerto.textContent = stats.winRate.toFixed(0) + '%';
        if (resumoRisco) resumoRisco.textContent = (exercCount > 0 ? exercCount + ' exercidas' : 'nenhuma exercida');
    }

    /* ------------------------------------------------------------------ */
    /* Inicialização                                                        */
    /* ------------------------------------------------------------------ */
    document.addEventListener('layoutReady', () => {
        setupTriggers();
    });

    window.addEventListener('load', () => {
        setupTriggers();
    });

    /* Expõe publicamente */
    window.ModalAnalise = { open: openModal, configure: configure };

}());

/* ============================================================================
   simulador.js — Tela Simulador (The Wheel)
   Duas views na mesma página:
     1) LISTA: universo filtrado (preço máximo + periodicidade + busca) com
        prêmios reais, gráfico, painel de cadeia por clique na linha e link
        "Simular" por ativo;
     2) STRIKES: tela de simulação do ativo escolhido — sliders de prazo,
        distância mín/máx e delta máximo, presets de perfil, KPIs da opção
        selecionada (prêmio, % sobre o saldo da corretora, anualizado, PoP,
        break-even) e a tabela "Strikes candidatos".
    Fluxo de dados: status → universo (cotações) → prêmios em lote →
    /conta (saldo) → /strikes (cotação de todos os strikes + métricas).
    Todos os dados de preço/prêmio vêm da API tastytrade via backend.
   ========================================================================== */
(function () {
    'use strict';

    const MAX_POR_RODADA = 15;   // limite do endpoint /premios (definido no backend)
    const DIST_PADRAO     = 5.0; // distancia_pct padrão das chamadas /premios e /cadeia

    // Presets de perfil (distância % e delta máximo) — inspirados no
    // protótipo ideias/scannerTotal-claude.html
    const PRESETS = {
        conservador: { distMin: 3,   distMax: 6,  deltaMax: 0.20 },
        equilibrado: { distMin: 2,   distMax: 8,  deltaMax: 0.30 },
        agressivo:   { distMin: 1,   distMax: 15, deltaMax: 0.45 },
    };

    const ROTULOS_TIPO = {
        diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal',
        trimestral: 'Trimestral', regular: 'Regular',
    };

    const estado = {
        view:       'lista',     // 'lista' | 'simulacao'
        status:     null,
        universo:   [],          // itens dentro do limite (com cotação real)
        premios:    {},          // símbolo → linha de /premios
        acaoRef:    '',          // ativo escolhido na lista
        busca:      '',
        periodicidade: 'todas',  // 'todas' | 'diario' | 'semanal' | 'mensal'

        // ── Tela de strikes ──
        strikes:     null,       // resposta de /strikes
        vencimentos: [],         // vencimentos do ativo (respuesta /strikes)
        vencIdx:     0,          // índice do vencimento escolhido no slider
        strikeSel:   null,       // strike selecionado na tabela (número)
        saldo:       null,       // saldo da corretora (US$)
        origemSaldo: null,       // 'tastytrade' | 'configuracao'
        params: {
            tipo:      'PUT',
            distMin:   2.0,
            distMax:   8.0,
            deltaMax:  0.30,
            hv:        50,
            fill:      'mid',
            contratos: 1,
            comissao:  1.0,
        },

        executando: false,
        pendente:   false,
    };

    const $ = (id) => document.getElementById(id);

    // DataTable da lista de candidatos (paginado + ordenável)
    let dtLista = null;
    // Gráfico do universo (Chart.js)
    let chartUniverso = null;
    // Sequências de controle: descarta respostas atrasadas
    let seqStrikes = 0;
    let seqCadeia  = 0;

    // ─── Formatação ────────────────────────────────────────────────────────
    function usd(n, casas = 2) {
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        return 'US$ ' + Number(n).toLocaleString('pt-BR', {
            minimumFractionDigits: casas, maximumFractionDigits: casas,
        });
    }
    function pct(n, casas = 2) {
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        const v = Number(n);
        return v.toLocaleString('pt-BR', {
            minimumFractionDigits: casas, maximumFractionDigits: casas,
        }) + '%';
    }
    function pctSinal(n, casas = 2) {
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        const v = Number(n);
        return (v > 0 ? '+' : '') + pct(v, casas);
    }
    function corValor(n) {
        if (n === null || n === undefined || isNaN(Number(n))) return '';
        return Number(n) >= 0 ? 'text-success' : 'text-danger';
    }
    function pillDividendos(d) {
        if (d === true)  return '<span class="sim-pill sim-pill-yes">SIM</span>';
        if (d === false) return '<span class="sim-pill sim-pill-no">NÃO</span>';
        return '<span class="sim-pill sim-pill-unk">N/D</span>';
    }
    function fmtData(iso) {
        if (!iso) return '—';
        const [a, m, d] = String(iso).split('-');
        return `${d}/${m}/${a}`;
    }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ─── Infra ─────────────────────────────────────────────────────────────
    async function api(caminho, opcoes) {
        const resp = await fetch(caminho, opcoes);
        let corpo = null;
        try { corpo = await resp.json(); } catch (_) { /* respostas sem JSON */ }
        if (!resp.ok || (corpo && corpo.success === false)) {
            throw new Error((corpo && (corpo.message || corpo.error)) || ('HTTP ' + resp.status));
        }
        return corpo;
    }

    function setLoading(on) {
        const el = $('simLoading');
        if (el) el.classList.toggle('sim-on', !!on);
    }

    function toastErro(titulo, mensagem) {
        if (typeof iziToast !== 'undefined') {
            iziToast.error({ title: titulo, message: String(mensagem).slice(0, 300) });
        } else {
            console.error(titulo, mensagem);
        }
    }

    function toastAviso(titulo, mensagem) {
        if (typeof iziToast !== 'undefined') {
            iziToast.warning({ title: titulo, message: String(mensagem).slice(0, 300) });
        } else {
            console.warn(titulo, mensagem);
        }
    }

    function debounce(fn, ms) {
        let t = null;
        return function () {
            const args = arguments;
            clearTimeout(t);
            t = setTimeout(() => fn.apply(null, args), ms);
        };
    }

    function chunk(lista, tamanho) {
        const partes = [];
        for (let i = 0; i < lista.length; i += tamanho) {
            partes.push(lista.slice(i, i + tamanho));
        }
        return partes;
    }

    // ─── Troca de view (lista ⇄ simulação) ─────────────────────────────────
    function abrirView(nome) {
        estado.view = nome;
        const lista = $('viewLista');
        const sim   = $('viewSimulacao');
        if (nome === 'simulacao') {
            lista.classList.add('d-none');
            sim.classList.remove('d-none');
            $('btnSimularTexto').textContent = 'Atualizar';
            $('simSubtitulo').textContent =
                'Simulação de strikes com prêmios reais da cadeia tastytrade';
        } else {
            sim.classList.add('d-none');
            lista.classList.remove('d-none');
            $('btnSimularTexto').textContent = 'Atualizar lista';
            $('simSubtitulo').textContent =
                'Selecione um ativo para simular a abertura de operação';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ─── Status da integração ──────────────────────────────────────────────
    async function carregarStatus() {
        const s = await api(API_BASE + '/api/simulador/status');
        estado.status = s;

        const badge = $('simStatusBadge');
        if (s.configurado) {
            badge.className = 'badge bg-green-lt';
            badge.textContent = 'tastytrade conectado';
        } else {
            badge.className = 'badge bg-yellow-lt';
            badge.textContent = 'credenciais incompletas';
        }
        $('simStatusDetalhe').textContent =
            `${s.ambiente} · ${s.base_url.replace('https://', '')}`;

        // Aviso claro enquanto o refresh token não estiver preenchido
        const aviso = $('simAvisoConfig');
        if (!s.configurado) {
            const faltando = [];
            if (!s.tem_client_id)      faltando.push('TASTYTRADE_CLIENT_ID');
            if (!s.tem_client_secret)  faltando.push('TASTYTRADE_CLIENT_SECRET');
            if (!s.tem_refresh_token)  faltando.push('TASTYTRADE_REFRESH_TOKEN');
            $('simAvisoConfigTexto').textContent =
                ' Preencha ' + faltando.join(', ') + ' em backend/.env ' +
                '(my.tastytrade.com → Manage → My Profile → API → OAuth Applications → Create Grant). ' +
                'Até lá nenhuma cotação é retornada — a tela não usa dados fictícios.';
            aviso.classList.remove('d-none');
        } else {
            aviso.classList.add('d-none');
        }

        // Preço máximo por ação: default do backend (uma única vez)
        if (s.limites) {
            $('sliderMaxAcao').value = s.limites.limite_acao;
            $('lblMaxAcao').textContent = usd(s.limites.limite_acao);
        }
        return s;
    }

    // ─── Saldo da corretora (GET /conta) ───────────────────────────────────
    async function carregarConta() {
        try {
            const r = await api(API_BASE + '/api/simulador/conta');
            estado.saldo      = r.saldo;
            estado.origemSaldo = r.origem;
        } catch (e) {
            console.warn('Sem saldo da conta:', e.message);
        }
        renderSaldo();
    }

    function renderSaldo() {
        let txt;
        if (estado.saldo != null) {
            const origem = estado.origemSaldo === 'tastytrade' ? 'tastytrade'
                : (estado.origemSaldo === 'configuracao' ? 'configuração' : '');
            txt = origem ? `${usd(estado.saldo)} (${origem})` : usd(estado.saldo);
        } else {
            txt = 'não informado — cadastre em Opções → Configurações';
        }
        if ($('txtSaldo'))   $('txtSaldo').textContent = txt;
        if ($('selSaldo'))   $('selSaldo').textContent =
            estado.saldo != null ? `saldo ${usd(estado.saldo)}` : 'saldo não informado';
        // KPI "% sobre saldo" depende do saldo
        renderKpis();
    }

    // ─── Universo (cotações reais filtradas pelo preço máximo) ─────────────
    async function carregarUniverso() {
        const maxPreco = parseFloat($('sliderMaxAcao').value);
        $('lblMaxAcao').textContent = usd(maxPreco);

        const r = await api(
            `${API_BASE}/api/simulador/universo?max_preco=${maxPreco}&max_lote=${maxPreco * 100}`
        );
        estado.universo = r.itens || [];
        $('txtUniverso').textContent =
            `${estado.universo.length} ativos de ${r.total_considerados || 0} consultados` +
            (r.sem_cotacao && r.sem_cotacao.length ? ` · sem cotação: ${r.sem_cotacao.join(', ')}` : '');

        renderMetricsUniverso();
        renderTabelaLista();
        renderGraficoUniverso();
    }

    // Itens visíveis conforme o seletor de periodicidade (diárias/semanais/
    // mensais). Itens ainda sem prêmio carregado passam pelo filtro (aparecem
    // assim que /premios responder).
    function universoFiltrado() {
        if (estado.periodicidade === 'todas') return estado.universo;
        return estado.universo.filter((i) => {
            const p = estado.premios[i.simbolo];
            if (!p) return true;
            return !!p['tem_vencimento_' + estado.periodicidade];
        });
    }

    function renderMetricsUniverso() {
        const itens = universoFiltrado();
        $('mtrAtivos').textContent = itens.length;
        if ($('countLabel')) $('countLabel').textContent = `${itens.length} ativo(s)`;
        if (!itens.length) {
            $('mtrMenorPreco').textContent = '—';
            $('mtrCapitalMin').textContent = '—';
            return;
        }
        const menor = Math.min(...itens.map((i) => Number(i.preco)));
        $('mtrMenorPreco').textContent = usd(menor);
        $('mtrCapitalMin').textContent = usd(menor * 100);
    }

    // ─── Gráfico do universo (Chart.js) ────────────────────────────────────
    function renderGraficoUniverso() {
        const el = $('chartUniverso');
        if (!el) return;
        if (typeof Chart === 'undefined') {
            // Biblioteca ainda carregando: tenta de novo quando terminar
            document.addEventListener('libsLoaded', renderGraficoUniverso, { once: true });
            return;
        }

        const itens = universoFiltrado();
        const dados = {
            labels: itens.map((i) => i.simbolo),
            datasets: [
                {
                    label: 'Preço (US$)',
                    data: itens.map((i) => Number(i.preco)),
                    backgroundColor: 'rgba(59, 130, 246, .70)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    yAxisID: 'y',
                    order: 2,
                },
                {
                    label: 'Capital/lote (US$)',
                    data: itens.map((i) => Number(i.capital_lote)),
                    backgroundColor: 'rgba(22, 179, 100, .45)',
                    borderColor: '#16b364',
                    borderWidth: 1,
                    yAxisID: 'y1',
                    order: 1,
                },
            ],
        };

        if (chartUniverso) {
            chartUniverso.data = dados;
            chartUniverso.update();
            return;
        }

        chartUniverso = new Chart(el, {
            type: 'bar',
            data: dados,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#8299c2', font: { size: 10 }, boxWidth: 12, padding: 10 },
                    },
                    tooltip: {
                        callbacks: { label: (c) => `${c.dataset.label}: ${usd(c.parsed.y)}` },
                    },
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#8299c2', font: { size: 9 },
                            maxRotation: 60, minRotation: 45, autoSkip: true,
                        },
                        grid: { color: 'rgba(38, 57, 87, .45)' },
                    },
                    y: {
                        position: 'left',
                        ticks: { color: '#3b82f6', font: { size: 9 }, callback: (v) => 'US$ ' + v },
                        grid: { color: 'rgba(38, 57, 87, .45)' },
                    },
                    y1: {
                        position: 'right',
                        ticks: {
                            color: '#16b364', font: { size: 9 },
                            callback: (v) => (v >= 1000 ? (v / 1000) + 'k' : v),
                        },
                        grid: { drawOnChartArea: false },
                    },
                },
            },
        });
    }

    // ─── Prêmios em lote (rodadas de 15 — limite da API) ──────────────────
    async function carregarPremios() {
        const alvos = estado.universo.map((i) => i.simbolo);
        if (!alvos.length) {
            estado.premios = {};
            renderTabelaLista();
            return;
        }
        const pendentes = alvos.filter((s) => !estado.premios[s]);
        const rodadas  = chunk(pendentes, MAX_POR_RODADA);
        const erros    = [];

        for (const rodada of rodadas) {
            try {
                const r = await api(
                    `${API_BASE}/api/simulador/premios?simbolos=${encodeURIComponent(rodada.join(','))}` +
                    `&distancia_pct=${DIST_PADRAO}`
                );
                (r.itens || []).forEach((i) => { estado.premios[i.simbolo] = i; });
                (r.erros || []).forEach((e) => erros.push(e.simbolo));
            } catch (e) {
                // falha em uma rodada não derruba a lista inteira
                erros.push(...rodada);
                console.warn('Falha ao carregar prêmios:', e.message);
            }
        }

        // Remove do cache prêmios de ativos que saíram do universo filtrado
        Object.keys(estado.premios).forEach((s) => {
            if (!alvos.includes(s)) delete estado.premios[s];
        });

        renderMetricsUniverso();
        renderTabelaLista();
        renderGraficoUniverso();
        return erros;
    }

    // Garante prêmio de um símbolo específico (ex.: ativo escolhido fora das rodadas)
    async function garantirPremio(simbolo) {
        if (estado.premios[simbolo]) return;
        try {
            const r = await api(
                `${API_BASE}/api/simulador/premios?simbolos=${encodeURIComponent(simbolo)}` +
                `&distancia_pct=${DIST_PADRAO}`
            );
            (r.itens || []).forEach((i) => { estado.premios[i.simbolo] = i; });
        } catch (e) {
            console.warn(`Sem prêmio para ${simbolo}:`, e.message);
        }
    }

    // ─── Lista de ativos (view 1 — DataTable paginado/ordenável) ───────────
    function initDataTable() {
        if (dtLista || typeof jQuery === 'undefined' || !jQuery.fn.DataTable) return;
        // O <tbody> começa com uma linha "Carregando..." (colspan) que o
        // DataTables não consegue mapear em colunas — limpa antes de iniciar.
        const corpo = document.getElementById('tblListaBody');
        if (corpo) corpo.innerHTML = '';
        dtLista = jQuery('#tblLista').DataTable({
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json' },
            pageLength: 10,
            lengthMenu: [10, 25, 50, 100],
            responsive: false,
            scrollX: true,
            order: [[9, 'desc']],          // rentabilidade diária (maior primeiro)
            columnDefs: [
                { targets: 10, orderable: false, searchable: false },  // coluna "Simular"
                { targets: '_all', searchable: true },
            ],
            columns: [
                { data: 'simbolo', render: (v) => `<strong>${esc(v)}</strong>` },
                { data: 'preco', render: (v) => usd(v), className: 'num' },
                { data: 'capital_lote', render: (v) => usd(v), className: 'num' },
                { data: 'variacao', className: 'num',
                  render: (v) => `<span class="${corValor(v)}">${pctSinal(v)}</span>` },
                { data: 'dividendos', render: (v) => pillDividendos(v) },
                { data: 'premio_call', render: (v) => usd(v), className: 'num' },
                { data: 'premio_put', render: (v) => usd(v), className: 'num' },
                { data: 'venc_sem', render: (v) => fmtData(v) },
                { data: 'dias', className: 'num' },
                { data: 'rentab', render: (v) => pct(v, 4), className: 'num' },
                // Sem fonte de dados: o conteúdo vem do objeto da linha
                { data: null, orderable: false, searchable: false,
                  render: (v, tipo, linha) =>
                    `<a href="#" class="sim-link" data-simbolo="${esc(linha.simbolo)}">Simular</a>` },
            ],
        });
    }

    function rentabDiariaEstimada(item, premio) {
        const dias = premio && premio.dias_semanal;
        const sem  = premio && premio.premio_semanal_put;
        const cap  = Number(item.capital_lote);
        if (!dias || sem == null || !cap) return null;
        return (Number(sem) / Number(dias)) / cap * 100;
    }

    function renderTabelaLista() {
        initDataTable();
        const itens = universoFiltrado();
        renderMetricsUniverso();

        const linhas = itens.map((item) => {
            const p = estado.premios[item.simbolo] || {};
            return {
                simbolo:      item.simbolo,
                preco:        item.preco,
                capital_lote: item.capital_lote,
                variacao:     item.variacao_dia_pct,
                dividendos:   item.dividendos ? item.dividendos.paga : null,
                premio_call:  p.premio_semanal_call ?? null,
                premio_put:   p.premio_semanal_put ?? null,
                venc_sem:     p.vencimento_semanal ?? null,
                dias:         p.dias_semanal ?? null,
                rentab:       rentabDiariaEstimada(item, p),
            };
        });

        if (!dtLista) {
            // DataTable indisponível: fallback com a tabela simples
            $('tblListaBody').innerHTML = linhas.length
                ? linhas.map((l) => `
                    <tr>
                        <td><strong>${esc(l.simbolo)}</strong></td>
                        <td class="num">${usd(l.preco)}</td>
                        <td class="num">${usd(l.capital_lote)}</td>
                        <td class="num ${corValor(l.variacao)}">${pctSinal(l.variacao)}</td>
                        <td>${pillDividendos(l.dividendos)}</td>
                        <td class="num">${usd(l.premio_call)}</td>
                        <td class="num">${usd(l.premio_put)}</td>
                        <td>${fmtData(l.venc_sem)}</td>
                        <td class="num">${l.dias ?? '—'}</td>
                        <td class="num">${pct(l.rentab, 4)}</td>
                        <td><a href="#" class="sim-link" data-simbolo="${esc(l.simbolo)}">Simular</a></td>
                    </tr>`).join('')
                : '<tr><td colspan="11" class="text-muted">Nenhum ativo dentro dos limites informados.</td></tr>';
            return;
        }

        dtLista.clear();
        dtLista.rows.add(linhas);
        if (estado.busca) dtLista.search(estado.busca);
        dtLista.draw();
    }

    // ─── Painel de cadeia (coluna direita da lista) ────────────────────────
    async function verCadeia(simbolo) {
        if (!simbolo) return;
        const meu = ++seqCadeia;
        setLoading(true);
        try {
            await garantirPremio(simbolo);
            const r = await api(
                `${API_BASE}/api/simulador/cadeia?simbolo=${encodeURIComponent(simbolo)}` +
                `&distancia_pct=${DIST_PADRAO}`
            );
            if (meu !== seqCadeia) return;
            renderCadeiaLateral(simbolo, r);
        } catch (e) {
            if (meu !== seqCadeia) return;
            $('simSelAtivo').innerHTML =
                `<strong>${esc(simbolo)}</strong><small>sem cadeia de opções</small>`;
            $('simCadeia').innerHTML = `<div class="sim-empty">${esc(e.message)}</div>`;
        } finally {
            if (meu === seqCadeia) setLoading(false);
        }
    }

    function renderCadeiaLateral(simbolo, r) {
        const item   = estado.universo.find((i) => i.simbolo === simbolo);
        const lista  = (r && r.expiracoes) || [];
        $('simSelAtivo').innerHTML =
            `<strong>${esc(simbolo)}</strong> · ${usd(item ? item.preco : r.preco)}` +
            `<small>${lista.length} vencimento(s) na cadeia tastytrade</small>`;
        $('simCadeia').innerHTML = lista.length
            ? lista.map((e) => {
                const c = (e.call && e.call.premio != null) ? usd(e.call.premio) : '—';
                const p = (e.put && e.put.premio != null) ? usd(e.put.premio) : '—';
                const rotulo = ROTULOS_TIPO[e.tipo] || e.tipo;
                return `<div class="sim-chainrow">
                    <span class="sim-when">${fmtData(e.data)}</span>
                    <span class="sim-what">${e.dias}d · ${esc(rotulo)}</span>
                    <span class="sim-money">C ${c} · P ${p}</span>
                </div>`;
            }).join('')
            : '<div class="sim-empty">Nenhum vencimento listado.</div>';
    }

    // ─── Resumo do ativo (topo da view 2) ──────────────────────────────────
    function selecionarResumo(simbolo) {
        const item = estado.universo.find((i) => i.simbolo === simbolo);
        $('selTicker').textContent = simbolo || '—';
        $('selPreco').textContent  = item ? usd(item.preco) : '—';
        $('selCapital').textContent = item ? `lote ${usd(item.capital_lote)}` : '';
        $('selVariacao').innerHTML = item
            ? `dia <span class="${corValor(item.variacao_dia_pct)}">${pctSinal(item.variacao_dia_pct)}</span>`
            : '';
        $('selDividendos').innerHTML = item
            ? pillDividendos(item.dividendos ? item.dividendos.paga : null)
            : '';
        renderSaldo();
    }

    // ─── Abre a simulação (view 2) com o ativo escolhido na lista ─────────
    async function abrirSimulacao(simbolo) {
        if (!simbolo) return;
        simbolo = String(simbolo).toUpperCase();
        setLoading(true);
        try {
            // Ativo fora do filtro atual (ex.: vindo por URL) → busca a cotação real
            if (!estado.universo.some((i) => i.simbolo === simbolo)) {
                try {
                    const r = await api(
                        `${API_BASE}/api/simulador/universo?simbolos=${encodeURIComponent(simbolo)}`
                    );
                    (r.itens || []).forEach((i) => {
                        if (!estado.universo.some((u) => u.simbolo === i.simbolo)) {
                            estado.universo.push(i);
                        }
                    });
                } catch (_) { /* segue com o que houver */ }
            }

            // garante que o ativo escolhido tenha prêmio carregado
            await garantirPremio(simbolo);

            estado.acaoRef   = simbolo;
            estado.strikeSel = null;

            selecionarResumo(simbolo);
            abrirView('simulacao');
            history.replaceState(null, '', `${location.pathname}?ativo=${encodeURIComponent(simbolo)}`);

            await Promise.all([carregarConta(), carregarStrikes(true)]);
        } catch (e) {
            toastErro('Erro ao abrir a simulação', e.message);
        } finally {
            setLoading(false);
        }
    }

    function voltarParaLista() {
        abrirView('lista');
        history.replaceState(null, '', location.pathname);
        renderTabelaLista();
    }

    // ─── Strikes (GET /api/simulador/strikes) ──────────────────────────────
    function vencimentoEscolhido() {
        const v = estado.vencimentos[estado.vencIdx];
        return v ? v.data : '';
    }

    function renderLblVenc() {
        const v = estado.vencimentos[estado.vencIdx];
        $('lblVenc').textContent = v
            ? `${v.dias}d · ${fmtData(v.data)} · ${ROTULOS_TIPO[v.tipo] || v.tipo}`
            : '—';
    }

    async function carregarStrikes(resetVenc) {
        if (!estado.acaoRef) return;
        const meu = ++seqStrikes;
        const p = estado.params;

        let url = `${API_BASE}/api/simulador/strikes?simbolo=${encodeURIComponent(estado.acaoRef)}` +
            `&tipo=${encodeURIComponent(p.tipo)}` +
            `&dist_min=${p.distMin}&dist_max=${p.distMax}&delta_max=${p.deltaMax}` +
            `&hv=${p.hv}&fill=${encodeURIComponent(p.fill)}` +
            `&contratos=${p.contratos}&comissao=${p.comissao}`;
        if (!resetVenc && vencimentoEscolhido()) {
            url += `&vencimento=${encodeURIComponent(vencimentoEscolhido())}`;
        }

        setLoading(true);
        try {
            const r = await api(url);
            if (meu !== seqStrikes) return;
            estado.strikes = r;

            // Lista de vencimentos para o slider (primeira carga ou novo ativo)
            if (resetVenc || !estado.vencimentos.length) {
                estado.vencimentos = r.vencimentos || [];
                const idx = estado.vencimentos.findIndex((v) => v.data === (r.vencimento || {}).data);
                estado.vencIdx = idx >= 0 ? idx : 0;
                const rng = $('rngVenc');
                rng.max = Math.max(0, estado.vencimentos.length - 1);
                rng.value = estado.vencIdx;
                renderLblVenc();
            }

            renderStrikes();
        } catch (e) {
            if (meu !== seqStrikes) return;
            estado.strikes = null;
            $('tblStrikesBody').innerHTML =
                `<tr><td colspan="12" class="text-muted">${esc(e.message)}</td></tr>`;
            $('lblStrikesCount').textContent = '';
            $('txtStrikes').textContent = '';
        } finally {
            if (meu === seqStrikes) setLoading(false);
        }
    }

    function renderStrikes() {
        const r = estado.strikes;
        const linhas = (r && r.strikes) || [];
        $('lblStrikesCount').textContent = linhas.length
            ? `— ${linhas.length} de ${r.total_strikes} strikes cotados`
            : '';

        $('tblStrikesBody').innerHTML = linhas.length
            ? linhas.map((l) => `
                <tr data-strike="${l.strike}" class="${estado.strikeSel === l.strike ? 'sim-row-sel' : ''}">
                    <td><strong>${esc(l.strike)}</strong></td>
                    <td class="num">${pct(l.dist, 2)}</td>
                    <td class="num">${l.bid != null ? esc(l.bid) : '—'} / ${l.ask != null ? esc(l.ask) : '—'}</td>
                    <td class="num">${usd(l.premio)}</td>
                    <td class="num">${pct(l.iv != null ? l.iv * 100 : null, 1)}</td>
                    <td class="num">${l.delta != null ? esc(l.delta) : '—'}</td>
                    <td class="num">${pct(l.pop != null ? l.pop * 100 : null, 1)}</td>
                    <td class="num">${usd(l.breakeven)}</td>
                    <td class="num">${usd(l.capital)}</td>
                    <td class="num">${pct(l.roc != null ? l.roc * 100 : null, 3)}</td>
                    <td class="num">${pct(l.anualizado != null ? l.anualizado * 100 : null, 2)}</td>
                    <td class="num ${corValor(l.ev)}">${usd(l.ev)}</td>
                </tr>`).join('')
            : `<tr><td colspan="12" class="text-muted">Nenhum strike dentro dos filtros informados.</td></tr>`;

        const params = (r && r.parametros) || {};
        $('txtStrikes').textContent = r
            ? `${r.simbolo} · ${usd(r.preco)} · vencimento ${fmtData(r.vencimento && r.vencimento.data)} ` +
              `(${r.vencimento && r.vencimento.dias}d) · filtros: distância ${params.dist_min}%–${params.dist_max}% · ` +
              `delta ≤ ${params.delta_max} · HV ${params.hv}% · fill ${params.fill} · fonte tastytrade (sem mock).`
            : '';

        // Seleção: mantém o strike escolhido ou usa o primeiro da lista
        if (!linhas.some((l) => l.strike === estado.strikeSel)) {
            estado.strikeSel = linhas.length ? linhas[0].strike : null;
        }
        renderStrikesSelecao();
    }

    function renderStrikesSelecao() {
        const linhas = ((estado.strikes || {}).strikes) || [];
        const linha  = linhas.find((l) => l.strike === estado.strikeSel) || null;

        document.querySelectorAll('#tblStrikesBody tr[data-strike]').forEach((tr) => {
            tr.classList.toggle('sim-row-sel',
                linha != null && Number(tr.getAttribute('data-strike')) === linha.strike);
        });

        renderKpis(linha);

        $('txtSelStrike').innerHTML = linha
            ? `<strong>${estado.acaoRef}</strong> · strike <strong>${esc(linha.strike)}</strong> ` +
              `(${pct(linha.dist, 2)} de distância) · ${estado.params.tipo} · ` +
              `vencimento ${fmtData((estado.strikes.vencimento || {}).data)} — ` +
              `capital de ${usd(linha.capital)} por contrato.`
            : 'Clique numa linha da tabela para ver os dados da opção.';
    }

    function renderKpis(linha) {
        if (!linha) {
            $('kpiPremio').textContent     = '—';
            $('kpiSaldoPct').textContent   = '—';
            $('kpiAnual').textContent      = '—';
            $('kpiPop').textContent        = '—';
            $('kpiBreakeven').textContent  = '—';
            return;
        }

        $('kpiPremio').textContent    = usd(linha.premio);
        $('kpiAnual').textContent     = pct(linha.anualizado != null ? linha.anualizado * 100 : null, 2);
        $('kpiPop').textContent       = pct(linha.pop != null ? linha.pop * 100 : null, 1);
        $('kpiBreakeven').textContent = usd(linha.breakeven);

        // % do prêmio (total dos contratos) sobre o saldo da corretora
        const saldo = Number(estado.saldo);
        const total = Number(linha.premio) * 100 * estado.params.contratos;
        $('kpiSaldoPct').textContent =
            (saldo > 0 && isFinite(total)) ? pct(total / saldo * 100, 3) : '—';
    }

    const strikesComDebounce = debounce(() => carregarStrikes(), 350);

    // ─── Encadeamento ──────────────────────────────────────────────────────
    async function atualizarLista() {
        try {
            setLoading(true);
            await carregarUniverso();
            await carregarPremios();
        } catch (e) {
            toastErro('Erro ao consultar a tastytrade', e.message);
            $('tblListaBody').innerHTML =
                `<tr><td colspan="11" class="text-muted">Falha ao consultar a API: ${esc(e.message)}</td></tr>`;
        } finally {
            setLoading(false);
        }
    }

    // Recalcula a simulação atual (sem recarregar a lista inteira)
    async function atualizarSimulacao() {
        if (estado.view !== 'simulacao') return atualizarLista();
        try {
            setLoading(true);
            await carregarUniverso();
            await carregarPremios();
            selecionarResumo(estado.acaoRef);
            await Promise.all([carregarConta(), carregarStrikes(true)]);
        } catch (e) {
            toastErro('Erro ao consultar a tastytrade', e.message);
        } finally {
            setLoading(false);
        }
    }

    // ─── Eventos ───────────────────────────────────────────────────────────
    function bindEvents() {
        // Botão principal: atualiza a lista ou recalcula a simulação
        $('btnSimular').addEventListener('click', function () {
            if (estado.view === 'simulacao') atualizarSimulacao();
            else atualizarLista();
        });

        // Voltar à lista
        $('btnOutraOpcao').addEventListener('click', voltarParaLista);

        // ─── View 1: preço máximo, periodicidade e busca ──────────────────
        $('sliderMaxAcao').addEventListener('input', debounce(atualizarLista, 400));

        $('segPeriodicidade').addEventListener('click', function (ev) {
            const btn = ev.target.closest('[data-per]');
            if (!btn) return;
            estado.periodicidade = btn.getAttribute('data-per');
            this.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
            $('lblPeriodicidade').textContent = btn.textContent;
            renderTabelaLista();
            renderGraficoUniverso();
        });

        $('inpBusca').addEventListener('input', function () {
            estado.busca = this.value;
            if (dtLista) dtLista.search(estado.busca).draw();
            else renderTabelaLista();
        });

        // Tabela da lista (delegação):
        //  · link "Simular" → abre a simulação do ativo
        //  · clique na linha → mostra a cadeia de opções no painel lateral
        $('tblListaBody').addEventListener('click', function (ev) {
            const link = ev.target.closest('[data-simbolo]');
            if (link) {
                ev.preventDefault();
                abrirSimulacao(link.getAttribute('data-simbolo'));
                return;
            }
            const tr = ev.target.closest('tr');
            if (!tr) return;
            const td = tr.querySelector('td');
            if (!td || td.colSpan > 1) return;
            const ticker = (td.textContent || '').trim();
            if (!ticker) return;
            document.querySelectorAll('#tblListaBody tr.sim-row-sel')
                .forEach((r) => r.classList.remove('sim-row-sel'));
            tr.classList.add('sim-row-sel');
            verCadeia(ticker);
        });

        // ─── View 2: filtros de strikes ───────────────────────────────────
        $('rngVenc').addEventListener('input', function () {
            estado.vencIdx = Number(this.value) || 0;
            renderLblVenc();
            strikesComDebounce();
        });

        $('rngDistMin').addEventListener('input', function () {
            estado.params.distMin = Number(this.value);
            $('lblDistMin').textContent = pct(estado.params.distMin, 1);
            if (estado.params.distMin >= estado.params.distMax) {
                estado.params.distMax = estado.params.distMin + 0.5;
                $('rngDistMax').value = estado.params.distMax;
                $('lblDistMax').textContent = pct(estado.params.distMax, 1);
            }
            marcarPresetCustom();
            strikesComDebounce();
        });

        $('rngDistMax').addEventListener('input', function () {
            estado.params.distMax = Number(this.value);
            $('lblDistMax').textContent = pct(estado.params.distMax, 1);
            if (estado.params.distMax <= estado.params.distMin) {
                estado.params.distMin = Math.max(0, estado.params.distMax - 0.5);
                $('rngDistMin').value = estado.params.distMin;
                $('lblDistMin').textContent = pct(estado.params.distMin, 1);
            }
            marcarPresetCustom();
            strikesComDebounce();
        });

        $('rngDelta').addEventListener('input', function () {
            estado.params.deltaMax = Number(this.value);
            $('lblDelta').textContent = estado.params.deltaMax.toLocaleString('pt-BR', {
                minimumFractionDigits: 2, maximumFractionDigits: 2,
            });
            marcarPresetCustom();
            strikesComDebounce();
        });

        // Presets de perfil (Conservador / Equilibrado / Agressivo)
        $('segPreset').addEventListener('click', function (ev) {
            const btn = ev.target.closest('[data-preset]');
            if (!btn) return;
            aplicarPreset(btn.getAttribute('data-preset'));
        });

        // Controles de execução
        $('selTipo').addEventListener('change', function () {
            estado.params.tipo = this.value.toUpperCase();
            estado.strikeSel = null;
            carregarStrikes();
        });

        $('segFill').addEventListener('click', function (ev) {
            const btn = ev.target.closest('[data-fill]');
            if (!btn) return;
            estado.params.fill = btn.getAttribute('data-fill');
            this.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
            strikesComDebounce();
        });

        $('inpContratos').addEventListener('input', function () {
            const v = parseInt(this.value, 10);
            estado.params.contratos = v > 0 ? v : 1;
            strikesComDebounce();
        });

        $('inpComissao').addEventListener('input', function () {
            const v = parseFloat(this.value);
            estado.params.comissao = isNaN(v) || v < 0 ? 0 : v;
            strikesComDebounce();
        });

        $('inpHv').addEventListener('input', function () {
            const v = parseFloat(this.value);
            estado.params.hv = isNaN(v) || v <= 0 ? 50 : v;
            strikesComDebounce();
        });

        // Clique numa linha da tabela → KPIs da opção escolhida
        $('tblStrikesBody').addEventListener('click', function (ev) {
            const tr = ev.target.closest('tr[data-strike]');
            if (!tr) return;
            estado.strikeSel = Number(tr.getAttribute('data-strike'));
            renderStrikesSelecao();
        });
    }

    function aplicarPreset(nome) {
        const p = PRESETS[nome];
        if (!p) return;
        Object.assign(estado.params, p);

        $('rngDistMin').value = p.distMin;
        $('rngDistMax').value = p.distMax;
        $('rngDelta').value   = p.deltaMax;
        $('lblDistMin').textContent = pct(p.distMin, 1);
        $('lblDistMax').textContent = pct(p.distMax, 1);
        $('lblDelta').textContent = p.deltaMax.toLocaleString('pt-BR', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        });

        $('segPreset').querySelectorAll('button').forEach((b) => {
            b.classList.toggle('active', b.getAttribute('data-preset') === nome);
        });
        $('lblPreset').textContent = nome.charAt(0).toUpperCase() + nome.slice(1);

        strikesComDebounce();
    }

    // Nenhum preset corresponde aos sliders atuais → limpa o destaque
    function marcarPresetCustom() {
        const atual = { ...estado.params };
        const bate = Object.keys(PRESETS).find((k) =>
            PRESETS[k].distMin === atual.distMin &&
            PRESETS[k].distMax === atual.distMax &&
            PRESETS[k].deltaMax === atual.deltaMax);
        $('segPreset').querySelectorAll('button').forEach((b) => {
            b.classList.toggle('active', b.getAttribute('data-preset') === bate);
        });
        $('lblPreset').textContent = bate
            ? bate.charAt(0).toUpperCase() + bate.slice(1)
            : 'Personalizado';
    }

    // ─── Inicialização ─────────────────────────────────────────────────────
    function init() {
        bindEvents();
        (async () => {
            try {
                await carregarStatus();
            } catch (e) {
                toastErro('Erro ao carregar status', e.message);
            }

            // ?ativo=XYZ → abre direto na simulação daquele ativo
            const ativoUrl = new URLSearchParams(location.search).get('ativo');

            await atualizarLista();

            if (ativoUrl) {
                await abrirSimulacao(ativoUrl.toUpperCase());
            }
        })();
    }

    // Garante inicialização mesmo se layoutReady já disparou antes deste script
    if (window.__appLayoutReady) {
        init();
    } else {
        document.addEventListener('layoutReady', init, { once: true });
    }
})();

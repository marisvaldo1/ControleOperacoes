/* ============================================================================
   simulador.js — Tela Simulador (The Wheel) · v3.6.0
   Reescrita igual ao protótipo ideias/scannerClaude2.html, com dados REAIS
   da tastytrade (zero mock) e interface somente leitura.

   Novidades v3.6.0:
      1) Gráfico da régua de break-even (sc-ruler) REMOVIDO do card
      2) Bandas ±1/±2 SD agora são linhas tracejadas entre as opções, sem
         espaço extra, com o rótulo na borda esquerda (estilo da imagem)
      3) Cadeia com barra de rolagem, todos os strikes disponíveis e a
         fronteira ITM centralizada na tela (barra vermelha/verde no centro)
      4) Loading aparece DENTRO da área de opções ao recarregar
      5) Visualização "cadeia x escada" removida — somente cadeia
      6) Botão "Abrir" fora da tabela do scanner: agora clica-se na linha
      7) Preço, Retorno PUT e Retorno CALL não são mais ordenáveis
      8) Card "Pressione Enter para analisar o ativo direto" removido
      9) Escolha Bid/Mid removida — TODOS os cálculos são pelo BID

   Novidades v3.5.1:
      1) "Exerc./mês" passa a usar os dias REAIS do vencimento selecionado
         (antes usava o filtro DTE do scanner e exibia um número sem
         relação com a opção escolhida)

   Novidades v3.5.0:
      1) Preço de EXECUÇÃO visível e ajustável (Bid | Mid) no scanner e na
         aba do ativo — o padrão agora é o BID, que é o que a corretora paga
         numa venda de opção (o mid inflava o prêmio e o ROC)
      2) Card ganha o bloco "Preço de execução": prêmio e ROC em Bid/Mid/Ask,
         spread e o prêmio MÍNIMO para bater a meta mensal
      3) A cadeia (delta/theta de cada lado) passa a usar o mesmo preço de
         execução do card — antes o card usava o fill e a cadeia usava o mid

   Novidades v3.4.0:
      1) Capital / ROC / Dias deixam de ser pills minúsculas e viram TILES
         grandes (número 26px + legenda), com barra do ROC marcando a meta
         mensal e pontinhos mostrando quantos dias caem no mês atual
      2) Escala "Devo operar?" (termômetro 0–100) com ponteiro, nível de
         5 faixas e as 4 perguntas de decisão respondidas SIM / EM TERMOS /
         NÃO — motor avaliarOpcao() portado de ideias/opcaoSelecionada-Claude
      3) Meta mensal (%) vinda de Configurações › aba Opções
         (chave metaMensalOpcoes, padrão 1,8%) e exibida no cabeçalho
      4) Trocar o filtro DTE NÃO relê /cadeia: o filtro de pregões é local e
         a cadeia não depende do DTE (antes: 1 chamada por passo do slider)
      5) Legenda das faixas ±1/±2 SD explicando o que elas significam

   Novidades v3.3.0:
      1) Tela do ativo em formato "option chain": tabela única com CALLs à
         esquerda, PUTs à direita e o strike no centro
      2) Uma linha por vencimento (accordion fechado por padrão) com dias até
         o vencimento e IVX; só os vencimentos dentro do filtro de pregões
      3) Vencimento aberto mostra theta/delta/bid/ask de cada lado, faixa ITM
         destacada, badges ITM nas fronteiras e linhas de ±1/±2 desvios
      4) Backend: /strikes?tipo=ALL devolve os dois lados cotados numa única
         chamada; theta diário no Black-Scholes; IV por vencimento no /cadeia
      5) Colunas da cadeia ordenáveis pelo clique no cabeçalho

   Novidades v3.2.9:
      1) Cartão do contrato em 4 colunas usando toda a largura: herói do
         prêmio + pills (capital/ROC/dias), anel PoP + veredito de decisão,
         métricas (IV e valor justo incluídos) e contexto de decisão
      2) Veredito: margem até break-even, prêmio vs justo (HV) e spread
         bid/ask — insumos diretos para a abertura da operação
      3) fair (valor justo pela HV) passa a vir no payload do card

   Novidades v3.2.8:
     1) Scanner lê os prêmios em 1 ÚNICA chamada /premios com 20 ativos
        (antes: várias chamadas de 15 em 15 cobrindo o universo inteiro)
     2) Fila de leitura baseada no candidato do scanner, não no `ok` — evita
        perder/atrasar ativos e best nulo na renderização
     3) Prêmio ausente (erro da corretora) gravado vazio: sem laço de releitura
     4) Renderização do radar/cards/KPIs protegida contra best nulo
     5) Troca bolhas/tabela não relê a API mais (só redesenha)
     6) Removida 2ª chamada /cadeia duplicada em abrirAba → garantirAtivo
     7) Ativo sem prêmio mostra "Carregando…" em vez de "Nenhum ativo"

   Novidades v3.2.7:
     1) Scanner ranqueado por capital para 1 lote (crescente) — analise.txt
     2) Removido filtro de "saldo na corretora"; ordem por capital/lote
     3) Vista Tabela = DataTable paginada com colunas: rank, ativo, preço,
        vencimentos, dividendos, retorno PUT/CALL mês, riscos
     4) Cards de ativos dentro de Accordion (inicialmente fechado)
     5) Filtro de vencimentos na aba do ativo: só mostra ≤ DTE selecionado
     6) Removido "Saldo na corretora" do cabeçalho do ativo e do card
     7) Checkbox "Apenas 0 DTE" para filtrar só opções diárias (seg–qui)
     8) DataTable inicial ordenada por Preço (crescente); loading assíncrono
     9) DataTable aguarda jQuery/DataTables carregar (polling 5s)
     10) DataTable atualiza dados sem recarregar API (clear/rows.add/draw)
     11) Mínimo 5 strikes por ativo na aba de detalhes
     12) Filtros do scanner sincronizam com abas de ativos abertas
     13) Removido checkbox "Mostrar strikes fora do filtro" — área rolável
         (max-height 420px), fora do filtro aparecem esmaecidos
     14) Asset view: DataTable paginada com header fixo, prêmio unitário
     15) Scanner DataTable: bg color = tank area, sem coluna Capital 1 lote
     16) 0DTE filter fixo: usa dte.tipo do expiration
     17) DataTables PT-BR inline (sem CORS), ambos com bg var(--sc-panel3)
     18) Asset view corrigido: dados em arrays planos (sem objetos aninhados),
         Strike formatado US$ (igual Break-even), todas colunas ordenáveis,
         destaque de linha via comparação de texto da célula Strike
   ========================================================================== */
(function () {
    'use strict';

    // Tamanho da rodada de prêmios = limite do endpoint /premios no backend
    // (LIMITE_CANDIDATOS). O scanner usa exatamente 1 rodada por leitura.
    const MAX_POR_RODADA = 20;
    const DIST_PADRAO     = 5.0;
    const HV_PADRAO       = 50;
    const TD              = 252;
    const EPS             = 1e-9;

    const $  = (id) => document.getElementById(id);
    const q  = (sel, r) => (r || document).querySelector(sel);
    const qa = (sel, r) => Array.from((r || document).querySelectorAll(sel));

    // ─── Estado global ───────────────────────────────────────────────────────
    const G = {
        // saldo removido: scanner agora ranqueia por capital por lote (analise.txt)
        hv:    HV_PADRAO,
        dte:   5,
        dMin:  2,
        dMax:  8,
        dlt:   0.30,
        sort:  'ann',
        radarView: 'bubbles', // 'bubbles' | 'table'
        radarFilter: '',  // filtro de texto para modo tabela
        only0DTE: false,  // checkbox: apenas opções 0 DTE (diárias)
        metaMensal: 1.8,  // meta de retorno ao mês (%) — Configurações › Opções
        updated: null,
    };

    // DataTable instance cache
    let radarDataTable = null;
    const assetDataTables = {}; // sym -> DataTable instance

    // DataTables Portuguese language (inline to avoid CORS)
    const DT_PT_BR = {
        "sEmptyTable": "Nenhum registro encontrado",
        "sInfo": "Mostrando _START_ a _END_ de _TOTAL_ registros",
        "sInfoEmpty": "Mostrando 0 a 0 de 0 registros",
        "sInfoFiltered": "(filtrados de _MAX_ registros)",
        "sInfoPostFix": "",
        "sInfoThousands": ".",
        "sLengthMenu": "_MENU_ resultados por página",
        "sLoadingRecords": "Carregando...",
        "sProcessing": "Processando...",
        "sZeroRecords": "Nenhum registro encontrado",
        "sSearch": "Buscar:",
        "oPaginate": {
            "sNext": "Próximo",
            "sPrevious": "Anterior",
            "sFirst": "Primeiro",
            "sLast": "Último"
        },
        "oAria": {
            "sSortAscending": ": Ordenar colunas de forma ascendente",
            "sSortDescending": ": Ordenar colunas de forma descendente"
        },
        "select": {
            "rows": {
                "_": "Selecionado %d linhas",
                "0": "Nenhuma linha selecionada",
                "1": "Selecionado 1 linha"
            }
        }
    };

    const D = {
        status:   null,
        universo: [],
        premios:  {},
        saldoOk:  false,
    };

    let abas = ['scan'];
    const ativos = {};
    let abaAtual = 'scan';

    let seqPremios = 0;
    let leiturasPremios = 0; // leituras /premios em andamento (evita duplicar)
    let seqStrikes = 0;
    let loadingCount = 0; // contador global de requisições em andamento

    // ─── Formatação ──────────────────────────────────────────────────────────
    function fmt(n, casas) {
        casas = (casas === undefined) ? 2 : casas;
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        return Number(n).toLocaleString('pt-BR', {
            minimumFractionDigits: casas, maximumFractionDigits: casas,
        });
    }
    function usd(n, casas) {
        casas = (casas === undefined) ? 2 : casas;
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        const v = Number(n);
        return (v < 0 ? '−' : '') + 'US$ ' + fmt(Math.abs(v), casas);
    }
    function sg(n, casas) {
        casas = (casas === undefined) ? 2 : casas;
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        const v = Number(n);
        return (v > 0.0000001 ? '+' : v < -0.0000001 ? '−' : '') + 'US$ ' + fmt(Math.abs(v), casas);
    }
    function pct(n, casas) {
        casas = (casas === undefined) ? 1 : casas;
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
        return fmt(Number(n), casas) + '%';
    }
    function kfmt(k) {
        if (k === null || k === undefined || isNaN(Number(k))) return '—';
        const v = Number(k);
        return fmt(v, v % 1 === 0 ? 0 : 1);
    }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
    }
    function fmtDataBR(iso) {
        if (!iso) return '—';
        const [a, m, d] = String(iso).split('-');
        return `${d}/${m}/${a}`;
    }

    // ─── Loading global ──────────────────────────────────────────────────────
    function showGlobalLoading(on) {
        loadingCount += on ? 1 : -1;
        if (loadingCount < 0) loadingCount = 0;
        const el = $('simLoading');
        if (el) el.classList.toggle('sim-on', loadingCount > 0);
    }

    // ─── Infra ───────────────────────────────────────────────────────────────
    async function api(caminho, opcoes) {
        showGlobalLoading(true);
        try {
            const resp = await fetch(caminho, opcoes);
            let corpo = null;
            try { corpo = await resp.json(); } catch (_) { }
            if (!resp.ok || (corpo && corpo.success === false)) {
                throw new Error((corpo && (corpo.message || corpo.error)) || ('HTTP ' + resp.status));
            }
            return corpo;
        } finally {
            showGlobalLoading(false);
        }
    }

    function toastErro(titulo, mensagem) {
        if (typeof iziToast !== 'undefined') {
            iziToast.error({ title: titulo, message: String(mensagem).slice(0, 300) });
        } else { console.error(titulo, mensagem); }
    }
    function toastAviso(titulo, mensagem) {
        if (typeof iziToast !== 'undefined') {
            iziToast.warning({ title: titulo, message: String(mensagem).slice(0, 300) });
        } else { console.warn(titulo, mensagem); }
    }
    function debounce(fn, ms) {
        let t = null;
        return function () { const args = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, args), ms); };
    }
    function chunk(lista, tamanho) {
        const partes = [];
        for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho));
        return partes;
    }

    // ─── Motor de qualidade do prêmio — veredito "Devo operar?" ──────────────
    // Portado de ideias/opcaoSelecionada-Claude.html (função avaliarOpcao).
    // Pesos: retorno vs meta 30 · segurança 30 · prêmio vs justo 15 ·
    //        execução (spread) 15 · tempo exposto 10
    const NIVEIS_Q = [
        { n: 'Evitar',      ico: '⛔', c: '#ef4444' },
        { n: 'Marginal',    ico: '🟠', c: '#fb923c' },
        { n: 'Cautela',     ico: '🟡', c: '#eab308' },
        { n: 'Vale operar', ico: '🟢', c: '#22c55e' },
        { n: 'Excelente',   ico: '💎', c: '#2dd4bf' },
    ];
    const CORTES_Q  = [40, 55, 70, 85];
    const PESOS_Q   = { ret: 0.30, seg: 0.30, edge: 0.15, exec: 0.15, tempo: 0.10 };
    const FAIXAS_Q  = [[0, 40], [40, 55], [55, 70], [70, 85], [85, 100]];

    function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

    /** Dias corridos entre hoje e a data de vencimento (ISO AAAA-MM-DD). */
    function diasCorridos(iso) {
        if (!iso) return 1;
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const p = String(iso).split('-').map(Number);
        if (p.length < 3 || !p[0]) return 1;
        const venc = new Date(p[0], p[1] - 1, p[2]);
        return Math.max(1, Math.round((venc - hoje) / 86400000));
    }

    /** Dias corridos restantes até o fim do mês corrente. */
    function diasAteFimDoMes() {
        const hoje = new Date();
        const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        return Math.max(0, fim - hoje.getDate());
    }

    /**
     * avaliarOpcao(op, ctx) → score 0–100, nível 0–4, dimensões e projeção.
     * op: strike do payload do card (premio, bid, ask, iv, fair, pop,
     *     pop_lucro, breakeven, capital).
     * ctx: { contratos, spot, diasCorridos, diasAteFimDoMes, meta }
     */
    function avaliarOpcao(op, ctx) {
        const n     = Math.max(1, ctx.contratos || 1);
        const meta  = (ctx.meta > 0) ? ctx.meta : G.metaMensal;
        const dias  = Math.max(1, ctx.diasCorridos);
        const p     = op.premio || 0;
        const cap   = (op.capital || (op.strike || 0) * 100) * n;
        const prem  = p * 100 * n;
        const roc   = cap > 0 ? (prem / cap * 100) : 0;

        const spot   = ctx.spot || 0;
        const be     = (op.breakeven != null) ? op.breakeven : ((op.strike || 0) - p);
        const margem = (spot > 0 && be > 0) ? ((spot - be) / spot * 100) : 0;
        const mov    = (op.iv || 0) * Math.sqrt(dias / 365) * 100;
        const z      = mov > 0 ? (margem / mov) : 0;

        const fair   = op.fair;
        const edge   = (fair > 0) ? ((p - fair) / fair) : 0;
        const spread = (op.ask > 0 && op.bid != null) ? ((op.ask - op.bid) / op.ask) : 0;

        const pop  = (op.pop_lucro != null) ? op.pop_lucro : 0;   // chance de lucro
        const pITM = (op.pop != null) ? op.pop : 0;                // chance de exercício

        const semanal = roc * 7 / dias;
        const mensal  = roc * 30 / dias;
        const ritmo   = mensal / meta;
        const semMes  = (ctx.diasAteFimDoMes || 0) / 7;
        const projRest = semanal * semMes;

        const dim = {
            ret:   clamp01(ritmo / 2),
            seg:   0.5 * clamp01((z - 0.3) / 1.2) + 0.5 * clamp01((pop - 0.6) / 0.3),
            edge:  clamp01(0.5 + edge / 0.4),
            exec:  clamp01(1 - (spread - 0.10) / 0.50),
            tempo: clamp01(1 - (dias - 7) / 23),
        };
        let score = 0;
        for (const k in PESOS_Q) score += PESOS_Q[k] * dim[k];
        score = 100 * score;

        let nivel = 0;
        CORTES_Q.forEach(function (c) { if (score >= c) nivel++; });

        // Travas: ritmo abaixo da meta limita a "Marginal"; PoP < 65% é "Evitar";
        // spread > 50% limita a "Cautela".
        const alertas = [];
        if (ritmo < 1) {
            nivel = Math.min(nivel, 1);
            alertas.push(['bad', 'Ritmo abaixo da meta',
                'o ritmo mensal equivalente (' + pct(mensal, 2) + ') não alcança a meta de ' + pct(meta, 1) + '.']);
        }
        if (pop < 0.65) {
            nivel = 0;
            alertas.push(['bad', 'PoP baixo',
                'chance de lucro de ' + pct(pop * 100, 0) + ' (mínimo adotado: 65%).']);
        }
        if (spread > 0.5) {
            nivel = Math.min(nivel, 2);
            alertas.push(['warn', 'Spread largo',
                'spread de ' + pct(spread * 100, 0) + ': use ordem limite e não conte com o mid.']);
        }
        if (z < 0.5) {
            alertas.push(['warn', 'Folga curta até o break-even',
                'só ' + fmt(z, 2) + ' desvio-padrão (' + pct(margem, 1) + ') separa a cotação do break-even.']);
        }

        return {
            n: n, p: p, cap: cap, prem: prem, roc: roc, meta: meta, dias: dias,
            strike: op.strike, be: be, margem: margem, z: z, mov: mov, fair: fair, edge: edge,
            spread: spread, pop: pop, pITM: pITM, semanal: semanal, mensal: mensal,
            ritmo: ritmo, semMes: semMes, projRest: projRest, dim: dim,
            score: score, nivel: nivel, alertas: alertas,
            diasMes: ctx.diasAteFimDoMes || 0,
        };
    }

    /** Termômetro "Devo operar?" + as 4 perguntas de decisão. */
    function renderDecisao(e) {
        const zonas = FAIXAS_Q.map(function (z, i) {
            return '<i style="width:' + (z[1] - z[0]) + '%;background:' + NIVEIS_Q[i].c +
                ';opacity:' + (i === e.nivel ? 1 : .45) + '"></i>';
        }).join('');
        const rotulos = FAIXAS_Q.map(function (z, i) {
            return '<span style="width:' + (z[1] - z[0]) + '%">' + NIVEIS_Q[i].n + '</span>';
        }).join('');
        const pos = clamp01(e.score / 100) * 100;

        const paceDia = e.roc / e.dias;
        const metaDia = e.meta / 30;
        const razao   = metaDia > 0 ? paceDia / metaDia : 0;
        const q1 = (e.pop >= .75 && e.z >= 1) ? 'ok' : (e.pop >= .65 ? 'warn' : 'bad');
        const q2 = e.edge >= .05 ? 'ok' : (e.edge >= -.05 ? 'warn' : 'bad');
        const q3 = razao >= 1.5 ? 'ok' : (razao >= 1 ? 'warn' : 'bad');
        const q4 = e.roc >= e.meta ? 'ok' : (e.ritmo >= 1 ? 'warn' : 'bad');
        const RT = { ok: 'SIM', warn: 'EM TERMOS', bad: 'NÃO' };

        const qc = function (cls, titulo, corpo) {
            return '<div class="sc-qc ' + cls + '"><h5>' + titulo +
                '<span class="ans">' + RT[cls] + '</span></h5><p>' + corpo + '</p></div>';
        };

        const perguntas =
            qc(q1, '🛡️ Vale o risco de ser exercido (comprar a ação)?',
                'Chance de exercício <b>' + pct(e.pITM * 100, 1) + '</b> · PoP <b>' + pct(e.pop * 100, 0) +
                '</b> · folga até o break-even <b>' + pct(e.margem, 1) + '</b> (' + fmt(e.z, 2) + 'σ).') +
            qc(q2, '⚖️ Vale em relação ao valor da ação?',
                'Prêmio <b>' + fmt(e.p, 3) + '</b> × valor justo (HV) <b>' + fmt(e.fair, 3) +
                '</b>: <b>' + (e.edge >= 0 ? '+' : '') + pct(e.edge * 100, 0) + '</b> · spread <b>' +
                pct(e.spread * 100, 0) + '</b>.') +
            qc(q3, '⏳ Vale em relação aos dias da operação?',
                '<b>' + fmt(paceDia, 3) + '%</b> ao dia contra meta de <b>' + fmt(metaDia, 3) +
                '%</b> = <b>' + fmt(razao, 1) + '×</b> a meta, com o capital preso por <b>' +
                e.dias + ' dias</b>.') +
            qc(q4, '🎯 Ajuda a bater a meta mensal?',
                'ROC de <b>' + pct(e.roc, 2) + '</b> = <b>' + pct(e.roc / e.meta * 100, 0) +
                '</b> da meta (' + pct(e.meta, 1) + '). Neste ritmo: <b>' + pct(e.semanal, 2) +
                '</b>/sem × <b>' + fmt(e.semMes, 1) + '</b> sem restantes = <b>' +
                pct(e.projRest, 2) + '</b> neste mês.');

        return '<div class="sc-dec__hd"><span class="sc-dec__q">Devo operar?</span>' +
            '<span class="sc-lv sc-lv-' + e.nivel + '">' + NIVEIS_Q[e.nivel].ico + ' ' +
            NIVEIS_Q[e.nivel].n + '</span>' +
            '<b class="sc-dec__sc">' + fmt(e.score, 0) + '<small>/100</small></b></div>' +
            '<div class="sc-scale">' +
            '<div class="sc-scale__z">' + zonas + '</div>' +
            '<div class="sc-scale__nd" style="left:' + pos + '%"><b>' + fmt(e.score, 0) + '</b></div>' +
            '<div class="sc-scale__lb">' + rotulos + '</div>' +
            '</div>' +
            '<div class="sc-qg">' + perguntas + '</div>';
    }

    /** Tiles grandes de Capital / ROC / Dias (o ROC marca a meta; os dias
     *  mostram quantos caem no mês atual). */
    function renderTiles(e, vencIso, vencDiasPregao) {
        const mesDias = Math.min(e.dias, e.diasMes);
        let dots = '';
        for (let i = 1; i <= Math.min(e.dias, 45); i++) {
            const cls = [];
            if (i <= mesDias) cls.push('m');
            if (i % 7 === 0) cls.push('w');
            dots += '<i class="' + cls.join(' ') + '"></i>';
        }
        const barW = clamp01(e.roc / (e.meta * 2)) * 100;
        const aMeta = e.roc >= e.meta;
        const preg = (vencDiasPregao != null) ? vencDiasPregao : e.dias;
        return '<div class="sc-tiles">' +
            '<div class="sc-tile"><div class="sc-tile__h">💰 Capital reservado</div>' +
            '<div class="sc-tile__n">' + usd(e.cap, 0) + '</div>' +
            '<div class="sc-tile__c">' + (e.n * 100) + ' ações × strike <b>' + usd(e.strike) +
            '</b> · custo efetivo se exercido <b>' + usd(e.be) + '</b></div></div>' +

            '<div class="sc-tile"><div class="sc-tile__h">📈 ROC · retorno sobre o capital</div>' +
            '<div class="sc-tile__n' + (aMeta ? ' sc-up' : '') + '">' + pct(e.roc, 2) + '</div>' +
            '<div class="sc-tile__c">' + pct(e.roc / e.meta * 100, 0) + ' da meta mensal (' +
            pct(e.meta, 1) + ') em uma única operação</div>' +
            '<div class="sc-tile__mb"><i style="width:' + barW + '%"></i><u style="left:50%"></u></div></div>' +

            '<div class="sc-tile"><div class="sc-tile__h">⏳ Dias até o vencimento</div>' +
            '<div class="sc-tile__n">' + preg + '<small> pregões</small></div>' +
            '<div class="sc-tile__c">' + fmtDataBR(vencIso) + ' · ' + e.dias + ' dias corridos · ' +
            fmt(e.dias / 7, 1) + ' semanas · <span style="color:var(--sc-cyan)">' + mesDias +
            ' no mês atual</span>' +
            (e.dias > mesDias ? ' · ' + (e.dias - mesDias) + ' no seguinte' : '') + '</div>' +
            '<div class="sc-tile__dots">' + dots + '</div></div>' +
            '</div>';
    }

    // ─── Identificação visual do ativo ──────────────────────────────────────
    const CORES = ['#f59e0b', '#818cf8', '#fb923c', '#22d3ee', '#60a5fa',
                   '#a78bfa', '#f87171', '#9ca3af', '#3b82f6', '#ef4444',
                   '#fbbf24', '#4ade80'];
    function corDe(simbolo) {
        let h = 0;
        for (let i = 0; i < simbolo.length; i++) h = (h * 31 + simbolo.charCodeAt(i)) >>> 0;
        return CORES[h % CORES.length];
    }
    function icoDe(simbolo) { return (simbolo || '?')[0]; }

    // ─── Helpers de UI ──────────────────────────────────────────────────────
    const FM = {
        pct:  (v) => pct(v, 1), pct0: (v) => pct(v, 0),
        usd:  (v) => usd(v), usd0: (v) => usd(v, 0),
        d2:   (v) => fmt(v, 2),
        dte:  (v) => Math.round(v) + (Math.round(v) === 1 ? ' pregão' : ' pregões'),
        ct:   (v) => v + (v === 1 ? ' contrato' : ' contratos'),
    };
    function sl(k, label, min, max, step, f) {
        const chk = k + 'On';
        return '<div class="sc-sl"><div class="sc-sl__t"><label><input type="checkbox" data-chk="' + chk + '" checked> ' + label +
            '</label><b data-vk="' + k + '"></b></div>' +
            '<input type="range" data-k="' + k + '" data-f="' + f + '" min="' + min +
            '" max="' + max + '" step="' + step + '"></div>';
    }
    function dual(label, k1, k2, min, max, step, f) {
        const chk = k1 + 'On'; // usa o mesmo checkbox para min e max
        return '<div class="sc-sl"><div class="sc-sl__t"><label><input type="checkbox" data-chk="' + chk + '" checked> ' + label +
            '</label><b data-dv="' + k1 + '"></b></div>' +
            '<div class="sc-dual" data-f="' + f + '"><div class="sc-tr"></div><div class="sc-fl"></div>' +
            '<input type="range" data-dual="lo" data-k="' + k1 + '" min="' + min + '" max="' + max + '" step="' + step + '">' +
            '<input type="range" data-dual="hi" data-k="' + k2 + '" min="' + min + '" max="' + max + '" step="' + step + '">' +
            '</div></div>';
    }
    function seg(k, opts, cur) {
        return '<div class="sc-seg">' + opts.map(function (o) {
            return '<button type="button" data-seg="' + k + '" data-v="' + o[0] + '" class="' +
                (String(o[0]) === String(cur) ? 'sc-on' : '') + '">' + o[1] + '</button>';
        }).join('') + '</div>';
    }
    /** Bloco "Preço de execução": o prêmio de VENDA é sempre o BID (o que a
     *  corretora paga). Mid e Ask aparecem só como referência de mercado,
     *  junto com o spread e o prêmio mínimo para bater a meta mensal. */
    function renderExecucao(r, c, lotT, meta, dias) {
        const K    = r.strike || 0;
        const bid  = r.bid, ask = r.ask;
        if (bid == null && ask == null) {
            return '<div class="sc-ex__v">Sem bid/ask neste strike — sem preço de execução.</div>';
        }
        const mid = (bid != null && ask != null) ? (bid + ask) / 2
                   : (bid != null ? bid : ask);
        const linha = function (rot, preco, ativo) {
            if (preco == null) return '';
            const prem = preco * 100 * c;
            const roc = lotT > 0 ? (prem / lotT * 100) : 0;
            return '<div class="sc-ex__r' + (ativo ? ' sc-ex__on' : '') + '">' +
                '<span>' + rot + '</span><b>' + fmt(preco, 3) + '</b>' +
                '<i>' + sg(prem) + ' · ROC ' + pct(roc, 2) + '</i></div>';
        };
        // Prêmio mínimo (por ação) para o ritmo da operação bater a meta mensal
        const rocMin = meta * dias / 30;
        const pMin   = K * rocMin / 100;
        let veredito, cls;
        if (bid != null && bid >= pMin) {
            veredito = 'Mesmo no <b>bid</b> a operação já bate o ritmo da meta.';
            cls = 'ok';
        } else if (mid != null && mid >= pMin) {
            veredito = 'Só bate a meta acima de <b>' + fmt(pMin, 3) + '</b> — use ordem limite.';
            cls = 'warn';
        } else {
            veredito = 'Nem no <b>ask</b> a operação bate a meta.';
            cls = 'bad';
        }
        const spread = (ask != null && ask > 0 && bid != null) ? ((ask - bid) / ask * 100) : null;
        return linha('Bid', bid, true) + linha('Mid', mid, false) + linha('Ask', ask, false) +
            '<div class="sc-ex__m">Prêmio de venda = <b>bid</b> · Mínimo p/ meta (' + pct(meta, 1) + ' em ' + dias + 'd): <b>' +
            fmt(pMin, 3) + '</b> · prêmio ' + usd(pMin * 100 * c, 2) + '</div>' +
            (spread != null ? '<div class="sc-ex__m">Spread: <b>' + pct(spread, 0) + '</b></div>' : '') +
            '<div class="sc-ex__v sc-ex__v-' + cls + '">' + veredito + '</div>';
    }

    function kpi(l, v, s) {
        return '<div class="sc-kpi"><div class="sc-kpi__l">' + l + '</div><div class="sc-kpi__v">' +
            v + '</div>' + (s ? '<div class="sc-kpi__s">' + s + '</div>' : '') + '</div>';
    }
    function paint(inp) {
        const min = parseFloat(inp.min), max = parseFloat(inp.max);
        inp.style.setProperty('--p', ((inp.value - min) / (max - min) * 100) + '%');
    }
    function paintDual(du) {
        const lo = q('[data-dual=lo]', du), hi = q('[data-dual=hi]', du);
        const mn = parseFloat(lo.min), mx = parseFloat(lo.max);
        const a = (parseFloat(lo.value) - mn) / (mx - mn) * 100;
        const b = (parseFloat(hi.value) - mn) / (mx - mn) * 100;
        const fl = q('.sc-fl', du);
        fl.style.left = a + '%'; fl.style.width = Math.max(0, b - a) + '%';
        const lab = du.parentNode.querySelector('[data-dv]');
        if (lab) lab.textContent = FM[du.dataset.f](parseFloat(lo.value)) + ' a ' + FM[du.dataset.f](parseFloat(hi.value));
    }
    function sync(root, st) {
        qa('input[type=range][data-k]:not([data-dual])', root).forEach(function (inp) {
            const k = inp.dataset.k;
            if (st[k] === undefined) return;
            if (document.activeElement !== inp) inp.value = st[k];
            const v = q('[data-vk="' + k + '"]', root);
            if (v) v.textContent = FM[inp.dataset.f](parseFloat(inp.value));
            paint(inp);
        });
        qa('.sc-dual', root).forEach(function (du) {
            qa('input', du).forEach(function (i) {
                if (st[i.dataset.k] !== undefined && document.activeElement !== i) i.value = st[i.dataset.k];
            });
            paintDual(du);
        });
        qa('[data-seg]', root).forEach(function (b) {
            const k = b.dataset.seg;
            if (st[k] !== undefined) b.classList.toggle('sc-on', String(st[k]) === b.dataset.v);
        });
    }
    function wire(root, st, cb) {
        sync(root, st);
        qa('input[type=range][data-k]:not([data-dual])', root).forEach(function (inp) {
            inp.addEventListener('input', function () {
                const k = inp.dataset.k; st[k] = parseFloat(inp.value);
                const v = q('[data-vk="' + k + '"]', root);
                if (v) v.textContent = FM[inp.dataset.f](st[k]);
                paint(inp); cb(k);
            });
        });
        qa('.sc-dual', root).forEach(function (du) {
            const lo = q('[data-dual=lo]', du), hi = q('[data-dual=hi]', du);
            const upd = function (who) {
                let a = parseFloat(lo.value), b = parseFloat(hi.value);
                if (a > b) { if (who === 'lo') { a = b; lo.value = a; } else { b = a; hi.value = b; } }
                st[lo.dataset.k] = a; st[hi.dataset.k] = b; paintDual(du);
                cb(who === 'lo' ? lo.dataset.k : hi.dataset.k);
            };
            lo.addEventListener('input', function () { upd('lo'); });
            hi.addEventListener('input', function () { upd('hi'); });
        });
        qa('[data-seg]', root).forEach(function (b) {
            b.addEventListener('click', function () {
                const k = b.dataset.seg, v = b.dataset.v;
                st[k] = /^-?\d+(\.\d+)?$/.test(v) ? parseFloat(v) : v;
                qa('[data-seg="' + k + '"]', root).forEach(function (x) { x.classList.toggle('sc-on', x === b); });
                cb(k);
            });
        });
        // Checkboxes para habilitar/desabilitar filtros
        qa('[data-chk]', root).forEach(function (chk) {
            chk.addEventListener('change', function () {
                const k = this.dataset.chk;
                st[k] = this.checked;
                cb(k);
            });
        });
    }
    function tween(el, to, f) {
        const from = el._v == null ? 0 : el._v; el._v = to;
        const t0 = performance.now();
        (function step(t) {
            const k = Math.min(1, Math.max(0, (t - t0) / 380)), e = 1 - Math.pow(1 - k, 3);
            el.textContent = f(from + (to - from) * e);
            if (k < 1) requestAnimationFrame(step); else el.textContent = f(to);
        })(t0);
    }
    function ring(svg, p, color) {
        const s = 120, w = 11, r = (s - w) / 2, c = 2 * Math.PI * r;
        svg.setAttribute('viewBox', '0 0 ' + s + ' ' + s);
        svg.innerHTML = '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#1f2d4d" stroke-width="' + w + '"/>' +
            '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + w +
            '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' +
            (c * (1 - Math.max(0, Math.min(1, p)))) + '" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .5s"/>';
    }
    function ticks(a, b, n) {
        n = n || 5; const span = b - a || 1, raw = span / n;
        const mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
        const st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
        const out = []; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10));
        return out;
    }
    function plot(cfg) {
        const w = cfg.w || 640, h = cfg.h || 260;
        const l = cfg.l === undefined ? 52 : cfg.l, r = cfg.r === undefined ? 16 : cfg.r;
        const t = cfg.t === undefined ? 14 : cfg.t, b = cfg.b === undefined ? 28 : cfg.b;
        const m = { l: l, r: r, t: t, b: b, w: w, h: h };
        const X = function (x) { return l + (x - cfg.x0) / (cfg.x1 - cfg.x0) * (w - l - r); };
        const Y = function (y) { return t + (cfg.y1 - y) / (cfg.y1 - cfg.y0) * (h - t - b); };
        let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" class="sc-plot">';
        (cfg.yt || []).forEach(function (v) {
            s += '<line x1="' + l + '" x2="' + (w - r) + '" y1="' + Y(v) + '" y2="' + Y(v) +
                '" class="sc-gl' + (v === 0 ? ' sc-z' : '') + '"/><text x="' + (l - 6) + '" y="' + (Y(v) + 3.5) +
                '" text-anchor="end" class="sc-ax">' + (cfg.yf ? cfg.yf(v) : v) + '</text>';
        });
        (cfg.xt || []).forEach(function (v) {
            s += '<text x="' + X(v) + '" y="' + (h - 8) + '" text-anchor="middle" class="sc-ax">' +
                (cfg.xf ? cfg.xf(v) : v) + '</text>';
        });
        (cfg.layers || []).forEach(function (f) { s += f(X, Y, m); });
        return s + '</svg>';
    }

    // ─── Regras de filtro / zonas / melhor strike ───────────────────────────
    function noFiltro(r, f) {
        const distOn = f.distOn !== false;
        const deltaOn = f.deltaOn !== false;
        return (!distOn || ((r.dist || 0) >= f.dMin - EPS && (r.dist || 0) <= f.dMax + EPS)) &&
            (!deltaOn || (r.delta !== null && r.delta !== undefined && Math.abs(r.delta) <= f.dlt + EPS)) &&
            (r.premio || 0) >= 0.01;
    }
    function cabe(r, f) { return true; } // Sem verificação de saldo
    function okFiltro(r, f) { return noFiltro(r, f); }
    function melhorDe(strikes, f) {
        const validos = (strikes || []).filter(function (r) { return noFiltro(r, f); });
        if (!validos.length) return null;
        return validos.slice().sort(function (a, b) {
            return (b.anualizado || 0) * (b.pop_lucro || 0) - (a.anualizado || 0) * (a.pop_lucro || 0);
        })[0];
    }
    function marcarZonas(strikes, preco) {
        if (!strikes || !strikes.length) return strikes || [];
        // Filtrar elementos null/undefined por segurança
        const validos = strikes.filter(Boolean);
        const proximos = validos.slice().sort(function (a, b) {
            return Math.abs(a.strike - preco) - Math.abs(b.strike - preco);
        }).slice(0, 3).map(function (r) { return r.strike; });
        validos.forEach(function (r) {
            if (proximos.indexOf(r.strike) >= 0) r.zona = 'ATM';
            else if (r.strike > preco) r.zona = 'ITM';
            else r.zona = 'OTM';
        });
        return validos;
    }
    function strikeMaisProximo(strikes) {
        if (!strikes || !strikes.length) return null;
        const validos = strikes.filter(Boolean);
        let melhor = null, melhorD = Infinity;
        validos.forEach(function (r) {
            const d = Math.abs(r.dist || 0);
            if (d < melhorD) { melhorD = d; melhor = r; }
        });
        return melhor;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ABA: SCANNER
    // ══════════════════════════════════════════════════════════════════════
    const SC = {
        root: null, scans: [],

        mount: function (el) {
            this.root = el;
            el.innerHTML =
                '<div class="sc-split"><aside class="sc-side">' +
                // Ticker direto
                '<div class="sc-sl"><div class="sc-sl__t"><label>🎯 Ticker direto (ignora filtros)</label></div>' +
                '<input type="text" id="scTickerDireto" placeholder="Ex: SPY, AAPL, TSLA" title="Digite o ticker e pressione Enter para analisar o ativo direto" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--sc-border);background:var(--sc-panel3);color:var(--sc-text);font-family:inherit;font-size:13px;text-transform:uppercase;">' +
                '<hr class="sc-sep">' +
                sl('dte', 'DTE da PUT', 1, 45, 1, 'dte') +
                dual('Distância do strike (mín. a máx.)', 'dMin', 'dMax', -5, 25, 0.5, 'pct') +
                sl('dlt', 'Delta máximo (|Δ|)', 0.05, 0.6, 0.01, 'd2') +
                '<hr class="sc-sep">' +
                '<label class="sc-chk" style="margin-top:4px"><input type="checkbox" id="scOnly0DTE" data-chk="only0DTEOn"' + (G.only0DTE ? ' checked' : '') + '> Apenas 0 DTE (opções diárias)</label>' +
                '<div class="sc-hint" style="margin-top:4px;font-size:11px">Quando marcado, o scanner filtra apenas vencimentos do tipo "diário" (seg–qui).</div>' +
                '</aside><section>' +
                '<div class="sc-kpis" data-k></div>' +
                '<div class="sc-card"><div class="sc-card__h">' +
                '📡 Radar de ativos <small>Ordenado por capital para 1 lote (crescente) — analise.txt</small>' +
                '<div style="margin-left:auto"><label class="sc-seg" style="padding:2px;background:transparent;border:none"><button type="button" data-seg="radarView" data-v="bubbles" class="sc-on">🫧 Bolhas</button><button type="button" data-seg="radarView" data-v="table">📋 Tabela</button></label></div>' +
                '</div><div data-tank style="padding:8px 12px;background:var(--sc-panel3);border-top:1px solid var(--sc-border);font-size:11.5px;color:var(--sc-muted)"></div><div data-radar></div></div>' +
                // Accordion para "Ativos que cabem no seu saldo"
                '<div class="sc-card" style="background:none;border:none;padding:0">' +
                '<div class="accordion sim-accordion" id="scAccordionAtivos">' +
                '  <div class="accordion-item">' +
                '    <h2 class="accordion-header">' +
                '      <button class="accordion-button collapsed sim-accordion-btn" type="button" data-bs-toggle="collapse" data-bs-target="#scCollapseAtivos" aria-expanded="false" aria-controls="scCollapseAtivos">' +
                '        🧩 Ativos ranqueados por capital para 1 lote <small data-cnt></small>' +
                '      </button>' +
                '    </h2>' +
                '    <div id="scCollapseAtivos" class="accordion-collapse collapse" data-bs-parent="#scAccordionAtivos">' +
                '      <div class="accordion-body sim-accordion-body" style="padding:0">' +
                '        <div class="sc-agrid" data-grid></div><div data-hid></div>' +
                '      </div>' +
                '    </div>' +
                '  </div>' +
                '</div>' +
                '</div>' +
                '</section></div>';

            wire(el, G, (k) => this.aoMudar(k));

            // Ticker direto - Enter para analisar
            q('#scTickerDireto', el).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const ticker = e.target.value.trim().toUpperCase();
                    if (ticker) { abrirAba(ticker); e.target.value = ''; }
                }
            });

            // Checkbox 0 DTE
            q('#scOnly0DTE', el).addEventListener('change', (e) => {
                G.only0DTE = e.target.checked;
                this.aoMudar('only0DTEOn');
            });

            el.addEventListener('click', (e) => {
                const o = e.target.closest('[data-open]');
                if (o) { abrirAba(o.dataset.open, o.dataset.strike != null ? o.dataset.strike : null); return; }
                const c = e.target.closest('circle[data-sym]');
                if (c) abrirAba(c.dataset.sym);
            });
        },

        aoMudar: function (k) {
            // Sincronizar filtros do scanner para abas de ativos abertas
            const syncToAssetTabs = (k === 'dMin' || k === 'dMax' || k === 'dlt' || k === 'dte' || k === 'only0DTEOn');
            
            // 'radarView' só troca a visualização (bolhas/tabela): redesenha
            // sem reler a API. Os filtros relêem os prêmios em 1 única chamada.
            if (k === 'radarView') {
                this.update();
            } else if (k === 'dMin' || k === 'dMax' || k === 'dlt' || k === 'sort' || k === 'dteOn' || k === 'distOn' || k === 'deltaOn' || k === 'only0DTEOn' || k === 'dte' || k === 'fill') {
                this.update();
                recarregarPremios();
            }
            
            if (syncToAssetTabs) {
                Object.keys(ativos).forEach(function (sym) {
                    const t = ativos[sym];
                    if (t && t.st) {
                        // Atualizar filtros da aba do ativo com os do scanner
                        if (k === 'dMin') t.st.dMin = G.dMin;
                        if (k === 'dMax') t.st.dMax = G.dMax;
                        if (k === 'dlt') t.st.dlt = G.dlt;
                        if (k === 'dte') t.st.dte = G.dte;
                        // Disparar atualização da aba do ativo (recarrega se DTE mudou)
                        AssetView.onMudou(t);
                    }
                });
            }
        },

        candidatos: function () {
            // Sem filtro de saldo: 1 única rodada de prêmios, com os
            // MAX_POR_RODADA ativos de menor capital por lote. O universo já
            // chega ordenado por preço; reordenamos por capital_lote para
            // manter a ordem mesmo após inclusões manuais (ticker direto).
            return D.universo
                .filter(function (i) { return (i.capital_lote || 0) > 0; })
                .sort(function (a, b) { return (a.capital_lote || 0) - (b.capital_lote || 0); })
                .slice(0, MAX_POR_RODADA);
        },

        update: function () {
            const el = this.root;
            if (!el) return;
            const f = G;

            // Loading indicator
            q('[data-radar]', el).innerHTML = '<div class="sc-empty" style="padding:40px;text-align:center"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Carregando...</div>';

            const candidatos = this.candidatos();
            
            // Montagem dos candidatos: os que ainda não têm prêmio ficam fora de
            // `vis` (contagem de "carregando") e entram assim que a leitura
            // única /premios responder.
            const scans = candidatos.map(function (item) {
                const p = D.premios[item.simbolo];
                // Garantir que strikes seja sempre um array limpo (sem null/undefined)
                let strikes = (p && Array.isArray(p.strikes)) ? p.strikes.filter(Boolean) : [];
                const vencTipo = (p && p.dte && p.dte.tipo) || '';
                
                // Filtrar strikes por tipo de vencimento se "Apenas 0 DTE" estiver marcado
                // 0 DTE = vencimentos do tipo "diario" (seg-qui)
                if (f.only0DTE) {
                    if (vencTipo !== 'diario') {
                        strikes = [];
                    }
                }
                
                const best = melhorDe(strikes, f);
                const inF = strikes.filter(function (r) { return noFiltro(r, f); });
                const minLot = inF.length ? Math.min.apply(null, inF.map(function (r) { return r.capital; })) : null;
                const z = {
                    ITM: strikes.filter(function (r) { return r.zona === 'ITM'; }).sort(function (a, b) { return a.strike - b.strike; }).slice(0, 4),
                    ATM: strikes.filter(function (r) { return r.zona === 'ATM'; }).sort(function (a, b) { return b.strike - a.strike; }),
                    OTM: strikes.filter(function (r) { return r.zona === 'OTM'; }).sort(function (a, b) { return b.strike - a.strike; }).slice(0, 4),
                };
                // ok = tem best strike E passa nos filtros (sem verificação de saldo)
                // Sem prêmio ainda não há o que avaliar: entra na contagem de
                // "carregando" e só passa a `vis` quando os dados chegarem.
                const temPremios = !!p;
                const ok = temPremios ? !!(best && noFiltro(best, f)) : false;
                return { item: item, simbolo: item.simbolo, strikes: strikes, best: best, minLot: minLot, z: z, iv: p ? p.iv_atm : null, ok: ok, dte: p ? p.dte : null, temPremios: temPremios };
            });
            this.scans = scans;

            const resolvidos = scans.filter(function (s) { return s.temPremios; });
            const vis = resolvidos.filter(function (s) { return s.ok; });
            // lockCap = ativos cujo menor lote dos strikes filtrados existe mas não há best (raro)
            const lockCap = resolvidos.filter(function (s) { return !s.ok && s.minLot !== null; });
            const nof = resolvidos.filter(function (s) { return !s.ok && lockCap.indexOf(s) < 0; });

            // Ordenação: por capital para 1 lote (crescente) = 'lot', ou pelos outros critérios
            const key = { ann: s => s.best ? s.best.anualizado : -Infinity, pop: s => s.best ? s.best.pop_lucro : -Infinity, prem: s => s.best ? s.best.premio_liquido : -Infinity, lot: s => s.best ? s.best.capital : Infinity }[G.sort] || (s => s.best ? s.best.capital : Infinity);
            vis.sort(function (a, b) { return key(a) - key(b); }); // crescente para 'lot', decrescente para outros

            const total = scans.length;
            const comPremios = resolvidos.length;
            const semPremios = scans.length - comPremios;
            // Mensagem comum aos pontos vazios do radar e dos cards
            const msgVazio = semPremios > 0
                ? '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Carregando prêmios de ' + semPremios + ' ativo(s)…'
                : 'Nenhum ativo atende aos filtros atuais.';
            q('[data-tank]', el).innerHTML =
                '<b>' + vis.length + ' de ' + total + ' ativos</b> atendem aos filtros' +
                '<div class="sc-bar"><i style="width:' + (total ? vis.length / total * 100 : 0) + '%"></i></div>' +
                (vis.length ? 'Ordenados por <b>capital para 1 lote (crescente)</b> — ' + vis.length + ' elegíveis.'
                 : 'Relaxe os filtros (DTE, distância, delta) para ver mais ativos.') +
                (semPremios > 0 ? '<br>' + semPremios + ' ativo(s) carregando prêmios…' : '');
            
            // Disparar carregamento de prêmios apenas uma vez (na primeira renderização)
            if (!this._premiosIniciado) {
                this._premiosIniciado = true;
                this.carregarPremiosVisiveis();
            }

            // KPIs — só quando há pelo menos 1 ativo com prêmio carregado
            const nStr = vis.reduce(function (n, s) { return n + (s.ok ? 1 : 0); }, 0);
            const comBest = vis.filter(function (s) { return !!s.best; });
            if (!comBest.length) { q('[data-k]', el).innerHTML = ''; }
            else {
                const topAnn = comBest.slice().sort(function (a, b) { return (b.best.anualizado || 0) - (a.best.anualizado || 0); })[0];
                const topPop = comBest.slice().sort(function (a, b) { return (b.best.pop_lucro || 0) - (a.best.pop_lucro || 0); })[0];
                const topPrem = comBest.slice().sort(function (a, b) { return (b.best.premio_liquido || 0) - (a.best.premio_liquido || 0); })[0];
                const topLot = comBest.slice().sort(function (a, b) { return (a.best.capital || 0) - (b.best.capital || 0); })[0];
                q('[data-k]', el).innerHTML =
                    kpi('🧩 Ativos elegíveis', vis.length, nStr + ' strikes dentro do filtro') +
                    kpi('🚀 Maior anualizado', topAnn.simbolo + ' ' + kfmt(topAnn.best.strike), pct((topAnn.best.anualizado || 0) * 100, 0) + ' a.a. bruto') +
                    kpi('🛡️ Maior PoP', topPop.simbolo + ' ' + kfmt(topPop.best.strike), 'PoP ' + pct((topPop.best.pop_lucro || 0) * 100, 0)) +
                    kpi('💰 Maior prêmio', topPrem.simbolo + ' ' + kfmt(topPrem.best.strike), sg(topPrem.best.premio_liquido) + ' líquido') +
                    kpi('📦 Menor lote (1 contrato)', topLot.simbolo + ' ' + kfmt(topLot.best.strike), usd(topLot.best.capital, 0));
            }

            // Radar - Bolhas ou Tabela
            const allBest = comBest.map(function (s) { return s.best; });
            const maxY = Math.max.apply(null, [10].concat(allBest.map(function (b) { return (b.anualizado || 0) * 100; }))) * 1.18;
            const maxNet = Math.max.apply(null, [1].concat(allBest.map(function (b) { return Math.max(0, b.premio_liquido || 0); })));

            if (G.radarView === 'table') {
                // DataTable paginada (DataTables.net) - segue analise.txt: ranking, ativo, preço, capital 1 lote, vencimentos, dividendos, retorno mensal put/call, riscos
                const tableId = 'scRadarTable';
                
                // Build table data array for DataTable (sem coluna Capital 1 lote)
                const tableData = comBest.map(function (s, idx) {
                    const b = s.best;
                    const item = s.item;
                    const vencTipos = (s.strikes || []).map(function(r) { return r.venc_tipo; }).filter(Boolean);
                    const vencUnicos = [...new Set(vencTipos)].join(', ') || '—';
                    const div = item.dividendos;
                    const divTexto = div && div.paga ? 'Sim (' + (div.frequencia || '—') + ')' : (div && div.paga === false ? 'Não' : '—');
                    const retPutMes = b.anualizado ? ((b.anualizado * 100) / 12).toFixed(2) + '%' : '—';
                    const retCallMes = b.anualizado ? ((b.anualizado * 100) / 12).toFixed(2) + '%*' : '—';
                    const riscos = [];
                    if (item.perfil && item.perfil.includes('alta volatilidade')) riscos.push('Alta volatilidade');
                    if (b.dist && Math.abs(b.dist) > 10) riscos.push('Strike longe do spot');
                    if (b.delta && Math.abs(b.delta) > 0.4) riscos.push('Delta alto (risco exercício)');
                    const riscoTexto = riscos.length ? riscos.join(', ') : 'Baixo';
                    return [
                        idx + 1, // Rank
                        '<b>' + esc(s.simbolo) + '</b>', // Ativo
                        usd(item.preco), // Preço
                        esc(vencUnicos), // Vencimentos
                        esc(divTexto), // Dividendos
                        '<span class="sc-up">' + retPutMes + '</span>', // Retorno PUT
                        '<span class="sc-up">' + retCallMes + '</span>', // Retorno CALL
                        esc(riscoTexto) // Riscos
                    ];
                });

                // Render table HTML (only on first load or view switch)
                const $jq = window.$;
                const hasDataTable = $jq && $jq.fn && $jq.fn.DataTable;
                const isFirstRender = !radarDataTable || !hasDataTable || !$jq.fn.DataTable.isDataTable('#' + tableId);
                if (isFirstRender) {
                    q('[data-radar]', el).innerHTML = comBest.length
                        ? '<div style="margin-bottom:8px"><input type="search" id="scRadarFilter" placeholder="Filtrar ativos (ticker, empresa, setor...)" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--sc-border);background:var(--sc-panel3);color:var(--sc-text);font-family:inherit;font-size:12px;" value="' + esc(G.radarFilter) + '"></div>' +
                          '<div class="dataTables_scrollBody" style="max-height:400px;"><table id="' + tableId + '" class="dataTable" style="width:100%"><thead><tr>' +
                          '<th>Rank</th><th>Ativo</th><th class="dt-type-numeric">Preço</th><th>Vencimentos</th><th>Dividendos</th><th class="dt-type-numeric">Retorno PUT (mês)</th><th class="dt-type-numeric">Retorno CALL (mês)</th><th>Riscos</th></tr></thead><tbody></tbody></table></div>'
                        : '<div class="sc-empty">' + msgVazio + '</div>';
                }

                // Initialize or update DataTable
                function initOrUpdateDataTable() {
                    const $jq2 = window.$;
                    if (!$jq2 || !$jq2.fn || !$jq2.fn.DataTable) {
                        if (!window._dtWaitCount) window._dtWaitCount = 0;
                        if (window._dtWaitCount < 50) {
                            window._dtWaitCount++;
                            setTimeout(initOrUpdateDataTable, 100);
                        } else {
                            console.warn('DataTables não carregou a tempo');
                        }
                        return;
                    }
                    window._dtWaitCount = 0;

                    if (isFirstRender) {
                        // First time: create DataTable
                        radarDataTable = $jq2('#' + tableId).DataTable({
                            data: tableData,
                            pageLength: 10,
                            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, 'Todos']],
                            language: DT_PT_BR,
                            order: [[2, 'asc']], // ordenar por Preço (coluna 2 = Preço) crescente inicialmente
                            columnDefs: [
                                // Preço, Retorno PUT e Retorno CALL não são ordenáveis
                                { orderable: false, targets: [2, 5, 6] },
                                { type: 'num-fmt', targets: [0, 2, 5, 6] }, // Rank, Preço, Retornos numéricos
                                { className: 'dt-body-right', targets: [2, 5, 6] } // Preço, Retornos alinhados à direita
                            ],
                            dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>><"table-responsive"tr><"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
                            scrollY: '380px',
                            scrollCollapse: true,
                            paging: true,
                            fixedHeader: true,
                            createdRow: function (row, data, index) {
                                // A linha inteira abre o ativo (sem botão "Abrir")
                                row.classList.add('sc-row-click');
                                const s = comBest[index];
                                if (s) row.setAttribute('data-sym', String(s.simbolo || ''));
                            },
                            drawCallback: function () {
                                const filterInput = document.getElementById('scRadarFilter');
                                if (filterInput && document.activeElement === filterInput) {
                                    filterInput.focus();
                                }
                                // Clicar na linha abre a aba do ativo
                                $jq2('#' + tableId + ' tbody tr.sc-row-click').off('click').on('click', function () {
                                    const sym = this.getAttribute('data-sym');
                                    if (sym) abrirAba(sym);
                                });
                            }
                        });
                    } else {
                        // Update existing DataTable with new data (no API call)
                        radarDataTable.clear();
                        radarDataTable.rows.add(tableData);
                        radarDataTable.draw(false); // false = mantém paginação atual
                    }

                    // Custom filter input handler
                    const filterInput = document.getElementById('scRadarFilter');
                    if (filterInput) {
                        filterInput.removeEventListener('input', filterInput._scFilterHandler);
                        filterInput._scFilterHandler = function () {
                            G.radarFilter = this.value;
                            if (radarDataTable) {
                                radarDataTable.search(this.value).draw();
                            }
                        };
                        filterInput.addEventListener('input', filterInput._scFilterHandler);
                    }
                }

                if (comBest.length) {
                    initOrUpdateDataTable();
                } else if (radarDataTable) {
                    // Clear table if no data
                    radarDataTable.clear().draw();
                }
            } else {
                // Bolhas (original) - eixo X = capital do lote (valor absoluto), não % do saldo
                const maxCapital = Math.max.apply(null, [1000].concat(allBest.map(function (b) { return b.capital || 0; })));
                q('[data-radar]', el).innerHTML = comBest.length
                    ? plot({ w: 820, h: 250, x0: 0, x1: maxCapital, y0: 0, y1: maxY, xt: ticks(0, maxCapital, 5), yt: ticks(0, maxY, 4), xf: v => usd(v, 0), yf: v => fmt(v, 0) + '%', b: 30,
                        layers: [function (X, Y) {
                            return comBest.map(function (s) {
                                const b = s.best;
                                const x = b.capital || 0;
                                const y = (b.anualizado || 0) * 100;
                                const r = 6 + Math.sqrt(Math.max(0, b.premio_liquido || 0) / maxNet) * 15;
                                const col = corDe(s.simbolo);
                                return '<circle data-sym="' + s.simbolo + '" cx="' + X(x) + '" cy="' + Y(y) + '" r="' + r + '" fill="' + col + '" opacity=".72" stroke="#0a0f1c" stroke-width="2"/><text x="' + X(x) + '" y="' + (Y(y) + 3.5) + '" text-anchor="middle" style="font-size:9.5px;font-weight:800;fill:#0a0f1c;pointer-events:none">' + esc(s.simbolo) + '</text>';
                            }).join('');
                        }]
                    })
                    : '<div class="sc-empty">' + msgVazio + '</div>';
            }

            // Cards (grid de ativos) - sem referência a saldo
            q('[data-cnt]', el).textContent = '— ' + vis.length + ' visíveis';
            q('[data-grid]', el).innerHTML = comBest.map(function (s) {
                const b = s.best;
                const lote = b.capital;
                const zr = function (z) {
                    return '<div class="sc-zr"><span class="sc-zl sc-z-' + z + '" title="' + (z === 'ITM' ? 'acima do preço' : z === 'ATM' ? '3 mais próximos do preço' : 'abaixo do preço') + '">' + z + '</span><div class="sc-chips">' + (s.z[z].map(function (r) { return chip(s.simbolo, r, f); }).join('') || '<span class="sc-dim" style="font-size:10.5px">sem strikes</span>') + '</div></div>';
                };
                const sub = [s.item.setor, s.item.perfil].filter(Boolean).join(' · ') || (s.item.atividade || '—');
                const titulo = [s.item.empresa, s.item.atividade].filter(Boolean).join(' · ');
                return '<div class="sc-ac"><div class="sc-ac__h"><span class="sc-ac__i" style="background:' + corDe(s.simbolo) + '">' + esc(icoDe(s.simbolo)) + '</span><div><b>' + esc(s.simbolo) + '</b><small title="' + esc(titulo) + '">' + esc(sub) + '</small></div><div class="sc-ac__p"><b>' + usd(s.item.preco) + '</b><small>IV ' + pct(s.iv != null ? s.iv * 100 : null, 0) + '</small></div><button class="sc-btn sc-btn-blue sc-btn-sm" data-open="' + esc(s.simbolo) + '">Abrir ›</button></div><div class="sc-ac__use"><small>Capital 1 lote: ' + usd(lote, 0) + '</small></div><div class="sc-ac__best">⭐ <b>PUT ' + kfmt(b.strike) + '</b> · ' + sg(b.premio_liquido) + ' · PoP <b>' + pct((b.pop_lucro || 0) * 100, 0) + '</b> · <b>' + pct((b.anualizado || 0) * 100, 0) + '</b> a.a.</div>' + zr('ITM') + zr('ATM') + zr('OTM') + '</div>';
            }).join('') || '<div class="sc-empty" style="grid-column:1/-1">' + msgVazio + '</div>';

            // Ocultos
            const hid = [];
            lockCap.forEach(function (s) { hid.push('<span>🔒 ' + esc(s.simbolo) + ' · mín. ' + usd(s.minLot, 0) + '</span>'); });
            nof.forEach(function (s) { hid.push('<span>∅ ' + esc(s.simbolo) + ' · sem strike no filtro</span>'); });
            q('[data-hid]', el).innerHTML = hid.length ? '<div class="sc-hidden-note"><b>Ocultos:</b> ' + hid.join(' ') + '</div>' : '';
        },

        carregarPremiosVisiveis: function () {
            // Mesma fila do carregarPremios: a fila tem no máximo
            // MAX_POR_RODADA ativos, logo 1 única chamada /premios.
            // Se já há leitura em andamento, quem a iniciou é quem redesenha
            // ao terminar — disparar aqui criaria uma 2ª chamada concorrente.
            if (leiturasPremios > 0) return;
            if (!candidatosPremios().length) return;
            carregarPremios(false);
        },
    };

    function chip(simbolo, r, f) {
        if (!r) return '<span class="sc-dim">strike inválido</span>';
        const lote = r.capital || 0;
        const ok = okFiltro(r, f);
        // Sem verificação de saldo: só ok (passa filtros) ou hidden (fora dos filtros)
        const cls = ok ? '' : 'sc-hidden';
        const em = ok ? ((r.premio || 0) >= 0.01 ? sg(r.premio_liquido, 0) : '—') : '—';
        return '<button type="button" class="sc-chip ' + cls + '" data-open="' + esc(simbolo) + '" data-strike="' + r.strike + '" style="--pop:' + Math.round((r.pop_lucro || 0) * 100) + '" title="PoP ' + pct((r.pop_lucro || 0) * 100, 0) + ' · Δ ' + fmt(r.delta, 2) + '"><b>' + kfmt(r.strike) + '</b><span>lote ' + fmt(lote, 0) + '</span><em>' + em + '</em></button>';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ABA: ATIVO
    // ══════════════════════════════════════════════════════════════════════
    function abrirAba(simbolo, strike) {
        if (!simbolo) return;
        simbolo = String(simbolo).toUpperCase();
        if (simbolo === 'scan') { mostrarAba('scan'); return; }

        if (!ativos[simbolo]) {
            const d = document.createElement('div');
            d.style.display = 'none';
            $('scHost').appendChild(d);
            ativos[simbolo] = {
                sym: simbolo,
                root: d,
                st: {
                    sym: simbolo,
                    dte: G.dte, dteOn: true,
                    dMin: G.dMin, dMax: G.dMax, distOn: true,
                    dlt: G.dlt, deltaOn: true,
                    strikeLimit: 200,
                    view: 'tbl', K: null, n: 1, sort: 'K', dir: -1,
                    chainSort: null,
                    strikes: null, preco: null, iv: null, carregando: false,
                    vencimentos: [], vencSelecionado: null,
                },
            };
            abas.push(simbolo);
            AssetView.mount(ativos[simbolo]);
        }
        const t = ativos[simbolo];
        if (strike != null) t.st.K = Number(strike);
        mostrarAba(simbolo);
        garantirAtivo(simbolo);
        if (!t.st.strikes && !t.st.carregando) AssetView.carregar(t);
        history.replaceState(null, '', location.pathname + '?ativo=' + encodeURIComponent(simbolo));
    }

    function fecharAba(simbolo) {
        const t = ativos[simbolo];
        if (!t) return;
        t.root.remove(); delete ativos[simbolo];
        abas = abas.filter(function (a) { return a !== simbolo; });
        mostrarAba('scan');
        history.replaceState(null, '', location.pathname);
    }

    function mostrarAba(id) {
        abaAtual = id; renderAbas();
        SC.root.style.display = id === 'scan' ? '' : 'none';
        Object.keys(ativos).forEach(function (k) { ativos[k].root.style.display = k === id ? '' : 'none'; });
        if (id === 'scan') SC.update(); else AssetView.update(ativos[id]);
    }

    function renderAbas() {
        $('scTabs').innerHTML = abas.map(function (id) {
            if (id === 'scan') return '<button type="button" class="sc-tab' + (abaAtual === 'scan' ? ' sc-on' : '') + '" data-t="scan">🔎 Scanner</button>';
            const item = itemDe(id);
            const preco = item ? item.preco : (ativos[id] && ativos[id].st.preco);
            return '<button type="button" class="sc-tab' + (abaAtual === id ? ' sc-on' : '') + '" data-t="' + esc(id) + '"><i style="background:' + corDe(id) + '"></i>' + esc(id) + '<small>' + (preco != null ? fmt(preco, 2) : '—') + '</small><span class="sc-x" data-x="' + esc(id) + '">✕</span></button>';
        }).join('');
    }

    function itemDe(simbolo) {
        const u = D.universo.find(function (i) { return i.simbolo === simbolo; });
        if (u) return u;
        const p = D.premios[simbolo];
        if (p) return { simbolo: simbolo, preco: p.preco, capital_lote: p.capital_lote };
        return null;
    }

    const AssetView = {
        mount: function (t) {
            const el = t.root, st = t.st, sym = t.sym;
            // Inicializar cache de strikes por vencimento
            st.vencStrikesCache = st.vencStrikesCache || {};
            st.vencLoading = st.vencLoading || {};
            st.vencIvAtm = st.vencIvAtm || {};
            
            el.innerHTML =
                '<div class="sc-ah" data-ah></div>' +
                '<div class="sc-split"><aside class="sc-side"><h4>🎚️ Filtros de ' + esc(sym) + '</h4>' +
                sl('dte', 'DTE da PUT', 1, 45, 1, 'dte') +
                dual('Distância do strike (mín. a máx.)', 'dMin', 'dMax', -5, 25, 0.5, 'pct') +
                sl('dlt', 'Delta máximo (|Δ|)', 0.05, 0.6, 0.01, 'd2') +
                '<hr class="sc-sep">' +
                sl('strikeLimit', 'Qtd. de strikes exibidos (mín. 5)', 5, 200, 5, 'ct') +
                '<hr class="sc-sep">' +
                '<button class="sc-btn sc-btn-gray sc-btn-sm" data-reset type="button" style="width:100%">↺ Usar filtros do scanner</button>' +
                '<div class="sc-note">Clique no vencimento para expandir e ver os strikes. '
                + 'A cadeia mostra as calls à esquerda e as puts à direita, com o strike no centro.</div>' +
                '</aside><section>' +
                '<div class="sc-card"><div class="sc-card__h" data-vt></div>' +
                '<div class="accordion sim-accordion" id="accordionVenc_' + sym + '" data-accordion-venc></div>' +
                '</div>' +
                '<div class="sc-card sc-cc"><div class="sc-cc__top"><div>' +
                '<div class="sc-cc__t" data-ct></div><small data-cz></small></div>' +
                '<div style="width:250px">' + sl('n', 'Contratos (máx. 10)', 1, 10, 1, 'ct') + '</div></div>' +
                '<div class="sc-cc__g">' +
                '<div class="sc-cc__hero"><div class="sc-cc__l">Prêmio líquido</div>' +
                '<div class="sc-cc__v sc-up" data-prem>0</div><div class="sc-cc__s" data-prems></div>' +
                '<div data-hero></div></div>' +
                '<div class="sc-cc__prob"><div class="sc-cc__ring"><svg data-r1></svg>' +
                '<div class="sc-rt"><b data-pop>0%</b><span>PoP</span></div></div>' +
                '<div class="sc-cc__ver" data-ver></div></div>' +
                '<div class="sc-cc__dec" data-dec></div></div>' +
                '<div class="sc-cc__g2">' +
                '<div class="sc-cc__m" data-m></div>' +
                '<div class="sc-cc__ctx" data-ctx></div>' +
                '<div class="sc-ex" data-ex></div></div>' +
                '<div class="sc-ins" data-ins></div></div>' +
                '</section></div>';

            wire(el, st, () => this.onMudou(t));
            q('[data-reset]', el).addEventListener('click', () => { Object.assign(st, { dte: G.dte, dteOn: true, dMin: G.dMin, dMax: G.dMax, distOn: true, dlt: G.dlt, deltaOn: true, strikeLimit: 200 }); sync(el, st); this.onMudou(t); });
            el.addEventListener('click', (e) => {
                const r = e.target.closest('[data-pk]');
                if (r) { st.K = parseFloat(r.dataset.pk); this.update(t); return; }
                // Ordenação das colunas da cadeia (theta/delta/bid/ask)
                const ch = e.target.closest('[data-ch-sort]');
                if (ch) {
                    const k = ch.dataset.chSort;
                    st.chainSort = (st.chainSort && st.chainSort.key === k)
                        ? { key: k, dir: -(st.chainSort.dir || 1) }
                        : { key: k, dir: -1 };
                    this.update(t);
                    return;
                }
                const th = e.target.closest('th[data-s]');
                if (th) { const k = th.dataset.s; if (st.sort === k) st.dir *= -1; else { st.sort = k; st.dir = -1; } this.update(t); }
                // Accordion toggle (cadeia e accordion)
                const vencRow = e.target.closest('[data-venc-toggle]');
                if (vencRow) {
                    this.toggleVencimento(t, vencRow.dataset.vencToggle);
                    return;
                }
                const btn = e.target.closest('.av-btn-toggle');
                if (btn) {
                    const vencData = btn.dataset.venc;
                    this.toggleVencimento(t, vencData, btn);
                }
            });
        },

        onMudou: function (t) {
            // Todos os filtros laterais (DTE, distância, delta, limite de
            // strikes) são aplicados LOCALMENTE sobre a cadeia e os strikes já
            // carregados: /cadeia e /strikes não recebem o DTE como parâmetro,
            // então não há o que reler — antes cada passo do slider disparava
            // uma chamada /cadeia idêntica por aba aberta.
            // O preço de execução é fixo (bid), logo nenhum filtro exige
            // nova leitura da cadeia.
            this.update(t);
        },

        carregar: async function (t) {
            const st = t.st;
            const meu = t._seq = (t._seq || 0) + 1;
            st.carregando = true;
            // Limpar cache de strikes ao recarregar
            st.vencStrikesCache = {};
            st.vencLoading = {};
            st._itmCentralizado = {};
            this.update(t);
            try {
                // Buscar apenas a cadeia (expirações, preço) sem strikes específicos
                // Usamos a cadeia para obter todas as expirações
                const params = 'tipo=PUT&dist_min=0&dist_max=100&delta_max=1' +
                    '&hv=' + G.hv + '&fill=bid' +
                    '&contratos=1&comissao=0&incluir_itm=1';
                // Chamar endpoint que retorna a cadeia completa
                let url = API_BASE + '/api/simulador/cadeia?simbolo=' + encodeURIComponent(t.sym) + '&distancia_pct=100';
                const r = await api(url);
                if (meu !== t._seq) return;
                
                st.preco     = r.preco;
                st.vencimentos = (r.expiracoes || []).filter(function(e) { return (e.dias || 0) >= 1; });
                st.carregando = false;

                // A seleção do usuário é preservada (o accordion não fecha
                // sozinho ao recarregar). Na primeira carga nenhum vencimento
                // está selecionado — todos começam fechados.
                st.vencIvAtm = {};
                (st.vencimentos || []).forEach(function(v) {
                    if (v.iv_atm != null) st.vencIvAtm[v.data] = v.iv_atm;
                });

                renderAbas(); this.update(t);

                // Revence aberto antes do recarregamento: volta a carregar os
                // strikes desse vencimento.
                const aberto = st.vencSelecionado;
                if (aberto && (st.vencimentos || []).some(function(v) { return v.data === aberto; })) {
                    this.carregarStrikesVencimento(t, aberto);
                }
            } catch (e) {
                if (meu !== t._seq) return;
                st.vencimentos = []; st.carregando = false; this.update(t);
                toastErro('Erro ao carregar cadeia de ' + t.sym, e.message);
            }
        },

        linhas: function (t) {
            const st = t.st, todas = (st.strikes || []).filter(Boolean);
            // Retorna todos os strikes (mínimo 5, máximo strikeLimit), centrados no spot
            const minStrikes = 5;
            const limit = Math.max(minStrikes, st.strikeLimit || 200);
            const spot = st.preco != null ? st.preco : 0;
            const limitadas = todas.slice()
                .sort(function (a, b) { return Math.abs((a.strike || 0) - spot) - Math.abs((b.strike || 0) - spot); })
                .slice(0, limit)
                .sort(function (a, b) { return (b.strike || 0) - (a.strike || 0); });
            return { todas: limitadas, filtradas: limitadas };
        },

        update: function (t) {
            const el = t.root, st = t.st; if (!el) return;
            this.renderAh(t);
            if (st.view === 'tbl') this.renderCadeia(t);
            else this.renderAccordion(t);
            this.renderCardGlobal(t);
        },

        renderAh: function (t) {
            const st = t.st;
            const item = itemDe(t.sym);
            const preco = st.preco != null ? st.preco : (item ? item.preco : null);
            const sub = [item && item.setor, item && item.atividade].filter(Boolean).join(' · ');
            
            // Contar total de strikes filtrados no vencimento selecionado (para o card global)
            let totalFiltrados = 0;
            if (st.vencSelecionado && st.vencStrikesCache[st.vencSelecionado]) {
                const strikes = st.vencStrikesCache[st.vencSelecionado];
                totalFiltrados = strikes.filter(function(r) { return noFiltro(r, st); }).length;
            }

            q('[data-ah]', t.root).innerHTML =
                '<span class="sc-ac__i" style="background:' + corDe(t.sym) + '">' + esc(icoDe(t.sym)) + '</span>' +
                '<div><h3>' + esc(t.sym) + ' <small>' + esc((item && item.empresa) || '') + '</small></h3>' +
                '<small><span class="sc-pulse"></span>cotação ao vivo · ' + esc(sub || '—') + (st.iv != null ? ' · IV ' + pct(st.iv * 100, 0) : '') + '</small></div>' +
                '<div class="sc-ah__s">' +
                '<div class="sc-cot sc-flash">Cotação<b>' + usd(preco) + '</b></div>' +
                '<div title="Configurações › aba Opções">🎯 Meta mensal<b>' + pct(G.metaMensal, 1) + '</b></div>' +
                '<div>Vencimentos com ≤ ' + st.dte + ' pregões: <b>' + this.getVencimentosFiltrados(t).length + '</b></div>' +
                '<div>Strikes no filtro (venc. sel.)<b>' + totalFiltrados + '</b></div>' +
                '</div>';
        },

        getVencimentosFiltrados: function (t) {
            const st = t.st;
            const dteLimite = st.dte || 5;
            return (st.vencimentos || []).filter(function (v) { return (v.dias || 0) <= dteLimite; });
        },

        // ── Cadeia de opções: CALLs à esquerda, PUTs à direita, strike no centro ──
        renderCadeia: function (t) {
            const st = t.st;
            const self = this;
            const vencimentos = this.getVencimentosFiltrados(t);
            const host = q('[data-accordion-venc]', t.root);
            if (!host) return;

            if (st.carregando || st.recarregando) {
                host.innerHTML = '<div class="sc-empty" style="padding:40px;text-align:center">' +
                    '<div class="spinner-border me-2" role="status"></div><b>Carregando opções…</b>' +
                    '<div style="margin-top:8px;font-size:11px">Consultando a corretora e reconstruindo a cadeia de strikes.</div></div>';
                return;
            }
            if (!vencimentos.length) {
                host.innerHTML = '<div class="sc-empty" style="padding:20px;text-align:center">' +
                    'Nenhum vencimento com ≤ ' + st.dte + ' pregões encontrado.</div>';
                return;
            }

            const ordenado = vencimentos.slice().sort(function(a, b) { return (a.dias || 0) - (b.dias || 0); });
            const srt = st.chainSort;
            const col = function(k) { return (srt && srt.key === k) ? ' sc-ch-on' : ''; };

            let h = '<div class="sc-chain"><table class="sc-chain__t"><thead><tr>' +
                '<th class="sc-ch-t sc-ch-l' + col('theta_c') + '" data-ch-sort="theta_c">Theta <i>›</i></th>' +
                '<th class="sc-ch-t sc-ch-l' + col('delta_c') + '" data-ch-sort="delta_c">Delta <i>›</i></th>' +
                '<th class="sc-ch-t sc-ch-l' + col('bid_c') + '" data-ch-sort="bid_c">Bid (Sell)</th>' +
                '<th class="sc-ch-t sc-ch-r' + col('ask_c') + '" data-ch-sort="ask_c">Ask (Buy)</th>' +
                '<th class="sc-ch-t sc-ch-k' + col('strike') + '" data-ch-sort="strike">Strike</th>' +
                '<th class="sc-ch-t sc-ch-l' + col('bid_p') + '" data-ch-sort="bid_p">Bid (Sell)</th>' +
                '<th class="sc-ch-t sc-ch-l' + col('ask_p') + '" data-ch-sort="ask_p">Ask (Buy)</th>' +
                '<th class="sc-ch-t sc-ch-r' + col('delta_p') + '" data-ch-sort="delta_p">Delta <i>›</i></th>' +
                '<th class="sc-ch-t sc-ch-r' + col('theta_p') + '" data-ch-sort="theta_p">Theta <i>›</i></th>' +
                '</tr></thead><tbody>';

            let temBandas = false;
            ordenado.forEach(function (v) {
                const aberto = st.vencSelecionado === v.data;
                const dados = st.vencStrikesCache[v.data];
                const carregando = !!st.vencLoading[v.data];
                const ivx = (st.vencIvAtm && st.vencIvAtm[v.data] != null)
                    ? st.vencIvAtm[v.data] : (v.iv_atm != null ? v.iv_atm : null);
                const sigla = v.tipo === 'diario' ? 'd' : v.tipo === 'semanal' ? 'w'
                    : v.tipo === 'mensal' ? 'm' : '·';
                if (aberto && ivx != null) temBandas = true;

                h += '<tr class="sc-ch-venc' + (aberto ? ' sc-ch-open' : '') + '" data-venc-toggle="' + esc(v.data) + '">' +
                    '<td class="sc-ch-dt"><span class="sc-ch-tg">' + (aberto ? '▴' : '▾') + '</span>' +
                        fmtDataBR(v.data) + '<span class="sc-ch-badge sc-ch-b-' + (v.tipo || '') + '">' + sigla + '</span></td>' +
                    '<td></td><td></td>' +
                    '<td class="sc-ch-r">' + (aberto ? '<span class="sc-ch-lbl">CALLS</span>' : '') + '</td>' +
                    '<td class="sc-ch-dias">' + (v.dias || 0) + 'd</td>' +
                    '<td class="sc-ch-l">' + (aberto ? '<span class="sc-ch-lbl">PUTS</span>' : '') + '</td>' +
                    '<td></td><td></td>' +
                    '<td class="sc-ch-r sc-ch-ivx">' + (ivx != null ? 'IVX: ' + pct(ivx * 100, 1) : 'IVX: —') + '</td>' +
                    '</tr>';

                if (aberto) {
                    if (carregando) {
                        h += '<tr class="sc-ch-msg"><td colspan="9">' +
                            '<div class="spinner-border spinner-border-sm me-2" role="status"></div>Carregando strikes…</td></tr>';
                    } else if (!dados || !dados.length) {
                        h += '<tr class="sc-ch-msg"><td colspan="9">Nenhum strike disponível para este vencimento.</td></tr>';
                    } else {
                        h += self.linhasDaCadeia(t, v, dados, st.preco || 0);
                    }
                }
            });

            h += '</tbody></table></div>';
            if (temBandas) {
                h += '<div class="sc-ch-leg"><b>±1 SD · ±2 SD</b> marcam as faixas de 1 e 2 desvios-padrão ' +
                    'em torno da cotação até o vencimento, pela IV do dia: dentro de <b>±1 SD</b> caem cerca ' +
                    'de <b>68%</b> dos resultados e dentro de <b>±2 SD</b> cerca de <b>95%</b>. ' +
                    'Elas dão a folga real até o break-even em unidades de σ — a mesma medida usada no ' +
                    'veredito “Devo operar?”.</div>';
            }
            // Preserva a rolagem anterior (re-render não deve voltar ao topo)
            const boxAntes = q('.sc-chain', host);
            const scrollAntes = boxAntes ? boxAntes.scrollTop : 0;
            host.innerHTML = h;
            const box = q('.sc-chain', host);
            if (box) {
                box.scrollTop = scrollAntes;
                // Na 1ª renderização do vencimento, centraliza a fronteira ITM
                if (!st._itmCentralizado) st._itmCentralizado = {};
                if (st.vencSelecionado && !st._itmCentralizado[st.vencSelecionado]) {
                    st._itmCentralizado[st.vencSelecionado] = true;
                    this.centralizarItm(box, st);
                }
            }
        },

        /** Rola a cadeia até deixar a fronteira ITM (strike ATM) no centro
         *  da área visível — os valores ITM ficam no centro da tela. */
        centralizarItm: function (box, st) {
            const spot = st.preco || 0;
            let alvo = null, melhor = Infinity;
            qa('tr.sc-ch-strike[data-pk]', box).forEach(function (tr) {
                const k = parseFloat(tr.dataset.pk);
                const d = Math.abs(k - spot);
                if (d < melhor) { melhor = d; alvo = tr; }
            });
            if (!alvo) return;
            const topo = alvo.offsetTop - (box.clientHeight / 2) + (alvo.offsetHeight / 2);
            box.scrollTop = Math.max(0, topo);
        },

        linhasDaCadeia: function (t, v, linhas, spot) {
            const st = t.st;
            const dados = (linhas || []).filter(Boolean);
            if (!dados.length) return '';

            // Strike mais próximo da cotação = linha do "no money" (spot)
            let atm = null;
            dados.forEach(function (r) {
                if (!atm || Math.abs(r.strike - spot) < Math.abs(atm.strike - spot)) atm = r;
            });
            // Fronteiras da faixa ITM: último call ITM e primeiro put ITM
            let callItm = null, putItm = null;
            dados.forEach(function (r) {
                if (spot > 0 && r.strike < spot) {
                    if (!callItm || r.strike > callItm.strike) callItm = r;
                } else if (spot > 0 && r.strike > spot) {
                    if (!putItm || r.strike < putItm.strike) putItm = r;
                }
            });

            // Bandas de desvio-padrão (1 e 2 desvios) em torno da cotação
            const ivAtm = st.vencIvAtm ? st.vencIvAtm[v.data] : null;
            const sd = (ivAtm && spot > 0) ? ivAtm * Math.sqrt((v.dias || 1) / 365) : null;
            const bandas = sd ? [
                { rot: '-2 SD', val: spot * (1 - 2 * sd) },
                { rot: '-1 SD', val: spot * (1 - sd) },
                { rot: '1 SD',  val: spot * (1 + sd) },
                { rot: '2 SD',  val: spot * (1 + 2 * sd) }
            ] : [];

            // Ordenação: strike crescente por padrão; clique no header ordena
            const ord = dados.slice();
            const srt = st.chainSort;
            if (srt && srt.key) {
                const valor = function (r) {
                    if (srt.key === 'strike') return r.strike || 0;
                    const lado = (srt.key.slice(-1) === 'c') ? (r.call || {}) : (r.put || {});
                    const campo = srt.key.slice(0, -1);
                    const v2 = lado[campo];
                    return (v2 === null || v2 === undefined) ? -999 : v2;
                };
                ord.sort(function (a, b) { return (valor(a) - valor(b)) * (srt.dir < 0 ? -1 : 1); });
            } else {
                ord.sort(function (a, b) { return (a.strike || 0) - (b.strike || 0); });
            }

            let h = '', bi = 0;
            ord.forEach(function (r) {
                while (bi < bandas.length && (r.strike || 0) >= bandas[bi].val) {
                    h += '<tr class="sc-ch-sd"><td colspan="9"><span class="sc-ch-sd__b">' +
                        bandas[bi].rot + '</span></td></tr>';
                    bi++;
                }
                const call = r.call || {}, put = r.put || {};
                const cCls = (spot > 0 && r.strike < spot) ? ' sc-ch-itm' : '';
                const pCls = (spot > 0 && r.strike > spot) ? ' sc-ch-itm' : '';
                const isAtm = atm && r.strike === atm.strike;
                const sel = st.K === r.strike;
                // Coluna central: barra vertical vermelha (calls ITM) / verde
                // (puts ITM) marcando a fronteira ITM no meio da tela.
                const kCls = 'sc-ch-k' + (cCls ? ' sc-ch-itm-c' : '') + (pCls ? ' sc-ch-itm-p' : '');
                h += '<tr class="sc-ch-strike' + (isAtm ? ' sc-ch-atm' : '') + (sel ? ' sc-ch-sel' : '') +
                    '" data-pk="' + r.strike + '">' +
                    '<td class="' + cCls + '">' + fmt(call.theta, 3) + '</td>' +
                    '<td class="' + cCls + '">' + fmt(call.delta, 2) + '</td>' +
                    '<td class="' + cCls + '">' + fmt(call.bid, 2) + '</td>' +
                    '<td class="' + cCls + '">' + fmt(call.ask, 2) +
                        (callItm && callItm.strike === r.strike ? '<span class="sc-ch-itmb">˄ ITM</span>' : '') + '</td>' +
                    '<td class="' + kCls + '">' + kfmt(r.strike) + (isAtm ? '<span class="sc-ch-dot"></span>' : '') + '</td>' +
                    '<td class="' + pCls + '">' +
                        (putItm && putItm.strike === r.strike ? '<span class="sc-ch-itmb">˅ ITM</span> ' : '') +
                        fmt(put.bid, 2) + '</td>' +
                    '<td class="' + pCls + '">' + fmt(put.ask, 2) + '</td>' +
                    '<td class="' + pCls + '">' + fmt(put.delta, 2) + '</td>' +
                    '<td class="' + pCls + '">' + fmt(put.theta, 3) + '</td>' +
                    '</tr>';
            });
            while (bi < bandas.length) {
                h += '<tr class="sc-ch-sd"><td colspan="9"><span class="sc-ch-sd__b">' +
                    bandas[bi].rot + '</span></td></tr>';
                bi++;
            }
            return h;
        },

        renderAccordion: function (t) {
            const st = t.st;
            const vencimentos = this.getVencimentosFiltrados(t);
            const accordionEl = q('[data-accordion-venc]', t.root);
            
            if (st.carregando) {
                accordionEl.innerHTML = '<div class="sc-empty" style="padding:20px;text-align:center"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Carregando cadeia de opções…</div>';
                return;
            }
            
            if (!vencimentos.length) {
                accordionEl.innerHTML = '<div class="sc-empty" style="padding:20px;text-align:center">Nenhum vencimento com ≤ ' + st.dte + ' pregões encontrado.</div>';
                return;
            }

            // Ordenar por data (mais próximo primeiro)
            vencimentos.sort(function(a, b) { return (a.dias || 0) - (b.dias || 0); });

            const sym = t.sym;
            accordionEl.innerHTML = vencimentos.map(function(v, idx) {
                const isSelected = v.data === st.vencSelecionado;
                const isLoaded = !!st.vencStrikesCache[v.data];
                const isLoading = !!st.vencLoading[v.data];
                const strikeCount = isLoaded ? st.vencStrikesCache[v.data].length : '—';
                const filteredCount = isLoaded ? st.vencStrikesCache[v.data].filter(function(r) { return noFiltro(r, st); }).length : '—';
                
                return '<div class="accordion-item" style="background: var(--sc-panel); border: 1px solid var(--sc-border); border-radius: 10px; margin-bottom: 8px; overflow: hidden;">' +
                    '<h2 class="accordion-header" style="margin: 0;">' +
                    '<button class="accordion-button av-btn-toggle sim-accordion-btn' + (isSelected ? '' : ' collapsed') + '" type="button" ' +
                        'data-bs-toggle="collapse" data-bs-target="#collapseVenc_' + sym + '_' + v.data + '" ' +
                        'aria-expanded="' + (isSelected ? 'true' : 'false') + '" aria-controls="collapseVenc_' + sym + '_' + v.data + '" ' +
                        'data-venc="' + esc(v.data) + '" style="background: transparent; color: var(--sc-text); font-weight: 600; font-size: 13px; padding: 12px 16px; width: 100%; text-align: left; border: none;">' +
                        '<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">' +
                        '<div style="display: flex; align-items: center; gap: 10px;">' +
                        '<span class="av-venc-tipo" style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: ' + (v.tipo === 'diario' ? 'rgba(34, 197, 94, .2)' : v.tipo === 'semanal' ? 'rgba(59, 130, 246, .2)' : 'rgba(167, 139, 250, .2)') + '; color: ' + (v.tipo === 'diario' ? '#4ade80' : v.tipo === 'semanal' ? '#60a5fa' : '#a78bfa') + ';">' + (v.tipo || '').toUpperCase() + '</span>' +
                        '<span class="av-venc-data" style="font-family: \'JetBrains Mono\', monospace; font-size: 14px;">' + fmtDataBR(v.data) + '</span>' +
                        '<span class="av-venc-dias" style="font-size: 11px; color: var(--sc-muted);">(' + (v.dias || 0) + 'd)</span>' +
                        '</div>' +
                        '<div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--sc-muted);">' +
                        '<span class="av-strike-count">Strikes: <b>' + strikeCount + '</b></span>' +
                        '<span class="av-filtered-count">| No filtro: <b>' + filteredCount + '</b></span>' +
                        (isLoading ? '<span class="spinner-border spinner-border-sm" style="width: 14px; height: 14px;" role="status"></span>' : '') +
                        '</div>' +
                        '</div>' +
                    '</button>' +
                    '</h2>' +
                    '<div id="collapseVenc_' + sym + '_' + v.data + '" class="accordion-collapse collapse' + (isSelected ? ' show' : '') + '" data-bs-parent="#accordionVenc_' + sym + '">' +
                    '<div class="accordion-body sim-accordion-body" style="padding: 0 16px 16px;">' +
                    '<div class="av-venc-content" data-venc-content="' + esc(v.data) + '">' +
                    (isLoaded ? '' : '<div class="sc-empty" style="padding: 16px; text-align: center; color: var(--sc-muted);">Clique para carregar strikes</div>') +
                    '</div>' +
                    '</div>' +
                    '</div>';
            }).join('');
        },

        toggleVencimento: function (t, vencData, btn) {
            const st = t.st;
            // Clicar no vencimento aberto fecha o accordion; clicar em outro abre.
            const fechando = st.vencSelecionado === vencData;
            st.vencSelecionado = fechando ? null : vencData;

            if (!fechando && !st.vencStrikesCache[vencData] && !st.vencLoading[vencData]) {
                this.carregarStrikesVencimento(t, vencData);
            }

            // Forçar update do card global
            this.update(t);
        },

        carregarStrikesVencimento: async function (t, vencData) {
            const st = t.st;
            st.vencLoading[vencData] = true;
            this.update(t); // Mostrar loading

            try {
                // tipo=ALL: cadeia completa (calls à esquerda, puts à direita)
                const limite = Math.max(21, Math.min(201, st.strikeLimit || 200));
                const params = 'tipo=ALL&dist_min=0&dist_max=100&delta_max=1' +
                    '&limite_strikes=' + limite +
                    '&hv=' + G.hv + '&fill=bid' +
                    '&contratos=1&comissao=0';
                let url = API_BASE + '/api/simulador/strikes?simbolo=' + encodeURIComponent(t.sym) + '&' + params;
                url += '&vencimento=' + encodeURIComponent(vencData);

                const r = await api(url);
                st.vencStrikesCache[vencData] = marcarZonas(r.strikes || [], r.preco);
                st.vencIvAtm[vencData] = (r.iv_atm != null) ? r.iv_atm
                    : (st.vencIvAtm[vencData] != null ? st.vencIvAtm[vencData] : null);
                st.vencLoading[vencData] = false;

                // Atualizar preço se necessário
                if (r.preco) st.preco = r.preco;

                // Renderizar o conteúdo do accordion
                if (st.view !== 'tbl') this.renderVencimentoContent(t, vencData);
                this.renderCardGlobal(t);
                this.update(t);
            } catch (e) {
                st.vencLoading[vencData] = false;
                st.vencStrikesCache[vencData] = [];
                if (st.view !== 'tbl') this.renderVencimentoContent(t, vencData);
                console.warn('Erro ao carregar strikes de ' + t.sym + ' para ' + vencData, e.message);
                this.update(t);
            }
        },

        renderVencimentoContent: function (t, vencData) {
            const st = t.st;
            const host = q('[data-venc-content="' + esc(vencData) + '"]', t.root);
            if (!host) return;
            
            const strikes = (st.vencStrikesCache[vencData] || []).filter(Boolean);
            const filtered = strikes.filter(function(r) { return noFiltro(r, st); });
            
            if (!strikes.length) {
                host.innerHTML = '<div class="sc-empty" style="padding: 16px;">Nenhum strike disponível para este vencimento.</div>';
                return;
            }
            
            if (!filtered.length) {
                host.innerHTML = '<div class="sc-empty" style="padding: 16px;">Nenhum strike atende aos filtros atuais. Ajuste distância ou delta.</div>';
                return;
            }
            
            // Ordenar strikes (mais próximo do spot primeiro)
            const spot = st.preco || 0;
            const ordenados = filtered.slice().sort(function(a, b) {
                return Math.abs((a.strike || 0) - spot) - Math.abs((b.strike || 0) - spot);
            });
            
            // Limitar por strikeLimit
            const limit = Math.max(5, st.strikeLimit || 200);
            const limitados = ordenados.slice(0, limit).sort(function(a, b) { return (b.strike || 0) - (a.strike || 0); });
            
            // Selecionar strike padrão se não houver
            if (st.K == null || !limitados.some(function(r) { return r.strike === st.K; })) {
                const best = melhorDe(filtered, st);
                st.K = best ? best.strike : (limitados.length ? limitados[0].strike : null);
            }
            
            const sel = limitados.find(function(r) { return r.strike === st.K; }) || null;
            const near = strikeMaisProximo(limitados);
            
            if (st.view === 'tbl') {
                this.renderTabelaDataTableVenc(t, limitados, sel, near, vencData);
            } else {
                host.innerHTML = this.escada(limitados, st, sel, near);
                // Re-bind click events for escada
                this.bindEscadaEvents(t, host);
            }
        },

        renderTabelaDataTableVenc: function (t, rows, sel, near, vencData) {
            const st = t.st, el = t.root;
            const host = q('[data-venc-content="' + esc(vencData) + '"]', el);
            const tableId = 'assetTable_' + t.sym + '_' + vencData.replace(/\//g, '-');

            // Build data array for DataTable
            const tableData = rows.map(function (r) {
                const fora = !noFiltro(r, st);
                const cls = ['sc-row'];
                if (sel && r.strike === sel.strike) cls.push('sc-sel');
                if (fora) cls.push('sc-out');
                if (near && r.strike === near.strike) cls.push('sc-near');
                
                const strikeVal = r.strike || 0;
                const premioVal = r.premio != null ? r.premio : 0;
                const distVal = r.dist != null ? r.dist : 0;
                const deltaVal = r.delta != null ? r.delta : 0;
                const popLucroVal = r.pop_lucro != null ? r.pop_lucro : 0;
                const popVal = r.pop != null ? r.pop : 0;
                const anualVal = r.anualizado != null ? r.anualizado : 0;
                const beVal = r.breakeven != null ? r.breakeven : 0;
                
                return [
                    '<b>' + usd(strikeVal) + '</b>',
                    '<span class="sc-badge sc-z-' + r.zona + '">' + r.zona + '</span>',
                    usd(premioVal),
                    pct(distVal, 2),
                    fmt(deltaVal, 2),
                    pct(popLucroVal * 100, 0),
                    pct(popVal * 100, 1),
                    pct(anualVal * 100, 0),
                    usd(beVal),
                    '<button class="sc-btn sc-btn-blue sc-btn-sm" data-pk="' + strikeVal + '">Selecionar</button>'
                ];
            });

            host.innerHTML = '<div class="dataTables_scrollBody" style="max-height:400px;"><table id="' + tableId + '" class="dataTable" style="width:100%"><thead><tr>' +
                '<th>Strike</th><th>Zona</th><th class="dt-type-numeric">Prêmio (unit.)</th><th class="dt-type-numeric">Dist.</th><th class="dt-type-numeric">Delta</th><th class="dt-type-numeric">PoP</th><th class="dt-type-numeric">Exerc.</th><th class="dt-type-numeric">Anual.</th><th class="dt-type-numeric">Break-even</th><th>Ação</th></tr></thead><tbody></tbody></table></div>';

            function initAssetDataTable() {
                const $jq = window.$;
                if (!$jq || !$jq.fn || !$jq.fn.DataTable) {
                    if (!window._assetDtWaitCount) window._assetDtWaitCount = 0;
                    if (window._assetDtWaitCount < 50) {
                        window._assetDtWaitCount++;
                        setTimeout(initAssetDataTable, 100);
                    }
                    return;
                }
                window._assetDtWaitCount = 0;

                if ($jq.fn.DataTable.isDataTable('#' + tableId)) {
                    $jq('#' + tableId).DataTable().destroy();
                }

                $jq('#' + tableId).DataTable({
                    data: tableData,
                    pageLength: 10,
                    lengthMenu: [[10, 25, 50, -1], [10, 25, 50, 'Todos']],
                    language: DT_PT_BR,
                    order: [[0, 'desc']],
                    columnDefs: [
                        { orderable: false, targets: -1 },
                        { type: 'num-fmt', targets: [0, 2, 3, 4, 5, 6, 7, 8] },
                        { className: 'dt-body-right', targets: [0, 2, 3, 4, 5, 6, 7, 8] }
                    ],
                    scrollY: '380px',
                    scrollCollapse: true,
                    paging: true,
                    fixedHeader: true,
                    dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>><"table-responsive"tr><"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
                    drawCallback: function () {
                        $jq('#' + tableId + ' button[data-pk]').off('click').on('click', function() {
                            const pk = parseFloat($jq(this).data('pk'));
                            if (pk) { st.K = pk; AssetView.update(t); }
                        });
                        $jq('#' + tableId + ' tbody tr').each(function() {
                            const strikeCell = $jq(this).find('td:eq(0)').text().replace(/US\$ /g, '').replace(',', '.').trim();
                            const strikeNum = parseFloat(strikeCell);
                            if (!isNaN(strikeNum)) {
                                if (sel && strikeNum === sel.strike) $jq(this).addClass('selected');
                                if (near && strikeNum === near.strike) $jq(this).addClass('sc-near');
                            }
                        });
                    }
                });
            }

            if (rows.length) {
                initAssetDataTable();
            }
        },

        bindEscadaEvents: function (t, host) {
            const st = t.st;
            host.querySelectorAll('[data-pk]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    st.K = parseFloat(this.dataset.pk);
                    AssetView.update(t);
                });
            });
        },

        renderView: function (t, rows, sel, near, nFiltro) {
            // Não usado mais - substituído pelo accordion
        },

        renderTabelaDataTable: function (t, rows, sel, near) {
            // Não usado mais - substituído por renderTabelaDataTableVenc
        },

        renderView: function (t, rows, sel, near, nFiltro) {
            const st = t.st, el = t.root;
            const vt = q('[data-vt]', el);
            vt.innerHTML = nFiltro + ' strike(s) no filtro <small>' + (st.showAll ? '· fora do filtro esmaecidos' : '') + '</small>';
            const host = q('[data-view]', el);
            if (st.carregando || st.strikes === null) { host.innerHTML = '<div class="sc-empty">Carregando strikes de ' + esc(t.sym) + '…</div>'; return; }
            if (!st.strikes.length) { host.innerHTML = '<div class="sc-empty">Erro ao carregar strikes de ' + esc(t.sym) + '. Verifique a conexão e tente atualizar.</div>'; return; }
            if (!rows.length) { host.innerHTML = '<div class="sc-empty">Nenhum strike atende aos filtros. Abra a distância ou aumente o delta máximo.</div>'; return; }

            if (st.view === 'tbl') {
                this.renderTabelaDataTable(t, rows, sel, near);
            } else {
                host.innerHTML = this.escada(rows, st, sel, near);
            }
        },

        renderTabelaDataTable: function (t, rows, sel, near) {
            const st = t.st, el = t.root;
            const host = q('[data-view]', el);
            const tableId = 'assetTable_' + t.sym;

            // Build data array for DataTable - plain formatted values for robust sorting
            const tableData = rows.map(function (r) {
                const fora = !noFiltro(r, st);
                const cls = ['sc-row'];
                if (sel && r.strike === sel.strike) cls.push('sc-sel');
                if (fora) cls.push('sc-out');
                if (near && r.strike === near.strike) cls.push('sc-near');
                
                const strikeVal = r.strike || 0;
                const premioVal = r.premio != null ? r.premio : 0;
                const distVal = r.dist != null ? r.dist : 0;
                const deltaVal = r.delta != null ? r.delta : 0;
                const popLucroVal = r.pop_lucro != null ? r.pop_lucro : 0;
                const popVal = r.pop != null ? r.pop : 0;
                const anualVal = r.anualizado != null ? r.anualizado : 0;
                const beVal = r.breakeven != null ? r.breakeven : 0;
                
                return [
                    '<b>' + usd(strikeVal) + '</b>',                                    // Strike (US$ formato)
                    '<span class="sc-badge sc-z-' + r.zona + '">' + r.zona + '</span>', // Zona badge
                    usd(premioVal),                                                       // Prêmio unitário
                    pct(distVal, 2),                                                      // Distância
                    fmt(deltaVal, 2),                                                     // Delta
                    pct(popLucroVal * 100, 0),                                            // PoP lucro %
                    pct(popVal * 100, 1),                                                 // Exercício %
                    pct(anualVal * 100, 0),                                               // Anualizado %
                    usd(beVal),                                                           // Break-even
                    '<button class="sc-btn sc-btn-blue sc-btn-sm" data-pk="' + strikeVal + '">Selecionar</button>' // Ação
                ];
            });

            // Render table skeleton - pm-ledger style (igual ao raio-x do preço médio)
            host.innerHTML = '<div class="dataTables_scrollBody" style="max-height:420px;"><table id="' + tableId + '" class="dataTable" style="width:100%"><thead><tr>' +
                '<th>Strike</th><th>Zona</th><th class="dt-type-numeric">Prêmio (unit.)</th><th class="dt-type-numeric">Dist.</th><th class="dt-type-numeric">Delta</th><th class="dt-type-numeric">PoP</th><th class="dt-type-numeric">Exerc.</th><th class="dt-type-numeric">Anual.</th><th class="dt-type-numeric">Break-even</th><th>Ação</th></tr></thead><tbody></tbody></table></div>';

            // Initialize DataTable with fixed header and pagination
            function initAssetDataTable() {
                const $jq = window.$;
                if (!$jq || !$jq.fn || !$jq.fn.DataTable) {
                    if (!window._assetDtWaitCount) window._assetDtWaitCount = 0;
                    if (window._assetDtWaitCount < 50) {
                        window._assetDtWaitCount++;
                        setTimeout(initAssetDataTable, 100);
                    }
                    return;
                }
                window._assetDtWaitCount = 0;

                // Destroy existing if any
                if ($jq.fn.DataTable.isDataTable('#' + tableId)) {
                    $jq('#' + tableId).DataTable().destroy();
                }

                assetDataTables[t.sym] = $jq('#' + tableId).DataTable({
                    data: tableData,
                    pageLength: 10,
                    lengthMenu: [[10, 25, 50, -1], [10, 25, 50, 'Todos']],
                    language: DT_PT_BR,
                    order: [[0, 'desc']], // Strike decrescente
                    columnDefs: [
                        { orderable: false, targets: -1 }, // Ação não ordenável
                        { type: 'num-fmt', targets: [0, 2, 3, 4, 5, 6, 7, 8] }, // Números ordenáveis
                        { className: 'dt-body-right', targets: [0, 2, 3, 4, 5, 6, 7, 8] } // Alinhar números à direita
                    ],
                    scrollY: '400px',
                    scrollCollapse: true,
                    paging: true,
                    fixedHeader: true,
                    dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>><"table-responsive"tr><"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
                    drawCallback: function () {
                        // Re-bind click events for "Selecionar" buttons
                        $jq('#' + tableId + ' button[data-pk]').off('click').on('click', function() {
                            const pk = parseFloat($jq(this).data('pk'));
                            if (pk) { st.K = pk; AssetView.update(t); }
                        });
                        // Highlight selected/near rows using cell text matching
                        $jq('#' + tableId + ' tbody tr').each(function() {
                            const strikeCell = $jq(this).find('td:eq(0)').text().replace(/US\$ /g, '').replace(',', '.').trim();
                            const strikeNum = parseFloat(strikeCell);
                            if (!isNaN(strikeNum)) {
                                if (sel && strikeNum === sel.strike) $jq(this).addClass('selected');
                                if (near && strikeNum === near.strike) $jq(this).addClass('sc-near');
                            }
                        });
                    }
                });
            }

            if (rows.length) {
                initAssetDataTable();
            }
        },

        escada: function (rows, st, sel, near) {
            const maxN = Math.max.apply(null, [1].concat(rows.map(function (r) { return Math.max(0, r.premio_liquido || 0); })));
            const simbolo = st.sym || '';
            let h = '<div class="sc-lad__r sc-hd"><span>Strike</span><span>Prêmio líquido</span><span>Delta</span><span>PoP</span><span>Anual.</span><span></span></div>';
            let spotDone = false;
            const spot = function () { return '<div class="sc-spotline">▶ ' + esc(simbolo) + ' ' + usd(st.preco) + ' (cotação)</div>'; };
            rows.forEach(function (r) {
                if (!spotDone && st.preco != null && r.strike < st.preco) { h += spot(); spotDone = true; }
                const fora = !noFiltro(r, st);
                const cls = ['sc-lad__r'];
                if (sel && r.strike === sel.strike) cls.push('sc-sel');
                if (fora) cls.push('sc-out');
                if (near && r.strike === near.strike) cls.push('sc-near');
                h += '<div class="' + cls.join(' ') + '" data-pk="' + r.strike + '"><span class="sc-k">' + kfmt(r.strike) + '<span class="sc-badge sc-z-' + r.zona + '">' + r.zona + '</span></span><span class="sc-bar"><i style="width:' + (Math.max(0, r.premio_liquido || 0) / maxN * 100) + '%"></i><span>' + sg(r.premio_liquido) + '</span></span><span>' + fmt(r.delta, 2) + '</span><span class="' + ((r.pop_lucro || 0) >= 0.85 ? 'sc-up' : (r.pop_lucro || 0) < 0.7 ? 'sc-amb' : '') + '">' + pct((r.pop_lucro || 0) * 100, 0) + '</span><span>' + pct((r.anualizado || 0) * 100, 0) + '</span></div>';
            });
            if (!spotDone) h += spot();
            return h;
        },

        renderCardGlobal: function (t) {
            const el = t.root, st = t.st;
            const nInput = q('input[data-k="n"]', el);
            
            // Obter strike selecionado do vencimento atual
            let r = null;
            if (st.vencSelecionado && st.vencStrikesCache[st.vencSelecionado]) {
                const strikes = st.vencStrikesCache[st.vencSelecionado];
                r = strikes.find(function(s) { return s.strike === st.K; }) || null;
            }
            // Fallback: se não tem vencimento selecionado mas tem K, buscar em qualquer cache
            if (!r && st.K != null) {
                for (const vencData in st.vencStrikesCache) {
                    const found = st.vencStrikesCache[vencData].find(function(s) { return s.strike === st.K; });
                    if (found) { r = found; break; }
                }
            }

            if (!r) {
                q('[data-ct]', el).textContent = 'Selecione um strike';
                q('[data-cz]', el).textContent = '';
                q('[data-ins]', el).innerHTML = 'Nenhum strike selecionado.';
                q('[data-m]', el).innerHTML = '';
                q('[data-hero]', el).innerHTML = ''; q('[data-ver]', el).innerHTML = '';
                q('[data-dec]', el).innerHTML = ''; q('[data-ctx]', el).innerHTML = '';
                q('[data-ex]', el).innerHTML = ''; return;
            }
            const lote = r.capital || r.strike * 100;
            // Sem saldo de referência: limite fixo de 10 contratos para o input
            const maxN = 10;
            nInput.max = maxN; if (st.n > maxN) st.n = maxN; if (st.n < 1) st.n = 1; sync(el, st);
            const c = st.n, net = (r.premio_liquido || 0) * c, lotT = lote * c;
            const annLot = (r.anualizado || 0) * 100;
            const popLucro = r.pop_lucro || 0, pExerc = r.pop || 0;
            // Buscar data do vencimento selecionado
            const vencObj = (st.vencimentos || []).find(function(v) { return v.data === st.vencSelecionado; });
            // Exercícios/mês = quantos ciclos deste PRAZO cabem em 21 pregões × PoP.
            // Usa os dias REAIS do vencimento selecionado (não o filtro DTE do scanner).
            const diasVenc = vencObj && vencObj.dias ? vencObj.dias : (st.dte || 1);
            const perMes = 21 / Math.max(1, diasVenc) * pExerc;
            const venc = vencObj ? fmtDataBR(vencObj.data) + ' (' + vencObj.dias + 'd · ' + vencObj.tipo + ')' : '—';
            const spot = st.preco || 0;
            const be = r.breakeven, K = r.strike;
            const iv = r.iv, ev = r.ev;
            const roc = (net > 0 && lotT > 0) ? (net / lotT * 100) : ((r.roc || 0) * 100);
            // Margem de segurança: quanto a cotação pode cair até o break-even
            const margem = (spot > 0 && be > 0) ? ((spot - be) / spot * 100) : null;
            // Spread bid/ask como proxy de liquidez
            const spread = (r.bid != null && r.ask != null && r.ask > 0) ? (r.ask - r.bid) : null;
            const spreadPct = (spread != null && r.ask > 0) ? (spread / r.ask * 100) : null;
            // Prêmio vs valor justo (preço teórico pela HV): positivo = prêmio acima do justo
            const diffEV = (r.fair != null && r.premio != null) ? (r.premio - r.fair) : null;

            // Título do contrato - DESTAQUE: Data exercício, Strike, Prêmio
            q('[data-ct]', el).innerHTML =
                '<span style="font-size:15px;font-weight:800">PUT ' + t.sym + ' ' + kfmt(r.strike) + '</span>' +
                '<span style="margin-left:12px;color:var(--sc-cyan)">' + venc + '</span>';
            q('[data-cz]', el).innerHTML =
                '<span class="sc-badge sc-z-' + r.zona + '">' + r.zona + '</span> ' +
                pct(Math.abs(r.dist || 0), 2) + ' ' + ((r.dist || 0) >= 0 ? 'abaixo' : 'acima') +
                ' da cotação · Lote <b>' + usd(lote, 0) + '</b> · Prêmio unitário <b>' + usd(r.premio) + '</b>';

            const premEl = q('[data-prem]', el);
            tween(premEl, net, function (v) { return sg(v); });
            premEl.className = 'sc-cc__v ' + (net >= 0 ? 'sc-up' : 'sc-down');
            q('[data-prems]', el).textContent = c + ' contrato(s) · Preço Bid ' + fmt(r.premio, 3);

            // ── Termômetro "Devo operar?" + tiles grandes Capital/ROC/Dias ──
            const vencIso = vencObj ? vencObj.data : null;
            const aval = avaliarOpcao(r, {
                contratos: c,
                spot: spot,
                diasCorridos: diasCorridos(vencIso),
                diasAteFimDoMes: diasAteFimDoMes(),
                meta: G.metaMensal,
            });
            q('[data-dec]', el).innerHTML = renderDecisao(aval);
            q('[data-hero]', el).innerHTML = renderTiles(aval, vencIso, vencObj ? vencObj.dias : null);

            tween(q('[data-pop]', el), popLucro * 100, function (v) { return pct(v, 0); });
            ring(q('[data-r1]', el), popLucro, popLucro >= 0.85 ? '#22c55e' : popLucro >= 0.7 ? '#f59e0b' : '#ef4444');

            // Veredito rápido de decisão
            const ver = [];
            if (margem != null) {
                const cls = margem >= 3 ? 'sc-up' : margem >= 1 ? 'sc-amb' : 'sc-down';
                ver.push('<div class="sc-ver__i"><span>Margem até break-even</span><b class="' + cls + '">' + pct(margem, 2) + '</b></div>');
            }
            if (diffEV != null) {
                const cls = diffEV >= 0 ? 'sc-up' : 'sc-amb';
                ver.push('<div class="sc-ver__i"><span>Prêmio vs justo (HV)</span><b class="' + cls + '">' + (diffEV >= 0 ? '+' : '') + usd(diffEV) + '</b></div>');
            }
            if (spreadPct != null) {
                const cls = spreadPct <= 5 ? 'sc-up' : spreadPct <= 12 ? 'sc-amb' : 'sc-down';
                ver.push('<div class="sc-ver__i"><span>Spread bid/ask</span><b class="' + cls + '">' + pct(spreadPct, 1) + '</b></div>');
            }
            q('[data-ver]', el).innerHTML = ver.join('');

            // Métricas detalhadas
            q('[data-m]', el).innerHTML =
                '<div><span>Prêmio total</span><b>' + sg(net) + '</b></div>' +
                '<div><span>Capital total</span><b>' + usd(lotT, 0) + '</b></div>' +
                '<div><span>% Anual (lote)</span><b>' + pct(annLot, 1) + '</b></div>' +
                '<div><span>Prob. Exercício</span><b class="' + (pExerc > 0.2 ? 'sc-amb' : '') + '">' + pct(pExerc * 100, 1) + '</b></div>' +
                '<div><span>Break-even</span><b>' + usd(be) + '</b></div>' +
                '<div><span>Delta</span><b>' + fmt(r.delta, 2) + '</b></div>' +
                '<div><span>IV implícita</span><b>' + (iv != null ? pct(iv * 100, 1) : '—') + '</b></div>' +
                '<div><span>Valor justo (HV)</span><b>' + (r.fair != null ? usd(r.fair) : '—') + '</b></div>';

            // Contexto de decisão
            const ctx = [];
            ctx.push('<div class="sc-ctx__i"><span>Cotação</span><b>' + usd(spot) + '</b></div>');
            ctx.push('<div class="sc-ctx__i"><span>Strike</span><b>' + usd(K) + '</b></div>');
            ctx.push('<div class="sc-ctx__i"><span>Dist. ao strike</span><b>' + fmt(r.dist, 2) + '%</b></div>');
            if (margem != null) ctx.push('<div class="sc-ctx__i"><span>Queda até BE</span><b class="' + (margem >= 3 ? 'sc-up' : 'sc-amb') + '">' + pct(margem, 2) + '</b></div>');
            ctx.push('<div class="sc-ctx__i"><span>Bid / Ask</span><b>' + fmt(r.bid) + ' / ' + fmt(r.ask) + '</b></div>');
            ctx.push('<div class="sc-ctx__i"><span>Prob. lucro</span><b class="' + (popLucro >= 0.85 ? 'sc-up' : popLucro < 0.7 ? 'sc-amb' : '') + '">' + pct(popLucro * 100, 0) + '</b></div>');
            ctx.push('<div class="sc-ctx__i"><span>Exerc./mês</span><b>≈ ' + fmt(perMes, 1) + '</b></div>');
            if (ev != null) ctx.push('<div class="sc-ctx__i"><span>EV (HV)</span><b class="' + (ev >= 0 ? 'sc-up' : 'sc-down') + '">' + sg(ev) + '</b></div>');
            q('[data-ctx]', el).innerHTML = ctx.join('');

            // Preço de execução (Bid / Mid / Ask) e prêmio mínimo para a meta
            q('[data-ex]', el).innerHTML = renderExecucao(r, c, lotT, aval.meta, aval.dias);

            const alertasHtml = (aval.alertas || []).map(function (a) {
                return '<div class="sc-al sc-al-' + a[0] + '"><b>' +
                    (a[0] === 'bad' ? '⛔' : '⚠️') + ' ' + a[1] + ':</b> ' + a[2] + '</div>';
            }).join('');

            q('[data-ins]', el).innerHTML =
                '💡 Você recebe <b>' + sg(net) + '</b> (' + c + ' contrato(s)). ' +
                'Há <b>' + pct(pExerc * 100, 1) + '</b> de chance de exercício (≈ ' + fmt(perMes, 1) +
                ' por mês repetindo a cada ' + diasVenc + ' pregão(ões)) e <b>' + pct(popLucro * 100, 0) +
                '</b> de chance de lucro (preço final acima de ' + usd(be) + '). ' +
                'Se exercido, custo efetivo = <b>' + usd(be) + '</b> e CALL de saída ≥ <b>' + usd(K) + '</b>. ' +
                'Com meta de <b>' + pct(aval.meta, 1) + '</b> ao mês (Configurações › Opções), o ritmo desta ' +
                'operação é <b>' + fmt(aval.ritmo, 2) + '×</b> a meta e projeta <b>' + pct(aval.projRest, 2) +
                '</b> nas ' + fmt(aval.semMes, 1) + ' semanas restantes do mês.' +
                alertasHtml;
        },
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Dados: status, conta, universo e prêmios
    // ═══════════════════════════════════════════════════════════════════════
    async function carregarStatus() {
        const s = await api(API_BASE + '/api/simulador/status');
        D.status = s;
        const badge = $('simStatusBadge');
        if (s.configurado) { badge.className = 'badge bg-success-lt'; badge.textContent = 'tastytrade conectado'; }
        else { badge.className = 'badge bg-warning-lt'; badge.textContent = 'credenciais incompletas'; }
        $('simStatusDetalhe').textContent = s.ambiente + ' · ' + String(s.base_url || '').replace('https://', '');
        const aviso = $('simAvisoConfig');
        if (!s.configurado) {
            const faltando = [];
            if (!s.tem_client_id) faltando.push('TASTYTRADE_CLIENT_ID');
            if (!s.tem_client_secret) faltando.push('TASTYTRADE_CLIENT_SECRET');
            if (!s.tem_refresh_token) faltando.push('TASTYTRADE_REFRESH_TOKEN');
            $('simAvisoConfigTexto').textContent = ' Preencha ' + faltando.join(', ') + ' em backend/.env. Até lá nenhuma cotação é retornada — a tela não usa dados fictícios.';
            aviso.classList.remove('d-none');
        } else { aviso.classList.add('d-none'); }
        return s;
    }

    async function carregarConta() {
        try {
            const r = await api(API_BASE + '/api/simulador/conta');
            // Saldo da conta não é mais usado para filtro do scanner
            if (r.saldo != null) {
                D.saldoOk = true;
            }
        } catch (e) { console.warn('Sem saldo da conta:', e.message); }
    }

    async function carregarUniverso() {
        // Carregar universo (backend limita a 100 símbolos por padrão via LIMITE_SIMBOLOS_COTACAO)
        const r = await api(API_BASE + '/api/simulador/universo?max_preco=1000&max_lote=1000000');
        D.universo = r.itens || []; renderAbas();
    }

    function candidatosPremios() {
        // Fila de leitura: todo ativo do scanner ainda sem prêmio.
        // Não usa `ok` — um ativo sem dado ainda não pode ser julgado, e
        // depender de `ok` fazia o ativo "sumir" da releitura após um filtro.
        return SC.candidatos()
            .map(function (s) { return s.simbolo; })
            .filter(function (sym) { return !D.premios[sym]; });
    }

    async function carregarPremios(limpar) {
        if (limpar) D.premios = {};
        const meu = ++seqPremios;
        const pendentes = candidatosPremios();
        if (!pendentes.length) { SC.update(); return; }
        const rodadas = chunk(pendentes, MAX_POR_RODADA);
        leiturasPremios++;
        try {
            for (const rodada of rodadas) {
                if (meu !== seqPremios) return;
                try {
                    const r = await api(API_BASE + '/api/simulador/premios?simbolos=' + encodeURIComponent(rodada.join(',')) + '&distancia_pct=' + DIST_PADRAO + '&com_strikes=1&dte=' + G.dte + '&hv=' + G.hv + '&fill=bid');
                    (r.itens || []).filter(Boolean).forEach(function (i) { if (i && i.simbolo) D.premios[i.simbolo] = i; });
                    // Ativo recusado pela corretora (sem cadeia/prêmio): grava vazio
                    // para não entrar em laço de releitura nem gerar best nulo.
                    (r.erros || []).forEach(function (e) {
                        if (e && e.simbolo && !D.premios[e.simbolo]) {
                            D.premios[e.simbolo] = { simbolo: e.simbolo, strikes: [] };
                        }
                    });
                } catch (e) { console.warn('Falha ao carregar prêmios:', e.message); }
            }
        } finally {
            leiturasPremios--;
        }
        if (meu === seqPremios) SC.update();
    }

    const recarregarPremios = debounce(function () { 
        SC._premiosIniciado = false; // Reset para carregar prêmios dos novos ativos visíveis
        carregarPremios(true); 
    }, 450);

    async function garantirAtivo(simbolo) {
        if (!D.universo.some(function (i) { return i.simbolo === simbolo; })) {
            try {
                const r = await api(API_BASE + '/api/simulador/universo?simbolos=' + encodeURIComponent(simbolo));
                (r.itens || []).forEach(function (i) { if (!D.universo.some(function (u) { return u.simbolo === i.simbolo; })) D.universo.push(i); });
                renderAbas();
            } catch (_) { }
        }
        if (!D.premios[simbolo]) {
            try {
                const r = await api(API_BASE + '/api/simulador/premios?simbolos=' + encodeURIComponent(simbolo) + '&distancia_pct=' + DIST_PADRAO + '&com_strikes=1&dte=' + G.dte + '&hv=' + G.hv + '&fill=bid');
                (r.itens || []).filter(Boolean).forEach(function (i) { if (i && i.simbolo) D.premios[i.simbolo] = i; });
                (r.erros || []).forEach(function (e) {
                    if (e && e.simbolo && !D.premios[e.simbolo]) D.premios[e.simbolo] = { simbolo: e.simbolo, strikes: [] };
                });
                renderAbas(); SC.update();
            } catch (_) { }
        }
        // A cadeia (/cadeia) já é carregada por abrirAba(); repeti-la aqui
        // gerava uma 2ª requisição a cada abertura de aba.
    }

    async function atualizarTudo() {
        // Loading DENTRO da área onde as opções são listadas — em todas as
        // abas de ativo abertas (o botão de recarregar é global).
        Object.keys(ativos).forEach(function (sym) {
            ativos[sym].st.recarregando = true;
            AssetView.update(ativos[sym]);
        });
        try { showGlobalLoading(true); await Promise.all([carregarStatus(), carregarConta()]); await carregarUniverso(); await carregarPremios(true); G.updated = new Date(); marcarAtualizado(); renderAbas(); if (abaAtual === 'scan') SC.update(); else if (ativos[abaAtual]) AssetView.carregar(ativos[abaAtual]); }
        catch (e) { toastErro('Erro ao consultar a tastytrade', e.message); }
        finally {
            showGlobalLoading(false);
            Object.keys(ativos).forEach(function (sym) {
                ativos[sym].st.recarregando = false;
                AssetView.update(ativos[sym]);
            });
        }
    }

    function marcarAtualizado() { $('scUpd').textContent = 'Atualizado: ' + (G.updated ? G.updated.toTimeString().slice(0, 5) : '--:--'); }

    // ═══════════════════════════════════════════════════════════════════════
    // Eventos globais
    // ══════════════════════════════════════════════════════════════════════
    function bindGlobal() {
        $('btnSimular').addEventListener('click', atualizarTudo);
        $('scRefresh').addEventListener('click', atualizarTudo);

        document.addEventListener('click', function (e) {
            const b = e.target.closest('[data-sem-acesso]');
            if (!b) return;
            toastAviso('Não disponível', '"' + b.getAttribute('data-sem-acesso') + '" não está disponível: o sistema é somente leitura e não envia ordens à corretora.');
        });
        ['bClose', 'bCalc', 'bUse'].forEach(function (id) {
            $(id).addEventListener('click', function () {
                const rotulo = id === 'bClose' ? 'Fechar' : id === 'bCalc' ? 'Calcular' : 'Usar como Nova Operação';
                toastAviso('Não disponível', '"' + rotulo + '" não está disponível: o sistema é somente leitura e não envia ordens à corretora.');
            });
        });

        $('scTabs').addEventListener('click', function (e) {
            const x = e.target.closest('[data-x]');
            if (x) { e.stopPropagation(); fecharAba(x.dataset.x); return; }
            const b = e.target.closest('[data-t]');
            if (b) { mostrarAba(b.dataset.t); if (b.dataset.t !== 'scan') history.replaceState(null, '', location.pathname + '?ativo=' + encodeURIComponent(b.dataset.t)); else history.replaceState(null, '', location.pathname); }
        });
    }

    // ─── Inicialização ───────────────────────────────────────────────────────
    /** Lê a meta mensal (%) de Configurações › aba Opções. */
    async function carregarMetaMensal() {
        try {
            const r = await fetch(API_BASE + '/api/config');
            const cfg = await r.json();
            const v = parseFloat(cfg && (cfg.metaMensalOpcoes || cfg.metaMensal));
            if (!isNaN(v) && v > 0) G.metaMensal = v;
        } catch (_) { /* mantém o padrão 1,8% */ }
    }

    function init() {
        const host = $('scHost');
        const sroot = document.createElement('div');
        host.appendChild(sroot);
        SC.mount(sroot);
        bindGlobal();

        // Meta mensal alterada em Configurações › Opções → recalcular o veredito
        window.addEventListener('opcoesConfigUpdated', function (ev) {
            const v = parseFloat(ev && ev.detail && ev.detail.metaMensalOpcoes);
            if (!isNaN(v) && v > 0) {
                G.metaMensal = v;
                Object.keys(ativos).forEach(function (sym) { AssetView.update(ativos[sym]); });
            }
        });

        (async () => {
            await carregarMetaMensal();
            try { await carregarStatus(); } catch (e) { toastErro('Erro ao carregar status', e.message); }
            await carregarConta();
            await atualizarTudo();

            const ativoUrl = new URLSearchParams(location.search).get('ativo');
            if (ativoUrl) abrirAba(ativoUrl.toUpperCase());
        })();
    }

    if (window.__appLayoutReady) init(); else document.addEventListener('layoutReady', init, { once: true });
})();
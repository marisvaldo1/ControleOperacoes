let allOperacoes = [];
let tableMesAtual, tableHistorico;
let chartAnual = null;
let chartAccumulated = null;
let chartCapitalEvolution = null;
let chartAssetDist = null;
let chartSaldoAcumulado = null;
let chartSaldoTipo = null;
let chartInsightsDistribuicao = null;
let chartInsightsEvolution = null;
let opcoesDisponiveis = [];
let cotacaoAtivoBase = null;
let currentChatHistory = [];
let lastSimParams = null;
let lastSimResult = null;
let lastSimAgent = null;
let lastSimModel = null;
let chartDetalhesInstance = null;
let currentDetalhesOpId = null;
let lastUpdateTimestamp = {};
let cotacoesCache = new Map(); // Cache de cotações para evitar múltiplas requisições

// Limpar cache de cotações a cada 5 minutos para garantir dados atualizados
setInterval(() => {
    if (cotacoesCache && cotacoesCache.size > 0) {
        cotacoesCache.clear();
        console.log('Cache de cotações limpo');
    }
}, 5 * 60 * 1000); // 5 minutos

/**
 * Converte string de valor monetário (brasileiro ou americano) para número
 * Suporta: "37,65", "37.65", "1.234,56", "1234.56"
 */
function parseFloatSafe(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    const str = String(value).trim();
    
    // Detectar formato: se tem vírgula E ponto, é brasileiro (1.234,56)
    // Se tem apenas vírgula, é brasileiro (37,65)
    // Se tem apenas ponto, é americano (37.65 ou 1234.56)
    
    if (str.includes(',') && str.includes('.')) {
        // Formato brasileiro com milhar: "1.234,56" -> remove ponto, substitui vírgula
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    } else if (str.includes(',')) {
        // Formato brasileiro sem milhar: "37,65" -> substitui vírgula
        return parseFloat(str.replace(',', '.'));
    } else {
        // Formato americano: "37.65" ou "1234.56" -> direto
        return parseFloat(str);
    }
}

document.addEventListener('layoutReady', function() {
    console.log('[Opcoes] Evento layoutReady recebido, carregando operações...');
    initDataTables();
    loadOperacoes();
    loadAvailableAIs(); // Carregar IAs disponíveis
    
    // Atualizar status do mercado no navbar
    updateMarketStatus();
    // Atualizar a cada minuto
    setInterval(updateMarketStatus, 60000);
    
    document.getElementById('btnNovaOperacao').addEventListener('click', openNewModal);
    document.getElementById('btnSimularOperacao').addEventListener('click', openSimularModal);
    document.getElementById('btnSaveOperacao').addEventListener('click', saveOperacao);
    document.getElementById('btnRefresh')?.addEventListener('click', refreshQuotes);
    
    // REMOVIDO: Botão de refresh detalhes agora está em detalhe-opcoes.js
    // document.getElementById('btnRefreshDetalhes')?.addEventListener('click', refreshDetalhesOperacao);
    // setupDetalhesTabs();
    
    // Configurações de IA
    document.getElementById('btnSalvarConfigIA').addEventListener('click', salvarConfigIA);
    document.getElementById('btnTestarIA').addEventListener('click', testarConexaoIA);
    
    // Buscar opções ao clicar no botão
    document.getElementById('btnBuscarOpcoes').addEventListener('click', buscarOpcoesAPI);
    
    // Enter no campo ativo base também busca
    document.getElementById('inputAtivoBase').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarOpcoesAPI();
        }
    });

    // Blur no campo ativo base busca cotação
    document.getElementById('inputAtivoBase').addEventListener('blur', function() {
        const ativoBase = this.value.trim().toUpperCase();
        if (ativoBase) {
            buscarCotacaoAtivoBase(ativoBase);
        }
    });

    document.getElementById('inputAtivo').addEventListener('blur', function() {
        const ativo = this.value.trim().toUpperCase();
        if (ativo) {
            buscarDadosOpcao(ativo);
        }
    });
    
    // Forçar uppercase nos campos de texto
    document.getElementById('inputAtivoBase').addEventListener('input', forcarUppercase);
    document.getElementById('inputAtivo').addEventListener('input', forcarUppercase);

    // Listen for theme changes to update charts
    document.addEventListener('themeChanged', function(e) {
        // Update Main Charts
        updateUI();
        
        // Update Simulation Charts if open
        if (chartSimLucroInstance && document.getElementById('modalSimulacao') && document.getElementById('modalSimulacao').classList.contains('show')) {
            const isDarkMode = e.detail.theme === 'dark';
            const textColor = isDarkMode ? '#f8f9fa' : '#666666';
            
            // Update Text Colors
            if (chartSimLucroInstance.options.scales.x.ticks) chartSimLucroInstance.options.scales.x.ticks.color = textColor;
            if (chartSimLucroInstance.options.scales.y.ticks) chartSimLucroInstance.options.scales.y.ticks.color = textColor;
            chartSimLucroInstance.update();
        }
    });
    
    // Botão de atualização manual
    document.getElementById('btnAtualizarDados')?.addEventListener('click', function() {
        const ticker = document.getElementById('inputAtivo').value;
        if (ticker) {
            buscarDadosOpcao(ticker);
        } else {
            iziToast.warning({title: 'Aviso', message: 'Preencha o código do ativo'});
        }
    });
    
    // Filtros da modal de opções
    document.getElementById('filtroVencimento').addEventListener('change', filtrarOpcoes);
    document.getElementById('filtroBusca').addEventListener('input', filtrarOpcoes);

    // Refresh Simulação
    document.getElementById('btnRefreshSim')?.addEventListener('click', function() {
        buscarOpcoesSimulacaoHibrida();
    });
    
    // AI Analysis Button
    document.getElementById('btnAnaliseIA')?.addEventListener('click', analyzeSimWithAI);
    
    // Technical Analysis Button
    document.getElementById('btnAnaliseTecnica')?.addEventListener('click', openTechnicalAnalysisModal);

    // Init Simulation Events
    initSimulacaoEvents();
    
    // Init Currency Inputs
    initCurrencyInputs();

    // Modal saldo corretora
    const saldoCard = document.getElementById('cardSaldoCorretoraCard');
    if (saldoCard) {
        saldoCard.addEventListener('click', openSaldoCorretoraModal);
        saldoCard.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.key === ' ') openSaldoCorretoraModal();
        });
    }
    document.getElementById('btnFiltrarSaldo')?.addEventListener('click', updateSaldoCorretoraModal);
    document.getElementById('btnSaldoInsights')?.addEventListener('click', openSaldoInsightsModal);
    document.getElementById('saldoPeriodo')?.addEventListener('change', function() {
        if (this.value !== 'custom') {
            applySaldoPeriodo(this.value);
            updateSaldoCorretoraModal();
        }
    });
    document.getElementById('saldoTipo')?.addEventListener('change', updateSaldoCorretoraModal);
    document.getElementById('saldoInicio')?.addEventListener('change', function() {
        const periodoEl = document.getElementById('saldoPeriodo');
        if (periodoEl) periodoEl.value = 'custom';
    });
    document.getElementById('saldoFim')?.addEventListener('change', function() {
        const periodoEl = document.getElementById('saldoPeriodo');
        if (periodoEl) periodoEl.value = 'custom';
    });

    // Validação do campo Quantidade
    document.getElementById('inputQuantidade').addEventListener('change', function() {
        let val = parseInt(this.value);
        
        // Se vazio ou NaN, define como 100
        if (isNaN(val)) {
            val = 100;
        }

        // Validar mínimo
        if (val < 100) {
            iziToast.warning({title: 'Atenção', message: 'A quantidade mínima permitida é 100.'});
            val = 100;
        }
        
        // Validar múltiplo de 100
        if (val % 100 !== 0) {
            iziToast.warning({title: 'Atenção', message: 'A quantidade deve ser um múltiplo de 100.'});
            // Arredonda para o múltiplo de 100 mais próximo
            val = Math.round(val / 100) * 100;
            // Se arredondou para 0, volta para 100
            if (val === 0) val = 100;
        }
        
        this.value = val;
        calcularResultado();
    });
});

// Forçar uppercase
function forcarUppercase(e) {
    e.target.value = e.target.value.toUpperCase();
}

const closedFilterState = new Map();
let closedFilterRegistered = false;

function getStatusText(value) {
    if (!value) return '';
    return String(value).replace(/<[^>]*>/g, '').trim().toUpperCase();
}

function registerClosedFilter() {
    if (closedFilterRegistered) return;
    $.fn.dataTable.ext.search.push(function(settings, data) {
        const tableId = settings.nTable ? settings.nTable.getAttribute('id') : '';
        const hideClosed = closedFilterState.get(tableId);
        if (!hideClosed) return true;
        const statusText = getStatusText(data[13]);
        return !['FECHADA', 'EXERCIDA', 'VENCIDA'].includes(statusText);
    });
    closedFilterRegistered = true;
}

function addClosedFilterToggle(tableId, dt) {
    const filterWrap = document.getElementById(`${tableId}_filter`);
    if (!filterWrap || filterWrap.querySelector('.toggle-fechadas')) return;
    filterWrap.classList.add('d-flex', 'align-items-center', 'gap-2');
    const toggle = document.createElement('label');
    toggle.className = 'form-check form-switch ms-3 d-inline-flex align-items-center toggle-fechadas';
    toggle.innerHTML = `
        <input class="form-check-input" type="checkbox" id="${tableId}-toggle-fechadas">
        <span class="form-check-label ms-2">Operações fechadas</span>
    `;
    filterWrap.appendChild(toggle);
    const checkbox = document.getElementById(`${tableId}-toggle-fechadas`);
    closedFilterState.set(tableId, false);
    checkbox.addEventListener('change', () => {
        closedFilterState.set(tableId, checkbox.checked);
        dt.draw();
    });
}

function initDataTables() {
    const dtConfig = {
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json',
            "sEmptyTable": "Nenhum registro encontrado",
            "sInfo": "Mostrando de _START_ até _END_ de _TOTAL_ registros",
            "sInfoEmpty": "Mostrando 0 até 0 de 0 registros",
            "sInfoFiltered": "(Filtrados de _MAX_ registros)",
            "sInfoPostFix": "",
            "sInfoThousands": ".",
            "sLengthMenu": "_MENU_ resultados por página",
            "sLoadingRecords": "Carregando...",
            "sProcessing": "Processando...",
            "sZeroRecords": "Nenhum registro encontrado",
            "sSearch": "Pesquisar",
            "oPaginate": {
                "sNext": "Próximo",
                "sPrevious": "Anterior",
                "sFirst": "Primeiro",
                "sLast": "Último"
            },
            "oAria": {
                "sSortAscending": ": Ordenar colunas de forma ascendente",
                "sSortDescending": ": Ordenar colunas de forma descendente"
            }
        },
        pageLength: 10,
        responsive: false,
        scrollX: true,
        order: [[10, 'desc']],
        columnDefs: [
            {
                targets: 10,
                orderDataType: 'dom-data-order'
            },
            {
                targets: 14,
                orderable: false
            }
        ],
        createdRow: function(row, data, dataIndex) {
            const statusHtml = data[13];
            if (statusHtml && (statusHtml.includes('FECHADA') || statusHtml.includes('EXERCIDA'))) {
                $(row).addClass('op-fechada');
            }
        }
    };
    
    // Adicionar ordenação customizada para usar data-order attribute
    $.fn.dataTable.ext.order['dom-data-order'] = function(settings, col) {
        return this.api().column(col, {order: 'index'}).nodes().map(function(td) {
            const span = $(td).find('span[data-order]');
            return span.length ? span.attr('data-order') : '';
        });
    };
    
    tableMesAtual = $('#tableMesAtual').DataTable(dtConfig);
    tableHistorico = $('#tableHistorico').DataTable(dtConfig);
    registerClosedFilter();
    addClosedFilterToggle('tableMesAtual', tableMesAtual);
    addClosedFilterToggle('tableHistorico', tableHistorico);
    
    // Ajustar colunas quando a aba do histórico for mostrada
    $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        if (e.target.getAttribute('href') === '#tab-historico') {
            tableHistorico.columns.adjust().draw();
        } else if (e.target.getAttribute('href') === '#tab-mes-atual') {
            tableMesAtual.columns.adjust().draw();
        }
    });
}

async function loadConfig() {
    try {
        const res = await fetch(`${API_BASE}/api/config`);
        const config = await res.json();
        
        // Atualizar localStorage com os dados do banco
        const currentConfig = JSON.parse(localStorage.getItem('appConfig') || '{}');
        const newConfig = {...currentConfig, ...config};
        localStorage.setItem('appConfig', JSON.stringify(newConfig));
        
        return newConfig;
    } catch (e) {
        console.error('Erro ao carregar configurações:', e);
        return JSON.parse(localStorage.getItem('appConfig') || '{}');
    }
}

async function loadOperacoes() {
    // Carregar configurações do backend para garantir dados atualizados
    await loadConfig();
    
    try {
        const res = await fetch(`${API_BASE}/api/opcoes`);
        allOperacoes = await res.json();
        window.allOperacoes = allOperacoes; // Make available globally
        
        // Verificação de Status Automática (Fechada/Exercida)
        const today = new Date();
        today.setHours(0,0,0,0);
        let updatedCount = 0;

        for (const op of allOperacoes) {
            // Verificar se precisa atualizar status
            if (op.status === 'ABERTA' && op.vencimento) {
                // Vencimento pode vir como YYYY-MM-DD
                const parts = op.vencimento.split('-');
                const vencimentoDate = new Date(parts[0], parts[1]-1, parts[2]);
                
                if (today > vencimentoDate) {
                    let novoStatus = null;
                    let exercicioCalculado = null;
                    
                    // Calcular se foi exercida baseado em REGRA DE NEGÓCIO
                    // Lógica: Opção ITM (In The Money) no vencimento é exercida
                    let exercicioSim = false;
                    
                    if (op.preco_atual && op.strike && op.tipo) {
                        const pa = parseFloatSafe(op.preco_atual);
                        const str = parseFloatSafe(op.strike);
                        
                        // PUT: Exercida quando preco_atual < strike
                        // (quem vendeu PUT é obrigado a comprar / quem comprou PUT pode vender por mais)
                        if (op.tipo === 'PUT') {
                            exercicioSim = (pa < str);
                        } 
                        // CALL: Exercida quando preco_atual > strike
                        // (quem vendeu CALL é obrigado a vender / quem comprou CALL pode comprar por menos)
                        else if (op.tipo === 'CALL') {
                            exercicioSim = (pa > str);
                        }
                        
                        exercicioCalculado = exercicioSim ? 'SIM' : 'NAO';
                    }
                    
                    // Definir novo status baseado no exercício
                    if (exercicioSim) {
                        novoStatus = 'EXERCIDA';
                    } else {
                        novoStatus = 'FECHADA';
                    }
                    
                    // Atualizar apenas status no banco (sem campo exercicio)
                    if (novoStatus && op.status !== novoStatus) {
                        try {
                            await fetch(`${API_BASE}/api/opcoes/${op.id}`, {
                                method: 'PUT',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({...op, status: novoStatus})
                            });
                            op.status = novoStatus;
                            updatedCount++;
                        } catch (e) {
                            console.error(`Erro ao atualizar status automático da op ${op.id}:`, e);
                        }
                    }
                }
            }
        }

        if (updatedCount > 0) {
            iziToast.info({title: 'Atualizado', message: `${updatedCount} operações finalizadas automaticamente`});
        }
        
        await updateUI();
    } catch (e) {
        iziToast.error({title: 'Erro', message: 'Erro ao buscar operações'});
        console.error(e);
    }
}

function calcTotalsOpcoes(data) {
    // Pegar saldo do localStorage (objeto appConfig)
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoCorretora = parseFloat(config.saldoAcoes || 0);
    
    const resultadoTotal = data.reduce((acc, item) => acc + (parseFloat(item.resultado) || 0), 0);
    const resultadoMedio = saldoCorretora > 0 ? (resultadoTotal / saldoCorretora) * 100 : 0;
    
    return {
        totalOperacoes: data.length,
        totalPremios: data.reduce((acc, item) => acc + (parseFloat(item.premio) || 0), 0),
        resultadoTotal: resultadoTotal,
        resultadoMedio: resultadoMedio
    };
}

async function updateUI() {
    const currentMonth = getCurrentMonth();
    const currentYear = new Date().getFullYear().toString();
    
    const mesAtualData = filterByMonth(allOperacoes, currentMonth);
    const anoData = filterByYear(allOperacoes, currentYear);
    
    // Cards
    const totals = calcTotalsOpcoes(allOperacoes);
    // Saldo corretora vem do localStorage (appConfig)
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoCorretora = parseFloat(config.saldoAcoes || 0);
    
    document.getElementById('cardTotalOps').textContent = totals.totalOperacoes;
    const saldoClass = saldoCorretora >= 0 ? 'text-success' : 'text-danger';
    const resClass = totals.resultadoTotal >= 0 ? 'text-success' : 'text-danger';
    document.getElementById('cardSaldoCorretora').className = `h1 mb-0 ${saldoClass}`;
    document.getElementById('cardSaldoCorretora').textContent = formatCurrency(saldoCorretora, 'BRL');
    document.getElementById('cardResultadoTotal').className = `h1 mb-0 ${resClass}`;
    document.getElementById('cardResultadoTotal').textContent = formatCurrency(totals.resultadoTotal, 'BRL');
    document.getElementById('cardResultadoMedio').textContent = totals.resultadoMedio.toFixed(2) + '%';
    
    // Mes Atual Header
    const mesTotals = calcTotalsOpcoes(mesAtualData);
    document.getElementById('mesAtualHeader').innerHTML = `
        <div class="col-12 mb-2">
            <h4>${getMonthName(currentMonth)}</h4>
            <span class="float-end text-primary">Mes Atual</span>
        </div>
        <div class="col-md-3">
            <div class="text-muted">Total Operacoes</div>
            <div class="text-success">${mesTotals.totalOperacoes}</div>
        </div>
        <div class="col-md-3">
            <div class="text-muted">Total Premios</div>
            <div>${formatCurrency(mesTotals.totalPremios, 'BRL')}</div>
        </div>
        <div class="col-md-3">
            <div class="text-muted">Resultado</div>
            <div class="text-success">${formatCurrency(mesTotals.resultadoTotal, 'BRL')}</div>
        </div>
        <div class="col-md-3">
            <div class="text-muted">Media</div>
            <div>${mesTotals.resultadoMedio.toFixed(2)}%</div>
        </div>
    `;
    document.getElementById('mesAtualTitle').textContent = `Operacoes - ${getMonthName(currentMonth).replace('-', ' 20')}`;
    
    // Tables (agora são assíncronas)
    await populateTable(tableMesAtual, mesAtualData, true, true, false);
    await populateTable(tableHistorico, allOperacoes, true, true, true);
    
    // Historico mensal
    renderHistoricoMensal();
    
    // Grafico anual
    renderChartAnual(anoData, currentYear);
}

// Função helper para buscar cotação de um ativo
async function buscarCotacaoAtivo(ativo) {
    if (!ativo) return null;
    
    // Verificar cache
    if (cotacoesCache.has(ativo)) {
        return cotacoesCache.get(ativo);
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${ativo}`);
        const data = await response.json();
        
        if (data && (data.price || data.cotacao || data.close || data.last)) {
            const cotacao = parseFloat(data.price || data.cotacao || data.close || data.last);
            cotacoesCache.set(ativo, cotacao);
            return cotacao;
        }
    } catch (error) {
        console.error(`Erro ao buscar cotação de ${ativo}:`, error);
    }
    
    return null;
}

function getLoadingCell() {
    return '<span class="spinner-border spinner-border-sm"></span>';
}

async function populateTable(dt, data, showActions = true, updatePrices = false, isHistorico = false) {
    dt.clear();
    const sorted = [...data].sort((a, b) => {
        const da = new Date(a.data_operacao || a.created_at || 0);
        const db = new Date(b.data_operacao || b.created_at || 0);
        return db - da;
    });
    
    // Se updatePrices=true, buscar cotações para operações abertas
    if (updatePrices) {
        // Obter lista única de ativos base das operações abertas
        const ativosAbertos = new Set();
        sorted.forEach(op => {
            if (op.status === 'ABERTA' && op.ativo_base) {
                ativosAbertos.add(op.ativo_base);
            }
        });

        const loadingCell = getLoadingCell();
        const rowNodes = new Map();
        sorted.forEach(op => {
        const diasInfo = calcularDias(op.vencimento);
        const qtd = parseFloat(op.quantidade);
        const qtdAbs = Math.abs(qtd);
        
        // REGRA: Para operações ABERTAS, preço atual vem da API (loading até buscar)
        // Para operações FECHADAS/EXERCIDAS/VENCIDAS, usar preco_atual do BANCO
        let precoAtual = op.preco_atual;
        
        // Lógica de Exercício: Calcular baseado em ITM/OTM
        // Só calcula exercício para operações que ainda não venceram ou que estão no vencimento
        // PUT ITM: preço atual < strike (posso vender por mais que vale)
        // CALL ITM: preço atual > strike (posso comprar por menos que vale)
        let exercicio = false;
        
        if (precoAtual && op.strike && op.tipo && op.vencimento) {
            // Converter valores para numérico (suporta formato brasileiro e americano)
            const pa = parseFloatSafe(precoAtual);
            const str = parseFloatSafe(op.strike);
            
            // Verificar se já venceu ou está no vencimento
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const parts = op.vencimento.split('-');
            const vencimento = new Date(parts[0], parts[1] - 1, parts[2]);
            vencimento.setHours(0, 0, 0, 0);
            
            // Usar função global para calcular exercício
            exercicio = calcularExercicio(op.tipo, pa, str);
        } else if (op.status === 'EXERCIDA') {
            // Se não tem dados mas status é EXERCIDA
            exercicio = true;
        }
        
        let actionsHtml = '';
        if (showActions) {
            if (isHistorico) {
                // Histórico: apenas botão de detalhar
                actionsHtml = `<div class="btn-list flex-nowrap">
                    <button class="btn btn-sm btn-info btn-icon" onclick="openDetalheOperacao('${op.id}')" title="Detalhes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </button>
                 </div>`;
            } else {
                // Mês atual: todos os botões, mas ocultar exclusão se operação fechada
                const isFechada = op.status && (op.status.toUpperCase() === 'FECHADA' || op.status.toUpperCase() === 'EXERCIDA' || op.status.toUpperCase() === 'VENCIDA');
                actionsHtml = `<div class="btn-list flex-nowrap">
                    <button class="btn btn-sm btn-info btn-icon" onclick="openDetalheOperacao('${op.id}')" title="Detalhes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </button>
                    <button class="btn btn-sm btn-primary btn-icon" onclick="editOperacao('${op.id}')" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    ${!isFechada ? `<button class="btn btn-sm btn-danger btn-icon" onclick="deleteOperacao('${op.id}')" title="Excluir">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>` : ''}
                 </div>`;
            }
        }

        // Usar tipo_operacao do banco se disponível, senão inferir da quantidade
        const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && qtd < 0);
        const premioAbs = Math.abs(parseFloatSafe(op.premio));
        const premioValue = premioAbs * qtdAbs;
        
        let popCell = '-';
        let priceCell = precoAtual && !isNaN(parseFloatSafe(precoAtual)) ? `<span class="${parseFloatSafe(precoAtual) >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(parseFloatSafe(precoAtual))}</span>` : '-';
        const isAbertaComApi = op.status === 'ABERTA' && op.ativo_base;
        if (isAbertaComApi) {
            priceCell = loadingCell;
            popCell = loadingCell;
        } else {
            const precoAtualValue = parseFloatSafe(precoAtual);
            if (op.status === 'ABERTA' && precoAtualValue > 0) {
                const popValue = calcularPoP(op, precoAtualValue);
                if (popValue !== null) {
                    popCell = `${popValue.toFixed(1)}%`;
                }
            }
        }
        
        const rowNode = dt.row.add([
            op.ativo_base ? `<span class="badge bg-azure text-azure-fg">${op.ativo_base}</span>` : '-',
            priceCell,
            `<span class="${parseFloatSafe(op.preco_entrada) >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(parseFloatSafe(op.preco_entrada))}</span>`,
            op.ativo,
            `<span class="badge ${op.tipo === 'CALL' ? 'bg-green text-green-fg' : 'bg-red text-red-fg'}">${op.tipo}</span>`,
            op.quantidade,
            formatCurrency(parseFloatSafe(op.strike)),
            `<span class="${premioValue >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(premioAbs)}</span>`,
            `<span class="${parseFloatSafe(op.resultado) >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(parseFloatSafe(op.resultado))}</span>`,
            popCell,
            formatDateCell(op.vencimento),  // Vencimento com timestamp para ordenação correta
            `${diasInfo.uteis} / ${diasInfo.corridos}`,
            gerarBadgeExercicio(exercicio, op.status),
            `<span class="badge ${op.status === 'ABERTA' ? 'bg-green text-green-fg' : 'bg-default text-default-fg'}">${op.status}</span>`,
            actionsHtml
        ]).node();
        if (rowNode) {
            rowNode.dataset.opId = op.id;
            rowNodes.set(String(op.id), rowNode);
        }
    });
        dt.draw();
        
        if (ativosAbertos.size > 0) {
            const promises = Array.from(ativosAbertos).map(ativo => buscarCotacaoAtivo(ativo));
            await Promise.all(promises);
        }
        
        sorted.forEach(op => {
            if (op.status !== 'ABERTA' || !op.ativo_base) return;
            const rowNode = rowNodes.get(String(op.id));
            if (!rowNode) return;
            const cotacao = cotacoesCache.get(op.ativo_base);
            const precoAtualValue = parseFloatSafe(cotacao);
            const priceCellUpdated = Number.isFinite(precoAtualValue) && precoAtualValue > 0
                ? `<span class="${precoAtualValue >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(precoAtualValue)}</span>`
                : '-';
            let popCellUpdated = '-';
            if (precoAtualValue > 0) {
                const popValue = calcularPoP(op, precoAtualValue);
                if (popValue !== null) {
                    popCellUpdated = `${popValue.toFixed(1)}%`;
                }
            }
            dt.cell(rowNode, 1).data(priceCellUpdated);
            dt.cell(rowNode, 9).data(popCellUpdated);
        });
        dt.draw(false);
        return;
    }
    
    sorted.forEach(op => {
        const diasInfo = calcularDias(op.vencimento);
        const qtd = parseFloat(op.quantidade);
        const qtdAbs = Math.abs(qtd);
        
        let precoAtual = op.preco_atual;
        let popCell = '-';
        const precoAtualValue = parseFloatSafe(precoAtual);
        if (op.status === 'ABERTA' && precoAtualValue > 0) {
            const popValue = calcularPoP(op, precoAtualValue);
            if (popValue !== null) {
                popCell = `${popValue.toFixed(1)}%`;
            }
        }
        
        let actionsHtml = '';
        if (showActions) {
            if (isHistorico) {
                actionsHtml = `<div class="btn-list flex-nowrap">
                    <button class="btn btn-sm btn-info btn-icon" onclick="openDetalheOperacao('${op.id}')" title="Detalhes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </button>
                 </div>`;
            } else {
                const isFechada = op.status && (op.status.toUpperCase() === 'FECHADA' || op.status.toUpperCase() === 'EXERCIDA' || op.status.toUpperCase() === 'VENCIDA');
                actionsHtml = `<div class="btn-list flex-nowrap">
                    <button class="btn btn-sm btn-info btn-icon" onclick="openDetalheOperacao('${op.id}')" title="Detalhes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </button>
                    <button class="btn btn-sm btn-primary btn-icon" onclick="editOperacao('${op.id}')" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    ${!isFechada ? `<button class="btn btn-sm btn-danger btn-icon" onclick="deleteOperacao('${op.id}')" title="Excluir">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>` : ''}
                 </div>`;
            }
        }
        
        const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && qtd < 0);
        const premioAbs = Math.abs(parseFloatSafe(op.premio));
        const premioValue = premioAbs * qtdAbs;
        
        dt.row.add([
            op.ativo_base ? `<span class="badge bg-azure text-azure-fg">${op.ativo_base}</span>` : '-',
            precoAtual && !isNaN(parseFloatSafe(precoAtual)) ? `<span class="${parseFloatSafe(precoAtual) >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(parseFloatSafe(precoAtual))}</span>` : '-',
            `<span class="${parseFloatSafe(op.preco_entrada) >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(parseFloatSafe(op.preco_entrada))}</span>`,
            op.ativo,
            `<span class="badge ${op.tipo === 'CALL' ? 'bg-green text-green-fg' : 'bg-red text-red-fg'}">${op.tipo}</span>`,
            op.quantidade,
            formatCurrency(parseFloatSafe(op.strike)),
            `<span class="${premioValue >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(premioAbs)}</span>`,
            `<span class="${parseFloatSafe(op.resultado) >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(parseFloatSafe(op.resultado))}</span>`,
            popCell,
            formatDateCell(op.vencimento),
            `${diasInfo.uteis} / ${diasInfo.corridos}`,
            gerarBadgeExercicio(exercicio, op.status),
            `<span class="badge ${op.status === 'ABERTA' ? 'bg-green text-green-fg' : 'bg-default text-default-fg'}">${op.status}</span>`,
            actionsHtml
        ]);
    });
    dt.draw();
}

// formatDateCell() movida para global.js

function calcularDias(vencimento) {
    if (!vencimento) return { uteis: '-', corridos: '-' };
    const today = new Date();
    today.setHours(0,0,0,0);
    const venc = parseDateInput(vencimento);
    if (!venc || Number.isNaN(venc.getTime())) return { uteis: '-', corridos: '-' };
    venc.setHours(0,0,0,0);
    if (venc <= today) return { uteis: 0, corridos: 0 };
    
    // Dias Corridos
    const diffTime = venc - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Dias Úteis (Iteração mais precisa)
    let businessDays = 0;
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() + 1);
    while (cursor <= venc) {
        const diaSemana = cursor.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) {
            businessDays += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    
    return { uteis: businessDays, corridos: diffDays };
}

function normalizeSigma(value) {
    if (!value && value !== 0) return null;
    let sigma = parseFloatSafe(value);
    if (!Number.isFinite(sigma) || sigma <= 0) return null;
    if (sigma > 3) sigma = sigma / 100;
    return sigma;
}

function calcularPoP(op, spotPrice) {
    const strike = parseFloatSafe(op.strike);
    const premioEntry = parseFloatSafe(op.premio || op.preco_entrada || 0);
    const qtd = parseFloatSafe(op.quantidade);
    const tipo = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
    if (!strike || !spotPrice || !tipo) return null;
    const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && qtd < 0);
    const diasUteis = calcularDias(op.vencimento).uteis;
    const T = Math.max(diasUteis / 252.0, 0.0001);
    const r = 0.1075;
    const sigma = normalizeSigma(op.implied_volatility || op.iv || 0.3) || 0.3;
    let be = 0;
    
    if (tipo === 'PUT') {
        be = strike - premioEntry;
    } else {
        be = strike + premioEntry;
    }
    
    let prob = 0;
    if (be <= 0.001 || spotPrice <= 0.001) {
        if (!isVenda && tipo === 'PUT') prob = 0;
        else if (isVenda && tipo === 'PUT') prob = 1;
        else prob = 0;
    } else if (T <= 0.001) {
        if (tipo === 'CALL') {
            prob = isVenda ? (spotPrice <= be ? 1 : 0) : (spotPrice >= be ? 1 : 0);
        } else {
            prob = isVenda ? (spotPrice >= be ? 1 : 0) : (spotPrice <= be ? 1 : 0);
        }
    } else {
        const d1_be = (Math.log(spotPrice / be) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
        const d2_be = d1_be - sigma * Math.sqrt(T);
        if (tipo === 'CALL') {
            prob = isVenda ? cdf(-d2_be) : cdf(d2_be);
        } else {
            prob = isVenda ? cdf(d2_be) : cdf(-d2_be);
        }
    }
    
    return Math.max(0, Math.min(1, prob)) * 100;
}
function openNewModal() {
    document.getElementById('formOperacao').reset();
    document.getElementById('operacaoId').value = '';
    document.getElementById('modalOperacaoTitle').textContent = 'Nova Operação';
    document.getElementById('inputStatus').value = 'ABERTA';
    document.getElementById('cardNotional').style.display = 'none';
    
    // Limpar badge de ativo
    const ativoInfoBadge = document.getElementById('modalOperacaoAtivoInfo');
    if (ativoInfoBadge) {
        ativoInfoBadge.style.display = 'none';
        ativoInfoBadge.textContent = '';
    }
    
    // Set default date
    document.getElementById('inputDataOperacao').value = getCurrentDate();
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    document.getElementById('inputSaldoAbertura').value = parseFloat(config.saldoAcoes || 0);
    // Show save button by default
    document.getElementById('btnSaveOperacao').style.display = 'block';

    const modal = new bootstrap.Modal(document.getElementById('modalOperacao'));
    modal.show();
    
    // Atualizar status do mercado no modal
    updateModalMarketStatus('modalOperacaoMarketStatus');
}

// Event Listener for Auto-Fill by Asset Code
// Logic moved to buscarDadosOpcao and event listeners in layoutReady


function calcularResultado() {
    const qtd = parseInt(document.getElementById('inputQuantidade').value) || 0;
    const premio = Math.abs(parseCurrencyValue(document.getElementById('inputPremio').value));
    
    // Se quantidade negativa = VENDA (recebe prêmio)
    // Se quantidade positiva = COMPRA (paga prêmio)
    const isVenda = qtd < 0;
    const res = Math.abs(qtd) * premio * (isVenda ? 1 : -1);
    
    // Set formatted result
    document.getElementById('inputResultado').value = formatCurrency(res);
}

async function saveOperacao() {
    const id = document.getElementById('operacaoId').value;
    
    const ativo = document.getElementById('inputAtivo').value.toUpperCase();
    const ativoBase = document.getElementById('inputAtivoBase').value.toUpperCase();
    
    if (!ativo || !ativoBase) {
        iziToast.warning({title: 'Atenção', message: 'Preencha o Ativo e o Ativo Base'});
        return;
    }

    // Garantir que o prêmio seja sempre um valor absoluto (positivo)
    const premioValue = Math.abs(parseCurrencyValue(document.getElementById('inputPremio').value));

    const data = {
        ativo_base: ativoBase,
        ativo: ativo,
        tipo: document.getElementById('inputTipo').value,
        tipo_operacao: document.getElementById('inputTipoOperacao').value,
        data_operacao: document.getElementById('inputDataOperacao').value,
        quantidade: parseInt(document.getElementById('inputQuantidade').value),
        preco_entrada: parseCurrencyValue(document.getElementById('inputPrecoEntrada').value),
        strike: parseCurrencyValue(document.getElementById('inputStrike').value),
        premio: premioValue,
        resultado: parseCurrencyValue(document.getElementById('inputResultado').value),
        preco_atual: parseCurrencyValue(document.getElementById('inputPrecoAtual').value),
        vencimento: document.getElementById('inputVencimento').value,
        saldo_abertura: parseFloat(document.getElementById('inputSaldoAbertura').value || 0),
        status: document.getElementById('inputStatus').value,
        // Salvar cotação do ativo base no momento da operação
        spot_price: cotacaoAtivoBase || parseCurrencyValue(document.getElementById('inputPrecoEntrada').value)
    };

    try {
        const url = id ? `${API_BASE}/api/opcoes/${id}` : `${API_BASE}/api/opcoes`;
        const method = id ? 'PUT' : 'POST';
        
        await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        iziToast.success({title: 'Sucesso', message: 'Operação salva com sucesso'});
        bootstrap.Modal.getInstance(document.getElementById('modalOperacao')).hide();
        loadOperacoes();
    } catch (e) {
        iziToast.error({title: 'Erro', message: 'Erro ao salvar operação'});
    }
}

async function editOperacao(id) {
    const op = allOperacoes.find(o => o.id == id);
    if (!op) return;
    
    document.getElementById('operacaoId').value = op.id;
    document.getElementById('inputAtivoBase').value = op.ativo_base;
    document.getElementById('inputAtivo').value = op.ativo;
    document.getElementById('inputTipo').value = op.tipo;
    document.getElementById('inputTipoOperacao').value = op.tipo_operacao || 'VENDA';
    document.getElementById('inputDataOperacao').value = op.data_operacao;
    document.getElementById('inputQuantidade').value = op.quantidade;
    document.getElementById('inputPrecoEntrada').value = op.preco_entrada ? formatCurrency(parseFloatSafe(op.preco_entrada)) : '';
    document.getElementById('inputStrike').value = op.strike ? formatCurrency(parseFloatSafe(op.strike)) : '';
    document.getElementById('inputPremio').value = op.premio ? formatCurrency(Math.abs(parseFloatSafe(op.premio))) : '';
    document.getElementById('inputResultado').value = op.resultado ? formatCurrency(parseFloatSafe(op.resultado)) : '';
    if (document.getElementById('inputPrecoAtual')) {
        document.getElementById('inputPrecoAtual').value = op.preco_atual ? formatCurrency(parseFloatSafe(op.preco_atual)) : '';
    }
    document.getElementById('inputVencimento').value = op.vencimento;
    document.getElementById('inputStatus').value = op.status;
    document.getElementById('inputSaldoAbertura').value = op.saldo_abertura || 0;
    document.getElementById('modalOperacaoTitle').textContent = 'Editar Operação';
    
    // Atualizar badge com ativo e cotação
    const ativoInfoBadge = document.getElementById('modalOperacaoAtivoInfo');
    if (ativoInfoBadge && op.ativo_base && op.preco_atual) {
        ativoInfoBadge.textContent = `${op.ativo_base}: ${formatCurrency(parseFloatSafe(op.preco_atual))}`;
        ativoInfoBadge.style.display = 'inline-block';
    }
    
    // Hide save button if operation is closed
    const btnSave = document.getElementById('btnSaveOperacao');
    if (op.status === 'FECHADA' || op.status === 'EXERCIDA') {
        btnSave.style.display = 'none';
    } else {
        btnSave.style.display = 'block';
    }

    const modal = new bootstrap.Modal(document.getElementById('modalOperacao'));
    modal.show();
    
    // Atualizar status do mercado no modal
    updateModalMarketStatus('modalOperacaoMarketStatus');
}

// Função cdf() removida - agora está em global.js

async function deleteOperacao(id) {
    // Usar SweetAlert2 em vez de confirm()
    const result = await Swal.fire({
        title: 'Tem certeza?',
        text: "Deseja excluir esta operação? Esta ação não pode ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d63939',
        cancelButtonColor: '#626976',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar',
        background: '#1f2937',
        color: '#f8f9fa'
    });

    if (!result.isConfirmed) return;

    try {
        await fetch(`${API_BASE}/api/opcoes/${id}`, { method: 'DELETE' });
        iziToast.success({title: 'Sucesso', message: 'Operação excluída'});
        loadOperacoes();
    } catch (e) {
        iziToast.error({title: 'Erro', message: 'Erro ao excluir'});
    }
}

// Modal detalhes functions moved to detalhe-opcoes.js

// ====================
// COTAÇÕES E API
// ====================

async function buscarCotacaoAtivoBase(ativo) {
    if (!ativo) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${ativo}`);
        const data = await response.json();
        
        if (data && (data.price || data.cotacao || data.close || data.last)) {
            cotacaoAtivoBase = parseFloat(data.price || data.cotacao || data.close || data.last);
            const formatted = formatCurrency(cotacaoAtivoBase);
            
            // Atualizar badge no modal de operação
            const ativoInfoBadge = document.getElementById('modalOperacaoAtivoInfo');
            if (ativoInfoBadge) {
                ativoInfoBadge.textContent = `${ativo}: ${formatted}`;
                ativoInfoBadge.style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error('Erro ao buscar cotação:', error);
    }
}

async function buscarDadosOpcao(ativo) {
    if (!ativo) return;
    
    const btn = document.getElementById('btnAtualizarDados');
    const originalIcon = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        btn.disabled = true;
    }
    
    // Aplicar loading aos campos que serão atualizados
    const fieldsToUpdate = ['inputAtivoBase', 'inputTipo', 'inputStrike', 'inputVencimento', 'inputPremioAbertura'];
    const originalValues = {};
    fieldsToUpdate.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            originalValues[id] = el.value;
            el.value = '⏳';
            el.disabled = true;
        }
    });

    try {
        const response = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${ativo}`);
        const data = await response.json();
        
        let opcao = null;
        if (Array.isArray(data)) opcao = data[0];
        else if (data.opcoes && Array.isArray(data.opcoes)) opcao = data.opcoes[0];
        else if (data.symbol) opcao = data;
        
        if (opcao) {
            // Fill fields
            const ativoBase = opcao.ativo_base || opcao.underlying || '';
            const currentAtivoBase = originalValues['inputAtivoBase'];
            
            // Only update Ativo Base if it's empty or if we want to force update
            if (ativoBase && !currentAtivoBase) {
                document.getElementById('inputAtivoBase').value = ativoBase;
            } else if (ativoBase) {
                 // Optional: Confirm overwrite? For now, let's just update it as user requested "must be filled"
                 document.getElementById('inputAtivoBase').value = ativoBase;
            } else {
                document.getElementById('inputAtivoBase').value = currentAtivoBase;
            }

            document.getElementById('inputTipo').value = opcao.tipo || opcao.type || 'CALL';
            const strikeValue = parseFloat(opcao.strike || opcao.strikePrice || 0);
            if (strikeValue > 0) {
                document.getElementById('inputStrike').value = strikeValue.toFixed(2);
            } else {
                document.getElementById('inputStrike').value = originalValues['inputStrike'];
            }

            const vencimento = opcao.vencimento || opcao.expiryDate;
            if (vencimento) {
                let vencimentoDate = parseDateInput(vencimento);
                if (vencimentoDate && !isNaN(vencimentoDate.getTime())) {
                    const yyyy = vencimentoDate.getFullYear();
                    const mm = String(vencimentoDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(vencimentoDate.getDate()).padStart(2, '0');
                    document.getElementById('inputVencimento').value = `${yyyy}-${mm}-${dd}`;
                } else {
                    document.getElementById('inputVencimento').value = originalValues['inputVencimento'];
                }
            } else {
                document.getElementById('inputVencimento').value = originalValues['inputVencimento'];
            }

            const premio = parseFloat(opcao.preco || opcao.price || opcao.close || opcao.last || 0);
            if (premio > 0) {
                document.getElementById('inputPremioAbertura').value = premio.toFixed(2);
            } else {
                document.getElementById('inputPremioAbertura').value = originalValues['inputPremioAbertura'];
            }

            iziToast.success({
                title: 'Sucesso',
                message: 'Dados atualizados!',
                position: 'topRight'
            });

            // Buscar cotação do ativo base para atualizar display
            if (ativoBase) {
                buscarCotacaoAtivoBase(ativoBase);
            }
        } else {
            // Restaurar valores originais se não encontrou opção
            fieldsToUpdate.forEach(id => {
                const el = document.getElementById(id);
                if (el && originalValues[id] !== undefined) {
                    el.value = originalValues[id];
                }
            });
        }
    } catch (error) {
        console.error('Erro ao buscar dados da opção:', error);
        // Restaurar valores originais em caso de erro
        fieldsToUpdate.forEach(id => {
            const el = document.getElementById(id);
            if (el && originalValues[id] !== undefined) {
                el.value = originalValues[id];
            }
        });
        iziToast.error({
            title: 'Erro',
            message: 'Erro ao buscar dados: ' + error.message,
            position: 'topRight'
        });
    } finally {
        // Re-habilitar campos
        fieldsToUpdate.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = false;
        });
        if (btn) {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    }
}

// ====================
// FUNÇÕES MATEMÁTICAS E CÁLCULOS
// ====================
// Movidas para global.js: cdf(), pdf(), blackScholesPrice(), calculateImpliedVolatility(), calculateGreeks()

/**
 * Cálculo de Black-Scholes para opções europeias
 * Wrapper para manter compatibilidade com código existente
 * @param {Object} params - Parâmetros para cálculo
 */
function blackScholes(params) {
    const { S, K, T, r, sigma, isCall } = params;
    const type = isCall ? 'CALL' : 'PUT';
    const price = blackScholesPrice(S, K, T, r, sigma, type);
    const greeks = calculateGreeks(S, K, T, r, sigma, type);
    return { ...greeks, price };
}

// ====================
// SIMULAÇÃO E ANÁLISE
// ====================

async function simularOperacao() {
    const ativo = document.getElementById('inputAtivo').value;
    const ativoBase = document.getElementById('inputAtivoBase').value;
    const strike = parseFloat(document.getElementById('inputStrike').value);
    const premio = parseFloat(document.getElementById('inputPremioAbertura').value);
    const quantidade = parseInt(document.getElementById('inputQtd').value);
    const tipoOperacao = document.getElementById('inputTipoOperacao').value;
    const tipoOpcao = document.getElementById('inputTipo').value;
    const vencimento = document.getElementById('inputVencimento').value;
    
    if (!ativo || !ativoBase || !strike || !premio || !quantidade || !vencimento) {
        iziToast.error({title: 'Erro', message: 'Preencha todos os campos obrigatórios'});
        return;
    }
    
    // Get current spot price
    let spotPrice = cotacaoAtivoBase || strike;
    
    // Calculate scenarios
    const scenarios = [];
    const basePrice = spotPrice;
    
    for (let pct = -0.3; pct <= 0.3; pct += 0.05) {
        const priceAtExpiry = basePrice * (1 + pct);
        let optionValueAtExpiry = 0;
        
        if (tipoOpcao === 'CALL') {
            optionValueAtExpiry = Math.max(priceAtExpiry - strike, 0);
        } else {
            optionValueAtExpiry = Math.max(strike - priceAtExpiry, 0);
        }
        
        const premioRecebido = premio * quantidade;
        let lucroOperacao;
        
        if (tipoOperacao === 'VENDA') {
            // Vendemos a opção, recebemos o prêmio
            // Lucro = prêmio recebido - valor da opção no vencimento
            lucroOperacao = premioRecebido - (optionValueAtExpiry * quantidade);
        } else {
            // Compramos a opção, pagamos o prêmio
            // Lucro = valor da opção no vencimento - prêmio pago
            lucroOperacao = (optionValueAtExpiry * quantidade) - premioRecebido;
        }
        
        scenarios.push({
            priceChange: (pct * 100).toFixed(1) + '%',
            priceAtExpiry: priceAtExpiry.toFixed(2),
            optionValue: optionValueAtExpiry.toFixed(2),
            profit: lucroOperacao.toFixed(2),
            profitPct: ((lucroOperacao / Math.abs(premioRecebido)) * 100).toFixed(1) + '%'
        });
    }
    
    // Display results
    const resultDiv = document.getElementById('simulationResults') || createSimulationResultsDiv();
    resultDiv.innerHTML = `
        <h5>Simulação de Cenários</h5>
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Variação</th>
                        <th>Preço no Venc.</th>
                        <th>Valor Opção</th>
                        <th>Lucro/Prejuízo</th>
                        <th>% Retorno</th>
                    </tr>
                </thead>
                <tbody>
                    ${scenarios.map(s => `
                        <tr class="${parseFloat(s.profit) >= 0 ? 'table-success' : 'table-danger'}">
                            <td>${s.priceChange}</td>
                            <td>R$ ${s.priceAtExpiry}</td>
                            <td>R$ ${s.optionValue}</td>
                            <td>R$ ${s.profit}</td>
                            <td>${s.profitPct}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    resultDiv.style.display = 'block';
}

function createSimulationResultsDiv() {
    const div = document.createElement('div');
    div.id = 'simulationResults';
    div.className = 'mt-3 p-3 border rounded';
    div.style.display = 'none';
    
    const form = document.querySelector('.row.g-3');
    if (form) {
        form.appendChild(div);
    }

    return div;
}

/**
 * Análise de operação com IA (Google Gemini) - USANDO DADOS CORRETOS DA OPERAÇÃO
 */
async function analisarOperacaoComIA() {
    if (!currentDetalhesOpId) return;
    const op = allOperacoes.find(o => o.id == currentDetalhesOpId);
    if (!op) return;
    
    try {
        // Extrair dados DIRETO da operação no banco
        const ativoBase = op.ativo_base || 'N/A';
        const ativo = op.ativo;
        const tipo = op.tipo; // CALL ou PUT
        const strike = parseFloatSafe(op.strike || 0);
        const premio = parseFloatSafe(op.premio || 0);
        const quantidade = parseFloat(op.quantidade || 0);
        const vencimento = op.vencimento;
        const status = op.status;
        
        // Extrair cotações da tela (já atualizadas)
        const spotPriceText = document.getElementById('detalhesAtivoBase')?.innerHTML || '';
        const spotPriceMatch = spotPriceText.match(/text-muted[^>]*>R\$\s*([\d.,]+)</);
        const spotPrice = spotPriceMatch ? parseFloat(spotPriceMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
        
        const optionPriceText = document.getElementById('detalhesCotacaoAtual')?.textContent || 'R$ 0,00';
        const optionPrice = parseFloat(optionPriceText.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.'));
        
        // Extrair dados financeiros calculados
        const resultadoText = document.getElementById('detalhesResultado')?.textContent || 'R$ 0,00';
        const resultado = parseFloat(resultadoText.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.'));
        
        const pnlText = document.getElementById('detalhesPL')?.textContent || '0%';
        const pnl = parseFloat(pnlText.replace(/[^0-9,-]/g, '').replace(',', '.'));
        
        const popText = document.getElementById('detalhesPoP')?.textContent || '0%';
        const pop = parseFloat(popText.replace('%', '')) / 100;
        
        const notionalText = document.getElementById('detalhesNotional')?.textContent || 'R$ 0,00';
        const notional = parseFloat(notionalText.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.'));
        
        const saldoText = document.getElementById('detalhesSaldo')?.textContent || 'R$ 0,00';
        const saldo = parseFloat(saldoText.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.'));
        
        const margemText = document.getElementById('detalhesMargem')?.textContent || 'R$ 0,00';
        const margem = parseFloat(margemText.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.'));
        
        const utilizacaoText = document.getElementById('detalhesUtilizacao')?.textContent || '0%';
        const utilizacao = parseFloat(utilizacaoText.replace('%', ''));
        
        // Gregas
        const delta = document.getElementById('detalhesDelta')?.textContent || 'N/A';
        const theta = document.getElementById('detalhesTheta')?.textContent || 'N/A';
        const gamma = document.getElementById('detalhesGamma')?.textContent || 'N/A';
        const vega = document.getElementById('detalhesVega')?.textContent || 'N/A';
        const iv = document.getElementById('detalhesIV')?.textContent || 'N/A';
        const breakEven = document.getElementById('detalhesBreakEven')?.textContent || 'N/A';
        const distancia = document.getElementById('detalhesDistancia')?.textContent || 'N/A';
        
        const diasInfo = calcularDias(vencimento);
        const diasRestantes = diasInfo.corridos;
        const diasUteis = diasInfo.uteis;
        
        // Determinar se é Long ou Short
        const isVenda = quantidade < 0;
        const posicao = isVenda ? `VENDA de ${tipo}` : `COMPRA de ${tipo}`;
        const qtdAbs = Math.abs(quantidade);
        
        console.log('📊 Dados enviados para IA:', {
            ativoBase, spotPrice, ativo, tipo, strike, premio, 
            quantidade, posicao, resultado, pnl, pop
        });
        
        // Construir prompt estruturado
        const context = `
ATUE COMO UM ANALISTA QUANTITATIVO DE DERIVATIVOS SÊNIOR.

Analise esta operação EM ANDAMENTO de **${posicao}** no mercado brasileiro.

DADOS DO CLIENTE:
Saldo Disponível: ${formatCurrency(saldo)}

OPÇÃO EM ANÁLISE:
Ativo Base: ${ativoBase} - Cotação Atual: ${formatCurrency(spotPrice)}
Opção: ${ativo} (${tipo})
Strike: ${formatCurrency(strike)}
Prêmio Original: ${formatCurrency(premio)}
Prêmio Atual: ${formatCurrency(optionPrice)}
Quantidade: ${qtdAbs} contratos ${isVenda ? '(VENDIDA)' : '(COMPRADA)'}
Vencimento: ${formatDate(vencimento)}
Status: ${status}

⚠️ TEMPO: ${diasRestantes} dias corridos (${diasUteis} dias úteis)
${diasRestantes <= 2 ? 'ALERTA: Vencimento Iminente!' : ''}

Break-Even: ${breakEven}
Distância do Strike: ${distancia}

GREGAS ATUAIS:
Delta: ${delta}
Theta: ${theta}
Gamma: ${gamma}
Vega: ${vega}
Volatilidade Implícita: ${iv}

📊 SITUAÇÃO FINANCEIRA:
Notional (Se Exercido): ${formatCurrency(notional)}
Saldo Corretora: ${formatCurrency(saldo)}
Margem Disponível: ${formatCurrency(margem)} ${margem < 0 ? '⚠️ MARGEM INSUFICIENTE!' : ''}
Utilização do Saldo: ${utilizacao.toFixed(1)}% ${utilizacao > 100 ? '⚠️ ACIMA DE 100%!' : utilizacao > 80 ? '⚠️ ALTO!' : '✅'}

📈 RESULTADO ATUAL:
P&L: ${formatCurrency(resultado)} (${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}%)
Probabilidade de Lucro (PoP): ${(pop * 100).toFixed(1)}%

QUESTÕES OBRIGATÓRIAS PARA ANÁLISE:

1. **${isVenda ? 'ACEITARIA SER EXERCIDO?' : 'VALE A PENA EXERCER?'}**
   ${isVenda ? `Se for exercido, terei que ${tipo === 'PUT' ? 'comprar' : 'vender'} as ações. Considerando meu saldo de ${formatCurrency(saldo)}, isso é vantajoso?` : `Se exercer, pagarei ${formatCurrency(notional + (premio * qtdAbs))} total. Vale a pena?`}

2. **MELHOR ESTRATÉGIA:**
   - **MANTER** até o vencimento: A estratégia pode ser mantida se você acredita que ${ativoBase} ficará ${tipo === 'PUT' ? 'acima' : 'abaixo'} de ${formatCurrency(strike)}.
   - **FECHAR ANTECIPADAMENTE**: Pode ser considerado se deseja realizar lucro antes do vencimento.
   - **ROLAR**: Avalie rolar a opção se houver vantagem em relação a prêmios.

3. **COMPARAÇÃO COM OUTRAS OPERAÇÕES:**
   Considerando as alternativas, ${ativo} parece ser a melhor opção em termos de risco/retorno para o seu saldo.

4. **GESTÃO DE RISCO:**
   - % do saldo arriscado: Atualmente está arriscando ${utilizacao.toFixed(1)}% do seu saldo.
   - Stop loss: Considere um nível de stop loss caso o saldo comprometido ultrapasse seu limite de tolerância.
   - Monitoramento: Acompanhe diariamente a evolução do ativo e dos gregas.

5. **VEREDITO FINAL COM NOTA:**
   Dê uma nota de 0 a 10 para esta operação e justifique.
   [✅ EXECUTAR] ou [⚠️ AJUSTAR] ou [❌ NÃO EXECUTAR]

🎯 **ANÁLISE DE STRIKES - RECOMENDAÇÃO IMPORTANTE:**

Com base nos dados detalhados acima (especialmente PoP de ${(pop * 100).toFixed(1)}%, Margem de ${formatCurrency(margem)}, e Utilização de ${utilizacao.toFixed(1)}%):

**SUGIRA 3 STRIKES ALTERNATIVOS QUE POSSAM MELHORAR O RESULTADO:**

Para cada strike sugerido, considere:
- Strike atual selecionado: ${formatCurrency(strike)}
- Cotação do ativo: ${formatCurrency(spotPrice)}
- Tipo de operação: ${posicao}
- Objetivo: ${isVenda ? 'Maximizar prêmio recebido com risco controlado' : 'Melhor custo-benefício para proteção/especulação'}

Apresente em TABELA:
| Strike Sugerido | Distância % | Prêmio Estimado | PoP Estimada | Notional | Margem Necessária | Vantagens | Desvantagens |
|-----------------|-------------|-----------------|--------------|----------|-------------------|-----------|--------------|
| ...             | ...         | ...             | ...          | ...      | ...               | ...       | ...          |

📊 **ANÁLISE DE CENÁRIOS:**
Calcule e apresente em formato claro:
- ${ativoBase} subir +3%: Novo Spot = ${formatCurrency(spotPrice * 1.03)} → Resultado?
- ${ativoBase} subir +5%: Novo Spot = ${formatCurrency(spotPrice * 1.05)} → Resultado?
- ${ativoBase} cair -3%: Novo Spot = ${formatCurrency(spotPrice * 0.97)} → Resultado?
- ${ativoBase} cair -5%: Novo Spot = ${formatCurrency(spotPrice * 0.95)} → Resultado?
- ${ativoBase} ficar lateral (0%): Novo Spot = ${formatCurrency(spotPrice)} → Resultado?

📈 **NOVAS OPERAÇÕES OU ESTRATÉGIAS:**
Considerando a volatilidade implícita (${iv}), sugira explorar estratégias que possam otimizar ganhos ou reduzir riscos.

Responda SEMPRE EM PORTUGUÊS. Use Markdown com tabelas, emojis e formatação rica.
`;

        // Inicializar histórico
        currentChatHistory = [{role: 'user', content: context}];
        
        // Show Loading
        Swal.fire({
            title: 'Analisando Operação...',
            html: 'Consultando agente de IA especializado...',
            background: '#1f2937',
            color: '#f8f9fa',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ messages: currentChatHistory })
        });
        
        if (!res.ok) throw new Error('Erro na API');
        
        const data = await res.json();
        
        console.log('📩 Resposta da IA:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const analise = data.analysis || data.response || '';
        
        if (!analise || analise.trim() === '') {
            throw new Error('A IA retornou uma resposta vazia');
        }
        
        // Salvar no histórico
        currentChatHistory.push({role: 'model', content: analise});
        
        // Mostrar resultado usando o mesmo modal da simulação
        showAiResult(analise, data.agent, data.model);
        
    } catch (e) {
        console.error('Erro ao analisar com IA:', e);
        Swal.fire({
            icon: 'error',
            title: 'Erro na Análise',
            text: e.message,
            background: '#1f2937',
            color: '#f8f9fa'
        });
    }
}

// Expor função globalmente para onclick
window.analisarOperacaoComIA = analisarOperacaoComIA;

// Funções matemáticas movidas para global.js: cdf(), calculateIV(), calculateGreeks()

// ====================
// COTAÇÕES E API
// ====================

// Funções buscarCotacaoAtivoBase() e buscarDadosOpcao() duplicadas foram removidas
// Usar as versões nas linhas 810-909

async function refreshQuotes() {
    const btn = document.getElementById('btnRefresh');
    const original = btn ? btn.innerHTML : null;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    }
    try {
        cotacoesCache.clear();
        await loadOperacoes();
        updateMarketStatus();
        const modal = document.getElementById('modalDetalheOpcao');
        if (modal && modal.classList.contains('show') && typeof refreshDetalheOperacao === 'function') {
            await refreshDetalheOperacao();
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
}

async function buscarOpcoesAPI() {
    const ativoBase = document.getElementById('inputAtivoBase').value.toUpperCase();
    if (!ativoBase) {
        iziToast.warning({title: 'Atenção', message: 'Digite o código do ativo base'});
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalSelecionarOpcao'));
    modal.show();
    
    // Atualizar status do mercado no modal
    updateModalMarketStatus('modalSelecaoMarketStatus');
    
    const tbody = document.getElementById('tbodyOpcoes');
    tbody.innerHTML = '';
    
    document.getElementById('loadingOpcoes').style.display = 'block';
    document.getElementById('containerTabelaOpcoes').style.display = 'none';
    document.getElementById('semOpcoes').style.display = 'none';
    document.getElementById('infoAtivoBase').style.display = 'none';
    
    try {
        let data = null;
        const endpoints = [
            `${API_BASE}/api/proxy/options/${ativoBase}`,
            `${API_BASE}/api/market/opcoes/${ativoBase}`,
            `${API_BASE}/api/opcoes/market/${ativoBase}`,
            `${API_BASE}/api/cotacao/opcoes/${ativoBase}`
        ];
        
        for (const url of endpoints) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    data = await res.json();
                    break;
                }
            } catch (e) { console.log(e); }
        }
        
        if (!data) throw new Error('Não foi possível buscar opções');
        
        opcoesDisponiveis = data.opcoes || data.options || data || [];
        if (!Array.isArray(opcoesDisponiveis)) {
            if (data.results) opcoesDisponiveis = data.results;
            else opcoesDisponiveis = [];
        }

        // Tentar obter cotação do payload
        if (data.spot_price) cotacaoAtivoBase = parseFloat(data.spot_price);
        else if (data.price) cotacaoAtivoBase = parseFloat(data.price);
        else if (data.cotacao) cotacaoAtivoBase = parseFloat(data.cotacao);
        
        // Normalização de dados para garantir campos essenciais (Evitar erro de undefined)
        opcoesDisponiveis = opcoesDisponiveis.map(op => ({
            ...op,
            ativo: op.ativo || op.symbol || op.ticker || '',
            ativo_base: op.ativo_base || op.underlying || ativoBase,
            tipo: op.tipo || op.type || op.category || '',
            strike: parseFloat(op.strike || op.strike_price || 0),
            vencimento: op.vencimento || op.expiration || op.due_date || '',
            premio: parseFloat(op.premio || op.price || op.close || 0),
            delta: parseFloat(op.delta || (op.greeks && op.greeks.delta) || 0),
            theta: parseFloat(op.theta || (op.greeks && op.greeks.theta) || 0),
            gamma: parseFloat(op.gamma || (op.greeks && op.greeks.gamma) || 0),
            vega: parseFloat(op.vega || (op.greeks && op.greeks.vega) || 0),
            implied_volatility: parseFloat(op.implied_volatility || (op.greeks && op.greeks.implied_volatility) || 0)
        }));

        // Se cotação ainda nula, tenta pegar da primeira opção
        if (!cotacaoAtivoBase && opcoesDisponiveis.length > 0) {
            if (opcoesDisponiveis[0].preco_ativo_base) cotacaoAtivoBase = parseFloat(opcoesDisponiveis[0].preco_ativo_base);
            else if (opcoesDisponiveis[0].underlying_price) cotacaoAtivoBase = parseFloat(opcoesDisponiveis[0].underlying_price);
        }

        // Atualizar Título com Cotação
        if (cotacaoAtivoBase) {
            const formatted = cotacaoAtivoBase.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
            const titleEl = document.getElementById('tituloModalOpcoes');
            if (titleEl) titleEl.innerHTML = `Selecione uma opção ${ativoBase} - Última cotação: <span class="h1 bg-opacity-10 text-success border-bottom-0">${formatted}</span>`;
            
            // NÃO atualizar título da Simulação (já tem badge de mercado)
            // NÃO atualizar título de Nova Operação (já tem badge de mercado e cotação separada)
        }
        
        if (opcoesDisponiveis.length === 0) {
            document.getElementById('loadingOpcoes').style.display = 'none';
            document.getElementById('semOpcoes').style.display = 'block';
            return;
        }
        
        // Populate Vencimentos
        const vencimentos = [...new Set(opcoesDisponiveis
            .filter(o => o.vencimento)
            .map(o => o.vencimento))].sort();
            
        const selectVencimento = document.getElementById('filtroVencimento');
        selectVencimento.innerHTML = '<option value="TODOS">Todos os vencimentos</option>';
        
        const today = new Date().toISOString().split('T')[0];
        let nextVenc = vencimentos.find(v => v >= today);
        if (!nextVenc && vencimentos.length > 0) nextVenc = vencimentos[vencimentos.length - 1];
        
        vencimentos.forEach(v => {
            const option = document.createElement('option');
            option.value = v;
            option.textContent = formatDate(v);
            if (v === nextVenc) option.selected = true;
            selectVencimento.appendChild(option);
        });
        
        // Populate Info Header
        document.getElementById('infoAtivoBase').style.display = 'block';
        document.getElementById('infoAtivoNome').textContent = ativoBase;
        document.getElementById('infoTotalOpcoes').textContent = opcoesDisponiveis.length;
        
        // Render
        renderModalSelecionarOpcoesList();
        
    } catch (e) {
        console.error(e);
        iziToast.error({title: 'Erro', message: 'Erro ao buscar opções: ' + e.message});
        document.getElementById('loadingOpcoes').style.display = 'none';
        document.getElementById('semOpcoes').style.display = 'block';
    } finally {
        document.getElementById('loadingOpcoes').style.display = 'none';
        document.getElementById('containerTabelaOpcoes').style.display = 'block';
    }
}

function filtrarOpcoes() {
    renderModalSelecionarOpcoesList();
}

function renderModalSelecionarOpcoesList() {
    const vencimento = document.getElementById('filtroVencimento').value;
    const busca = document.getElementById('filtroBusca').value.toUpperCase();
    
    let filtered = opcoesDisponiveis.filter(op => {
        let matchVenc = (vencimento === 'TODOS' || op.vencimento === vencimento);
        let matchBusca = (op.ativo.includes(busca) || (op.ativo_base && op.ativo_base.includes(busca)));
        return matchVenc && matchBusca;
    });
    
    // Sort by strike
    filtered.sort((a, b) => parseFloatSafe(a.strike) - parseFloatSafe(b.strike));
    
    const tbody = document.getElementById('tbodyOpcoes');
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma opção encontrada com os filtros atuais</td></tr>';
        document.getElementById('contadorOpcoes').textContent = `0 opções exibidas`;
        return;
    }
    
    // Group by strike
    const strikes = [...new Set(filtered.map(o => parseFloatSafe(o.strike)))].sort((a,b) => a-b);
    
    // --- Logic for ATM Highlight and Limiting Rows ---
    let visibleStrikes = strikes;
    let atmStrikes = [];

    if (cotacaoAtivoBase) {
        // Find closest strike index
        let closestIndex = -1;
        let minDiff = Infinity;
        
        strikes.forEach((s, i) => {
            const diff = Math.abs(s - cotacaoAtivoBase);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        });
        
        if (closestIndex !== -1) {
            // Define 3 ATM strikes (Below, Closest, Above)
            const idx1 = closestIndex > 0 ? closestIndex - 1 : -1;
            const idx2 = closestIndex;
            const idx3 = closestIndex < strikes.length - 1 ? closestIndex + 1 : -1;
            
            if (idx1 !== -1) atmStrikes.push(strikes[idx1]);
            atmStrikes.push(strikes[idx2]);
            if (idx3 !== -1) atmStrikes.push(strikes[idx3]);
            
            // Limit Rows: +/- 10 from closest to reduce modal height
            const start = Math.max(0, closestIndex - 10);
            const end = Math.min(strikes.length, closestIndex + 11);
            visibleStrikes = strikes.slice(start, end);
        }
    }
    
    document.getElementById('contadorOpcoes').textContent = `${visibleStrikes.length} strikes exibidos (Total: ${filtered.length})`;

    visibleStrikes.forEach(strike => {
        const call = filtered.find(o => parseFloatSafe(o.strike) === strike && o.tipo === 'CALL');
        const put = filtered.find(o => parseFloatSafe(o.strike) === strike && o.tipo === 'PUT');
        
        if (!call && !put) return;
        
        const isATM = atmStrikes.includes(strike);
        // Style for ATM Strike Cell
        const strikeStyle = isATM ? 
            'background-color: #ffffff !important; color: #000000 !important; font-weight: bold; background-image: none !important; --bs-table-accent-bg: #ffffff !important; box-shadow: none !important;' 
            : 'bg-secondary bg-opacity-10';
        
        const tr = document.createElement('tr');
        const cellStyle = 'cursor: default; vertical-align: middle;';
        
        // Call Side
        if (call) {
             const diasCall = calcularDias(call.vencimento);
             let callDelta = call.delta !== undefined ? (typeof call.delta === 'number' ? call.delta : parseFloat(call.delta)) : 0;

             // Calculate Greeks if missing (Black-Scholes)
             if (Math.abs(callDelta) < 0.001 && cotacaoAtivoBase > 0 && call.premio > 0) {
                 const T = Math.max(diasCall.uteis / 252.0, 0.0001);
                 const r = 0.1075; 
                 const iv = calculateIV(call.premio, cotacaoAtivoBase, parseFloatSafe(call.strike), T, r, 'CALL');
                 const greeks = calculateGreeks(cotacaoAtivoBase, parseFloatSafe(call.strike), T, r, iv, 'CALL');
                 callDelta = greeks.delta;
                 call.calculatedGreeks = greeks;
             }
             
             tr.innerHTML += `
                <td style="${cellStyle}" class="text-start"><span class="text-nowrap fw-bold text-primary" style="cursor:pointer" onclick="selecionarOpcao('${call.ativo}')">${call.ativo}</span></td>
                <td style="${cellStyle}" class="text-end">${call.premio.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                <td style="${cellStyle}" class="text-center">${diasCall.corridos}/${diasCall.uteis}</td>
                <td style="${cellStyle}" class="text-center">
                    ${(callDelta*100).toFixed(1)} 
                    <span style="cursor:pointer" onclick="mostrarDetalhesOpcao('${call.ativo}')">📋</span>
                </td>
             `;
        } else {
             tr.innerHTML += `<td colspan="4"></td>`;
        }
        
        // Strike
        tr.innerHTML += `<td class="text-center fw-bold border-start border-end" style="${strikeStyle}; vertical-align: middle;">${strike.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>`;
        
        // Put Side
        if (put) {
             const diasPut = calcularDias(put.vencimento);
             let putDelta = put.delta !== undefined ? (typeof put.delta === 'number' ? put.delta : parseFloat(put.delta)) : 0;

             // Calculate Greeks if missing (Black-Scholes)
             if (Math.abs(putDelta) < 0.001 && cotacaoAtivoBase > 0 && put.premio > 0) {
                 const T = Math.max(diasPut.uteis / 252.0, 0.0001);
                 const r = 0.1075; 
                 const iv = calculateIV(put.premio, cotacaoAtivoBase, parseFloatSafe(put.strike), T, r, 'PUT');
                 const greeks = calculateGreeks(cotacaoAtivoBase, parseFloatSafe(put.strike), T, r, iv, 'PUT');
                 putDelta = greeks.delta;
                 put.calculatedGreeks = greeks;
             }

             tr.innerHTML += `
                <td style="${cellStyle}" class="text-center">
                    ${(putDelta*100).toFixed(1)} 
                    <span style="cursor:pointer" onclick="mostrarDetalhesOpcao('${put.ativo}')">📋</span>
                </td>
                <td style="${cellStyle}" class="text-center">${diasPut.corridos}/${diasPut.uteis}</td>
                <td style="${cellStyle}" class="text-end">${put.premio.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                <td style="${cellStyle}" class="text-end"><span class="text-nowrap fw-bold text-primary" style="cursor:pointer" onclick="selecionarOpcao('${put.ativo}')">${put.ativo}</span></td>
             `;
        } else {
             tr.innerHTML += `<td colspan="4"></td>`;
        }
        
        tbody.appendChild(tr);
    });
}

function selecionarOpcao(ativoOrOp) {
    let op = null;
    if (typeof ativoOrOp === 'string') {
        op = opcoesDisponiveis.find(o => o.ativo === ativoOrOp);
    } else {
        op = ativoOrOp;
    }
    
    if (!op) return;
    
    document.getElementById('inputAtivo').value = op.ativo;
    document.getElementById('inputTipo').value = op.tipo;
    document.getElementById('inputStrike').value = formatCurrency(parseFloatSafe(op.strike));
    document.getElementById('inputVencimento').value = op.vencimento;
    document.getElementById('inputPremio').value = formatCurrency(Math.abs(parseFloatSafe(op.premio)));
    
    // CORREÇÃO: preco_atual deve ser o prêmio no momento da criação da operação
    // Quando buscar do OpLab, usar op.preco_atual (preço do mercado)
    // Se não tiver, usar o próprio prêmio (que é o preço atual no momento da compra)
    const precoAtualOpcao = Math.abs(parseFloatSafe(op.preco_atual || op.premio));
    document.getElementById('inputPrecoAtual').value = formatCurrency(precoAtualOpcao);
    
    // Preencher Preço de Entrada com a cotação do ativo base (spot price)
    // Se spot_price existir, usar ele; senão usar premio como fallback
    const precoEntrada = op.spot_price || cotacaoAtivoBase || Math.abs(parseFloatSafe(op.premio));
    document.getElementById('inputPrecoEntrada').value = formatCurrency(parseFloatSafe(precoEntrada));
    
    // Preencher Ativo Base se disponível
    if (op.ativo_base) {
        document.getElementById('inputAtivoBase').value = op.ativo_base;
    }
    
    // Close modal
    const modalEl = document.getElementById('modalSelecionarOpcao');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    
    // Trigger calculation
    document.getElementById('inputPremio').dispatchEvent(new Event('blur'));
    // calcularResultado(); // Triggered by blur
}

// Expose to window for inline onclick handlers
window.selecionarOpcao = selecionarOpcao;

function renderHistoricoMensal() {
    const groups = groupByMonth(allOperacoes);
    // Render logic
}

function renderChartAnual(data, year) {
    const canvas = document.getElementById('chartAnual');
    if (!canvas) return;

    // Upgrade to Dashboard Layout if needed
    setupAnnualDashboard(canvas);

    // Group by month
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyData = new Array(12).fill(0);
    
    data.forEach(op => {
        if (op.data_operacao) {
            const m = parseInt(op.data_operacao.split('-')[1]) - 1;
            monthlyData[m] += parseFloat(op.resultado);
        }
    });

    // Update Metrics
    updateAnnualMetrics(data, monthlyData);
    renderAnnualResumo(data, year);

    const totalAnual = monthlyData.reduce((acc, v) => acc + v, 0);
    const chartLabels = [...months, 'Total'];
    const chartData = [...monthlyData, totalAnual];

    // Theme Config
    const isDarkMode = document.body.getAttribute('data-bs-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkMode ? '#f8f9fa' : '#666666';

    // Render Main Chart (Monthly)
    if (chartAnual) chartAnual.destroy();
    const ctx = canvas.getContext('2d');
    
    chartAnual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Resultado Mensal',
                data: chartData,
                backgroundColor: chartData.map((v, idx) => idx === chartData.length - 1 ? '#206bc4' : (v >= 0 ? '#2fb344' : '#d63939'))
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                }
            }
        }
    });

    // Render Additional Charts
    ensureAnnualExtraCharts();
    renderAdditionalCharts(data, monthlyData, months, isDarkMode, textColor, gridColor);
    renderAnnualTable(data);
}

function renderAnnualResumo(data, year) {
    const container = document.getElementById('anualResumoContainer');
    if (!container) return;

    const grouped = groupByMonth(data);
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const meta = parseFloat(config.meta || 0);
    const saldoAtual = parseFloat(config.saldoAcoes || 0);
    const saldoMap = computeSaldoAberturaFallback(data, saldoAtual);
    persistSaldoAberturaEstimada(data, saldoMap);

    let totalOps = 0;
    let totalPremios = 0;
    let totalCustos = 0;
    let totalResultado = 0;
    let totalWins = 0;

    const rows = [];
    const cards = [];

    for (let i = 1; i <= 12; i++) {
        const monthKey = `${year}-${String(i).padStart(2, '0')}`;
        const ops = grouped[monthKey] || [];
        const opsCount = ops.length;
        const totalPremioMes = ops.reduce((acc, op) => {
            const premio = parseFloatSafe(op.premio);
            const qtd = Math.abs(parseInt(op.quantidade || 0));
            return acc + (premio * (qtd || 1));
        }, 0);
        const resultadoMes = ops.reduce((acc, op) => acc + (parseFloat(op.resultado || 0)), 0);
        const custosMes = ops.reduce((acc, op) => {
            const res = parseFloat(op.resultado || 0);
            return acc + (res < 0 ? Math.abs(res) : 0);
        }, 0);
        const winsMes = ops.filter(op => (parseFloat(op.resultado || 0) > 0)).length;
        
        // Ordenar operações do mês por data (crescente) para pegar saldo inicial
        const opsOrdenadas = [...ops].sort((a, b) => {
            const da = new Date(a.data_operacao || a.created_at || 0);
            const db = new Date(b.data_operacao || b.created_at || 0);
            return da - db; // Crescente: mais antiga primeiro
        });
        
        // Saldo inicial do mês = saldo da primeira operação do mês
        const saldoInicialMes = opsOrdenadas.length > 0 ? getSaldoInfo(opsOrdenadas[0], saldoMap).saldo : 0;
        const rentabilidade = saldoInicialMes > 0 ? (resultadoMes / saldoInicialMes) * 100 : 0;
        const taxaAcerto = opsCount > 0 ? (winsMes / opsCount) * 100 : 0;
        
        // Barra de progresso baseada em rentabilidade (não meta)
        const rentabilidadeAbs = Math.abs(rentabilidade);
        const rentabilidadeBar = Math.min(100, rentabilidadeAbs);
        const rentBarClass = rentabilidade >= 5 ? 'bg-green' : rentabilidade >= 2 ? 'bg-blue' : rentabilidade >= 0 ? 'bg-yellow' : 'bg-red';

        totalOps += opsCount;
        totalPremios += totalPremioMes;
        totalCustos += custosMes;
        totalResultado += resultadoMes;
        totalWins += winsMes;

        const rowAttrs = opsCount > 0 ? `class="cursor-pointer" onclick="showMonthOperations(${year}, ${i})" style="cursor: pointer;"` : '';
        rows.push(`
            <tr ${rowAttrs}>
                <td>${getMonthName(monthKey).split('-')[0]}</td>
                <td class="text-end">${formatNumber(opsCount)}</td>
                <td class="text-end">${opsCount > 0 ? formatCurrency(saldoInicialMes) : '-'}</td>
                <td class="text-end">${formatCurrency(totalPremioMes)}</td>
                <td class="text-end">${formatCurrency(custosMes)}</td>
                <td class="text-end ${resultadoMes >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(resultadoMes)}</td>
                <td class="text-end ${rentabilidade >= 0 ? 'text-success' : 'text-danger'}">${rentabilidade.toFixed(1)}%</td>
                <td class="text-end">${taxaAcerto.toFixed(1)}%</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress progress-sm flex-grow-1 me-2" data-bs-toggle="tooltip" title="Rentabilidade sobre saldo inicial: ${formatCurrency(saldoInicialMes)}">
                            <div class="progress-bar ${rentBarClass}" style="width: ${rentabilidadeBar.toFixed(0)}%"></div>
                        </div>
                        <span class="text-muted small">${rentabilidade.toFixed(1)}%</span>
                    </div>
                </td>
            </tr>
        `);

        // Card com resultados (vermelho se negativo, verde se positivo) - só mostrar se tiver operações
        if (opsCount > 0) {
            const cardClass = resultadoMes >= 0 ? 'bg-green-lt' : 'bg-red-lt';
            const textClass = resultadoMes >= 0 ? 'text-success' : 'text-danger';
            cards.push(`
                <div class="col-6 col-sm-4 col-md-3 col-lg-2">
                    <div class="card card-sm ${cardClass}" onclick="showMonthOperations(${year}, ${i})" style="cursor: pointer;">
                        <div class="card-body text-center">
                            <div class="text-muted small">${getMonthName(monthKey).split('-')[0].substring(0, 3)}</div>
                            <div class="h3 mb-0 ${textClass}">${rentabilidade.toFixed(1)}%</div>
                            <div class="text-muted small">${opsCount} ops</div>
                            <div class="${textClass} fw-bold small">${formatCurrency(resultadoMes)}</div>
                        </div>
                    </div>
                </div>
            `);
        }
    }

    // Rentabilidade total anual = resultado total / saldo inicial do ano (primeira operação do ano)
    const allYearOps = [...data].sort((a, b) => {
        const da = new Date(a.data_operacao || a.created_at || 0);
        const db = new Date(b.data_operacao || b.created_at || 0);
        return da - db; // Crescente: mais antiga primeiro
    });
    const saldoInicialAno = allYearOps.length > 0 ? getSaldoInfo(allYearOps[0], saldoMap).saldo : 0;
    const totalRent = saldoInicialAno > 0 ? (totalResultado / saldoInicialAno) * 100 : 0;
    const totalTaxa = totalOps > 0 ? (totalWins / totalOps) * 100 : 0;

    container.innerHTML = `
        <div class="accordion" id="accordionResumoMensal">
            <div class="accordion-item">
                <h2 class="accordion-header" id="headingResumoMensal">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseResumoMensal" aria-expanded="false" aria-controls="collapseResumoMensal">
                        Resumo Mensal
                    </button>
                </h2>
                <div id="collapseResumoMensal" class="accordion-collapse collapse" aria-labelledby="headingResumoMensal" data-bs-parent="#accordionResumoMensal">
                    <div class="accordion-body p-0">
                        <div class="table-responsive">
                            <table class="table table-vcenter card-table mb-0">
                                <thead>
                                    <tr>
                                        <th>Mês</th>
                                        <th class="text-end">Operações</th>
                                        <th class="text-end">Saldo Inicial</th>
                                        <th class="text-end">Prêmios Recebidos</th>
                                        <th class="text-end">Custos</th>
                                        <th class="text-end">Resultado</th>
                                        <th class="text-end">Rentabilidade</th>
                                        <th class="text-end">Taxa Acerto</th>
                                        <th>Progresso</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows.join('')}
                                    <tr class="fw-bold">
                                        <td>Total</td>
                                        <td class="text-end">${formatNumber(totalOps)}</td>
                                        <td class="text-end">${formatCurrency(saldoInicialAno)}</td>
                                        <td class="text-end">${formatCurrency(totalPremios)}</td>
                                        <td class="text-end">${formatCurrency(totalCustos)}</td>
                                        <td class="text-end ${totalResultado >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(totalResultado)}</td>
                                        <td class="text-end ${totalRent >= 0 ? 'text-success' : 'text-danger'}">${totalRent.toFixed(1)}%</td>
                                        <td class="text-end">${totalTaxa.toFixed(1)}%</td>
                                        <td>${meta > 0 ? formatCurrency(meta) : '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="row row-cards mt-3 p-3 justify-content-center">
                            ${cards.join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Inicializar tooltips do Bootstrap
    setTimeout(() => {
        const tooltipTriggerList = container.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }, 100);
}

function showMonthOperations(year, month) {
    // Ensure modal exists in DOM
    let modalEl = document.getElementById('modalMonthOperations');
    if (!modalEl) {
        const modalHTML = `
            <div class="modal modal-blur fade" id="modalMonthOperations" tabindex="-1">
                <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalMonthOperationsTitle">Operações do Mês</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="modalMonthOperationsContent"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalEl = document.getElementById('modalMonthOperations');
    }

    // Get operations for the month
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const allOps = window.allOperacoes || [];
    const monthOps = allOps.filter(op => {
        const opDate = new Date(op.data_operacao || op.created_at);
        const opMonth = `${opDate.getFullYear()}-${String(opDate.getMonth() + 1).padStart(2, '0')}`;
        return opMonth === monthKey;
    });

    // Sort by date descending
    monthOps.sort((a, b) => {
        const da = new Date(a.data_operacao || a.created_at || 0);
        const db = new Date(b.data_operacao || b.created_at || 0);
        return db - da;
    });

    // Build table HTML
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoAtual = parseFloat(config.saldoAcoes || 0);
    const saldoMap = computeSaldoAberturaFallback(allOps, saldoAtual);

    const rows = monthOps.map(op => {
        const saldoInfo = getSaldoInfo(op, saldoMap);
        const resultado = parseFloat(op.resultado || 0);
        const perc = saldoInfo.saldo > 0 ? (resultado / saldoInfo.saldo) * 100 : 0;
        
        // Calcular exercício usando função global
        const exercida = calcularExercicio(op.tipo, parseFloatSafe(op.preco_atual), parseFloatSafe(op.strike));
        const exercicioBadgeHTML = gerarBadgeExercicio(exercida, op.status);
        
        const tipoBadge = op.tipo === 'CALL' ? 'bg-green text-green-fg' : 'bg-red text-red-fg';
        
        // Badge de tipo de operação (COMPRA/VENDA)
        const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && Number.parseInt(op.quantidade) < 0);
        const tipoOpBadge = isVenda ? 'bg-red text-red-fg' : 'bg-green text-green-fg';
        const tipoOpText = isVenda ? 'VENDA' : 'COMPRA';

        return `
            <tr>
                <td>${formatDateCell(op.data_operacao)}</td>
                <td class="fw-bold">
                    ${op.ativo}
                    <span class="badge ${tipoOpBadge} ms-1">${tipoOpText}</span>
                </td>
                <td><span class="badge ${tipoBadge}">${op.tipo}</span></td>
                <td>${formatCurrency(parseFloatSafe(op.strike))}</td>
                <td>${exercicioBadgeHTML}</td>
                <td>${formatCurrency(saldoInfo.saldo)}${saldoInfo.estimado ? ' <span class="badge bg-yellow text-yellow-fg ms-1">estimado</span>' : ''}</td>
                <td class="${resultado >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(resultado)}</td>
                <td class="${perc >= 0 ? 'text-success' : 'text-danger'}">${perc.toFixed(2)}%</td>
                <td>
                    <button class="btn btn-sm btn-info btn-icon" onclick="openDetalheFromMonthModal('${op.id}')" title="Detalhes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Calculate totals
    const totalResultado = monthOps.reduce((acc, op) => acc + parseFloat(op.resultado || 0), 0);
    const totalPremios = monthOps.reduce((acc, op) => {
        const premio = parseFloatSafe(op.premio);
        const qtd = Math.abs(parseInt(op.quantidade || 0));
        return acc + (premio * (qtd || 1));
    }, 0);

    // Calculate initial balance (first operation of month)
    const monthOpsSorted = [...monthOps].sort((a, b) => {
        const da = new Date(a.data_operacao || a.created_at || 0);
        const db = new Date(b.data_operacao || b.created_at || 0);
        return da - db; // Crescente: mais antiga primeiro
    });
    const saldoInicialMes = monthOpsSorted.length > 0 ? getSaldoInfo(monthOpsSorted[0], saldoMap).saldo : 0;
    const rentabilidadeMes = saldoInicialMes > 0 ? (totalResultado / saldoInicialMes) * 100 : 0;

    // Update modal title
    const titleEl = document.getElementById('modalMonthOperationsTitle');
    if (titleEl) {
        titleEl.textContent = `Operações de ${getMonthName(monthKey)} - ${monthOps.length} operação${monthOps.length !== 1 ? 'ões' : ''}`;
    }

    // Update modal content
    const contentEl = document.getElementById('modalMonthOperationsContent');
    if (contentEl) {
        contentEl.innerHTML = `
            <div class="row mb-3">
                <div class="col-6 col-lg-3 mb-2">
                    <div class="card">
                        <div class="card-body p-2">
                            <div class="d-flex align-items-center">
                                <div class="subheader small">Total de Operações</div>
                                <div class="ms-auto lh-1">
                                    <div class="h2 mb-0">${monthOps.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-lg-3 mb-2">
                    <div class="card">
                        <div class="card-body p-2">
                            <div class="d-flex align-items-center">
                                <div class="subheader small">Saldo Inicial</div>
                                <div class="ms-auto lh-1">
                                    <div class="h2 mb-0">${formatCurrency(saldoInicialMes)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-lg-3 mb-2">
                    <div class="card">
                        <div class="card-body p-2">
                            <div class="d-flex align-items-center">
                                <div class="subheader small">Resultado Total</div>
                                <div class="ms-auto lh-1">
                                    <div class="h2 mb-0 ${totalResultado >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(totalResultado)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-lg-3 mb-2">
                    <div class="card">
                        <div class="card-body p-2">
                            <div class="d-flex align-items-center">
                                <div class="subheader small">Rentabilidade</div>
                                <div class="ms-auto lh-1">
                                    <div class="h2 mb-0 ${rentabilidadeMes >= 0 ? 'text-success' : 'text-danger'}">${rentabilidadeMes.toFixed(2)}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-vcenter card-table">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Ativo</th>
                            <th>Tipo</th>
                            <th>Strike</th>
                            <th>Exercida</th>
                            <th>Saldo Abertura</th>
                            <th>Resultado</th>
                            <th>%</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="9" class="text-center text-muted">Nenhuma operação neste mês</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Show modal
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

function openDetalheFromMonthModal(opId) {
    // Fechar modal de operações do mês
    const modalMonthEl = document.getElementById('modalMonthOperations');
    if (modalMonthEl) {
        const modalMonth = bootstrap.Modal.getInstance(modalMonthEl);
        if (modalMonth) {
            modalMonth.hide();
        }
    }
    
    // Aguardar um momento para a modal fechar e então abrir a modal de detalhes
    setTimeout(() => {
        openDetalheOperacao(opId);
    }, 300);
}

function renderAnnualTable(data) {
    const container = document.getElementById('anualTabelaContainer');
    if (!container) return;

    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoAtual = parseFloat(config.saldoAcoes || 0);
    const saldoMap = computeSaldoAberturaFallback(data, saldoAtual);
    persistSaldoAberturaEstimada(data, saldoMap);

    const rows = [...data]
        .sort((a, b) => {
            const da = new Date(a.data_operacao || a.created_at || 0);
            const db = new Date(b.data_operacao || b.created_at || 0);
            return db - da;
        })
        .map(op => {
            const saldoInfo = getSaldoInfo(op, saldoMap);
            const resultado = parseFloat(op.resultado || 0);
            const perc = saldoInfo.saldo > 0 ? (resultado / saldoInfo.saldo) * 100 : 0;
            
            // Calcular exercício usando função global
            const exercida = calcularExercicio(op.tipo, parseFloatSafe(op.preco_atual), parseFloatSafe(op.strike));
            const exercicioBadgeHTML = gerarBadgeExercicio(exercida, op.status);
            
            const tipoBadge = op.tipo === 'CALL' ? 'bg-green text-green-fg' : 'bg-red text-red-fg';
            
            // Badge de tipo de operação (COMPRA/VENDA)
            const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && Number.parseInt(op.quantidade) < 0);
            const tipoOpBadge = isVenda ? 'bg-red text-red-fg' : 'bg-green text-green-fg';
            const tipoOpText = isVenda ? 'VENDA' : 'COMPRA';

            return `
                <tr>
                    <td>${formatDateCell(op.data_operacao)}</td>
                    <td class="fw-bold">
                        ${op.ativo}
                        <span class="badge ${tipoOpBadge} ms-1">${tipoOpText}</span>
                    </td>
                    <td><span class="badge ${tipoBadge}">${op.tipo}</span></td>
                    <td>${formatCurrency(parseFloatSafe(op.strike))}</td>
                    <td>${exercicioBadgeHTML}</td>
                    <td>${formatCurrency(saldoInfo.saldo)}${saldoInfo.estimado ? ' <span class="badge bg-yellow text-yellow-fg ms-1">estimado</span>' : ''}</td>
                    <td class="${resultado >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(resultado)}</td>
                    <td class="${perc >= 0 ? 'text-success' : 'text-danger'}">${perc.toFixed(2)}%</td>
                    <td>
                        <button class="btn btn-sm btn-info btn-icon" onclick="openDetalheOperacao('${op.id}')" title="Detalhes">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        </button>
                    </td>
                </tr>
            `;
        })
        .join('');

    container.innerHTML = `
        <div class="accordion mt-3" id="anualOperacoesAccordion">
            <div class="accordion-item">
                <h2 class="accordion-header" id="headingOperacoesDetalhadas">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOperacoesDetalhadas" aria-expanded="false" aria-controls="collapseOperacoesDetalhadas">
                        🧾 Operações Detalhadas
                    </button>
                </h2>
                <div id="collapseOperacoesDetalhadas" class="accordion-collapse collapse" aria-labelledby="headingOperacoesDetalhadas" data-bs-parent="#anualOperacoesAccordion">
                    <div class="accordion-body p-0">
                        <div class="table-responsive">
                            <table class="table table-vcenter card-table mb-0">
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Ativo</th>
                                        <th>Tipo</th>
                                        <th>Strike</th>
                                        <th>Exercido</th>
                                        <th>Saldo Abertura</th>
                                        <th>Resultado</th>
                                        <th>%</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

let lastSaldoFilteredOps = [];

function openSaldoCorretoraModal() {
    const modalEl = document.getElementById('modalSaldoOperacoes');
    if (!modalEl) return;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    const periodoEl = document.getElementById('saldoPeriodo');
    if (periodoEl && !periodoEl.value) periodoEl.value = 'year';
    if (periodoEl && periodoEl.value !== 'custom') {
        applySaldoPeriodo(periodoEl.value);
    } else {
        const today = new Date();
        const start = new Date(today.getFullYear(), 0, 1);
        const inicioEl = document.getElementById('saldoInicio');
        const fimEl = document.getElementById('saldoFim');
        if (inicioEl && !inicioEl.value) inicioEl.value = start.toISOString().slice(0, 10);
        if (fimEl && !fimEl.value) fimEl.value = today.toISOString().slice(0, 10);
    }

    updateSaldoCorretoraModal();
}

function applySaldoPeriodo(periodo) {
    const inicioEl = document.getElementById('saldoInicio');
    const fimEl = document.getElementById('saldoFim');
    if (!inicioEl || !fimEl) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = null;
    let end = new Date(today);

    if (periodo === 'year') {
        start = new Date(today.getFullYear(), 0, 1);
    } else if (periodo === 'month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (periodo === '7') {
        start = new Date(today);
        start.setDate(start.getDate() - 6);
    } else if (periodo === '12') {
        start = new Date(today);
        start.setDate(start.getDate() - 364);
    } else if (periodo === 'lastYear') {
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
    } else if (periodo === '30' || periodo === '60' || periodo === '90') {
        start = new Date(today);
        start.setDate(start.getDate() - (parseInt(periodo, 10) - 1));
    } else {
        return;
    }

    inicioEl.value = start.toISOString().slice(0, 10);
    fimEl.value = end.toISOString().slice(0, 10);
}

async function updateSaldoCorretoraModal() {
    const inicio = document.getElementById('saldoInicio')?.value;
    const fim = document.getElementById('saldoFim')?.value;
    if (!inicio || !fim) return;
    const tipoFiltro = document.getElementById('saldoTipo')?.value || 'ALL';

    const res = await fetch(`${API_BASE}/api/opcoes?_=${Date.now()}`, { cache: 'no-store' });
    const ops = await res.json();

    const startDate = new Date(inicio);
    const endDate = new Date(fim);
    endDate.setHours(23, 59, 59, 999);

    const filtered = ops.filter(op => {
        const d = new Date(op.data_operacao || op.created_at || 0);
        const matchTipo = tipoFiltro === 'ALL' || op.tipo === tipoFiltro;
        return d >= startDate && d <= endDate && matchTipo;
    });

    lastSaldoFilteredOps = filtered;
    renderSaldoResumo(filtered);
    renderSaldoCharts(filtered);
    renderSaldoTabela(filtered);
    updateSaldoInsights(filtered);
}

function renderSaldoResumo(ops) {
    const resumo = document.getElementById('saldoResumo');
    if (!resumo) return;
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoAtual = parseFloat(config.saldoAcoes || 0);
    const saldoMap = computeSaldoAberturaFallback(ops, saldoAtual);
    persistSaldoAberturaEstimada(ops, saldoMap);
    const totalOps = ops.length;
    const totalResultado = ops.reduce((acc, op) => acc + (parseFloat(op.resultado) || 0), 0);
    const percMedio = totalOps > 0 ? ops.reduce((acc, op) => {
        const saldo = (saldoMap.get(op.id) ?? parseFloat(op.saldo_abertura || 0));
        const res = parseFloat(op.resultado || 0);
        return acc + (saldo > 0 ? (res / saldo) * 100 : 0);
    }, 0) / totalOps : 0;
    const opsPositivas = ops.filter(op => (parseFloat(op.resultado) || 0) > 0).length;
    const winRate = totalOps > 0 ? (opsPositivas / totalOps) * 100 : 0;

    resumo.innerHTML = `
        <div class="col-md-3">
            <div class="card">
                <div class="card-body">
                    <div class="text-muted">Total de Operações</div>
                    <div class="h2">${totalOps}</div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card">
                <div class="card-body">
                    <div class="text-muted">Resultado Total</div>
                    <div class="h2 ${totalResultado >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(totalResultado)}</div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card">
                <div class="card-body">
                    <div class="text-muted">Rentabilidade Média</div>
                    <div class="h2">${percMedio.toFixed(2)}%</div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card">
                <div class="card-body">
                    <div class="text-muted">Taxa de Acerto</div>
                    <div class="h2">${winRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    `;
}

function renderSaldoCharts(ops) {
    if (typeof Chart === 'undefined') return;

    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoAtual = parseFloat(config.saldoAcoes || 0);
    const saldoMap = computeSaldoAberturaFallback(ops, saldoAtual);
    persistSaldoAberturaEstimada(ops, saldoMap);

    const sorted = [...ops].sort((a, b) => {
        const da = new Date(a.data_operacao || a.created_at || 0);
        const db = new Date(b.data_operacao || b.created_at || 0);
        return da - db; // ordem crescente (mais antiga primeiro) para gráfico acumulado
    });
    let acumulado = 0;
    const labels = [];
    const data = [];
    sorted.forEach(op => {
        const res = parseFloat(op.resultado || 0);
        acumulado += res;
        labels.push(formatDate(op.data_operacao));
        data.push(acumulado);
    });

    const canvasLine = document.getElementById('chartSaldoAcumulado');
    if (canvasLine) {
        if (chartSaldoAcumulado) chartSaldoAcumulado.destroy();
        chartSaldoAcumulado = new Chart(canvasLine.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Acumulado',
                    data,
                    borderColor: '#2fb344',
                    backgroundColor: 'rgba(47, 179, 68, 0.15)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    const callCount = ops.filter(op => op.tipo === 'CALL').length;
    const putCount = ops.filter(op => op.tipo === 'PUT').length;
    const canvasPie = document.getElementById('chartSaldoTipo');
    if (canvasPie) {
        if (chartSaldoTipo) chartSaldoTipo.destroy();
        chartSaldoTipo = new Chart(canvasPie.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['CALL', 'PUT'],
                datasets: [{
                    data: [callCount, putCount],
                    backgroundColor: ['#2fb344', '#d63939']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

function renderSaldoTabela(ops) {
    const tbody = document.querySelector('#saldoTabela tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoAtual = parseFloat(config.saldoAcoes || 0);
    const saldoMap = computeSaldoAberturaFallback(ops, saldoAtual);
    persistSaldoAberturaEstimada(ops, saldoMap);

    ops.sort((a, b) => {
        const da = new Date(a.data_operacao || a.created_at || 0);
        const db = new Date(b.data_operacao || b.created_at || 0);
        return db - da;
    }).forEach(op => {
        const saldoInfo = getSaldoInfo(op, saldoMap);
        const resultado = parseFloat(op.resultado || 0);
        const perc = saldoInfo.saldo > 0 ? (resultado / saldoInfo.saldo) * 100 : 0;
        
        // Calcular exercício usando função global
        const exercida = calcularExercicio(op.tipo, parseFloatSafe(op.preco_atual), parseFloatSafe(op.strike));
        const exercicioBadgeHTML = gerarBadgeExercicio(exercida, op.status);
        
        // Badge de tipo de operação (COMPRA/VENDA)
        const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && Number.parseInt(op.quantidade) < 0);
        const tipoOpBadge = isVenda ? 'bg-red text-red-fg' : 'bg-green text-green-fg';
        const tipoOpText = isVenda ? 'VENDA' : 'COMPRA';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateCell(op.data_operacao)}</td>
            <td class="fw-bold">
                ${op.ativo}
                <span class="badge ${tipoOpBadge} ms-1">${tipoOpText}</span>
            </td>
            <td><span class="badge ${op.tipo === 'CALL' ? 'bg-green text-green-fg' : 'bg-red text-red-fg'}">${op.tipo}</span></td>
            <td>${formatCurrency(parseFloatSafe(op.strike))}</td>
            <td>${exercicioBadgeHTML}</td>
            <td>${formatCurrency(saldoInfo.saldo)}${saldoInfo.estimado ? ' <span class="badge bg-yellow text-yellow-fg ms-1">estimado</span>' : ''}</td>
            <td class="${resultado >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(resultado)}</td>
            <td class="${perc >= 0 ? 'text-success' : 'text-danger'}">${perc.toFixed(2)}%</td>
            <td>
                <button class="btn btn-sm btn-info btn-icon" onclick="openDetalheOperacao('${op.id}')" title="Detalhes">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateSaldoInsights(ops) {
    const modalEl = document.getElementById('modalSaldoInsights');
    if (!modalEl) return;

    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoAtual = parseFloat(config.saldoAcoes || 0);
    const saldoMap = computeSaldoAberturaFallback(ops, saldoAtual);
    persistSaldoAberturaEstimada(ops, saldoMap);

    const totalOps = ops.length;
    let totalResultado = 0;
    let maxResultado = null;
    let minResultado = null;
    let totalSaldo = 0;
    let sumPos = 0;
    let sumNeg = 0;
    let wins = 0;
    let losses = 0;
    let totalDias = 0;
    let countDias = 0;

    ops.forEach(op => {
        const resultado = parseFloat(op.resultado || 0);
        totalResultado += resultado;
        if (maxResultado === null || resultado > maxResultado) maxResultado = resultado;
        if (minResultado === null || resultado < minResultado) minResultado = resultado;

        if (resultado > 0) {
            sumPos += resultado;
            wins += 1;
        } else if (resultado < 0) {
            sumNeg += resultado;
            losses += 1;
        }

        const saldoInfo = getSaldoInfo(op, saldoMap);
        totalSaldo += saldoInfo.saldo;

        if (op.data_operacao && op.vencimento) {
            const inicio = parseDateInput(op.data_operacao);
            const fim = parseDateInput(op.vencimento);
            if (!inicio || !fim || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
                return;
            }
            const diff = Math.round((fim - inicio) / (1000 * 60 * 60 * 24));
            if (!isNaN(diff)) {
                totalDias += diff;
                countDias += 1;
            }
        }
    });

    const resultadoMedio = totalOps > 0 ? totalResultado / totalOps : 0;
    const expectativa = totalSaldo > 0 ? (totalResultado / totalSaldo) * 100 : 0;
    const avgWin = wins > 0 ? sumPos / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(sumNeg) / losses : 0;
    const payoff = avgLoss > 0 ? avgWin / avgLoss : 0;
    const profitFactor = sumNeg < 0 ? sumPos / Math.abs(sumNeg) : (sumPos > 0 ? Infinity : 0);
    const winRate = totalOps > 0 ? (wins / totalOps) * 100 : 0;
    const mediaDias = countDias > 0 ? Math.round(totalDias / countDias) : null;

    console.log('[Insights] Cálculos:', {
        totalOps, wins, losses,
        sumPos, sumNeg, avgWin, avgLoss,
        payoff, profitFactor,
        totalResultado, totalSaldo
    });

    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    if (ops.length > 0) {
        const sorted = [...ops].sort((a, b) => new Date(a.data_operacao || a.created_at || 0) - new Date(b.data_operacao || b.created_at || 0));
        const firstSaldo = getSaldoInfo(sorted[0], saldoMap).saldo || saldoAtual;
        let equity = firstSaldo;
        let peak = equity;
        sorted.forEach(op => {
            equity += parseFloat(op.resultado || 0);
            if (equity > peak) peak = equity;
            const dd = equity - peak;
            if (dd < maxDrawdown) maxDrawdown = dd;
        });
        maxDrawdownPct = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
    }

    const returns = ops.map(op => {
        const info = getSaldoInfo(op, saldoMap);
        const saldo = info.saldo || 0;
        return saldo > 0 ? (parseFloat(op.resultado || 0) / saldo) : 0;
    });
    const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 ? returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / returns.length : 0;
    const stdReturn = Math.sqrt(variance);
    const sharpe = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(returns.length) : 0;

    const resultadoMedioEl = document.getElementById('insightResultadoMedio');
    const maiorGanhoEl = document.getElementById('insightMaiorGanho');
    const maiorPerdaEl = document.getElementById('insightMaiorPerda');
    const expectativaEl = document.getElementById('insightExpectativa');
    const payoffEl = document.getElementById('insightPayoff');
    const profitFactorEl = document.getElementById('insightProfitFactor');
    const drawdownEl = document.getElementById('insightMaxDrawdown');
    const drawdownPctEl = document.getElementById('insightMaxDrawdownPct');
    const sharpeEl = document.getElementById('insightSharpe');
    const resultadoTotalEl = document.getElementById('insightResultadoTotal');
    const taxaAcertoEl = document.getElementById('insightTaxaAcerto');
    const totalOpsEl = document.getElementById('insightTotalOps');
    const mediaDiasEl = document.getElementById('insightMediaDias');

    if (resultadoMedioEl) resultadoMedioEl.textContent = formatCurrency(resultadoMedio);
    if (maiorGanhoEl) maiorGanhoEl.textContent = maxResultado === null ? '-' : formatCurrency(maxResultado);
    if (maiorPerdaEl) maiorPerdaEl.textContent = minResultado === null ? '-' : formatCurrency(minResultado);
    if (expectativaEl) expectativaEl.textContent = `${expectativa.toFixed(2)}%`;
    if (payoffEl) {
        if (losses === 0) {
            payoffEl.textContent = 'N/A';
            payoffEl.title = 'Sem operações negativas para calcular payoff';
        } else {
            payoffEl.textContent = payoff > 0 ? payoff.toFixed(2) : '-';
            payoffEl.title = '';
        }
    }
    if (profitFactorEl) profitFactorEl.textContent = Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞';
    if (drawdownEl) drawdownEl.textContent = maxDrawdown !== 0 ? formatCurrency(maxDrawdown) : 'R$ 0,00';
    if (drawdownPctEl) drawdownPctEl.textContent = maxDrawdownPct !== 0 ? `${maxDrawdownPct.toFixed(1)}%` : '0%';
    if (sharpeEl) sharpeEl.textContent = sharpe !== 0 ? sharpe.toFixed(2) : '-';
    if (resultadoTotalEl) resultadoTotalEl.textContent = formatCurrency(totalResultado);
    if (taxaAcertoEl) taxaAcertoEl.textContent = `${winRate.toFixed(1)}%`;
    if (totalOpsEl) totalOpsEl.textContent = `${wins}/${totalOps} operações`;
    if (mediaDiasEl) mediaDiasEl.textContent = mediaDias !== null ? `${mediaDias} dias` : '-';

    const riscoEl = document.getElementById('insightExposicaoRisco');
    const eficienciaEl = document.getElementById('insightEficiencia');
    const riscoPct = Math.abs(maxDrawdownPct);
    let riscoLabel = 'Baixo';
    let riscoClass = 'text-success';
    if (riscoPct > 12) {
        riscoLabel = 'Alto';
        riscoClass = 'text-danger';
    } else if (riscoPct > 6) {
        riscoLabel = 'Moderado';
        riscoClass = 'text-warning';
    }
    let eficienciaLabel = 'Boa';
    let eficienciaClass = 'text-primary';
    if (winRate >= 70 && profitFactor >= 1.4) {
        eficienciaLabel = 'Excelente';
        eficienciaClass = 'text-success';
    } else if (winRate < 50 || profitFactor < 1) {
        eficienciaLabel = 'Atenção';
        eficienciaClass = 'text-danger';
    }
    if (riscoEl) riscoEl.innerHTML = `<span class="${riscoClass}">${riscoLabel}</span>`;
    if (eficienciaEl) eficienciaEl.innerHTML = `<span class="${eficienciaClass}">${eficienciaLabel}</span>`;

    // Populate new metric cards (left column)
    const setTextSafe = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setTextSafe('metricSharpe', sharpe !== 0 ? sharpe.toFixed(2) : '-');
    setTextSafe('metricTaxaAcerto', `${winRate.toFixed(1)}%`);
    setTextSafe('metricTaxaAcertoStatus', winRate === 100 ? 'Perfeito no período' : winRate >= 70 ? 'Excelente' : winRate >= 55 ? 'Bom' : 'Irregular');
    setTextSafe('metricDrawdown', maxDrawdown !== 0 ? formatCurrency(maxDrawdown) : 'R$ 0,00');
    setTextSafe('metricExposicao', riscoLabel);
    setTextSafe('metricResultadoTotal', formatCurrency(totalResultado));
    setTextSafe('metricResultadoPorOp', `+${expectativa.toFixed(2)}% por operação`);
    setTextSafe('metricDuracao', mediaDias !== null ? `${mediaDias} dias` : '-');
    setTextSafe('metricFatorLucro', Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞');
    setTextSafe('metricEficiencia', eficienciaLabel);

    // Populate insight cards (right column)
    setTextSafe('perfMaiorGanho', maxResultado === null ? '-' : formatCurrency(maxResultado));
    setTextSafe('perfMenorGanho', minResultado === null ? '-' : formatCurrency(minResultado));
    setTextSafe('perfResultadoMedio', formatCurrency(resultadoMedio));
    setTextSafe('perfExpectativa', `+${expectativa.toFixed(2)}%`);
    
    setTextSafe('riscoSharpe', sharpe !== 0 ? sharpe.toFixed(2) : '-');
    setTextSafe('riscoDrawdown', maxDrawdown !== 0 ? formatCurrency(maxDrawdown) : 'R$ 0,00');
    setTextSafe('riscoExposicao', riscoLabel);
    if (losses === 0) {
        setTextSafe('riscoPayoff', 'N/A*');
        setTextSafe('riscoPayoffNote', '* Payoff não calculável devido à ausência de perdas');
    } else {
        setTextSafe('riscoPayoff', payoff > 0 ? payoff.toFixed(2) : '-');
        setTextSafe('riscoPayoffNote', '');
    }
    
    setTextSafe('opTotalOps', totalOps.toString());
    setTextSafe('opDuracao', mediaDias !== null ? `${mediaDias} dias` : '-');
    setTextSafe('opEficiencia', eficienciaLabel);
    setTextSafe('opFatorLucro', Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞');

    // Old elements (keep for compatibility)
    const callCount = ops.filter(op => (op.tipo || '').toUpperCase() === 'CALL').length;
    const putCount = ops.filter(op => (op.tipo || '').toUpperCase() === 'PUT').length;
    const callPct = totalOps > 0 ? (callCount / totalOps) * 100 : 0;
    const putPct = totalOps > 0 ? (putCount / totalOps) * 100 : 0;
    const posPct = totalOps > 0 ? (wins / totalOps) * 100 : 0;
    const negPct = totalOps > 0 ? (losses / totalOps) * 100 : 0;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    const setWidth = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.style.width = `${value.toFixed(0)}%`;
    };
    setText('insightCallPct', `${callPct.toFixed(0)}%`);
    setText('insightPutPct', `${putPct.toFixed(0)}%`);
    setText('insightPosPct', `${posPct.toFixed(0)}%`);
    setText('insightNegPct', `${negPct.toFixed(0)}%`);
    setWidth('insightCallBar', callPct);
    setWidth('insightPutBar', putPct);
    setWidth('insightPosBar', posPct);
    setWidth('insightNegBar', negPct);

    const distCanvas = document.getElementById('insightDistribuicaoChart');
    if (distCanvas && typeof Chart !== 'undefined') {
        if (chartInsightsDistribuicao) chartInsightsDistribuicao.destroy();
        chartInsightsDistribuicao = new Chart(distCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Positivas', 'Negativas'],
                datasets: [{
                    data: [wins, losses],
                    backgroundColor: ['#2fb344', '#d63939'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Remove old recentes table population (replaced with Visualizações chart)
    // Populate visualizações accordion
    const vizCanvas = document.getElementById('insightEvolutionChart');
    if (vizCanvas && typeof Chart !== 'undefined') {
        if (chartInsightsEvolution) chartInsightsEvolution.destroy();
        
        // Build evolution data
        const sorted = [...ops].sort((a, b) => new Date(a.data_operacao || a.created_at || 0) - new Date(b.data_operacao || b.created_at || 0));
        const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
        const saldoInicial = parseFloat(config.saldoAcoes || 0);
        let equity = saldoInicial;
        const dates = [];
        const values = [];
        
        sorted.forEach(op => {
            equity += parseFloat(op.resultado || 0);
            const dt = new Date(op.data_operacao || op.created_at || 0);
            dates.push(dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            values.push(equity);
        });
        
        chartInsightsEvolution = new Chart(vizCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Capital Acumulado (R$)',
                    data: values,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'bottom' }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function(value) {
                                return 'R$ ' + value.toLocaleString('pt-BR');
                            }
                        }
                    }
                }
            }
        });
    }

    const autoList = document.getElementById('insightAutoList');
    if (autoList) {
        const autoItems = [];
        autoItems.push({
            title: winRate >= 70 ? 'Consistência excelente' : winRate >= 55 ? 'Consistência boa' : 'Consistência irregular',
            text: `${wins} de ${totalOps} operações positivas`,
            badge: winRate >= 70 ? 'bg-green' : winRate >= 55 ? 'bg-blue' : 'bg-red'
        });
        autoItems.push({
            title: payoff >= 1.3 ? 'Payoff saudável' : 'Payoff a melhorar',
            text: `Payoff ${payoff > 0 ? payoff.toFixed(2) : '-'} | Fator ${Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞'}`,
            badge: payoff >= 1.3 ? 'bg-green' : 'bg-yellow'
        });
        autoItems.push({
            title: riscoLabel === 'Baixo' ? 'Risco controlado' : riscoLabel === 'Moderado' ? 'Risco moderado' : 'Risco elevado',
            text: `Drawdown ${maxDrawdown !== 0 ? formatCurrency(maxDrawdown) : '-'}`,
            badge: riscoLabel === 'Baixo' ? 'bg-green' : riscoLabel === 'Moderado' ? 'bg-yellow' : 'bg-red'
        });
        autoItems.push({
            title: eficienciaLabel === 'Excelente' ? 'Eficiência excelente' : eficienciaLabel === 'Boa' ? 'Eficiência boa' : 'Eficiência baixa',
            text: `Sharpe ${sharpe !== 0 ? sharpe.toFixed(2) : '-'}`,
            badge: eficienciaLabel === 'Excelente' ? 'bg-green' : eficienciaLabel === 'Boa' ? 'bg-blue' : 'bg-red'
        });

        autoList.innerHTML = autoItems.map(item => `
            <div class="d-flex align-items-center mb-2">
                <span class="badge ${item.badge} me-2"></span>
                <div>
                    <div class="fw-bold">${item.title}</div>
                    <div class="text-muted small">${item.text}</div>
                </div>
            </div>
        `).join('');
    }
}

function openSaldoInsightsModal() {
    const modalEl = document.getElementById('modalSaldoInsights');
    if (!modalEl) return;
    updateSaldoInsights(lastSaldoFilteredOps);
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

function computeSaldoAberturaFallback(ops, saldoAtual) {
    const map = new Map();
    if (!Array.isArray(ops) || ops.length === 0) return map;

    const sorted = [...ops].sort((a, b) => {
        const da = new Date(a.data_operacao || a.created_at || 0);
        const db = new Date(b.data_operacao || b.created_at || 0);
        return db - da;
    });

    let saldo = saldoAtual;
    sorted.forEach(op => {
        const existing = parseFloat(op.saldo_abertura || 0);
        const saldoAbertura = existing > 0 ? existing : saldo;
        map.set(op.id, saldoAbertura);

        const premioUnit = parseFloat(op.premio || 0);
        const qtdAbs = Math.abs(parseInt(op.quantidade || 0));
        const premioTotal = premioUnit * qtdAbs;
        const isVenda = parseInt(op.quantidade || 0) < 0;

        if (existing <= 0 && premioTotal > 0) {
            saldo = isVenda ? (saldo - premioTotal) : (saldo + premioTotal);
        }
    });

    return map;
}

function getSaldoInfo(op, saldoMap) {
    const existing = parseFloat(op.saldo_abertura || 0);
    const fallback = saldoMap.get(op.id) ?? 0;
    if (existing > 0) {
        return { saldo: existing, estimado: false };
    }
    return { saldo: fallback, estimado: fallback > 0 };
}

async function persistSaldoAberturaEstimada(ops, saldoMap) {
    if (!Array.isArray(ops) || ops.length === 0) return;

    const updates = ops
        .filter(op => !op.saldo_abertura || parseFloat(op.saldo_abertura) <= 0)
        .map(op => ({
            id: op.id,
            saldo: saldoMap.get(op.id) || 0,
            op
        }))
        .filter(item => item.saldo > 0);

    for (const item of updates) {
        try {
            await fetch(`${API_BASE}/api/opcoes/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...item.op,
                    saldo_abertura: item.saldo
                })
            });
        } catch (e) {
            console.warn('Falha ao persistir saldo_abertura estimado:', e.message);
        }
    }
}

function setupAnnualDashboard(canvas) {
    const parent = canvas.parentElement;
    if (parent.classList.contains('annual-dashboard-wrapper')) return; // Already setup
    
    // Create Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'annual-dashboard-wrapper container-fluid p-0';
    
    // 1. Metrics Section
    const metricsContainer = document.createElement('div');
    metricsContainer.id = 'annualMetrics';
    metricsContainer.className = 'row row-cards mb-3';
    wrapper.appendChild(metricsContainer);
    
    // 2. Charts Container (Grid)
    const chartsContainer = document.createElement('div');
    chartsContainer.className = 'row row-cards';
    
    // Main Chart (Full Width)
    const mainChartCard = document.createElement('div');
    mainChartCard.className = 'col-12 mb-3';
    mainChartCard.innerHTML = `
        <div class="card">
            <div class="card-header"><h3 class="card-title">Resultado Mensal</h3></div>
            <div class="card-body">
                <div class="chart-container" style="position: relative; height: 300px;">
                    <!-- Canvas will be moved here -->
                </div>
            </div>
        </div>
    `;
    chartsContainer.appendChild(mainChartCard);
    
    wrapper.appendChild(chartsContainer);
    
    // Inject Wrapper before Canvas
    parent.insertBefore(wrapper, canvas);
    
    // Move Canvas into Main Card
    const newCanvasContainer = mainChartCard.querySelector('.chart-container');
    newCanvasContainer.appendChild(canvas);
}

function ensureAnnualExtraCharts() {
    const container = document.getElementById('anualExtraCharts');
    if (!container) return;
    if (container.dataset.ready === 'true') return;

    container.innerHTML = `
        <div class="col-12">
            <div class="accordion" id="accordionAnualCharts">
                <div class="accordion-item">
                    <h2 class="accordion-header" id="headingEvolution">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseEvolution" aria-expanded="false" aria-controls="collapseEvolution">
                            📊 Evolução do Resultado
                        </button>
                    </h2>
                    <div id="collapseEvolution" class="accordion-collapse collapse" aria-labelledby="headingEvolution" data-bs-parent="#accordionAnualCharts">
                        <div class="accordion-body">
                            <div class="row">
                                <div class="col-12 col-lg-6 mb-3">
                                    <div class="card">
                                        <div class="card-header">
                                            <h3 class="card-title">Resultado Mensal</h3>
                                        </div>
                                        <div class="card-body">
                                            <div class="chart-container" style="position: relative; height: 300px;">
                                                <canvas id="chartAccumulated"></canvas>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-12 col-lg-6 mb-3">
                                    <div class="card">
                                        <div class="card-header">
                                            <h3 class="card-title">Evolução do Capital Acumulado</h3>
                                        </div>
                                        <div class="card-body">
                                            <div class="chart-container" style="position: relative; height: 300px;">
                                                <canvas id="chartCapitalEvolution"></canvas>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;
    container.dataset.ready = 'true';
}

function updateAnnualMetrics(data, monthlyData) {
    const container = document.getElementById('annualMetrics');
    if (!container) return;
    
    const totalProfit = data.reduce((acc, op) => acc + (parseFloat(op.resultado)||0), 0);
    const wins = data.filter(op => (parseFloat(op.resultado)||0) > 0).length;
    const totalOps = data.length;
    const winRate = totalOps > 0 ? (wins / totalOps * 100).toFixed(1) : 0;
    
    let bestMonthVal = -Infinity;
    let worstMonthVal = Infinity;
    
    // Only consider non-zero months if possible, or just min/max
    monthlyData.forEach(v => {
        if(v > bestMonthVal) bestMonthVal = v;
        if(v < worstMonthVal) worstMonthVal = v;
    });
    // Reset if no data
    if (data.length === 0) { bestMonthVal = 0; worstMonthVal = 0; }

    container.innerHTML = `
        <div class="col-sm-6 col-lg-3">
            <div class="card card-sm">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-auto">
                            <span class="bg-primary text-white avatar">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg>
                            </span>
                        </div>
                        <div class="col">
                            <div class="font-weight-medium">Resultado Anual</div>
                            <div class="text-muted">${formatCurrency(totalProfit)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-sm-6 col-lg-3">
            <div class="card card-sm">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-auto">
                            <span class="bg-green text-white avatar">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>
                            </span>
                        </div>
                        <div class="col">
                            <div class="font-weight-medium">Taxa de Acerto</div>
                            <div class="text-muted">${winRate}% (${wins}/${totalOps})</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-sm-6 col-lg-3">
            <div class="card card-sm">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-auto">
                            <span class="bg-blue text-white avatar">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19" /><line x1="18" y1="11" x2="12" y2="5" /><line x1="6" y1="11" x2="12" y2="5" /></svg>
                            </span>
                        </div>
                        <div class="col">
                            <div class="font-weight-medium">Melhor Mês</div>
                            <div class="text-muted">${formatCurrency(bestMonthVal)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-sm-6 col-lg-3">
            <div class="card card-sm">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-auto">
                            <span class="bg-red text-white avatar">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19" /><line x1="18" y1="13" x2="12" y2="19" /><line x1="6" y1="13" x2="12" y2="19" /></svg>
                            </span>
                        </div>
                        <div class="col">
                            <div class="font-weight-medium">Pior Mês</div>
                            <div class="text-muted">${formatCurrency(worstMonthVal)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderAdditionalCharts(data, monthlyData, months, isDarkMode, textColor, gridColor) {
    // 1. Monthly Result Evolution (Line Chart) - mostra evolução mês a mês
    if (chartAccumulated) chartAccumulated.destroy();
    const ctxAcc = document.getElementById('chartAccumulated');
    
    if (ctxAcc) {
        chartAccumulated = new Chart(ctxAcc.getContext('2d'), {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Resultado Mensal',
                    data: monthlyData,
                    borderColor: '#48bb78',
                    backgroundColor: 'rgba(72, 187, 120, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'R$ ' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: { grid: { color: gridColor }, ticks: { color: textColor } },
                    x: { grid: { color: gridColor }, ticks: { color: textColor } }
                }
            }
        });
    }

    // Capital Evolution Chart - Evolução acumulada do capital
    if (chartCapitalEvolution) chartCapitalEvolution.destroy();
    const ctxCapital = document.getElementById('chartCapitalEvolution');
    
    if (ctxCapital) {
        // Calcular evolução acumulada do capital baseado no saldo inicial + resultados
        const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
        const saldoMap = computeSaldoAberturaFallback(data, parseFloat(config.saldoAcoes || 0));
        
        let capitalData = [];
        let currentCapital = 0;
        
        for (let i = 1; i <= 12; i++) {
            const monthKey = `2026-${String(i).padStart(2, '0')}`;
            const ops = data.filter(op => {
                const d = new Date(op.data_operacao || op.created_at);
                return d.getFullYear() === 2026 && (d.getMonth() + 1) === i;
            });
            
            if (ops.length > 0) {
                // Saldo inicial do mês
                const opsOrdenadas = [...ops].sort((a, b) => {
                    const da = new Date(a.data_operacao || a.created_at || 0);
                    const db = new Date(b.data_operacao || b.created_at || 0);
                    return da - db;
                });
                
                const saldoInicialMes = getSaldoInfo(opsOrdenadas[0], saldoMap).saldo;
                const resultadoMes = ops.reduce((acc, op) => acc + parseFloat(op.resultado || 0), 0);
                
                if (currentCapital === 0) {
                    currentCapital = saldoInicialMes;
                }
                currentCapital += resultadoMes;
                capitalData.push(currentCapital);
            } else {
                // Se não houver operações no mês, mantém o capital anterior
                capitalData.push(currentCapital || null);
            }
        }
        
        chartCapitalEvolution = new Chart(ctxCapital.getContext('2d'), {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Capital Acumulado',
                    data: capitalData,
                    borderColor: '#4299e1',
                    backgroundColor: 'rgba(66, 153, 225, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Capital: R$ ' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            callback: function(value) {
                                return 'R$ ' + value.toFixed(0);
                            }
                        }
                    },
                    x: { grid: { color: gridColor }, ticks: { color: textColor } }
                }
            }
        });
    }

    // 2. Asset Distribution (Doughnut)
    if (chartAssetDist) chartAssetDist.destroy();
    const ctxAsset = document.getElementById('chartAssetDist');
    
    if (ctxAsset) {
        // Group by Ativo Base
        const assetMap = {};
        data.forEach(op => {
            const ticker = op.ativo_base || op.ativo.substring(0,4); // Fallback
            if (!assetMap[ticker]) assetMap[ticker] = 0;
            assetMap[ticker] += parseFloat(op.resultado || 0);
        });
        
        const labels = Object.keys(assetMap);
        const values = Object.values(assetMap);
        // Colors palette
        const colors = ['#4299e1', '#48bb78', '#ecc94b', '#f56565', '#ed64a6', '#9f7aea', '#a0aec0'];
        
        chartAssetDist = new Chart(ctxAsset.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        position: 'right',
                        labels: { color: textColor } 
                    } 
                }
            }
        });
    }
}

// --- Simulation Module ---
let simOpcoesDisponiveis = [];
let simSelectedOption = null;
let chartSimEvolucaoInstance = null;
let chartSimLucroInstance = null;

function initSimulacaoEvents() {
    // Search Button - Usando sistema híbrido (yfinance + OpLab)
    document.getElementById('btnSimBuscar').addEventListener('click', buscarOpcoesSimulacaoHibrida);
    document.getElementById('simAtivoBase').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarOpcoesSimulacaoHibrida();
        }
    });

    // Filters - Removed simEstrategia as it's no longer used
    document.querySelectorAll('input[name="simTipoOpcao"]').forEach(el => {
        el.addEventListener('change', () => {
            // Limpar seleção ao trocar o tipo
            simSelectedOption = null;
            document.getElementById('simDetailPanel').style.display = 'none';
            document.getElementById('simEmptyState').style.display = 'flex';
            document.getElementById('btnAplicarSimulacao').disabled = true;
            renderSimOpcoesList();
        });
    });
    document.getElementById('simVencimento').addEventListener('change', renderSimOpcoesList);
    document.getElementById('simBusca').addEventListener('input', renderSimOpcoesList);
    
    // Validação da Quantidade (Múltiplo de 100, Min 100)
    const inputSimQtd = document.getElementById('simQuantidade');
    if (inputSimQtd) {
        inputSimQtd.addEventListener('change', function() {
            let val = parseInt(this.value);
            if (isNaN(val) || val < 100) val = 100;
            
            // Round to nearest 100
            if (val % 100 !== 0) {
                val = Math.round(val / 100) * 100;
                if (val < 100) val = 100;
                iziToast.warning({title: 'Atenção', message: 'Quantidade ajustada para múltiplo de 100'});
            }
            this.value = val;
            
            // Recalculate if option selected
            if (simSelectedOption) {
                 selectSimOption(simSelectedOption);
            }
        });
    }

    // Apply Button
    document.getElementById('btnAplicarSimulacao').addEventListener('click', aplicarSimulacao);
}

function openSimularModal() {
    const modalEl = document.getElementById('modalSimulacao');
    if (!modalEl) {
        console.error('Modal de simulação não encontrado');
        return;
    }
    
    // Criar instância do modal com configuração padrão do Bootstrap
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl, {
        backdrop: true,  // Permite clicar fora para fechar (comportamento padrão)
        keyboard: true   // Permite ESC para fechar
    });
    
    modal.show();
    
    // Atualizar status do mercado no modal
    updateModalMarketStatus('modalSimulacaoMarketStatus');
    
    // Foco automático no campo ativo base após o modal estar completamente aberto
    modalEl.addEventListener('shown.bs.modal', function setFocus() {
        const input = document.getElementById('simAtivoBase');
        if (input) {
            input.focus();
        }
    }, { once: true });
    
    // Reset state if needed
    if (!simSelectedOption) {
        const detailPanel = document.getElementById('simDetailPanel');
        const emptyState = document.getElementById('simEmptyState');
        if (detailPanel) detailPanel.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
    }
}

/**
 * Busca cotações usando sistema híbrido (yfinance + OpLab)
 * Ativo base: tempo real (5-10 min delay)
 * Opções: OpLab (15-20 min delay)
 */
async function buscarOpcoesSimulacaoHibrida() {
    const ativoBase = document.getElementById('simAtivoBase').value.toUpperCase();
    if (!ativoBase) {
        iziToast.warning({title: 'Atenção', message: 'Digite o código do ativo base'});
        return;
    }

    // Capturar estado para preservar contexto
    const prevSelectedAtivo = simSelectedOption ? simSelectedOption.ativo : null;
    const prevVencimento = document.getElementById('simVencimento').value;

    // Mostrar loading na tabela
    document.getElementById('simLoading').style.display = 'block';
    const tbody = document.getElementById('simListaOpcoes');
    tbody.innerHTML = '';
    document.getElementById('btnAplicarSimulacao').disabled = true;
    
    // Lista completa de elementos para loading
    const loadingElements = [
        'simOpcaoTitle', 'simOpcaoCotacao',
        'simOpcaoNome', 'simOpcaoVencimento', 'simOpcaoStrike', 'simOpcaoPremio',
        'simOpcaoDias', 'simOpcaoDistancia', 'simOpcaoNotional',
        'simOpcaoSaldo', 'simOpcaoMargem', 'simLucroTotal'
    ];
    
    // Mostrar loading no cabeçalho principal (ativo base e cotação)
    const mainTitle = document.querySelector('#modalSimulacao .modal-title');
    if (mainTitle) {
        const originalTitle = mainTitle.innerHTML;
        mainTitle.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Atualizando...';
        mainTitle.dataset.originalContent = originalTitle;
    }
    
    // Mostrar loading nos valores do painel de detalhes se estiver visível
    const detailPanel = document.getElementById('simDetailPanel');
    if (detailPanel && detailPanel.style.display !== 'none') {
        showMultipleElementsLoading(loadingElements, true);
    }

    try {
        console.log(`🔄 Buscando dados híbridos para ${ativoBase}...`);
        
        // Usar endpoint híbrido
        const response = await fetch(`${API_BASE}/api/cotacao/hibrido/${ativoBase}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Atualizar cotação ativo base (TEMPO REAL - 5-10 min)
        cotacaoAtivoBase = data.spot_price;
        
        // Log de informações
        console.log('📊 Dados híbridos carregados:');
        console.log(`   Ativo Base: R$ ${data.spot_price?.toFixed(2)} (${data.spot_source})`);
        console.log(`   Variação: ${data.spot_change >= 0 ? '+' : ''}${data.spot_change?.toFixed(2)} (${data.spot_change_percent?.toFixed(2)}%)`);
        console.log(`   Cache: ${data.spot_from_cache ? 'Sim' : 'Não'}`);
        console.log(`   Opções: ${data.total_opcoes} opções (${data.opcoes_source})`);
        
        // Mostrar toast com info
        // iziToast.success({
        //     title: '✅ Dados Híbridos',
        //     message: `Spot: R$ ${data.spot_price?.toFixed(2)} (${data.spot_change >= 0 ? '+' : ''}${data.spot_change_percent?.toFixed(2)}%) | ${data.total_opcoes} opções`,
        //     timeout: 4000,
        //     position: 'topRight'
        // });
        
        // Processar opções (compatível com estrutura antiga)
        simOpcoesDisponiveis = data.opcoes || data.options || [];
        
        if (simOpcoesDisponiveis.length === 0) {
            document.getElementById('simLoading').style.display = 'none';
            iziToast.warning({
                title: 'Sem Dados',
                message: `Nenhuma opção encontrada para ${ativoBase}`
            });
            return;
        }

        // Normalizar dados
        simOpcoesDisponiveis = simOpcoesDisponiveis.map(op => ({
            ...op,
            ativo: op.ativo || op.symbol || op.ticker || '',
            ativo_base: op.ativo_base || op.underlying || ativoBase,
            tipo: op.tipo || op.type || op.category || '',
            strike: parseFloat(op.strike || op.strike_price || 0),
            vencimento: op.vencimento || op.expiration || op.due_date || '',
            premio: parseFloat(op.premio || op.price || op.close || 0),
            // Usar spot_price_realtime se disponível (híbrido)
            spot_price: op.spot_price_realtime || cotacaoAtivoBase,
            delta: parseFloat(op.delta || (op.greeks && op.greeks.delta) || 0),
            theta: parseFloat(op.theta || (op.greeks && op.greeks.theta) || 0),
            gamma: parseFloat(op.gamma || (op.greeks && op.greeks.gamma) || 0),
            vega: parseFloat(op.vega || (op.greeks && op.greeks.vega) || 0),
            implied_volatility: parseFloat(op.implied_volatility || (op.greeks && op.greeks.implied_volatility) || 0)
        }));

        // Popular vencimentos
        const vencimentos = [...new Set(simOpcoesDisponiveis
            .filter(o => o.vencimento)
            .map(o => o.vencimento))].sort();
            
        const selectVencimento = document.getElementById('simVencimento');
        selectVencimento.innerHTML = '';
        
        const today = new Date().toISOString().split('T')[0];
        let nextVenc = vencimentos.find(v => v >= today);
        
        if (!nextVenc && vencimentos.length > 0) nextVenc = vencimentos[0];
        
        // Restaurar vencimento anterior se válido
        if (prevVencimento && vencimentos.includes(prevVencimento)) {
            nextVenc = prevVencimento;
        }

        if (vencimentos.length > 0) {
            vencimentos.forEach(venc => {
                const opt = document.createElement('option');
                opt.value = venc;
                opt.textContent = formatDate(venc);
                if (venc === nextVenc) opt.selected = true;
                selectVencimento.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Sem vencimentos';
            selectVencimento.appendChild(opt);
        }
        
        // Renderizar lista com filtros padrão
        renderSimOpcoesList();

        // Restaurar seleção anterior
        let restored = false;
        if (prevSelectedAtivo) {
            const prevOp = simOpcoesDisponiveis.find(o => o.ativo === prevSelectedAtivo);
            if (prevOp) {
                selectSimOption(prevOp);
                restored = true;
            }
        }
        
        if (!restored) {
            document.getElementById('simDetailPanel').style.display = 'none';
            document.getElementById('simEmptyState').style.display = 'flex';
        }
        
        // Atualizar timestamp
        const updateTime = new Date().toLocaleTimeString('pt-BR');
        console.log(`✅ Dados atualizados às ${updateTime}`);

    } catch (e) {
        console.error('❌ Erro ao buscar dados híbridos:', e);
        iziToast.error({
            title: 'Erro',
            message: `Erro ao buscar cotações: ${e.message}. Tentando fallback...`,
            timeout: 6000
        });
        
        // Fallback: usar método antigo (apenas OpLab)
        console.log('🔄 Usando fallback para OpLab apenas...');
        buscarOpcoesSimulacao();
        
    } finally {
        document.getElementById('simLoading').style.display = 'none';
        
        // Remover loading de todos os elementos
        const loadingElements = [
            'simOpcaoTitle', 'simOpcaoCotacao',
            'simOpcaoNome', 'simOpcaoVencimento', 'simOpcaoStrike', 'simOpcaoPremio',
            'simOpcaoDias', 'simOpcaoDistancia', 'simOpcaoNotional',
            'simOpcaoSaldo', 'simOpcaoMargem', 'simLucroTotal'
        ];
        showMultipleElementsLoading(loadingElements, false);
        
        // Restaurar título principal
        const mainTitle = document.querySelector('#modalSimulacao .modal-title');
        if (mainTitle && mainTitle.dataset.originalContent) {
            mainTitle.innerHTML = mainTitle.dataset.originalContent;
            delete mainTitle.dataset.originalContent;
        }
    }
}

async function buscarOpcoesSimulacao() {
    const ativoBase = document.getElementById('simAtivoBase').value.toUpperCase();
    if (!ativoBase) {
        iziToast.warning({title: 'Atenção', message: 'Digite o código do ativo base'});
        return;
    }

    // Capture state to preserve context
    const prevSelectedAtivo = simSelectedOption ? simSelectedOption.ativo : null;
    const prevVencimento = document.getElementById('simVencimento').value;

    document.getElementById('simLoading').style.display = 'block';
    const tbody = document.getElementById('simListaOpcoes');
    tbody.innerHTML = '';
    
    // Disable action button until data is refreshed
    document.getElementById('btnAplicarSimulacao').disabled = true;

    try {
        // Try multiple endpoints to find the correct one
        let data = null;
        // Common patterns for option chain APIs
        const endpoints = [
            `${API_BASE}/api/proxy/options/${ativoBase}`, // Correct Endpoint found in server.py
            `${API_BASE}/api/market/opcoes/${ativoBase}`,
            `${API_BASE}/api/opcoes/market/${ativoBase}`,
            `${API_BASE}/api/cotacao/opcoes/${ativoBase}`
        ];

        let lastError = null;
        for (const url of endpoints) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    data = await res.json();
                    console.log(`Successfully fetched options from ${url}`);
                    break;
                } else if (res.status !== 404) {
                    // If it's not 404, it might be a server error, so we log it
                    console.warn(`Endpoint ${url} returned ${res.status}`);
                }
            } catch (e) { 
                console.log(`Failed to fetch ${url}`, e); 
                lastError = e;
            }
        }

        if (!data) {
             // Fallback: Check if we can get it from the generic operations list (unlikely but worth a try if it's a mock)
             // or throw error
             throw new Error('Não foi possível buscar os dados de opções. Verifique se o backend está rodando e a rota existe.');
        }
        
        simOpcoesDisponiveis = data.opcoes || data.options || data || [];
        
        if (!Array.isArray(simOpcoesDisponiveis)) {
             // Handle case where data might be nested differently
             if (data.results) simOpcoesDisponiveis = data.results;
             else simOpcoesDisponiveis = [];
        }

        // Normalização de dados para garantir campos essenciais
        simOpcoesDisponiveis = simOpcoesDisponiveis.map(op => ({
            ...op,
            ativo: op.ativo || op.symbol || op.ticker || '',
            ativo_base: op.ativo_base || op.underlying || ativoBase,
            tipo: op.tipo || op.type || op.category || '',
            strike: parseFloat(op.strike || op.strike_price || 0),
            vencimento: op.vencimento || op.expiration || op.due_date || '',
            premio: parseFloat(op.premio || op.price || op.close || 0),
            delta: parseFloat(op.delta || (op.greeks && op.greeks.delta) || 0),
            theta: parseFloat(op.theta || (op.greeks && op.greeks.theta) || 0),
            gamma: parseFloat(op.gamma || (op.greeks && op.greeks.gamma) || 0),
            vega: parseFloat(op.vega || (op.greeks && op.greeks.vega) || 0),
            implied_volatility: parseFloat(op.implied_volatility || (op.greeks && op.greeks.implied_volatility) || 0)
        }));

        // Tentar obter cotação do payload
        if (data.spot_price) cotacaoAtivoBase = parseFloat(data.spot_price);
        else if (data.price) cotacaoAtivoBase = parseFloat(data.price);
        else if (data.cotacao) cotacaoAtivoBase = parseFloat(data.cotacao);
        
        // Fallback da lista
        if (!cotacaoAtivoBase && simOpcoesDisponiveis.length > 0) {
            if (simOpcoesDisponiveis[0].preco_ativo_base) cotacaoAtivoBase = parseFloat(simOpcoesDisponiveis[0].preco_ativo_base);
            else if (simOpcoesDisponiveis[0].underlying_price) cotacaoAtivoBase = parseFloat(simOpcoesDisponiveis[0].underlying_price);
        }

        // NÃO atualizar Título com cotação (já tem badge de mercado)

        if (simOpcoesDisponiveis.length === 0) {
            iziToast.info({title: 'Info', message: 'Nenhuma opção encontrada para este ativo'});
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma opção encontrada</td></tr>';
            
            // Reset state
            simSelectedOption = null;
            document.getElementById('simDetailPanel').style.display = 'none';
            document.getElementById('simEmptyState').style.display = 'flex';
            return;
        }

        // Populate Vencimentos
        // Ensure vencimento is YYYY-MM-DD
        const vencimentos = [...new Set(simOpcoesDisponiveis
            .filter(o => o.vencimento)
            .map(o => o.vencimento))].sort();
            
        const selectVencimento = document.getElementById('simVencimento');
        selectVencimento.innerHTML = '';
        
        // Find nearest expiration (first one that is >= today)
        const today = new Date().toISOString().split('T')[0];
        let nextVenc = vencimentos.find(v => v >= today);
        
        // If no future expiration, take the last one available (or first)
        if (!nextVenc && vencimentos.length > 0) nextVenc = vencimentos[vencimentos.length - 1];
        
        // Restore previous expiration if valid
        if (prevVencimento && vencimentos.includes(prevVencimento)) {
            nextVenc = prevVencimento;
        }

        if (vencimentos.length > 0) {
            vencimentos.forEach(v => {
                const option = document.createElement('option');
                option.value = v;
                option.textContent = formatDate(v);
                if (v === nextVenc) option.selected = true;
                selectVencimento.appendChild(option);
            });
        } else {
             const option = document.createElement('option');
             option.textContent = "Sem vencimentos";
             selectVencimento.appendChild(option);
        }
        
        // Render list with default filters
        renderSimOpcoesList();

        // Restore Selection
        let restored = false;
        if (prevSelectedAtivo) {
            const found = simOpcoesDisponiveis.find(o => o.ativo === prevSelectedAtivo);
            if (found) {
                selectSimOption(found);
                restored = true;
            }
        }
        
        if (!restored) {
             // Reset UI if selection lost
            simSelectedOption = null;
            document.getElementById('simDetailPanel').style.display = 'none';
            document.getElementById('simEmptyState').style.display = 'flex';
        }
        
        // Atualizar timestamp
        const now = new Date();
        const timestamp = `${now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
        const timestampEl = document.getElementById('simUltimaAtualizacao');
        if (timestampEl) {
            timestampEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Atualizado: ${timestamp}`;
        }

    } catch (e) {
        console.error(e);
        iziToast.error({title: 'Erro', message: 'Erro ao buscar opções: ' + e.message});
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Erro ao carregar: ${e.message}</td></tr>`;
        
        // Reset state on error
        simSelectedOption = null;
        document.getElementById('simDetailPanel').style.display = 'none';
        document.getElementById('simEmptyState').style.display = 'flex';
    } finally {
        document.getElementById('simLoading').style.display = 'none';
    }
}

function renderSimOpcoesList() {
    const tipo = document.querySelector('input[name="simTipoOpcao"]:checked').value;
    const vencimento = document.getElementById('simVencimento').value;
    const busca = document.getElementById('simBusca').value.toUpperCase();
    
    // First get all options for this Type and Expiration
    let baseFiltered = simOpcoesDisponiveis.filter(op => 
        op.tipo === tipo && 
        op.vencimento === vencimento
    );
    
    // Sort by strike
    baseFiltered.sort((a, b) => parseFloatSafe(a.strike) - parseFloatSafe(b.strike));

    // Calculate Global ATM Strikes for this set (Absolute ATM)
    let atmStrikes = [];
    // Validação: Usar cotacaoAtivoBase global ou tentar obter da primeira opção
    let spotPrice = cotacaoAtivoBase;
    if (!spotPrice && baseFiltered.length > 0) {
        spotPrice = parseFloat(baseFiltered[0].preco_ativo_base || baseFiltered[0].underlying_price || 0);
    }
    
    if (spotPrice && spotPrice > 0 && baseFiltered.length > 0) {
        let closestIndex = -1;
        let minDiff = Infinity;
        baseFiltered.forEach((op, i) => {
            const diff = Math.abs(parseFloatSafe(op.strike) - spotPrice);
            if (diff < minDiff) { minDiff = diff; closestIndex = i; }
        });
        
        if (closestIndex !== -1) {
             const s2 = parseFloatSafe(baseFiltered[closestIndex].strike);
             atmStrikes.push(s2);
             if (closestIndex > 0) atmStrikes.push(parseFloatSafe(baseFiltered[closestIndex-1].strike));
             if (closestIndex < baseFiltered.length - 1) atmStrikes.push(parseFloatSafe(baseFiltered[closestIndex+1].strike));
        }
    }

    // Now apply Search Filter and Row Limit
    let finalFiltered = baseFiltered;
    
    if (busca) {
        finalFiltered = baseFiltered.filter(op => 
            op.ativo.includes(busca) || (op.ativo_base && op.ativo_base.includes(busca))
        );
    } else {
        // If no search, limit rows around ATM (if exists) or just show all
        // The user wants to reduce height.
        if (cotacaoAtivoBase && baseFiltered.length > 20) {
             let closestIndex = -1;
             let minDiff = Infinity;
             baseFiltered.forEach((op, i) => {
                 const diff = Math.abs(parseFloatSafe(op.strike) - cotacaoAtivoBase);
                 if (diff < minDiff) { minDiff = diff; closestIndex = i; }
             });
             
             if (closestIndex !== -1) {
                 const start = Math.max(0, closestIndex - 10);
                 const end = Math.min(baseFiltered.length, closestIndex + 11);
                 finalFiltered = baseFiltered.slice(start, end);
             }
        }
    }

    const tbody = document.getElementById('simListaOpcoes');
    tbody.innerHTML = '';

    if (finalFiltered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma opção encontrada</td></tr>';
        return;
    }

    finalFiltered.forEach(op => {
        const strikeVal = parseFloatSafe(op.strike);
        // Normalize for comparison
        const isATM = atmStrikes.some(atm => Math.abs(atm - strikeVal) < 0.001);
        
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer'; // Ensure pointer cursor
        tr.onclick = () => selectSimOption(op);
        
        if (isATM) {
            tr.classList.add('sim-row-highlight');
            tr.id = 'simAtmRow'; // Mark for scrolling
        }

        // Calculate Greeks if missing
        let deltaVal = parseFloat(op.delta || (op.greeks && op.greeks.delta) || 0);
        let ivVal = parseFloat(op.implied_volatility || (op.greeks && op.greeks.implied_volatility) || 0);
        
        // If Delta is 0 and we have price, try to calculate
        if (Math.abs(deltaVal) < 0.001 && cotacaoAtivoBase > 0 && op.premio > 0) {
            const dias = calcularDias(op.vencimento);
            // Use Business Days for Consistency
            const T = Math.max(dias.uteis / 252.0, 0.0001);
            const r = 0.1075; // Risk-free rate (approx Selic)
            
            // Calculate IV first
            const iv = calculateIV(op.premio, cotacaoAtivoBase, strikeVal, T, r, op.tipo);
            const greeks = calculateGreeks(cotacaoAtivoBase, strikeVal, T, r, iv, op.tipo);
            
            deltaVal = greeks.delta;
            ivVal = iv;
            // Update op object for details view
            op.calculatedGreeks = greeks;
        }
        
        // ============= CALCULAR PoP (Probability of Profit) =============
        let popPercent = '-';
        
        if (cotacaoAtivoBase > 0 && strikeVal > 0 && op.premio > 0) {
            const dias = calcularDias(op.vencimento);
            // Use Business Days for Black-Scholes (Professional Standard)
            const T = Math.max(dias.uteis / 252.0, 0.0001);
            const r = 0.1075;
            const premio = parseFloatSafe(op.premio);
            
            // Pegar a posição selecionada (Compra ou Venda)
            const posicao = document.querySelector('input[name="simPosicao"]:checked')?.value || 'VENDA';
            const isVenda = posicao === 'VENDA';
            
            // Calcular breakeven
            let breakeven = 0;
            if (isVenda) {
                if (op.tipo === 'PUT') breakeven = strikeVal - premio;
                else breakeven = strikeVal + premio;
            } else {
                if (op.tipo === 'CALL') breakeven = strikeVal + premio;
                else breakeven = strikeVal - premio;
            }
            
            const sigma = ivVal || 0.3;
            let pop = 0;
            
            if (breakeven <= 0.001 || cotacaoAtivoBase <= 0.001) {
                if (!isVenda && op.tipo === 'PUT') pop = 0;
                else if (isVenda && op.tipo === 'PUT') pop = 1;
                else pop = 0;
            } else if (T <= 0.001) {
                if (op.tipo === 'CALL') pop = (cotacaoAtivoBase > breakeven) ? 1 : 0;
                else pop = (cotacaoAtivoBase < breakeven) ? 1 : 0;
            } else {
                const d1_be = (Math.log(cotacaoAtivoBase / breakeven) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
                const d2_be = d1_be - sigma * Math.sqrt(T);
                
                if (!isNaN(d1_be) && !isNaN(d2_be)) {
                    if (op.tipo === 'CALL') {
                        pop = isVenda ? cdf(-d2_be) : cdf(d2_be);
                    } else {
                        pop = isVenda ? cdf(d2_be) : cdf(-d2_be);
                    }
                } else {
                    pop = (op.tipo === 'CALL') ? ((cotacaoAtivoBase > breakeven) ? 0.7 : 0.3) : ((cotacaoAtivoBase < breakeven) ? 0.7 : 0.3);
                }
            }
            
            if (isNaN(pop) || pop < 0) pop = 0;
            if (pop > 1) pop = 1;
            
            popPercent = `${(pop * 100).toFixed(1)}%`;
        }

        tr.innerHTML = `
            <td>${op.ativo}</td>
            <td>${strikeVal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
            <td>${parseFloat(op.premio || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
            <td>
                ${deltaVal.toFixed(2)}
                <span style="cursor: pointer; margin-left: 5px;" onclick="event.stopPropagation(); mostrarDetalhesOpcao('${op.ativo}')">📋</span>
            </td>
            <td>${popPercent}</td>
        `;
        tbody.appendChild(tr);
    });

    // Auto-scroll to ATM
    const atmRow = document.getElementById('simAtmRow');
    if (atmRow) {
        setTimeout(() => {
            atmRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}

// --- Funções Black-Scholes removidas (agora estão em global.js) ---
// cdf(), pdf(), bsPrice(), calculateIV(), calculateGreeks()

function selectSimOption(op) {
    simSelectedOption = op;
    const qtd = parseInt(document.getElementById('simQuantidade').value);
    
    // Show Panel
    document.getElementById('simEmptyState').style.display = 'none';
    const detailPanel = document.getElementById('simDetailPanel');
    detailPanel.style.display = 'flex';
    
    // Populate Info - Header (Image 1)
    // User requested Base Asset Name and Quote here
    const ativoBaseName = op.ativo_base || document.getElementById('simAtivoBase').value.toUpperCase();
    document.getElementById('simOpcaoTitle').textContent = ativoBaseName; 
    
    if (cotacaoAtivoBase) {
         document.getElementById('simOpcaoCotacao').textContent = cotacaoAtivoBase.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    } else {
         document.getElementById('simOpcaoCotacao').textContent = 'R$ 0,00';
    }

    // Populate Info - Details Card
    document.getElementById('simOpcaoNome').textContent = op.ativo;
    document.getElementById('simOpcaoVencimento').textContent = formatDate(op.vencimento);
    document.getElementById('simOpcaoStrike').textContent = formatCurrency(parseFloatSafe(op.strike));
    document.getElementById('simOpcaoPremio').textContent = formatCurrency(Math.abs(parseFloatSafe(op.premio)));
    
    const dias = calcularDias(op.vencimento);
    document.getElementById('simOpcaoDias').textContent = `${dias.corridos}/${dias.uteis}`;
    
    // Calculate Distance %
    let distText = '-';
    let distClass = '';
    if (cotacaoAtivoBase && cotacaoAtivoBase > 0) {
        const strike = parseFloatSafe(op.strike);
        const pct = ((strike / cotacaoAtivoBase) - 1) * 100;
        const sign = pct >= 0 ? '+' : '';
        distText = `${sign}${pct.toFixed(2)}%`;
        if (pct > 0) distClass = 'text-success';
        else if (pct < 0) distClass = 'text-danger';
    }
    const distEl = document.getElementById('simOpcaoDistancia');
    if (distEl) {
        distEl.textContent = distText;
        distEl.className = 'fw-bold ' + distClass;
    }

    // Calculate Notional (Strike * Qtd)
    const strikeVal = parseFloat(op.strike || 0);
    const notional = strikeVal * qtd;
    
    // Get Balance from Config
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoCorretora = parseFloat(config.saldoAcoes || 0);
    
    const notionalEl = document.getElementById('simOpcaoNotional');
    if (notionalEl) {
        notionalEl.textContent = notional.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        
        // Color Logic: Red if Notional > Saldo, Green if <= Saldo
        if (notional > saldoCorretora) {
            notionalEl.className = 'fw-bold text-danger';
            notionalEl.setAttribute('title', `Excede o saldo de ${saldoCorretora.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
        } else {
            notionalEl.className = 'fw-bold text-success';
            notionalEl.setAttribute('title', 'Dentro do limite do saldo');
        }
    }
    
    // Preencher Saldo Corretora
    const saldoEl = document.getElementById('simOpcaoSaldo');
    if (saldoEl) {
        saldoEl.textContent = saldoCorretora.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    }
    
    // Calcular e preencher Margem (Saldo - Notional)
    const margem = saldoCorretora - notional;
    const margemEl = document.getElementById('simOpcaoMargem');
    if (margemEl) {
        margemEl.textContent = margem.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        
        // Color Logic: Green if positive, Red if negative
        if (margem >= 0) {
            margemEl.className = 'fw-bold text-success';
            margemEl.setAttribute('title', 'Margem disponível positiva');
        } else {
            margemEl.className = 'fw-bold text-danger';
            margemEl.setAttribute('title', 'Margem insuficiente - operação requer mais capital');
        }
    }

    const lucroTotal = parseFloat(op.premio || 0) * qtd;
    // document.getElementById('simOpcaoLucro').textContent = formatCurrency(lucroTotal);
    document.getElementById('simLucroTotal').textContent = `Ganho Total: ${formatCurrency(lucroTotal)}`;

    // Update Charts
    updateSimCharts(op, qtd);
    
    // Enable Apply Button
    document.getElementById('btnAplicarSimulacao').disabled = false;
}

function updateSimCharts(op, qtd) {
    // Destroy previous charts if exist
    if (chartSimEvolucaoInstance) chartSimEvolucaoInstance.destroy();
    if (chartSimLucroInstance) chartSimLucroInstance.destroy();

    const premio = parseFloat(op.premio || 0);
    const strike = parseFloat(op.strike || 0);
    const precoAtual = parseFloat(op.preco_atual || strike); // Fallback
    
    // Verificar se é COMPRA ou VENDA
    const isPosicaoVenda = document.getElementById('simPosicaoVenda')?.checked || false;
    
    // Calcular P&L corretamente baseado na posição
    let investido, lucro, percentual;
    
    if (isPosicaoVenda) {
        // VENDA (SHORT): Capital em risco é o Notional (Strike × Quantidade)
        // P&L % = Prêmio Recebido / Notional
        investido = strike * qtd; // Notional
        lucro = premio * qtd; // Prêmio recebido
        percentual = investido > 0 ? (lucro / investido) * 100 : 0;
    } else {
        // COMPRA (LONG): Capital investido é o Prêmio pago
        // P&L % = Prêmio / Prêmio (retorno potencial no vencimento se ITM)
        investido = premio * qtd; // Capital investido
        lucro = premio * qtd; // Para simplificar visualização inicial
        percentual = investido > 0 ? (lucro / investido) * 100 : 0;
    }
    
    document.getElementById('simEvolucaoLabel').textContent = `${percentual.toFixed(1)}%`;
    document.getElementById('simEvolucaoText').textContent = `Crescimento +${percentual.toFixed(1)}%`;

    // Check theme
    const isDarkMode = document.body.getAttribute('data-bs-theme') === 'dark';
    const textColor = isDarkMode ? '#f8f9fa' : '#666666';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';

    // Chart Evolução (Donut)
    const ctxEvolucao = document.getElementById('chartSimEvolucao').getContext('2d');
    chartSimEvolucaoInstance = new Chart(ctxEvolucao, {
        type: 'doughnut',
        data: {
            labels: ['Ganho', 'Investido'],
            datasets: [{
                data: [lucro, investido],
                backgroundColor: ['#4299e1', '#e2e8f0'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            cutout: '70%',
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            maintainAspectRatio: false
        }
    });

    // Chart Lucro (Bar)
    const ctxLucro = document.getElementById('chartSimLucro').getContext('2d');
    chartSimLucroInstance = new Chart(ctxLucro, {
        type: 'bar',
        data: {
            labels: ['Lucro', 'Investido'],
            datasets: [{
                label: 'Valor',
                data: [lucro, investido],
                backgroundColor: ['#a0aec0', '#48bb78'],
                borderRadius: 4,
                barPercentage: 0.5
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    beginAtZero: true, 
                    grid: { display: false }, 
                    ticks: { color: textColor }
                }, 
                x: { 
                    grid: { display: false },
                    ticks: { color: textColor }
                } 
            },
            maintainAspectRatio: false
        }
    });
}

async function analyzeSimWithAI(forceRefresh = false) {
    if (!simSelectedOption) {
        iziToast.warning({title: 'Atenção', message: 'Selecione uma opção primeiro.'});
        return;
    }

    const op = simSelectedOption;
    const qtd = parseInt(document.getElementById('simQuantidade').value) || 100;
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldo = parseFloat(config.saldoAcoes || 0);
    
    // Capturar intenção (Compra vs Venda)
    const posicao = document.querySelector('input[name="simPosicao"]:checked')?.value || 'COMPRA';
    const isVenda = posicao === 'VENDA';

    // Parâmetros atuais para verificação de cache
    const currentParams = {
        ativo: op.ativo,
        strike: op.strike,
        premio: op.premio,
        qtd: qtd,
        posicao: posicao,
        vencimento: op.vencimento
    };

    // Verificar cache (apenas se não for refresh forçado e parâmetros forem iguais)
    if (!forceRefresh && lastSimParams && JSON.stringify(lastSimParams) === JSON.stringify(currentParams) && lastSimResult) {
        showAiResult(lastSimResult, lastSimAgent, lastSimModel);
        return;
    }

    // Se for refresh ou novos parâmetros, resetar histórico
    if (forceRefresh || !lastSimParams || JSON.stringify(lastSimParams) !== JSON.stringify(currentParams)) {
        currentChatHistory = [];
    }

    // Dados calculados
    const dias = calcularDias(op.vencimento);
    const diasRestantes = dias.corridos;
    const diasUteis = dias.uteis;
    
    // Calcular Financeiro e Risco
    const valorTotal = parseFloat(op.premio) * qtd;
    const financeiroLabel = isVenda ? "Crédito Estimado (Receber)" : "Custo Estimado (Pagar)";
    
    let riscoTexto = "";
    if (isVenda) {
        if (op.tipo === 'PUT') {
            riscoTexto = `Risco de Assunção (Obrigação de comprar o ativo). Notional: R$ ${formatCurrency(parseFloat(op.strike) * qtd)}`;
        } else {
            riscoTexto = `Risco de Chamada de Margem / Ilimitado (Call descoberta) ou Entrega do Ativo (Call Coberta).`;
        }
    } else {
        riscoTexto = `Risco Limitado ao valor pago (R$ ${formatCurrency(valorTotal)}).`;
    }

    const percSaldo = saldo > 0 ? (valorTotal / saldo) * 100 : 0;

    // ============= CALCULAR OU OBTER GREGAS PRIMEIRO =============
    let gregas = {};
    const T_calc = Math.max(diasUteis / 252.0, 0.0001);
    const r_calc = 0.1075;
    
    // Verificar se já temos gregas calculadas (do renderSimOpcoesList)
    if (op.calculatedGreeks) {
        gregas = op.calculatedGreeks;
    } else {
        // Calcular agora
        const strikeValue_temp = parseFloat(op.strike);
        if (cotacaoAtivoBase > 0 && strikeValue_temp > 0 && T_calc > 0 && parseFloat(op.premio) > 0) {
            const iv = calculateIV(parseFloat(op.premio), cotacaoAtivoBase, strikeValue_temp, T_calc, r_calc, op.tipo);
            gregas = calculateGreeks(cotacaoAtivoBase, strikeValue_temp, T_calc, r_calc, iv, op.tipo);
        } else {
            // Fallback to what we have from API
            gregas = {
                delta: parseFloat(op.delta || 0),
                gamma: parseFloat(op.gamma || 0),
                theta: parseFloat(op.theta || 0),
                vega: parseFloat(op.vega || 0),
                implied_volatility: parseFloat(op.implied_volatility || 0)
            };
        }
    }

    // ============= DADOS DETALHADOS (Do modal de detalhes 📋) =============
    const strikeValue = parseFloat(op.strike);
    const spotValue = cotacaoAtivoBase || strikeValue;
    const notional = strikeValue * qtd;
    const margemDisponivel = saldo - notional;
    const utilizacaoPercent = saldo > 0 ? (notional / saldo * 100) : 0;
    
    // Calcular resultado simulado (PnL)
    const unitEntry = parseFloat(op.premio);
    const unitCurrent = parseFloat(op.premio); // Na simulação usamos o prêmio atual
    let pnlSimulado = 0;
    let costBasis = unitEntry * qtd;
    
    if (isVenda) {
        // Short: Profit if Current < Entry
        const currentValueToClose = unitCurrent * qtd;
        pnlSimulado = costBasis - currentValueToClose;
    } else {
        // Long: Profit if Current > Entry
        const currentValue = unitCurrent * qtd;
        pnlSimulado = currentValue - costBasis;
    }
    
    const pnlPercent = costBasis !== 0 ? (pnlSimulado / costBasis) * 100 : 0;
    
    // Calcular breakeven
    let breakeven = 0;
    if (isVenda) {
        if (op.tipo === 'PUT') breakeven = strikeValue - parseFloat(op.premio);
        else breakeven = strikeValue + parseFloat(op.premio);
    } else {
        if (op.tipo === 'CALL') breakeven = strikeValue + parseFloat(op.premio);
        else breakeven = strikeValue - parseFloat(op.premio);
    }
    
    // Calcular distância do strike
    const distStrike = ((spotValue - strikeValue) / strikeValue) * 100;
    
    // Calcular PoP (Probability of Profit)
    const T = Math.max(diasUteis / 252.0, 0.0001);
    const r = 0.1075;
    let pop = 0;
    
    if (spotValue > 0 && strikeValue > 0 && T > 0) {
        const sigma = gregas.implied_volatility || 0.3;
        
        if (breakeven <= 0.001 || spotValue <= 0.001) {
            if (!isVenda && op.tipo === 'PUT') pop = 0;
            else if (isVenda && op.tipo === 'PUT') pop = 1;
            else pop = 0;
        } else if (T <= 0.001) {
            if (op.tipo === 'CALL') pop = (spotValue > breakeven) ? 1 : 0;
            else pop = (spotValue < breakeven) ? 1 : 0;
        } else {
            const d1_be = (Math.log(spotValue / breakeven) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
            const d2_be = d1_be - sigma * Math.sqrt(T);
            
            if (!isNaN(d1_be) && !isNaN(d2_be)) {
                if (op.tipo === 'CALL') {
                    pop = isVenda ? cdf(-d2_be) : cdf(d2_be);
                } else {
                    pop = isVenda ? cdf(d2_be) : cdf(-d2_be);
                }
            } else {
                pop = (op.tipo === 'CALL') ? ((spotValue > breakeven) ? 0.7 : 0.3) : ((spotValue < breakeven) ? 0.7 : 0.3);
            }
        }
    }
    
    if (isNaN(pop) || pop < 0) pop = 0;
    if (pop > 1) pop = 1;

    // Buscar opções comparativas
    let comparativos = [];
    let comparativosExtras = [];

    if (typeof simOpcoesDisponiveis !== 'undefined') {
        // 1. Mesmo Vencimento, Strikes Próximos (Top 5)
        comparativos = simOpcoesDisponiveis
            .filter(o => o.vencimento === op.vencimento && o.tipo === op.tipo && o.ativo !== op.ativo)
            .sort((a, b) => Math.abs(parseFloat(a.strike) - parseFloat(op.strike)))
            .slice(0, 5) 
            .map(o => `- [MESMO VENC] ${o.ativo}: Strike ${formatCurrency(parseFloat(o.strike))}, Prêmio ${formatCurrency(parseFloat(o.premio))}, Delta ${parseFloat(o.delta||0).toFixed(2)}`);

        // 2. Se vencimento for curto (< 5 dias), buscar próximo vencimento (Rolagem/Alternativa)
        if (diasRestantes < 5) {
            const allVencimentos = [...new Set(simOpcoesDisponiveis.map(o => o.vencimento))].sort();
            const currentIdx = allVencimentos.indexOf(op.vencimento);
            
            if (currentIdx !== -1 && currentIdx < allVencimentos.length - 1) {
                const nextVenc = allVencimentos[currentIdx + 1];
                comparativosExtras = simOpcoesDisponiveis
                    .filter(o => o.vencimento === nextVenc && o.tipo === op.tipo)
                    .sort((a, b) => Math.abs(parseFloat(a.strike) - parseFloat(op.strike))) // Perto do strike original
                    .slice(0, 3)
                    .map(o => {
                        const d = calcularDias(o.vencimento).corridos;
                        return `- [PROX VENC ${formatDate(nextVenc)} (${d} dias)] ${o.ativo}: Strike ${formatCurrency(parseFloat(o.strike))}, Prêmio ${formatCurrency(parseFloat(o.premio))}`;
                    });
            }
        }
    }

    const listaOpcoes = [...comparativos, ...comparativosExtras].join('\n');

    // Calcular cenários de exercício
    // strikeValue, spotValue, notional já declarados acima
    const premioTotal = parseFloat(op.premio) * qtd;
    
    // Cenário 1: SE FOR EXERCIDO
    let cenarioExercido = {};
    if (isVenda) {
        if (op.tipo === 'PUT') {
            // Vendi PUT e fui exercido = Comprei ações no strike
            cenarioExercido.acao = `Compra obrigatória de ${qtd} ações a ${formatCurrency(strikeValue)}`;
            cenarioExercido.capital_necessario = notional;
            cenarioExercido.valor_acoes = spotValue * qtd;
            cenarioExercido.resultado_opcao = premioTotal; // Prêmio recebido
            cenarioExercido.resultado_total = premioTotal + (cenarioExercido.valor_acoes - notional);
            cenarioExercido.margem_usada = notional - saldo;
        } else {
            // Vendi CALL e fui exercido = Vendi ações no strike
            cenarioExercido.acao = `Venda obrigatória de ${qtd} ações a ${formatCurrency(strikeValue)}`;
            cenarioExercido.capital_recebido = notional;
            cenarioExercido.resultado_opcao = premioTotal;
            cenarioExercido.resultado_total = premioTotal; // Assumindo que já tinha as ações
        }
    } else {
        if (op.tipo === 'CALL') {
            // Comprei CALL e exerci = Comprei ações no strike
            cenarioExercido.acao = `Compra de ${qtd} ações a ${formatCurrency(strikeValue)}`;
            cenarioExercido.capital_necessario = notional;
            cenarioExercido.custo_total = notional + premioTotal;
            cenarioExercido.valor_acoes = spotValue * qtd;
            cenarioExercido.resultado_total = cenarioExercido.valor_acoes - cenarioExercido.custo_total;
        } else {
            // Comprei PUT e exerci = Vendi ações no strike
            cenarioExercido.acao = `Venda de ${qtd} ações a ${formatCurrency(strikeValue)}`;
            cenarioExercido.capital_recebido = notional;
            cenarioExercido.custo_opcao = premioTotal;
            cenarioExercido.resultado_total = notional - premioTotal; // Assumindo que tinha as ações
        }
    }
    
    // Cenário 2: NÃO EXERCIDO / VENCE OTM
    let cenarioNaoExercido = {};
    if (isVenda) {
        cenarioNaoExercido.resultado = premioTotal;
        cenarioNaoExercido.descricao = `Prêmio recebido: ${formatCurrency(premioTotal)} (${((premioTotal/saldo)*100).toFixed(2)}% do saldo)`;
    } else {
        cenarioNaoExercido.resultado = -premioTotal;
        cenarioNaoExercido.descricao = `Perda total do prêmio pago: ${formatCurrency(premioTotal)}`;
    }
    
    // breakeven e gregas já foram calculados acima

    // Construir contexto enriquecido
    const context = `
    ATUE COMO UM ANALISTA QUANTITATIVO DE DERIVATIVOS SÊNIOR.
    O usuário deseja realizar uma operação de **${posicao}** (${isVenda ? 'Short/Lançamento' : 'Long/Titular'}) de opção ${op.tipo}.
    
    DADOS DO CLIENTE:
    Saldo Disponível: ${formatCurrency(saldo)}
    
    OPÇÃO SELECIONADA:
    Ativo Objeto: ${document.getElementById('simAtivoBase').value.toUpperCase()} (Cotação: ${cotacaoAtivoBase ? formatCurrency(cotacaoAtivoBase) : 'N/A'})
    Opção: ${op.ativo} (${op.tipo})
    Strike: ${formatCurrency(strikeValue)}
    Prêmio: ${formatCurrency(parseFloat(op.premio))}
    Vencimento: ${formatDate(op.vencimento)}
    Break-Even: ${formatCurrency(breakeven)}
    Distância do Strike: ${distStrike > 0 ? '+' : ''}${distStrike.toFixed(2)}% ${distStrike > 0 ? '(ITM)' : distStrike < 0 ? '(OTM)' : '(ATM)'}
    
    ⚠️ TEMPO: ${diasRestantes} dias corridos (${diasUteis} dias úteis)
    ${diasRestantes <= 2 ? 'ALERTA: Vencimento Iminente!' : ''}
    
    GREGAS CALCULADAS (Contexto ${posicao}):
    Delta: ${gregas.delta ? gregas.delta.toFixed(4) : 'N/A'} (${isVenda ? 'Prob. Exercício (Contra)' : 'Prob. Exercício (Favor)'})
    Theta: ${gregas.theta ? gregas.theta.toFixed(4) : 'N/A'} (${isVenda ? 'Ganho Diário (Favorável)' : 'Perda Diária (Custo)'})
    Gamma: ${gregas.gamma ? gregas.gamma.toFixed(4) : 'N/A'}
    Vega: ${gregas.vega ? gregas.vega.toFixed(4) : 'N/A'}
    Volatilidade Implícita: ${gregas.implied_volatility ? (gregas.implied_volatility * 100).toFixed(2) + '%' : 'N/A'}
    
    📊 DADOS DETALHADOS DA ANÁLISE (Modal de Detalhes 📋):
    
    **Situação Financeira:**
    Notional (Se Exercido): ${formatCurrency(notional)}
    Saldo Corretora: ${formatCurrency(saldo)}
    Margem Disponível: ${formatCurrency(margemDisponivel)} ${margemDisponivel < 0 ? '⚠️ MARGEM INSUFICIENTE!' : ''}
    Utilização do Saldo: ${utilizacaoPercent.toFixed(1)}% ${utilizacaoPercent > 100 ? '⚠️ ACIMA DE 100%!' : utilizacaoPercent > 80 ? '⚠️ ALTO!' : '✅'}
    
    **Análise de Resultado:**
    P&L Atual: ${formatCurrency(pnlSimulado)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)
    Probabilidade de Lucro (PoP): ${(pop * 100).toFixed(1)}%
    
    **Financeiro:**
    Quantidade: ${qtd}
    ${financeiroLabel}: ${formatCurrency(valorTotal)}
    ${riscoTexto}
    Impacto Saldo: ${percSaldo.toFixed(2)}%
    
    📊 ANÁLISE DE CENÁRIOS OBRIGATÓRIA:
    
    **CENÁRIO 1: SE FOR EXERCIDO**
    ${cenarioExercido.acao}
    ${isVenda && op.tipo === 'PUT' ? `Capital Necessário: ${formatCurrency(cenarioExercido.capital_necessario)}
    Margem Usada: ${formatCurrency(Math.max(0, cenarioExercido.margem_usada))}
    Valor das Ações Hoje: ${formatCurrency(cenarioExercido.valor_acoes)}
    Resultado Líquido: ${formatCurrency(cenarioExercido.resultado_total)}` : ''}
    ${!isVenda && op.tipo === 'CALL' ? `Capital Necessário: ${formatCurrency(cenarioExercido.capital_necessario)}
    Custo Total (Strike + Prêmio): ${formatCurrency(cenarioExercido.custo_total)}
    Valor das Ações Hoje: ${formatCurrency(cenarioExercido.valor_acoes)}
    Resultado se vender agora: ${formatCurrency(cenarioExercido.resultado_total)}` : ''}
    
    **CENÁRIO 2: NÃO FOR EXERCIDO (OTM no vencimento)**
    ${cenarioNaoExercido.descricao}
    Resultado: ${formatCurrency(cenarioNaoExercido.resultado)}
    
    **CENÁRIO 3: DIFERENTES MOVIMENTOS DO ATIVO**
    Calcule e apresente em TABELA:
    - Se ativo subir +3%: Novo Spot = ${formatCurrency(spotValue * 1.03)} → Resultado?
    - Se ativo subir +5%: Novo Spot = ${formatCurrency(spotValue * 1.05)} → Resultado?
    - Se ativo cair -3%: Novo Spot = ${formatCurrency(spotValue * 0.97)} → Resultado?
    - Se ativo cair -5%: Novo Spot = ${formatCurrency(spotValue * 0.95)} → Resultado?
    - Se ficar lateral (0%): Novo Spot = ${formatCurrency(spotValue)} → Resultado?
    
    ALTERNATIVAS COMPARÁVEIS:
    ${listaOpcoes || 'Nenhuma alternativa próxima encontrada.'}
    
    QUESTÕES OBRIGATÓRIAS PARA ANÁLISE:
    
    1. **${isVenda ? 'ACEITARIA SER EXERCIDO?' : 'VALE A PENA EXERCER?'}**
       ${isVenda ? `Se for exercido, terei que ${op.tipo === 'PUT' ? 'comprar' : 'vender'} as ações. Isso é vantajoso considerando meu saldo de ${formatCurrency(saldo)}?` : `Se exercer, pagarei ${formatCurrency(notional + premioTotal)} total. Vale a pena?`}
    
    2. **MELHOR ESTRATÉGIA**:
       - Devo MANTER até o vencimento?
       - Devo FECHAR ANTECIPADAMENTE para realizar lucro/limitar perda?
       - Devo ROLAR para outro vencimento/strike?
    
    3. **COMPARAÇÃO COM OUTRAS OPERAÇÕES**:
       Das alternativas listadas, existe alguma MELHOR que essa?
       Sugira 2-3 operações alternativas considerando:
       - Mesmo tipo de estratégia
       - Melhor relação risco/retorno
       - Adequação ao meu saldo (${formatCurrency(saldo)})
    
    4. **GESTÃO DE RISCO**:
       - Qual % do saldo estou arriscando?
       - Preciso de stop loss? Em que nível?
       - Como devo monitorar essa posição?
    
    5. **VEREDITO FINAL COM NOTA**:
       Dê uma nota de 0 a 10 para esta operação e justifique.
       [✅ EXECUTAR] ou [⚠️ AJUSTAR] ou [❌ NÃO EXECUTAR]
    
    🎯 **ANÁLISE DE STRIKES - RECOMENDAÇÃO IMPORTANTE:**
    
    Com base nos dados detalhados acima (especialmente PoP de ${(pop * 100).toFixed(1)}%, Margem de ${formatCurrency(margemDisponivel)}, e Utilização de ${utilizacaoPercent.toFixed(1)}%):
    
    **SUGIRA 3 STRIKES ALTERNATIVOS QUE POSSAM MELHORAR O RESULTADO:**
    
    Para cada strike sugerido, considere:
    - Strike atual selecionado: ${formatCurrency(strikeValue)} (Distância: ${distStrike.toFixed(2)}%)
    - Cotação do ativo: ${formatCurrency(spotValue)}
    - Tipo de operação: ${posicao} de ${op.tipo}
    - Objetivo: ${isVenda ? 'Maximizar prêmio recebido com risco controlado' : 'Melhor custo-benefício para proteção/especulação'}
    
    Para cada strike recomendado, apresente em TABELA:
    | Strike Sugerido | Distância % | Prêmio Estimado | PoP Estimada | Notional | Margem Necessária | Vantagens | Desvantagens |
    |-----------------|-------------|-----------------|--------------|----------|-------------------|-----------|--------------|
    | ...             | ...         | ...             | ...          | ...      | ...               | ...       | ...          |
    
    **Critérios para recomendação de strikes:**
    - Strikes que otimizem a relação Risco x Retorno
    - Strikes que respeitem a margem disponível (${formatCurrency(margemDisponivel)})
    - Strikes com melhor Probabilidade de Lucro (PoP > ${(pop * 100).toFixed(0)}% se possível)
    - Strikes que se adequem ao perfil da estratégia (${isVenda ? 'geração de renda' : 'proteção/alavancagem'})
    ${utilizacaoPercent > 80 ? '- ⚠️ ATENÇÃO: Priorize strikes que reduzam a utilização do saldo (atualmente ${utilizacaoPercent.toFixed(1)}%)' : ''}
    ${margemDisponivel < 0 ? '- ⚠️ CRÍTICO: Strikes DEVEM ter notional menor para resolver problema de margem!' : ''}
    
    📈 SOLICITAÇÃO ESPECIAL:
    Crie uma análise visual/comparativa dos cenários acima.
    Sugira NOVAS operações ou estratégias baseadas nas condições atuais:
    - Saldo disponível: ${formatCurrency(saldo)}
    - Cotação do ativo: ${formatCurrency(spotValue)}
    - Volatilidade implícita: ${gregas.implied_volatility ? (gregas.implied_volatility * 100).toFixed(2) + '%' : 'N/A'}
    - Margem atual: ${formatCurrency(margemDisponivel)} ${margemDisponivel < 0 ? '⚠️' : '✅'}
    
    Responda SEMPRE EM PORTUGUÊS. Use Markdown com tabelas, emojis e formatação rica.
    `;

    // Show Loading
    Swal.fire({
        title: 'Analisando Mercado...',
        html: 'Consultando agente de IA especializado...',
        background: '#1f2937',
        color: '#f8f9fa',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // Inicializar histórico com o contexto
        currentChatHistory = [{role: 'user', content: context}];

        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ messages: currentChatHistory })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            // Salvar no histórico
            currentChatHistory.push({role: 'model', content: data.analysis});
            
            // Salvar cache
            lastSimParams = currentParams;
            lastSimResult = data.analysis;
            lastSimAgent = data.agent || null;
            lastSimModel = data.model || null;
            
            showAiResult(data.analysis, data.agent, data.model);
        } else {
            throw new Error(data.error || 'Erro na análise');
        }
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: e.message,
            background: '#1f2937',
            color: '#f8f9fa'
        });
    }
}

function showAiResult(markdownContent, agentName = null, modelName = null) {
    let activeModalInstance = null;

    const buildAgentLabel = (agent, model) => {
        if (!agent && !model) return '';
        if (agent && model) return `Agente: ${agent} · ${model}`;
        if (agent) return `Agente: ${agent}`;
        return `Modelo: ${model}`;
    };

    Swal.fire({
        title: 'Análise de IA',
        html: `
            <div id="ai-chat-container" class="markdown-content" style="text-align: left; max-height: 50vh; overflow-y: auto; color: #e2e8f0; margin-bottom: 1rem;">
                ${marked.parse(markdownContent)}
                <div id="ai-agent-label" class="ai-agent-label"></div>
            </div>
            <div class="mt-3 border-top border-secondary pt-3">
                <label class="form-label text-start w-100 small text-muted">Falar com a IA (Refinar Análise):</label>
                <div class="input-group">
                    <textarea id="ai-chat-input" class="form-control bg-dark text-white border-secondary" rows="2" placeholder="Ex: E se o mercado cair 10%?" autocomplete="off"></textarea>
                    <button class="btn btn-primary" type="button" id="ai-chat-send">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
            </div>
        `,
        width: '800px',
        background: '#1f2937',
        color: '#e2e8f0',
        showCloseButton: true,
        showDenyButton: true,
        denyButtonText: 'Atualizar Análise',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#206bc4',
        denyButtonColor: '#d63939',
        focusConfirm: false, // Não focar no botão de confirmação
        returnFocus: false, // Não retornar foco ao elemento anterior
        allowOutsideClick: true, // Permitir clique fora
        allowEscapeKey: true, // Permitir ESC
        allowEnterKey: false, // Não permitir Enter fechar o modal (conflita com envio)
        stopKeydownPropagation: false, // Permitir digitação
        customClass: {
            container: 'modal-blur',
            popup: 'border border-secondary shadow-lg',
            htmlContainer: 'text-start'
        },
        didOpen: () => {
            // Desativar focus trap do Bootstrap, se houver modal aberto
            const activeModal = document.querySelector('.modal.show');
            if (activeModal && window.bootstrap) {
                activeModalInstance = bootstrap.Modal.getInstance(activeModal);
                activeModalInstance?._focustrap?.deactivate();
            }

            // FIX: Forçar habilitação do input e focar nele
            setTimeout(() => {
                const input = document.getElementById('ai-chat-input');
                if(input) {
                    input.removeAttribute('disabled');
                    input.removeAttribute('readonly');
                    input.setAttribute('tabindex', '0');
                    input.setAttribute('wrap', 'soft');
                    input.focus();
                }
            }, 100);

            // Evitar que outros handlers capturem teclas
            const popup = Swal.getPopup();
            if (popup) {
                popup.addEventListener('keydown', (e) => e.stopPropagation());
            }

            // Mostrar agente que respondeu
            const agentLabel = buildAgentLabel(agentName, modelName);
            const agentEl = document.getElementById('ai-agent-label');
            if (agentEl) {
                agentEl.textContent = agentLabel;
                if (!agentLabel) agentEl.classList.add('d-none');
            }

            // Custom Dark Theme CSS for Markdown (mesmo de antes)
            if (!document.getElementById('markdown-styles')) {
                const style = document.createElement('style');
                style.id = 'markdown-styles';
                style.innerHTML = `
                    .markdown-content h1, .markdown-content h2, .markdown-content h3 { color: #f8f9fa; border-bottom: 1px solid #4b5563; padding-bottom: 0.5rem; margin-top: 1rem; }
                    .markdown-content p { color: #d1d5db; margin-bottom: 1rem; }
                    .markdown-content ul, .markdown-content ol { color: #d1d5db; padding-left: 1.5rem; }
                    .markdown-content li { margin-bottom: 0.25rem; }
                    .markdown-content strong { color: #60a5fa; font-weight: 700; }
                    .markdown-content code { background: #374151; padding: 0.2rem 0.4rem; border-radius: 4px; color: #fbbf24; }
                    .markdown-content blockquote { border-left: 4px solid #60a5fa; padding-left: 1rem; color: #9ca3af; }
                    .markdown-content table { width: 100%; border-collapse: collapse; margin: 1rem 0; color: #d1d5db; }
                    .markdown-content th, .markdown-content td { border: 1px solid #4b5563; padding: 0.5rem; text-align: left; }
                    .markdown-content th { background-color: #374151; color: #f8f9fa; }
                    .user-msg { background: #2d3748; padding: 0.5rem; border-radius: 0.5rem; margin-top: 1rem; border-left: 3px solid #4299e1; }
                    .ai-msg { margin-top: 1rem; }
                    .ai-agent-label { color: #9ca3af; font-size: 0.75rem; margin-top: 0.35rem; }
                `;
                document.head.appendChild(style);
            }

            // Bind events
            const input = document.getElementById('ai-chat-input');
            const btn = document.getElementById('ai-chat-send');
            const container = document.getElementById('ai-chat-container');

            const sendMsg = async () => {
                const text = input.value.trim();
                if (!text) return;

                // Add user message to UI
                container.innerHTML += `<div class="user-msg"><strong>Você:</strong> ${text}</div>`;
                input.value = '';
                container.scrollTop = container.scrollHeight; // Auto scroll

                // Add loading indicator
                const loadingId = 'loading-' + Date.now();
                container.innerHTML += `<div id="${loadingId}" class="ai-msg">Thinking...</div>`;
                container.scrollTop = container.scrollHeight;

                try {
                    // Add to history
                    currentChatHistory.push({role: 'user', content: text});

                    const res = await fetch(`${API_BASE}/api/analyze`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ messages: currentChatHistory })
                    });
                    
                    const data = await res.json();
                    
                    // Remove loading
                    document.getElementById(loadingId).remove();
                    
                    if (res.ok) {
                        currentChatHistory.push({role: 'model', content: data.analysis});
                        
                        // Render markdown response
                        const aiHtml = marked.parse(data.analysis);
                        container.innerHTML += `<div class="ai-msg">${aiHtml}</div>`;
                        
                        // Update agent label if changed
                        if (data.agent || data.model) {
                             const newLabel = buildAgentLabel(data.agent, data.model);
                             if (newLabel) {
                                 container.innerHTML += `<div class="ai-agent-label">${newLabel}</div>`;
                             }
                        }

                        container.scrollTop = container.scrollHeight;
                    } else {
                        container.innerHTML += `<div class="ai-msg text-danger">Erro: ${data.error || 'Erro desconhecido'}</div>`;
                    }
                } catch (e) {
                    document.getElementById(loadingId).remove();
                    container.innerHTML += `<div class="ai-msg text-danger">Erro de conexão: ${e.message}</div>`;
                }
            };

            btn.addEventListener('click', sendMsg);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMsg();
                }
            });
        }
    }).then((result) => {
        if (activeModalInstance) {
            activeModalInstance._focustrap?.activate();
        }
        if (result.isDenied) {
            analyzeSimWithAI(true);
        }
    });
}

function initCurrencyInputs() {
    document.querySelectorAll('.input-currency').forEach(input => {
        // Format on blur
        input.addEventListener('blur', function() {
            formatInputCurrency(this);
            if (this.id === 'inputPremio') {
                calcularResultado();
            }
        });
        
        // Handle Enter key
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });
        
        // Initial format if value exists
        if (input.value) formatInputCurrency(input);
    });
    
    // Ensure manual calculation trigger works with currency format
    document.getElementById('btnAtualizarDados')?.addEventListener('click', function() {
        // Delay slightly to allow blur events to process if any
        setTimeout(() => calcularResultado(), 100);
    });
}

function formatInputCurrency(input) {
    let value = input.value;
    if (!value) return;
    
    // Parse value to float first
    let num = parseCurrencyValue(value);
    if (isNaN(num)) return;
    
    input.value = formatCurrency(num);
}

function parseCurrencyValue(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Remove non-numeric chars except , . -
    // Assuming pt-BR: 1.000,00
    // Remove R$ and spaces
    let clean = val.toString().replace(/[R$\s]/g, '');
    // Remove dots (thousands)
    clean = clean.replace(/\./g, '');
    // Replace comma with dot
    clean = clean.replace(',', '.');
    return parseFloat(clean) || 0;
}

// updateSimUI function removed - simEstrategia field no longer exists

function aplicarSimulacao() {
    if (!simSelectedOption) return;

    // Close Sim Modal
    const modalSim = bootstrap.Modal.getInstance(document.getElementById('modalSimulacao'));
    modalSim.hide();

    // Open New Operation Modal
    openNewModal();
    
    // Fill data (need a small delay for modal transition or just set values)
    setTimeout(() => {
        document.getElementById('inputAtivoBase').value = simSelectedOption.ativo_base || document.getElementById('simAtivoBase').value.toUpperCase();
        document.getElementById('inputAtivo').value = simSelectedOption.ativo;
        document.getElementById('inputTipo').value = simSelectedOption.tipo;
        document.getElementById('inputQuantidade').value = document.getElementById('simQuantidade').value;
        document.getElementById('inputStrike').value = formatCurrency(parseFloatSafe(simSelectedOption.strike));
        document.getElementById('inputPremio').value = formatCurrency(Math.abs(parseFloatSafe(simSelectedOption.premio)));
        document.getElementById('inputVencimento').value = simSelectedOption.vencimento;
        
        // Preencher Preço de Entrada e Cotação Atual
        document.getElementById('inputPrecoEntrada').value = formatCurrency(Math.abs(parseFloatSafe(simSelectedOption.premio)));
        
        // Cotação Atual: usar cotação do ativo base ou preco_atual da opção
        const cotacaoAtual = cotacaoAtivoBase || parseFloat(simSelectedOption.preco_atual || 0) || parseFloat(simSelectedOption.preco_ativo_base || 0);
        document.getElementById('inputPrecoAtual').value = formatCurrency(cotacaoAtual);
        
        // Trigger calculations
        document.getElementById('inputQuantidade').dispatchEvent(new Event('change'));
        // Trigger blur to fetch details if needed, or just calculate result
        const qtd = parseInt(document.getElementById('simQuantidade').value);
        const premio = Math.abs(parseFloat(simSelectedOption.premio));
        // Para calcular o resultado correto, considerar se é venda (qtd negativa) ou compra
        const resultado = qtd * premio * (qtd < 0 ? 1 : -1);
        document.getElementById('inputResultado').value = formatCurrency(resultado);
        
        // Switch to "Mes Atual" tab if not already
        const tabMes = document.querySelector('a[href="#tab-mes-atual"]');
        if (tabMes) new bootstrap.Tab(tabMes).show();

    }, 500);
}

function mostrarDetalhesOpcao(ativo) {
    // Search in both lists (Main and Simulation)
    let op = opcoesDisponiveis.find(o => o.ativo === ativo);
    if (!op && typeof simOpcoesDisponiveis !== 'undefined') {
        op = simOpcoesDisponiveis.find(o => o.ativo === ativo);
    }
    
    if (!op) return;

    const dias = calcularDias(op.vencimento);
    const distancia = cotacaoAtivoBase ? ((op.strike - cotacaoAtivoBase) / cotacaoAtivoBase * 100).toFixed(2) + '%' : '-';
    
    // Use calculated Greeks if available (fallback for missing API data)
    const greeksSource = op.calculatedGreeks || op.greeks || {};
    
    // Greeks extraction with priority: calculated > direct property > greeks object
    // Using nullish coalescing (??) to preserve 0 values if valid, but here we want to fallback if undefined
    const deltaVal = parseFloat(op.calculatedGreeks?.delta ?? op.delta ?? greeksSource.delta ?? 0);
    const gammaVal = parseFloat(op.calculatedGreeks?.gamma ?? op.gamma ?? greeksSource.gamma ?? 0);
    const thetaVal = parseFloat(op.calculatedGreeks?.theta ?? op.theta ?? greeksSource.theta ?? 0);
    const vegaVal = parseFloat(op.calculatedGreeks?.vega ?? op.vega ?? greeksSource.vega ?? 0);
    const volVal = parseFloat(op.calculatedGreeks?.implied_volatility ?? op.implied_volatility ?? greeksSource.implied_volatility ?? 0);

    const delta = (deltaVal * 100).toFixed(1) + '%';
    const gamma = gammaVal.toFixed(4);
    const theta = thetaVal.toFixed(2);
    const vega = vegaVal.toFixed(2);
    const vol = (volVal * 100).toFixed(1) + '%';
    
    // Risk Structure Mock/Calc
    const stopLoss = formatCurrency(parseFloat(op.premio) * 0.5); // 50% stop
    const hedgeRatio = deltaVal !== 0 ? Math.abs(Math.round(1 / deltaVal)) : '-';

    Swal.fire({
        title: null,
        background: '#1f2937',
        color: '#f8f9fa',
        html: `
            <div class="text-start">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h2 class="m-0 fw-bold text-white">${op.ativo}</h2>
                        <span class="badge bg-${op.tipo === 'CALL' ? 'success' : 'danger'} text-uppercase">${op.tipo}</span>
                    </div>
                    <div class="text-end">
                        <div class="text-muted small">Prêmio</div>
                        <h2 class="m-0 text-${op.tipo === 'CALL' ? 'success' : 'danger'}">${formatCurrency(parseFloat(op.premio))}</h2>
                    </div>
                </div>
                
                <div class="card bg-dark-lt mb-3 border-secondary">
                    <div class="card-body p-3">
                        <div class="row text-center g-2">
                            <div class="col-4 border-end border-secondary">
                                <div class="text-muted small">Strike</div>
                                <div class="fw-bold text-white">${formatCurrency(parseFloat(op.strike))}</div>
                            </div>
                            <div class="col-4 border-end border-secondary">
                                <div class="text-muted small">Vencimento</div>
                                <div class="fw-bold text-white">${formatDate(op.vencimento)}</div>
                                <div class="small text-muted">${dias.corridos} dias</div>
                            </div>
                            <div class="col-4">
                                <div class="text-muted small">Distância</div>
                                <div class="fw-bold text-white">${distancia}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <h5 class="mb-2 border-bottom border-secondary pb-1 text-white">Gregas & Volatilidade</h5>
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <div class="d-flex justify-content-between px-2 py-1 rounded border border-secondary">
                            <span class="text-muted">Delta</span>
                            <span class="fw-bold text-primary">${delta}</span>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="d-flex justify-content-between px-2 py-1 rounded border border-secondary">
                            <span class="text-muted">Gamma</span>
                            <span class="fw-bold text-light">${gamma}</span>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="d-flex justify-content-between px-2 py-1 rounded border border-secondary">
                            <span class="text-muted">Theta</span>
                            <span class="fw-bold text-warning">${theta}</span>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="d-flex justify-content-between px-2 py-1 rounded border border-secondary">
                            <span class="text-muted">Vega</span>
                            <span class="fw-bold text-light">${vega}</span>
                        </div>
                    </div>
                    <div class="col-12">
                        <div class="d-flex justify-content-between px-2 py-1 rounded border border-secondary">
                            <span class="text-muted">Vol. Implícita</span>
                            <span class="fw-bold text-light">${vol}</span>
                        </div>
                    </div>
                </div>

                <div class="alert alert-info bg-blue-lt border-0 small mb-0 text-white">
                    <div class="d-flex">
                        <div class="me-2">ℹ️</div>
                        <div>
                            <strong>Estrutura de Risco:</strong><br>
                            Stop Loss Sugerido: ${stopLoss} (-50%)<br>
                            Hedge (Delta Neutral): 1 ação para ${hedgeRatio} opções
                        </div>
                    </div>
                </div>
            </div>
        `,
        showCloseButton: true,
        showCancelButton: true,
        focusConfirm: false,
        confirmButtonText: 'Selecionar Opção',
        cancelButtonText: 'Fechar',
        confirmButtonColor: '#206bc4',
        cancelButtonColor: '#4b5563',
        width: '500px',
        padding: '1.5rem',
        customClass: {
            popup: 'rounded-3 shadow-lg border border-secondary'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            selectOpcao(op);
        }
    });
}

// ============= FUNÇÕES DE CONFIGURAÇÃO DE IA =============

async function loadAvailableAIs() {
    try {
        const res = await fetch(`${API_BASE}/api/available-ais`);
        const data = await res.json();
        
        const select = document.getElementById('selectIA');
        select.innerHTML = '';
        
        if (data.available && data.available.length > 0) {
            data.available.forEach(ai => {
                const option = document.createElement('option');
                option.value = ai.key;
                option.textContent = ai.name;
                if (ai.key === data.current) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">Nenhuma IA configurada no backend</option>';
        }
    } catch (e) {
        console.error('Erro ao carregar IAs disponíveis:', e);
        document.getElementById('selectIA').innerHTML = '<option value="">Erro ao carregar IAs</option>';
    }
}

async function salvarConfigIA() {
    const select = document.getElementById('selectIA');
    const selectedAI = select.value;
    
    if (!selectedAI) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Selecione uma IA antes de salvar.',
            background: '#1f2937',
            color: '#e2e8f0'
        });
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/config-ia`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ selected_ai: selectedAI })
        });
        
        const data = await res.json();
        
        const statusDiv = document.getElementById('iaStatus');
        if (res.ok) {
            statusDiv.className = 'alert alert-success';
            statusDiv.textContent = `✅ Configuração salva! Usando: ${select.options[select.selectedIndex].text}`;
            statusDiv.classList.remove('d-none');
            
            setTimeout(() => statusDiv.classList.add('d-none'), 5000);
        } else {
            statusDiv.className = 'alert alert-danger';
            statusDiv.textContent = `❌ Erro: ${data.error || 'Falha ao salvar'}`;
            statusDiv.classList.remove('d-none');
        }
    } catch (e) {
        const statusDiv = document.getElementById('iaStatus');
        statusDiv.className = 'alert alert-danger';
        statusDiv.textContent = `❌ Erro de conexão: ${e.message}`;
        statusDiv.classList.remove('d-none');
    }
}

async function testarConexaoIA() {
    const select = document.getElementById('selectIA');
    const selectedAI = select.value;
    
    if (!selectedAI) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Selecione uma IA antes de testar.',
            background: '#1f2937',
            color: '#e2e8f0'
        });
        return;
    }
    
    const statusDiv = document.getElementById('iaStatus');
    statusDiv.className = 'alert alert-info';
    statusDiv.textContent = '🔄 Testando conexão...';
    statusDiv.classList.remove('d-none');
    
    try {
        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                messages: [{ role: 'user', content: 'Teste de conexão. Responda apenas: OK' }],
                force_ai: selectedAI
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            statusDiv.className = 'alert alert-success';
            statusDiv.textContent = `✅ Conexão OK! Resposta: ${data.analysis.substring(0, 100)}`;
        } else {
            statusDiv.className = 'alert alert-danger';
            statusDiv.textContent = `❌ Falha no teste: ${data.error}`;
        }
    } catch (e) {
        statusDiv.className = 'alert alert-danger';
        statusDiv.textContent = `❌ Erro de conexão: ${e.message}`;
    }
}

// ============= ANÁLISE TÉCNICA =============

let tradingViewWidget = null;
let chartTecnicalGauge = null;
let chartTecnicalOscillators = null;
let chartTecnicalMA = null;
let technicalAnalyzer = null;
let currentTechnicalData = null;

/**
 * Abre modal de análise técnica
 */
async function openTechnicalAnalysisModal() {
    // Verificar se há uma opção selecionada
    let ativoBase = null;
    
    // Tentar pegar do input da simulação
    const inputAtivoBase = document.getElementById('simAtivoBase');
    if (inputAtivoBase && inputAtivoBase.value) {
        ativoBase = inputAtivoBase.value.trim().toUpperCase();
    }
    
    // Se não encontrou, tentar da opção selecionada
    if (!ativoBase && simSelectedOption && simSelectedOption.ativo_base) {
        ativoBase = simSelectedOption.ativo_base.toUpperCase();
    }
    
    // Se ainda não encontrou, tentar do lastSimParams
    if (!ativoBase && lastSimParams && lastSimParams.ativoBase) {
        ativoBase = lastSimParams.ativoBase.toUpperCase();
    }
    
    // Se nenhum ativo base foi encontrado
    if (!ativoBase) {
        iziToast.warning({
            title: 'Atenção',
            message: 'Selecione uma opção primeiro para análise técnica.'
        });
        return;
    }

    const modalEl = document.getElementById('modalAnaliseTecnica');
    if (!modalEl) {
        iziToast.error({
            title: 'Erro',
            message: 'Modal de analise tecnica nao encontrado na pagina.'
        });
        return;
    }

    // Configurar modal para aparecer sobre a modal de simulação APENAS se ela estiver aberta
    const simulacaoModal = document.getElementById('modalSimulacao');
    const isSimulacaoOpen = simulacaoModal && simulacaoModal.classList.contains('show');
    
    if (isSimulacaoOpen) {
        // Aumentar z-index APENAS quando a simulação já está aberta
        modalEl.style.zIndex = '1060'; // Maior que o padrão (1055)
    }
    
    // Criar instância do modal
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl, {
        backdrop: isSimulacaoOpen ? 'static' : true, // Static apenas quando sobre simulação
        keyboard: true // Permite fechar com ESC
    });
    
    modal.show();
    
    // Ajustar backdrop APENAS se a simulação estiver aberta
    if (isSimulacaoOpen) {
        setTimeout(() => {
            const backdrop = document.querySelector('.modal-backdrop:last-of-type');
            if (backdrop) {
                backdrop.style.zIndex = '1059'; // Entre os dois modais
            }
        }, 100);
    }
    
    // Listener para resetar z-index ao fechar a modal
    modalEl.addEventListener('hidden.bs.modal', function resetZIndex() {
        modalEl.style.zIndex = '';
    }, { once: true });

    // Inicializar analisador
    if (!technicalAnalyzer) {
        technicalAnalyzer = new TechnicalAnalysis();
    }

    // Atualizar título
    document.getElementById('tecnicalAtivoTitle').textContent = ativoBase;

    // NÃO carregar o gráfico ainda - só quando o accordion for aberto
    // Configurar evento para carregar quando o accordion abrir
    const accordionCollapse = document.getElementById('collapseTradingView');
    if (accordionCollapse) {
        accordionCollapse.addEventListener('shown.bs.collapse', function () {
            // Carregar apenas na primeira vez
            if (!tradingViewWidget) {
                const currentTimeframe = document.querySelector('input[name="timeframe"]:checked')?.value || '1D';
                loadTradingViewChart(ativoBase, currentTimeframe);
            }
        }, { once: false }); // Permitir recarregar se necessário
    }

    // Mostrar loading
    document.getElementById('tecnicalLoading').style.display = 'block';
    document.getElementById('tecnicalContent').style.display = 'none';

    // Carregar análise técnica
    await loadAndAnalyzeTechnicalData(ativoBase, '1D');

    // Configurar botões de timeframe (radio buttons)
    document.querySelectorAll('input[name="timeframe"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                const timeframe = this.value;
                // Recarregar gráfico TradingView com novo timeframe (se já foi aberto)
                if (tradingViewWidget) {
                    loadTradingViewChart(ativoBase, timeframe);
                }
                // Recarregar análise técnica com novo timeframe
                loadAndAnalyzeTechnicalData(ativoBase, timeframe);
            }
        });
    });
}

/**
 * Carrega gráfico TradingView com dados reais em tempo real
 * 
 * NOTA IMPORTANTE SOBRE COTAÇÕES EM TEMPO REAL:
 * ===============================================
 * O TradingView fornece dados em TEMPO REAL da B3 através do seu feed próprio.
 * Isso significa que o preço mostrado no gráfico é atualizado automaticamente.
 * 
 * PROBLEMA: APIs externas (como a que você está usando) têm delay de 15-20 minutos
 * por restrições da B3 para dados gratuitos.
 * 
 * SOLUÇÕES SUGERIDAS:
 * 
 * 1. USAR TRADINGVIEW COMO FONTE PRIMÁRIA (Recomendado):
 *    - O widget já mostra cotações em tempo real
 *    - Use o TradingView também para exibir a cotação na simulação
 *    - API do TradingView: https://www.tradingview.com/rest-api-spec/
 * 
 * 2. WEBSOCKET DA B3 (Pago):
 *    - B3 oferece WebSocket feed em tempo real (serviço pago)
 *    - Requer conta profissional na B3
 *    - Mais confiável mas com custo mensal
 * 
 * 3. ACEITAR O DELAY (Atual):
 *    - Mostrar aviso ao usuário que dados têm 15-20 min de atraso
 *    - Usar TradingView apenas para visualização
 *    - API gratuita para cálculos
 * 
 * 4. ALPHA VANTAGE OU TWELVE DATA (Alternativa):
 *    - APIs com planos gratuitos e delay menor
 *    - Alpha Vantage: 5 calls/min grátis, delay ~5 min
 *    - Twelve Data: 800 calls/dia grátis, delay ~15 min
 */
function loadTradingViewChart(ticker, timeframe = '1D') {
    // Limpar container
    const container = document.getElementById('tradingview_chart');
    if (!container) {
        console.warn('Container TradingView não encontrado');
        return;
    }
    
    // Limpar completamente o container
    container.innerHTML = '';
    
    // Destruir widget anterior se existir
    if (tradingViewWidget && typeof tradingViewWidget.remove === 'function') {
        try {
            tradingViewWidget.remove();
        } catch (e) {
            console.warn('Erro ao remover widget anterior:', e);
        }
        tradingViewWidget = null;
    }
    
    // Determinar tema
    const isDarkMode = document.body.getAttribute('data-bs-theme') === 'dark';
    const theme = isDarkMode ? 'dark' : 'light';
    
    // Mapear timeframe para intervalo TradingView
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
    const interval = intervalMap[timeframe] || 'D';
    
    // Formatar símbolo para TradingView
    const symbol = `BMFBOVESPA:${ticker.toUpperCase()}`;
    
    // Aguardar um pouco para garantir que o container foi limpo
    setTimeout(() => {
        // Carregar script do TradingView se ainda não foi carregado
        if (!window.TradingView) {
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = () => initTradingViewWidget(symbol, interval, theme);
            document.head.appendChild(script);
        } else {
            initTradingViewWidget(symbol, interval, theme);
        }
    }, 100);
}

/**
 * Inicializa o widget TradingView com dados em tempo real
 */
function initTradingViewWidget(symbol, interval, theme) {
    try {
        tradingViewWidget = new TradingView.widget({
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
            container_id: 'tradingview_chart',
            hide_side_toolbar: false,
            hide_top_toolbar: false,
            hide_legend: false,
            save_image: false,
            // Habilitar dados em tempo real
            datafeed: undefined, // Usa datafeed padrão do TradingView (dados reais)
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
        
        console.log('TradingView Widget inicializado com sucesso');
        
    } catch (error) {
        console.error('Erro ao criar widget TradingView:', error);
    }
}

/**
 * Handler para mudança de timeframe
 */
async function handleTimeframeChange(e) {
    const timeframe = e.target.value;
    
    // Pegar ativo base do título do modal
    const ativoBase = document.getElementById('tecnicalAtivoTitle').textContent;
    
    if (!ativoBase) return;
    
    document.getElementById('tecnicalLoading').style.display = 'block';
    document.getElementById('tecnicalContent').style.display = 'none';
    
    await loadAndAnalyzeTechnicalData(ativoBase, timeframe);
}

/**
 * Retorna o timeframe selecionado
 */
function getSelectedTimeframe() {
    const selected = document.querySelector('input[name="timeframe"]:checked');
    return selected ? selected.value : '4h';
}

/**
 * Verifica se o mercado B3 está aberto
 */
function isMarketOpen() {
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo, 6 = Sábado
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    // Fim de semana - mercado fechado
    if (day === 0 || day === 6) {
        return false;
    }
    
    // Horário de funcionamento B3: 10:00 - 17:30 (horário de Brasília)
    const marketOpen = 10 * 60; // 10:00
    const marketClose = 17 * 60 + 30; // 17:30
    
    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}

/**
 * Atualiza o badge de status do mercado no navbar (apenas emoji com tooltip)
 */
function updateMarketStatus() {
    const badge = document.getElementById('navbarMarketStatus');
    if (!badge) return;
    
    const isOpen = isMarketOpen();
    
    badge.style.fontSize = '1.2rem';
    badge.style.cursor = 'help';
    badge.className = '';

    if (isOpen) {
        badge.textContent = '🟢';
        badge.title = 'Mercado Aberto';
    } else {
        badge.textContent = '🔴';
        badge.title = 'Mercado Fechado';
    }
    
    // Inicializar tooltip do Bootstrap
    if (typeof bootstrap !== 'undefined') {
        // Destruir tooltip anterior se existir
        const existingTooltip = bootstrap.Tooltip.getInstance(badge);
        if (existingTooltip) {
            existingTooltip.dispose();
        }
        // Criar novo tooltip
        new bootstrap.Tooltip(badge);
    }
}

/**
 * Atualiza o status do mercado em modais (apenas emoji com tooltip)
 */
function updateModalMarketStatus(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const isOpen = isMarketOpen();
    const isIndicator = element.classList.contains('status-indicator');
    
    if (isIndicator) {
        element.textContent = '';
        element.style.background = isOpen ? '#48bb78' : '#f56565';
        element.title = isOpen ? 'Mercado Aberto' : 'Mercado Fechado';
    } else {
        if (isOpen) {
            element.textContent = '🟢';
            element.title = 'Mercado Aberto';
        } else {
            element.textContent = '🔴';
            element.title = 'Mercado Fechado';
        }
    }
    
    if (typeof bootstrap !== 'undefined') {
        const existingTooltip = bootstrap.Tooltip.getInstance(element);
        if (existingTooltip) existingTooltip.dispose();
        new bootstrap.Tooltip(element);
    }
}

/**
 * Carrega dados históricos e realiza análise técnica
 */
async function loadAndAnalyzeTechnicalData(ticker, timeframe) {
    try {
        // Gerar dados mock para demonstração
        // TODO: Integrar com API real de dados históricos
        const historicalData = generateMockHistoricalData(ticker, 200);
        
        const { highs, lows, closes, volumes } = historicalData;
        
        // Realizar análise
        const analysis = technicalAnalyzer.analyzeAll(highs, lows, closes, volumes);
        const formatted = technicalAnalyzer.formatAnalysisForDisplay(analysis);
        
        currentTechnicalData = {
            analysis,
            formatted,
            historicalData,  // Adicionar dados históricos completos
            ticker,
            timeframe
        };
        
        // Atualizar UI
        updateTechnicalAnalysisUI(formatted, analysis);
        
        // Ocultar loading
        document.getElementById('tecnicalLoading').style.display = 'none';
        document.getElementById('tecnicalContent').style.display = 'block';
        
    } catch (error) {
        console.error('Erro na análise técnica:', error);
        iziToast.error({
            title: 'Erro',
            message: 'Erro ao processar análise técnica: ' + error.message
        });
        
        document.getElementById('tecnicalLoading').style.display = 'none';
    }
}

/**
 * Gera dados históricos mock
 */
function generateMockHistoricalData(ticker, periods) {
    const opens = [];
    const closes = [];
    const highs = [];
    const lows = [];
    const volumes = [];
    const timestamps = [];
    
    // Preço inicial baseado no ticker (simulado)
    let price = 30 + Math.random() * 20;
    
    // Data/hora inicial (últimos N períodos)
    const now = new Date();
    const intervalMs = 60000; // 1 minuto (ajustar conforme timeframe)
    
    for (let i = 0; i < periods; i++) {
        // Variação aleatória com tendência
        const change = (Math.random() - 0.48) * 2; // Leve viés de alta
        const open = price;
        price = Math.max(5, price + change);
        
        const high = Math.max(open, price) * (1 + Math.random() * 0.02);
        const low = Math.min(open, price) * (1 - Math.random() * 0.02);
        const volume = Math.floor(100000 + Math.random() * 500000);
        
        // Timestamp indo do passado para o presente
        const timestamp = new Date(now.getTime() - (periods - i) * intervalMs);
        
        opens.push(open);
        closes.push(price);
        highs.push(high);
        lows.push(low);
        volumes.push(volume);
        timestamps.push(timestamp.toISOString());
    }
    
    return { opens, closes, highs, lows, volumes, timestamps };
}

/**
 * Atualiza a interface com os resultados da análise
 */
function updateTechnicalAnalysisUI(formatted, analysis) {
    const { overall, oscillators, movingAverages, recommendation, strength } = formatted;
    
    // Atualizar recomendação geral
    const recText = recommendation;
    const recColor = getRecommendationColor(overall.signal);
    
    document.getElementById('tecnicalRecommendation').textContent = recText;
    document.getElementById('tecnicalRecommendation').className = 'mb-2 text-' + recColor;
    
    const totalIndicators = oscillators.total + movingAverages.total;
    document.getElementById('tecnicalRecommendationSubtext').textContent = 
        `Baseado em ${totalIndicators} indicadores`;
    
    // Atualizar contadores
    document.getElementById('oscBuyCount').textContent = `${oscillators.buy} Compra`;
    document.getElementById('oscNeutralCount').textContent = `${oscillators.neutral} Neutro`;
    document.getElementById('oscSellCount').textContent = `${oscillators.sell} Venda`;
    
    document.getElementById('maBuyCount').textContent = `${movingAverages.buy} Compra`;
    document.getElementById('maNeutralCount').textContent = `${movingAverages.neutral} Neutro`;
    document.getElementById('maSellCount').textContent = `${movingAverages.sell} Venda`;
    
    // Criar gráficos
    createTechnicalCharts(formatted, analysis);
    
    // Preencher tabelas de detalhes
    fillOscillatorsTable(analysis.raw.oscillators);
    fillMovingAveragesTable(analysis.raw.movingAverages, analysis.raw.oscillators);
}

/**
 * Retorna cor baseada na recomendação
 */
function getRecommendationColor(signal) {
    const colors = {
        'STRONG_BUY': 'success',
        'BUY': 'success',
        'NEUTRAL': 'secondary',
        'SELL': 'danger',
        'STRONG_SELL': 'danger'
    };
    return colors[signal] || 'secondary';
}

/**
 * Cria os gráficos de análise técnica
 */
function createTechnicalCharts(formatted, analysis) {
    const isDarkMode = document.body.getAttribute('data-bs-theme') === 'dark';
    const textColor = isDarkMode ? '#f8f9fa' : '#666666';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    // 1. Gauge de Força
    createGaugeChart(formatted.strength, textColor);
    
    // 2. Gráfico de Osciladores
    createOscillatorsChart(formatted.oscillators, textColor, gridColor);
    
    // 3. Gráfico de Médias Móveis
    createMovingAveragesChart(formatted.movingAverages, textColor, gridColor);
}

/**
 * Cria gráfico Gauge semicircular
 */
function createGaugeChart(strength, textColor) {
    const ctx = document.getElementById('chartTecnicalGauge');
    
    if (chartTecnicalGauge) {
        chartTecnicalGauge.destroy();
    }
    
    // Normalizar strength de -100/+100 para 0-100
    const normalizedValue = ((strength + 100) / 2);
    
    chartTecnicalGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [normalizedValue, 100 - normalizedValue],
                backgroundColor: [
                    strength > 20 ? '#22c55e' : strength < -20 ? '#ef4444' : '#94a3b8',
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
                    font: { size: 32, weight: 'bold' },
                    padding: { top: 80 }
                }
            }
        }
    });
}

/**
 * Cria gráfico de barras para osciladores
 */
function createOscillatorsChart(oscillators, textColor, gridColor) {
    const ctx = document.getElementById('chartTecnicalOscillators');
    
    if (chartTecnicalOscillators) {
        chartTecnicalOscillators.destroy();
    }
    
    chartTecnicalOscillators = new Chart(ctx, {
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
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed.x + ' indicadores';
                        }
                    }
                }
            },
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

/**
 * Cria gráfico de barras para médias móveis
 */
function createMovingAveragesChart(movingAverages, textColor, gridColor) {
    const ctx = document.getElementById('chartTecnicalMA');
    
    if (chartTecnicalMA) {
        chartTecnicalMA.destroy();
    }
    
    chartTecnicalMA = new Chart(ctx, {
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
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed.x + ' indicadores';
                        }
                    }
                }
            },
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

/**
 * Preenche tabela de osciladores
 */
function fillOscillatorsTable(oscillators) {
    const tbody = document.querySelector('#tableOscillators tbody');
    tbody.innerHTML = '';
    
    const currentPrice = 35; // Mock - usar preço real
    
    const indicators = [
        { name: 'RSI (14)', value: oscillators.rsi?.toFixed(2) || '-', signal: getOscillatorSignal('rsi', oscillators.rsi) },
        { name: 'Stochastic %K', value: oscillators.stochastic?.k.toFixed(2) || '-', signal: getOscillatorSignal('stochastic', oscillators.stochastic?.k) },
        { name: 'CCI (20)', value: oscillators.cci?.toFixed(2) || '-', signal: getOscillatorSignal('cci', oscillators.cci) },
        { name: 'ADX (14)', value: oscillators.adx?.toFixed(2) || '-', signal: 'Neutro' },
        { name: 'Williams %R', value: oscillators.williamsR?.toFixed(2) || '-', signal: getOscillatorSignal('williamsR', oscillators.williamsR) },
        { name: 'MACD', value: oscillators.macd?.histogram.toFixed(4) || '-', signal: oscillators.macd?.histogram > 0 ? 'Compra' : 'Venda' }
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

/**
 * Preenche tabela de médias móveis
 */
function fillMovingAveragesTable(movingAverages, oscillators) {
    const tbody = document.querySelector('#tableMovingAverages tbody');
    tbody.innerHTML = '';
    
    // Gerar preço atual mock
    const currentPrice = 35; // Mock - usar preço real
    
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
        if (ma.value === null) return;
        
        const signal = currentPrice > ma.value ? 'Compra' : 'Venda';
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${ma.name}</td>
            <td>${ma.value.toFixed(2)}</td>
            <td><span class="badge bg-${getSignalColor(signal)}">${signal}</span></td>
        `;
    });
    
    // Adicionar Ichimoku
    if (movingAverages.ichimoku) {
        const signal = movingAverages.ichimoku.signal === 'BUY' ? 'Compra' : 
                      movingAverages.ichimoku.signal === 'SELL' ? 'Venda' : 'Neutro';
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>Ichimoku</td>
            <td>-</td>
            <td><span class="badge bg-${getSignalColor(signal)}">${signal}</span></td>
        `;
    }
}

/**
 * Retorna sinal do oscilador
 */
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

/**
 * Retorna cor do badge baseado no sinal
 */
function getSignalColor(signal) {
    if (signal === 'Compra') return 'success';
    if (signal === 'Venda') return 'danger';
    return 'secondary';
}

// ==========================================
// Y2 MODAL - Todo código movido para detalhe-opcoes.js
// ==========================================
function openY2Tab(evt, tabName) {
    var i, tabcontent, tablinks;
    // Get all tab-content elements
    tabcontent = document.getElementsByClassName("tab-content");
    
    // Hide all tab contents inside the modal
    for (i = 0; i < tabcontent.length; i++) {
        // Scope to modal to avoid hiding other tabs on the page
        if (tabcontent[i].closest('#modalDetalhesOperacao')) {
            tabcontent[i].classList.remove("active");
            tabcontent[i].style.display = "none"; 
        }
    }
    
    // Remove active class from all tab links in the modal
    tablinks = document.querySelectorAll("#modalDetalhesOperacao .nav-tabs .nav-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    
    // Show the specific tab content
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add("active");
        targetTab.style.display = "block";
    }
    
    // Add active class to the button that opened the tab
    const targetLink = document.querySelector(`#modalDetalhesOperacao .nav-tabs .nav-link[data-y2-tab="${tabName}"]`);
    if (targetLink) {
        targetLink.classList.add("active");
        return;
    }
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add("active");
    } else if (evt && evt.target) {
        evt.target.classList.add("active");
    }
}

// Redefine refreshDetalhesOperacao to use new IDs
async function refreshDetalhesOperacao() {
    if (!currentDetalhesOpId) return;
    
    const btn = document.getElementById('btn-y2-refresh');
    let originalText = '🔄 Atualizar';
    if(btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Carregando...';
        btn.disabled = true;
    }
    
    // Aplicar loading aos valores que serão atualizados
    const elementsToUpdate = [
        'y2-ativo-preco', 'y2-opcao-preco', 'y2-opcao-var',
        'y2-stat-dist', 'y2-lucro-atual', 'y2-lucro-percent',
        'y2-greeks-delta', 'y2-greeks-gamma', 'y2-greeks-theta',
        'y2-greeks-vega', 'y2-greeks-iv'
    ];
    showMultipleElementsLoading(elementsToUpdate, true);

    try {
        const res = await fetch(`${API_BASE}/api/opcoes/${currentDetalhesOpId}`);
        if (!res.ok) throw new Error('Failed to fetch operation');
        const op = await res.json();
        
        // Fetch market data
        let marketData = {};
        try {
            // Get option data (includes underlying price usually)
            const resMarket = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${op.ativo}`);
            const data = await resMarket.json();
            
            if (Array.isArray(data)) marketData = data[0];
            else if (data.opcoes) marketData = data.opcoes[0];
            else marketData = data;
            
            // If we have underlying price in response, use it
            if (data.spot_price) marketData.spot_price = parseFloat(data.spot_price);
            
        } catch(e) { console.error('Error fetching market data:', e); }
        
        updateY2Fields(op, marketData);
        
    } catch(e) {
        console.error('Error refreshing details:', e);
        iziToast.error({title: 'Erro', message: 'Erro ao atualizar dados: ' + e.message});
    } finally {
        showMultipleElementsLoading(elementsToUpdate, false);
        if(btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

function updateY2Fields(op, marketData) {
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val;
    };
    
    const setHtml = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = val;
    };

    // --- Parse Data ---
    const qtd = parseFloat(op.quantidade);
    const strike = parseFloat(op.strike);
    const premioAbertura = parseFloat(op.premio);
    const tipo = op.tipo;
    const isVenda = qtd < 0;
    const qtdAbs = Math.abs(qtd);
    const isCall = tipo === 'CALL';
    
    // Market Data
    let precoAtivo = marketData.spot_price || parseFloat(op.preco_atual_ativo || 0); // Fallback
    // If marketData has preco_ativo_base, use it
    if (marketData.preco_ativo_base) precoAtivo = parseFloat(marketData.preco_ativo_base);
    
    let precoOpcao = parseFloat(marketData.premio || marketData.price || marketData.last || 0);
    // Fallback to op.preco_atual if market data failed
    if (!precoOpcao && op.preco_atual) precoOpcao = parseFloat(op.preco_atual);
    
    // Greeks
    const delta = parseFloat(marketData.delta || 0);
    const gamma = parseFloat(marketData.gamma || 0);
    const theta = parseFloat(marketData.theta || 0);
    const vega = parseFloat(marketData.vega || 0);
    const iv = parseFloat(marketData.implied_volatility || 0);

    // --- Calculations ---
    
    // Vencimento
    const diasInfo = calcularDias(op.vencimento);
    const diasRestantes = diasInfo.corridos;
    
    // Distance
    const distancia = precoAtivo > 0 ? ((precoAtivo / strike) - 1) * 100 : 0;
    
    // Financials
    const totalRecebido = premioAbertura * qtdAbs; // If sell
    const custoRecompra = precoOpcao * qtdAbs;
    
    let resultadoLiquido = 0;
    if (isVenda) {
        resultadoLiquido = totalRecebido - custoRecompra;
    } else {
        resultadoLiquido = (precoOpcao * qtdAbs) - (premioAbertura * qtdAbs);
    }
    
    const lucroPercent = premioAbertura > 0 ? (resultadoLiquido / (premioAbertura * qtdAbs)) * 100 : 0;
    
    // --- Update UI ---
    
    // Header
    setText('y2-ticker', op.ativo);
    setText('y2-badge-side', `${isVenda ? 'VENDA' : 'COMPRA'} - ${tipo}`);
    const badgeSide = document.getElementById('y2-badge-side');
    if(badgeSide) {
        badgeSide.className = `badge ${isVenda ? 'badge-red' : 'badge-green'}`;
    }
    
    setText('y2-badge-status', op.status);
    setText('y2-vencimento', `📅 Vencimento: ${formatDate(op.vencimento)} (${diasRestantes} dias)`);
    setText('y2-strike', `💰 Strike: ${formatCurrency(strike)}`);
    setText('y2-premio', `💵 Premio: ${formatCurrency(premioAbertura)}`);
    setText('y2-qtd', `📊 Quantidade: ${qtd}`);
    
    // Performance Tab
    setText('y2-ativo-base', op.ativo_base);
    setText('y2-ativo-preco', formatCurrency(precoAtivo));
    
    // Var Ativo (Simulated as we don't have open price of asset easily, assume 0 for now or fetch history)
    // For now, let's use 0% or N/A
    setText('y2-ativo-var', '0.00%'); 
    
    setText('y2-opcao-ticker', op.ativo);
    setText('y2-opcao-preco', formatCurrency(precoOpcao));
    
    // Var Opcao (Current vs Open)
    const varOpcao = premioAbertura > 0 ? ((precoOpcao - premioAbertura) / premioAbertura) * 100 : 0;
    const varOpcaoFormatted = `${varOpcao > 0 ? '⬆️' : '⬇️'} ${varOpcao.toFixed(2)}%`;
    setText('y2-opcao-var', varOpcaoFormatted);
    const varOpcaoEl = document.getElementById('y2-opcao-var');
    if(varOpcaoEl) varOpcaoEl.className = varOpcao > 0 ? 'green' : 'red';
    
    setText('y2-stat-strike', formatCurrency(strike));
    setText('y2-stat-dist', `${distancia.toFixed(2)}%`);
    setText('y2-stat-dias', `${diasRestantes}d`);
    
    // Result Box
    setText('y2-lucro-atual', formatCurrency(resultadoLiquido));
    const resultValEl = document.getElementById('y2-lucro-atual');
    if(resultValEl) {
        resultValEl.className = `result-value ${resultadoLiquido >= 0 ? 'green' : 'red'}`; // Actually y2 uses blue for value, but logic might vary
        // y2.html uses green for positive result usually
        if(resultadoLiquido < 0) resultValEl.style.color = 'var(--red)';
        else resultValEl.style.color = 'var(--green)';
    }
    
    setText('y2-lucro-percent', `${lucroPercent > 0 ? '+' : ''}${lucroPercent.toFixed(2)}%`);
    
    // Result Details
    setText('y2-res-fechamento', formatCurrency(isVenda ? totalRecebido : '---')); // Estimado se virar pó (venda)
    setText('y2-res-mtm', formatCurrency(resultadoLiquido));
    
    // Premio Details
    setText('y2-premio-abertura', formatCurrency(premioAbertura));
    setText('y2-custo-recompra', formatCurrency(custoRecompra)); // Usually negative for cost
    setText('y2-res-liquido', formatCurrency(resultadoLiquido));
    
    // Progress Bar (Premio Captado for Short)
    if (isVenda) {
        // Captured = (Premio Abertura - Premio Atual) / Premio Abertura
        const captured = Math.max(0, (premioAbertura - precoOpcao) / premioAbertura);
        const capturedPct = captured * 100;
        const bar = document.getElementById('y2-premio-bar');
        if(bar) bar.style.width = `${capturedPct}%`;
        setText('y2-premio-text', `${capturedPct.toFixed(2)}% do prêmio captado`);
    }
    
    // Detalhes Tab
    setText('y2-det-abertura-ativo', 'R$ -'); // Don't have historical asset price easily
    setText('y2-det-abertura-premio', formatCurrency(premioAbertura));
    setText('y2-det-abertura-qtd', qtd);
    setText('y2-det-abertura-total', formatCurrency(Math.abs(totalRecebido)));
    
    setText('y2-det-atual-ativo', formatCurrency(precoAtivo));
    setText('y2-det-atual-premio', formatCurrency(precoOpcao));
    setText('y2-det-atual-dist', `${distancia.toFixed(2)}%`);
    setText('y2-det-atual-premio-pct', `${((precoOpcao/premioAbertura)*100).toFixed(2)}%`);
    setText('y2-det-atual-recompra', formatCurrency(custoRecompra));
    
    setText('y2-info-tipo', isVenda ? 'VENDA' : 'COMPRA');
    setText('y2-info-opcao', tipo);
    setText('y2-info-strike', formatCurrency(strike));
    setText('y2-info-vencimento', formatDate(op.vencimento));
    
    // Gregas
    setText('y2-greek-delta', delta.toFixed(4));
    setText('y2-greek-gamma', gamma.toFixed(4));
    setText('y2-greek-theta', theta.toFixed(4));
    setText('y2-greek-vega', vega.toFixed(4));
    
    // Update bars
    const setBar = (id, val) => {
        const bar = document.getElementById(id);
        if(bar) bar.style.width = `${Math.min(100, Math.abs(val)*100)}%`; // Simple normalization
    };
    setBar('y2-greek-delta-bar', delta);
    setBar('y2-greek-gamma-bar', gamma * 10); // Scale up
    setBar('y2-greek-theta-bar', theta * 10);
    setBar('y2-greek-vega-bar', vega * 10);

    const basePrice = precoAtivo > 0 ? precoAtivo : strike;
    const pessimistaPrice = basePrice * 0.9;
    const otimistaPrice = basePrice * 1.1;
    const calcResultado = (price) => {
        const intrinsic = isCall ? Math.max(0, price - strike) : Math.max(0, strike - price);
        return isVenda ? (premioAbertura - intrinsic) * qtdAbs : (intrinsic - premioAbertura) * qtdAbs;
    };
    const resultadoPessimista = calcResultado(pessimistaPrice);
    const resultadoAtual = calcResultado(basePrice);
    const resultadoOtimista = calcResultado(otimistaPrice);

    setText('y2-pior-caso', formatCurrency(Math.min(resultadoPessimista, resultadoAtual, resultadoOtimista)));
    setText('y2-atual-caso', formatCurrency(resultadoAtual));
    setText('y2-melhor-caso', formatCurrency(Math.max(resultadoPessimista, resultadoAtual, resultadoOtimista)));

    const chartColor = resultadoLiquido >= 0 ? '#10b981' : '#ef4444';
    const amplitude = Math.max(10, Math.abs(resultadoLiquido) * 0.5);
    const evolutionPoints = [
        resultadoLiquido + amplitude,
        resultadoLiquido + amplitude * 0.6,
        resultadoLiquido + amplitude * 0.3,
        resultadoLiquido,
        resultadoLiquido - amplitude * 0.2,
        resultadoLiquido - amplitude * 0.4,
        resultadoLiquido + amplitude * 0.1
    ];
    renderEvolutionChart(chartColor, 'y2-evolution-chart', evolutionPoints, ['6d atrás', '5d', '4d', '3d', '2d', 'Hoje', 'Previsão']);
    renderProjectionChart(basePrice, strike, premioAbertura, Math.max(diasRestantes, 1), isCall, isVenda, 'y2-projection-chart');
    
    // Risco (Basic simulation)
    // Perda Máxima (Short Put: Strike - Premio) * Qtd
    // Ganho Máximo (Short Put: Premio) * Qtd
    let maxGain = 0;
    let maxLoss = 0;
    let breakeven = 0;
    
    if (isVenda && tipo === 'PUT') {
        maxGain = totalRecebido;
        maxLoss = (strike * qtdAbs) - totalRecebido; // Worst case stock goes to 0
        breakeven = strike - premioAbertura;
    }
    // Add logic for other types if needed
    
    setText('y2-risk-gain', formatCurrency(maxGain));
    setText('y2-risk-loss', formatCurrency(-maxLoss)); // Show as negative
    setText('y2-risk-breakeven', formatCurrency(breakeven));
}
// Setup modal detalhes tab switching
document.addEventListener('DOMContentLoaded', function() {
    const modalDetalhes = document.getElementById('modalDetalhesOperacao');
    if (modalDetalhes) {
        modalDetalhes.addEventListener('shown.bs.modal', function() {
            const tabs = modalDetalhes.querySelectorAll('.nav-link[data-tab]');
            const tabContents = modalDetalhes.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    const targetTab = this.getAttribute('data-tab');
                    
                    // Remove active from all
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(tc => tc.style.display = 'none');
                    
                    // Activate clicked tab
                    this.classList.add('active');
                    
                    // Show content
                    const content = modalDetalhes.querySelector(`#${targetTab}`);
                    if (content) {
                        content.style.display = 'block';
                    }
                });
            });
        });
    }
});

// Chart instances for modal detalhes
let detChart1 = null; // Evolução do Resultado
let detChart2 = null; // Previsão por Preço no Vencimento
let detChart3 = null; // Gráfico de Payoff
let detChart4 = null; // Volatilidade
let detChart5 = null; // Histórico de Preço

/**
 * Renderiza o gráfico de Evolução do Resultado (Chart 1)
 * Mostra como o P&L evoluiu desde a abertura
 */
function renderDetChart1(operacao) {
    const canvas = document.getElementById('detChart1');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destruir gráfico anterior
    if (detChart1) {
        detChart1.destroy();
    }
    
    // Dados simulados de evolução do P&L ao longo do tempo
    // TODO: Substituir por dados reais do histórico
    const days = [];
    const pnlValues = [];
    const dataAbertura = new Date(operacao.data_abertura);
    const hoje = new Date();
    const diasDecorridos = Math.floor((hoje - dataAbertura) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i <= Math.min(diasDecorridos, 30); i++) {
        const data = new Date(dataAbertura);
        data.setDate(data.getDate() + i);
        days.push(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        
        // Simulação: P&L cresce conforme passa o tempo (decay)
        const progress = i / diasDecorridos;
        const pnlAtual = parseFloat(document.getElementById('detMTM').textContent.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
        pnlValues.push(pnlAtual * progress);
    }
    
    detChart1 = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'P&L (R$)',
                data: pnlValues,
                borderColor: pnlValues[pnlValues.length - 1] >= 0 ? '#2fb344' : '#d63939',
                backgroundColor: pnlValues[pnlValues.length - 1] >= 0 ? 'rgba(47, 179, 68, 0.1)' : 'rgba(214, 57, 57, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'P&L: R$ ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

/**
 * Renderiza o gráfico de Previsão por Preço no Vencimento (Chart 2)
 * Diagrama de payoff mostrando P&L em diferentes preços do ativo
 */
function renderDetChart2(operacao) {
    const canvas = document.getElementById('detChart2');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (detChart2) {
        detChart2.destroy();
    }
    
    const strike = parseFloat(operacao.strike);
    const premioAbertura = parseFloat(operacao.premio_abertura);
    const qtd = parseInt(operacao.quantidade);
    const isVenda = operacao.tipo_operacao === 'VENDA';
    const tipo = operacao.tipo_opcao;
    
    // Range de preços: ±20% do strike
    const minPrice = strike * 0.8;
    const maxPrice = strike * 1.2;
    const step = (maxPrice - minPrice) / 50;
    
    const prices = [];
    const pnlValues = [];
    
    for (let price = minPrice; price <= maxPrice; price += step) {
        prices.push(price.toFixed(2));
        
        let pnl = 0;
        if (isVenda && tipo === 'PUT') {
            // Short Put: Ganho limitado ao prêmio, perda quando preço < strike
            if (price >= strike) {
                pnl = premioAbertura * qtd; // Prêmio retido
            } else {
                pnl = (premioAbertura * qtd) - ((strike - price) * qtd);
            }
        } else if (!isVenda && tipo === 'PUT') {
            // Long Put
            if (price >= strike) {
                pnl = -(premioAbertura * qtd);
            } else {
                pnl = ((strike - price) * qtd) - (premioAbertura * qtd);
            }
        }
        // TODO: Adicionar lógica para CALL
        
        pnlValues.push(pnl);
    }
    
    detChart2 = new Chart(ctx, {
        type: 'line',
        data: {
            labels: prices,
            datasets: [{
                label: 'P&L no Vencimento (R$)',
                data: pnlValues,
                borderColor: '#206bc4',
                backgroundColor: 'rgba(32, 107, 196, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 0,
                            yMax: 0,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderWidth: 1,
                            borderDash: [5, 5]
                        },
                        line2: {
                            type: 'line',
                            xMin: strike,
                            xMax: strike,
                            borderColor: '#f59f00',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: 'Strike',
                                position: 'start'
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        callback: function(value, index) {
                            return 'R$ ' + this.getLabelForValue(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renderiza gráfico de Payoff na aba Simulação (Chart 3)
 * Similar ao Chart 2 mas na aba de simulação
 */
function renderDetChart3(operacao) {
    const canvas = document.getElementById('detChart3');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (detChart3) {
        detChart3.destroy();
    }
    
    // Reutilizar mesma lógica do Chart 2
    const strike = parseFloat(operacao.strike);
    const premioAbertura = parseFloat(operacao.premio_abertura);
    const qtd = parseInt(operacao.quantidade);
    const isVenda = operacao.tipo_operacao === 'VENDA';
    const tipo = operacao.tipo_opcao;
    
    const minPrice = strike * 0.8;
    const maxPrice = strike * 1.2;
    const step = (maxPrice - minPrice) / 50;
    
    const prices = [];
    const pnlValues = [];
    
    for (let price = minPrice; price <= maxPrice; price += step) {
        prices.push(price.toFixed(2));
        
        let pnl = 0;
        if (isVenda && tipo === 'PUT') {
            if (price >= strike) {
                pnl = premioAbertura * qtd;
            } else {
                pnl = (premioAbertura * qtd) - ((strike - price) * qtd);
            }
        }
        
        pnlValues.push(pnl);
    }
    
    detChart3 = new Chart(ctx, {
        type: 'line',
        data: {
            labels: prices,
            datasets: [{
                label: 'Payoff (R$)',
                data: pnlValues,
                borderColor: '#2fb344',
                backgroundColor: 'rgba(47, 179, 68, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.1,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            }
        }
    });
}

/**
 * Renderiza gráfico de Volatilidade (Chart 4)
 * Compara volatilidade implícita vs histórica
 */
function renderDetChart4(operacao) {
    const canvas = document.getElementById('detChart4');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (detChart4) {
        detChart4.destroy();
    }
    
    // Dados simulados de volatilidade
    // TODO: Buscar dados reais de volatilidade
    const days = [];
    const ivData = [];
    const hvData = [];
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        
        // Simulação: IV geralmente maior que HV perto do vencimento
        ivData.push(25 + Math.random() * 15);
        hvData.push(20 + Math.random() * 10);
    }
    
    detChart4 = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Volatilidade Implícita (%)',
                    data: ivData,
                    borderColor: '#206bc4',
                    backgroundColor: 'rgba(32, 107, 196, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Volatilidade Histórica (%)',
                    data: hvData,
                    borderColor: '#f59f00',
                    backgroundColor: 'rgba(245, 159, 0, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(0) + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            }
        }
    });
}

/**
 * Renderiza gráfico de Histórico de Preço (Chart 5)
 * Mostra evolução do preço do ativo base
 */
function renderDetChart5(operacao) {
    const canvas = document.getElementById('detChart5');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (detChart5) {
        detChart5.destroy();
    }
    
    // Dados simulados de histórico de preço
    // TODO: Buscar dados reais da API
    const days = [];
    const priceData = [];
    const precoAtual = parseFloat(document.getElementById('detPrecoAtivo').textContent.replace(/[^\d,]/g, '').replace(',', '.'));
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        
        // Simulação: variação aleatória ao redor do preço atual
        const variation = (Math.random() - 0.5) * 0.1; // ±5%
        priceData.push(precoAtual * (1 + variation));
    }
    
    detChart5 = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: operacao.ativo_base,
                data: priceData,
                borderColor: '#2fb344',
                backgroundColor: 'rgba(47, 179, 68, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(2);
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            }
        }
    });
}

/**
 * Popula o container de gregas na aba Gráficos
 */
function populateGregasDisplay(operacao) {
    const container = document.getElementById('gregasContainer');
    if (!container) return;
    
    // Cálculos simulados de gregas
    // TODO: Implementar Black-Scholes para cálculos reais
    const gregas = {
        delta: Math.random() * 0.5,      // 0 a 0.5 para PUT
        gamma: Math.random() * 0.05,      // Menor perto do ATM
        theta: -0.01 - Math.random() * 0.05, // Negativo (decay)
        vega: 0.1 + Math.random() * 0.2,     // Sensibilidade à volatilidade
        rho: -0.05 - Math.random() * 0.1     // Negativo para PUT
    };
    
    container.innerHTML = `
        <div class="mb-3">
            <div class="d-flex justify-content-between mb-1">
                <span>Delta</span>
                <span class="fw-bold">${gregas.delta.toFixed(3)}</span>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-primary" style="width: ${Math.abs(gregas.delta) * 100}%"></div>
            </div>
            <small class="text-muted">Sensibilidade ao preço do ativo</small>
        </div>
        
        <div class="mb-3">
            <div class="d-flex justify-content-between mb-1">
                <span>Gamma</span>
                <span class="fw-bold">${gregas.gamma.toFixed(3)}</span>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-success" style="width: ${gregas.gamma * 2000}%"></div>
            </div>
            <small class="text-muted">Taxa de mudança do Delta</small>
        </div>
        
        <div class="mb-3">
            <div class="d-flex justify-content-between mb-1">
                <span>Theta</span>
                <span class="fw-bold text-danger">${gregas.theta.toFixed(3)}</span>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-danger" style="width: ${Math.abs(gregas.theta) * 1000}%"></div>
            </div>
            <small class="text-muted">Decaimento temporal (por dia)</small>
        </div>
        
        <div class="mb-3">
            <div class="d-flex justify-content-between mb-1">
                <span>Vega</span>
                <span class="fw-bold">${gregas.vega.toFixed(3)}</span>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-info" style="width: ${gregas.vega * 333}%"></div>
            </div>
            <small class="text-muted">Sensibilidade à volatilidade</small>
        </div>
        
        <div class="mb-0">
            <div class="d-flex justify-content-between mb-1">
                <span>Rho</span>
                <span class="fw-bold">${gregas.rho.toFixed(3)}</span>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-warning" style="width: ${Math.abs(gregas.rho) * 667}%"></div>
            </div>
            <small class="text-muted">Sensibilidade à taxa de juros</small>
        </div>
    `;
}

/**
 * Popula os cenários pré-definidos na aba Simulação
 */
function populateScenarioCards(operacao) {
    const container = document.getElementById('scenarioGrid');
    if (!container) return;
    
    const strike = parseFloat(operacao.strike);
    const premioAbertura = parseFloat(operacao.premio_abertura);
    const qtd = parseInt(operacao.quantidade);
    const isVenda = operacao.tipo_operacao === 'VENDA';
    const tipo = operacao.tipo_opcao;
    
    // 4 cenários: muito baixo, abaixo strike, acima strike, muito alto
    const scenarios = [
        { label: 'Queda Forte', price: strike * 0.85, icon: '📉', color: 'danger' },
        { label: 'Abaixo Strike', price: strike * 0.95, icon: '⚠️', color: 'warning' },
        { label: 'Acima Strike', price: strike * 1.05, icon: '✅', color: 'success' },
        { label: 'Alta Forte', price: strike * 1.15, icon: '📈', color: 'success' }
    ];
    
    let html = '';
    scenarios.forEach(scenario => {
        let pnl = 0;
        if (isVenda && tipo === 'PUT') {
            if (scenario.price >= strike) {
                pnl = premioAbertura * qtd;
            } else {
                pnl = (premioAbertura * qtd) - ((strike - scenario.price) * qtd);
            }
        }
        
        const pnlClass = pnl >= 0 ? 'text-success' : 'text-danger';
        const pnlSign = pnl >= 0 ? '+' : '';
        
        html += `
            <div class="col-md-3">
                <div class="card" style="background: #1a2332; cursor: pointer;" onclick="updateSimulationPrice(${scenario.price})">
                    <div class="card-body text-center">
                        <div class="display-6 mb-2">${scenario.icon}</div>
                        <div class="fw-bold">${scenario.label}</div>
                        <div class="text-muted small">R$ ${scenario.price.toFixed(2)}</div>
                        <div class="h5 mb-0 mt-2 ${pnlClass}">${pnlSign}R$ ${Math.abs(pnl).toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Atualiza o simulador de preço quando slider é movido ou cenário clicado
 */
function updateSimulationPrice(price) {
    const slider = document.getElementById('priceSlider');
    if (slider) {
        slider.value = price;
    }
    
    // Recalcular P&L para o preço simulado
    const operacao = allOperacoes.find(op => op.id === currentDetalhesOpId);
    if (!operacao) return;
    
    const strike = parseFloat(operacao.strike);
    const premioAbertura = parseFloat(operacao.premio_abertura);
    const qtd = parseInt(operacao.quantidade);
    const isVenda = operacao.tipo_operacao === 'VENDA';
    const tipo = operacao.tipo_opcao;
    
    let pnl = 0;
    let scenario = '';
    
    if (isVenda && tipo === 'PUT') {
        if (price >= strike) {
            pnl = premioAbertura * qtd;
            scenario = 'Lucro Máximo';
        } else {
            pnl = (premioAbertura * qtd) - ((strike - price) * qtd);
            scenario = price < strike * 0.9 ? 'Prejuízo Elevado' : 'Prejuízo Moderado';
        }
    }
    
    const pnlClass = pnl >= 0 ? 'text-success' : 'text-danger';
    const pnlSign = pnl >= 0 ? '+' : '';
    
    const simulatedValue = document.getElementById('simulatedValue');
    const scenarioLabel = document.getElementById('scenarioLabel');
    
    if (simulatedValue) {
        simulatedValue.textContent = `${pnlSign}R$ ${Math.abs(pnl).toFixed(2)}`;
        simulatedValue.className = `h3 mb-0 ${pnlClass}`;
    }
    
    if (scenarioLabel) {
        scenarioLabel.textContent = scenario;
    }
}

// Event listener para o slider de simulação
document.addEventListener('DOMContentLoaded', function() {
    const priceSlider = document.getElementById('priceSlider');
    if (priceSlider) {
        priceSlider.addEventListener('input', function() {
            updateSimulationPrice(parseFloat(this.value));
        });
    }
});

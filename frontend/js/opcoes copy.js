let allOperacoes = [];
let tableMesAtual, tableHistorico;
let chartAnual = null;
let chartAccumulated = null;
let chartAssetDist = null;
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
    
    // Botão de refresh detalhes
    document.getElementById('btnRefreshDetalhes')?.addEventListener('click', refreshDetalhesOperacao);
    
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
        responsive: true,
        order: [[9, 'desc']],
        createdRow: function(row, data, dataIndex) {
            const statusHtml = data[12];
            if (statusHtml && (statusHtml.includes('FECHADA') || statusHtml.includes('EXERCIDA'))) {
                $(row).addClass('op-fechada');
            }
        }
    };
    tableMesAtual = $('#tableMesAtual').DataTable(dtConfig);
    tableHistorico = $('#tableHistorico').DataTable(dtConfig);
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
        
        updateUI();
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

function updateUI() {
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
    document.getElementById('cardSaldoCorretora').textContent = formatCurrency(saldoCorretora, 'BRL');
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
    
    // Tables
    populateTable(tableMesAtual, mesAtualData, true, true); // showActions=true, updatePrices=true
    populateTable(tableHistorico, allOperacoes, false, false); // showActions=false, updatePrices=false
    
    // Historico mensal
    renderHistoricoMensal();
    
    // Grafico anual
    renderChartAnual(anoData, currentYear);
}

function populateTable(dt, data, showActions = true, updatePrices = false) {
    dt.clear();
    data.forEach(op => {
        const diasInfo = calcularDias(op.vencimento);
        
        // REGRA: Se updatePrices=false (HISTÓRICO), usar preco_atual do BANCO
        // Se updatePrices=true (MÊS ATUAL), o preço já foi ou será atualizado pela API
        const precoAtual = op.preco_atual;
        
        // Lógica de Exercício: Calcular baseado em ITM/OTM
        // PUT ITM: preço atual < strike (posso vender por mais que vale)
        // CALL ITM: preço atual > strike (posso comprar por menos que vale)
        let exercicio = false;
        
        if (precoAtual && op.strike && op.tipo) {
            // Converter valores para numérico (suporta formato brasileiro e americano)
            const pa = parseFloatSafe(precoAtual);
            const str = parseFloatSafe(op.strike);
            
            if (op.tipo === 'PUT') {
                exercicio = (pa < str); // PUT ITM
            } else if (op.tipo === 'CALL') {
                exercicio = (pa > str); // CALL ITM
            }
        } else if (op.status === 'EXERCIDA') {
            // Se não tem dados mas status é EXERCIDA
            exercicio = true;
        }
        
        let actionsHtml = '';
        if (showActions) {
            actionsHtml = `<div class="btn-list flex-nowrap">
                <button class="btn btn-sm btn-info btn-icon" onclick="openDetalhesOperacao('${op.id}')" title="Detalhes">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </button>
                <button class="btn btn-sm btn-primary btn-icon" onclick="editOperacao('${op.id}')" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-sm btn-danger btn-icon" onclick="deleteOperacao('${op.id}')" title="Excluir">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
             </div>`;
        }

        dt.row.add([
            op.ativo_base ? `<span class="badge bg-azure text-azure-fg">${op.ativo_base}</span>` : '-',
            precoAtual && !isNaN(parseFloatSafe(precoAtual)) ? formatCurrency(parseFloatSafe(precoAtual)) : 'R$ 0,00',
            formatCurrency(parseFloatSafe(op.preco_entrada)),
            op.ativo,
            `<span class="badge ${op.tipo === 'CALL' ? 'bg-green text-green-fg' : 'bg-red text-red-fg'}">${op.tipo}</span>`,
            op.quantidade,
            formatCurrency(parseFloatSafe(op.strike)),
            formatCurrency(parseFloatSafe(op.premio)),
            `<span class="${parseFloatSafe(op.resultado) >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(parseFloatSafe(op.resultado))}</span>`,
            formatDate(op.vencimento),
            `${diasInfo.uteis} / ${diasInfo.corridos}`,
            exercicio ? '<span class="badge bg-red text-red-fg">SIM</span>' : '<span class="badge bg-green text-green-fg">NÃO</span>',
            `<span class="badge ${op.status === 'ABERTA' ? 'bg-green text-green-fg' : 'bg-default text-default-fg'}">${op.status}</span>`,
            actionsHtml
        ]);
    });
    dt.draw();
}

function calcularDias(vencimento) {
    if (!vencimento) return { uteis: '-', corridos: '-' };
    const today = new Date();
    today.setHours(0,0,0,0);
    const venc = new Date(vencimento);
    const diffTime = venc - today;
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))); 
    // Simplified business days
    const businessDays = Math.max(0, Math.floor(diffDays * 5 / 7));
    return { uteis: businessDays, corridos: diffDays };
}

function calcularExercicio(op) {
    // Retorna TRUE se a opção está ITM (In The Money) - ou seja, se PODE ser exercida
    // PUT ITM: preço atual < strike (posso vender por mais que vale)
    // CALL ITM: preço atual > strike (posso comprar por menos que vale)
    if (!op.preco_atual || !op.strike) return false;
    const pa = parseFloatSafe(op.preco_atual);
    const str = parseFloatSafe(op.strike);
    if (op.tipo === 'CALL') return pa > str;
    if (op.tipo === 'PUT') return pa < str;
    return false;
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
    const premio = parseCurrencyValue(document.getElementById('inputPremio').value);
    const res = qtd * premio;
    
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

    const data = {
        ativo_base: ativoBase,
        ativo: ativo,
        tipo: document.getElementById('inputTipo').value,
        data_operacao: document.getElementById('inputDataOperacao').value,
        quantidade: parseInt(document.getElementById('inputQuantidade').value),
        preco_entrada: parseCurrencyValue(document.getElementById('inputPrecoEntrada').value),
        strike: parseCurrencyValue(document.getElementById('inputStrike').value),
        premio: parseCurrencyValue(document.getElementById('inputPremio').value),
        resultado: parseCurrencyValue(document.getElementById('inputResultado').value),
        preco_atual: parseCurrencyValue(document.getElementById('inputPrecoAtual').value),
        vencimento: document.getElementById('inputVencimento').value,
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
    document.getElementById('inputDataOperacao').value = op.data_operacao;
    document.getElementById('inputQuantidade').value = op.quantidade;
    document.getElementById('inputPrecoEntrada').value = op.preco_entrada ? formatCurrency(parseFloatSafe(op.preco_entrada)) : '';
    document.getElementById('inputStrike').value = op.strike ? formatCurrency(parseFloatSafe(op.strike)) : '';
    document.getElementById('inputPremio').value = op.premio ? formatCurrency(parseFloatSafe(op.premio)) : '';
    document.getElementById('inputResultado').value = op.resultado ? formatCurrency(parseFloatSafe(op.resultado)) : '';
    if (document.getElementById('inputPrecoAtual')) {
        document.getElementById('inputPrecoAtual').value = op.preco_atual ? formatCurrency(parseFloatSafe(op.preco_atual)) : '';
    }
    document.getElementById('inputVencimento').value = op.vencimento;
    document.getElementById('inputStatus').value = op.status;
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

// ====================
// MODAL DE DETALHES
// ====================

async function openDetalhesOperacao(id) {
    currentDetalhesOpId = id;
    const op = allOperacoes.find(o => o.id == id);
    if (!op) return;
    
    document.getElementById('detalhesOpcaoTitle').textContent = op.ativo;
    document.getElementById('detalhesAtivoBase').textContent = op.ativo_base || '-';
    
    // Exibir prêmio do banco no cabeçalho
    document.getElementById('detalhesPremioOriginal').textContent = formatCurrency(parseFloatSafe(op.premio || 0));
    
    // Inicializar campos com loading ou valores existentes
    document.getElementById('detalhesCotacaoAtual').innerHTML = '<div class="spinner-border spinner-border-sm text-secondary" role="status"></div>';
    document.getElementById('detalhesPoP').textContent = '-';
    document.getElementById('detalhesDelta').textContent = '-';
    document.getElementById('detalhesVencimento').textContent = formatDate(op.vencimento);
    
    // Inicializar Resultado e P&L com loading - valores serão calculados após atualização
    document.getElementById('detalhesResultado').innerHTML = '<div class="spinner-border spinner-border-sm text-secondary" role="status"></div>';
    document.getElementById('detalhesPL').innerHTML = '<div class="spinner-border spinner-border-sm text-secondary" role="status"></div>';
    
    document.getElementById('detalhesUltimaAtualizacao').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Última atualização: -';
    
    const modal = new bootstrap.Modal(document.getElementById('modalDetalhesOperacao'));
    modal.show();
    
    // Atualizar status do mercado no modal
    updateModalMarketStatus('modalDetalhesMarketStatus');
    
    // Buscar dados atualizados
    await refreshDetalhesOperacao();
}

async function refreshDetalhesOperacao() {
    if (!currentDetalhesOpId) return;
    const op = allOperacoes.find(o => o.id == currentDetalhesOpId);
    if (!op) return;
    
    const btn = document.getElementById('btnRefreshDetalhes');
    if(btn) {
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Atualizando...';
        btn.disabled = true;
    }

    try {
        // 1. Fetch Spot Price
        let spotPrice = 0;
        try {
            const resSpot = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${op.ativo_base}`);
            if (resSpot.ok) {
                const dataSpot = await resSpot.json();
                spotPrice = parseFloat(dataSpot.price || dataSpot.cotacao || dataSpot.close || dataSpot.last || 0);
            }
        } catch(e) { console.error('Error fetching spot', e); }

        // 2. Fetch Option Price
        let optionPrice = 0;
        try {
            const resOp = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${op.ativo}`);
            if (resOp.ok) {
                const dataOp = await resOp.json();
                optionPrice = parseFloat(dataOp.price || dataOp.cotacao || dataOp.close || dataOp.last || 0);
            }
        } catch(e) { console.error('Error fetching option', e); }

        // Fallbacks
        if (spotPrice === 0 && op.preco_ativo_base) spotPrice = parseFloat(op.preco_ativo_base); 
        if (spotPrice === 0) spotPrice = parseFloat(op.strike); // Last resort approximation

        if (optionPrice === 0 && op.preco_atual) optionPrice = parseFloat(op.preco_atual);
        
        // Atualizar timestamp
        const now = new Date();
        const timestamp = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;
        lastUpdateTimestamp[currentDetalhesOpId] = timestamp;
        document.getElementById('detalhesUltimaAtualizacao').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Última atualização: ${timestamp}`;
        
        // Update UI
        updateDetalhesUI(op, spotPrice, optionPrice);
        
    } catch (e) {
        console.error(e);
        iziToast.error({title: 'Erro', message: 'Erro ao atualizar dados'});
    } finally {
        if(btn) {
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-refresh" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg> Atualizar`;
            btn.disabled = false;
        }
    }
}

function updateDetalhesUI(op, spotPrice, optionPrice) {
    const isCall = op.tipo === 'CALL';
    const qty = parseFloat(op.quantidade);
    const isShort = qty < 0; 

    const K = parseFloatSafe(op.strike);
    const T_days = calcularDias(op.vencimento).corridos;
    const T = Math.max(T_days / 365.0, 0.0001);
    const r = 0.1075; // Risk-free rate (approx)

    // Update Prices Display
    document.getElementById('detalhesCotacaoAtual').textContent = formatCurrency(optionPrice);
    
    // Update Ativo Base display to show price
    const ativoBaseEl = document.getElementById('detalhesAtivoBase');
    if(ativoBaseEl) {
        ativoBaseEl.innerHTML = `${op.ativo_base}<br><span class="text-muted small">${formatCurrency(spotPrice)}</span>`;
    }
    
    // Update Result and PnL - CORRIGIDO
    // Para opções, o custo base SEMPRE é o prêmio pago/recebido
    const unitEntry = parseFloat(op.premio || 0);
    const unitCurrent = optionPrice;
    
    let pnl = 0;
    let costBasis = 0;
    
    if (isShort) {
        // Short: Vendeu a opção (recebeu o prêmio)
        // Lucro se o preço atual for menor (compra mais barato para fechar)
        costBasis = unitEntry * Math.abs(qty); 
        const currentValueToClose = unitCurrent * Math.abs(qty);
        pnl = costBasis - currentValueToClose;
    } else {
        // Long: Comprou a opção (pagou o prêmio)
        // Lucro se o preço atual for maior (vende mais caro)
        costBasis = unitEntry * Math.abs(qty);
        const currentValue = unitCurrent * Math.abs(qty);
        pnl = currentValue - costBasis;
    }
    
    const pnlPercent = costBasis !== 0 ? (pnl / costBasis) * 100 : 0;
    
    const divResultado = document.getElementById('detalhesResultado');
    divResultado.textContent = formatCurrency(pnl);
    divResultado.className = `fw-bold ${pnl >= 0 ? 'text-success' : 'text-danger'}`;
    
    const divPL = document.getElementById('detalhesPL');
    divPL.textContent = `${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`;
    divPL.className = `fw-bold ${pnlPercent >= 0 ? 'text-success' : 'text-danger'}`;
    
    // Update Time
    document.getElementById('detalhesTempo').textContent = `${T_days} dias`;

    // Calcular e exibir informações financeiras (Notional, Saldo, Margem)
    const strikeValue = parseFloatSafe(op.strike);
    const quantity = Math.abs(qty);
    const notional = strikeValue * quantity;
    
    // Obter saldo da corretora
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoCorretora = parseFloat(config.saldoAcoes || 0);
    const margemDisponivel = saldoCorretora - notional;
    const utilizacaoPercent = saldoCorretora > 0 ? (notional / saldoCorretora * 100) : 0;
    
    // Atualizar elementos
    document.getElementById('detalhesNotional').textContent = formatCurrency(notional);
    document.getElementById('detalhesSaldo').textContent = formatCurrency(saldoCorretora);
    
    const margemEl = document.getElementById('detalhesMargem');
    margemEl.textContent = formatCurrency(margemDisponivel);
    margemEl.className = `h3 mb-0 ${margemDisponivel >= 0 ? 'text-success' : 'text-danger'}`;
    
    document.getElementById('detalhesUtilizacao').textContent = `${utilizacaoPercent.toFixed(1)}%`;
    
    const progressBar = document.getElementById('detalhesNotionalBar');
    progressBar.style.width = `${Math.min(utilizacaoPercent, 100)}%`;
    
    // Cor da barra baseada no P&L (mesma lógica do card)
    if (pnl > 0) {
        progressBar.className = 'progress-bar bg-success';
    } else if (pnl < 0) {
        progressBar.className = 'progress-bar bg-danger';
    } else {
        progressBar.className = 'progress-bar bg-warning';
    }
    
    // Atualizar cor da borda do card baseado na situação financeira
    const financialCard = document.querySelector('#modalDetalhesOperacao .card.border-warning');
    if (financialCard) {
        // Lógica: Verde se tudo positivo (PnL > 0, Margem > 0, Prob > 50%)
        // Vermelho se situação ruim (PnL < 0 OU Margem < 0)
        // Amarelo se neutro
        const cardStatus = financialCard.querySelector('.card-status-top');
        
        if (pnl > 0 && margemDisponivel > 0) {
            // Situação positiva
            financialCard.className = 'card mb-3 border-success';
            cardStatus.className = 'card-status-top bg-success';
        } else if (pnl < 0 || margemDisponivel < 0) {
            // Situação negativa
            financialCard.className = 'card mb-3 border-danger';
            cardStatus.className = 'card-status-top bg-danger';
        } else {
            // Situação neutra
            financialCard.className = 'card mb-3 border-warning';
            cardStatus.className = 'card-status-top bg-warning';
        }
    }

    // Greeks Calculation
    if (spotPrice > 0 && K > 0 && T > 0 && optionPrice > 0) {
        // Calculate IV based on current option price
        const sigma = calculateIV(optionPrice, spotPrice, K, T, r, op.tipo);
        const greeks = calculateGreeks(spotPrice, K, T, r, sigma, op.tipo);
        
        document.getElementById('detalhesDelta').textContent = greeks.delta.toFixed(4);
        document.getElementById('detalhesTheta').textContent = greeks.theta.toFixed(4);
        document.getElementById('detalhesGamma').textContent = greeks.gamma.toFixed(4);
        document.getElementById('detalhesVega').textContent = greeks.vega.toFixed(4);
        document.getElementById('detalhesIV').textContent = `${(sigma * 100).toFixed(2)}%`;
        
        // Break Even
        let be = 0;
        if (isCall) be = K + unitEntry;
        else be = K - unitEntry;
        
        document.getElementById('detalhesBreakEven').textContent = formatCurrency(be);
        
        // Distance to Strike
        const dist = ((spotPrice - K) / K) * 100;
        document.getElementById('detalhesDistancia').textContent = `${dist > 0 ? '+' : ''}${dist.toFixed(2)}%`;
        
        // PoP (Probability of Profit) - com correção para NaN
        const sigma_final = sigma || 0.3; // fallback
        let prob = 0;
        
        // Handle Break Even <= 0 cases or spotPrice <= 0 to avoid NaN in Math.log
        if (be <= 0.001 || spotPrice <= 0.001) {
             if (!isCall && isShort) prob = 1; // Short Put with BE <= 0 is 100% win
             else prob = 0; // Others (Long Put BE<=0 impossible to win, Call BE<=0 impossible)
        } else if (T <= 0.001) {
            // If expiration is today or past, check intrinsic value
            if (isCall) {
                prob = (spotPrice > be) ? 1 : 0;
            } else {
                prob = (spotPrice < be) ? 1 : 0;
            }
        } else {
            const d1_be = (Math.log(spotPrice / be) + (r + sigma_final * sigma_final / 2) * T) / (sigma_final * Math.sqrt(T));
            const d2_be = d1_be - sigma_final * Math.sqrt(T);
            
            // Check for NaN before using
            if (isNaN(d1_be) || isNaN(d2_be)) {
                // Fallback to simple comparison
                if (isCall) {
                    prob = (spotPrice > be) ? 0.7 : 0.3;
                } else {
                    prob = (spotPrice < be) ? 0.7 : 0.3;
                }
            } else {
                if (isCall) {
                    // Long Call: Profit if ST > BE
                    if (!isShort) prob = cdf(d2_be);
                    // Short Call: Profit if ST < BE
                    else prob = cdf(-d2_be);
                } else {
                    // Long Put: Profit if ST < BE
                    if (!isShort) prob = cdf(-d2_be);
                    // Short Put: Profit if ST > BE
                    else prob = cdf(d2_be);
                }
            }
        }
        
        // Ensure prob is valid number between 0 and 1
        if (isNaN(prob) || prob < 0) prob = 0;
        if (prob > 1) prob = 1;
        
        document.getElementById('detalhesPoP').textContent = `${(prob * 100).toFixed(1)}%`;
        
        // Recommendations & Chart
        generateRecommendation(pnlPercent, T_days, prob, isCall, isShort, spotPrice, K, be);
        renderPayoffChart(spotPrice, K, unitEntry, isCall, isShort, spotPrice, optionPrice);
    } else {
        document.getElementById('detalhesPoP').textContent = '-';
        document.getElementById('detalhesIV').textContent = '-';
    }
}

function generateRecommendation(plPct, days, pop, isCall, isShort, S, K, be) {
    const list = document.getElementById('detalhesAnaliseLista');
    if(!list) return;
    list.innerHTML = '';
    
    const addMsg = (icon, msg, type='secondary', actionTip='') => {
        const tipHtml = actionTip ? `<div class="small text-muted mt-1">${actionTip}</div>` : '';
        list.innerHTML += `
            <li class="list-group-item">
                <div class="d-flex align-items-start">
                    <span class="badge bg-${type} me-2">${icon}</span>
                    <div class="flex-grow-1">
                        <div>${msg}</div>
                        ${tipHtml}
                    </div>
                </div>
            </li>`;
    };

    // Análise de Lucro/Prejuízo
    if (plPct > 50) {
        addMsg('💰', 'Lucro acima de 50% - Excelente resultado!', 'success', 
            '✅ Ação: Considere realizar lucro parcial (50-70%) e deixar o restante correr. Proteja seu ganho.');
    } else if (plPct > 20) {
        addMsg('📈', 'Lucro entre 20-50% - Operação positiva', 'success',
            '✅ Ação: Mantenha a posição ou realize parcial. Acompanhe diariamente.');
    } else if (plPct < -50) {
        addMsg('🚨', 'ALERTA: Prejuízo acima de 50%!', 'danger',
            '❌ Ação URGENTE: Revise sua tese. Se a premissa mudou, encerre a posição. Evite viés de confirmação.');
    } else if (plPct < -20) {
        addMsg('⚠️', 'Prejuízo entre 20-50%', 'warning',
            '⚠️ Ação: Avalie se a tese se mantém. Considere stop loss. Não deixe prejuízo aumentar.');
    } else if (plPct >= -5 && plPct <= 5) {
        addMsg('➡️', 'Operação próxima do zero', 'secondary',
            'ℹ️ Aguarde: Posição neutra. Acompanhe o mercado e aguarde definição.');
    }
    
    // Análise de Tempo (Theta)
    if (days <= 3) {
        addMsg('⏰', 'VENCIMENTO IMINENTE: Menos de 3 dias!', 'danger',
            '🔥 Theta acelerado! Opção perde valor rapidamente. Decida hoje: encerrar, rolar ou aceitar exercício.');
    } else if (days < 10) {
        addMsg('⏳', 'Próximo do vencimento (< 10 dias)', 'warning',
            '📉 Theta alto: Perda de valor temporal acelerada. Monitore diariamente.');
    } else if (days > 30) {
        addMsg('📅', 'Tempo confortável (> 30 dias)', 'info',
            '✅ Theta baixo: Ainda há tempo para a tese se desenvolver.');
    }
    
    // Análise de Moneyness
    const distPercent = ((S - K) / K) * 100;
    const isITM = isCall ? S > K : S < K;
    
    if (isITM) {
        const depth = Math.abs(distPercent);
        if (depth > 10) {
            addMsg('💵', `Opção DEEP ITM (${depth.toFixed(1)}% ${isCall ? 'acima' : 'abaixo'})`, 'success',
                '✅ Alta probabilidade de exercício. Comporta-se quase como o ativo base. Delta próximo de 1.');
        } else {
            addMsg('💰', `Opção ITM (In The Money - ${depth.toFixed(1)}%)`, 'info',
                '✅ Tem valor intrínseco. Probabilidade moderada de exercício.');
        }
    } else {
        const depth = Math.abs(distPercent);
        if (depth > 10) {
            addMsg('🎲', `Opção DEEP OTM (${depth.toFixed(1)}% ${isCall ? 'abaixo' : 'acima'})`, 'warning',
                '⚠️ Baixa probabilidade de lucro. Apenas especulação. Risco alto de perda total.');
        } else {
            addMsg('📊', `Opção ATM/OTM (${depth.toFixed(1)}% do strike)`, 'secondary',
                'ℹ️ Apenas valor extrínseco. Precisa de movimento do ativo para lucrar.');
        }
    }
    
    // Análise de Probabilidade de Lucro
    if (pop > 0.7) {
        addMsg('🎯', `Probabilidade de Lucro: ${(pop*100).toFixed(1)}% - ALTA`, 'success',
            '✅ Estatisticamente favorável. Mantenha a posição se a tese se confirma.');
    } else if (pop < 0.3) {
        addMsg('⚡', `Probabilidade de Lucro: ${(pop*100).toFixed(1)}% - BAIXA`, 'danger',
            '❌ Operação com baixa chance de sucesso. Considere encerrar ou ajustar.');
    } else {
        addMsg('⚖️', `Probabilidade de Lucro: ${(pop*100).toFixed(1)}% - MODERADA`, 'info',
            'ℹ️ Probabilidade neutra. Acompanhe e gerencie ativamente.');
    }
    
    // Análise Break Even
    const distToBE = ((S - be) / be) * 100;
    const needsMove = Math.abs(distToBE);
    if (needsMove > 15) {
        addMsg('📏', `Precisa de movimento de ${needsMove.toFixed(1)}% para Break Even`, 'warning',
            `⚠️ Ativo precisa ${distToBE > 0 ? 'cair' : 'subir'} significativamente. Avalie se é realista.`);
    } else if (needsMove > 5) {
        addMsg('🎯', `Falta ${needsMove.toFixed(1)}% para Break Even`, 'info',
            'ℹ️ Movimento moderado necessário. Acompanhe as notícias do ativo.');
    } else {
        addMsg('✅', `Próximo do Break Even (${needsMove.toFixed(1)}%)`, 'success',
            '✅ Quase no ponto de equilíbrio. Pequeno movimento já traz lucro.');
    }
}

function renderPayoffChart(S, K, premium, isCall, isShort, currentS, currentPrice) {
    const ctxEl = document.getElementById('chartDetalhesPayoff');
    if(!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    
    if (chartDetalhesInstance) chartDetalhesInstance.destroy();
    
    const range = S * 0.2;
    const start = S - range;
    const end = S + range;
    const steps = 20;
    const stepSize = (end - start) / steps;
    
    const labels = [];
    const dataPayoff = [];
    
    for (let i = 0; i <= steps; i++) {
        const price = start + (i * stepSize);
        labels.push(price.toFixed(2));
        
        let intrinsic = 0;
        if (isCall) intrinsic = Math.max(0, price - K);
        else intrinsic = Math.max(0, K - price);
        
        let profit = 0;
        if (isShort) {
            profit = premium - intrinsic;
        } else {
            profit = intrinsic - premium;
        }
        dataPayoff.push(profit);
    }

    // Check theme
    const isDarkMode = document.body.getAttribute('data-bs-theme') === 'dark';
    const textColor = isDarkMode ? '#f8f9fa' : '#666666';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
    
    // Determinar cor da linha baseado no lucro/prejuízo
    // Calcular se a operação está em lucro no cenário atual
    const currentProfit = dataPayoff[Math.floor(dataPayoff.length / 2)] || 0; // Ponto central (preço atual)
    const lineColor = currentProfit >= 0 ? '#2fb344' : '#d63939'; // Verde para lucro, Vermelho para prejuízo
    
    chartDetalhesInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Payoff no Vencimento',
                data: dataPayoff,
                borderColor: lineColor,
                backgroundColor: currentProfit >= 0 ? 'rgba(47, 179, 68, 0.1)' : 'rgba(214, 57, 57, 0.1)',
                tension: 0.1,
                fill: true,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true, 
                    labels: { 
                        color: textColor,
                        font: { weight: 'bold' }
                    } 
                }
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

// Math & Finance Helpers (adicionados aqui caso não existam no global.js)
function cdf(x) {
    // Cumulative Distribution Function (Normal Distribution)
    var mean = 0.0;
    var sigma = 1.0;
    var z = (x - mean) / Math.sqrt(2 * sigma * sigma);
    var t = 1 / (1 + 0.3275911 * Math.abs(z));
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var erf = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    var sign = 1;
    if (z < 0) {
        sign = -1;
    }
    return (1 / 2) * (1 + sign * erf);
}

function calculateIV(price, S, K, T, r, type) {
    // Newton-Raphson approximation
    const MAX_ITER = 100;
    const PRECISION = 1.0e-5;
    let sigma = 0.5;
    for (let i = 0; i < MAX_ITER; i++) {
        const greeks = calculateGreeks(S, K, T, r, sigma, type);
        const diff = greeks.price - price;
        if (Math.abs(diff) < PRECISION) return sigma;
        if (greeks.vega === 0) return sigma; 
        sigma = sigma - diff / greeks.vega;
    }
    return sigma;
}

function calculateGreeks(S, K, T, r, sigma, type) {
    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const nd1 = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * d1 * d1);
    const cdf_d1 = cdf(d1);
    const cdf_d2 = cdf(d2);
    const cdf_nd1 = cdf(-d1);
    const cdf_nd2 = cdf(-d2);
    
    let delta, theta, price;
    
    if (type === 'CALL') {
        delta = cdf_d1;
        price = S * cdf_d1 - K * Math.exp(-r * T) * cdf_d2;
        theta = (- (S * sigma * nd1) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cdf_d2) / 365.0;
    } else {
        delta = cdf_d1 - 1;
        price = K * Math.exp(-r * T) * cdf_nd2 - S * cdf_nd1;
        theta = (- (S * sigma * nd1) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cdf_nd2) / 365.0;
    }
    
    const gamma = nd1 / (S * sigma * Math.sqrt(T));
    const vega = S * Math.sqrt(T) * nd1 / 100.0; // Vega is usually per 1% change
    
    return { delta, gamma, theta, vega, price };
}

// ====================
// FIM MODAL DE DETALHES
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
            const currentAtivoBase = document.getElementById('inputAtivoBase').value;
            
            // Only update Ativo Base if it's empty or if we want to force update
            if (ativoBase && !currentAtivoBase) {
                document.getElementById('inputAtivoBase').value = ativoBase;
            } else if (ativoBase) {
                 // Optional: Confirm overwrite? For now, let's just update it as user requested "must be filled"
                 document.getElementById('inputAtivoBase').value = ativoBase;
            }

            document.getElementById('inputTipo').value = opcao.tipo || opcao.type || 'CALL';
            
            const strikeVal = parseFloat(opcao.strike || opcao.strike_price || 0);
            document.getElementById('inputStrike').value = strikeVal ? formatCurrency(strikeVal) : '';
            
            const premioVal = parseFloat(opcao.premio || opcao.price || 0);
            document.getElementById('inputPremio').value = premioVal ? formatCurrency(premioVal) : '';
            
            // Handle Vencimento Date Format
            let venc = opcao.vencimento || opcao.expiration || '';
            if (venc) {
                // Try to handle ISO string or YYYY-MM-DD
                if (venc.includes('T')) venc = venc.split('T')[0];
                document.getElementById('inputVencimento').value = venc;
            }
            
            // Update Quote
            let quote = 0;
            if (data.spot_price) quote = parseFloat(data.spot_price);
            else if (opcao.preco_ativo_base) quote = parseFloat(opcao.preco_ativo_base);
            else if (opcao.underlying_price) quote = parseFloat(opcao.underlying_price);
            
            if (quote) {
                cotacaoAtivoBase = quote;
                const formatted = formatCurrency(quote);
                const displayAtivo = ativoBase || 'ATIVO';
                
                // Update Title only if it's a new operation (not editing) - actually user wants update in edit too
                // But modal title is "Editar Operação" or "Nova Operação".
                // Let's just update the price info if possible or leave title alone to avoid overwriting "Editar..." text incorrectly.
                // The original code updated title. Let's be careful.
                // If we are in "Nova Operação", title is "Nova Operação".
                // If we are in "Editar", title is "Editar Operação".
                // Maybe just update a subtitle or similar?
                // The original code overwrote the title. Let's stick to updating inputPrecoAtual.
                
                document.getElementById('inputPrecoAtual').value = formatted;
            }
            
            iziToast.success({title: 'Sucesso', message: 'Dados atualizados'});
            
            // Trigger calc
            calcularResultado();
        } else {
             iziToast.warning({title: 'Aviso', message: 'Opção não encontrada'});
        }
    } catch (error) {
        console.error(error);
        iziToast.error({title: 'Erro', message: 'Erro ao buscar dados da opção'});
    } finally {
        if (btn) {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    }
}


function refreshQuotes() {
    loadOperacoes();
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
                 const T = diasCall.corridos / 365.0;
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
                 const T = diasPut.corridos / 365.0;
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
    document.getElementById('inputPremio').value = formatCurrency(parseFloatSafe(op.premio));
    
    // CORREÇÃO: preco_atual deve ser o prêmio no momento da criação da operação
    // Quando buscar do OpLab, usar op.preco_atual (preço do mercado)
    // Se não tiver, usar o próprio prêmio (que é o preço atual no momento da compra)
    const precoAtualOpcao = op.preco_atual || op.premio;
    document.getElementById('inputPrecoAtual').value = formatCurrency(parseFloatSafe(precoAtualOpcao));
    
    // Preencher Preço de Entrada com a cotação do ativo base (spot price)
    // Se spot_price existir, usar ele; senão usar premio como fallback
    const precoEntrada = op.spot_price || cotacaoAtivoBase || op.premio;
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
            labels: months,
            datasets: [{
                label: 'Resultado Mensal',
                data: monthlyData,
                backgroundColor: monthlyData.map(v => v >= 0 ? '#2fb344' : '#d63939')
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
    renderAdditionalCharts(data, monthlyData, months, isDarkMode, textColor, gridColor);
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
    
    // Secondary Charts Row
    // Accumulated
    const accChartCard = document.createElement('div');
    accChartCard.className = 'col-md-6 mb-3';
    accChartCard.innerHTML = `
        <div class="card">
            <div class="card-header"><h3 class="card-title">Evolução Acumulada</h3></div>
            <div class="card-body">
                 <div class="chart-container" style="position: relative; height: 250px;">
                    <canvas id="chartAccumulated"></canvas>
                </div>
            </div>
        </div>
    `;
    chartsContainer.appendChild(accChartCard);
    
    // Asset Dist
    const assetChartCard = document.createElement('div');
    assetChartCard.className = 'col-md-6 mb-3';
    assetChartCard.innerHTML = `
        <div class="card">
            <div class="card-header"><h3 class="card-title">Resultado por Ativo Base</h3></div>
            <div class="card-body">
                 <div class="chart-container" style="position: relative; height: 250px;">
                    <canvas id="chartAssetDist"></canvas>
                </div>
            </div>
        </div>
    `;
    chartsContainer.appendChild(assetChartCard);
    
    wrapper.appendChild(chartsContainer);
    
    // Inject Wrapper before Canvas
    parent.insertBefore(wrapper, canvas);
    
    // Move Canvas into Main Card
    const newCanvasContainer = mainChartCard.querySelector('.chart-container');
    newCanvasContainer.appendChild(canvas);
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
    // 1. Accumulated Profit (Line Chart)
    if (chartAccumulated) chartAccumulated.destroy();
    const ctxAcc = document.getElementById('chartAccumulated');
    
    if (ctxAcc) {
        let acc = 0;
        const accData = monthlyData.map(val => {
            acc += val;
            return acc;
        });
        
        chartAccumulated = new Chart(ctxAcc.getContext('2d'), {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Acumulado',
                    data: accData,
                    borderColor: '#4299e1',
                    backgroundColor: 'rgba(66, 153, 225, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: gridColor }, ticks: { color: textColor } },
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
    const modal = new bootstrap.Modal(document.getElementById('modalSimulacao'));
    modal.show();
    
    // Atualizar status do mercado no modal
    updateModalMarketStatus('modalSimulacaoMarketStatus');
    
    // Foco automático no campo ativo base
    setTimeout(() => {
        document.getElementById('simAtivoBase').focus();
    }, 500);
    
    // Reset state if needed
    if (!simSelectedOption) {
        document.getElementById('simDetailPanel').style.display = 'none';
        document.getElementById('simEmptyState').style.display = 'flex';
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

    document.getElementById('simLoading').style.display = 'block';
    const tbody = document.getElementById('simListaOpcoes');
    tbody.innerHTML = '';
    document.getElementById('btnAplicarSimulacao').disabled = true;

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
                opt.textContent = new Date(venc + 'T00:00:00').toLocaleDateString('pt-BR');
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
            // Apply style to TR and force all TD children to inherit or match
            tr.setAttribute('style', 'background-color: #ffffff !important; color: #000000 !important; font-weight: bold; --bs-table-accent-bg: #ffffff !important; cursor: pointer !important;');
            tr.className = 'table-light fw-bold text-dark'; // Bootstrap classes as backup
            tr.id = 'simAtmRow'; // Mark for scrolling
        }

        // Calculate Greeks if missing
        let deltaVal = parseFloat(op.delta || (op.greeks && op.greeks.delta) || 0);
        let ivVal = parseFloat(op.implied_volatility || (op.greeks && op.greeks.implied_volatility) || 0);
        
        // If Delta is 0 and we have price, try to calculate
        if (Math.abs(deltaVal) < 0.001 && cotacaoAtivoBase > 0 && op.premio > 0) {
            const dias = calcularDias(op.vencimento);
            const T = dias.corridos / 365.0;
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
            const T = Math.max(dias.corridos / 365.0, 0.0001);
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
            <td ${isATM ? 'style="color: #000 !important;"' : ''}>${op.ativo}</td>
            <td ${isATM ? 'style="color: #000 !important;"' : ''}>${strikeVal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
            <td ${isATM ? 'style="color: #000 !important;"' : ''}>${parseFloat(op.premio || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
            <td ${isATM ? 'style="color: #000 !important;"' : ''}>
                ${deltaVal.toFixed(2)}
                <span style="cursor: pointer; margin-left: 5px;" onclick="event.stopPropagation(); mostrarDetalhesOpcao('${op.ativo}')">📋</span>
            </td>
            <td ${isATM ? 'style="color: #000 !important;"' : ''}>${popPercent}</td>
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

// --- Black-Scholes Implementation ---

// Standard Normal cumulative distribution function
function cdf(x) {
    var a1 =  0.254829592;
    var a2 = -0.284496736;
    var a3 =  1.421413741;
    var a4 = -1.453152027;
    var a5 =  1.061405429;
    var p  =  0.3275911;

    var sign = 1;
    if (x < 0)
        sign = -1;
    x = Math.abs(x)/Math.sqrt(2.0);

    var t = 1.0/(1.0 + p*x);
    var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);

    return 0.5*(1.0 + sign*y);
}

// Standard Normal probability density function
function pdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Black-Scholes Formula
function bsPrice(S, K, T, r, v, type) {
    if (T <= 0) return type === 'CALL' ? Math.max(0, S - K) : Math.max(0, K - S);
    var d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
    var d2 = d1 - v * Math.sqrt(T);
    if (type === 'CALL') {
        return S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
    } else {
        return K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
    }
}

// Implied Volatility (Newton-Raphson)
function calculateIV(price, S, K, T, r, type) {
    var v = 0.3; // Initial guess
    for (var i = 0; i < 20; i++) {
        var p = bsPrice(S, K, T, r, v, type);
        var d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
        var vega = S * Math.sqrt(T) * pdf(d1);
        var diff = price - p;
        if (Math.abs(diff) < 0.0001) return v;
        if (Math.abs(vega) < 0.00001) break; // Vega too small, unstable
        v = v + diff / vega;
        if (v <= 0) v = 0.01; // Avoid negative vol
    }
    return v;
}

// Calculate Greeks
function calculateGreeks(S, K, T, r, v, type) {
    if (T <= 0) T = 0.0001; // Avoid division by zero
    var d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
    var d2 = d1 - v * Math.sqrt(T);
    
    var delta, gamma, theta, vega;
    
    var nd1 = pdf(d1);
    
    if (type === 'CALL') {
        delta = cdf(d1);
        theta = (- (S * nd1 * v) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cdf(d2)) / 365;
    } else {
        delta = cdf(d1) - 1;
        theta = (- (S * nd1 * v) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cdf(-d2)) / 365;
    }
    
    gamma = nd1 / (S * v * Math.sqrt(T));
    vega = S * Math.sqrt(T) * nd1 / 100; // Divided by 100 for percentage change
    
    return { delta, gamma, theta, vega, implied_volatility: v };
}

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
    document.getElementById('simOpcaoPremio').textContent = formatCurrency(parseFloatSafe(op.premio));
    
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
    const T_calc = diasRestantes / 365.0;
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
    const T = Math.max(diasRestantes / 365.0, 0.0001);
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
        document.getElementById('inputPremio').value = formatCurrency(parseFloatSafe(simSelectedOption.premio));
        document.getElementById('inputVencimento').value = simSelectedOption.vencimento;
        
        // Preencher Preço de Entrada e Cotação Atual
        document.getElementById('inputPrecoEntrada').value = formatCurrency(parseFloatSafe(simSelectedOption.premio));
        
        // Cotação Atual: usar cotação do ativo base ou preco_atual da opção
        const cotacaoAtual = cotacaoAtivoBase || parseFloat(simSelectedOption.preco_atual || 0) || parseFloat(simSelectedOption.preco_ativo_base || 0);
        document.getElementById('inputPrecoAtual').value = formatCurrency(cotacaoAtual);
        
        // Trigger calculations
        document.getElementById('inputQuantidade').dispatchEvent(new Event('change'));
        // Trigger blur to fetch details if needed, or just calculate result
        const qtd = parseInt(document.getElementById('simQuantidade').value);
        const premio = parseFloat(simSelectedOption.premio);
        document.getElementById('inputResultado').value = formatCurrency(qtd * premio);
        
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

    const modal = new bootstrap.Modal(document.getElementById('modalAnaliseTecnica'));
    modal.show();

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
    
    if (isOpen) {
        element.textContent = '🟢';
        element.title = 'Mercado Aberto';
    } else {
        element.textContent = '🔴';
        element.title = 'Mercado Fechado';
    }
    
    // Inicializar tooltip do Bootstrap
    new bootstrap.Tooltip(element);
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

// Detalhe de Opções - JavaScript (baseado em z.html)

let currentDetalheOpId = null;
let detalheCharts = {
    performance: null,
    payoffBar: null,
    payoffFull: null,
    volatility: null,
    historico: null
};
let detalheRequestSeq = 0;
let activeDetalheRequestId = 0;

// Configuração do Chart.js - aguardar carregamento da biblioteca
let chartOptions = {};

function formatCurrencyBR(value) {
    const numberValue = Number(value) || 0;
    return `R$ ${numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumberBR(value) {
    const numberValue = Number(value) || 0;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcOptionPayoff(strike, premio, qtdAbs, isVenda, tipo, price) {
    const isCall = tipo === 'CALL';
    const intrinsic = isCall ? Math.max(0, price - strike) : Math.max(0, strike - price);
    const payoffLong = (intrinsic - premio) * qtdAbs;
    return isVenda ? -payoffLong : payoffLong;
}

function normalizeSigma(value) {
    let sigma = Number.parseFloat(value);
    if (!Number.isFinite(sigma) || sigma <= 0) return null;
    if (sigma > 3) sigma = sigma / 100;
    if (sigma > 1.5) sigma = sigma / 100;
    return sigma;
}
function calcularDiasUteisRestantes(dataVencimento) {
    if (!dataVencimento) return 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = parseDateInput(dataVencimento);
    if (!vencimento || Number.isNaN(vencimento.getTime())) return 0;
    vencimento.setHours(0, 0, 0, 0);
    if (vencimento <= hoje) return 0;
    let diasUteis = 0;
    const cursor = new Date(hoje);
    cursor.setDate(cursor.getDate() + 1);
    while (cursor <= vencimento) {
        const diaSemana = cursor.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) {
            diasUteis += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return diasUteis;
}

function initializeChartDefaults() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não está carregado ainda. Aguardando...');
        return false;
    }
    
    // Chart.js Dark Theme Configuration
    Chart.defaults.color = '#a0aec0';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
    Chart.defaults.font.family = 'inherit';

    chartOptions = {
        plugins: {
            legend: {
                labels: {
                    color: '#f5f7fb'
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255,255,255,0.05)'
                },
                ticks: {
                    color: '#a0aec0'
                }
            },
            y: {
                grid: {
                    color: 'rgba(255,255,255,0.05)'
                },
                ticks: {
                    color: '#a0aec0'
                }
            }
        }
    };
    
    return true;
}

// Aguardar carregamento das bibliotecas
if (typeof Chart !== 'undefined') {
    initializeChartDefaults();
} else {
    document.addEventListener('libsLoaded', function() {
        initializeChartDefaults();
    });
}

/**
 * Mostra loading em um elemento
 */
function showLoading(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        const originalContent = el.innerHTML;
        el.dataset.originalContent = originalContent;
        el.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';
        el.classList.add('text-center');
    }
}

function showLoadingAllValues() {
    const modal = document.getElementById('modalDetalheOpcao');
    if (!modal) return;
    const elements = modal.querySelectorAll('[id^="det"]');
    elements.forEach(el => {
        if (el.matches('input, select, textarea, canvas, svg, path, button, option')) return;
        if (el.closest('svg')) return;
        if (el.classList.contains('tab-pane') || el.classList.contains('tab-content')) return;
        if (el.children && el.children.length > 0) return;
        if (!el.id) return;
        showLoading(el.id);
    });
}

function clearLoadingAllValues() {
    const modal = document.getElementById('modalDetalheOpcao');
    if (!modal) return;
    const elements = modal.querySelectorAll('[data-original-content]');
    elements.forEach(el => {
        if (el.querySelector('.spinner-border')) {
            el.innerHTML = el.dataset.originalContent || '';
        }
        el.classList.remove('text-center');
        delete el.dataset.originalContent;
    });
}

/**
 * Remove loading de um elemento
 */
function hideLoading(elementId) {
    const el = document.getElementById(elementId);
    if (el && el.dataset.originalContent) {
        el.classList.remove('text-center');
        delete el.dataset.originalContent;
    }
}

/**
 * Mostra loading nos cards principais
 */
function showCardLoading() {
    // Stat cards
    const statCards = ['detPremioRecebido', 'detLucroMTM', 'detDistanciaStrike', 'detDiasVencimento'];
    statCards.forEach(id => showLoading(id));
    
    // Cotações
    showLoading('detPrecoAtivo');
    showLoading('detPrecoOpcao');
    showLoading('detVarAtivo');
    showLoading('detVarOpcao');
    
    // Resultado
    showLoading('detResultFechamento');
    showLoading('detResultMTM');
    
    // Prêmio
    showLoading('detPremioRecebidoCard');
    showLoading('detCustoRecompra');
    showLoading('detResultLiquido');
    showLoading('detROIAtual');
}

/**
 * Abre o modal de detalhes da operação
 * @param {string|number} id - ID da operação
 */
async function openDetalheOperacao(id) {
    currentDetalheOpId = id;
    activeDetalheRequestId = ++detalheRequestSeq;
    
    // Buscar dados da operação
    const operacao = allOperacoes.find(op => op.id == id);
    if (!operacao) {
        iziToast.error({
            title: 'Erro',
            message: 'Operação não encontrada'
        });
        return;
    }
    
    // Mostrar modal
    const modalEl = document.getElementById('modalDetalheOpcao');
    if (!modalEl) {
        console.error('Modal não encontrado');
        return;
    }
    
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    
    // Mostrar loading nos cards
    showCardLoading();
    
    // Popular dados iniciais
    populateDetalheModal(operacao);
    
    // Badge de dados locais removido - API de cotações já implementada
    // const badgeDataSource = document.getElementById('detBadgeDataSource');
    // if (badgeDataSource) {
    //     badgeDataSource.classList.remove('d-none');
    // }
    
    // Adicionar event listeners
    setupEventListeners();
    
    // Buscar dados atualizados da API e renderizar gráficos
    await refreshDetalheOperacao(activeDetalheRequestId);
}

/**
 * Configura os event listeners
 */
function setupEventListeners() {
    // Botão de refresh
    const btnRefresh = document.getElementById('btnDetalheRefresh');
    if (btnRefresh) {
        // Remover listener antigo se existir
        btnRefresh.replaceWith(btnRefresh.cloneNode(true));
        const newBtn = document.getElementById('btnDetalheRefresh');
        newBtn.addEventListener('click', () => refreshDetalheOperacao());
    }
    
    // Listener para tabs - re-renderizar gráficos quando tab é mostrada
    const tabLinks = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabLinks.forEach(link => {
        link.addEventListener('shown.bs.tab', function(e) {
            const targetId = e.target.getAttribute('href');
            
            // Se a tab de simulação foi mostrada, re-renderizar o gráfico payoff
            if (targetId === '#detab-simulacao' && currentDetalheOpId) {
                const op = allOperacoes.find(o => o.id == currentDetalheOpId);
                if (op) {
                    // Pequeno delay para garantir que o canvas está visível
                    setTimeout(() => {
                        renderDetalhePayoffFullChart(op);
                    }, 100);
                }
            }
            
            // Se a tab de gráficos foi mostrada, re-renderizar todos
            if (targetId === '#detab-graficos' && currentDetalheOpId) {
                const op = allOperacoes.find(o => o.id == currentDetalheOpId);
                if (op) {
                    setTimeout(() => {
                        renderDetalheVolatilityChart(op);
                        // Preço do ativo base - NÃO usar preco_entrada que é o prêmio!
                        const spotPrice = Number.parseFloat(op.preco_ativo_base || op.strike);
                        renderDetalheHistoricoChart(op, spotPrice);
                    }, 100);
                }
            }
        });
    });
    
    // Slider de simulação
    const priceSlider = document.getElementById('detPriceSlider');
    if (priceSlider) {
        priceSlider.addEventListener('input', function() {
            const price = Number.parseFloat(this.value);
            const elDisplay = document.getElementById('detSimulatedPriceDisplay');
            if (elDisplay) {
                elDisplay.textContent = formatCurrencyBR(price);
            }
            
            // Atualizar simulação com novo preço
            if (currentDetalheOpId) {
                const op = allOperacoes.find(o => o.id == currentDetalheOpId);
                if (op) {
                    updateSimulation(op, price);
                }
            }
        });
    }
}

/**
 * Popula o modal com dados da operação
 * @param {object} op - Dados da operação
 */
function populateDetalheModal(op) {
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    
    const setHTML = (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    };
    
    // Header
    setText('detTicker', op.ativo);
    
    // Usar tipo_operacao do banco se disponível, senão inferir da quantidade
    const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && Number.parseInt(op.quantidade) < 0);
    const badgeSide = document.getElementById('detBadgeSide');
    if (badgeSide) {
        badgeSide.textContent = isVenda ? 'VENDA' : 'COMPRA';
        badgeSide.className = isVenda ? 'badge bg-red text-red-fg ms-2' : 'badge bg-green text-green-fg ms-2';
    }
    setText('detTipoOperacao', isVenda ? 'VENDA' : 'COMPRA');
    
    // Status do exercício
    const strike = Number.parseFloat(op.strike);
    // Preço do ativo base - usar preco_atual (preço do ativo base, não o prêmio!)
    const spotPrice = Number.parseFloat(op.preco_atual || op.preco_ativo_base || op.strike || strike);
    const tipoOpcao = String(op.tipo || 'CALL').toUpperCase();
    const statusOperacao = String(op.status || 'ABERTA').toUpperCase();
    
    // Badge de tipo de opção
    const badgeType = document.getElementById('detBadgeType');
    if (badgeType) {
        badgeType.textContent = tipoOpcao;
        badgeType.className = tipoOpcao === 'PUT' ? 'badge bg-yellow text-yellow-fg ms-1' : 'badge bg-cyan text-cyan-fg ms-1';
    }
    setText('detTipoOpcao', tipoOpcao);
    
    // Usar função global para calcular exercício
    const exercida = calcularExercicio(tipoOpcao, spotPrice, strike);
    
    // Atualizar badge de exercício usando função global
    const badgeExercicio = document.getElementById('detBadgeExercicio');
    if (badgeExercicio) {
        const badgeHTML = gerarBadgeExercicio(exercida, statusOperacao);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = badgeHTML;
        const newBadge = tempDiv.firstElementChild;
        badgeExercicio.textContent = newBadge.textContent;
        badgeExercicio.className = newBadge.className;
    }
    
    // Dias para vencimento
    const diasVenc = calcularDiasUteisRestantes(op.vencimento);
    const badgeVencimento = document.getElementById('detBadgeVencimento');
    if (badgeVencimento) {
        badgeVencimento.textContent = `${diasVenc} ${diasVenc === 1 ? 'dia útil' : 'dias úteis'}`;
        badgeVencimento.className = diasVenc <= 1 ? 'badge bg-red text-red-fg badge-pulse ms-1' : 'badge bg-blue text-blue-fg badge-pulse ms-1';
    }
    setText('detDiasVencimento', `${diasVenc} ${diasVenc === 1 ? 'dia útil' : 'dias úteis'}`);
    setText('detDiasVencimentoRisco', `${diasVenc} dia${diasVenc !== 1 ? 's' : ''} útil${diasVenc !== 1 ? 's' : ''}`);
    
    // Informações básicas
    setText('detVencimento', formatDate(op.vencimento));
    setText('detVencimentoInfo', formatDate(op.vencimento));
    setText('detStrike', formatCurrencyBR(strike));
    setText('detStrikeCard', formatCurrencyBR(strike));
    setText('detStrikeInfo', formatCurrencyBR(strike));
    setText('detStrikeSimLabel', formatCurrencyBR(strike));
    setText('detStrikeRisco', formatNumberBR(strike));
    setText('detStrikeNeutro', formatNumberBR(strike * 0.99));
    setText('detStrikeNeutro2', formatNumberBR(strike));
    
    const premioUnitario = Math.abs(Number.parseFloat(op.premio || op.preco_entrada || 0));
    setText('detPremio', formatCurrencyBR(premioUnitario));
    
    const qtdAbs = Math.abs(Number.parseInt(op.quantidade));
    setText('detQuantidade', `${qtdAbs} contratos`);
    setText('detQtdAbertura', `${qtdAbs} contratos`);
    
    const ativoBase = op.ativo_base || op.ativo.substring(0, 5);
    // Atualizar todos os lugares onde aparece o ativo base
    ['detAtivoBase1', 'detAtivoBase2', 'detAtivoBase3', 'detAtivoBase5', 
     'detAtivoBaseComp', 'detAtivoRisco1', 'detAtivoRisco2', 'detAtivoRisco3',
     'detAtivoRisco4', 'detAtivoRisco5'].forEach(id => {
        setText(id, ativoBase);
    });
    
    setText('detOpcao1', op.ativo);
    
    // Preço do ativo base - NÃO usar preco_entrada que é o prêmio!
    const precoAtivo = Number.parseFloat(op.preco_ativo_base || op.strike || strike);
    setText('detPrecoAtivo', formatCurrencyBR(precoAtivo));
    setText('detPrecoAtivoAbertura', formatCurrencyBR(precoAtivo));
    setText('detPrecoAtivoAtual', formatCurrencyBR(precoAtivo));
    setText('detPrecoAberturaComp', formatCurrencyBR(precoAtivo));
    setText('detPrecoAtualComp', formatCurrencyBR(precoAtivo));
    
    // Prêmio unitário
    setText('detPremioUnitAbertura', formatCurrencyBR(premioUnitario));
    setText('detPremioUnitAtual', formatCurrencyBR(premioUnitario));
    setText('detPremioAberturaComp', formatCurrencyBR(premioUnitario));
    setText('detPremioAtualComp', formatCurrencyBR(premioUnitario));
    
    // Data da abertura
    setText('detDataAbertura', formatDate(op.data_operacao));
    
    // Saldos
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoAtual = Number.parseFloat(config.saldoAcoes || 0);
    const premioTotal = premioUnitario * qtdAbs;
    setText('detSaldoAtual', formatCurrencyBR(saldoAtual));
    setText('detSaldoProj', formatCurrencyBR(saldoAtual + premioTotal));
    
    // Configurar slider
    const priceSlider = document.getElementById('detPriceSlider');
    if (priceSlider) {
        const minPrice = (strike * 0.9).toFixed(2);
        const maxPrice = (strike * 1.1).toFixed(2);
        const midPrice = ((Number.parseFloat(minPrice) + Number.parseFloat(maxPrice)) / 2).toFixed(2);
        
        priceSlider.min = minPrice;
        priceSlider.max = maxPrice;
        priceSlider.value = precoAtivo.toFixed(2);
        
        setText('detMinPrice', formatCurrencyBR(minPrice));
        setText('detMidPrice', formatCurrencyBR(midPrice));
        setText('detMaxPrice', formatCurrencyBR(maxPrice));
        setText('detSimulatedPriceDisplay', formatCurrencyBR(precoAtivo));
    }
    
    // Configurar cenários de preço
    const scenarios = [
        { id: 'detPriceScen1', multiplier: 0.95 },
        { id: 'detPriceScen2', multiplier: 0.96 },
        { id: 'detPriceScen3', multiplier: 0.99 },
        { id: 'detPriceScen4', multiplier: 1.00 }
    ];
    
    scenarios.forEach((scen, index) => {
        const price = (strike * scen.multiplier).toFixed(2);
        const el = document.getElementById(scen.id);
        if (el) {
            if (index === 3) {
                el.textContent = `${ativoBase} ≥ R$ ${price}`;
            } else {
                el.textContent = `${ativoBase} @ R$ ${price}`;
            }
        }
    });
    
    // Configurar preço pessimista
    setText('detPrecoPessimista', formatNumberBR(strike * 0.99));
}

/**
 * Atualiza dados do modal com informações da API
 */
async function refreshDetalheOperacao(requestId = null) {
    if (requestId && typeof requestId === 'object') {
        requestId = null;
    }
    if (!requestId || typeof requestId !== 'number') {
        requestId = ++detalheRequestSeq;
    }
    activeDetalheRequestId = requestId;
    if (!currentDetalheOpId) return;
    
    const operacao = allOperacoes.find(op => op.id == currentDetalheOpId);
    if (!operacao) return;
    
    const btn = document.getElementById('btnDetalheRefresh');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    }
    showLoadingAllValues();
    
    try {
        // Verificar se a opção está vencida
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const vencimento = parseDateInput(operacao.vencimento);
        let opcaoVencida = false;
        if (vencimento && !Number.isNaN(vencimento.getTime())) {
            vencimento.setHours(0, 0, 0, 0);
            opcaoVencida = vencimento < hoje;
        }
        
        let spotPrice = 0;
        let optionPrice = 0;
        let apiError = false;
        let apiAvailable = true;
        let usandoDadosBanco = false;
        
        // Se a opção está vencida, buscar direto do banco
        const cacheBust = Date.now();

        if (opcaoVencida) {
            console.log('Opção vencida, buscando dados do banco...');
            try {
                const resBanco = await fetch(`${API_BASE}/api/opcoes/${currentDetalheOpId}?_=${cacheBust}`, { cache: 'no-store' });
                if (resBanco.ok) {
                    const dadosBanco = await resBanco.json();
                    spotPrice = Number.parseFloat(dadosBanco.preco_atual || dadosBanco.spot_price || dadosBanco.preco_entrada || dadosBanco.strike || 0);
                    optionPrice = Number.parseFloat(dadosBanco.preco_atual || dadosBanco.premio || dadosBanco.preco_entrada || 0);
                    usandoDadosBanco = true;
                    apiError = true; // Marca como erro para exibir badge de dados locais
                }
            } catch(e) {
                console.warn('Erro ao buscar dados do banco:', e.message);
            }
        }
        
        // Se não está vencida ou não conseguiu do banco, tentar API
        if (!usandoDadosBanco) {
            try {
                const ativoBase = operacao.ativo_base || operacao.ativo.substring(0, 5);
                const resSpot = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${ativoBase}&_=${cacheBust}`, { cache: 'no-store' });
                if (resSpot.ok) {
                    const dataSpot = await resSpot.json();
                    spotPrice = Number.parseFloat(dataSpot.price || dataSpot.cotacao || dataSpot.close || dataSpot.last || 0);
                } else if (resSpot.status === 404) {
                    apiAvailable = false;
                    apiError = true;
                }
            } catch(e) {
                console.warn('API de cotações indisponível:', e.message);
                apiError = true;
                apiAvailable = false;
            }
            
            try {
                const resOp = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${operacao.ativo}&_=${cacheBust}`, { cache: 'no-store' });
                if (resOp.ok) {
                    const dataOp = await resOp.json();
                    optionPrice = Number.parseFloat(dataOp.price || dataOp.cotacao || dataOp.close || dataOp.last || 0);
                } else if (resOp.status === 404) {
                    apiAvailable = false;
                    apiError = true;
                }
            } catch(e) {
                console.warn('API de cotações indisponível:', e.message);
                apiError = true;
                apiAvailable = false;
            }
            
            // Se API falhou (404 ou erro), buscar do banco como fallback
            if (apiError && !usandoDadosBanco) {
                console.log('API falhou, buscando dados do banco como fallback...');
                try {
                    const resBanco = await fetch(`${API_BASE}/api/opcoes/${currentDetalheOpId}?_=${cacheBust}`, { cache: 'no-store' });
                    if (resBanco.ok) {
                        const dadosBanco = await resBanco.json();
                        if (spotPrice === 0) {
                            spotPrice = Number.parseFloat(dadosBanco.preco_atual || dadosBanco.spot_price || dadosBanco.preco_entrada || dadosBanco.strike || 0);
                        }
                        if (optionPrice === 0) {
                            optionPrice = Number.parseFloat(dadosBanco.preco_atual || dadosBanco.premio || dadosBanco.preco_entrada || 0);
                        }
                        usandoDadosBanco = true;
                    }
                } catch(e) {
                    console.warn('Erro ao buscar dados do banco:', e.message);
                }
            }
        }
        
        // Fallbacks - usar dados da operação
        if (spotPrice === 0 && operacao.spot_price) {
            spotPrice = Number.parseFloat(operacao.spot_price);
        }
        if (spotPrice === 0 && operacao.preco_entrada) {
            spotPrice = Number.parseFloat(operacao.preco_entrada);
        }
        if (spotPrice === 0) {
            spotPrice = Number.parseFloat(operacao.strike);
        }
        
        if (optionPrice === 0 && operacao.preco_atual) {
            optionPrice = Number.parseFloat(operacao.preco_atual);
        }
        if (optionPrice === 0 && operacao.premio) {
            optionPrice = Number.parseFloat(operacao.premio);
        }
        if (optionPrice === 0 && operacao.preco_entrada) {
            optionPrice = Number.parseFloat(operacao.preco_entrada);
        }
        
        if (requestId !== activeDetalheRequestId) return;

        // Atualizar UI com dados ao vivo
        updateDetalheUI(operacao, spotPrice, optionPrice);
        
        // Re-renderizar gráficos com dados atualizados
        renderDetalheCharts(operacao, spotPrice, optionPrice);
        
        // Atualizar timestamp
        const now = new Date();
        const timestamp = `Hoje, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        const elTimestamp = document.getElementById('detUltimaAtualizacao');
        if (elTimestamp) {
            elTimestamp.textContent = timestamp;
        }
        
        // Badge de dados locais e toast removidos - API de cotações já implementada
        // const badgeDataSource = document.getElementById('detBadgeDataSource');
        // if (badgeDataSource) {
        //     if (apiError) {
        //         badgeDataSource.classList.remove('d-none');
        //     } else {
        //         badgeDataSource.classList.add('d-none');
        //     }
        // }
        
        // if (apiError) {
        //     iziToast.info({
        //         title: 'Dados Locais',
        //         message: 'API de cotações em tempo real ainda não implementada. Usando dados da abertura da operação.',
        //         position: 'topRight',
        //         timeout: 4000,
        //         icon: 'ti ti-database'
        //     });
        // }
        // Removido toast de sucesso - já tem loading indicator
        
    } catch(e) {
        console.error('Erro ao atualizar dados:', e);
        iziToast.error({
            title: 'Erro',
            message: 'Erro ao atualizar dados: ' + e.message,
            position: 'topRight'
        });
    } finally {
        if (requestId === activeDetalheRequestId) {
            clearLoadingAllValues();
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>';
            }
        }
    }
}

/**
 * Atualiza a UI com dados calculados
 * @param {object} op - Operação
 * @param {number} spotPrice - Preço do ativo
 * @param {number} optionPrice - Preço da opção
 */
function updateDetalheUI(op, spotPrice, optionPrice) {
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    
    const setHTML = (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    };
    
    const strike = Number.parseFloat(op.strike);
    const premioAbertura = Math.abs(Number.parseFloat(op.premio || op.preco_entrada || 0));
    // Preço do ativo base na abertura - NÃO usar preco_entrada que é o prêmio!
    // Se não tiver preco_ativo_base, usar o strike como aproximação inicial
    const precoAbertura = Number.parseFloat(op.preco_ativo_base || op.strike || strike);
    const qtd = Number.parseInt(op.quantidade);
    const qtdAbs = Math.abs(qtd);
    const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && qtd < 0);
    const tipo = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
    const statusOperacao = String(op.status || 'ABERTA').toUpperCase();
    
    // Calcular variações
    const varAtivo = precoAbertura > 0 ? ((spotPrice - precoAbertura) / precoAbertura * 100) : 0;
    const varOpcao = premioAbertura > 0 ? ((optionPrice - premioAbertura) / premioAbertura * 100) : 0;
    
    // Calcular distância do strike
    const distancia = spotPrice > 0 ? Math.abs((strike - spotPrice) / spotPrice * 100) : 0;
    const distanciaAbertura = precoAbertura > 0 ? Math.abs((strike - precoAbertura) / precoAbertura * 100) : 0;
    
    // ===== ATUALIZAR BADGE DE EXERCÍCIO COM COTAÇÃO ATUAL =====
    // Usar função global para calcular e gerar badge de exercício
    const exercida = calcularExercicio(tipo, spotPrice, strike);
    
    const badgeExercicio = document.getElementById('detBadgeExercicio');
    if (badgeExercicio) {
        const badgeHTML = gerarBadgeExercicio(exercida, statusOperacao);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = badgeHTML;
        const newBadge = tempDiv.firstElementChild;
        badgeExercicio.textContent = newBadge.textContent;
        badgeExercicio.className = newBadge.className;
    }
    // ========================================================
    
    // Atualizar cotações
    setText('detPrecoAtivo', formatCurrencyBR(spotPrice));
    setText('detPrecoAtivoAtual', formatCurrencyBR(spotPrice));
    setText('detPrecoAtualComp', formatCurrencyBR(spotPrice));
    
    // Atualizar indicador visual ao lado do preço usando ícone SVG
    const indicadorAtivo = document.getElementById('detIndicadorAtivo');
    if (indicadorAtivo) {
        indicadorAtivo.innerHTML = gerarIconeSeta(varAtivo >= 0);
    }
    
    const corAtivo = varAtivo >= 0 ? '#2fb344' : '#d63939';
    setHTML('detVarAtivo', `<span style="color: ${corAtivo}"><i class="ti ti-arrow-${varAtivo >= 0 ? 'up' : 'down'}"></i> ${Math.abs(varAtivo).toFixed(2)}%</span>`);
    
    setText('detPrecoOpcao', formatCurrencyBR(optionPrice));
    setText('detPremioUnitAtual', formatCurrencyBR(optionPrice));
    setText('detPremioAtualComp', formatCurrencyBR(optionPrice));
    
    const setaOpcao = varOpcao >= 0 ? '▲' : '▼';
    const corOpcao = varOpcao >= 0 ? '#2fb344' : '#d63939';
    setHTML('detVarOpcao', `<span style="color: ${corOpcao}"><i class="ti ti-arrow-${varOpcao >= 0 ? 'up' : 'down'}"></i> ${Math.abs(varOpcao).toFixed(2)}%</span>`);
    
    const diasVencimento = calcularDiasUteisRestantes(op.vencimento);
    setText('detDiasVencimento', `${diasVencimento} ${diasVencimento === 1 ? 'dia útil' : 'dias úteis'}`);
    setText('detDiasVencimentoRisco', `${diasVencimento} dia${diasVencimento !== 1 ? 's' : ''} útil${diasVencimento !== 1 ? 's' : ''}`);
    
    // Distâncias
    setText('detDistanciaStrike', `${distancia.toFixed(2)}%`);
    setText('detDistanciaAbertura', `${distanciaAbertura.toFixed(2)}%`);
    setText('detDistanciaAtual', `${distancia.toFixed(2)}%`);
    setText('detDistAberturaComp', `${distanciaAbertura.toFixed(2)}%`);
    setText('detDistAtualComp', `${distancia.toFixed(2)}%`);
    
    // Variações no comparativo
    const variacaoPreco = spotPrice - precoAbertura;
    const variacaoPremio = optionPrice - premioAbertura;
    
    setText('detVariacaoPreco', `${variacaoPreco >= 0 ? '+' : ''}${formatCurrencyBR(Math.abs(variacaoPreco))}`);
    setText('detPercVariacaoPreco', `${variacaoPreco >= 0 ? '+' : ''}${varAtivo.toFixed(2)}%`);
    
    setText('detVariacaoPremio', `${variacaoPremio >= 0 ? '+' : ''}${formatCurrencyBR(Math.abs(variacaoPremio))}`);
    setText('detPercVariacaoPremio', `${variacaoPremio >= 0 ? '+' : ''}${varOpcao.toFixed(2)}%`);
    
    const variacaoDist = distancia - distanciaAbertura;
    setText('detVariacaoDist', `${variacaoDist >= 0 ? '+' : ''}${Math.abs(variacaoDist).toFixed(2)} pp`);
    const percVariacaoDist = distanciaAbertura > 0 ? ((distancia / distanciaAbertura - 1) * 100) : 0;
    setText('detPercVariacaoDist', `${percVariacaoDist.toFixed(2)}%`);
    
    // Calcular P&L
    let mtm = 0;
    let custoRecompra = 0;
    let valorAtual = 0;
    let premioCapturado = 0;
    let premioTotal = premioAbertura * qtdAbs;
    
    valorAtual = optionPrice * qtdAbs;

    if (isVenda) {
        custoRecompra = valorAtual;
        mtm = premioTotal - custoRecompra;
        // Prêmio capturado: quanto do prêmio inicial já foi "capturado" pela queda do preço da opção
        premioCapturado = premioAbertura > 0 ? ((premioAbertura - optionPrice) / premioAbertura * 100) : 0;
        premioCapturado = Math.max(0, Math.min(100, premioCapturado));
    } else {
        const custoEntrada = premioAbertura * qtdAbs;
        mtm = valorAtual - custoEntrada;
        premioCapturado = premioAbertura > 0 ? (optionPrice / premioAbertura * 100) : 0;
        premioCapturado = Math.max(0, Math.min(100, premioCapturado));
    }
    
    // Atualizar valores
    const mtmAbsFormatted = formatCurrencyBR(Math.abs(mtm));
    const mtmSigned = `${mtm >= 0 ? '' : '-'}${mtmAbsFormatted}`;
    setText('detLucroMTM', mtmSigned);
    setText('detResultMTM', `${mtm >= 0 ? '+ ' : '- '}${mtmAbsFormatted}`);
    
    const premioTotalFormatted = formatCurrencyBR(premioTotal);
    // Prêmio sempre positivo para venda (é recebido)
    const premioTotalDisplay = isVenda ? `+ ${premioTotalFormatted}` : `-${premioTotalFormatted}`;
    setText('detPremioRecebido', premioTotalDisplay);
    setText('detPremioRecebidoCard', premioTotalDisplay);
    setText('detTotalPremioAbertura', premioTotalDisplay);
    setText('detTotalAberturaComp', premioTotalDisplay);
    
    const custoRecompraFormatted = formatCurrencyBR(custoRecompra || valorAtual);
    const valorAtualFormatted = formatCurrencyBR(valorAtual);
    setText('detCustoRecompra', custoRecompraFormatted);
    setText('detCustoRecompraCard', custoRecompraFormatted);
    setText('detTotalAtualComp', isVenda ? `-${custoRecompraFormatted}` : valorAtualFormatted);
    
    setText('detResultLiquido', mtmSigned);
    setText('detVariacaoTotal', mtmSigned);
    
    // ROI Atual
    const roiAtual = premioTotal > 0 ? (mtm / premioTotal * 100) : 0;
    setText('detROIAtual', `${roiAtual >= 0 ? '+' : ''}${roiAtual.toFixed(2)}%`);
    setText('detPercVariacaoTotal', `${roiAtual >= 0 ? '+' : ''}${roiAtual.toFixed(2)}%`);
    
    // Prêmio capturado
    setText('detPercPremioCapturado', `${premioCapturado.toFixed(2)}%`);
    setText('detPercPremioRestante', `${(100 - premioCapturado).toFixed(2)}%`);
    
    // Calc ular e atualizar "Cenário Ideal" (Lucro no vencimento sem exercício)
    // Para VENDA de PUT: se o preço ficar acima do strike, lucro = prêmio total
    const resultadoFechamento = isVenda ? premioTotal : -premioTotal;
    setText('detResultFechamento', `${resultadoFechamento >= 0 ? '+ ' : '- '}${formatCurrencyBR(Math.abs(resultadoFechamento))}`);
    
    // Atualizar progress bar
    const progressBar = document.getElementById('detProgressPremio');
    if (progressBar) {
        progressBar.style.width = `${Math.min(Math.abs(premioCapturado), 100)}%`;
    }
    
    // Atualizar valores de risco
    const capitalRisco = strike * qtdAbs;
    const margem = capitalRisco * 0.25;
    const breakeven = isVenda ? (strike - premioAbertura) : (strike + premioAbertura);
    
    setText('detCapitalRisco', formatCurrencyBR(capitalRisco));
    setText('detMargemReq', formatCurrencyBR(margem));
    setText('detBreakeven', formatCurrencyBR(breakeven));
    setText('detValorCompraCard', formatCurrencyBR(capitalRisco));
    setText('detValorCompraRisco', formatCurrencyBR(capitalRisco));
    
    const riscoRetorno = premioTotal > 0 ? (capitalRisco / premioTotal).toFixed(2) : '0';
    const retornoMargem = margem > 0 ? ((mtm / margem) * 100).toFixed(2) : '0';
    
    setText('detRiscoRetorno', `${riscoRetorno}:1`);
    setText('detRetornoMargem', `${retornoMargem >= 0 ? '+' : ''}${retornoMargem}%`);
    setText('detLucroEsperado', `${retornoMargem >= 0 ? '+' : ''}${retornoMargem}%`);
    setText('detResultadoEsperado', `${retornoMargem >= 0 ? '+' : ''}${retornoMargem}%`);
    
    // Calcular cenários de perda/ganho
    const piorCaso = isVenda ? -(capitalRisco - premioTotal) : -premioTotal;
    setText('detPerdaMax', `-${formatCurrencyBR(Math.abs(piorCaso))}`);
    setText('detPrejuizoMax', formatCurrencyBR(Math.abs(piorCaso)));
    
    setText('detGanhoMax', premioTotalFormatted);
    setText('detLucroOtimista', premioTotalFormatted);
    
    // Probabilidade de lucro (Black-Scholes PoP)
    const diasRestantesPoP = calcularDiasUteisRestantes(op.vencimento);
    const T_pop = Math.max(diasRestantesPoP / 252.0, 0.0001); // Annualized time (business days)
    const r_pop = 0.1075; // Risk-free rate
    const sigma_pop = 0.3; // Default IV if not available
    
    // Calculate Breakeven using entry premium for PoP of the trade
    const premioEntry = Number.parseFloat(op.premio || op.preco_entrada || 0);
    let be_pop = 0;
    
    if (tipo === 'PUT') {
        be_pop = strike - premioEntry;
    } else {
        be_pop = strike + premioEntry;
    }
    
    let prob = 0;
    if (be_pop <= 0.001 || spotPrice <= 0.001) {
        if (!isVenda && tipo === 'PUT') prob = 0;
        else if (isVenda && tipo === 'PUT') prob = 1;
        else prob = 0;
    } else if (T_pop <= 0.001) {
         if (tipo === 'CALL') {
            prob = isVenda ? (spotPrice <= be_pop ? 1 : 0) : (spotPrice >= be_pop ? 1 : 0);
         } else {
            prob = isVenda ? (spotPrice >= be_pop ? 1 : 0) : (spotPrice <= be_pop ? 1 : 0);
         }
    } else {
        const d1_be = (Math.log(spotPrice / be_pop) + (r_pop + sigma_pop * sigma_pop / 2) * T_pop) / (sigma_pop * Math.sqrt(T_pop));
        const d2_be = d1_be - sigma_pop * Math.sqrt(T_pop);
        
        if (tipo === 'CALL') {
            prob = isVenda ? cdf(-d2_be) : cdf(d2_be);
        } else {
            prob = isVenda ? cdf(d2_be) : cdf(-d2_be);
        }
    }
    
    const probLucro = (Math.max(0, Math.min(1, prob)) * 100).toFixed(1);

    setText('detProbLucro', `${probLucro}%`);
    setText('detPoPResumo', `${probLucro}%`);
    setText('detProbOtimista', '65%');
    setText('detProbNeutro', '18%');
    setText('detProbPessimista', '17%');
    
    // Atualizar simulador
    updateSimulation(op, spotPrice);
    
    // Atualizar matriz de risco
    updateRiskMatrix(op, spotPrice, premioTotal, capitalRisco);
    
    // Remover loading dos cards
    hideCardLoading();
}

/**
 * Remove loading de todos os cards
 */
function hideCardLoading() {
    // Remover spinners dos stat cards
    const statCards = ['detPremioRecebido', 'detLucroMTM', 'detDistanciaStrike', 'detDiasVencimento'];
    statCards.forEach(id => hideLoading(id));
    
    // Remover spinners dos outros elementos
    hideLoading('detPrecoAtivo');
    hideLoading('detPrecoOpcao');
    hideLoading('detVarAtivo');
    hideLoading('detVarOpcao');
    hideLoading('detResultFechamento');
    hideLoading('detResultMTM');
    hideLoading('detPremioRecebidoCard');
    hideLoading('detCustoRecompra');
    hideLoading('detResultLiquido');
    hideLoading('detROIAtual');
}

/**
 * Atualiza a simulação com base no preço atual
 */
function updateSimulation(op, currentPrice) {
    const strike = Number.parseFloat(op.strike);
    const premioAbertura = Number.parseFloat(op.premio || op.preco_entrada || 0);
    const qtd = Number.parseInt(op.quantidade);
    const qtdAbs = Math.abs(qtd);
    const isVenda = qtd < 0;
    const tipo = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
    
    // Calcular resultado para o preço atual
    const result = calcOptionPayoff(strike, premioAbertura, qtdAbs, isVenda, tipo, currentPrice);
    
    // Atualizar display
    const simulatedValue = document.getElementById('detSimulatedValue');
    const scenarioLabel = document.getElementById('detScenarioLabel');
    
    if (simulatedValue && scenarioLabel) {
        if (result >= premioAbertura * qtdAbs * 0.9) {
            simulatedValue.textContent = formatCurrencyBR(result);
            simulatedValue.className = 'display-6 text-green';
            scenarioLabel.textContent = '✅ Lucro Máximo';
            scenarioLabel.className = 'badge bg-green fs-3';
        } else if (result > 0) {
            simulatedValue.textContent = formatCurrencyBR(result);
            simulatedValue.className = 'display-6 text-yellow';
            scenarioLabel.textContent = '⚠️ Lucro Parcial';
            scenarioLabel.className = 'badge bg-yellow fs-3';
        } else {
            simulatedValue.textContent = `-${formatCurrencyBR(Math.abs(result))}`;
            simulatedValue.className = 'display-6 text-red';
            scenarioLabel.textContent = '❌ Prejuízo';
            scenarioLabel.className = 'badge bg-red fs-3';
        }
    }
    
    // Atualizar cenários pré-definidos
    const scenarios = [
        { id: 'detScen1', price: strike * 0.95, prob: '5%', barId: 'detBarScen1', probId: 'detProbScen1' },
        { id: 'detScen2', price: strike * 0.96, prob: '12%', barId: 'detBarScen2', probId: 'detProbScen2' },
        { id: 'detScen3', price: strike * 0.99, prob: '18%', barId: 'detBarScen3', probId: 'detProbScen3' },
        { id: 'detScen4', price: strike * 1.00, prob: '65%', barId: 'detBarScen4', probId: 'detProbScen4' }
    ];
    
    scenarios.forEach(scenario => {
        const scenarioResult = calcOptionPayoff(strike, premioAbertura, qtdAbs, isVenda, tipo, scenario.price);
        
        const el = document.getElementById(scenario.id);
        if (el) {
            el.textContent = `${scenarioResult >= 0 ? '' : '-'}${formatCurrencyBR(Math.abs(scenarioResult))}`;
            el.className = `h2 ${scenarioResult >= 0 ? 'text-green' : 'text-red'} mb-2`;
        }
        
        const barEl = document.getElementById(scenario.barId);
        if (barEl) {
            barEl.style.width = scenario.prob;
        }
        
        const probEl = document.getElementById(scenario.probId);
        if (probEl) {
            probEl.textContent = scenario.prob + ' prob.';
        }
    });
}

/**
 * Atualiza a matriz de risco
 */
function updateRiskMatrix(op, spotPrice, premioTotal, capitalRisco) {
    const strike = Number.parseFloat(op.strike);
    const qtdAbs = Math.abs(Number.parseInt(op.quantidade));
    const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && Number.parseInt(op.quantidade) < 0);
    const premioAbertura = Number.parseFloat(op.premio || op.preco_entrada || 0);
    const tipo = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
    
    // Cenários de preço
    const priceRanges = [
        { max: strike * 0.95, desc: '≤ R$ ' + (strike * 0.95).toFixed(2) },
        { min: strike * 0.95, max: strike * 0.975, desc: 'R$ ' + (strike * 0.95).toFixed(2) + ' - R$ ' + (strike * 0.975).toFixed(2) },
        { min: strike * 0.975, max: strike * 0.99, desc: 'R$ ' + (strike * 0.975).toFixed(2) + ' - R$ ' + (strike * 0.99).toFixed(2) },
        { min: strike * 0.99, max: strike * 0.999, desc: 'R$ ' + (strike * 0.99).toFixed(2) + ' - R$ ' + (strike * 0.999).toFixed(2) },
        { min: strike, desc: '≥ R$ ' + strike.toFixed(2) }
    ];
    
    // Probabilidades (exemplo)
    const probabilities = ['5%', '12%', '18%', '10%', '65%'];
    
    priceRanges.forEach((range, index) => {
        // Calcular resultado para este range
        let midPrice = range.min ? (range.min + (range.max || strike)) / 2 : (range.max || strike) * 0.9;
        if (!range.min && !range.max) midPrice = strike * 0.925;
        
        const result = calcOptionPayoff(strike, premioAbertura, qtdAbs, isVenda, tipo, midPrice);
        
        // Atualizar matriz
        setTextIfExists(`detResultScen${index + 1}`, `${result >= 0 ? '' : '-'}R$ ${Math.abs(result).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
        setTextIfExists(`detROIScen${index + 1}`, premioTotal > 0 ? `${((result / premioTotal) * 100).toFixed(0)}%` : '0%');
        setTextIfExists(`detProbScen${index + 1}Tab`, probabilities[index]);
    });
}

/**
 * Renderiza os gráficos do modal
 */
function renderDetalheCharts(op, spotPrice = null, optionPrice = null) {
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não está disponível. Aguardando carregamento...');
        // Tentar novamente após um delay
        setTimeout(() => renderDetalheCharts(op, spotPrice, optionPrice), 500);
        return;
    }
    
    // Preço do ativo base - NÃO usar preco_entrada que é o prêmio!
    if (!spotPrice) spotPrice = Number.parseFloat(op.preco_ativo_base || op.strike);
    if (!optionPrice) optionPrice = Number.parseFloat(op.preco_atual || op.premio || op.preco_entrada);
    
    renderDetalhePerformanceChart(op, optionPrice);
    renderDetalhePayoffBarChart(op);
    renderDetalhePayoffFullChart(op);
    renderDetalheVolatilityChart(op);
    renderDetalheHistoricoChart(op, spotPrice);
    renderDetalheGregas(op, spotPrice, optionPrice);
}

/**
 * Renderiza gráfico de Performance
 */
function renderDetalhePerformanceChart(op, optionPrice) {
    const canvas = document.getElementById('detChartPerformance');
    if (!canvas) return;
    
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não disponível para renderizar Performance');
        return;
    }
    
    // Proteção contra loop infinito
    if (canvas.dataset.rendering === 'true') return;
    canvas.dataset.rendering = 'true';
    
    try {
        const ctx = canvas.getContext('2d');
        
        if (detalheCharts.performance) {
            detalheCharts.performance.destroy();
            detalheCharts.performance = null;
        }
        
        const premioUnitario = Number.parseFloat(op.premio || op.preco_entrada || 0);
        const premioTotal = premioUnitario * Math.abs(Number.parseInt(op.quantidade));
        const custoAtual = optionPrice * Math.abs(Number.parseInt(op.quantidade));
        const pnlAtual = premioTotal - custoAtual;
        
        // TODO: Buscar dados históricos reais da API
        // const historico = await buscarHistoricoPerformance(op.id);
        const labels = ['D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Hoje'];
        const data = [
            premioTotal,
            premioTotal * 0.875,
            premioTotal * 0.75,
            premioTotal * 0.625,
            premioTotal * 0.5,
            pnlAtual
        ];
        
        detalheCharts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Resultado Real',
                    data: data,
                    borderColor: '#206bc4',
                    backgroundColor: 'rgba(32, 107, 196, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
                }, {
                    label: 'Meta (Prêmio)',
                    data: [premioTotal, premioTotal, premioTotal, premioTotal, premioTotal, premioTotal],
                    borderColor: '#2fb344',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                onComplete: function() {
                    canvas.dataset.rendering = 'false';
                }
            },
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        color: '#f5f7fb',
                        usePointStyle: true
                    } 
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `Resultado: ${formatCurrencyBR(context.parsed.y)}`
                    }
                }
            },
            scales: {
                ...chartOptions.scales,
                y: { 
                    ...chartOptions.scales.y,
                    ticks: { 
                        ...chartOptions.scales.y.ticks,
                        callback: v => formatCurrencyBR(v)
                    } 
                }
            }
        }
    });
    } catch (error) {
        console.error('Erro ao renderizar gráfico de performance:', error);
        canvas.dataset.rendering = 'false';
    }
}

/**
 * Renderiza gráfico de Payoff (Barras)
 */
function renderDetalhePayoffBarChart(op) {
    const canvas = document.getElementById('detChartPayoffBar');
    if (!canvas) return;
    
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não disponível para renderizar PayoffBar');
        return;
    }
    
    // Proteção contra loop infinito
    if (canvas.dataset.rendering === 'true') return;
    canvas.dataset.rendering = 'true';
    
    try {
        const ctx = canvas.getContext('2d');
        
        if (detalheCharts.payoffBar) {
            detalheCharts.payoffBar.destroy();
            detalheCharts.payoffBar = null;
        }
    
    const strike = Number.parseFloat(op.strike);
    const premioAbertura = Number.parseFloat(op.premio || op.preco_entrada || 0);
    const qtd = Math.abs(Number.parseInt(op.quantidade));
    const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && Number.parseInt(op.quantidade) < 0);
    const tipo = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
    const isCall = tipo === 'CALL';
    
    // Preços de exemplo
    const prices = [strike * 0.95, strike * 0.96, strike * 0.98, strike * 0.99, strike, strike * 1.005, strike * 1.01, strike * 1.02, strike * 1.03];
    const labels = prices.map(p => p.toFixed(1));
    
    const data = prices.map(price => {
        const intrinsic = isCall ? Math.max(0, price - strike) : Math.max(0, strike - price);
        if (isVenda) {
            return (premioAbertura - intrinsic) * qtd;
        }
        return (intrinsic - premioAbertura) * qtd;
    });
    
    detalheCharts.payoffBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ctx => {
                    const value = ctx.raw;
                    return value >= 0 ? '#2fb344' : '#d63939';
                },
                borderRadius: 4,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                onComplete: function() {
                    canvas.dataset.rendering = 'false';
                }
            },
            ...chartOptions,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `Resultado: R$ ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: { 
                ...chartOptions.scales,
                y: { 
                    ...chartOptions.scales.y,
                    ticks: { 
                        ...chartOptions.scales.y.ticks,
                        callback: v => 'R$ ' + v 
                    } 
                },
                x: {
                    ...chartOptions.scales.x,
                    title: {
                        display: true,
                        text: 'Preço do Ativo (R$)',
                        color: '#a0aec0'
                    }
                }
            }
        }
    });
    } catch (error) {
        console.error('Erro ao renderizar gráfico PayoffBar:', error);
        canvas.dataset.rendering = 'false';
    }
}

/**
 * Renderiza gráfico de Payoff Completo
 */
function renderDetalhePayoffFullChart(op) {
    const canvas = document.getElementById('detChartPayoffFull');
    if (!canvas) return;
    
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não disponível para renderizar PayoffFull');
        return;
    }
    
    // Proteção contra loop infinito - verificar se já está sendo renderizado
    if (canvas.dataset.rendering === 'true') {
        return;
    }
    canvas.dataset.rendering = 'true';
    
    try {
        const ctx = canvas.getContext('2d');
        
        if (detalheCharts.payoffFull) {
            detalheCharts.payoffFull.destroy();
            detalheCharts.payoffFull = null;
        }
        
        const strike = Number.parseFloat(op.strike);
        const premioAbertura = Number.parseFloat(op.premio || op.preco_entrada || 0);
        const qtd = Math.abs(Number.parseInt(op.quantidade));
        const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && Number.parseInt(op.quantidade) < 0);
        const tipo = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
        const isCall = tipo === 'CALL';
        
        // Gerar dados para o gráfico
        const minPrice = strike * 0.9;
        const maxPrice = strike * 1.1;
        const step = (maxPrice - minPrice) / 100;
        
        const prices = [];
        const payoffValues = [];
        
        for (let price = minPrice; price <= maxPrice; price += step) {
            prices.push(price.toFixed(2));
            
            const intrinsic = isCall ? Math.max(0, price - strike) : Math.max(0, strike - price);
            const payoff = isVenda ? (premioAbertura - intrinsic) * qtd : (intrinsic - premioAbertura) * qtd;
            payoffValues.push(payoff);
        }
        
        detalheCharts.payoffFull = new Chart(ctx, {
            type: 'line',
            data: {
                labels: prices,
                datasets: [{
                    data: payoffValues,
                    borderColor: '#2fb344',
                    backgroundColor: 'rgba(47, 179, 68, 0.1)',
                    segment: {
                        borderColor: ctx => ctx.p1.parsed.y < 0 ? '#d63939' : '#2fb344',
                        backgroundColor: ctx => ctx.p1.parsed.y < 0 ? 'rgba(214, 57, 57, 0.1)' : 'rgba(47, 179, 68, 0.1)'
                    },
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 750,
                    onComplete: function() {
                        // Liberar flag após animação completa
                        canvas.dataset.rendering = 'false';
                    }
                },
                ...chartOptions,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Preço: ${formatCurrencyBR(prices[context.dataIndex])} | Payoff: ${formatCurrencyBR(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    ...chartOptions.scales,
                    x: { 
                        ...chartOptions.scales.x,
                        ticks: { 
                            ...chartOptions.scales.x.ticks,
                            maxTicksLimit: 12 
                        },
                        title: {
                            display: true,
                            text: 'Preço do Ativo no Vencimento (R$)',
                            color: '#a0aec0'
                        }
                    },
                    y: { 
                        ...chartOptions.scales.y,
                        ticks: { 
                            ...chartOptions.scales.y.ticks,
                            callback: v => formatCurrencyBR(v)
                        },
                        title: {
                            display: true,
                            text: 'Resultado (R$)',
                            color: '#a0aec0'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erro ao renderizar gráfico Payoff Full:', error);
        canvas.dataset.rendering = 'false';
    }
}

/**
 * Renderiza gráfico de Volatilidade
 */
function renderDetalheVolatilityChart(op) {
    const canvas = document.getElementById('detChartVolatility');
    if (!canvas) return;
    
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não disponível para renderizar Volatilidade');
        return;
    }
    
    // Proteção contra loop infinito
    if (canvas.dataset.rendering === 'true') return;
    canvas.dataset.rendering = 'true';
    
    try {
        const ctx = canvas.getContext('2d');
        
        if (detalheCharts.volatility) {
            detalheCharts.volatility.destroy();
            detalheCharts.volatility = null;
        }
        
        // TODO: Buscar dados reais de volatilidade da API
        // const volData = await buscarVolatilidadeHistorica(op.ativo);
        const labels = ['D-10', 'D-8', 'D-6', 'D-4', 'D-2', 'Hoje'];
        const ivData = [45, 48, 52, 55, 57, 58];
        const hvData = [40, 41, 42, 42, 43, 42];
    
    detalheCharts.volatility = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vol. Implícita',
                data: ivData,
                borderColor: '#ae3ec9',
                backgroundColor: 'rgba(174, 62, 201, 0.1)',
                tension: 0.4,
                borderWidth: 2
            }, {
                label: 'Vol. Histórica',
                data: hvData,
                borderColor: '#f76707',
                backgroundColor: 'rgba(247, 103, 7, 0.1)',
                tension: 0.4,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                onComplete: function() {
                    canvas.dataset.rendering = 'false';
                }
            },
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        color: '#f5f7fb',
                        usePointStyle: true
                    } 
                }
            },
            scales: { 
                ...chartOptions.scales,
                y: { 
                    ...chartOptions.scales.y,
                    ticks: { 
                        ...chartOptions.scales.y.ticks,
                        callback: v => v + '%' 
                    },
                    title: {
                        display: true,
                        text: 'Volatilidade (%)',
                        color: '#a0aec0'
                    }
                },
                x: {
                    ...chartOptions.scales.x,
                    title: {
                        display: true,
                        text: 'Dias',
                        color: '#a0aec0'
                    }
                }
            }
        }
    });
    } catch (error) {
        console.error('Erro ao renderizar gráfico de volatilidade:', error);
        canvas.dataset.rendering = 'false';
    }
}

/**
 * Renderiza gráfico histórico
 */
function renderDetalheHistoricoChart(op, spotPrice) {
    const canvas = document.getElementById('detChartHistorico');
    if (!canvas) return;
    
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não disponível para renderizar Histórico');
        return;
    }
    
    // Proteção contra loop infinito
    if (canvas.dataset.rendering === 'true') return;
    canvas.dataset.rendering = 'true';
    
    try {
        const ctx = canvas.getContext('2d');
        
        if (detalheCharts.historico) {
            detalheCharts.historico.destroy();
            detalheCharts.historico = null;
        }
        
        // TODO: Buscar dados históricos reais da API
        // const historicoPrecos = await buscarHistoricoPrecos(op.ativo_base);
        const labels = ['D-10', 'D-9', 'D-8', 'D-7', 'D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Hoje'];
        const priceData = [
            spotPrice * 0.985,
            spotPrice * 0.99,
            spotPrice * 0.995,
            spotPrice * 1.0,
            spotPrice * 1.005,
            spotPrice * 1.007,
            spotPrice * 1.003,
            spotPrice * 1.001,
            spotPrice * 1.0005,
            spotPrice * 1.001,
            spotPrice
        ];
    
    detalheCharts.historico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: op.ativo_base || 'Ativo',
                data: priceData,
                borderColor: '#206bc4',
                backgroundColor: 'rgba(32, 107, 196, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                onComplete: function() {
                    canvas.dataset.rendering = 'false';
                }
            },
            ...chartOptions,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `Preço: R$ ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: { 
                ...chartOptions.scales,
                y: { 
                    ...chartOptions.scales.y,
                    ticks: { 
                        ...chartOptions.scales.y.ticks,
                        callback: v => 'R$ ' + v.toFixed(2) 
                    },
                    title: {
                        display: true,
                        text: 'Preço (R$)',
                        color: '#a0aec0'
                    }
                },
                x: {
                    ...chartOptions.scales.x,
                    title: {
                        display: true,
                        text: 'Dias',
                        color: '#a0aec0'
                    }
                }
            }
        }
    });
    } catch (error) {
        console.error('Erro ao renderizar gráfico histórico:', error);
        canvas.dataset.rendering = 'false';
    }
}

/**
 * Renderiza gregas
 */
async function renderDetalheGregas(op, spotPrice, optionPrice) {
    const container = document.getElementById('detGregasContainer');
    if (!container) return;
    
    const strike = Number.parseFloat(op.strike);
    const S = Number.parseFloat(spotPrice || op.preco_ativo_base || op.strike || 0);
    const tipo = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
    const isVenda = op.tipo_operacao === 'VENDA' || (op.tipo_operacao === undefined && Number.parseInt(op.quantidade) < 0);
    const diasRestantes = calcularDiasUteisRestantes(op.vencimento);
    const T = Math.max(diasRestantes / 252.0, 1 / 252);
    const r = 0.1075;
    const sigma = normalizeSigma(op.implied_volatility || op.iv || op.volatilidade || op.vol || 0.3) || 0.3;

    if (S <= 0 || strike <= 0 || sigma <= 0) {
        container.innerHTML = '<div class="text-muted">Dados insuficientes para calcular gregas.</div>';
        return;
    }

    const d1 = (Math.log(S / strike) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const pdf = normalPdf(d1);

    const deltaBase = tipo === 'CALL' ? cdf(d1) : cdf(d1) - 1;
    const gammaBase = pdf / (S * sigma * Math.sqrt(T));
    const thetaBase = tipo === 'CALL'
        ? (-(S * pdf * sigma) / (2 * Math.sqrt(T)) - r * strike * Math.exp(-r * T) * cdf(d2))
        : (-(S * pdf * sigma) / (2 * Math.sqrt(T)) + r * strike * Math.exp(-r * T) * cdf(-d2));
    const vegaBase = S * pdf * Math.sqrt(T) / 100;
    const rhoBase = tipo === 'CALL'
        ? (strike * T * Math.exp(-r * T) * cdf(d2) / 100)
        : (-strike * T * Math.exp(-r * T) * cdf(-d2) / 100);

    const sign = isVenda ? -1 : 1;
    const gregas = {
        delta: deltaBase * sign,
        gamma: gammaBase * sign,
        theta: (thetaBase / 365) * sign,
        vega: vegaBase * sign,
        rho: rhoBase * sign
    };
    
    container.innerHTML = `
        <!-- Delta -->
        <div class="mb-4">
            <div class="d-flex justify-content-between mb-2">
                <div>
                    <strong class="text-blue">Delta (Δ)</strong>
                    <div class="text-muted small">Sensibilidade ao preço do ativo</div>
                </div>
                <div class="h3 mb-0 text-blue">${gregas.delta.toFixed(4)}</div>
            </div>
            <div class="progress greek-progress">
                <div class="progress-bar bg-blue" style="width: ${Math.abs(gregas.delta) * 100}%"></div>
            </div>
        </div>

        <!-- Gamma -->
        <div class="mb-4">
            <div class="d-flex justify-content-between mb-2">
                <div>
                    <strong class="text-green">Gamma (Γ)</strong>
                    <div class="text-muted small">Taxa de variação do Delta</div>
                </div>
                <div class="h3 mb-0 text-green">${gregas.gamma.toFixed(4)}</div>
            </div>
            <div class="progress greek-progress">
                <div class="progress-bar bg-green" style="width: ${gregas.gamma * 2000}%"></div>
            </div>
        </div>

        <!-- Theta -->
        <div class="mb-4">
            <div class="d-flex justify-content-between mb-2">
                <div>
                    <strong class="text-yellow">Theta (Θ)</strong>
                    <div class="text-muted small">Decaimento temporal (favorável)</div>
                </div>
                <div class="h3 mb-0 text-yellow">${gregas.theta.toFixed(4)}</div>
            </div>
            <div class="progress greek-progress">
                <div class="progress-bar bg-yellow" style="width: ${gregas.theta * 1000}%"></div>
            </div>
        </div>

        <!-- Vega -->
        <div class="mb-0">
            <div class="d-flex justify-content-between mb-2">
                <div>
                    <strong class="text-purple">Vega (ν)</strong>
                    <div class="text-muted small">Sensibilidade à volatilidade</div>
                </div>
                <div class="h3 mb-0 text-purple">${gregas.vega.toFixed(4)}</div>
            </div>
            <div class="progress greek-progress">
                <div class="progress-bar bg-purple" style="width: ${gregas.vega * 333}%"></div>
            </div>
        </div>
    `;
}

/**
 * Helper function para setar texto se o elemento existe
 */
function setTextIfExists(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/**
 * Atualizar função openDetalhesOperacao existente
 */
const originalOpenDetalhes = window.openDetalhesOperacao;
window.openDetalhesOperacao = function(id) {
    openDetalheOperacao(id);
};

// Fun\u00e7\u00f5es matem\u00e1ticas movidas para global.js: cdf(), pdf()
// normalPdf() \u00e9 a mesma que pdf() do global.js
const normalPdf = function(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
};

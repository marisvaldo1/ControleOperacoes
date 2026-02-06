// Detalhe de Opções - JavaScript (baseado em z.html)

let currentDetalheOpId = null;
let detalheCharts = {
    pnl: null,
    payoff: null,
    volatility: null,
    historico: null
};

/**
 * Abre o modal de detalhes da operação
 * @param {string|number} id - ID da operação
 */
async function openDetalheOperacao(id) {
    currentDetalheOpId = id;
    
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
    
    // Popular dados iniciais
    populateDetalheModal(operacao);
    
    // Renderizar gráficos iniciais
    renderDetalheCharts(operacao);
    
    // Adicionar event listeners (fazemos aqui pois o modal é carregado dinamicamente)
    const btnRefresh = document.getElementById('btnDetalheRefresh');
    if (btnRefresh) {
        // Remover listener antigo se existir
        btnRefresh.replaceWith(btnRefresh.cloneNode(true));
        const newBtn = document.getElementById('btnDetalheRefresh');
        newBtn.addEventListener('click', refreshDetalheOperacao);
    }
    
    // Slider de simulação
    const priceSlider = document.getElementById('detPriceSlider');
    if (priceSlider) {
        priceSlider.addEventListener('input', function() {
            const price = parseFloat(this.value);
            const elDisplay = document.getElementById('detSimPriceDisplay');
            if (elDisplay) {
                elDisplay.textContent = `R$ ${price.toFixed(2)}`;
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
    
    // Buscar dados atualizados da API
    await refreshDetalheOperacao();
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
    
    const badgeSide = document.getElementById('detBadgeSide');
    if (badgeSide) {
        // Determinar se é VENDA ou COMPRA baseado na quantidade
        const isVenda = parseInt(op.quantidade) < 0;
        if (isVenda) {
            badgeSide.className = 'badge bg-danger ms-2';
            badgeSide.textContent = 'VENDA';
        } else {
            badgeSide.className = 'badge bg-success ms-2';
            badgeSide.textContent = 'COMPRA';
        }
    }
    
    // Extrair tipo de opção do código do ativo (último caractere geralmente é tipo)
    const tipoOpcao = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
    setText('detBadgeType', tipoOpcao);
    
    // Tab Performance - Quick Stats
    const premioUnitario = parseFloat(op.premio || op.preco_entrada || 0);
    const premioTotal = premioUnitario * Math.abs(parseInt(op.quantidade));
    setText('detPremioRecebido', `R$ ${premioTotal.toFixed(2)}`);
    setText('detLucroMTM', '...');
    setText('detDistanciaStrike', '...');
    
    const diasVenc = calcularDias(op.vencimento).uteis;
    setText('detDiasVencimento', `${diasVenc} ${diasVenc === 1 ? 'dia' : 'dias'}`);    
    
    // Cotações
    const ativoBase = op.ativo_base || op.ativo.substring(0, 5);
    setText('detAtivoBase1', ativoBase);
    setText('detAtivoBase2', ativoBase);
    setText('detAtivoBase3', ativoBase);
    setText('detAtivoBase4', ativoBase);
    setText('detAtivoBase5', ativoBase);
    setText('detAtivoRisco1', ativoBase);
    setText('detAtivoRisco2', ativoBase);
    setText('detAtivoRisco3', ativoBase);
    
    setText('detOpcao', op.ativo);
    const precoAtivo = parseFloat(op.spot_price || op.preco_entrada || 0);
    setText('detPrecoAtivo', `R$ ${precoAtivo.toFixed(2)}`);
    const precoOpcao = parseFloat(op.preco_atual || op.premio || 0);
    setText('detPrecoOpcao', `R$ ${precoOpcao.toFixed(2)}`);
    setText('detVarAtivo', '...');
    setText('detVarOpcao', '...');
    
    // Resultado Financeiro
    setText('detResultFechamento', `+ R$ ${premioTotal.toFixed(2)}`);
    setText('detResultMTM', '...');
    
    // Tab Detalhes
    setText('detDataAbertura', new Date(op.data_operacao).toLocaleDateString('pt-BR'));
    const precoAtivoAbertura = parseFloat(op.spot_price || op.preco_entrada || 0);
    setText('detPrecoAtivoAbertura', `R$ ${precoAtivoAbertura.toFixed(2)}`);
    setText('detPremioUnitAbertura', `R$ ${premioUnitario.toFixed(2)}`);
    setText('detDistanciaAbertura', '...');
    setText('detQtdAbertura', `${Math.abs(parseInt(op.quantidade))} contratos`);
    setText('detTotalPremioAbertura', `R$ ${premioTotal.toFixed(2)}`);
    
    setText('detPrecoAtivoAtual', `R$ ${precoAtivo.toFixed(2)}`);
    setText('detPremioUnitAtual', `R$ ${precoOpcao.toFixed(2)}`);
    setText('detDistanciaAtual', '...');
    setText('detPercPremioRestante', '...');
    setText('detCustoRecompra', '...');
    
    // Tab Simulação
    setText('detStrikeSim', parseFloat(op.strike).toFixed(2));
    setText('detStrikeRisco', parseFloat(op.strike).toFixed(2));
    
    const priceSlider = document.getElementById('detPriceSlider');
    if (priceSlider) {
        const strike = parseFloat(op.strike);
        priceSlider.min = (strike * 0.8).toFixed(2);
        priceSlider.max = (strike * 1.2).toFixed(2);
        priceSlider.value = parseFloat(op.spot_price || op.preco_entrada || strike).toFixed(2);
    }
    
    // Tab Risco
    const capitalRisco = parseFloat(op.strike) * Math.abs(parseInt(op.quantidade));
    setText('detCapitalRisco', `R$ ${capitalRisco.toFixed(2)}`);
    setText('detGanhoMax', `R$ ${premioTotal.toFixed(2)}`);
    setText('detLucroOtimista', premioTotal.toFixed(2));
    setText('detValorCompra', capitalRisco.toFixed(2));
    
    // Saldos
    const config = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const saldoAtual = parseFloat(config.saldoAcoes || 0);
    setText('detSaldoAtual', `R$ ${saldoAtual.toFixed(2)}`);
    setText('detSaldoProj', `R$ ${(saldoAtual + premioTotal).toFixed(2)}`);
}

/**
 * Atualiza dados do modal com informações da API
 */
async function refreshDetalheOperacao() {
    if (!currentDetalheOpId) return;
    
    const operacao = allOperacoes.find(op => op.id == currentDetalheOpId);
    if (!operacao) return;
    
    const btn = document.getElementById('btnDetalheRefresh');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    }
    
    try {
        // Buscar cotação do ativo base
        let spotPrice = 0;
        try {
            const resSpot = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${operacao.ativo_base}`);
            if (resSpot.ok) {
                const dataSpot = await resSpot.json();
                spotPrice = parseFloat(dataSpot.price || dataSpot.cotacao || dataSpot.close || dataSpot.last || 0);
            }
        } catch(e) {
            console.error('Erro ao buscar cotação do ativo:', e);
        }
        
        // Buscar cotação da opção
        let optionPrice = 0;
        try {
            const resOp = await fetch(`${API_BASE}/api/cotacao/opcoes?symbol=${operacao.ativo}`);
            if (resOp.ok) {
                const dataOp = await resOp.json();
                optionPrice = parseFloat(dataOp.price || dataOp.cotacao || dataOp.close || dataOp.last || 0);
            }
        } catch(e) {
            console.error('Erro ao buscar cotação da opção:', e);
        }
        
        // Fallbacks
        if (spotPrice === 0 && operacao.spot_price) {
            spotPrice = parseFloat(operacao.spot_price);
        }
        if (spotPrice === 0 && operacao.preco_entrada) {
            spotPrice = parseFloat(operacao.preco_entrada);
        }
        if (spotPrice === 0) {
            spotPrice = parseFloat(operacao.strike);
        }
        
        if (optionPrice === 0 && operacao.preco_atual) {
            optionPrice = parseFloat(operacao.preco_atual);
        }
        
        // Atualizar UI com dados ao vivo
        updateDetalheUI(operacao, spotPrice, optionPrice);
        
        // Atualizar timestamp
        const now = new Date();
        const timestamp = `Hoje, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        const elTimestamp = document.getElementById('detUltimaAtualizacao');
        if (elTimestamp) {
            elTimestamp.textContent = timestamp;
        }
        
        // Re-renderizar gráficos com dados atualizados
        renderDetalheCharts(operacao, spotPrice, optionPrice);
        
        iziToast.success({
            title: 'Atualizado',
            message: 'Dados atualizados com sucesso',
            position: 'topRight',
            timeout: 2000
        });
        
    } catch(e) {
        console.error('Erro ao atualizar dados:', e);
        iziToast.error({
            title: 'Erro',
            message: 'Erro ao atualizar dados'
        });
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>';
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
    
    const strike = parseFloat(op.strike);
    const premioAbertura = parseFloat(op.premio || op.preco_entrada || 0);
    const precoAbertura = parseFloat(op.spot_price || op.preco_entrada || spotPrice);
    const qtd = parseInt(op.quantidade);
    const isVenda = qtd < 0;
    
    // Calcular variações
    const varAtivo = ((spotPrice - precoAbertura) / precoAbertura * 100);
    const varOpcao = ((optionPrice - premioAbertura) / premioAbertura * 100);
    
    // Calcular distância do strike
    const distancia = ((spotPrice - strike) / strike * 100);
    
    // Atualizar cotações
    setText('detPrecoAtivo', `R$ ${spotPrice.toFixed(2)}`);
    const setaAtivo = varAtivo >= 0 ? '▲' : '▼';
    const corAtivo = varAtivo >= 0 ? '#2fb344' : '#d63939';
    setHTML('detVarAtivo', `<span style="color: ${corAtivo}">${setaAtivo} ${Math.abs(varAtivo).toFixed(2)}%</span>`);
    
    setText('detPrecoOpcao', `R$ ${optionPrice.toFixed(2)}`);
    const setaOpcao = varOpcao >= 0 ? '▲' : '▼';
    const corOpcao = varOpcao >= 0 ? '#2fb344' : '#d63939';
    setHTML('detVarOpcao', `<span style="color: ${corOpcao}">${setaOpcao} ${Math.abs(varOpcao).toFixed(2)}%</span>`);
    
    setText('detDistanciaStrike', `${distancia.toFixed(2)}%`);
    setText('detDistanciaAbertura', `${((precoAbertura - strike) / strike * 100).toFixed(2)}%`);
    setText('detDistanciaAtual', `${distancia.toFixed(2)}%`);
    
    // Calcular P&L
    let mtm = 0;
    let custoRecompra = 0;
    let premioCapturado = 0;
    
    if (isVenda) {
        const premioTotal = premioAbertura * Math.abs(qtd);
        custoRecompra = optionPrice * Math.abs(qtd);
        mtm = premioTotal - custoRecompra;
        // Prêmio capturado: quanto do prêmio inicial já foi "capturado" pela queda do preço da opção
        premioCapturado = premioAbertura > 0 ? ((premioAbertura - optionPrice) / premioAbertura * 100) : 0;
        premioCapturado = Math.max(0, Math.min(100, premioCapturado)); // Entre 0 e 100%
    } else {
        const custoEntrada = premioAbertura * Math.abs(qtd);
        const valorAtual = optionPrice * Math.abs(qtd);
        mtm = valorAtual - custoEntrada;
    }
    
    // Atualizar valores
    setText('detLucroMTM', `R$ ${Math.abs(mtm).toFixed(2)}`);
    setText('detResultMTM', `${mtm >= 0 ? '+ ' : '- '}R$ ${Math.abs(mtm).toFixed(2)}`);
    setText('detCustoRecompra', `R$ ${custoRecompra.toFixed(2)}`);
    
    setText('detPercPremioCapturado', `${premioCapturado.toFixed(2)}%`);
    setText('detPercPremioRestante', `${(100 - premioCapturado).toFixed(2)}%`);
    
    // Atualizar progress bar
    const progressBar = document.getElementById('detProgressPremio');
    if (progressBar) {
        progressBar.style.width = `${Math.min(Math.abs(premioCapturado), 100)}%`;
        progressBar.className = `progress-bar ${premioCapturado >= 0 ? 'bg-success' : 'bg-danger'}`;
    }
    
    // Atualizar valores de risco
    const capitalRisco = strike * Math.abs(qtd);
    const margem = capitalRisco * 0.25;
    const breakeven = isVenda ? (strike - premioAbertura) : (strike + premioAbertura);
    
    setText('detMargemReq', `R$ ${margem.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    setText('detBreakeven', `R$ ${breakeven.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    
    const premioTotal = premioAbertura * Math.abs(qtd);
    const riscoRetorno = premioTotal > 0 ? (capitalRisco / premioTotal).toFixed(2) : '0';
    const retornoMargem = margem > 0 ? ((mtm / margem) * 100).toFixed(2) : '0';
    
    setText('detRiscoRetorno', `${riscoRetorno}:1`);
    setText('detRetornoMargem', `${retornoMargem >= 0 ? '+' : ''}${retornoMargem}%`);
    
    // Calcular cenários
    const piorCaso = isVenda ? -(capitalRisco - premioTotal) : -premioTotal;
    setText('detPerdaMax', `-R$ ${Math.abs(piorCaso).toFixed(2)}`);
    setText('detPrejuizoMax', Math.abs(piorCaso).toFixed(2));
    
    // Probabilidade de lucro (simplificado)
    const probLucro = spotPrice > strike ? 65 : 35;
    setText('detProbLucro', `${probLucro}%`);
    const probBar = document.getElementById('detProbLucroBar');
    if (probBar) {
        probBar.style.width = `${probLucro}%`;
    }
    
    // Atualizar simulador
    updateSimulation(op, spotPrice);
}

/**
 * Renderiza os gráficos do modal
 * @param {object} op - Operação
 * @param {number} spotPrice - Preço do ativo
 * @param {number} optionPrice - Preço da opção
 */
function renderDetalheCharts(op, spotPrice = null, optionPrice = null) {
    if (!spotPrice) spotPrice = parseFloat(op.spot_price || op.preco_entrada || op.strike);
    if (!optionPrice) optionPrice = parseFloat(op.preco_atual || op.premio || op.preco_entrada);
    
    renderDetalhePnLChart(op, optionPrice);
    renderDetalhePayoffChart(op);
    renderDetalheVolatilityChart(op);
    renderDetalheHistoricoChart(op, spotPrice);
    renderDetalheGregas(op);
}

/**
 * Renderiza gráfico de P&L
 */
function renderDetalhePnLChart(op, optionPrice) {
    const canvas = document.getElementById('detChartPnL');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (detalheCharts.pnl) {
        detalheCharts.pnl.destroy();
    }
    
    // Dados simulados de evolução
    const days = [];
    const pnlValues = [];
    const dataAbertura = new Date(op.data_operacao);
    const hoje = new Date();
    const diasDecorridos = Math.floor((hoje - dataAbertura) / (1000 * 60 * 60 * 24));
    
    const premioUnitario = parseFloat(op.premio || op.preco_entrada || 0);
    const premioTotal = premioUnitario * Math.abs(parseInt(op.quantidade));
    const custoAtual = optionPrice * parseInt(op.quantidade);
    const pnlAtual = premioTotal - custoAtual;
    
    for (let i = 0; i <= Math.min(diasDecorridos, 30); i++) {
        const data = new Date(dataAbertura);
        data.setDate(data.getDate() + i);
        days.push(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        
        const progress = diasDecorridos > 0 ? i / diasDecorridos : 0;
        pnlValues.push(pnlAtual * progress);
    }
    
    detalheCharts.pnl = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'P&L (R$)',
                data: pnlValues,
                borderColor: pnlAtual >= 0 ? '#2fb344' : '#d63939',
                backgroundColor: pnlAtual >= 0 ? 'rgba(47, 179, 68, 0.1)' : 'rgba(214, 57, 57, 0.1)',
                borderWidth: 2,
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
                            return 'P&L: R$ ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { maxTicksLimit: 10 }
                }
            }
        }
    });
}

/**
 * Renderiza gráfico de Payoff
 */
function renderDetalhePayoffChart(op) {
    const canvas = document.getElementById('detChartPayoff');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (detalheCharts.payoff) {
        detalheCharts.payoff.destroy();
    }
    
    const strike = parseFloat(op.strike);
    const premioAbertura = parseFloat(op.premio || op.preco_entrada || 0);
    const qtd = parseInt(op.quantidade);
    const isVenda = qtd < 0;
    const tipo = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
    
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
        } else if (!isVenda && tipo === 'PUT') {
            if (price >= strike) {
                pnl = -(premioAbertura * qtd);
            } else {
                pnl = ((strike - price) * qtd) - (premioAbertura * qtd);
            }
        } else if (isVenda && tipo === 'CALL') {
            if (price <= strike) {
                pnl = premioAbertura * qtd;
            } else {
                pnl = (premioAbertura * qtd) - ((price - strike) * qtd);
            }
        } else if (!isVenda && tipo === 'CALL') {
            if (price <= strike) {
                pnl = -(premioAbertura * qtd);
            } else {
                pnl = ((price - strike) * qtd) - (premioAbertura * qtd);
            }
        }
        
        pnlValues.push(pnl);
    }
    
    detalheCharts.payoff = new Chart(ctx, {
        type: 'line',
        data: {
            labels: prices,
            datasets: [{
                label: 'Payoff (R$)',
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
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { maxTicksLimit: 10 }
                }
            }
        }
    });
}

/**
 * Renderiza gráfico de Volatilidade
 */
async function renderDetalheVolatilityChart(op) {
    const canvas = document.getElementById('detChartVolatility');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (detalheCharts.volatility) {
        detalheCharts.volatility.destroy();
    }
    
    // Tentar buscar dados reais de volatilidade implícita da API
    let ivData = [];
    const days = [];
    
    // TODO: Buscar dados reais de volatilidade da API
    // Por enquanto, mostrar mensagem de que dados não estão disponíveis
    for (let i = 7; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        ivData.push(null); // Sem dados mockados
    }
    
    detalheCharts.volatility = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Vol. Implícita (%)',
                    data: ivData,
                    borderColor: '#206bc4',
                    backgroundColor: 'rgba(32, 107, 196, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    spanGaps: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Dados de volatilidade aguardando integração com API',
                    color: '#a0aec0'
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        callback: function(value) {
                            return value ? value.toFixed(0) + '%' : '';
                        }
                    }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { maxTicksLimit: 8 }
                }
            }
        }
    });
}

/**
 * Renderiza gráfico histórico
 */
async function renderDetalheHistoricoChart(op, spotPrice) {
    const canvas = document.getElementById('detChartHistorico');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (detalheCharts.historico) {
        detalheCharts.historico.destroy();
    }
    
    // Tentar buscar dados históricos reais da API
    const days = [];
    const priceData = [];
    
    try {
        // TODO: Implementar busca de dados históricos da API
        // const response = await fetch(`${API_BASE}/api/historico/${op.ativo_base}?days=30`);
        // if (response.ok) {
        //     const data = await response.json();
        //     days = data.dates;
        //     priceData = data.prices;
        // }
        
        // Por enquanto, mostrar mensagem
        for (let i = 7; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            priceData.push(null);
        }
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
    }
    
    detalheCharts.historico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: op.ativo_base || 'Ativo',
                data: priceData,
                borderColor: '#2fb344',
                backgroundColor: 'rgba(47, 179, 68, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                spanGaps: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Histórico aguardando integração com API de dados históricos',
                    color: '#a0aec0'
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        callback: function(value) {
                            return value ? 'R$ ' + value.toFixed(2) : '';
                        }
                    }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { maxTicksLimit: 8 }
                }
            }
        }
    });
}

/**
 * Renderiza gregas
 */
async function renderDetalheGregas(op) {
    const container = document.getElementById('detGregasContainer');
    if (!container) return;
    
    // Tentar buscar gregas da API
    let gregas = {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0
    };
    
    try {
        // TODO: Implementar busca de gregas da API
        // const response = await fetch(`${API_BASE}/api/gregas/${op.ativo}`);
        // if (response.ok) {
        //     gregas = await response.json();
        // }
    } catch (error) {
        console.error('Erro ao buscar gregas:', error);
    }
    
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
 * Atualiza simulação de preço
 */
function updateSimulation(op, currentPrice) {
    const strike = parseFloat(op.strike);
    const premioAbertura = parseFloat(op.premio || op.preco_entrada || 0);
    const qtd = parseInt(op.quantidade);
    const isVenda = qtd < 0;
    const tipo = op.tipo || (op.ativo && op.ativo.includes('PUT') ? 'PUT' : 'CALL');
    
    // Calcular cenários
    const scenarios = [
        { price: strike * 0.85, id: 'detScen1' },
        { price: strike * 0.95, id: 'detScen2' },
        { price: strike * 1.05, id: 'detScen3' },
        { price: strike * 1.15, id: 'detScen4' }
    ];
    
    scenarios.forEach(scenario => {
        let pnl = 0;
        
        if (isVenda && tipo === 'PUT') {
            if (scenario.price >= strike) {
                pnl = premioAbertura * qtd;
            } else {
                pnl = (premioAbertura * qtd) - ((strike - scenario.price) * qtd);
            }
        }
        
        const el = document.getElementById(scenario.id);
        if (el) {
            el.textContent = `${pnl >= 0 ? '+' : ''}R$ ${Math.abs(pnl).toFixed(2)}`;
            el.className = `h5 ${pnl >= 0 ? 'text-success' : 'text-danger'} mb-0`;
        }
    });
}

// Event Listeners são adicionados na função openDetalheOperacao

// Atualizar função openDetalhesOperacao existente
const originalOpenDetalhes = window.openDetalhesOperacao;
window.openDetalhesOperacao = function(id) {
    openDetalheOperacao(id);
};


// ==========================================
// Y2 MODAL INTEGRATION
// ==========================================

function openY2Tab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        // Hide all tab contents inside the modal
        // Note: We need to be careful not to hide other tab-contents in the page if class is reused
        // Scope to modal
        if (tabcontent[i].closest('#modalDetalhesOperacao')) {
            tabcontent[i].classList.remove("active");
        }
    }
    
    tablinks = document.querySelectorAll("#modalDetalhesOperacao .tab");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add("active");
    }
    
    if (evt) {
        evt.currentTarget.classList.add("active");
    }
}

// Redefine refreshDetalhesOperacao to use new IDs
async function refreshDetalhesOperacao() {
    if (!currentDetalhesOpId) return;
    
    const btn = document.getElementById('btn-y2-refresh');
    let originalText = '🔄 Atualizar';
    if(btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '⌛ Carregando...';
        btn.disabled = true;
    }

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
    const premioAbertura = Math.abs(parseFloat(op.premio)); // Sempre positivo
    const tipo = op.tipo;
    const isVenda = qtd < 0;
    const qtdAbs = Math.abs(qtd);
    
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
    const varOpcaoFormatted = `${varOpcao > 0 ? '↑' : '↓'} ${Math.abs(varOpcao).toFixed(2)}%`;
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
        // Aplicar cor baseado no resultado
        if(resultadoLiquido >= 0) {
            resultValEl.style.color = 'var(--tblr-success)';
        } else {
            resultValEl.style.color = 'var(--tblr-danger)';
        }
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
    
    // Init Charts if needed (placeholder)
    // We would need to implement chart rendering logic similar to y2.html
}

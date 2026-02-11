// Configuracoes globais e funcoes comuns
// API_BASE vazio faz com que as requisições usem a mesma origem (host:port) da página
const API_BASE = '';
window.API_BASE = API_BASE; // Expor globalmente

// Configurar iziToast para aparecer no canto superior direito
document.addEventListener('libsLoaded', function() {
    if (typeof iziToast !== 'undefined') {
        iziToast.settings({
            position: 'topRight',
            transitionIn: 'fadeInDown',
            transitionOut: 'fadeOutUp',
            timeout: 5000,
            pauseOnHover: true,
            resetOnHover: true
        });
    }
});

// Formatar moeda
function formatCurrency(value, currency = 'BRL') {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(value);
}

// Formatar porcentagem
function formatPercent(value) {
    if (value === null || value === undefined) return '-';
    const color = value >= 0 ? 'text-success' : 'text-danger';
    return `<span class="${color}">${value.toFixed(2)}%</span>`;
}

// Formatar crypto
function formatCrypto(value) {
    if (value === null || value === undefined) return '-';
    return value.toFixed(8);
}

// Formatar número com separador de milhar
function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

// Data atual formatada
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

// Formatar data para exibicao
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
}

// Formatar data para c\u00e9lula de tabela DataTables com atributo data-order
function formatDateCell(dateStr) {
    if (!dateStr) return '-';
    const ts = new Date(dateStr).getTime();
    return `<span data-order="${Number.isFinite(ts) ? ts : ''}">${formatDate(dateStr)}</span>`;
}

// Obter mes/ano atual
function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Filtrar por mes
function filterByMonth(data, month) {
    return data.filter(item => item.data_operacao && item.data_operacao.startsWith(month));
}

// Filtrar por ano
function filterByYear(data, year) {
    return data.filter(item => item.data_operacao && item.data_operacao.startsWith(year));
}

// Calcular totais
function calcTotals(data) {
    return {
        totalOperacoes: data.length,
        totalPremios: data.reduce((acc, item) => acc + (parseFloat(item.premio_us) || 0), 0),
        totalCrypto: data.reduce((acc, item) => acc + (parseFloat(item.crypto) || 0), 0),
        resultadoMedio: data.length > 0 ? 
            data.reduce((acc, item) => acc + (parseFloat(item.resultado) || 0), 0) / data.length : 0
    };
}

// Agrupar por mes
function groupByMonth(data) {
    const groups = {};
    data.forEach(item => {
        if (!item.data_operacao) return;
        const month = item.data_operacao.substring(0, 7);
        if (!groups[month]) groups[month] = [];
        groups[month].push(item);
    });
    return groups;
}

// Nome do mes
function getMonthName(monthStr) {
    const [year, month] = monthStr.split('-');
    const months = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${months[parseInt(month) - 1]}-${year.substring(2)}`;
}

// Cores para graficos
const chartColors = ['#206bc4', '#f59f00', '#2fb344', '#d63939', '#ae3ec9', '#4263eb'];

// ==========================================
// FUNÇÕES MATEMÁTICAS / BLACK-SCHOLES
// ==========================================

/**
 * Normal Cumulative Distribution Function (CDF)
 * Usado em cálculos Black-Scholes e análise de opções
 */
function cdf(x) {
    const mean = 0;
    const sigma = 1;
    const z = (x - mean) / Math.sqrt(2 * sigma * sigma);
    const t = 1 / (1 + 0.3275911 * Math.abs(z));
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const erf = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    const sign = z < 0 ? -1 : 1;
    return (1 / 2) * (1 + sign * erf);
}

/**
 * Probability Density Function (PDF)
 */
function pdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Calcula preço de opção usando Black-Scholes
 * @param {number} S - Preço do ativo subjacente
 * @param {number} K - Preço de exercício (strike)
 * @param {number} T - Tempo até o vencimento (anos)
 * @param {number} r - Taxa de juros livre de risco
 * @param {number} sigma - Volatilidade
 * @param {string} type - 'CALL' ou 'PUT'
 */
function blackScholesPrice(S, K, T, r, sigma, type) {
    if (T <= 0) return type === 'CALL' ? Math.max(0, S - K) : Math.max(0, K - S);
    
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    if (type === 'CALL') {
        return S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
    } else {
        return K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
    }
}

/**
 * Calcula volatilidade implícita usando método de Newton-Raphson
 * @param {number} price - Preço observado da opção
 * @param {number} S - Preço do ativo
 * @param {number} K - Strike
 * @param {number} T - Tempo até vencimento
 * @param {number} r - Taxa de juros
 * @param {string} type - 'CALL' ou 'PUT'
 */
function calculateImpliedVolatility(price, S, K, T, r, type) {
    let sigma = 0.3; // Chute inicial
    const maxIterations = 100;
    const tolerance = 0.0001;
    
    for (let i = 0; i < maxIterations; i++) {
        const calcPrice = blackScholesPrice(S, K, T, r, sigma, type);
        const diff = calcPrice - price;
        
        if (Math.abs(diff) < tolerance) return sigma;
        
        // Vega (derivada em relação a sigma)
        const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
        const vega = S * pdf(d1) * Math.sqrt(T);
        
        if (vega < 0.0001) break; // Evitar divisão por zero
        
        sigma = sigma - diff / vega;
        
        if (sigma <= 0) sigma = 0.01;
    }
    
    return sigma;
}

/**
 * Calcula as gregas (Delta, Gamma, Theta, Vega, Rho)
 * @param {number} S - Preço do ativo
 * @param {number} K - Strike
 * @param {number} T - Tempo até vencimento
 * @param {number} r - Taxa de juros
 * @param {number} sigma - Volatilidade
 * @param {string} type - 'CALL' ou 'PUT'
 */
function calculateGreeks(S, K, T, r, sigma, type) {
    if (T <= 0) {
        return {delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0};
    }
    
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    let delta, gamma, theta, vega, rho;
    
    if (type === 'CALL') {
        delta = cdf(d1);
        theta = (-S * pdf(d1) * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cdf(d2)) / 365;
        rho = K * T * Math.exp(-r * T) * cdf(d2) / 100;
    } else {
        delta = cdf(d1) - 1;
        theta = (-S * pdf(d1) * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cdf(-d2)) / 365;
        rho = -K * T * Math.exp(-r * T) * cdf(-d2) / 100;
    }
    
    gamma = pdf(d1) / (S * sigma * Math.sqrt(T));
    vega = S * pdf(d1) * Math.sqrt(T) / 100;
    
    return {delta, gamma, theta, vega, rho};
}

// Aliases para compatibilidade com código legado
const calculateIV = calculateImpliedVolatility;
window.calculateIV = calculateImpliedVolatility; // Expor globalmente

// Expor outras funções matemáticas globalmente
window.cdf = cdf;
window.pdf = pdf;
window.blackScholesPrice = blackScholesPrice;
window.calculateImpliedVolatility = calculateImpliedVolatility;
window.calculateGreeks = calculateGreeks;

// ==========================================
// FUNÇÕES DE UI / LOADING
// ==========================================

/**
 * Mostra/esconde loading em um elemento específico
 * @param {string} elementId - ID do elemento
 * @param {boolean} show - true para mostrar, false para esconder
 * @param {string} originalContent - Conteúdo original (opcional)
 * @returns {string} - Conteúdo original capturado
 */
function showElementLoading(elementId, show = true, originalContent = '') {
    const el = document.getElementById(elementId);
    if (!el) return originalContent;
    
    if (show) {
        const original = el.innerHTML;
        el.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        el.dataset.originalContent = original;
        return original;
    } else {
        el.innerHTML = originalContent || el.dataset.originalContent || '';
        delete el.dataset.originalContent;
        return '';
    }
}

/**
 * Mostra loading em múltiplos elementos
 * @param {Array<string>} elementIds - Array de IDs
 * @param {boolean} show - true para mostrar, false para esconder
 */
function showMultipleElementsLoading(elementIds, show = true) {
    elementIds.forEach(id => showElementLoading(id, show));
}

// ==========================================
// FUNÇÕES FINANCEIRAS
// ==========================================

/**
 * Parse seguro de float
 */
function parseFloatSafe(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const str = String(value).replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calcula se uma opção está em exercício (ITM - In The Money)
 * @param {string} tipoOpcao - Tipo da opção ('CALL' ou 'PUT')
 * @param {number} spotPrice - Preço atual do ativo base
 * @param {number} strike - Preço de exercício
 * @returns {boolean} - true se ITM (em exercício), false se OTM (fora do exercício)
 */
function calcularExercicio(tipoOpcao, spotPrice, strike) {
    if (!tipoOpcao || !spotPrice || !strike) return false;
    
    const tipo = String(tipoOpcao).toUpperCase();
    const spot = Number.parseFloat(spotPrice);
    const stk = Number.parseFloat(strike);
    
    // PUT ITM: preço atual < strike (posso vender por mais que vale)
    // CALL ITM: preço atual > strike (posso comprar por menos que vale)
    if (tipo === 'PUT') {
        return spot < stk;
    } else if (tipo === 'CALL') {
        return spot > stk;
    }
    return false;
}

/**
 * Gera HTML do badge de exercício
 * @param {boolean} exercida - Se está em exercício (ITM)
 * @param {string} status - Status da operação ('ABERTA', 'FECHADA', etc.)
 * @returns {string} - HTML do badge
 */
function gerarBadgeExercicio(exercida, status = 'ABERTA') {
    const statusUpper = String(status || 'ABERTA').toUpperCase();
    
    if (statusUpper === 'ABERTA') {
        // Para operações abertas, mostrar "Possível exercício" em amarelo se ITM
        if (exercida) {
            return '<span class="badge bg-yellow text-yellow-fg">Possível Exercício</span>';
        } else {
            return '<span class="badge bg-green text-green-fg">Sem Exercício</span>';
        }
    } else {
        // Para operações fechadas, mostrar Sim ou Não
        if (exercida) {
            return '<span class="badge bg-red text-red-fg">SIM</span>';
        } else {
            return '<span class="badge bg-green text-green-fg">NÃO</span>';
        }
    }
}

/**
 * Gera ícone SVG de seta (alta/queda)
 * @param {boolean} isAlta - true para alta (verde), false para queda (vermelho)
 * @returns {string} - HTML do ícone SVG
 */
function gerarIconeSeta(isAlta) {
    if (isAlta) {
        // Ícone trending-up (verde)
        return `<div class="text-success">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
        </div>`;
    } else {
        // Ícone trending-down (vermelho)
        return `<div class="text-danger">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline>
                <polyline points="22 11 22 17 16 17"></polyline>
            </svg>
        </div>`;
    }
}

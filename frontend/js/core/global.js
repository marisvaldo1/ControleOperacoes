// Configuracoes globais e funcoes comuns
// API_BASE vazio faz com que as requisições usem a mesma origem (host:port) da página
const API_BASE = '';

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

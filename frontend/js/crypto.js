let allOperacoes = [];
let tableMesAtual, tableHistorico;
let chartAnual = null;

document.addEventListener('layoutReady', function() {
    initDataTables();
    loadOperacoes();
    
    document.getElementById('btnNovaOperacao').addEventListener('click', openNewModal);
    document.getElementById('btnSaveOperacao').addEventListener('click', saveOperacao);
    document.getElementById('btnRefresh')?.addEventListener('click', refreshQuotes);
});

function initDataTables() {
    const dtConfig = {
        language: {url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json'},
        pageLength: 10,
        responsive: false,
        scrollX: true,
        order: [[11, 'desc']]
    };
    tableMesAtual = $('#tableMesAtual').DataTable(dtConfig);
    tableHistorico = $('#tableHistorico').DataTable(dtConfig);
}

async function loadOperacoes() {
    try {
        const res = await fetch(API_BASE + '/api/crypto');
        allOperacoes = await res.json();
        updateUI();
    } catch (e) {
        iziToast.error({title: 'Erro', message: 'Erro ao carregar operacoes'});
    }
}

function updateUI() {
    const currentMonth = getCurrentMonth();
    const currentYear = new Date().getFullYear().toString();
    
    const mesAtualData = filterByMonth(allOperacoes, currentMonth);
    const anoData = filterByYear(allOperacoes, currentYear);
    
    // Cards
    const totals = calcTotals(allOperacoes);
    document.getElementById('cardTotalOps').textContent = totals.totalOperacoes;
    document.getElementById('cardTotalPremios').textContent = formatCurrency(totals.totalPremios, 'USD');
    document.getElementById('cardTotalCrypto').textContent = formatCrypto(totals.totalCrypto);
    document.getElementById('cardResultadoMedio').textContent = totals.resultadoMedio.toFixed(2) + '%';
    
    // Mes Atual Header
    const mesTotals = calcTotals(mesAtualData);
    const mediaDiaria = mesAtualData.length > 0 ? mesTotals.resultadoMedio / 30 : 0;
    document.getElementById('mesAtualHeader').innerHTML = `
        <div class="col-12 mb-2">
            <h4>${getMonthName(currentMonth)}</h4>
            <span class="float-end text-primary">Mes Atual</span>
        </div>
        <div class="col-md-3">
            <div class="text-muted">Total Mensal</div>
            <div class="text-success">${formatCrypto(mesTotals.totalCrypto)}</div>
        </div>
        <div class="col-md-3">
            <div class="text-muted">Premio BTC / US</div>
            <div>$ ${mesTotals.totalPremios.toFixed(2)}</div>
        </div>
        <div class="col-md-3">
            <div class="text-muted">Resultado</div>
            <div class="text-success">${mesTotals.resultadoMedio.toFixed(2)}%</div>
        </div>
        <div class="col-md-3">
            <div class="text-muted">Media diaria</div>
            <div>${mediaDiaria.toFixed(2)}%</div>
        </div>
    `;
    document.getElementById('mesAtualTitle').textContent = `Operacoes - ${getMonthName(currentMonth).replace('-', ' 20')}`;
    
    // Tables
    populateTable(tableMesAtual, mesAtualData);
    populateTable(tableHistorico, allOperacoes);
    
    // Historico mensal
    renderHistoricoMensal();
    
    // Grafico anual
    renderChartAnual(anoData, currentYear);
}

function populateTable(dt, data) {
    dt.clear();
    const sorted = [...data].sort((a, b) => {
        const da = new Date(a.exercicio || a.created_at || 0);
        const db = new Date(b.exercicio || b.created_at || 0);
        return db - da;
    });
    sorted.forEach(op => {
        dt.row.add([
            `<span class="badge bg-warning">${op.ativo || ''}</span>`,
            `<span class="badge ${op.tipo === 'CALL' ? 'bg-success' : 'bg-danger'}">${op.tipo || ''}</span>`,
            op.cotacao_atual ? formatCurrency(op.cotacao_atual, 'USD') : '-',
            op.abertura ? formatCurrency(op.abertura, 'USD') : '-',
            op.tae ? op.tae.toFixed(2) + '%' : '-',
            op.strike ? formatCurrency(op.strike, 'USD') : '-',
            op.distancia ? op.distancia.toFixed(2) + '%' : '-',
            op.prazo || '-',
            op.crypto ? formatCrypto(op.crypto) : '-',
            op.premio_us ? formatCurrency(op.premio_us, 'USD') : '-',
            op.resultado ? `<span class="${op.resultado >= 0 ? 'text-success' : 'text-danger'}">${op.resultado.toFixed(2)}%</span>` : '-',
            op.exercicio ? formatDateCell(op.exercicio) : '-',
            op.dias || '-',
            op.exercicio_status || 'NAO',
            `<div class="btn-group">
                <button class="btn btn-sm btn-outline-primary" onclick="editOperacao(${op.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteOperacao(${op.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`
        ]);
    });
    dt.draw();
}

function formatDateCell(dateStr) {
    if (!dateStr) return '-';
    const ts = new Date(dateStr).getTime();
    return `<span data-order="${Number.isFinite(ts) ? ts : ''}">${formatDate(dateStr)}</span>`;
}

function renderHistoricoMensal() {
    const grouped = groupByMonth(allOperacoes);
    const months = Object.keys(grouped).sort().reverse();
    
    let html = '';
    months.forEach(month => {
        const data = grouped[month];
        const totals = calcTotals(data);
        const mediaDiaria = data.length > 0 ? totals.resultadoMedio / 30 : 0;
        
        html += `
        <div class="card mb-2">
            <div class="card-body py-2">
                <div class="row align-items-center">
                    <div class="col-md-2"><strong>${getMonthName(month)}</strong></div>
                    <div class="col-md-2">Total Mensal: <span class="text-success">${formatCrypto(totals.totalCrypto)}</span></div>
                    <div class="col-md-2">$ ${totals.totalPremios.toFixed(2)}</div>
                    <div class="col-md-2"><span class="text-success">${totals.resultadoMedio.toFixed(2)}%</span></div>
                    <div class="col-md-2">Media diaria: ${mediaDiaria.toFixed(2)}%</div>
                </div>
            </div>
        </div>`;
    });
    
    document.getElementById('historicoContainer').innerHTML = html;
}

function renderChartAnual(data, year) {
    const grouped = groupByMonth(data);
    const months = [];
    const values = [];
    const colors = [];
    
    for (let i = 1; i <= 12; i++) {
        const monthKey = `${year}-${String(i).padStart(2, '0')}`;
        if (grouped[monthKey]) {
            const totals = calcTotals(grouped[monthKey]);
            months.push(getMonthName(monthKey).split('-')[0].substring(0, 3));
            values.push(totals.totalPremios);
            colors.push(chartColors[i % chartColors.length]);
        }
    }
    
    // Anual header
    const anoTotals = calcTotals(data);
    const mediaMes = data.length > 0 ? anoTotals.resultadoMedio / 12 : 0;
    document.getElementById('anualHeader').innerHTML = `
        <div class="col-12 mb-3">
            <h3>${year}</h3>
            <span class="float-end text-primary">Resultado Anual</span>
        </div>
        <div class="col-md-3">
            <div class="text-muted">BTC</div>
            <div class="text-success">${formatCrypto(anoTotals.totalCrypto)}</div>
        </div>
        <div class="col-md-3">
            <div class="text-muted">USDT</div>
            <div>US$ ${anoTotals.totalPremios.toFixed(2)}</div>
        </div>
        <div class="col-md-3">
            <div class="text-muted">%</div>
            <div class="text-success">${anoTotals.resultadoMedio.toFixed(2)}%</div>
        </div>
        <div class="col-md-3">
            <div class="text-muted">Media/Mes</div>
            <div>${mediaMes.toFixed(2)}%</div>
        </div>
    `;
    
    const ctx = document.getElementById('chartAnual').getContext('2d');
    if (chartAnual) chartAnual.destroy();
    
    chartAnual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Premio (US$)',
                data: values,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true, position: 'bottom'}
            },
            scales: {
                y: {beginAtZero: true, ticks: {callback: v => '$' + v}}
            }
        }
    });
}

function openNewModal() {
    document.getElementById('modalOperacaoTitle').textContent = 'Nova Operacao';
    document.getElementById('formOperacao').reset();
    document.getElementById('operacaoId').value = '';
    document.getElementById('inputDataOperacao').value = getCurrentDate();
    new bootstrap.Modal(document.getElementById('modalOperacao')).show();
}

function editOperacao(id) {
    const op = allOperacoes.find(o => o.id === id);
    if (!op) return;
    
    document.getElementById('modalOperacaoTitle').textContent = 'Editar Operacao';
    document.getElementById('operacaoId').value = op.id;
    document.getElementById('inputAtivo').value = op.ativo || '';
    document.getElementById('inputTipo').value = op.tipo || 'CALL';
    document.getElementById('inputDataOperacao').value = op.data_operacao || '';
    document.getElementById('inputCotacaoAtual').value = op.cotacao_atual || '';
    document.getElementById('inputAbertura').value = op.abertura || '';
    document.getElementById('inputTae').value = op.tae || '';
    document.getElementById('inputStrike').value = op.strike || '';
    document.getElementById('inputDistancia').value = op.distancia || '';
    document.getElementById('inputPrazo').value = op.prazo || '';
    document.getElementById('inputCrypto').value = op.crypto || '';
    document.getElementById('inputPremioUs').value = op.premio_us || '';
    document.getElementById('inputResultado').value = op.resultado || '';
    document.getElementById('inputExercicio').value = op.exercicio || '';
    document.getElementById('inputDias').value = op.dias || '';
    document.getElementById('inputExercicioStatus').value = op.exercicio_status || 'NAO';
    
    new bootstrap.Modal(document.getElementById('modalOperacao')).show();
}

async function saveOperacao() {
    const id = document.getElementById('operacaoId').value;
    const data = {
        ativo: document.getElementById('inputAtivo').value,
        tipo: document.getElementById('inputTipo').value,
        data_operacao: document.getElementById('inputDataOperacao').value,
        cotacao_atual: parseFloat(document.getElementById('inputCotacaoAtual').value) || null,
        abertura: parseFloat(document.getElementById('inputAbertura').value) || null,
        tae: parseFloat(document.getElementById('inputTae').value) || null,
        strike: parseFloat(document.getElementById('inputStrike').value) || null,
        distancia: parseFloat(document.getElementById('inputDistancia').value) || null,
        prazo: parseInt(document.getElementById('inputPrazo').value) || null,
        crypto: parseFloat(document.getElementById('inputCrypto').value) || null,
        premio_us: parseFloat(document.getElementById('inputPremioUs').value) || null,
        resultado: parseFloat(document.getElementById('inputResultado').value) || null,
        exercicio: document.getElementById('inputExercicio').value || null,
        dias: parseInt(document.getElementById('inputDias').value) || null,
        exercicio_status: document.getElementById('inputExercicioStatus').value
    };
    
    try {
        const url = id ? `${API_BASE}/api/crypto/${id}` : `${API_BASE}/api/crypto`;
        const method = id ? 'PUT' : 'POST';
        
        await fetch(url, {
            method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        bootstrap.Modal.getInstance(document.getElementById('modalOperacao')).hide();
        iziToast.success({title: 'Sucesso', message: 'Operacao salva!'});
        loadOperacoes();
    } catch (e) {
        iziToast.error({title: 'Erro', message: 'Erro ao salvar operacao'});
    }
}

async function deleteOperacao(id) {
    const result = await Swal.fire({
        title: 'Confirmar exclusao?',
        text: 'Esta acao nao pode ser desfeita',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d63939',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
        try {
            await fetch(`${API_BASE}/api/crypto/${id}`, {method: 'DELETE'});
            iziToast.success({title: 'Sucesso', message: 'Operacao excluida!'});
            loadOperacoes();
        } catch (e) {
            iziToast.error({title: 'Erro', message: 'Erro ao excluir'});
        }
    }
}

async function refreshQuotes() {
    iziToast.info({title: 'Atualizando', message: 'Buscando cotacoes...'});
    try {
        const res = await fetch(`${API_BASE}/api/proxy/crypto/BTCUSDT`);
        const data = await res.json();
        if (data.price) {
            iziToast.success({title: 'BTC/USDT', message: `$${parseFloat(data.price).toFixed(2)}`});
        }
    } catch (e) {
        iziToast.error({title: 'Erro', message: 'Erro ao buscar cotacao'});
    }
}

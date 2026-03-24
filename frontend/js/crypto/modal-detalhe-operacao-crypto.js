/**
 * modal-detalhe-operacao-crypto.js  v2.0.0
 * Modal simples de detalhes da operação crypto (grade de informações)
 * Abre ao clicar no badge do ativo no datatable
 *
 * Expõe:
 *   window.ModalDetalheOperacaoCrypto = { show(id), ensureLoaded() }
 *   window.showDetalhesOperacao(id)   — atalho global para onclick inline
 */
(function () {
    'use strict';

    const MODAL_ID     = 'modalDetalheOperacaoCrypto';
    const CONTAINER_ID = 'modalDetalheOperacaoCryptoContainer';

    function fmtUsd(v) {
        return 'US$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // ─── Monta o HTML da modal inline (evita conflito de IDs com outros modais) ──
    function buildModalHTML() {
        return `
<div class="modal modal-blur fade" id="${MODAL_ID}" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="mdocSimpleTitle">Detalhes da Operação</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="mdocSimpleBody">
                <!-- Preenchido dinamicamente -->
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                <button type="button" class="btn btn-primary" id="mdocSimpleEditBtn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-1"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    Editar
                </button>
            </div>
        </div>
    </div>
</div>`;
    }

    let _loaded = false;

    function ensureLoaded() {
        if (_loaded) return Promise.resolve(true);
        if (document.getElementById(MODAL_ID)) { _loaded = true; return Promise.resolve(true); }
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return Promise.resolve(false);
        container.innerHTML = buildModalHTML();
        _loaded = !!document.getElementById(MODAL_ID);
        return Promise.resolve(_loaded);
    }

    async function show(id) {
        const ops = window.cryptoOperacoes || [];
        const op  = ops.find(o => o.id === id);
        if (!op) return;

        const loaded = await ensureLoaded();
        if (!loaded) return;

        const duracao   = typeof calcularDuracaoDias === 'function' ? calcularDuracaoDias(getCurrentDate(), op.exercicio) : null;
        const dist      = op._liveDist !== undefined ? op._liveDist : op.distancia;
        const cotacao   = op._livePrice || op.cotacao_atual;
        const tipoBadge = op.tipo === 'CALL'
            ? "<span class='badge crypto-badge-high fs-6'>HIGH (CALL)</span>"
            : "<span class='badge crypto-badge-low  fs-6'>LOW (PUT)</span>";
        const statusClass = (op.status || 'ABERTA') === 'ABERTA' ? 'text-success'
            : (op.status === 'FECHADA' ? 'text-secondary' : 'text-danger');

        const html = `
        <div class="row g-3">
            <div class="col-6">
                <div class="text-muted small">Ativo / Par</div>
                <div class="fw-bold fs-5">${op.ativo || '-'}/USDT ${tipoBadge}</div>
            </div>
            <div class="col-6 text-end">
                <div class="text-muted small">Status</div>
                <div class="fw-bold fs-5 ${statusClass}">${op.status || 'ABERTA'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Valor Investido</div>
                <div class="fw-bold">${op.abertura ? fmtUsd(op.abertura) : '-'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Strike</div>
                <div class="fw-bold">${op.strike ? fmtUsd(op.strike) : '-'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">TAE</div>
                <div class="fw-bold text-info">${op.tae ? parseFloat(op.tae).toFixed(2) + '% a.a.' : '-'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Cotação Atual${op._livePrice ? " <span class='badge bg-success-lt'>ao vivo</span>" : ''}</div>
                <div class="fw-bold">${cotacao ? fmtUsd(cotacao) : '-'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Distância Strike</div>
                <div class="fw-bold ${dist !== null && dist !== undefined ? (parseFloat(dist) > 0 ? 'text-success' : 'text-danger') : ''}">${dist !== null && dist !== undefined ? (parseFloat(dist) > 0 ? '+' : '') + parseFloat(dist).toFixed(2) + '% ' : '-'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Prazo</div>
                <div class="fw-bold">${duracao !== null && duracao !== undefined ? duracao + ' dias' : (op.prazo ? op.prazo + ' dias' : '-')}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Prêmio Estimado</div>
                <div class="fw-bold text-success">${op.premio_us ? fmtUsd(op.premio_us) : '-'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Resultado</div>
                <div class="fw-bold ${(op.resultado || 0) >= 0 ? 'text-success' : 'text-danger'}">${op.resultado != null ? parseFloat(op.resultado).toFixed(2) + '%' : '-'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Qtd Crypto</div>
                <div class="fw-bold">${op.crypto ? parseFloat(op.crypto).toFixed(6) : '-'} ${op.ativo || ''}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Abertura</div>
                <div class="fw-bold">${op.data_operacao ? formatDate(op.data_operacao) : '-'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Vencimento</div>
                <div class="fw-bold">${op.exercicio ? formatDate(op.exercicio) : '-'}</div>
            </div>
            <div class="col-4">
                <div class="text-muted small">Exercício</div>
                <div class="fw-bold">${op.exercicio_status === 'SIM' ? "<span class='badge bg-warning text-dark'>SIM</span>" : "<span class='badge bg-secondary'>NÃO</span>"}</div>
            </div>
            ${op.observacoes ? `<div class="col-12"><div class="text-muted small">Observações</div><div class="text-secondary">${op.observacoes}</div></div>` : ''}
        </div>`;

        document.getElementById('mdocSimpleBody').innerHTML  = html;
        document.getElementById('mdocSimpleTitle').textContent = 'Detalhes — ' + (op.ativo || '') + ' #' + op.id;
        document.getElementById('mdocSimpleEditBtn').onclick = function () {
            bootstrap.Modal.getInstance(document.getElementById(MODAL_ID)).hide();
            setTimeout(function () {
                if (typeof window.editOperacao === 'function') window.editOperacao(id);
            }, 350);
        };

        new bootstrap.Modal(document.getElementById(MODAL_ID)).show();
    }

    // ─── API pública ─────────────────────────────────────────────────────────
    window.ModalDetalheOperacaoCrypto = { show: show, ensureLoaded: ensureLoaded };
    // Ícone azul (ℹ) do datatable abre esta janela (grade simples)
    window.showDetalhes = function (id) { show(id); };

}());

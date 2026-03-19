/**
 * modal-detalhe-crypto.js  v1.0.0
 * Modal de Detalhes da Operação Crypto
 * Usa: window.cryptoOperacoes, window.editOperacao (de crypto.js)
 * Expõe: window.ModalDetalheCrypto = { show, ensureLoaded }
 */
(function () {
    'use strict';

    const TEMPLATE_PATH = 'modal-detalhe-crypto.html';
    const CONTAINER_ID  = 'modalDetalheCryptoContainer';
    const MODAL_ID      = 'modalDetalhesCrypto';

    let _loadPromise = null;

    function fmtUsd(v) {
        return 'US$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function ensureLoaded() {
        if (_loadPromise) return _loadPromise;
        _loadPromise = (async function () {
            if (document.getElementById(MODAL_ID)) return true;
            const container = document.getElementById(CONTAINER_ID);
            if (!container) return false;
            try {
                const r = await fetch(TEMPLATE_PATH + '?v=1.0.0', { cache: 'no-store' });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                container.innerHTML = await r.text();
                return !!document.getElementById(MODAL_ID);
            } catch (err) {
                console.error('[ModalDetalheCrypto] Falha ao carregar template', err);
                _loadPromise = null;
                return false;
            }
        }());
        return _loadPromise;
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

        document.getElementById('modalDetalhesBody').innerHTML  = html;
        document.getElementById('modalDetalhesTitle').textContent = 'Detalhes — ' + (op.ativo || '') + ' #' + op.id;
        document.getElementById('modalDetalhesEditBtn').onclick = function () {
            bootstrap.Modal.getInstance(document.getElementById(MODAL_ID)).hide();
            setTimeout(function () {
                if (typeof window.editOperacao === 'function') window.editOperacao(id);
            }, 350);
        };

        new bootstrap.Modal(document.getElementById(MODAL_ID)).show();
    }

    window.ModalDetalheCrypto = { show: show, ensureLoaded: ensureLoaded };

    // Retrocompatibilidade: showDetalhes() global usada pelos botões onclick nas tabelas
    window.showDetalhes = function (id) { show(id); };

}());

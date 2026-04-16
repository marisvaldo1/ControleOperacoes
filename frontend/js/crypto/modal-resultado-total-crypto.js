(function () {
    'use strict';

    const state = {
        modalId: 'modalResultadoTotalCrypto',
        triggerSelectors: ['#cardPremioTotal', '#cardTotalPremios', '[data-open-modal="resultado-total-crypto"]']
    };

    function configure(cfg = {}) {
        if (cfg.modalElId) state.modalId = cfg.modalElId;
        if (Array.isArray(cfg.triggerSelectors) && cfg.triggerSelectors.length) {
            state.triggerSelectors = cfg.triggerSelectors;
        }
    }

    function getModalEl() {
        return document.getElementById(state.modalId);
    }

    function renderIfAvailable() {
        if (window.ModalResultadoTotalCryptoRenderer && typeof window.ModalResultadoTotalCryptoRenderer.render === 'function') {
            try {
                window.ModalResultadoTotalCryptoRenderer.render();
            } catch (err) {
                console.error('[ModalResultadoTotalCrypto] falha ao renderizar:', err);
            }
        }
    }

    function openModal() {
        const modalEl = getModalEl();
        if (!modalEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
            console.warn('[ModalResultadoTotalCrypto] modal ou bootstrap indisponivel');
            return;
        }

        renderIfAvailable();
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    function bindTriggers() {
        state.triggerSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (el.dataset.rtModalBound === 'true') return;
                el.addEventListener('click', function (e) {
                    e.preventDefault();
                    openModal();
                });
                el.dataset.rtModalBound = 'true';
            });
        });
    }

    function init() {
        bindTriggers();
        renderIfAvailable();

        const refreshBtn = document.getElementById('rtCryptoRefreshBtn');
        if (refreshBtn && refreshBtn.dataset.rtModalBound !== 'true') {
            refreshBtn.addEventListener('click', function () {
                renderIfAvailable();
            });
            refreshBtn.dataset.rtModalBound = 'true';
        }
    }

    window.ModalResultadoTotalCrypto = {
        configure,
        openModal
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

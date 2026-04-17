/**
 * CryptoModalHeader - wrapper around CryptoFilterBar for crypto modals.
 */
;(function (global) {
    'use strict';

    const SVG_REFRESH = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 12a9 9 0 0 1 15.74-6.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.74 6.74L3 16"/><path d="M3 21v-5h5"/></svg>';
    const SVG_CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const SVG_ACTION = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>';

    function uid() {
        return 'mh_' + Math.random().toString(36).slice(2, 8);
    }

    function unique(arr) {
        return arr.filter(function (v, i, a) { return a.indexOf(v) === i; });
    }

    function getAsset(ativo) {
        if (global.CryptoFilterBar && global.CryptoFilterBar.getAsset) {
            return global.CryptoFilterBar.getAsset(ativo);
        }
        return (ativo || '').toUpperCase().split('/')[0].replace(/USDT$/, '').trim() || '?';
    }

    function mount(container, config) {
        const root = typeof container === 'string' ? document.querySelector(container) : container;
        if (!root) {
            console.warn('[CryptoModalHeader] container not found:', container);
            return null;
        }

        const cfg = Object.assign({
            title: 'Crypto',
            icon: '⚡',
            defaultPeriod: 'today',
            closeModalId: null,
            actionLabel: null,
            actionId: null,
            onFilter: null,
            onRefresh: null,
            onAction: null,
            showTotals: true,
        }, config || {});

        if (global.CryptoFilterBar) global.CryptoFilterBar.injectCSS();

        const id = uid();
        const idTime = id + '_time';
        const idRefresh = id + '_refresh';
        const idAction = cfg.actionId || (id + '_action');
        const idClose = id + '_close';
        const idBarHost = id + '_bar_host';
        const idBar = id + '_bar';
        const idTotals = id + '_totals';

        const state = global.CryptoFilterBar
            ? global.CryptoFilterBar.createState({ period: cfg.defaultPeriod || 'today' })
            : { period: cfg.defaultPeriod || 'today', status: null, tipo: null, asset: null, corretora: null };

        let allOpsCache = [];
        let filteredOpsCache = [];
        let openAssetsCache = [];
        let allAssetsCache = [];

        const actionHtml = cfg.actionLabel
            ? `<button class="cfb-act-btn" id="${idAction}" type="button">${SVG_ACTION}${cfg.actionLabel}</button>`
            : '';

        const closeAttr = cfg.closeModalId
            ? 'data-bs-dismiss="modal" aria-label="Fechar"'
            : `type="button" id="${idClose}"`;

        const headerHtml =
            `<div class="cfb-hdr">` +
            `<span class="cfb-icon">${cfg.icon}</span>` +
            `<span class="cfb-title">${cfg.title}<span class="cfb-live"></span></span>` +
            `<span class="cfb-time" id="${idTime}">-</span>` +
            actionHtml +
            `<button class="cfb-btn ref" id="${idRefresh}" title="Atualizar">${SVG_REFRESH}</button>` +
            `<button class="cfb-btn cls" ${closeAttr}>${SVG_CLOSE}</button>` +
            `</div>`;

        const totalsHtml = cfg.showTotals ? `<div class="cfb-totals" id="${idTotals}"></div>` : '';
        root.innerHTML = headerHtml + `<div id="${idBarHost}"></div>` + totalsHtml;

        function renderFilterBar() {
            const host = document.getElementById(idBarHost);
            if (!host || !global.CryptoFilterBar) return;

            host.innerHTML = global.CryptoFilterBar.renderFilterBar({
                id: idBar,
                state: state,
                openAssets: openAssetsCache,
                allAssets: allAssetsCache,
                showPeriods: true,
                showStatus: true,
                showTipo: true,
                showMoeda: true,
                showCorretora: true,
            });

            const barEl = document.getElementById(idBar);
            if (!barEl) return;

            global.CryptoFilterBar.bind(barEl, state, function (newState) {
                if (typeof cfg.onFilter === 'function') cfg.onFilter(newState);
            });
        }

        function updateTotals() {
            if (!cfg.showTotals || !global.CryptoFilterBar) return;
            const totalsEl = document.getElementById(idTotals);
            if (!totalsEl) return;
            totalsEl.outerHTML = global.CryptoFilterBar.renderTotals(filteredOpsCache, idTotals);
        }

        renderFilterBar();
        updateTotals();

        const refreshBtn = document.getElementById(idRefresh);
        if (refreshBtn && typeof cfg.onRefresh === 'function') {
            refreshBtn.addEventListener('click', function () {
                refreshBtn.classList.add('spin');
                Promise.resolve(cfg.onRefresh())
                    .finally(function () {
                        setTimeout(function () { refreshBtn.classList.remove('spin'); }, 500);
                    });
            });
        }

        if (cfg.actionLabel && typeof cfg.onAction === 'function') {
            const actionBtn = document.getElementById(idAction);
            if (actionBtn) actionBtn.addEventListener('click', cfg.onAction);
        }

        if (!cfg.closeModalId) {
            const closeBtn = document.getElementById(idClose);
            if (closeBtn) closeBtn.addEventListener('click', function () { root.innerHTML = ''; });
        }

        return {
            getState: function () { return state; },

            setOps: function (allOps, filteredOps) {
                allOpsCache = Array.isArray(allOps) ? allOps : [];
                filteredOpsCache = Array.isArray(filteredOps) ? filteredOps : allOpsCache;

                openAssetsCache = unique(
                    allOpsCache
                        .filter(function (o) { return (o.status || '').toUpperCase() === 'ABERTA'; })
                        .map(function (o) { return getAsset(o.ativo); })
                        .filter(Boolean)
                ).sort();

                allAssetsCache = unique(
                    allOpsCache
                        .map(function (o) { return getAsset(o.ativo); })
                        .filter(Boolean)
                ).sort();

                if (state.asset && allAssetsCache.indexOf(state.asset) === -1) {
                    state.asset = null;
                }

                renderFilterBar();
                updateTotals();
            },

            tick: function () {
                if (global.CryptoFilterBar) global.CryptoFilterBar.updateTime(idTime);
            },

            destroy: function () {
                root.innerHTML = '';
            },
        };
    }

    global.CryptoModalHeader = { mount: mount };
})(window);

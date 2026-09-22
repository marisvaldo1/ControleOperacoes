// posicoes-abertas.js — Tela de Posições Abertas (mobile-first)
(function () {
    'use strict';

    var _currentFilter = 'ALL';
    var _allOps = [];

    function usd(n) {
        return 'US$ ' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function isOpen(op) {
        var s = String(op.status || '').toUpperCase();
        return s === 'ABERTA' || s === 'ABERTO';
    }

    function getRiskStatus(op) {
        var strike = parseFloat(op.strike || 0);
        var cot = parseFloat(op.cotacao_atual || 0);
        if (!strike || !cot) return { cls: 'segura', label: 'SEGUra'.toUpperCase() };
        var dist = ((cot - strike) / strike) * 100;
        var tipo = String(op.tipo || '').toUpperCase();

        if (tipo === 'PUT') {
            // PUT: risco se cotação < strike
            if (dist < -3) return { cls: 'risco', label: 'EM RISCO' };
            if (dist < 0) return { cls: 'cuidado', label: 'CUIDADO' };
            return { cls: 'segura', label: 'SEGURA' };
        } else {
            // CALL: risco se cotação > strike
            if (dist > 3) return { cls: 'risco', label: 'EM RISCO' };
            if (dist > 0) return { cls: 'cuidado', label: 'CUIDADO' };
            return { cls: 'segura', label: 'SEGURA' };
        }
    }

    function calcDistancia(op) {
        var strike = parseFloat(op.strike || 0);
        var cot = parseFloat(op.cotacao_atual || 0);
        if (!strike || !cot) return 0;
        return ((cot - strike) / strike) * 100;
    }

    function renderCard(op) {
        var asset = String(op.ativo || '').toUpperCase().replace('USDT', '').replace('/', '').trim();
        var tipo = String(op.tipo || '').toUpperCase();
        var risk = getRiskStatus(op);
        var dist = calcDistancia(op);
        var premio = parseFloat(op.premio_us || 0);
        var strike = parseFloat(op.strike || 0);
        var cot = parseFloat(op.cotacao_atual || 0);
        var pop = op.pop != null ? parseFloat(op.pop) : null;

        return '' +
            '<div class="pa-card" data-asset="' + asset + '" data-id="' + (op.id || '') + '">' +
                '<div class="pa-card-header">' +
                    '<span class="pa-asset-badge">' + asset + '</span>' +
                    '<span class="pa-type-badge ' + tipo.toLowerCase() + '">' + tipo + '</span>' +
                    '<span class="pa-status-badge ' + risk.cls + '">' + risk.label + '</span>' +
                    (dist !== 0 ? '<span class="pa-status-badge ' + (dist > 0 ? 'cuidado' : 'segura') + '">' + (dist > 0 ? '+' : '') + dist.toFixed(1) + '%</span>' : '') +
                    '<span class="pa-premio-info">' +
                        '<span class="label">Prêmio</span>' +
                        '<span class="value">+' + usd(premio) + '</span>' +
                    '</span>' +
                '</div>' +
                '<div class="pa-card-body">' +
                    '<div class="pa-stat">' +
                        '<span class="pa-stat-label">Strike</span>' +
                        '<span class="pa-stat-value blue">' + (strike ? usd(strike) : '—') + '</span>' +
                    '</div>' +
                    '<div class="pa-stat">' +
                        '<span class="pa-stat-label">Cotação</span>' +
                        '<span class="pa-stat-value">' + (cot ? usd(cot) : '—') + '</span>' +
                    '</div>' +
                    '<div class="pa-stat">' +
                        '<span class="pa-stat-label">Distância</span>' +
                        '<span class="pa-stat-value ' + (dist >= 0 ? 'green' : 'red') + '">' + (dist >= 0 ? '+' : '') + dist.toFixed(2) + '%</span>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function render() {
        var list = document.getElementById('paList');
        if (!list) return;

        var filtered = _allOps.filter(function (op) {
            if (!isOpen(op)) return false;
            if (_currentFilter !== 'ALL') {
                var a = String(op.ativo || '').toUpperCase().replace('USDT', '').replace('/', '').trim();
                if (a !== _currentFilter) return false;
            }
            return true;
        });

        // Atualizar resumo
        var totalEl = document.getElementById('paTotalAbertas');
        var premioEl = document.getElementById('paPremioTotal');
        if (totalEl) totalEl.textContent = filtered.length;
        if (premioEl) {
            var totalPremio = filtered.reduce(function (s, op) { return s + (parseFloat(op.premio_us) || 0); }, 0);
            premioEl.textContent = usd(totalPremio);
        }

        if (!filtered.length) {
            list.innerHTML = '' +
                '<div class="pa-empty">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>' +
                    '<p>Nenhuma posição aberta encontrada</p>' +
                '</div>';
            return;
        }

        // Ordenar: risco primeiro, depois por strike
        filtered.sort(function (a, b) {
            var ra = getRiskStatus(a).cls === 'risco' ? 0 : 1;
            var rb = getRiskStatus(b).cls === 'risco' ? 0 : 1;
            if (ra !== rb) return ra - rb;
            return String(b.ativo || '').localeCompare(String(a.ativo || ''));
        });

        list.innerHTML = filtered.map(renderCard).join('');
    }

    function loadData() {
        var list = document.getElementById('paList');
        if (list) list.innerHTML = '<div class="pa-loading">Carregando posições...</div>';

        fetch(API_BASE + '/api/crypto/operacoes')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                _allOps = Array.isArray(data) ? data : (data.operacoes || data.data || []);
                // Guardar globalmente para outros scripts
                window.cryptoOperacoes = _allOps;
                render();
            })
            .catch(function (err) {
                console.error('[Posições Abertas] Erro ao carregar:', err);
                if (list) list.innerHTML = '<div class="pa-loading">Erro ao carregar dados. Verifique a conexão.</div>';
            });
    }

    function initFilters() {
        document.querySelectorAll('.pa-filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.pa-filter-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                _currentFilter = btn.getAttribute('data-asset') || 'ALL';
                render();
            });
        });
    }

    function initRefresh() {
        var btn = document.getElementById('btnRefreshPosicoes');
        if (btn) btn.addEventListener('click', loadData);
    }

    function init() {
        initFilters();
        initRefresh();
        loadData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

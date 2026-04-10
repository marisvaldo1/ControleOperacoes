(function (global) {
    function normalizeStatus(value) {
        const raw = String(value || '').trim().toUpperCase().replace('NÃO', 'NAO');
        return raw === 'SIM' || raw === 'NAO' ? raw : null;
    }

    function calculateCurrentStatusFromValues(tipo, cotacaoAtual, strike) {
        const current = parseFloat(cotacaoAtual ?? NaN);
        const strikeValue = parseFloat(strike ?? NaN);
        if (!Number.isFinite(current) || !Number.isFinite(strikeValue) || current <= 0 || strikeValue <= 0) {
            return 'NAO';
        }

        const normalizedType = String(tipo || '').trim().toUpperCase();
        if (normalizedType === 'CALL') {
            return current <= strikeValue ? 'SIM' : 'NAO';
        }
        if (normalizedType === 'PUT') {
            return current >= strikeValue ? 'SIM' : 'NAO';
        }
        return 'NAO';
    }

    function calculateCurrentStatus(op) {
        if (!op) return 'NAO';
        const provided = normalizeStatus(op.exercicio_status_atual);
        if (provided) return provided;
        return calculateCurrentStatusFromValues(
            op.tipo,
            op.cotacao_atual ?? op.preco_atual ?? op.preco,
            op.strike
        );
    }

    function resolveDisplayStatus(op) {
        if (!op) return 'NAO';

        const explicitDisplay = normalizeStatus(op.exercicio_status_exibicao);
        if (explicitDisplay) return explicitDisplay;

        const persisted = normalizeStatus(op.exercicio_status_persistido ?? op.exercicio_status);
        const current = calculateCurrentStatus(op);
        const status = String(op.status || 'ABERTA').trim().toUpperCase();

        if (status === 'ABERTA') return current;
        if (status === 'EXERCIDA') return 'SIM';
        return persisted || current;
    }

    function resolveDisplayLabel(op) {
        const status = String(op?.status || 'ABERTA').trim().toUpperCase();
        const displayStatus = resolveDisplayStatus(op);

        if (status === 'ABERTA') {
            return displayStatus === 'SIM' ? 'Possível Exercício' : 'Sem Exercício';
        }
        return displayStatus === 'SIM' ? 'SIM' : 'NÃO';
    }

    function renderBadgeHtml(op, classMap) {
        const status = String(op?.status || 'ABERTA').trim().toUpperCase();
        const displayStatus = resolveDisplayStatus(op);
        const label = resolveDisplayLabel(op);
        const classes = classMap || {};

        if (status === 'ABERTA') {
            return displayStatus === 'SIM'
                ? `<span class="badge ${classes.openPositive || 'bg-warning text-dark'}">${label}</span>`
                : `<span class="badge ${classes.openNegative || 'bg-success text-white'}">${label}</span>`;
        }

        return displayStatus === 'SIM'
            ? `<span class="badge ${classes.closedPositive || 'bg-warning text-dark'}">${label}</span>`
            : `<span class="badge ${classes.closedNegative || 'bg-secondary text-white'}">${label}</span>`;
    }

    function isExercised(op, expectedType) {
        if (!op) return false;
        const opType = String(op.tipo || '').trim().toUpperCase();
        if (expectedType && opType !== String(expectedType).trim().toUpperCase()) {
            return false;
        }
        return resolveDisplayStatus(op) === 'SIM';
    }

    global.CryptoExerciseStatus = {
        normalizeStatus,
        calculateCurrentStatusFromValues,
        calculateCurrentStatus,
        resolveDisplayStatus,
        resolveDisplayLabel,
        renderBadgeHtml,
        isExercised,
    };
})(window);
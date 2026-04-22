(function (global) {
    function formatUsd(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return 'US$ ' + Math.abs(n).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).replace(/^/, n < 0 ? '-' : '');
    }

    function parseDateSafe(raw) {
        if (!raw) return null;
        const str = String(raw).trim();
        const base = str.includes('T') ? str.split('T')[0] : str.slice(0, 10);
        const date = /^\d{4}-\d{2}-\d{2}$/.test(base)
            ? new Date(base + 'T12:00:00')
            : new Date(str);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function getOperationDate(op) {
        if (!op) return null;
        return parseDateSafe(
            op.data_vencimento || op.exercicio || op.data_operacao || op.criado_em || op.created_at || op.data
        );
    }

    function formatDayMonth(rawDate) {
        const d = rawDate instanceof Date ? rawDate : parseDateSafe(rawDate);
        if (!d) return '—';
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    function getToneFromDisplayStatus(displayStatus) {
        const normalized = normalizeStatus(displayStatus);
        if (normalized === 'SIM') {
            return {
                level: 'risk',
                accent: '#e85d4a',
                border: 'rgba(232,93,74,0.55)',
                bg: 'linear-gradient(155deg, rgba(232,93,74,0.20), rgba(33,26,30,0.94))',
            };
        }
        if (normalized === 'NAO') {
            return {
                level: 'safe',
                accent: '#47b96c',
                border: 'rgba(71,185,108,0.50)',
                bg: 'linear-gradient(155deg, rgba(71,185,108,0.18), rgba(24,35,30,0.94))',
            };
        }
        return {
            level: 'neutral',
            accent: '#f59f00',
            border: 'rgba(245,159,0,0.45)',
            bg: 'linear-gradient(155deg, rgba(245,159,0,0.16), rgba(37,32,24,0.94))',
        };
    }

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
        // CALL: exercício quando cotação SOBE acima do strike (vendedor é forçado a vender)
        if (normalizedType === 'CALL') {
            return current > strikeValue ? 'SIM' : 'NAO';
        }
        // PUT: exercício quando cotação CAI abaixo do strike (vendedor é forçado a comprar)
        if (normalizedType === 'PUT') {
            return current < strikeValue ? 'SIM' : 'NAO';
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

        const status = String(op.status || 'ABERTA').trim().toUpperCase();

        // Para operações ABERTAS: calcular pelo preço atual vs strike (ITM/OTM em tempo real)
        if (status === 'ABERTA') {
            return calculateCurrentStatus(op);
        }

        // Se a operação foi encerrada como EXERCIDA
        if (status === 'EXERCIDA') return 'SIM';

        // Para FECHADA: usar EXCLUSIVAMENTE o valor gravado no banco.
        // Nunca recalcular pelo preço atual para operações encerradas —
        // o preço atual não tem relação com o estado no momento do vencimento.
        const persisted = normalizeStatus(op.exercicio_status_persistido ?? op.exercicio_status);
        return persisted || 'NAO';
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

    /**
     * Retorna true SE a operação foi EFETIVAMENTE exercida no vencimento.
     * Regra única do sistema para verificação de exercício real:
     *   - ABERTA: sempre false (exercício não ocorreu — nunca usar cotação atual)
     *   - EXERCIDA (status): sempre true
     *   - FECHADA: lê EXCLUSIVAMENTE o campo exercicio_status do banco
     * Nunca recalcula pelo preço atual para operações encerradas.
     */
    function isActuallyExercised(op) {
        if (!op) return false;
        const status = String(op.status || 'ABERTA').trim().toUpperCase();
        if (status === 'ABERTA') return false;
        if (status === 'EXERCIDA') return true;
        const persisted = normalizeStatus(op.exercicio_status_persistido ?? op.exercicio_status);
        return persisted === 'SIM';
    }

    global.CryptoExerciseStatus = {
        normalizeStatus,
        calculateCurrentStatusFromValues,
        calculateCurrentStatus,
        resolveDisplayStatus,
        resolveDisplayLabel,
        renderBadgeHtml,
        isExercised,
        isActuallyExercised,
        formatUsd,
        parseDateSafe,
        getOperationDate,
        formatDayMonth,
        getToneFromDisplayStatus,
    };
})(window);
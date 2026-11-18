/**
 * historico-opcoes.js
 * Aba "Histórico" da página de Opções — layout mestre-detalhes (paridade com Crypto):
 *  - Índice de meses (esquerda) com prêmio e média
 *  - Painel do mês selecionado (direita) com KPIs, CALL×PUT, prêmio por ativo base
 *    e tabela das operações do mês (mesmo DataTable do Mês Atual via window.populateTable)
 *
 * Fonte de dados: window.opcoesOperacoes / window.allOperacoes / evento "opcoesDataUpdated".
 * A renderização é disparada por opcoes.js (updateUI → renderHistoricoMensal).
 */
;(function (global) {
    'use strict';

    let _sel = null;
    let _bound = false;
    let _table = null;

    function num(v) {
        if (typeof global.parseFloatSafe === 'function') return global.parseFloatSafe(v);
        return parseFloat(v) || 0;
    }

    function premioTotal(op) {
        const premio = num(op.premio);
        const qtd = Math.abs(parseInt(op.quantidade || 0, 10)) || 1;
        return premio * qtd;
    }

    function premioOf(ops) {
        return (ops || []).reduce((s, o) => s + premioTotal(o), 0);
    }

    function brl(v) {
        if (typeof global.formatCurrency === 'function') return global.formatCurrency(parseFloat(v) || 0, 'BRL');
        return 'R$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtDate(raw) {
        if (!raw) return '-';
        if (typeof global.formatDateCell === 'function') return global.formatDateCell(raw);
        const s = String(raw).slice(0, 10);
        const p = s.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
    }

    function saldoCorretora() {
        try { return num(JSON.parse(localStorage.getItem('appConfig') || '{}').saldoAcoes); }
        catch (e) { return 0; }
    }

    function resultadoMedio(ops) {
        const saldo = saldoCorretora();
        const total = (ops || []).reduce((s, o) => s + num(o.resultado), 0);
        return saldo > 0 ? (total / saldo) * 100 : 0;
    }

    function mesAtualKey() {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }

    function getOps() {
        return global.opcoesOperacoes || global.allOperacoes || [];
    }

    function histAnoAtual() {
        const sel = document.getElementById('selectAno');
        const v = sel ? String(sel.value || '') : '';
        return v && v !== 'todos' ? v : null;
    }

    function histMonths() {
        const grouped = (typeof global.groupByMonth === 'function') ? global.groupByMonth(getOps()) : {};
        let months = Object.keys(grouped).sort().reverse();
        const ano = histAnoAtual();
        if (ano) months = months.filter(m => m.substring(0, 4) === String(ano));
        return months.map(k => ({ k, ops: grouped[k] }));
    }

    function buildTable(ops) {
        const el = document.getElementById('tableHistMes');
        if (!el) return;
        if (!global.jQuery || !global.jQuery.fn || !global.jQuery.fn.dataTable) return;
        if (_table) { try { _table.destroy(); } catch (e) { /* noop */ } }
        _table = global.jQuery('#tableHistMes').DataTable({
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json' },
            order: [],
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'Todos']],
            scrollX: true,
            autoWidth: false,
            columnDefs: [{ targets: 15, orderable: false }]
        });
        if (typeof global.populateTable === 'function') {
            // isHistorico = true → mesmas ações do DataTable principal
            global.populateTable(_table, ops, true, false, true);
        }
        // Liga os botões de ação (Detalhes/Editar/Finalizar/Excluir) das linhas novas
        if (typeof global.setupOpcoesDynamicEventListeners === 'function') {
            global.setupOpcoesDynamicEventListeners();
        }
    }

    function render() {
        const host = document.getElementById('historicoContainer');
        if (!host) return;

        if (!_bound) {
            _bound = true;
            host.addEventListener('click', function (e) {
                const b = e.target && e.target.closest ? e.target.closest('.mitem') : null;
                if (!b || !host.contains(b)) return;
                _sel = b.getAttribute('data-k');
                render();
            });
            document.addEventListener('anoSelecionado', function () { render(); });
        }

        const months = histMonths();
        if (!months.length) {
            host.innerHTML = '<div class="text-muted text-center py-4">Nenhum histórico disponível.</div>';
            return;
        }
        if (!_sel || !months.some(m => m.k === _sel)) _sel = months[0].k;

        const maxP = Math.max.apply(null, months.map(m => premioOf(m.ops))) || 1;
        const curK = mesAtualKey();

        // ── Índice de meses (esquerda) ──
        let idx = '';
        months.forEach(m => {
            const p = premioOf(m.ops);
            const med = resultadoMedio(m.ops);
            idx += '<button type="button" class="mitem' + (m.k === _sel ? ' sel' : '') + '" data-k="' + m.k + '">' +
                '<div class="mitem__top">' + global.getMonthName(m.k) + '<span>' + brl(p) + '</span></div>' +
                '<div class="mitem__bar"><i style="width:' + (p / maxP * 100).toFixed(1) + '%"></i></div>' +
                '<small>' + m.ops.length + ' ops · média ' + med.toFixed(2) + '%' +
                (m.k === curK ? ' · em andamento' : '') + '</small></button>';
        });

        // ── Painel do mês selecionado (direita) ──
        const sel = months.find(m => m.k === _sel);
        const ops = sel.ops;
        const premio = premioOf(ops);
        const medio = resultadoMedio(ops);
        let call = 0, put = 0, fech = 0, exe = 0;
        const byA = {};
        ops.forEach(o => {
            const p = premioTotal(o);
            if (String(o.tipo || '').toUpperCase() === 'CALL') call += p; else put += p;
            const a = String(o.ativo_base || o.ativo || '-').toUpperCase();
            byA[a] = (byA[a] || 0) + p;
            if (String(o.status || 'ABERTA').toUpperCase() !== 'ABERTA') {
                fech++;
                if (String(o.status || '').toUpperCase() === 'EXERCIDA') exe++;
            }
        });
        const totalCP = call + put;
        const cpPct = totalCP > 0 ? (call / totalCP * 100) : 50;
        const ativos = Object.keys(byA).sort((x, y) => byA[y] - byA[x]);
        const maxA = ativos.length ? byA[ativos[0]] : 1;

        let h = '<div class="md">';
        h += '<div class="md-side"><h2>Meses</h2><div class="mlist">' + idx + '</div></div>';
        h += '<div>';
        h += '<div class="md-card"><h2>' + global.getMonthName(sel.k) +
            (sel.k === curK ? ' <span class="md-tag">em andamento</span>' : '') + '</h2>' +
            '<div class="kpis">' +
            '<div class="kpi"><div class="kpi__icon blue"><i class="fa-solid fa-dollar-sign"></i></div>' +
            '<div class="kpi__body"><div class="kpi__lbl">Prêmio</div><div class="kpi__val green">' + brl(premio) + '</div></div></div>' +
            '<div class="kpi"><div class="kpi__icon green"><i class="fa-solid fa-check"></i></div>' +
            '<div class="kpi__body"><div class="kpi__lbl">Operações</div><div class="kpi__val">' + ops.length + '</div></div></div>' +
            '<div class="kpi"><div class="kpi__icon blue"><i class="fa-solid fa-percent"></i></div>' +
            '<div class="kpi__body"><div class="kpi__lbl">Média</div><div class="kpi__val">' + medio.toFixed(2) + '%</div></div></div>' +
            '<div class="kpi"><div class="kpi__icon red"><i class="fa-solid fa-bolt"></i></div>' +
            '<div class="kpi__body"><div class="kpi__lbl">Taxa de exercício</div><div class="kpi__val">' +
            (fech ? (exe / fech * 100).toFixed(0) + '% (' + exe + '/' + fech + ')' : '—') +
            '</div></div></div>' +
            '</div></div>';
        h += '<div class="grid2">';
        h += '<div class="md-card"><h2>CALL × PUT <small>por prêmio</small></h2>' +
            '<div class="splitbar"><i style="width:' + cpPct.toFixed(1) + '%;background:#d5d8df"></i>' +
            '<i style="width:' + (100 - cpPct).toFixed(1) + '%;background:#a78bfa"></i></div>' +
            '<div class="split-legend"><span><b class="mono">CALL</b> ' + brl(call) + '</span>' +
            '<span><b class="mono" style="color:#c4b5fd">PUT</b> ' + brl(put) + '</span></div></div>';
        h += '<div class="md-card"><h2>Prêmio por ativo base</h2>';
        ativos.forEach(a => {
            h += '<div class="brow"><span class="coin other">' + a + '</span>' +
                '<div class="btrack"><i style="width:' + (maxA ? byA[a] / maxA * 100 : 0).toFixed(1) +
                '%;background:#94a3b8"></i></div>' +
                '<span class="mono" style="text-align:right">' + brl(byA[a]) + '</span></div>';
        });
        h += '</div></div>';
        h += '<div class="md-card"><h2>Operações do mês <small>mais recentes primeiro</small></h2>';
        h += '<table id="tableHistMes" class="table table-vcenter card-table"><thead><tr>' +
            '<th>Ativo Base</th><th>Ativo</th><th>Tipo</th><th>Preço Atual</th><th>Preço Entrada</th>' +
            '<th>Quantidade</th><th>Strike</th><th>Prêmio</th><th>Resultado</th><th>%</th>' +
            '<th>PoP</th><th>Vencimento</th><th>Duração (dias)</th><th>Exercício</th><th>Status</th><th>Ações</th>' +
            '</tr></thead><tbody></tbody></table></div>';
        h += '</div></div>';

        host.innerHTML = h;
        buildTable(ops);
    }

    global.HistoricoOpcoes = { render: render };
})(window);

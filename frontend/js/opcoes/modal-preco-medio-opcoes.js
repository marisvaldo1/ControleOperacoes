/**
 * modal-preco-medio-opcoes.js
 * Modal "Preço Médio" com Mapa de Calor por ativo base (Opções) —
 * paridade visual com frontend/js/crypto/modal-preco-medio-crypto.js,
 * adaptado ao domínio de opções (BRL, sem APIs externas).
 *
 * Convenções de domínio:
 *  - Prêmio total da operação = premio × |quantidade|, com sinal:
 *    VENDA = + (receita de prêmio), COMPRA = − (custo de prêmio).
 *  - Exercida: status === 'EXERCIDA'.
 *  - Preço médio: window.ModalPrecoMedioAtivoOpcoes.computeData().
 *
 * API: window.ModalPrecoMedioOpcoes = { open, close }
 */
(function () {
    'use strict';

    var _modalOverlay = null;
    var _currentAtivo = null;
    var _dayOpsMap = {}; // id da célula -> { date, ops, total }

    var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    function num(v) {
        if (typeof window.parseFloatSafe === 'function') return window.parseFloatSafe(v);
        return parseFloat(v) || 0;
    }

    function fmtBRL(n) {
        var neg = n < 0;
        return (neg ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }
    var fmtUS = fmtBRL; // alias: mesmas assinaturas do fonte crypto

    function fmtPrice(n) {
        return 'R$ ' + Math.abs(n).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function fmtDate(d) {
        return String(d.getDate()).padStart(2, '0') + '/' +
               String(d.getMonth() + 1).padStart(2, '0') + '/' +
               d.getFullYear();
    }

    function colorForPnl(pnl, maxAbs) {
        if (pnl === null || maxAbs === 0) return '#141d33';
        var t = Math.min(1, Math.abs(pnl) / maxAbs);
        if (pnl >= 0) {
            // verde: escuro → claro (receita de prêmio)
            var g1 = [22, 101, 52], g2 = [74, 222, 128];
            var r = Math.round(g1[0] + (g2[0] - g1[0]) * t),
                g = Math.round(g1[1] + (g2[1] - g1[1]) * t),
                b = Math.round(g1[2] + (g2[2] - g1[2]) * t);
            return 'rgb(' + r + ',' + g + ',' + b + ')';
        } else {
            // vermelho: escuro → claro (custo de prêmio)
            var r1 = [127, 29, 43], r2 = [239, 68, 68];
            var rr = Math.round(r1[0] + (r2[0] - r1[0]) * t),
                rg = Math.round(r1[1] + (r2[1] - r1[1]) * t),
                rb = Math.round(r1[2] + (r2[2] - r1[2]) * t);
            return 'rgb(' + rr + ',' + rg + ',' + rb + ')';
        }
    }

    // ─── Data da operação ───
    function getOpDate(op) {
        var raw = op.data_operacao || op.created_at || '';
        if (!raw) return null;
        var d = new Date(String(raw).split('T')[0] + 'T00:00:00');
        return isNaN(d.getTime()) ? null : d;
    }

    function qtdOf(op) {
        return Math.abs(parseInt(op && op.quantidade, 10)) || 1;
    }

    // ─── Prêmio total com sinal (VENDA = receita, COMPRA = custo) ───
    function getPremio(op) {
        var total = num(op.premio) * qtdOf(op);
        return String(op.tipo_operacao || '').toUpperCase() === 'COMPRA' ? -total : total;
    }

    // ─── Exercida: status EXERCIDA ───
    function isExercised(op) {
        return String((op && op.status) || '').toUpperCase() === 'EXERCIDA';
    }

    // ─── Estatísticas do período ───
    function calcStats(ops, priceOps, basePriceOps) {
        var totalOps = ops.length;
        var totalPremio = 0;

        ops.forEach(function (op) {
            totalPremio += getPremio(op);
        });

        var averagePremium = totalOps > 0 ? totalPremio / totalOps : 0;

        // Preço médio via módulo por ativo (mesmas posições do período)
        var precoMedio = 0;
        if (window.ModalPrecoMedioAtivoOpcoes && typeof window.ModalPrecoMedioAtivoOpcoes.computeData === 'function') {
            var pmData = window.ModalPrecoMedioAtivoOpcoes.computeData(_currentAtivo, undefined, priceOps, basePriceOps);
            if (pmData && pmData.pm > 0) precoMedio = pmData.pm;
        }

        return { totalOps: totalOps, totalPremio: totalPremio, averagePremium: averagePremium, precoMedio: precoMedio };
    }

    function getMonthOps(ops, monthIndex) {
        return ops.filter(function (op) {
            var date = getOpDate(op);
            return date && date.getMonth() === monthIndex;
        });
    }

    function setPeriodLabel(monthIndex) {
        var label = document.getElementById('pmKpiPeriodLabel');
        if (label) label.textContent = monthIndex === null ? 'Prêmio do Período' : 'Prêmios de ' + MESES[monthIndex];
    }

    function getPriceOpsAtMonthClose(allOps, year, monthIndex) {
        var monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        return allOps.filter(function (op) {
            var date = getOpDate(op);
            return date && date <= monthEnd;
        });
    }

    function getOperationState(op) {
        var status = String(op && op.status || '').toUpperCase();
        var isOpen = status === 'ABERTA' || status === 'ABERTO';
        return {
            label: isOpen ? 'ABERTA' : 'FECHADA',
            className: isOpen ? 'pm-operation-open' : 'pm-operation-closed',
        };
    }

    function filterOperations(ops, filters) {
        return ops.filter(function (op) {
            var type = (op.tipo || '').toUpperCase();
            if (filters.tipo !== 'ALL' && type !== filters.tipo) return false;
            if (filters.exercida === 'EXERCISED' && !isExercised(op)) return false;
            if (filters.exercida === 'NOT_EXERCISED' && isExercised(op)) return false;
            return true;
        });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatOperationValue(value) {
        var number = parseFloat(value || 0);
        return number > 0 ? fmtPrice(number) : '—';
    }

    function formatOperationDate(value) {
        if (!value) return '—';
        var date = new Date(String(value).split('T')[0] + 'T00:00:00');
        return isNaN(date.getTime()) ? '—' : fmtDate(date);
    }

    function getExerciseLabel(op) {
        return isExercised(op) ? 'EXERCIDA' : 'NÃO EXERCIDA';
    }

    // ─── Agrupa operações por dia do ano ───
    function groupByDay(ops) {
        var dayOpsMap = {}; // { date, ops, total }
        var allPnls = [];

        ops.forEach(function (op) {
            var d = getOpDate(op);
            if (!d) return;

            var mIdx = d.getMonth();
            var cellId = 'm' + mIdx + 'd' + d.getDate();

            if (!dayOpsMap[cellId]) {
                dayOpsMap[cellId] = { date: d, ops: [], total: 0 };
            }

            dayOpsMap[cellId].ops.push(op);
            dayOpsMap[cellId].total += getPremio(op);
            allPnls.push(Math.abs(dayOpsMap[cellId].total));
        });

        var maxAbs = Math.max.apply(null, allPnls.concat([1]));
        return { dayOpsMap: dayOpsMap, maxAbs: maxAbs };
    }

    // ─── Render KPIs ───
    function renderKPIs(stats) {
        var el = function (id) { return document.getElementById(id); };

        el('pmKpiPnl').textContent = fmtUS(stats.totalPremio);
        el('pmKpiOps').textContent = String(stats.totalOps);
        el('pmKpiAveragePremium').textContent = fmtUS(stats.averagePremium);

        var pmLink = el('pmPriceMedioLink');
        if (pmLink) {
            pmLink.textContent = fmtPrice(stats.precoMedio);
            pmLink.onclick = function (e) {
                e.stopPropagation();
                closeModal();
                setTimeout(function () {
                    if (window.ModalPrecoMedioAtivoOpcoes && typeof window.ModalPrecoMedioAtivoOpcoes.openModal === 'function') {
                        window.ModalPrecoMedioAtivoOpcoes.openModal(_currentAtivo);
                    }
                }, 300);
            };
        }
    }

    // ─── Render Heatmap ───
    function renderHeatmap(ops, allOpsAtivo, year, filters) {
        var activeFilters = filters || { tipo: 'ALL', exercida: 'ALL' };
        var filteredOps = filterOperations(ops, activeFilters);
        var filteredAllOps = filterOperations(allOpsAtivo, activeFilters);
        var groupData = groupByDay(filteredOps);
        _dayOpsMap = groupData.dayOpsMap;
        var maxAbs = groupData.maxAbs;

        var heatWrap = document.getElementById('pmHeatWrap');
        if (!heatWrap) return;

        // Agrupa por mês
        var monthsData = {};
        Object.keys(_dayOpsMap).forEach(function (cellId) {
            var info = _dayOpsMap[cellId];
            var mIdx = info.date.getMonth();
            var mName = MESES[mIdx];

            if (!monthsData[mName]) {
                monthsData[mName] = { mIdx: mIdx, cells: [] };
            }

            var tipo = info.ops[0] && (info.ops[0].tipo || '').toUpperCase();
            var exercida = info.ops[0] && isExercised(info.ops[0]);
            var multi = info.ops.length > 1;

            monthsData[mName].cells.push({
                id: cellId,
                date: info.date,
                pnl: info.total,
                tipo: tipo || 'PUT',
                exercida: exercida,
                multi: multi,
            });
        });

        // Ordena meses do mais recente para o mais antigo
        var sortedMonths = Object.keys(monthsData).sort(function (a, b) {
            return monthsData[b].mIdx - monthsData[a].mIdx;
        });

        heatWrap.innerHTML = sortedMonths.map(function (mName) {
            var m = monthsData[mName];
            var cells = m.cells.map(function (c) {
                var bg = colorForPnl(c.pnl, maxAbs);
                var ringClass = c.exercida ? (c.tipo === 'PUT' ? 'pm-exercida-put' : 'pm-exercida-call') : '';
                var multiClass = c.multi ? 'pm-multi' : '';

                return '<div class="pm-cell ' + ringClass + ' ' + multiClass + '" ' +
                    'style="background:' + bg + '" ' +
                    'data-id="' + c.id + '" ' +
                    'data-date="' + fmtDate(c.date) + '" ' +
                    'data-tipo="' + c.tipo + '" ' +
                    'data-exercida="' + c.exercida + '" ' +
                    'data-pnl="' + c.pnl + '" ' +
                    'data-multi="' + c.multi + '"></div>';
            }).join('');

            return '<div class="pm-heat-month" data-month="' + m.mIdx + '">' +
                '<button type="button" class="pm-month-name" data-month="' + m.mIdx + '" aria-pressed="false" title="Filtrar por ' + mName + '">' +
                    '<span class="pm-month-link-label">' + mName + '</span><span class="pm-month-link-icon" aria-hidden="true">↗</span>' +
                '</button>' +
                '<div class="pm-heat-cells">' + cells + '</div>' +
            '</div>';
        }).join('');

        // Attach event listeners
        var tooltip = document.getElementById('pm-tooltip');
        var ttHead = document.getElementById('pmTtHead');
        var ttBody = document.getElementById('pmTtBody');

        document.querySelectorAll('.pm-filter-button[data-filter-group]').forEach(function (button) {
            var isActive = button.getAttribute('data-filter-group') === 'tipo'
                ? button.getAttribute('data-filter-value') === activeFilters.tipo
                : button.getAttribute('data-filter-value') === activeFilters.exercida;
            button.classList.toggle('pm-filter-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
            button.onclick = function () {
                var nextFilters = {
                    tipo: activeFilters.tipo,
                    exercida: activeFilters.exercida,
                };
                nextFilters[button.getAttribute('data-filter-group')] = button.getAttribute('data-filter-value');

                var filteredForCards = filterOperations(ops, nextFilters);
                var filteredHistory = filterOperations(allOpsAtivo, nextFilters);
                setPeriodLabel(null);
                renderKPIs(calcStats(filteredForCards, filteredHistory, allOpsAtivo));
                closeDayDetail();
                tooltip.style.display = 'none';
                renderHeatmap(ops, allOpsAtivo, year, nextFilters);
            };
        });

        var resetMonth = document.getElementById('pmResetMonth');
        if (resetMonth) {
            resetMonth.onclick = function () {
                heatWrap.querySelectorAll('.pm-month-name.pm-selected').forEach(function (selected) {
                    selected.classList.remove('pm-selected');
                    selected.setAttribute('aria-pressed', 'false');
                });
                setPeriodLabel(null);
                renderKPIs(calcStats(filteredOps, filteredAllOps, allOpsAtivo));
                closeDayDetail();
                tooltip.style.display = 'none';
            };
        }

        heatWrap.querySelectorAll('.pm-month-name').forEach(function (monthEl) {
            monthEl.addEventListener('click', function () {
                var monthIndex = parseInt(monthEl.getAttribute('data-month'), 10);
                var monthOps = getMonthOps(filteredOps, monthIndex);
                var monthCloseOps = getPriceOpsAtMonthClose(filteredAllOps, year, monthIndex);
                var monthBaseOps = getPriceOpsAtMonthClose(allOpsAtivo, year, monthIndex);

                heatWrap.querySelectorAll('.pm-month-name.pm-selected').forEach(function (selected) {
                    selected.classList.remove('pm-selected');
                    selected.setAttribute('aria-pressed', 'false');
                });
                monthEl.classList.add('pm-selected');
                monthEl.setAttribute('aria-pressed', 'true');

                setPeriodLabel(monthIndex);
                renderKPIs(calcStats(monthOps, monthCloseOps, monthBaseOps));
                closeDayDetail();
                tooltip.style.display = 'none';
            });
        });

        heatWrap.querySelectorAll('.pm-cell:not(.pm-empty)').forEach(function (c) {
            c.addEventListener('mousemove', function (e) {
                var tipo = c.getAttribute('data-tipo');
                var exercida = c.getAttribute('data-exercida') === 'true';
                var pnl = parseFloat(c.getAttribute('data-pnl'));
                var multi = c.getAttribute('data-multi') === 'true';
                var date = c.getAttribute('data-date');
                var info = _dayOpsMap[c.getAttribute('data-id')];
                var operation = info && info.ops[0];
                var operationState = getOperationState(operation);

                ttHead.className = 'pm-tt-head pm-' + tipo.toLowerCase();
                ttHead.innerHTML = (tipo === 'PUT' ? '🔵' : '🔷') + ' Operação ' + tipo + ' — ' + escapeHtml((operation && operation.ativo_base || _currentAtivo).toUpperCase());

                ttBody.innerHTML =
                    '<div class="pm-tt-line"><span class="pm-tt-k">📅 Data</span><span class="pm-tt-v">' + date + '</span></div>' +
                    '<div class="pm-tt-line"><span class="pm-tt-k">🏷️ Tipo</span><span class="pm-tt-v">' + tipo + '</span></div>' +
                    '<div class="pm-tt-line"><span class="pm-tt-k">📌 Situação</span><span class="pm-tt-badge ' + operationState.className + '">' + operationState.label + '</span></div>' +
                    '<div class="pm-tt-line"><span class="pm-tt-k">⚙️ Status</span><span class="pm-tt-badge ' + (exercida ? 'pm-exercida' : 'pm-nao') + '">' + (exercida ? 'EXERCIDA' : 'NÃO EXERCIDA') + '</span></div>' +
                    (multi ? '<div class="pm-tt-line"><span class="pm-tt-k">📦 Operações</span><span class="pm-tt-v">2+</span></div>' : '') +
                    '<div class="pm-tt-line"><span class="pm-tt-k">💰 Prêmio do dia</span><span class="pm-tt-v ' + (pnl >= 0 ? 'pm-pos' : 'pm-neg') + '">' + fmtUS(pnl) + '</span></div>';

                tooltip.style.display = 'block';
                var x = e.clientX + 16, y = e.clientY + 16;
                if (x + 230 > window.innerWidth) x = e.clientX - 230;
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
            });

            c.addEventListener('mouseleave', function () {
                tooltip.style.display = 'none';
            });

            c.addEventListener('click', function () {
                var id = c.getAttribute('data-id');
                var info = _dayOpsMap[id];
                if (!info) return;

                heatWrap.querySelectorAll('.pm-cell.pm-selected').forEach(function (x) {
                    x.classList.remove('pm-selected');
                });
                c.classList.add('pm-selected');

                heatWrap.querySelectorAll('.pm-day-detail').forEach(function (d) {
                    d.remove();
                });

                var opsHTML = info.ops.map(function (o) {
                    var tipo = (o.tipo || '').toUpperCase();
                    var asset = (o.ativo || o.ativo_base || _currentAtivo).toUpperCase();
                    var exercida = isExercised(o);
                    var operationState = getOperationState(o);
                    var valor = num(o.premio) * qtdOf(o);
                    var dataEntrada = formatOperationDate(o.data_operacao || o.created_at);
                    var dataFechamento = formatOperationDate(o.vencimento);
                    var strike = formatOperationValue(o.strike);
                    var cotacao = formatOperationValue(o.preco_atual);
                    var topLabel = String(o.tipo_operacao || '').toUpperCase();
                    var stampClass = exercida ? 'pm-stamp-exercida' : 'pm-stamp-nao';
                    return '<div class="pm-rc-card">' +
                        '<div class="pm-rc-stamp ' + stampClass + '">' + getExerciseLabel(o) + '</div>' +
                        '<div class="pm-rc-asset">' +
                            '<b>' + escapeHtml(asset) + '</b>' +
                            '<span class="pm-badge pm-badge-' + tipo.toLowerCase() + '">' + tipo + '</span>' +
                            '<span class="pm-badge pm-badge-' + operationState.className + '">' + operationState.label + '</span>' +
                        '</div>' +
                        '<div class="pm-rc-row"><span>Operação</span><span>' + escapeHtml(topLabel || '—') + '</span></div>' +
                        '<div class="pm-rc-row"><span>Entrada</span><span>' + dataEntrada + '</span></div>' +
                        '<div class="pm-rc-row"><span>Vencimento</span><span>' + dataFechamento + '</span></div>' +
                        '<div class="pm-rc-row"><span>Strike</span><span>' + strike + '</span></div>' +
                        '<div class="pm-rc-row"><span>Cotação</span><span>' + cotacao + '</span></div>' +
                        '<div class="pm-rc-total">' +
                            '<span class="pm-rc-total-lbl">Prêmio total</span>' +
                            '<span class="pm-rc-total-val ' + (valor >= 0 ? 'pm-pos' : 'pm-neg') + '">' + fmtUS(valor) + '</span>' +
                        '</div>' +
                    '</div>';
                }).join('');

                var detailHTML = '<div class="pm-dd-head">' +
                    '<div>' +
                        '<div class="pm-dd-date">' + fmtDate(info.date) + '</div>' +
                        '<div class="pm-dd-total ' + (info.total >= 0 ? 'pm-pos' : 'pm-neg') + '">Total do dia: ' + fmtUS(info.total) + '</div>' +
                    '</div>' +
                    '<button type="button" class="pm-dd-close">✕</button>' +
                '</div>' +
                '<div class="pm-dd-ops">' + opsHTML + '</div>';

                var detail = document.createElement('div');
                detail.className = 'pm-day-detail pm-open';
                detail.innerHTML = detailHTML;

                var monthEl = c.closest('.pm-heat-month');
                if (monthEl) {
                    monthEl.appendChild(detail);
                }

                tooltip.style.display = 'none';
            });
        });
    }

    // ─── Close day detail ───
    function closeDayDetail() {
        var heatWrap = document.getElementById('pmHeatWrap');
        if (heatWrap) {
            heatWrap.querySelectorAll('.pm-day-detail').forEach(function (d) {
                d.remove();
            });
            heatWrap.querySelectorAll('.pm-cell.pm-selected').forEach(function (x) {
                x.classList.remove('pm-selected');
            });
        }
    }

    // ─── Open Modal ───
    function openModal(ativo) {
        var allOps = window.opcoesOperacoes || window.allOperacoes || [];

        // Sem ativo informado: usa o primeiro ativo base com operações
        if (!ativo) {
            var bases = {};
            allOps.forEach(function (op) {
                var b = String(op.ativo_base || op.ativo || '').toUpperCase().trim();
                if (b) bases[b] = true;
            });
            var list = Object.keys(bases).sort();
            ativo = list.length ? list[0] : 'OPÇÕES';
        }
        _currentAtivo = String(ativo).toUpperCase();

        if (!_modalOverlay) {
            var container = document.getElementById('modalPrecoMedioContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'modalPrecoMedioContainer';
                document.body.appendChild(container);
            }

            fetch('../html/modal-preco-medio-opcoes.html', { cache: 'no-store' })
                .then(function (r) { return r.text(); })
                .then(function (html) {
                    container.innerHTML = html;
                    _modalOverlay = document.getElementById('pmModalOverlay');
                    _attachEventListeners();
                    _render();
                })
                .catch(function (err) {
                    console.error('[opcoes] Erro ao carregar modal de Preço Médio:', err);
                });
        } else {
            _render();
        }

        function _render() {
            document.getElementById('pmModalTitle').textContent = '🗓️ Mapa de calor anual — ' + _currentAtivo;

            // Operações do ativo base
            var allOpsAtivo = allOps.filter(function (op) {
                var b = String(op.ativo_base || op.ativo || '').toUpperCase().trim();
                return b === _currentAtivo;
            });

            var year = new Date().getFullYear();
            var ops = allOpsAtivo.filter(function (op) {
                var d = getOpDate(op);
                return d && d.getFullYear() === year;
            });

            var stats = calcStats(ops);
            setPeriodLabel(null);
            renderKPIs(stats);
            renderHeatmap(ops, allOpsAtivo, year);

            _modalOverlay.style.display = 'flex';
        }
    }

    // ─── Refresh Modal (recarrega os dados do ativo atual) ───
    function refresh() {
        if (_currentAtivo) openModal(_currentAtivo);
    }

    // ─── Close Modal ───
    function closeModal() {
        closeDayDetail();
        if (_modalOverlay) {
            _modalOverlay.style.display = 'none';
        }
    }

    // ─── Attach Event Listeners ───
    function _attachEventListeners() {
        if (!_modalOverlay) return;

        document.getElementById('pmModalClose').onclick = closeModal;

        var refreshBtn = document.getElementById('pmModalRefresh');
        if (refreshBtn) refreshBtn.onclick = function () { refresh(); };

        var heatWrap = document.getElementById('pmHeatWrap');
        if (heatWrap) {
            heatWrap.addEventListener('click', function (e) {
                if (e.target.closest('.pm-dd-close')) {
                    closeDayDetail();
                }
            });
        }

        _modalOverlay.onclick = function (e) {
            if (e.target === _modalOverlay) closeModal();
        };
    }

    // ─── Init: botão do header ───
    function init() {
        var btn = document.getElementById('btnPrecoMedioOpcoes');
        if (btn && !btn.dataset.pmBound) {
            btn.dataset.pmBound = 'true';
            btn.addEventListener('click', function () {
                if (window.ModalPrecoMedioOpcoes && typeof window.ModalPrecoMedioOpcoes.open === 'function') {
                    window.ModalPrecoMedioOpcoes.open();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ModalPrecoMedioOpcoes = { open: openModal, close: closeModal, refresh: refresh };
})();

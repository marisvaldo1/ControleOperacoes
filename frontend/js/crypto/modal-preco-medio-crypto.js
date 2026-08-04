// modal-preco-medio-crypto.js v3.0.0
// Modal Preço Médio com Mapa de Calor por Ativo — Redesenhado 2025
// Design baseado em: ideias/ClaudPrecoMedioCalor.html
(function () {
  'use strict';

  var _modalOverlay = null;
  var _currentAtivo = null;
  var _dayOpsMap = {}; // id da célula -> { date, ops, total }

  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
               'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var TIPOS = ['PUT', 'CALL'];

  function fmtUS(n) {
    var neg = n < 0;
    return (neg ? '-' : '+') + 'US$ ' + Math.abs(n).toFixed(2);
  }

  function fmtPrice(n) {
    return 'US$ ' + Math.abs(n).toLocaleString('en-US', {
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
      // verde: escuro → claro
      var g1 = [22, 101, 52], g2 = [74, 222, 128];
      var r = Math.round(g1[0] + (g2[0] - g1[0]) * t),
          g = Math.round(g1[1] + (g2[1] - g1[1]) * t),
          b = Math.round(g1[2] + (g2[2] - g1[2]) * t);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    } else {
      // vermelho: escuro → claro
      var r1 = [127, 29, 43], r2 = [239, 68, 68];
      var rr = Math.round(r1[0] + (r2[0] - r1[0]) * t),
          rg = Math.round(r1[1] + (r2[1] - r1[1]) * t),
          rb = Math.round(r1[2] + (r2[2] - r1[2]) * t);
      return 'rgb(' + rr + ',' + rg + ',' + rb + ')';
    }
  }

  // ─── Extrai data da operação ───
  function getOpDate(op) {
    var raw = op.data_operacao || op.data_abertura || op.exercicio || '';
    if (!raw) return null;
    var d = new Date(String(raw).split('T')[0] + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  // ─── Obtém prêmio/resultado da operação ───
  function getPremio(op) {
    return parseFloat(op.premio_us || 0);
  }

  // ─── Verifica se operação foi exercida ───
  function isExercised(op) {
    if (window.CryptoExerciseStatus && window.CryptoExerciseStatus.isActuallyExercised) {
      return window.CryptoExerciseStatus.isActuallyExercised(op);
    }
    return (op.exercicio_status || '').toUpperCase() === 'SIM';
  }

  // ─── Calcula estatísticas ───
  function calcStats(ops, priceOps) {
    var totalOps = ops.length;
    var totalPremio = 0;
    var wins = 0;

    ops.forEach(function (op) {
      var premio = getPremio(op);
      totalPremio += premio;
      if (premio > 0) wins++;
    });

    var winRate = totalOps > 0 ? (wins / totalOps * 100) : 0;

    // Preço médio: usa o cálculo oficial, opcionalmente limitado ao mês selecionado
    var precoMedio = 0;
    if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.computeData === 'function') {
      var pmData = window.ModalPrecoMedioAtivo.computeData(_currentAtivo, undefined, priceOps);
      if (pmData && pmData.pm > 0) precoMedio = pmData.pm;
    }

    return { totalOps: totalOps, totalPremio: totalPremio, winRate: winRate, precoMedio: precoMedio };
  }

  function getMonthOps(ops, monthIndex) {
    return ops.filter(function (op) {
      var date = getOpDate(op);
      return date && date.getMonth() === monthIndex;
    });
  }

  function setPeriodLabel(monthIndex) {
    var label = document.getElementById('pmKpiPeriodLabel');
    if (label) label.textContent = monthIndex === null ? 'P&L do Período' : 'P&L de ' + MESES[monthIndex];
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
      
      var premio = getPremio(op);
      dayOpsMap[cellId].ops.push(op);
      dayOpsMap[cellId].total += premio;
      allPnls.push(Math.abs(dayOpsMap[cellId].total));
    });

    var maxAbs = Math.max.apply(null, allPnls.concat([1]));
    return { dayOpsMap: dayOpsMap, maxAbs: maxAbs };
  }

  // ─── Render KPIs ───
  function renderKPIs(stats) {
    var el = function (id) { return document.getElementById(id); };
    
    el('pmKpiPnl').textContent = (stats.totalPremio >= 0 ? '' : '-') + fmtUS(stats.totalPremio);
    el('pmKpiOps').textContent = String(stats.totalOps);
    el('pmKpiWinRate').textContent = stats.winRate.toFixed(0) + '%';

    var pmLink = el('pmPriceMedioLink');
    if (pmLink) {
      pmLink.textContent = fmtPrice(stats.precoMedio);
      pmLink.onclick = function(e) {
        e.stopPropagation();
        closeModal();
        setTimeout(function() {
          if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.openModal === 'function') {
            window.ModalPrecoMedioAtivo.openModal(_currentAtivo);
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
        multi: multi
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
          '<span>' + mName + '</span><span class="pm-month-link-icon" aria-hidden="true">↗</span>' +
        '</button>' +
        '<div class="pm-heat-cells">' + cells + '</div>' +
      '</div>';
    }).join('');

    // Attach event listeners
    var tooltip = document.getElementById('pm-tooltip');
    var ttHead = document.getElementById('pmTtHead');
    var ttBody = document.getElementById('pmTtBody');

    document.querySelectorAll('.pm-filter-button').forEach(function (button) {
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
        renderKPIs(calcStats(filteredForCards, filteredHistory));
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
        renderKPIs(calcStats(ops));
        closeDayDetail();
        tooltip.style.display = 'none';
      };
    }

    heatWrap.querySelectorAll('.pm-month-name').forEach(function (monthEl) {
      monthEl.addEventListener('click', function () {
        var monthIndex = parseInt(monthEl.getAttribute('data-month'), 10);
        var monthOps = getMonthOps(ops, monthIndex);
        var monthCloseOps = getPriceOpsAtMonthClose(allOpsAtivo, year, monthIndex);

        heatWrap.querySelectorAll('.pm-month-name.pm-selected').forEach(function (selected) {
          selected.classList.remove('pm-selected');
          selected.setAttribute('aria-pressed', 'false');
        });
        monthEl.classList.add('pm-selected');
        monthEl.setAttribute('aria-pressed', 'true');

        setPeriodLabel(monthIndex);
        renderKPIs(calcStats(monthOps, monthCloseOps));
        closeDayDetail();
        tooltip.style.display = 'none';
      });
    });

    heatWrap.querySelectorAll('.pm-cell:not(.pm-empty)').forEach(function (c) {
      c.addEventListener('mousemove', function(e) {
        var tipo = c.getAttribute('data-tipo');
        var exercida = c.getAttribute('data-exercida') === 'true';
        var pnl = parseFloat(c.getAttribute('data-pnl'));
        var multi = c.getAttribute('data-multi') === 'true';
        var date = c.getAttribute('data-date');
        var info = _dayOpsMap[c.getAttribute('data-id')];
        var operation = info && info.ops[0];
        var operationState = getOperationState(operation);

        ttHead.className = 'pm-tt-head pm-' + tipo.toLowerCase();
        ttHead.innerHTML = (tipo === 'PUT' ? '🔵' : '🔷') + ' Operação ' + tipo + ' — ' + escapeHtml((operation && operation.ativo || _currentAtivo).toUpperCase());

        ttBody.innerHTML = 
          '<div class="pm-tt-line"><span class="pm-tt-k">📅 Data</span><span class="pm-tt-v">' + date + '</span></div>' +
          '<div class="pm-tt-line"><span class="pm-tt-k">🏷️ Tipo</span><span class="pm-tt-v">' + tipo + '</span></div>' +
          '<div class="pm-tt-line"><span class="pm-tt-k">📌 Situação</span><span class="pm-tt-badge ' + operationState.className + '">' + operationState.label + '</span></div>' +
          '<div class="pm-tt-line"><span class="pm-tt-k">⚙️ Status</span><span class="pm-tt-badge ' + (exercida ? 'pm-exercida' : 'pm-nao') + '">' + (exercida ? 'EXERCIDA' : 'NÃO EXERCIDA') + '</span></div>' +
          (multi ? '<div class="pm-tt-line"><span class="pm-tt-k">📦 Operações</span><span class="pm-tt-v">2+</span></div>' : '') +
          '<div class="pm-tt-line"><span class="pm-tt-k">💰 Resultado</span><span class="pm-tt-v ' + (pnl >= 0 ? 'pm-pos' : 'pm-neg') + '">' + fmtUS(pnl) + '</span></div>';

        tooltip.style.display = 'block';
        var x = e.clientX + 16, y = e.clientY + 16;
        if (x + 230 > window.innerWidth) x = e.clientX - 230;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
      });

      c.addEventListener('mouseleave', function() {
        tooltip.style.display = 'none';
      });

      c.addEventListener('click', function() {
        var id = c.getAttribute('data-id');
        var info = _dayOpsMap[id];
        if (!info) return;

        // Remove seleção anterior
        heatWrap.querySelectorAll('.pm-cell.pm-selected').forEach(function(x) {
          x.classList.remove('pm-selected');
        });
        c.classList.add('pm-selected');

        document.getElementById('pmDdDate').textContent = fmtDate(info.date);
        var totalEl = document.getElementById('pmDdTotal');
        totalEl.textContent = 'Total do dia: ' + fmtUS(info.total);
        totalEl.className = 'pm-dd-total ' + (info.total >= 0 ? 'pm-pos' : 'pm-neg');

        document.getElementById('pmDdOps').innerHTML = info.ops.map(function(o) {
          var tipo = (o.tipo || '').toUpperCase();
          var asset = (o.ativo || _currentAtivo).toUpperCase();
          var exercida = isExercised(o);
          var operationState = getOperationState(o);
          var valor = getPremio(o);
          var dataEntrada = formatOperationDate(o.data_abertura || o.data_operacao);
          var dataFechamento = formatOperationDate(o.data_fechamento || o.exercicio);
          var strike = formatOperationValue(o.strike);
          var cotacao = formatOperationValue(o.cotacao_atual);
          var strategy = escapeHtml(o.tipo_estrategia || '—');
          var broker = escapeHtml(o.corretora || '—');
          return '<div class="pm-dd-op">' +
            '<div class="pm-dd-op-main">' +
              '<span class="pm-dd-asset">' + escapeHtml(asset) + '</span>' +
              '<span class="pm-dd-tipo-badge pm-' + tipo.toLowerCase() + '">' + (tipo === 'PUT' ? '🔵' : '🔷') + ' ' + escapeHtml(tipo) + '</span>' +
              '<span class="pm-dd-operation-state ' + operationState.className + '">' + operationState.label + '</span>' +
              '<span class="pm-dd-status ' + (exercida ? 'pm-ex' : 'pm-nex') + '">' + getExerciseLabel(o) + '</span>' +
              '<span class="pm-dd-valor ' + (valor >= 0 ? 'pm-pos' : 'pm-neg') + '">Prêmio ' + fmtUS(valor) + '</span>' +
            '</div>' +
            '<div class="pm-dd-op-meta">' +
              '<span><small>Entrada</small><b>' + dataEntrada + '</b></span>' +
              '<span><small>Fechamento</small><b>' + dataFechamento + '</b></span>' +
              '<span><small>Strike</small><b>' + strike + '</b></span>' +
              '<span><small>Cotação</small><b>' + cotacao + '</b></span>' +
              '<span><small>Estratégia</small><b>' + strategy + '</b></span>' +
              '<span><small>Corretora</small><b>' + broker + '</b></span>' +
            '</div>' +
          '</div>';
        }).join('');

        document.getElementById('pmDayDetail').classList.add('pm-open');
        tooltip.style.display = 'none';
      });
    });
  }

  // ─── Close day detail ───
  function closeDayDetail() {
    var dayDetail = document.getElementById('pmDayDetail');
    if (dayDetail) {
      dayDetail.classList.remove('pm-open');
      var heatWrap = document.getElementById('pmHeatWrap');
      if (heatWrap) {
        heatWrap.querySelectorAll('.pm-cell.pm-selected').forEach(function(x) {
          x.classList.remove('pm-selected');
        });
      }
    }
  }

  // ─── Open Modal ───
  function openModal(ativo) {
    _currentAtivo = (ativo || 'BTC').toUpperCase();

    // Cria overlay se não existir
    if (!_modalOverlay) {
      var container = document.getElementById('pmModalContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'pmModalContainer';
        document.body.appendChild(container);
      }
      
      // Carrega HTML da modal
      fetch('../html/modal-preco-medio-crypto.html', { cache: 'no-store' })
        .then(function(r) { return r.text(); })
        .then(function(html) {
          container.innerHTML = html;
          _modalOverlay = document.getElementById('pmModalOverlay');
          _attachEventListeners();
          _render();
        })
        .catch(function() {
          console.error('Erro ao carregar modal');
        });
    } else {
      _render();
    }

    function _render() {
      // Título
      document.getElementById('pmModalTitle').textContent = '🗓️ Mapa de calor anual — ' + _currentAtivo;

      // Operações do ano
      var allOpsAtivo = (window.cryptoOperacoes || []).filter(function (op) {
        return (op.ativo || '').toUpperCase() === _currentAtivo;
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
    document.getElementById('pmDdClose').onclick = closeDayDetail;

    _modalOverlay.onclick = function(e) {
      if (e.target === _modalOverlay) closeModal();
    };
  }

  // ─── Init ───
  function init() {
    // Nada a fazer no init, tudo é carregado sob demanda
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ModalPrecoMedio = { open: openModal, close: closeModal };

})();

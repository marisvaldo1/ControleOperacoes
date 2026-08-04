// modal-preco-medio-crypto.js v1.0.0
// Modal Preco Medio com Mapa de Calor por Ativo
(function () {
  'use strict';

  var _modalInstance = null;
  var _currentAtivo = null;

  var MONTH_NAMES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function fmtUsd(v) {
    return 'US$ ' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pnlColor(pnl, maxAbs) {
    if (!maxAbs) maxAbs = 1;
    var intensity = Math.min(1, Math.abs(pnl) / maxAbs);
    var alpha = (0.25 + intensity * 0.7).toFixed(2);
    return pnl >= 0 ? 'rgba(34,197,94,' + alpha + ')' : 'rgba(240,67,95,' + alpha + ')';
  }

  function getOpDate(op) {
    var raw = op.data_operacao || op.data_abertura || op.exercicio || '';
    if (!raw) return null;
    var d = new Date(String(raw).split('T')[0] + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function getPremio(op) {
    return parseFloat(op.premio_us || 0);
  }

  function isExercised(op) {
    if (window.CryptoExerciseStatus && window.CryptoExerciseStatus.isActuallyExercised) {
      return window.CryptoExerciseStatus.isActuallyExercised(op);
    }
    return (op.exercicio_status || '').toUpperCase() === 'SIM';
  }

  // ─── Calcula estatísticas ───
  function calcStats(ops, allOpsAtivo) {
    var totalOps = ops.length;
    var totalPremio = 0;
    var wins = 0;

    ops.forEach(function (op) {
      var premio = getPremio(op);
      totalPremio += premio;
      if (premio > 0) wins++;
    });

    var winRate = totalOps > 0 ? (wins / totalOps * 100) : 0;

    // Preço médio: busca do cache ou fallback local
    var precoMedio = 0;
    // 1) Cache do backend
    var putData = null;
    if (window.VisaoGeralCrypto && window.VisaoGeralCrypto._cachedPutExercida) {
      putData = window.VisaoGeralCrypto._cachedPutExercida[_currentAtivo] || null;
    }
    // 2) Fallback: busca no array local
    if (!putData) {
      var putsEx = (allOpsAtivo || ops).filter(function(op) {
        if ((op.status || '').toUpperCase() === 'ABERTA') return false;
        return (op.tipo || '').toUpperCase() === 'PUT' && (op.exercicio_status || '').toUpperCase() === 'SIM';
      }).sort(function(a, b) {
        return (b.exercicio || b.data_operacao || '').localeCompare(a.exercicio || a.data_operacao || '');
      });
      putData = putsEx.length ? putsEx[0] : null;
    }
    if (putData) {
      var putStrike = parseFloat(putData.strike || 0);
      var putDate = putData.exercicio || putData.data_operacao || '';
      if (putStrike > 0) {
        var premiosDesde = 0;
        (allOpsAtivo || ops).forEach(function(op) {
          var opDate = op.data_operacao || op.exercicio || '';
          if (opDate >= putDate) premiosDesde += getPremio(op);
        });
        precoMedio = putStrike - premiosDesde;
        if (precoMedio < 0) precoMedio = 0;
      }
    }

    return { totalOps: totalOps, totalPremio: totalPremio, winRate: winRate, precoMedio: precoMedio };
  }

  // ─── Agrupa operacoes por mes/semana/dia ───
  function groupByMonthWeekDay(ops) {
    var months = {};
    ops.forEach(function (op) {
      var d = getOpDate(op);
      if (!d) return;
      var mIdx = d.getMonth();
      var mKey = MONTH_NAMES[mIdx];
      if (!months[mKey]) months[mKey] = { index: mIdx, weeks: {} };

      // Calcula semana ISO (simplificado: semana do ano)
      var startOfYear = new Date(d.getFullYear(), 0, 1);
      var dayOfYear = Math.floor((d - startOfYear) / 86400000) + 1;
      var weekNum = Math.ceil(dayOfYear / 7);
      var wKey = 'S' + weekNum;
      if (!months[mKey].weeks[wKey]) months[mKey].weeks[wKey] = {};

      var dayOfWeek = d.getDay(); // 0=dom, 1=seg...
      var dayKey = dayOfWeek + '_' + d.getDate();
      if (!months[mKey].weeks[wKey][dayKey]) {
        months[mKey].weeks[wKey][dayKey] = { pnl: 0, ops: [], tipo: null };
      }
      var cell = months[mKey].weeks[wKey][dayKey];
      cell.pnl += getPremio(op);
      cell.ops.push(op);
      cell.tipo = (op.tipo || '').toLowerCase();
    });
    return months;
  }

  // ─── Render KPIs ───
  function renderKPIs(stats) {
    var el = function (id) { return document.getElementById(id); };
    var pnlEl = el('pmKpiPnl');
    var opsEl = el('pmKpiOps');
    var wrEl = el('pmKpiWinRate');
    var gaugeEl = el('pmKpiGauge');
    var pmEl = el('pmKpiPrecoMedio');

    if (pnlEl) {
      var sign = stats.totalPremio >= 0 ? '' : '-';
      pnlEl.textContent = sign + fmtUsd(stats.totalPremio);
      pnlEl.className = 'pm-kpi-value ' + (stats.totalPremio >= 0 ? 'pm-kpi-gold' : '');
      pnlEl.style.color = stats.totalPremio >= 0 ? '#f2a900' : '#f0435f';
    }
    if (opsEl) opsEl.textContent = String(stats.totalOps);
    if (wrEl) wrEl.textContent = stats.winRate.toFixed(0) + '%';
    if (gaugeEl) gaugeEl.style.setProperty('--pm-wr', stats.winRate.toFixed(0));
    if (pmEl) {
      pmEl.textContent = stats.precoMedio > 0 ? fmtUsd(stats.precoMedio) : '—';
      // Torna o card de preço médio clicável para abrir modal saldo médio
      var pmCard = pmEl.closest('.pm-kpi');
      if (pmCard) {
        pmCard.style.cursor = 'pointer';
        pmCard.title = 'Clique para ver detalhes do preco medio';
        pmCard.onclick = function() {
          // Fecha o modal atual
          if (_modalInstance) _modalInstance.hide();
          // Abre modal de saldo médio
          setTimeout(function() {
            if (window.ModalSaldoMedioCrypto && typeof window.ModalSaldoMedioCrypto.openModal === 'function') {
              window.ModalSaldoMedioCrypto.openModal();
            }
          }, 300);
        };
      }
    }
  }

  // ─── Render Legend ───
  function renderLegend(maxAbs) {
    var scale = document.getElementById('pmLegendScale');
    if (!scale) return;
    scale.innerHTML = '';
    var steps = [-1, -0.6, -0.25, 0, 0.25, 0.6, 1];
    steps.forEach(function (s) {
      var sp = document.createElement('span');
      sp.style.background = pnlColor(s * maxAbs, maxAbs);
      scale.appendChild(sp);
    });
  }

  // ─── Render Heatmap ───
  function renderHeatmap(ops) {
    var container = document.getElementById('pmHeatmapGrid');
    if (!container) return;
    container.innerHTML = '';

    var months = groupByMonthWeekDay(ops);
    // Calcula maxAbs para escala de cor
    var maxAbs = 1;
    Object.keys(months).forEach(function (mKey) {
      var m = months[mKey];
      Object.keys(m.weeks).forEach(function (wKey) {
        Object.keys(m.weeks[wKey]).forEach(function (dKey) {
          var pnl = Math.abs(m.weeks[wKey][dKey].pnl);
          if (pnl > maxAbs) maxAbs = pnl;
        });
      });
    });

    renderLegend(maxAbs);

    // Ordena meses em ordem decrescente (mais recente primeiro)
    var sortedMonths = Object.keys(months).sort(function (a, b) {
      return months[b].index - months[a].index;
    });

    if (!sortedMonths.length) {
      container.innerHTML = '<div style="text-align:center;color:#8993a8;padding:30px 0;">Nenhuma operacao encontrada para este ativo.</div>';
      return;
    }

    sortedMonths.forEach(function (mKey) {
      var m = months[mKey];
      var row = document.createElement('div');
      row.className = 'pm-heatmap-month';

      var label = document.createElement('div');
      label.className = 'pm-heatmap-month-label';
      label.textContent = mKey;
      row.appendChild(label);

      var weeksWrap = document.createElement('div');
      weeksWrap.className = 'pm-heatmap-weeks';

      // Ordena semanas
      var sortedWeeks = Object.keys(m.weeks).sort(function (a, b) {
        return parseInt(a.replace('S', '')) - parseInt(b.replace('S', ''));
      });

      sortedWeeks.forEach(function (wKey) {
        var group = document.createElement('div');
        group.className = 'pm-heatmap-week-group';

        // Renderiza apenas dias com operações (sem cells vazias)
        for (var dow = 0; dow < 7; dow++) {
          var found = null;
          Object.keys(m.weeks[wKey]).forEach(function (dKey) {
            if (parseInt(dKey.split('_')[0]) === dow) found = m.weeks[wKey][dKey];
          });

          if (!found) continue; // pula dias sem operação

          var cell = document.createElement('div');
          cell.className = 'pm-heatmap-cell';
          // Cor de fundo = intensidade do P&L (verde lucro / vermelho prejuízo)
          cell.style.background = pnlColor(found.pnl, maxAbs);
          // Borda dourada para operações exercidas
          var op0 = found.ops[0];
          var exercida = op0 && (op0.exercicio_status || '').toUpperCase() === 'SIM';
          if (exercida) {
            cell.style.outline = '2px solid #f2a900';
            cell.style.outlineOffset = '-1px';
            cell.style.zIndex = '1';
          }
          // Tooltip customizado (data-* attributes para CSS tooltip)
          var tipoLabel = found.tipo === 'call' ? 'CALL' : found.tipo === 'put' ? 'PUT' : (found.tipo || '').toUpperCase();
          var opDate = op0 ? (op0.data_operacao || op0.exercicio || '') : '';
          var dateStr = '';
          if (opDate) {
            var parts = opDate.split('-');
            dateStr = parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : opDate;
          }
          var exLabel = exercida ? ' • EXERCIDA' : '';
          var tooltipText = dateStr + ' • ' + tipoLabel + exLabel + '\n' + (found.pnl >= 0 ? '+' : '') + fmtUsd(found.pnl);
          cell.setAttribute('data-pm-tip', tooltipText);
          cell.addEventListener('mouseenter', showTooltip);
          cell.addEventListener('mouseleave', hideTooltip);
          (function(cellData, monthName, weekKey) {
            cell.addEventListener('click', function() { showCellDetail(cellData, monthName, weekKey); });
          })(found, mKey, wKey);
          group.appendChild(cell);
        }
        weeksWrap.appendChild(group);
      });

      row.appendChild(weeksWrap);
      container.appendChild(row);
    });
  }

  // ─── Tooltip customizado ───
  var _tooltipEl = null;

  function showTooltip(e) {
    var text = e.target.getAttribute('data-pm-tip');
    if (!text) return;
    if (!_tooltipEl) {
      _tooltipEl = document.createElement('div');
      _tooltipEl.className = 'pm-custom-tooltip';
      document.body.appendChild(_tooltipEl);
    }
    _tooltipEl.textContent = text;
    _tooltipEl.style.display = 'block';
    positionTooltip(e);
  }

  function hideTooltip() {
    if (_tooltipEl) _tooltipEl.style.display = 'none';
  }

  function positionTooltip(e) {
    if (!_tooltipEl) return;
    var rect = e.target.getBoundingClientRect();
    _tooltipEl.style.left = (rect.left + rect.width / 2) + 'px';
    _tooltipEl.style.top = (rect.top - 8) + 'px';
  }

  // ─── Detalhe ao clicar na cell ───
  function showCellDetail(cellData, monthName, weekKey) {
    if (!cellData || !cellData.ops || !cellData.ops.length) return;
    var op = cellData.ops[0]; // primeira operação do dia
    var tipo = (op.tipo || '').toUpperCase();
    var strike = parseFloat(op.strike || 0);
    var premio = getPremio(op);
    var exercido = isExercised(op);
    var tipoLabel = tipo === 'CALL' && exercido ? 'CALL EXERCIDA' : tipo === 'PUT' && exercido ? 'PUT EXERCIDA' : tipo;
    var d = getOpDate(op);
    var dataStr = d ? d.toLocaleDateString('pt-BR') : '—';
    var pnl = cellData.pnl;
    var pnlClass = pnl >= 0 ? 'lucro' : 'prejuizo';
    var pnlLabel = pnl >= 0 ? 'Lucro' : 'Prejuizo';
    var pnlSign = pnl >= 0 ? '+' : '-';

    var html = '<div class="pm-detail-overlay" id="pmDetailOverlay">';
    html += '<div class="pm-detail-content">';
    html += '<div class="pm-detail-header"><h5>' + dataStr + ' &middot; ' + tipoLabel + '</h5><button class="pm-detail-close" id="pmDetailClose">&times;</button></div>';
    html += '<div class="pm-detail-grid">';
    html += '<div class="pm-detail-item"><div class="pm-detail-label">Data</div><div class="pm-detail-value">' + dataStr + '</div></div>';
    html += '<div class="pm-detail-item"><div class="pm-detail-label">Tipo</div><div class="pm-detail-value" style="color:' + (tipo === 'CALL' ? '#22c55e' : '#f0435f') + '">' + tipoLabel + '</div></div>';
    html += '<div class="pm-detail-item"><div class="pm-detail-label">Strike</div><div class="pm-detail-value" style="color:#f2a900">' + fmtUsd(strike) + '</div></div>';
    html += '<div class="pm-detail-item"><div class="pm-detail-label">Premio</div><div class="pm-detail-value" style="color:#22c55e">' + fmtUsd(premio) + '</div></div>';
    html += '<div class="pm-detail-item"><div class="pm-detail-label">Periodo</div><div class="pm-detail-value">' + monthName + ' &middot; ' + weekKey + '</div></div>';
    html += '<div class="pm-detail-item"><div class="pm-detail-label">Exercicio</div><div class="pm-detail-value">' + (exercido ? '<span style="color:#f0435f">SIM</span>' : '<span style="color:#22c55e">NAO</span>') + '</div></div>';
    html += '</div>';
    html += '<div class="pm-detail-resultado ' + pnlClass + '">' + pnlLabel + ': ' + pnlSign + fmtUsd(pnl) + '</div>';
    html += '</div></div>';

    // Remove overlay anterior se existir
    var old = document.getElementById('pmDetailOverlay');
    if (old) old.remove();

    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('pmDetailClose').addEventListener('click', function() {
      document.getElementById('pmDetailOverlay').remove();
    });
    document.getElementById('pmDetailOverlay').addEventListener('click', function(e) {
      if (e.target === this) this.remove();
    });
  }

  // ─── Open ───
  function open(ativo) {
    _currentAtivo = (ativo || 'BTC').toUpperCase();

    // Titulo
    var titleEl = document.getElementById('pmModalTitle');
    if (titleEl) titleEl.textContent = _currentAtivo;

    // Busca última PUT exercida do backend se não estiver no cache
    var cache = (window.VisaoGeralCrypto && window.VisaoGeralCrypto._cachedPutExercida) || {};
    if (!cache[_currentAtivo]) {
      var apiBase = window.API_BASE || '';
      fetch(apiBase + '/api/crypto/ultima-put-exercida?ativo=' + _currentAtivo)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data) {
            if (!window.VisaoGeralCrypto) window.VisaoGeralCrypto = {};
            if (!window.VisaoGeralCrypto._cachedPutExercida) window.VisaoGeralCrypto._cachedPutExercida = {};
            window.VisaoGeralCrypto._cachedPutExercida[_currentAtivo] = data;
          }
          _renderModal();
        })
        .catch(function() { _renderModal(); });
    } else {
      _renderModal();
    }

    function _renderModal() {
      var allOpsAtivo = (window.cryptoOperacoes || []).filter(function (op) {
        return (op.ativo || '').toUpperCase() === _currentAtivo;
      });
      var year = new Date().getFullYear();
      var ops = allOpsAtivo.filter(function (op) {
        var d = getOpDate(op);
        return d && d.getFullYear() === year;
      });
      var stats = calcStats(ops, allOpsAtivo);
      renderKPIs(stats);
      renderHeatmap(ops);

      var modalEl = document.getElementById('modalPrecoMedioCrypto');
      if (modalEl && window.bootstrap) {
        if (!_modalInstance) {
          _modalInstance = new bootstrap.Modal(modalEl);
        }
        _modalInstance.show();
      }
    }
  }

  // ─── Init ───
  function init() {
    // Carrega HTML do modal se nao estiver no DOM
    var modalEl = document.getElementById('modalPrecoMedioCrypto');
    if (!modalEl) {
      var container = document.getElementById('modalPrecoMedioCryptoContainer');
      if (container) {
        fetch('modal-preco-medio-crypto.html', { cache: 'no-store' })
          .then(function (r) { return r.text(); })
          .then(function (html) { container.innerHTML = html; });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ModalPrecoMedio = { open: open };

})();

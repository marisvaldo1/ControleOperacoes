// visao-geral-crypto.js v1.0.26
// Aba Visão Geral — layout fiel à imagem (claude9.html)
// Combina: Evolução acumulada + Posições abertas + Fluxo do ciclo + Projeção + Resumo

(function () {
  'use strict';

  var vgCharts = {};

  /* ─ Helpers ─ */
  function fmt(n)  { return 'US$ ' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function fmtK(n) { return 'US$ ' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function fmtP(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtPct(n) { return n.toFixed(2) + '%'; }

  function getCapital() {
    try { var c = JSON.parse(localStorage.getItem('cryptoConfig') || '{}'); return parseFloat(c.saldoCrypto || 0); } catch(e) { return 0; }
  }

  /* ─ Computações sobre as operações ─ */
  function computeStats(ops) {
    var total = 0, exercidas = 0, abertas = 0, profitable = 0;
    var btcPrem = 0, ethPrem = 0;
    var meses = {}, mesesBtc = {}, mesesEth = {};
    var nowM = new Date(); var yearKey = nowM.getFullYear();

    ops.forEach(function(op) {
      var prem = parseFloat(op.premio_us || 0);
      total   += prem;
      if (prem > 0) profitable++;
      // Conta exercidas apenas para operações FECHADAS com exercicio_status = SIM no banco
      var opStatus = (op.status || '').toUpperCase();
      if (window.CryptoExerciseStatus
        ? window.CryptoExerciseStatus.isActuallyExercised(op)
        : (opStatus !== 'ABERTA' && (op.exercicio_status || '').toUpperCase() === 'SIM')) exercidas++;
      if (opStatus === 'ABERTA') abertas++;
      var ativo = (op.ativo || '').toUpperCase();
      if (ativo === 'BTC') btcPrem += prem; else if (ativo === 'ETH') ethPrem += prem;

      // por mês (total + separado por ativo)
      var d = op.data_operacao || op.data_abertura || '';
      if (d) {
        var parts = d.split('-');
        if (parts.length >= 2) {
          var mk = parts[1] + '/' + parts[0];
          meses[mk]    = (meses[mk]    || 0) + prem;
          mesesBtc[mk] = (mesesBtc[mk] || 0) + (ativo === 'BTC' ? prem : 0);
          mesesEth[mk] = (mesesEth[mk] || 0) + (ativo === 'ETH' ? prem : 0);
        }
      }
    });

    var n = ops.length;
    var capital = getCapital();
    var wr = n > 0 ? (profitable / n * 100) : 0;
    var roi = capital > 0 ? (total / capital * 100) : 0;
    var semEx = n > 0 ? ((n - exercidas) / n * 100) : 0;

    // Meses ordenados — inclui todos até o mês atual (zero para meses sem operações)
    var mOrder = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    var MLBL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    var mLabels = [], mVals = [], mBtcVals = [], mEthVals = [], mAccVals = [];
    var running = 0;
    mOrder.forEach(function(m, i) {
      var k = m + '/' + yearKey;
      running += (meses[k] || 0);
      mLabels.push(MLBL[i]);
      mVals.push(parseFloat((meses[k] || 0).toFixed(2)));
      mBtcVals.push(parseFloat((mesesBtc[k] || 0).toFixed(2)));
      mEthVals.push(parseFloat((mesesEth[k] || 0).toFixed(2)));
      mAccVals.push(parseFloat(running.toFixed(2)));
    });

    return { total: total, exercidas: exercidas, abertas: abertas, btcPrem: btcPrem, ethPrem: ethPrem,
             wr: wr, roi: roi, semEx: semEx, capital: capital, ops: n,
             mLabels: mLabels, mVals: mVals, mBtcVals: mBtcVals, mEthVals: mEthVals, mAccVals: mAccVals };
  }

  function computePM(allOps, par) {
    // Usa o cálculo oficial do ModalPrecoMedioAtivo (fonte da verdade)
    if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.computeData === 'function') {
      var data = window.ModalPrecoMedioAtivo.computeData(par);
      return data && data.pm > 0 ? data.pm : 0;
    }
    return 0;
  }

  // Cache da última PUT exercida por ativo (carregada do backend)
  var _cachedPutExercida = {};

  function loadUltimaPutExercida() {
    var API_BASE = window.API_BASE || '';
    fetch(API_BASE + '/api/crypto/ultima-put-exercida')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && typeof data === 'object') {
          _cachedPutExercida = data;
        }
      })
      .catch(function() {});
  }

  function computeAbertasInfo(ops) {
    return ops.filter(function(o) { return (o.status||'').toUpperCase() === 'ABERTA'; });
  }

  function computeCiclos(ops) {
    var map = {};
    ops.forEach(function(op) {
      var key = op.data_operacao || op.data_abertura || '2000-01-01';
      if (!map[key]) map[key] = { dateKey: key, ops: [] };
      map[key].ops.push(op);
    });
    return Object.keys(map).map(function(k) {
      var cy = map[k];
      var total = 0, assets = {};
      var putStrike = null, putAbertura = 0;
      var hasOpen = false;
      cy.ops.forEach(function(op) {
        var prem = parseFloat(op.premio_us || 0);
        total += prem;
        var a = (op.ativo||'').toUpperCase();
        if (a) assets[a] = true;
        if ((op.tipo||'').toUpperCase() === 'PUT' && !putStrike) {
          putStrike   = parseFloat(op.strike   || 0);
          putAbertura = parseFloat(op.abertura || op.strike || 0);
        }
        if ((op.status||'').toUpperCase() === 'ABERTA') hasOpen = true;
      });
      var dp = k.split('-');
      var date = dp.length === 3 ? dp[2]+'/'+dp[1] : k;
      return { dateKey: k, date: date, ops: cy.ops, total: total,
               assets: Object.keys(assets).join('+'),
               putStrike: putStrike, putAbertura: putAbertura, hasOpen: hasOpen };
    }).sort(function(a,b) { return b.dateKey.localeCompare(a.dateKey); }).slice(0, 4);
  }

  function computeAccSeries(ops) {
    var sorted = ops.filter(function(o) { return parseFloat(o.premio_us||0) > 0; })
      .sort(function(a,b) { return (a.data_operacao||a.data_abertura||'').localeCompare(b.data_operacao||b.data_abertura||''); });
    var acc = 0, data = [{ x: 'Início', y: 0 }];
    sorted.forEach(function(op) {
      acc += parseFloat(op.premio_us||0);
      var d = op.data_operacao || op.data_abertura || '';
      var parts = d.split('-');
      var lbl = parts.length === 3 ? parts[2]+'/'+parts[1] : d;
      data.push({ x: lbl, y: parseFloat(acc.toFixed(2)) });
    });
    return data;
  }

  function computeBtcFluxo(ops) {
    var btcPuts  = ops.filter(function(o) { return (o.ativo||'').toUpperCase()==='BTC' && (o.tipo||'').toUpperCase()==='PUT'; })
                      .sort(function(a,b) { return (a.data_operacao||a.data_abertura||'').localeCompare(b.data_operacao||b.data_abertura||''); });
    var btcCalls = ops.filter(function(o) { return (o.ativo||'').toUpperCase()==='BTC' && (o.tipo||'').toUpperCase()==='CALL'; })
                      .sort(function(a,b) { return (b.data_operacao||b.data_abertura||'').localeCompare(a.data_operacao||a.data_abertura||''); });

    var putOp      = btcPuts[0];
    var putStrike  = putOp ? parseFloat(putOp.strike || 0) : 0;
    var exercida   = putOp && (putOp.tipo_status||putOp.status||'').toUpperCase() === 'EXERCIDA';
    var exercDate  = '—';
    if (putOp && putOp.exercicio) { var p = String(putOp.exercicio).split('-'); exercDate = p.length===3 ? p[2]+'/'+p[1] : putOp.exercicio; }
    var prems = btcCalls.slice(0, 3);
    var totalPrem = 0;
    prems.forEach(function(o) { totalPrem += parseFloat(o.premio_us||0); });
    var cm = putStrike > 0 && totalPrem > 0 ? putStrike - totalPrem : null;
    return { putStrike: putStrike, exercida: exercida, exercDate: exercDate, prems: prems, totalPrem: totalPrem, cm: cm };
  }

  function computeProjecao(ops) {
    var assets = ['BTC','ETH'];
    var result = [];
    assets.forEach(function(asset) {
      var aOps  = ops.filter(function(o) { return (o.ativo||'').toUpperCase() === asset; });
      if (!aOps.length) return;
      var openCalls = aOps.filter(function(o) { return (o.tipo||'').toUpperCase()==='CALL' && (o.status||'').toUpperCase()==='ABERTA'; });
      var cot = 0;
      for (var i = aOps.length-1; i>=0; i--) { if (aOps[i].cotacao_atual) { cot = parseFloat(aOps[i].cotacao_atual); break; } }
      var strikeCall = openCalls.length ? parseFloat(openCalls[0].strike||0) : (cot > 0 ? cot * 1.05 : 0);
      var premEst;
      if (openCalls.length) {
        premEst = parseFloat(openCalls[0].premio_us || 0);
      } else {
        /* Estima prêmio com base na TAE média das CALLs históricas */
        var histCalls = aOps.filter(function(o) { return (o.tipo||'').toUpperCase()==='CALL' && parseFloat(o.tae||0) > 0; });
        if (histCalls.length && strikeCall > 0) {
          var avgTae = histCalls.reduce(function(s,o){ return s + parseFloat(o.tae||0); }, 0) / histCalls.length;
          premEst = strikeCall * (avgTae / 100) * (7 / 365);
        } else {
          premEst = 0;
        }
      }
      var dist       = cot > 0 && strikeCall > 0 ? (strikeCall - cot) / cot * 100 : 0;

      // custo médio
      var puts   = aOps.filter(function(o) { return (o.tipo||'').toUpperCase()==='PUT'; });
      var putStr = puts.length ? parseFloat(puts[puts.length-1].strike||0) : 0;
      var allPrem = 0;
      aOps.forEach(function(o) { allPrem += parseFloat(o.premio_us||0); });
      var cm = putStr > 0 && allPrem > 0 ? putStr - allPrem : 0;
      var lucroEx = cm > 0 && strikeCall > 0 ? strikeCall - cm : 0;

      result.push({ asset: asset, strikeCall: strikeCall, premEst: premEst, dist: dist, cot: cot, cm: cm, lucroEx: lucroEx });
    });
    return result;
  }

  /* ─ Render HTML ─ */
  function renderVG(ops) {
    var isLight = document.body.getAttribute('data-bs-theme') === 'light';
    var C_MUTED   = isLight ? '#6c757d'           : '#7890b0';
    var C_BAR_BG  = isLight ? 'rgba(0,0,0,.08)'   : '#222d42';
    var C_DOT_BDR = isLight ? '#f8f9fa'            : '#0d1117';
    var C_HEAT_LBL= isLight ? 'rgba(0,0,0,.35)'   : 'rgba(255,255,255,.4)';

    var stats   = computeStats(ops);
    var abertas = computeAbertasInfo(ops);
    var ciclos  = computeCiclos(ops);
    var proj    = computeProjecao(ops);

    var h = '<div style="display:grid;grid-template-columns:3fr 2fr;gap:14px;margin-bottom:14px">';

    /* LEFT-TOP: Evolução Acumulada */
    h += '<div class="vg-card">';
    h += '<div class="vg-card-title"><span>&#128200;</span>Evolução de Prêmios Acumulados — ' + new Date().getFullYear() + '</div>';
    h += '<div style="display:flex;gap:10px;margin-bottom:10px;font-size:.62rem;color:' + C_MUTED + '">';
    h += '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(245,158,11,.7);display:inline-block"></span>BTC</span>';
    h += '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(6,182,212,.7);display:inline-block"></span>ETH</span>';
    h += '<span style="display:flex;align-items:center;gap:4px"><span style="width:18px;height:3px;background:#f59e0b;display:inline-block;border-radius:2px"></span>Acumulado</span>';
    h += '</div>';
    h += '<div class="vg-chart-wrap" style="height:380px"><canvas id="vgChartAcc"></canvas></div>';
    h += '</div>';

    /* RIGHT-TOP: Posições Abertas + Distância */
    h += '<div class="vg-card">';
    h += '<div class="vg-card-title" style="cursor:pointer" id="vgOpenPosHeader"><span>&#128200;</span>Posições Abertas Agora</div>';
    if (abertas.length === 0) {
      h += '<div style="color:' + C_MUTED + ';font-size:.72rem;padding:12px 0">Nenhuma posição aberta</div>';
    } else {
      abertas.forEach(function(op, idx) {
        var asset  = (op.ativo||'?').toUpperCase();
        var tipo   = (op.tipo||'CALL').toUpperCase();
        var cot    = parseFloat(op.cotacao_atual || 0);
        var strike = parseFloat(op.strike || 0);
        var dist   = strike > 0 && cot > 0 ? ((cot - strike) / strike * 100) : 0;
        var premio = parseFloat(op.premio_us || 0);
        var isEx   = (op.tipo_status||'').toUpperCase() === 'EXERCIDA' || Math.abs(dist) < 1;
        var bcol   = asset === 'BTC' ? '#f59e0b' : '#06b6d4';
        var acol   = isEx ? '#f97316' : '#22c55e';
        var corr   = (op.corretora || 'BINANCE').toUpperCase();
        var corrBadge = corr === 'BINANCE'
            ? '<span class="vg-badge" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.35)" title="Binance">BNC</span>'
            : corr === 'BYBIT'
            ? '<span class="vg-badge" style="background:rgba(6,182,212,.15);color:#06b6d4;border:1px solid rgba(6,182,212,.35)" title="Bybit">BB</span>'
            : '<span class="vg-badge" style="background:rgba(148,163,184,.12);color:#94a3b8;border:1px solid rgba(148,163,184,.3)" title="'+corr+'">'+corr+'</span>';
        // Seal badge inline
        var sealSt = thermoStatus(strike, cot, tipo);
        var sealColor = sealSt.cls === 'otm' ? '#ef4444' : '#22c55e';
        var sealLabel = sealSt.cls === 'otm' ? 'EM EXERCÍCIO' : 'SEGURA';
        var sealPct = strike > 0 ? ((cot - strike) / strike * 100) : 0;
        var sealPctSign = sealPct >= 0 ? '+' : '';
        var sealBadge = '<span class="vg-badge" id="vgSealBadge" style="background:rgba(' + (sealSt.cls === 'otm' ? '239,68,68' : '34,197,94') + ',.15);color:' + sealColor + ';border:1px solid ' + sealColor + ';display:inline-flex;align-items:center;gap:4px" title="' + sealLabel + ' ' + sealPctSign + sealPct.toFixed(2) + '%">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + sealColor + ';display:inline-block;box-shadow:0 0 6px ' + sealColor + '"></span>' +
          sealLabel + ' ' + sealPctSign + sealPct.toFixed(2) + '%</span>';
        var activeClass = idx === 0 ? ' vg-op-active' : '';
        var rowId = 'vg-op-row-' + (op.id || idx);
        var bodyId = rowId + '-body';
        h += '<div class="vg-op-row' + activeClass + '" id="' + rowId + '" data-op-id="' + (op.id || '') + '" data-par="' + asset + '" data-strike="' + strike + '" data-cotacao="' + cot + '" data-tipo="' + tipo + '" style="border-left:3px solid ' + acol + ';cursor:pointer">';
        h += '<span style="font-family:var(--syne,Syne),sans-serif;font-size:.8rem;font-weight:700;min-width:30px;color:'+bcol+'">'+asset+'</span>';
        h += '<span class="vg-badge" style="background:rgba(59,130,246,.1);color:#3b82f6;border:1px solid rgba(59,130,246,.26)">'+tipo+'</span>';
        h += corrBadge;
        h += sealBadge;
        if (isEx) h += '<span class="vg-badge" style="background:rgba(249,115,22,.1);color:#f97316;border:1px solid rgba(249,115,22,.26)">Poss. Exercício</span>';
        h += '<div style="flex:1"></div>';
        h += '<span style="font-size:.68rem;color:' + C_MUTED + ';margin-right:2px">Prêmio Recebido:</span><span style="font-family:monospace;font-size:.78rem;font-weight:700;color:#22c55e">+' + fmt(premio) + '</span>';
        h += '<span class="vg-op-detail-btn" data-op-id="' + (op.id || '') + '" title="Ver detalhes da operação" style="margin-left:8px"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>';
        h += '<span class="vg-refresh-cot-btn" data-par="' + asset + '" title="Atualizar cotação"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg></span>';
        h += '<span class="vg-chart-btn" data-par="' + asset + '" data-strike="' + strike + '" data-cotacao="' + cot + '" data-tipo="' + tipo + '" title="Gráfico TradingView"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>';
        h += '<span class="vg-op-toggle-ico" style="margin-left:8px;color:var(--tx2)">&#9654;</span>';
        h += '</div>';
        h += '<div class="vg-op-row-body hide" id="' + bodyId + '" style="display:none;padding:10px 0 10px 34px;border-top:1px solid var(--bdr2);margin-top:4px;background:rgba(0,0,0,.03);border-radius:0 0 8px 8px">';
        h += '  <div class="vg-op-thermometer-wrap">';
        h += '    <div class="vg-op-thermo-left">';
        h += '      <svg class="vg-op-thermo-svg" viewBox="0 0 400 200" width="100%" height="200"></svg>';
        h += '    </div>';
        h += '    <div class="vg-op-thermo-right">';
        h += '      <div class="tradingview-widget-container" style="height:200px;width:100%">';
        h += '        <div class="vg-op-mini-chart-container"></div>';
        h += '      </div>';
        h += '    </div>';
        h += '    <div class="vg-op-thermo-diff-row"></div>';
        h += '  </div>';
        h += '</div>';
      });
    }
    h += '</div>';
    h += '</div>'; /* end top grid */

    return h;
  }

  /* ─ Charts ─ */
  function buildVGCharts(ops) {
    var C = window.Chart;
    if (!C) return;

    var stats = computeStats(ops);
    var el = document.getElementById('vgChartAcc');
    if (el) {
      if (vgCharts.acc) { try { vgCharts.acc.destroy(); } catch(e) {} }
      // Barras empilhadas BTC+ETH + linha Acumulado (idêntico ao claude9.html)
      vgCharts.acc = new C(el, {
        type: 'bar',
        data: {
          labels: stats.mLabels,
          datasets: [
            {
              type: 'bar',
              label: 'BTC',
              data: stats.mBtcVals,
              backgroundColor: 'rgba(245,158,11,.55)',
              borderRadius: 4,
              barThickness: 18,
              stack: 'premios',
              order: 2
            },
            {
              type: 'bar',
              label: 'ETH',
              data: stats.mEthVals,
              backgroundColor: 'rgba(6,182,212,.55)',
              borderRadius: 4,
              barThickness: 18,
              stack: 'premios',
              order: 2
            },
            {
              type: 'line',
              label: 'Acumulado',
              data: stats.mAccVals,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245,158,11,.07)',
              borderWidth: 2.5,
              pointRadius: 5,
              pointBackgroundColor: '#f59e0b',
              fill: true,
              tension: 0.38,
              yAxisID: 'y2',
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                footer: function(items) {
                  var btcVal = 0, ethVal = 0;
                  items.forEach(function(item) {
                    if (item.dataset.label === 'BTC') btcVal = item.raw || 0;
                    else if (item.dataset.label === 'ETH') ethVal = item.raw || 0;
                  });
                  var total = btcVal + ethVal;
                  return total > 0 ? 'Total: US$ ' + total.toFixed(2) : '';
                }
}
            }
          }
        }
      }
    );
}
  }

  /* ─ Mini TradingView Chart per accordion ─ */
  var _vgOpMiniCharts = {}; // chartId -> widget

  function buildOpMiniChart(chartContainer, ticker, strike, currentPrice, operationType) {
    if (!chartContainer) return;
    var chartId = 'vg-op-mini-chart-' + Math.random().toString(36).substr(2, 9);
    chartContainer.innerHTML = '<div id="' + chartId + '" style="width:100%;height:100%"></div>';

    function createWidget() {
      try {
        var isDarkMode = document.body.dataset.bsTheme === 'dark';
        var widgetOptions = {
          symbol: ticker,
          interval: '60',
          container_id: chartId,
          locale: 'pt_BR',
          theme: isDarkMode ? 'dark' : 'light',
          style: '1',
          toolbar_bg: isDarkMode ? '#131722' : '#f1f3f6',
          enable_publishing: false,
          allow_symbol_change: false,
          hide_side_toolbar: true,
          hide_top_toolbar: true,
          hide_legend: true,
          save_image: false,
          fullscreen: false,
          autosize: true,
          studies: [],
          overrides: {
            'mainSeriesProperties.showPriceLine': true,
            'mainSeriesProperties.candleStyle.upColor': '#26a69a',
            'mainSeriesProperties.candleStyle.downColor': '#ef5350',
            'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
            'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350'
          }
        };
        var widget = new TradingView.widget(widgetOptions);
        _vgOpMiniCharts[chartId] = widget;
        setTimeout(function() {
          var el = document.getElementById(chartId);
          if (el) {
            el.style.backgroundColor = '#111827';
            var iframe = el.querySelector('iframe');
            if (iframe) {
              iframe.style.backgroundColor = '#111827';
              iframe.style.borderRadius = '8px';
            }
          }
        }, 800);
      } catch (error) {
        console.error('[VG Op MiniChart] Erro ao criar widget:', error);
      }
    }

    if (!globalThis.TradingView) {
      var existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
      if (existingScript && !existingScript.dataset.vgOpBound) {
        existingScript.dataset.vgOpBound = 'true';
        existingScript.addEventListener('load', function() {
          createWidget();
        });
      } else if (!existingScript) {
        var script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = createWidget;
        script.onerror = function() { console.error('[VG Op MiniChart] Falha ao carregar script TradingView'); };
        document.head.appendChild(script);
}
    } else {
      createWidget();
    }
  }

  /* ─ CSS inline para o componente ─ */
  function injectVGStyles() {
    // O CSS usa seletores [data-bs-theme="light"], não precisa ser re-injetado ao trocar tema
    if (document.getElementById('vgStyles')) return;
    var s = document.createElement('style');
    s.id = 'vgStyles';
    s.textContent = [
      '.vg-card{background:#161c28;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px 18px}',
      '.vg-card-title{font-size:.62rem;font-weight:600;color:#7890b0;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;display:flex;align-items:center;gap:6px}',
      '.vg-chart-wrap{position:relative}',
      '.vg-op-row{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;background:#1c2438;border:1px solid rgba(255,255,255,.07);margin-bottom:6px}',
      '.vg-badge{font-size:.6rem;font-weight:700;padding:2px 8px;border-radius:4px;white-space:nowrap;flex-shrink:0}',
      '.vg-heat-bar{height:24px;border-radius:8px;position:relative;overflow:hidden;background:#222d42}',
      '.vg-cycle-flow{display:flex;align-items:center;gap:0;padding:12px;background:#1c2438;border-radius:10px;border:1px solid rgba(255,255,255,.07);overflow-x:auto}',
      '.vg-cf-node{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:65px;text-align:center;flex-shrink:0}',
      '.vg-cf-circle{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700}',
      '.vg-cf-lbl{font-size:.58rem;color:#7890b0}',
      '.vg-cf-val{font-family:monospace;font-size:.64rem;font-weight:600}',
      '.vg-cf-arrow{font-size:1rem;color:#3a4f6a;flex-shrink:0;margin:0 -4px;align-self:center;padding-bottom:20px}',
      '.vg-fc-row{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:7px;background:#1c2438;border:1px solid rgba(255,255,255,.07);margin-bottom:6px}',
      '.vg-thermo-layout{display:flex;align-items:center;gap:12px;width:100%}',
      '.vg-thermo-left{flex:1 1 0;min-width:0}',
      '.vg-thermo-right{flex:1 1 0;min-width:0}',
      '.vg-op-thermometer-wrap{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;width:100%}',
      '.vg-op-thermo-left{flex:1 1 0;min-width:0}',
      '.vg-op-thermo-right{flex:1 1 0;min-width:0}',
      '.vg-op-thermo-diff-row{flex-basis:100%;margin-top:8px;display:flex;gap:8px;justify-content:space-between}',
      '.vg-op-thermo-diff-row .vg-td-badge{flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:.7rem;font-weight:600;color:#8aa4c0;text-align:center;min-width:0}',
      '.vg-op-thermo-diff-row .vg-td-badge .vg-td-val{font-family:monospace;font-weight:700;font-size:.78rem}',
      '[data-bs-theme="light"] .vg-op-thermo-diff-row .vg-td-badge{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.08);color:#6c757d}',
      '.vg-op-thermo-svg{display:block}',
      '.vg-op-mini-chart-container{width:100%;height:200px}',
      '.tradingview-widget-container{height:200px;width:100%}',
      /* LIGHT THEME */
      '[data-bs-theme="light"] .vg-card{background:var(--bs-body-bg,#fff);border-color:rgba(0,0,0,.10)}',
      '[data-bs-theme="light"] .vg-card-title{color:#6c757d}',
      '[data-bs-theme="light"] .vg-op-row{background:rgba(0,0,0,.025);border-color:rgba(0,0,0,.10)}',
      '[data-bs-theme="light"] .vg-heat-bar{background:rgba(0,0,0,.07)}',
      '[data-bs-theme="light"] .vg-cycle-flow{background:rgba(0,0,0,.025);border-color:rgba(0,0,0,.10)}',
      '[data-bs-theme="light"] .vg-cf-lbl{color:#6c757d}',
      '[data-bs-theme="light"] .vg-cf-arrow{color:#adb5bd}',
      '[data-bs-theme="light"] .vg-fc-row{background:rgba(0,0,0,.025);border-color:rgba(0,0,0,.10)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ─ Termômetro Duplo SVG — Semáforo Interno ─ */
  function buildThermometer(s, q, tipo, pm, par) {
    var svg = document.getElementById('vgThermometerSvg');
    var diffEl = document.getElementById('vgThermoDiff');
    if (!svg) return;

    if (!s || !q) {
      svg.innerHTML = '';
      if (diffEl) diffEl.innerHTML = '';
      return;
    }

    // Range dinâmico
    var spread = Math.abs(q - s);
    var margin = Math.max(spread * 1.5, Math.max(s, q) * 0.08);
    var MIN = Math.max(0, Math.min(s, q) - margin);
    var MAX = Math.max(s, q) + margin;

    var clamp = function(v) { return Math.max(0, Math.min(1, (v - MIN) / (MAX - MIN))); };
    var totalH = 200, barW = 64, y0 = 24;
    var sx = 140, qx = 250;

    var sh = clamp(s) * totalH;
    var qh = clamp(q) * totalH;
    var sy0 = y0 + totalH - sh;
    var qy0 = y0 + totalH - qh;

    // Status
    var st = thermoStatus(s, q, tipo);
    var statusColor = st.cls === 'itm' ? '#22c55e' : '#ef4444';
    var cotBarColor = statusColor;

    var zoneH = totalH / 3;
    var zoneColors = ['#991b1b', '#a16207', '#166534']; // baixo->alto (vermelho/amarelo/verde)

    var h = '';

    // Grade horizontal nas laterais
    for (var i = 0; i <= 8; i++) {
      var gy = y0 + totalH - (i / 8) * totalH;
      var val = MIN + (MAX - MIN) / 8 * i;
      var label = val >= 1000 ? (val/1000).toFixed(1) + 'k' : val.toFixed(0);
      h += '<line x1="56" y1="' + gy + '" x2="344" y2="' + gy + '" stroke="#334d6e" stroke-width="1"/>';
      h += '<text x="48" y="' + (gy + 4) + '" fill="#8aa4c0" font-size="10" text-anchor="end">' + label + '</text>';
      h += '<text x="352" y="' + (gy + 4) + '" fill="#8aa4c0" font-size="10">' + label + '</text>';
    }

    // Função tubo (zonas coloridas — opacidade aumentada)
    function tube(cx) {
      var t = '';
      for (var z = 0; z < 3; z++) {
        var zy = y0 + totalH - (z + 1) * zoneH;
        t += '<rect x="' + (cx - barW/2) + '" y="' + zy + '" width="' + barW + '" height="' + zoneH + '" fill="' + zoneColors[z] + '" opacity=".6" rx="2"/>';
      }
      t += '<rect x="' + (cx - barW/2) + '" y="' + y0 + '" width="' + barW + '" height="' + totalH + '" fill="none" stroke="#334155" stroke-width="1.5" rx="8"/>';
      return t;
    }

    h += tube(sx);
    h += tube(qx);

    // Fill strike (azul nítido)
    h += '<rect x="' + (sx - barW/2 + 3) + '" y="' + sy0 + '" width="' + (barW - 6) + '" height="' + sh + '" fill="#60a5fa" rx="5"/>';
    h += '<circle cx="' + sx + '" cy="' + sy0 + '" r="6" fill="#93c5fd"/>';

    // Fill cotação (cor do status, sem blur)
    h += '<rect x="' + (qx - barW/2 + 3) + '" y="' + qy0 + '" width="' + (barW - 6) + '" height="' + qh + '" fill="' + cotBarColor + '" rx="5"/>';
    h += '<circle cx="' + qx + '" cy="' + qy0 + '" r="6" fill="' + cotBarColor + '"/>';

    // Linha tracejada conectando os topos
    h += '<line x1="' + sx + '" y1="' + sy0 + '" x2="' + qx + '" y2="' + qy0 + '" stroke="' + statusColor + '" stroke-width="2" stroke-dasharray="5,4" opacity=".8"/>';

    // Seta de diferença no meio — cores mais vivas
    var midX = (sx + qx) / 2;
    var arrowY = Math.min(sy0, qy0) - 20;
    var diff = q - s;
    var sign = diff > 0 ? '\u25B2' : diff < 0 ? '\u25BC' : '=';
    var diffCol = statusColor;
    h += '<text x="' + midX + '" y="' + arrowY + '" fill="' + diffCol + '" font-size="18" text-anchor="middle">' + sign + '</text>';
    h += '<text x="' + midX + '" y="' + (arrowY + 17) + '" fill="' + diffCol + '" font-size="13" text-anchor="middle" font-weight="700">' + (diff > 0 ? '+' : '') + fmtShort(diff) + '</text>';

    // Labels "Strike" e "Cotação" no TOPO fixo do termômetro
    h += '<text x="' + sx + '" y="' + (y0 - 8) + '" fill="#60a5fa" font-size="13" text-anchor="middle" font-weight="700">Strike</text>';
    h += '<text x="' + qx + '" y="' + (y0 - 8) + '" fill="' + cotBarColor + '" font-size="13" text-anchor="middle" font-weight="700">Cotação</text>';

    // Valores abaixo dos tubos — cores nítidas
    var sLabel = fmtK(s);
    var qLabel = fmtK(q);
    h += '<text x="' + sx + '" y="' + (y0 + totalH + 24) + '" fill="#60a5fa" font-size="13" text-anchor="middle" font-weight="700">' + sLabel + '</text>';
    h += '<text x="' + qx + '" y="' + (y0 + totalH + 24) + '" fill="' + cotBarColor + '" font-size="13" text-anchor="middle" font-weight="700">' + qLabel + '</text>';

    svg.innerHTML = h;

    // Diff row + PoP + Preço Médio
    if (diffEl) {
      var diffVal = (q - s);
      var diffSign2 = diffVal > 0 ? '+' : '';
      // Calcular PoP heurístico baseado na distância
      var distPct = s > 0 ? Math.abs(diffVal) / s * 100 : 0;
      var isCall = (tipo || '').toUpperCase() === 'CALL';
      var isITM = isCall ? (diffVal > 0) : (diffVal < 0);
      var popEst = isITM ? Math.max(5, 50 - distPct * 4) : Math.min(95, 50 + distPct * 4);
      var popColor = popEst >= 50 ? '#22c55e' : '#ef4444';

      var pmHtml = '';
      if (pm && pm > 0) {
        var pmFmt = 'US$ ' + pm.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
        if (window.CryptoUtils && window.CryptoUtils.renderPmLink) {
          pmHtml = '<span>PM: ' + window.CryptoUtils.renderPmLink(par || 'BTC', pm) + '</span>';
        } else {
          pmHtml = '<span>PM: <span style="color:#f2a900;font-weight:700">' + pmFmt + '</span></span>';
        }
      }

      diffEl.innerHTML = '<span>Diferença: <span style="color:' + diffCol + '">' + diffSign2 + fmtShort(diffVal) + '</span></span>' +
                         '<span>PoP: <span style="color:' + popColor + ';font-weight:700">' + popEst.toFixed(0) + '%</span></span>' +
                         pmHtml;

      // Vincula tooltips aos links de PM
      if (window.CryptoUtils && window.CryptoUtils.bindPmTooltips) {
        window.CryptoUtils.bindPmTooltips();
      }
    }
  }

  /* ─ Thermometer per operation accordion ─ */
  /* ─ Atualiza apenas o SVG e diff row do termômetro (sem recriar TradingView) ─ */
  function updateOpThermometerSvg(s, q, tipo, pm, par, bodyEl) {
    var svg = bodyEl ? bodyEl.querySelector('.vg-op-thermo-svg') : null;
    var diffEl = bodyEl ? bodyEl.querySelector('.vg-op-thermo-diff-row') : null;
    if (!svg) return;

    if (!s || !q) {
      svg.innerHTML = '';
      if (diffEl) diffEl.innerHTML = '';
      return;
    }

    var spread = Math.abs(q - s);
    var margin = Math.max(spread * 1.5, Math.max(s, q) * 0.08);
    var MIN = Math.max(0, Math.min(s, q) - margin);
    var MAX = Math.max(s, q) + margin;

    var clamp = function(v) { return Math.max(0, Math.min(1, (v - MIN) / (MAX - MIN))); };
    var totalH = 160, barW = 56, y0 = 20;
    var sx = 140, qx = 250;

    var sh = clamp(s) * totalH;
    var qh = clamp(q) * totalH;
    var sy0 = y0 + totalH - sh;
    var qy0 = y0 + totalH - qh;

    var st = thermoStatus(s, q, tipo);
    var statusColor = st.cls === 'itm' ? '#22c55e' : '#ef4444';
    var cotBarColor = statusColor;

    var zoneH = totalH / 3;
    var zoneColors = ['#991b1b', '#a16207', '#166534'];

    var h = '';

    for (var i = 0; i <= 8; i++) {
      var gy = y0 + totalH - (i / 8) * totalH;
      var val = MIN + (MAX - MIN) / 8 * i;
      var label = val >= 1000 ? (val/1000).toFixed(1) + 'k' : val.toFixed(0);
      h += '<line x1="56" y1="' + gy + '" x2="344" y2="' + gy + '" stroke="#334d6e" stroke-width="1"/>';
      h += '<text x="48" y="' + (gy + 4) + '" fill="#8aa4c0" font-size="9" text-anchor="end">' + label + '</text>';
      h += '<text x="352" y="' + (gy + 4) + '" fill="#8aa4c0" font-size="9">' + label + '</text>';
    }

    function tube(cx) {
      var t = '';
      for (var z = 0; z < 3; z++) {
        var zy = y0 + totalH - (z + 1) * zoneH;
        t += '<rect x="' + (cx - barW/2) + '" y="' + zy + '" width="' + barW + '" height="' + zoneH + '" fill="' + zoneColors[z] + '" opacity=".6" rx="2"/>';
      }
      t += '<rect x="' + (cx - barW/2) + '" y="' + y0 + '" width="' + barW + '" height="' + totalH + '" fill="none" stroke="#334155" stroke-width="1.5" rx="8"/>';
      return t;
    }

    h += tube(sx);
    h += tube(qx);
    h += '<rect x="' + (sx - barW/2 + 3) + '" y="' + sy0 + '" width="' + (barW - 6) + '" height="' + sh + '" fill="#60a5fa" rx="5"/>';
    h += '<circle cx="' + sx + '" cy="' + sy0 + '" r="6" fill="#93c5fd"/>';
    h += '<rect x="' + (qx - barW/2 + 3) + '" y="' + qy0 + '" width="' + (barW - 6) + '" height="' + qh + '" fill="' + cotBarColor + '" rx="5"/>';
    h += '<circle cx="' + qx + '" cy="' + qy0 + '" r="6" fill="' + cotBarColor + '"/>';
    h += '<line x1="' + sx + '" y1="' + sy0 + '" x2="' + qx + '" y2="' + qy0 + '" stroke="' + statusColor + '" stroke-width="2" stroke-dasharray="5,4" opacity=".8"/>';

    var midX = (sx + qx) / 2;
    var arrowY = Math.min(sy0, qy0) - 18;
    var diff = q - s;
    var sign = diff > 0 ? '\u25B2' : diff < 0 ? '\u25BC' : '=';
    var diffCol = statusColor;
    h += '<text x="' + midX + '" y="' + arrowY + '" fill="' + diffCol + '" font-size="16" text-anchor="middle">' + sign + '</text>';
    h += '<text x="' + midX + '" y="' + (arrowY + 15) + '" fill="' + diffCol + '" font-size="11" text-anchor="middle" font-weight="700">' + (diff > 0 ? '+' : '') + fmtShort(diff) + '</text>';
    h += '<text x="' + sx + '" y="' + (y0 - 6) + '" fill="#60a5fa" font-size="11" text-anchor="middle" font-weight="700">Strike</text>';
    h += '<text x="' + qx + '" y="' + (y0 - 6) + '" fill="' + cotBarColor + '" font-size="11" text-anchor="middle" font-weight="700">Cotação</text>';
    h += '<text x="' + sx + '" y="' + (y0 + totalH + 20) + '" fill="#60a5fa" font-size="11" text-anchor="middle" font-weight="700">' + fmtK(s) + '</text>';
    h += '<text x="' + qx + '" y="' + (y0 + totalH + 20) + '" fill="' + cotBarColor + '" font-size="11" text-anchor="middle" font-weight="700">' + fmtK(q) + '</text>';

    svg.innerHTML = h;

    if (diffEl) {
      var diffVal = (q - s);
      var diffSign2 = diffVal > 0 ? '+' : '';
      var distPct = s > 0 ? Math.abs(diffVal) / s * 100 : 0;
      var isCall = (tipo || '').toUpperCase() === 'CALL';
      var isITM = isCall ? (diffVal > 0) : (diffVal < 0);
      var popEst = isITM ? Math.max(5, 50 - distPct * 4) : Math.min(95, 50 + distPct * 4);
      var popColor = popEst >= 50 ? '#22c55e' : '#ef4444';

      var pmHtml = '';
      if (pm && pm > 0) {
        var pmFmt = 'US$ ' + pm.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
        if (window.CryptoUtils && window.CryptoUtils.renderPmLink) {
          pmHtml = '<div class="vg-td-badge"><span>PM:</span> ' + window.CryptoUtils.renderPmLink(par || 'BTC', pm) + '</div>';
        } else {
          pmHtml = '<div class="vg-td-badge"><span>PM:</span> <span class="vg-td-val" style="color:#f2a900">' + pmFmt + '</span></div>';
        }
      }

      diffEl.innerHTML = '<div class="vg-td-badge"><span>Diferença:</span> <span class="vg-td-val" style="color:' + diffCol + '">' + diffSign2 + fmtShort(diffVal) + '</span></div>' +
                           '<div class="vg-td-badge"><span>PoP:</span> <span class="vg-td-val" style="color:' + popColor + '">' + popEst.toFixed(0) + '%</span></div>' +
                           pmHtml;

      if (window.CryptoUtils && window.CryptoUtils.bindPmTooltips) {
        window.CryptoUtils.bindPmTooltips();
      }
    }
  }

  function buildOpThermometer(s, q, tipo, pm, par, bodyEl) {
    if (!bodyEl) return;
    updateOpThermometerSvg(s, q, tipo, pm, par, bodyEl);
    var chartContainer = bodyEl.querySelector('.vg-op-mini-chart-container');
    if (chartContainer && s && q) {
      buildOpMiniChart(chartContainer, par + 'USDT', s, q, tipo);
    }
  }

  /* ─ Mini TradingView Chart (no selo — selo agora está no header do card) ─ */
  var _currentSealPar = null;
  var _currentSealStrike = null;
  var _currentSealCot = null;
  var _currentSealTipo = null;

  /* ─ Cotação em tempo real — usa o serviço global CryptoLive (crypto-live.js) ─ */
  var _vgQuoteThrottle = 0;

  function connectBinanceWs(par) {
    // Delega ao serviço global (conexão única compartilhada por todo o sistema)
    if (window.CryptoLive && par) {
      window.CryptoLive.addAsset(par);
    }
  }

  function disconnectBinanceWs() {
    // Serviço global compartilhado — não desconecta; outros módulos também o usam
  }

  // Listener global: atualiza o termômetro somente quando o tick pertence ao par selecionado
  window.addEventListener('cryptoLiveQuote', function (ev) {
    var detail = ev.detail;
    if (!detail || !detail.asset || !detail.price) return;
    if (_currentSealPar && detail.asset.toUpperCase() === _currentSealPar.toUpperCase()) {
      var now = Date.now();
      if (now - _vgQuoteThrottle < 400) return; // throttle ~400ms
      _vgQuoteThrottle = now;
      updateThermoPrice(detail.price);
    }
  });

  function updateThermoPrice(newPrice) {
    if (!isFinite(newPrice) || newPrice <= 0 || !_currentSealPar) return;
    _currentSealCot = newPrice;
    var pmVal = computePM(window.cryptoOperacoes, _currentSealPar);
    // Atualiza apenas o SVG e diff row do accordion ativo (sem recriar TradingView)
    var activeRow = document.querySelector('.vg-op-row.vg-op-active');
    if (activeRow) {
      var activeBody = document.getElementById(activeRow.id + '-body');
      if (activeBody) {
        updateOpThermometerSvg(_currentSealStrike, newPrice, _currentSealTipo, pmVal, _currentSealPar, activeBody);
      }
    }
    // Atualiza badge do selo no header
    var badge = document.getElementById('vgSealBadge');
    if (badge) {
      var st = thermoStatus(_currentSealStrike, newPrice, _currentSealTipo);
      var c = st.cls === 'otm' ? '#ef4444' : '#22c55e';
      var l = st.cls === 'otm' ? 'EM EXERCÍCIO' : 'SEGURA';
      var p = _currentSealStrike > 0 ? ((newPrice - _currentSealStrike) / _currentSealStrike * 100) : 0;
      var ps = p >= 0 ? '+' : '';
      badge.style.color = c;
      badge.style.borderColor = c;
      badge.style.background = 'rgba(' + (st.cls === 'otm' ? '239,68,68' : '34,197,94') + ',.15)';
      badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + c + ';display:inline-block;box-shadow:0 0 6px ' + c + '"></span>' + l + ' ' + ps + p.toFixed(2) + '%';
      badge.title = l + ' ' + ps + p.toFixed(2) + '%';
    }
  }

  function buildSeal(s, q, tipo, pm, par) {
    _currentSealPar = par;
    _currentSealStrike = s;
    _currentSealCot = q;
    _currentSealTipo = tipo;
    loadMiniTradingViewChart(par);
    renderMiniStrikeOverlay(s, q, tipo);
    connectBinanceWs(par);
    startVgLiveTicker(par);
  }

  /* ─ Ticker próprio da Visão Geral ─
     O gráfico TradingView atualiza em tempo real via servidores próprios; já o restante
     da tela depende do CryptoLive (WS Binance bloqueado em algumas redes → polling).
     Este ticker rápido garante que o valor exibido SOBRE o gráfico (pill "Cotação")
     e os valores ABAIXO (termômetro / linha de diferença) acompanhem a cotação ao vivo
     mesmo com o intervalo global de polling alto. */
  var _vgLiveFetching = false;
  var _vgLiveTickerSealPar = null;

  function startVgLiveTicker(par) {
    _vgLiveTickerSealPar = par;
    if (_vgLiveTimer) return;
    _vgLiveTimer = setInterval(function() {
      var p = _vgLiveTickerSealPar || _currentSealPar;
      if (!p || _vgLiveFetching) return;
      // Se o CryptoLive tem tick fresco do WS (fonte canônica), usa o cache em vez de fetch
      try {
        if (window.CryptoLive && window.CryptoLive.getPrice) {
          var cached = window.CryptoLive.getPrice(p);
          if (cached) {
            updateThermoPrice(parseFloat(cached));
            return;
          }
        }
      } catch (e) {}
      _vgLiveFetching = true;
      fetch((globalThis.API_BASE || '') + '/api/proxy/crypto/' + p + 'USDT', { cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var raw = d && (d.price || d.lastPrice || d.last || d.c || d.close);
          var v = parseFloat(raw);
          if (isFinite(v) && v > 0) updateThermoPrice(v);
        })
        .catch(function() {})
        .finally(function() { _vgLiveFetching = false; });
    }, 2500);
  }

  /* ─ Mini TradingView Chart ─ */
  var _vgLiveTimer = null;

  // Strike NÃO é desenhado dentro do gráfico: a API do embed TradingView não é
  // acessível (onChartReady não dispara / chart() não expõe priceScale ou shapes),
  // então não há posicionamento de etiqueta sobre o mapa. O valor do strike é exibido
  // no termômetro e no card — sinais visuais que já coincidem com a escala real.

  // Pinta apenas o VALOR do strike DENTRO do mini gráfico, posicionado na altura exata
  // do preço na escala do TradingView — sem pill flutuante sobre o mapa. A linha de
  // cotação fica por conta do próprio TradingView (linha de preço padrão).
  function renderMiniStrikeOverlay(strike, currentPrice, tipo) {
    var chartContainer = document.getElementById('vgMiniChartContainer');
    var wrapper = chartContainer ? chartContainer.parentElement : null;
    if (!chartContainer || !wrapper) return;

    var old = document.getElementById('vgMiniStrikeOverlay');
    if (old) old.remove();
  }

  function loadMiniTradingViewChart() {
    // Container antigo (vgMiniChartContainer) removido — gráficos agora são por accordion
  }

  function reloadMiniChart() {
    // Função antiga removida — gráficos agora são gerenciados por accordion
  }

  function thermoStatus(s, q, tipo) {
    var diff = q - s;
    var pct  = s > 0 ? (diff / s * 100).toFixed(2) : '0.00';
    // Para CALL vendida: cot > strike = ITM (perigoso), cot < strike = OTM (seguro)
    // Para PUT vendida:  cot < strike = ITM (perigoso), cot > strike = OTM (seguro)
    var isCall = (tipo || '').toUpperCase() === 'CALL';
    var isITM = isCall ? (diff >= 0) : (diff <= 0);
    if (isITM) return { cls: 'otm', label: 'ITM — Risco de Exercício', pct: pct };
    return { cls: 'itm', label: 'OTM — Fora do Dinheiro', pct: pct };
  }

  function fmtShort(n) {
    var abs = Math.abs(n);
    if (abs >= 1000) return (n/1000).toFixed(2) + 'k';
    return n.toFixed(2);
  }

  /* ─ Atualiza cotação ao vivo ─ */
  async function atualizarCotacoesVG(par) {
    try {
      var price = null;
      // Usa o cache do serviço global CryptoLive quando disponível
      if (window.CryptoLive) {
        price = window.CryptoLive.getPrice(par);
      }
      if (!price) {
        var sym = par + 'USDT';
        var res = await fetch(API_BASE + '/api/proxy/crypto/' + sym);
        var data = await res.json();
        if (data && data.price) price = parseFloat(data.price);
      }
      if (price) {
        (window.cryptoOperacoes || []).forEach(function(op) {
          var a = (op.ativo || '').toUpperCase().replace('USDT', '').replace('/', '').trim();
          if (a === par.toUpperCase()) op.cotacao_atual = price;
        });
        document.dispatchEvent(new CustomEvent('cryptoDataUpdated'));
      }
    } catch (e) {
      if (window.iziToast) iziToast.error({ title: 'Erro', message: 'Erro ao atualizar cotação de ' + par });
    }
  }

  /* ─ Render principal ─ */
  function render() {
    var container = document.getElementById('vgContainer');
    if (!container) return;
    var ops = window.cryptoOperacoes;
    if (!Array.isArray(ops) || ops.length === 0) {
      container.innerHTML = '<div style="padding:32px;text-align:center;color:#7890b0;font-size:.85rem">Nenhuma operação disponível.</div>';
      return;
    }
    injectVGStyles();
    if (_vgLiveTimer) { clearInterval(_vgLiveTimer); _vgLiveTimer = null; _vgLiveTickerSealPar = null; _vgLiveFetching = false; }
    disconnectBinanceWs();
    container.innerHTML = renderVG(ops);
    /* Listeners: clique na linha de posição aberta → toggle accordion */
    container.querySelectorAll('.vg-op-row[data-op-id]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        // Se clicou em botão de ação, não faz nada (cada botão tem seu próprio handler)
        var target = e.target;
        var isActionBtn = target.closest('.vg-op-detail-btn') || target.closest('.vg-refresh-cot-btn') || target.closest('.vg-chart-btn');
        if (isActionBtn) return;
        var rowId = el.id;
        var bodyId = rowId + '-body';
        var body = document.getElementById(bodyId);
        if (!body) return;
        var isOpen = !body.classList.contains('hide');
        // Accordion exclusivo: fechar todos os outros antes de abrir
        container.querySelectorAll('.vg-op-row-body').forEach(function(b) {
          if (b.id !== bodyId) {
            b.classList.add('hide');
            b.style.display = 'none';
            var otherIco = b.previousElementSibling;
            if (otherIco) {
              var icoEl = otherIco.querySelector('.vg-op-toggle-ico');
              if (icoEl) icoEl.textContent = '\u25B6';
            }
          }
        });
        body.classList.toggle('hide');
        body.style.display = isOpen ? 'none' : 'block';
        var ico = el.querySelector('.vg-op-toggle-ico');
        if (ico) ico.textContent = isOpen ? '\u25B6' : '\u25BC';
        // Atualiza termômetro da operação selecionada
        var strike  = parseFloat(el.getAttribute('data-strike') || 0);
        var cotacao = parseFloat(el.getAttribute('data-cotacao') || 0);
        var tipo    = el.getAttribute('data-tipo') || 'PUT';
        var clickPar = el.getAttribute('data-par') || 'BTC';
        container.querySelectorAll('.vg-op-row').forEach(function(r) { r.classList.remove('vg-op-active'); });
        el.classList.add('vg-op-active');
        var pmVal = computePM(ops, clickPar);
        buildSeal(strike, cotacao, tipo, pmVal, clickPar);
        if (!isOpen) {
          setTimeout(function() {
            buildOpThermometer(strike, cotacao, tipo, pmVal, clickPar, body);
          }, 10);
        }
      });

      // Tooltip compartilhado
      el.addEventListener('mouseenter', function() {
        if (!window.SharedTooltip) return;
        var opId = el.getAttribute('data-op-id');
        var asset = el.getAttribute('data-par') || '';
        var tipo = el.getAttribute('data-tipo') || 'PUT';
        var strike = parseFloat(el.getAttribute('data-strike') || 0);
        var cotacao = parseFloat(el.getAttribute('data-cotacao') || 0);
        var dist = strike > 0 && cotacao > 0 ? ((cotacao - strike) / strike * 100) : 0;
        var distSign = dist >= 0 ? '+' : '';
        var op = ops.find(function(o) { return String(o.id) === opId; });
        var premio = op ? parseFloat(op.premio_us || 0) : 0;
        var vencimento = op ? (op.vencimento || op.exercicio || '') : '';
        var pmVal = computePM(ops, asset);
        var vsPm = pmVal > 0 && cotacao > 0 ? ((cotacao - pmVal) / pmVal * 100) : 0;
        var vsPmSign = vsPm >= 0 ? '+' : '';

        var lines = [
          { key: '📅 Data', value: vencimento ? vencimento.substring(0, 10).split('-').reverse().join('/') : '—' },
          { key: '🏷️ Tipo', value: tipo },
          { key: '📌 Strike', value: 'US$ ' + strike.toLocaleString('en-US', {minimumFractionDigits: 2}) },
          { key: '💰 Prêmio', value: '+US$ ' + premio.toFixed(2), className: 'tt-positive' },
          { key: '📏 Distância', value: distSign + dist.toFixed(2) + '%', className: dist >= 0 ? 'tt-positive' : 'tt-negative' },
          { key: '📊 Cotação vs PM', value: vsPmSign + vsPm.toFixed(2) + '%', className: vsPm >= 0 ? 'tt-positive' : 'tt-negative' },
        ];

        if (pmVal > 0) {
          lines.push({ key: '🧮 PM', value: 'US$ ' + pmVal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) });
        }

        window.SharedTooltip.show(el, {
          type: tipo,
          title: 'Operação ' + tipo + ' — ' + asset,
          lines: lines,
          note: 'Clique para ver detalhes do cálculo do preço médio e evolução de prêmios',
        });
      });

      el.addEventListener('mouseleave', function() {
        if (window.SharedTooltip) window.SharedTooltip.hide();
      });
    });
    /* Listener: cabeçalho "Posições Abertas" → abre modal de análise da primeira op aberta */
    var headerEl = document.getElementById('vgOpenPosHeader');
    if (headerEl) {
      headerEl.addEventListener('click', function() {
        var firstOp = abertas.length > 0 ? abertas[0] : null;
        if (firstOp && firstOp.id && window.ModalAnaliseCrypto && typeof window.ModalAnaliseCrypto.open === 'function') {
          window.ModalAnaliseCrypto.open(String(firstOp.id));
        }
      });
    }
    /* Listeners: botão detalhes da operação */
    container.querySelectorAll('.vg-op-detail-btn[data-op-id]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var opId = btn.getAttribute('data-op-id');
        if (opId && window.ModalDetalheCrypto && typeof window.ModalDetalheCrypto.show === 'function') {
          window.ModalDetalheCrypto.show(opId);
        }
      });
    });
    /* Listeners: refresh cotação */
    container.querySelectorAll('.vg-refresh-cot-btn[data-par]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var par = btn.getAttribute('data-par');
        if (par) {
          atualizarCotacoesVG(par);
          reloadMiniChart();
        }
      });
    });
    /* Listeners: gráfico TradingView */
    container.querySelectorAll('.vg-chart-btn[data-par]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var par = btn.getAttribute('data-par');
        var strike = parseFloat(btn.getAttribute('data-strike') || 0);
        var cotacao = parseFloat(btn.getAttribute('data-cotacao') || 0);
        var tipo = btn.getAttribute('data-tipo') || '';
        if (par && window.CryptoTechnicalAnalysis && typeof window.CryptoTechnicalAnalysis.open === 'function') {
          window.CryptoTechnicalAnalysis.open({
            ticker: par,
            strike: strike || null,
            currentPrice: cotacao || null,
            operationType: tipo || null
          });
        }
      });
    });
    /* Accordion toggle do termômetro */
    var accBtn = document.getElementById('vgThermoAccBtn');
    var accBody = document.getElementById('vgThermoAccBody');
    if (accBtn && accBody) {
      accBtn.addEventListener('click', function() {
        var expanded = accBtn.getAttribute('aria-expanded') === 'true';
        accBtn.setAttribute('aria-expanded', String(!expanded));
        accBody.style.display = expanded ? 'none' : 'block';
        accBtn.classList.toggle('collapsed', expanded);
      });
    }
    setTimeout(function() {
      buildVGCharts(ops);
      // Inicializa termômetro/selo somente com operação aberta
      var abertasOps = computeAbertasInfo(ops);
      if (abertasOps.length > 0) {
        var seedOp = abertasOps[0];
        var initPar = (seedOp.ativo || 'BTC').toUpperCase().replace('USDT','').replace('/','').trim();
        var pmInit = computePM(ops, initPar);
        buildThermometer(parseFloat(seedOp.strike || 0), parseFloat(seedOp.cotacao_atual || 0), (seedOp.tipo || 'PUT'), pmInit, initPar);
        buildSeal(parseFloat(seedOp.strike || 0), parseFloat(seedOp.cotacao_atual || 0), (seedOp.tipo || 'PUT'), pmInit, initPar);
      }
      /* Abre o primeiro accordion por padrão */
      var firstRow = container.querySelector('.vg-op-row[data-op-id]');
      if (firstRow) {
        var firstBodyId = firstRow.id + '-body';
        var firstBody = document.getElementById(firstBodyId);
        if (firstBody) {
          firstBody.classList.remove('hide');
          firstBody.style.display = 'block';
          var firstIco = firstRow.querySelector('.vg-op-toggle-ico');
          if (firstIco) firstIco.textContent = '\u25BC';
          firstRow.classList.add('vg-op-active');
          var firstStrike  = parseFloat(firstRow.getAttribute('data-strike') || 0);
          var firstCotacao = parseFloat(firstRow.getAttribute('data-cotacao') || 0);
          var firstTipo    = firstRow.getAttribute('data-tipo') || 'PUT';
          var firstPar     = firstRow.getAttribute('data-par') || 'BTC';
          var firstPmVal   = computePM(ops, firstPar);
          setTimeout(function() {
            buildOpThermometer(firstStrike, firstCotacao, firstTipo, firstPmVal, firstPar, firstBody);
          }, 10);
        }
      }
    }, 50);
  }

  /* ─ Escuta quando a aba é ativada (Bootstrap tabs) ─ */
  function init() {
    // Carrega última PUT exercida do backend
    loadUltimaPutExercida();

    // Tenta renderizar assim que houver dados
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      if (Array.isArray(window.cryptoOperacoes) && window.cryptoOperacoes.length > 0) {
        clearInterval(timer);
        render();
      } else if (attempts > 30) {
        clearInterval(timer);
        render(); // renderiza mesmo vazio
      }
    }, 200);

    // Re-renderiza quando trocar para a aba
    document.addEventListener('shown.bs.tab', function(e) {
      if (e.target && (e.target.getAttribute('href') === '#tab-visao-geral' || e.target.dataset.bsTarget === '#tab-visao-geral')) {
        render();
      }
    });

    // Re-renderiza quando os dados são atualizados
    document.addEventListener('cryptoDataUpdated', function() {
      var pane = document.getElementById('tab-visao-geral');
      if (pane && pane.classList.contains('active')) render();
    });

    // Re-renderiza ao trocar tema (recria o gráfico com as cores corretas)
    document.addEventListener('themeChanged', function() {
      var pane = document.getElementById('tab-visao-geral');
      if (pane && pane.classList.contains('active')) render();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.VisaoGeralCrypto = { render: render, _cachedPutExercida: _cachedPutExercida };

})();

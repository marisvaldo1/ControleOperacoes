// visao-geral-crypto.js v1.0.0
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
    var ops = (allOps || []).filter(function(o) {
      return (o.ativo || '').toUpperCase().replace('USDT','').replace('/','').trim() === par.toUpperCase();
    });
    if (!ops.length) return 0;
    var putsExercidas = ops.filter(function(o) {
      if ((o.status || '').toUpperCase() === 'ABERTA') return false;
      return window.CryptoExerciseStatus && window.CryptoExerciseStatus.isExercised
        ? window.CryptoExerciseStatus.isExercised(o, 'PUT') : false;
    });
    var ultimoExercicio = putsExercidas.length
      ? putsExercidas.sort(function(a, b) {
          var aT = window.CryptoExerciseStatus && window.CryptoExerciseStatus.getOperationDate ? window.CryptoExerciseStatus.getOperationDate(a) : null;
          var bT = window.CryptoExerciseStatus && window.CryptoExerciseStatus.getOperationDate ? window.CryptoExerciseStatus.getOperationDate(b) : null;
          return (bT && bT.getTime ? bT.getTime() : 0) - (aT && aT.getTime ? aT.getTime() : 0);
        })[0]
      : null;
    var strikeBase = ultimoExercicio
      ? parseFloat(ultimoExercicio.strike || 0)
      : parseFloat(ops.reduce(function(max, o) { return parseFloat(o.strike||0) > parseFloat(max.strike||0) ? o : max; }, ops[0]).strike || 0);
    var cicloDate = ultimoExercicio ? (ultimoExercicio.exercicio || ultimoExercicio.data_operacao || '') : '';
    var totalPremios = ops.reduce(function(s, o) {
      if (!cicloDate) return s + (parseFloat(o.premio_us) || 0);
      var d = o.exercicio || o.data_operacao || '';
      if (d >= cicloDate) return s + (parseFloat(o.premio_us) || 0);
      return s;
    }, 0);
    return strikeBase - totalPremios;
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
    h += '<div class="vg-card-title"><span>&#128269;</span>Posições Abertas Agora</div>';
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
        var activeClass = idx === 0 ? ' vg-op-active' : '';
        h += '<div class="vg-op-row' + activeClass + '" data-op-id="' + (op.id || '') + '" data-par="' + asset + '" data-strike="' + strike + '" data-cotacao="' + cot + '" data-tipo="' + tipo + '" style="border-left:3px solid ' + acol + ';cursor:pointer">';
        h += '<span style="font-family:var(--syne,Syne),sans-serif;font-size:.8rem;font-weight:700;min-width:30px;color:'+bcol+'">'+asset+'</span>';
        h += '<span class="vg-badge" style="background:rgba(59,130,246,.1);color:#3b82f6;border:1px solid rgba(59,130,246,.26)">'+tipo+'</span>';
        h += corrBadge;
        if (isEx) h += '<span class="vg-badge" style="background:rgba(249,115,22,.1);color:#f97316;border:1px solid rgba(249,115,22,.26)">Poss. Exercício</span>';
        h += '<div style="flex:1"></div>';
        h += '<span style="font-size:.68rem;color:' + C_MUTED + ';margin-right:2px">Prêmio Recebido:</span><span style="font-family:monospace;font-size:.78rem;font-weight:700;color:#22c55e">+' + fmt(premio) + '</span>';
        h += '<span class="vg-op-detail-btn" data-op-id="' + (op.id || '') + '" title="Ver detalhes"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>';
        h += '<span class="vg-refresh-cot-btn" data-par="' + asset + '" title="Atualizar cotação"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg></span>';
        h += '<span class="vg-chart-btn" data-par="' + asset + '" data-strike="' + strike + '" data-cotacao="' + cot + '" data-tipo="' + tipo + '" title="Gráfico TradingView"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>';
        h += '</div>';
      });
    }
    /* Termômetro Duplo — accordion aberto por padrão */
    h += '<div class="vg-thermometer-wrap" id="vgThermometerWrap">';
    h += '<div class="vg-thermo-accordion">';
    h += '<button class="vg-thermo-acc-btn" id="vgThermoAccBtn" type="button" aria-expanded="true">';
    h += '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    h += ' Strike vs Cotação</button>';
    h += '<div class="vg-thermo-acc-body" id="vgThermoAccBody">';
    h += '<div class="vg-thermo-layout">';
    h += '<div class="vg-thermo-left">';
    h += '<svg id="vgThermometerSvg" class="vg-thermo-svg" viewBox="0 0 400 250" width="100%" height="250"></svg>';
    h += '</div>';
    h += '<div class="vg-thermo-right" id="vgSealContainer"></div>';
    h += '</div>';
    h += '<div class="vg-thermo-diff-row" id="vgThermoDiff"></div>';
    h += '</div></div></div>';
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
          },
          scales: (function() {
            var isLight = document.body.getAttribute('data-bs-theme') === 'light';
            var tc  = isLight ? '#6c757d' : '#3a4f6a';
            var gc  = isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.04)';
            return {
              x:  { grid: { display: false }, ticks: { color: tc, font: { size: 10 } }, stacked: true },
              y:  { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: function(v) { return '$' + v.toFixed(0); } }, stacked: true },
              y2: { position: 'right', grid: { display: false }, ticks: { color: '#f59e0b', font: { size: 10 }, callback: function(v) { return '$' + v.toFixed(0); } } }
            };
          }())
        }
      });
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
      '.vg-thermo-layout{display:flex;align-items:flex-start;gap:16px}',
      '.vg-thermo-left{flex:1;min-width:0}',
      '.vg-thermo-right{width:180px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:8px}',
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
    var totalH = 175, barW = 46, y0 = 28;
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
      h += '<line x1="70" y1="' + gy + '" x2="330" y2="' + gy + '" stroke="#334d6e" stroke-width="1"/>';
      h += '<text x="62" y="' + (gy + 4) + '" fill="#8aa4c0" font-size="10" text-anchor="end">' + label + '</text>';
      h += '<text x="338" y="' + (gy + 4) + '" fill="#8aa4c0" font-size="10">' + label + '</text>';
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

    // Diff row + PoP
    if (diffEl) {
      var diffVal = (q - s);
      var diffSign2 = diffVal > 0 ? '+' : '';
      // Calcular PoP heurístico baseado na distância
      var distPct = s > 0 ? Math.abs(diffVal) / s * 100 : 0;
      var isCall = (tipo || '').toUpperCase() === 'CALL';
      var isITM = isCall ? (diffVal > 0) : (diffVal < 0);
      var popEst = isITM ? Math.max(5, 50 - distPct * 4) : Math.min(95, 50 + distPct * 4);
      var popColor = popEst >= 65 ? '#22c55e' : popEst >= 50 ? '#eab308' : '#ef4444';
      diffEl.innerHTML = '<span>Diferença: <span style="color:' + diffCol + '">' + diffSign2 + fmtShort(diffVal) + '</span></span>' +
                         '<span>PoP: <span style="color:' + popColor + ';font-weight:700">' + popEst.toFixed(0) + '%</span></span>' +
                         (pm ? '<span>Preço Médio: ' + CryptoUtils.renderPmLink(par || 'BTC', pm) + '</span>' : '');
    }
  }

  /* ─ Selo Central de Status ─ */
  function buildSeal(s, q, tipo) {
    var container = document.getElementById('vgSealContainer');
    if (!container) return;

    if (!s || !q) {
      container.innerHTML = '';
      return;
    }

    var st = thermoStatus(s, q, tipo);
    var diff = q - s;
    var pct = s > 0 ? (diff / s * 100) : 0;
    var pctSign = pct >= 0 ? '+' : '';

    // Cores do selo baseadas no status (apenas vermelho ou verde)
    var sealColor, sealLabel;
    if (st.cls === 'otm') {
      // ITM / Risco de exercício → vermelho
      sealColor = '#ef4444';
      sealLabel = 'EM EXERCÍCIO';
    } else {
      // OTM / Seguro → verde
      sealColor = '#22c55e';
      sealLabel = 'SEGURA';
    }

    var tipoLabel = (tipo || 'PUT').toUpperCase() === 'CALL' ? '📉 CALL vendida' : '📉 PUT vendida';

    // Container centralizado com tudo em coluna
    var html = '<div style="display:flex;flex-direction:column;align-items:center;width:100%">';
    // SVG círculo grande do selo
    html += '<svg class="vg-seal-svg" viewBox="0 0 200 200" width="160" height="160">';
    html += '<circle cx="100" cy="100" r="80" fill="' + sealColor + '" opacity=".12"/>';
    html += '<circle cx="100" cy="100" r="68" fill="#0d1424" stroke="' + sealColor + '" stroke-width="4"';
    if (st.cls === 'otm') html += ' class="vg-seal-pulse"';
    html += '/>';
    var emoji = st.cls === 'otm' ? '🔴' : '🟢';
    html += '<text x="100" y="82" text-anchor="middle" font-size="22">' + emoji + '</text>';
    html += '<text x="100" y="106" text-anchor="middle" font-size="14" font-weight="800" fill="' + sealColor + '">' + sealLabel + '</text>';
    html += '<text x="100" y="126" text-anchor="middle" font-size="15" font-weight="800" fill="' + sealColor + '">' + pctSign + pct.toFixed(2) + '%</text>';
    html += '</svg>';
    // Textos abaixo do círculo
    html += '<div style="text-align:center;margin-top:6px">';
    html += '<div style="font-size:12px;color:#94a3b8;font-weight:600">' + tipoLabel + '</div>';
    html += '</div></div>';

    container.innerHTML = html;
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
      var sym = par + 'USDT';
      var res = await fetch(API_BASE + '/api/proxy/crypto/' + sym);
      var data = await res.json();
      if (data && data.price) {
        var price = parseFloat(data.price);
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
    container.innerHTML = renderVG(ops);
    /* Listeners: clique na linha de posição aberta → atualiza termômetro */
    container.querySelectorAll('.vg-op-row[data-op-id]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        // Se clicou em botão de ação, não faz nada (cada botão tem seu próprio handler)
        if (e.target.closest('.vg-op-detail-btn') || e.target.closest('.vg-refresh-cot-btn') || e.target.closest('.vg-chart-btn')) return;
        var strike  = parseFloat(el.getAttribute('data-strike') || 0);
        var cotacao = parseFloat(el.getAttribute('data-cotacao') || 0);
        var tipo    = el.getAttribute('data-tipo') || 'PUT';
        var clickPar = el.getAttribute('data-par') || 'BTC';
        // Destaca a row ativa
        container.querySelectorAll('.vg-op-row').forEach(function(r) { r.classList.remove('vg-op-active'); });
        el.classList.add('vg-op-active');
        // Atualiza termômetro e selo
        var pmVal = computePM(ops, clickPar);
        buildThermometer(strike, cotacao, tipo, pmVal, clickPar);
        buildSeal(strike, cotacao, tipo, pmVal, clickPar);
      });
    });
    /* Listeners: clique na lupa → abre modal de análise */
    container.querySelectorAll('.vg-op-detail-btn[data-op-id]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var opId = btn.getAttribute('data-op-id');
        if (opId && window.ModalAnaliseCrypto && typeof window.ModalAnaliseCrypto.open === 'function') {
          window.ModalAnaliseCrypto.open(opId);
        }
      });
    });
    /* Listeners: refresh cotação */
    container.querySelectorAll('.vg-refresh-cot-btn[data-par]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var par = btn.getAttribute('data-par');
        if (par) atualizarCotacoesVG(par);
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
      // Inicializa termômetro com a primeira operação aberta
      var abertasOps = computeAbertasInfo(ops);
      if (abertasOps.length > 0) {
        var firstOp = abertasOps[0];
        var initPar = (firstOp.ativo || 'BTC').toUpperCase().replace('USDT','').replace('/','').trim();
        var pmInit = computePM(ops, initPar);
        buildThermometer(parseFloat(firstOp.strike || 0), parseFloat(firstOp.cotacao_atual || 0), (firstOp.tipo || 'PUT'), pmInit, initPar);
        buildSeal(parseFloat(firstOp.strike || 0), parseFloat(firstOp.cotacao_atual || 0), (firstOp.tipo || 'PUT'), pmInit, initPar);
      }
    }, 50);
  }

  /* ─ Escuta quando a aba é ativada (Bootstrap tabs) ─ */
  function init() {
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

  window.VisaoGeralCrypto = { render: render };

})();

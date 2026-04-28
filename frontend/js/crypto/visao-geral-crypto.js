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
    h += '<div class="vg-chart-wrap" style="height:300px"><canvas id="vgChartAcc"></canvas></div>';
    h += '</div>';

    /* RIGHT-TOP: Posições Abertas + Distância */
    h += '<div class="vg-card">';
    h += '<div class="vg-card-title"><span>&#128269;</span>Posições Abertas Agora</div>';
    if (abertas.length === 0) {
      h += '<div style="color:' + C_MUTED + ';font-size:.72rem;padding:12px 0">Nenhuma posição aberta</div>';
    } else {
      abertas.forEach(function(op) {
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
        h += '<div class="vg-op-row" data-op-id="' + (op.id || '') + '" style="border-left:3px solid ' + acol + ';cursor:pointer">';
        h += '<span style="font-family:var(--syne,Syne),sans-serif;font-size:.8rem;font-weight:700;min-width:30px;color:'+bcol+'">'+asset+'</span>';
        h += '<span class="vg-badge" style="background:rgba(59,130,246,.1);color:#3b82f6;border:1px solid rgba(59,130,246,.26)">'+tipo+'</span>';
        h += corrBadge;
        if (isEx) h += '<span class="vg-badge" style="background:rgba(249,115,22,.1);color:#f97316;border:1px solid rgba(249,115,22,.26)">Poss. Exercício</span>';
        h += '<div style="flex:1;font-size:.68rem;color:' + C_MUTED + '">Strike ' + fmtK(strike) + ' &middot; Cot. ' + fmtK(cot) + '</div>';
        h += '<div style="font-size:.68rem;color:' + C_MUTED + '">Dist. <span style="color:' + (isEx?'#f97316':'#22c55e') + '">' + fmtP(Math.abs(dist)) + '</span></div>';
        h += '<span style="font-family:monospace;font-size:.78rem;font-weight:700;color:#22c55e">+' + fmt(premio) + '</span>';
        h += '</div>';
      });
    }
    /* Bullet Chart — Distância ao Strike */
    h += '<div style="margin-top:12px">';
    h += '<div class="vg-card-title" style="margin-bottom:8px">Distância ao Strike — Bullet Chart</div>';
    abertas.forEach(function(op) {
      var asset   = (op.ativo||'?').toUpperCase();
      var tipo    = (op.tipo||'CALL').toUpperCase();
      var cot     = parseFloat(op.cotacao_atual || 0);
      var strike  = parseFloat(op.strike || 0);
      // dist positivo = cot acima do strike (OTM para CALL) → seguro
      // dist negativo = cot abaixo do strike (ITM para CALL) → risco
      var dist    = strike > 0 && cot > 0 ? ((cot - strike) / strike * 100) : 0;
      var absDist = Math.abs(dist);
      var corr    = (op.corretora || 'BINANCE').toUpperCase();
      var col     = absDist < 2 ? '#e05c5c' : absDist < 4 ? '#e8a020' : '#27c078';
      var acol    = asset === 'BTC' ? '#f59e0b' : '#06b6d4';
      // Range visual: -10% (deep ITM) → 0% (Strike) → +10% (OTM seguro)
      // Strike fixo em 50% da barra. Fill proporcional à cotação nesse range.
      var RANGE   = 10; // % de cada lado
      var cotPct  = Math.max(2, Math.min(97, 50 + (dist / RANGE) * 50));
      var strikePct = 50;
      var corrStyle = corr === 'BINANCE'
        ? 'background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.35)'
        : corr === 'BYBIT'
        ? 'background:rgba(6,182,212,.15);color:#06b6d4;border:1px solid rgba(6,182,212,.35)'
        : 'background:rgba(148,163,184,.12);color:#94a3b8;border:1px solid rgba(148,163,184,.3)';
      var corrLabel = corr === 'BINANCE' ? 'BNC' : corr === 'BYBIT' ? 'BB' : corr;
      h += '<div style="padding:6px 0;border-bottom:1px solid rgba(42,48,80,.4)">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">';
      h += '<div style="display:flex;align-items:center;gap:5px">';
      h += '<span style="font-family:var(--syne,Syne),sans-serif;font-size:.75rem;font-weight:700;color:'+acol+'">'+asset+'</span>';
      h += '<span style="padding:2px 5px;border-radius:4px;font-size:.67rem;font-weight:500;background:rgba(59,130,246,.1);color:#3b82f6;border:1px solid rgba(59,130,246,.26)">'+tipo+'</span>';
      h += '<span style="padding:2px 5px;border-radius:4px;font-size:.67rem;font-weight:500;'+corrStyle+'">'+corrLabel+'</span>';
      h += '</div>';
      h += '<span style="font-size:.75rem;font-weight:600;color:'+col+'">' + fmtP(dist) + '</span>';
      h += '</div>';
      // Barra: zona vermelha (0–50%), zona verde (50–100%), marcador Strike, círculo cotação
      h += '<div style="background:#252c40;height:16px;border-radius:4px;position:relative;overflow:hidden">';
      h += '<div style="position:absolute;left:0;top:0;width:50%;height:100%;background:rgba(224,92,92,.10)"></div>';
      h += '<div style="position:absolute;left:50%;top:0;width:50%;height:100%;background:rgba(39,192,120,.10)"></div>';
      h += '<span style="position:absolute;left:6px;top:50%;transform:translateY(-50%);font-size:9px;color:rgba(255,255,255,.35)">ITM</span>';
      h += '<span style="position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:9px;color:rgba(255,255,255,.35)">OTM</span>';
      h += '</div>';
      // Overlay: marcador Strike + dot cotação (overflow:visible no container)
      h += '<div style="position:relative;height:0;margin-top:-16px;margin-bottom:16px">';
      h += '<div style="position:absolute;left:'+strikePct+'%;top:-18px;bottom:-2px;width:2px;background:#c9a227;z-index:2"></div>';
      h += '<span style="position:absolute;left:'+(strikePct+1)+'%;top:-14px;transform:translateY(-50%);font-size:9px;color:#c9a227;z-index:3">Strike</span>';
      h += '<div style="position:absolute;left:'+cotPct+'%;top:-8px;width:14px;height:14px;border-radius:50%;background:'+col+';border:2px solid #0d1117;transform:translateX(-50%);z-index:4;box-shadow:0 0 6px '+col+'88"></div>';
      h += '</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:.6rem;color:'+C_MUTED+';margin-top:4px">';
      h += '<span>Cot. ' + fmtK(cot) + '</span>';
      h += '<span>Strike ' + fmtK(strike) + '</span>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';
    h += '</div>';
    h += '</div>'; /* end top grid */

    /* BOTTOM GRID */
    h += '<div style="display:grid;grid-template-columns:3fr 2fr;gap:14px">';

    /* LEFT-BOTTOM: Fluxo do ciclo + Prêmios por ciclo */
    var fluxo = computeBtcFluxo(ops);
    h += '<div class="vg-card">';
    h += '<div class="vg-card-title"><span>&#128260;</span>Fluxo do Ciclo — PUT &#8594; CALL</div>';
    /* Prêmios por ciclo */
    h += '<div class="vg-card-title">Prêmios por Ciclo</div>';
    var maxTotal = Math.max.apply(null, ciclos.map(function(c) { return c.total; })) || 1;
    ciclos.forEach(function(cy) {
      var barW  = Math.min((cy.total / maxTotal) * 100, 100);
      var bc    = cy.total > 0 ? '#22c55e' : '#3b82f6';
      var label = cy.hasOpen ? 'aguardando' : (cy.total > 0 ? '+' + fmt(cy.total) : '—');
      var lc    = cy.hasOpen ? C_MUTED : '#22c55e';
      h += '<div style="margin-bottom:10px">';
      h += '<div style="display:flex;justify-content:space-between;font-size:.66rem;margin-bottom:4px">';
      h += '<span style="color:' + C_MUTED + '">Ciclo ' + cy.date + ' &middot; ' + (cy.assets||'') + '</span>';
      h += '<span style="font-family:monospace;font-weight:600;color:'+lc+'">' + label + '</span>';
      h += '</div>';
      h += '<div style="height:10px;background:' + C_BAR_BG + ';border-radius:3px;overflow:hidden"><div style="height:100%;width:'+barW+'%;background:'+bc+';border-radius:3px;transition:width .7s"></div></div>';
      h += '</div>';
    });
    h += '</div>';

    /* RIGHT-BOTTOM: Projeção + Resumo */
    h += '<div style="display:flex;flex-direction:column;gap:14px">';

    /* Projeção — Bullet Chart */
    h += '<div class="vg-card">';
    h += '<div class="vg-card-title"><span>&#128302;</span>Projeção Próximas Ops</div>';
    proj.forEach(function(p) {
      var ac  = p.asset === 'BTC' ? '#f59e0b' : '#06b6d4';
      var pct = Math.min(90, Math.max(10, (1 - p.dist / 30) * 80));
      h += '<div style="padding:6px 0;border-bottom:1px solid rgba(42,48,80,.4)">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">';
      h += '<div style="display:flex;align-items:center;gap:5px">';
      h += '<span style="font-family:var(--syne,Syne),sans-serif;font-size:.75rem;font-weight:700;color:'+ac+'">'+p.asset+'</span>';
      h += '<span style="padding:2px 5px;border-radius:4px;font-size:.67rem;font-weight:500;background:rgba(59,130,246,.1);color:#3b82f6;border:1px solid rgba(59,130,246,.26)">CALL</span>';
      h += '</div>';
      h += '<span style="font-size:.75rem;font-weight:500;color:#e8a020">+'+p.dist.toFixed(1)+'% acima cot.</span>';
      h += '</div>';
      h += '<div style="background:#252c40;height:16px;border-radius:4px;position:relative;overflow:hidden">';
      h += '<div style="height:100%;background:rgba(79,124,222,.25);width:'+pct+'%;border-radius:4px"></div>';
      h += '<div style="position:absolute;left:'+pct+'%;top:-1px;bottom:-1px;width:2px;background:#27c078"></div>';
      h += '<span style="position:absolute;left:'+(pct+1)+'%;top:50%;transform:translateY(-50%);font-size:9px;color:#27c078">cot. atual</span>';
      h += '</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:.6rem;color:'+C_MUTED+';margin-top:3px">';
      h += '<span>Cot. ' + fmtK(p.cot) + '</span>';
      if (p.premEst > 0) h += '<span style="color:#27c078">Prêm. ~+' + fmt(p.premEst) + '</span>';
      h += '<span>Strike ' + fmtK(p.strikeCall) + '</span>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';

    h += '</div>'; /* end right-bottom */
    h += '</div>'; /* end bottom grid */

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
    /* Listeners: clique na linha de posição aberta → abre modal de análise */
    container.querySelectorAll('.vg-op-row[data-op-id]').forEach(function(el) {
      var opId = el.getAttribute('data-op-id');
      if (!opId) return;
      el.addEventListener('click', function() {
        if (window.ModalAnaliseCrypto && typeof window.ModalAnaliseCrypto.open === 'function') {
          window.ModalAnaliseCrypto.open(opId);
        }
      });
    });
    setTimeout(function() { buildVGCharts(ops); }, 50);
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

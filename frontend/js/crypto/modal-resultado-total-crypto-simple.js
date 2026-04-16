// modal-resultado-total-crypto-simple.js v4.0.0
// Design Claude8 'Atual + Melhorado' com dados reais

(function () {
  'use strict';

  var currentOperacoes = [];
  var filteredCycles   = [];
  var accChart         = null;
  var filterState      = { period: '60d', asset: 'all', tipo: 'all', status: 'all' };

  /* ─ Formatadores ─ */
  function fmt(n)  { return 'US$ ' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function fmtK(n) { return 'US$ ' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function fmtP(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function acCls(a) { return a === 'BTC' ? 'btc' : 'eth'; }
  function acI(a)   { return a === 'BTC' ? '\u20bf' : '\u039e'; }
  function acCol(a) { return a === 'BTC' ? 'var(--btc)' : 'var(--eth)'; }

  function getDateParts(str) {
    if (!str) return { date: '—', dow: '?', iso: '' };
    var p = String(str).split('-');
    if (p.length === 3) {
      var dt  = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      var dws = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
      return { date: p[2]+'/'+p[1]+'/'+p[0], dow: dws[dt.getDay()], iso: str };
    }
    return { date: str, dow: '?', iso: str };
  }

  /* ─ Agrupar por ciclo ─ */
  function groupByCycle(ops) {
    var map = {};
    ops.forEach(function (op) {
      var key = op.data_operacao || op.data_abertura || '2000-01-01';
      if (!map[key]) map[key] = { id: key.replace(/-/g,''), dateKey: key, ops: [] };
      map[key].ops.push(op);
    });

    return Object.keys(map).map(function (key) {
      var cy  = map[key];
      var total = 0, exercidas = 0;
      var putStrike = null, callStrike = null, putAbertura = 0, venc = null;
      var assetSet = {};

      cy.ops.forEach(function (op) {
        var prem   = parseFloat(op.premio_us || 0);
        total     += prem;
        var ts     = (op.exercicio_status || '').toUpperCase();
        if (ts === 'SIM') exercidas++;
        var tipo   = (op.tipo || '').toUpperCase();
        if (tipo === 'PUT' && !putStrike) {
          putStrike   = parseFloat(op.strike   || 0);
          putAbertura = parseFloat(op.abertura || op.strike || 0);
        }
        if (tipo === 'CALL' && !callStrike) callStrike = parseFloat(op.strike || 0);
        var st     = (op.status || '').toUpperCase();
        if (st === 'ABERTA' && !venc && op.exercicio) venc = op.exercicio;
        var ativo  = (op.ativo || '').toUpperCase();
        if (ativo) assetSet[ativo] = true;
      });

      var base    = putAbertura || callStrike || 1;
      var rec     = base > 0 ? Math.min((total / base) * 100, 100) : 0;
      var desconto= base > 0 ? (total / base) * 100 : 0;
      var cm      = putAbertura > 0 ? putAbertura - total : null;
      var hasOpen = cy.ops.some(function (o) { return (o.status || '').toUpperCase() === 'ABERTA'; });
      var dp      = getDateParts(key);

      return {
        id       : cy.id,
        dateKey  : key,
        date     : dp.date,
        dow      : dp.dow,
        ops      : cy.ops,
        total    : total,
        exercidas: exercidas,
        putStrike: putStrike,
        callStrike: callStrike,
        premCiclo: total,
        cm       : cm,
        desconto : desconto,
        rec      : rec,
        venc     : venc ? getDateParts(venc).date : null,
        assets   : Object.keys(assetSet),
        status   : hasOpen ? 'aberto' : 'fechado',
        dot      : total > 0 ? 'green' : hasOpen ? 'open' : 'orange'
      };
    }).sort(function (a, b) { return b.dateKey.localeCompare(a.dateKey); });
  }

  /* ─ Op Row ─ */
  function opRow(op) {
    var asset = (op.ativo || '?').toUpperCase();
    var tipo  = (op.tipo  || 'CALL').toUpperCase();
    var strike = parseFloat(op.strike || 0);
    var status  = (op.status     || '').toUpperCase();
    var ts      = (op.tipo_status|| status).toUpperCase();
    var premio  = parseFloat(op.premio_us || 0);
    var resul   = parseFloat(op.resultado  || 0);
    var isEx    = ts === 'EXERCIDA';

    var stk = (asset === 'BTC' && strike >= 1000)
      ? '$' + (strike/1000).toFixed(1) + 'K'
      : '$' + strike.toLocaleString('pt-BR');

    var stCls = status === 'FECHADA' ? 'st-fe' : status === 'ABERTA' ? 'st-ab' : 'st-ex';
    var stTxt = status === 'FECHADA' ? 'Fechada' : status === 'ABERTA' ? 'Aberta' : 'Exercida';
    if (isEx) { stCls = 'st-ex'; stTxt = 'Exercida'; }

    var hasP = premio > 0;
    var bw   = Math.min(Math.abs(resul), 100);
    var bc   = isEx ? 'var(--org)' : hasP ? 'var(--grn)' : 'var(--cya)';

    var h = '<div class="op-row' + (isEx ? ' ex' : '') + '">';
    h += '<span class="or-a ' + acCls(asset) + '">' + asset + '</span>';
    h += '<span class="or-t ' + tipo.toLowerCase() + '">' + tipo + '</span>';
    if (isEx) h += '<span class="or-t exbdg">exercida</span>';
    h += '<span class="or-str">' + tipo + ' Strike ' + stk + '</span>';
    h += '<div class="or-bar"><div class="or-bf" style="width:' + bw + '%;background:' + bc + '"></div></div>';
    h += '<span class="or-st ' + stCls + '">' + stTxt + '</span>';
    h += '<span class="or-val" style="color:' + (hasP ? 'var(--grn)' : 'var(--tx2)') + '">' + (hasP ? '+' + fmt(premio) : '—') + '</span>';
    h += '<span class="or-pct">' + (resul ? resul.toFixed(3) + '%' : '') + '</span>';
    h += '</div>';
    return h;
  }

  /* ─ Ciclo Footer ─ */
  function cicloFooter(cy) {
    var capital = 0;
    try { var cfg = JSON.parse(localStorage.getItem('cryptoConfig') || '{}'); capital = parseFloat(cfg.saldoCrypto || 0); } catch (e) {}

    if (cy.status === 'aberto') {
      return '<div class="cfoot"><div class="cfoot-row"><span style="font-size:.64rem;color:var(--tx2)">&#9203; Aguardando vencimento ' + (cy.venc || '') + '</span></div></div>';
    }
    if (cy.total <= 0) return '';

    var pct  = capital > 0 ? (cy.total / capital * 100) : 0;
    var barW = Math.min(pct * 50, 100);

    var h = '<div class="cfoot"><div class="cfoot-row">';
    if (cy.putStrike)  h += '<span class="cfi">PUT strike: <span class="cfi-v cfi-a">$' + cy.putStrike.toLocaleString('pt-BR')  + '</span></span><span class="cf-sep">&middot;</span>';
    if (cy.callStrike) h += '<span class="cfi">CALL strike: <span class="cfi-v cfi-a">$' + cy.callStrike.toLocaleString('pt-BR') + '</span></span><span class="cf-sep">&middot;</span>';
    h += '<span class="cfi">Pr&ecirc;mios: <span class="cfi-v cfi-g">+' + fmt(cy.total) + '</span></span>';
    if (cy.cm && cy.cm > 0) {
      h += '<span class="cf-sep">&middot;</span><span class="cfi">Custo m&eacute;dio: <span class="cfi-v">' + fmtK(cy.cm) + '</span></span>';
      h += '<span class="cf-sep">&middot;</span><span class="cfi">Desconto: <span class="cfi-v pos">' + cy.desconto.toFixed(2) + '%</span></span>';
    }
    h += '</div>';
    h += '<div class="cfoot-contrib"><div class="cfc-row">';
    h += '<span class="cfc-lbl">Contribui&ccedil;&atilde;o ao capital</span>';
    h += '<span class="cfc-val pos">+' + fmt(cy.total) + (capital > 0 ? ' &middot; ' + pct.toFixed(3) + '%' : '') + '</span>';
    h += '</div><div class="cfc-bar"><div class="cfc-fill" style="width:' + barW + '%"></div></div></div></div>';
    return h;
  }

  /* ─ Ciclo Block ─ */
  function cicloBlock(cy, isOpen) {
    var dotCol = cy.dot === 'green' ? 'var(--grn)' : cy.dot === 'open' ? 'var(--cya)' : 'var(--org)';
    var glow   = cy.dot === 'green' ? ';box-shadow:0 0 5px var(--grn)' : '';
    var totalH = cy.total > 0
      ? '<span class="pos">+' + fmt(cy.total) + '</span>'
      : '<span style="color:var(--tx2)">+US$ &mdash;</span>';

    var assetsStr = cy.assets.join(' + ');
    var metaStr   = (cy.status === 'aberto' && cy.venc) ? assetsStr + ' &middot; Venc. ' + cy.venc : assetsStr;

    var h = '<div class="ciclo">';
    h += '<div class="ciclo-head' + (isOpen ? ' open' : '') + '" data-cycle-id="' + cy.id + '">';
    h += '<span class="ch-dot" style="background:' + dotCol + glow + '"></span>';
    h += '<span class="ch-date">Ciclo ' + cy.date + '</span>';
    h += '<span class="ch-dow">' + cy.dow + '</span>';
    h += '<div style="display:flex;gap:4px;margin-left:4px">';
    if (cy.exercidas > 0) h += '<span class="badge bex">' + cy.exercidas + ' exerc.</span>';
    if (cy.status === 'aberto') h += '<span class="badge bab">' + cy.ops.length + ' abertas</span>';
    else                        h += '<span class="badge bops">' + cy.ops.length + ' ops</span>';
    h += '</div>';
    if (metaStr) h += '<span class="ch-meta" style="margin-left:4px">' + metaStr + '</span>';
    h += '<div class="ch-right">';
    if (cy.total > 0) {
      h += '<div class="ch-rec">';
      h += '<span class="ch-rec-pct">Recupera&ccedil;&atilde;o ' + cy.rec.toFixed(0) + '%</span>';
      h += '<div class="ch-rec-bar"><div class="ch-rec-fill" style="width:' + cy.rec + '%"></div></div>';
      h += '<span style="font-size:.58rem;color:var(--tx2)">pr&ecirc;mios do ciclo</span>';
      h += '</div>';
    } else if (cy.status === 'aberto') {
      h += '<span style="font-size:.64rem;color:var(--tx2)">aguardando vencimento</span>';
    }
    h += '<span class="ch-total">' + totalH + '</span>';
    h += '<span class="ch-arr">&#9660;</span>';
    h += '</div></div>';

    h += '<div class="ciclo-body' + (isOpen ? ' open' : '') + '">';
    cy.ops.forEach(function (op) { h += opRow(op); });
    h += cicloFooter(cy);
    h += '</div></div>';
    return h;
  }

  /* ─ Performance geral ─ */
  function calcPerf(ops) {
    var total = 0, btcP = 0, ethP = 0, exercidas = 0, profitable = 0;
    var capital = 0;
    try { var cfg = JSON.parse(localStorage.getItem('cryptoConfig') || '{}'); capital = parseFloat(cfg.saldoCrypto || 0); } catch (e) {}
    ops.forEach(function (op) {
      var prem = parseFloat(op.premio_us || 0);
      total   += prem;
      if (prem > 0) profitable++;
      if ((op.exercicio_status || '').toUpperCase() === 'SIM') exercidas++;
      var ativo = (op.ativo || '').toUpperCase();
      if (ativo === 'BTC') btcP += prem; else if (ativo === 'ETH') ethP += prem;
    });
    var n   = ops.length;
    var roi = capital > 0 ? (total / capital * 100) : 0;
    var wr  = n > 0 ? (profitable / n * 100) : 0;
    return { total: total, btcP: btcP, ethP: ethP, ops: n, exercidas: exercidas, wr: wr, roi: roi, capital: capital };
  }

  /* ─ Análise por ativo ─ */
  function computeAnalise(ops) {
    var res = {};
    ['BTC','ETH'].forEach(function (asset) {
      var aOps = ops.filter(function (o) { return (o.ativo||'').toUpperCase() === asset; });
      if (!aOps.length) return;
      var putOps  = aOps.filter(function (o) { return (o.tipo||'').toUpperCase() === 'PUT';  });
      var callOps = aOps.filter(function (o) { return (o.tipo||'').toUpperCase() === 'CALL'; });
      var prem = 0;
      aOps.forEach(function (o) { prem += parseFloat(o.premio_us||0); });
      var putC  = putOps.length  ? parseFloat(putOps [putOps.length -1].strike||0) : 0;
      var callV = callOps.length ? parseFloat(callOps[callOps.length-1].strike||0) : 0;
      var cot = 0;
      for (var i = aOps.length-1; i >= 0; i--) {
        if (aOps[i].cotacao_atual) { cot = parseFloat(aOps[i].cotacao_atual); break; }
      }
      var cm   = putC > 0 ? putC - prem : 0;
      var desc = putC > 0 ? (prem / putC) * 100 : 0;
      var openCall   = callOps.filter(function (o) { return (o.status||'').toUpperCase() === 'ABERTA'; });
      var strikeCall = openCall.length ? parseFloat(openCall[0].strike||0) : (cot > 0 ? cot * 1.05 : 0);
      var lucroEx    = cm > 0 && strikeCall > 0 ? strikeCall - cm : 0;
      var lucroExPct = cm > 0 ? lucroEx / cm * 100 : 0;
      var dist       = strikeCall > 0 && cot > 0 ? (cot - strikeCall) / strikeCall * 100 : 0;
      res[asset] = {
        putC: putC, callV: callV, prem: prem, cm: cm, desc: desc,
        cot: cot, strikeCall: strikeCall, lucroEx: lucroEx,
        lucroExPct: lucroExPct, dist: dist,
        status: cm > 0 && cot > cm ? 'LUCRATIVO' : 'EM RISCO'
      };
    });
    return res;
  }

  /* ─ Acumulação para chart ─ */
  function computeAcc() {
    var sorted = groupByCycle(currentOperacoes).slice().reverse();
    var acc = 0, data = [0], labels = ['In&iacute;cio'];
    sorted.forEach(function (cy) {
      if (cy.total > 0) { acc += cy.total; data.push(parseFloat(acc.toFixed(2))); labels.push(cy.date); }
    });
    return { data: data, labels: labels };
  }

  /* ─ Painel Direito ─ */
  function renderRightPanel() {
    var ops     = getFilteredOps();
    var perf    = calcPerf(ops);
    var analise = computeAnalise(ops);

    var h = '<div class="rp">';

    /* Resumo */
    h += '<div class="rp-card">';
    h += '<div class="rp-head open" id="rph-res" data-rp-id="rpb-res"><span class="rp-head-title">&#128202; Resumo do Per&iacute;odo</span><span class="rp-arr">&#9660;</span></div>';
    h += '<div class="rp-body" id="rpb-res">';
    h += '<div class="kpi-grid">';
    h += '<div class="kpi-i"><div class="kpi-v pos">+' + fmt(perf.total)            + '</div><div class="kpi-l">Total Pr&ecirc;mios</div></div>';
    h += '<div class="kpi-i"><div class="kpi-v pos">' + fmtP(perf.roi)             + '</div><div class="kpi-l">ROI s/ Capital</div></div>';
    h += '<div class="kpi-i"><div class="kpi-v" style="color:var(--org)">' + perf.exercidas + '</div><div class="kpi-l">Exercidas</div></div>';
    h += '<div class="kpi-i"><div class="kpi-v pos">'  + perf.wr.toFixed(0) + '%' + '</div><div class="kpi-l">Win Rate</div></div>';
    h += '</div>';
    var btcPct = perf.total > 0 ? (perf.btcP / perf.total * 100) : 0;
    var ethPct = perf.total > 0 ? (perf.ethP / perf.total * 100) : 0;
    h += '<div class="prog-section"><div class="prog-title">Distribui&ccedil;&atilde;o por ativo</div>';
    h += '<div class="prog-item"><div class="prog-hd"><span class="prog-lbl">&#8383; BTC &middot; ' + fmt(perf.btcP) + '</span><span class="prog-val" style="color:var(--btc)">' + btcPct.toFixed(0) + '%</span></div><div class="prog-track"><div class="prog-fill" style="width:' + btcPct + '%;background:var(--btc)"></div></div></div>';
    h += '<div class="prog-item"><div class="prog-hd"><span class="prog-lbl">&#926; ETH &middot; ' + fmt(perf.ethP) + '</span><span class="prog-val" style="color:var(--eth)">' + ethPct.toFixed(0) + '%</span></div><div class="prog-track"><div class="prog-fill" style="width:' + ethPct + '%;background:var(--eth)"></div></div></div>';
    h += '</div>';
    h += '</div></div>'; /* end rp-body + rp-card */

    /* Análise BTC + ETH */
    ['BTC','ETH'].forEach(function (asset) {
      var a = analise[asset];
      if (!a) return;
      var ac    = acCol(asset);
      var secId = 'rpb-' + asset;
      h += '<div class="rp-card">';
      h += '<div class="rp-head" id="rph-' + asset + '" data-rp-id="' + secId + '">';
      h += '<span class="rp-head-title" style="color:' + ac + '">' + acI(asset) + ' An&aacute;lise Ciclo ' + asset + '</span>';
      h += '<div style="display:flex;align-items:center;gap:5px"><span class="rp-badge rb-luc">' + a.status + '</span><span class="rp-arr" style="margin:0">&#9660;</span></div>';
      h += '</div>';
      h += '<div class="rp-body hide" id="' + secId + '">';
      h += '<div class="rp-row"><span class="rp-row-k"><span class="dot" style="background:var(--pur)"></span>PUT compra</span><span class="rp-row-v">'  + (a.putC  > 0 ? fmtK(a.putC)  : '&mdash;') + '</span></div>';
      h += '<div class="rp-row"><span class="rp-row-k"><span class="dot" style="background:var(--org)"></span>CALL venda</span><span class="rp-row-v">'  + (a.callV > 0 ? fmtK(a.callV) : '&mdash;') + '</span></div>';
      h += '<div class="rp-row"><span class="rp-row-k"><span class="dot" style="background:var(--tx3)"></span>Var. do ativo</span><span class="rp-row-v">$' + (a.cot > 0 ? a.cot.toLocaleString('pt-BR') : '0') + '</span></div>';
      h += '<div class="rp-row"><span class="rp-row-k"><span class="dot" style="background:var(--grn)"></span>Pr&ecirc;mios ciclo</span><span class="rp-row-v pos">+' + fmt(a.prem) + '</span></div>';
      if (a.putC > 0 && a.cm > 0) {
        h += '<div class="cm-box"><div class="cm-box-title">&#129518; Custo M&eacute;dio Real &mdash; como funciona</div>';
        h += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px"><span style="font-size:.68rem;color:var(--tx2)">PUT exercida (comprou ' + asset + ')</span><span style="font-family:var(--mono);font-size:.72rem;color:var(--pur)">' + fmtK(a.putC) + '</span></div>';
        h += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px"><span style="font-size:.68rem;color:var(--tx2)">&minus; Pr&ecirc;mios coletados total</span><span style="font-family:var(--mono);font-size:.72rem;color:var(--grn)">&minus;' + fmt(a.prem) + '</span></div>';
        h += '<div style="height:1px;background:var(--bdr2);margin-bottom:5px"></div>';
        h += '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:.7rem;font-weight:600;color:var(--tx1)">= Custo M&eacute;dio Real</span><span class="cm-val" style="color:' + ac + '">' + fmtK(a.cm) + '</span></div>';
        h += '<div class="cm-sub pos">Desconto de ' + Math.abs(a.desc).toFixed(2) + '% obtido via pr&ecirc;mios &#127919;</div>';
        h += '<div class="prog-track" style="margin-top:6px;height:4px"><div class="prog-fill" style="width:' + Math.min(a.desc*20,100) + '%;background:var(--grn)"></div></div>';
        h += '</div>';
      }
      if (a.strikeCall > 0) {
        h += '<div class="rp-row" style="border-top:1px solid var(--bdr);margin-top:2px;padding-top:8px"><span class="rp-row-k">Strike CALL pr&oacute;xima</span><span class="rp-row-v neu">' + fmtK(a.strikeCall) + '</span></div>';
      }
      if (a.lucroEx > 0) {
        h += '<div class="rp-row hl"><span class="rp-row-k">&#128176; Lucro se exercida</span><span class="rp-row-v pos">+' + fmt(a.lucroEx) + ' (' + fmtP(a.lucroExPct) + ')</span></div>';
      }
      if (a.cot > 0 && a.strikeCall > 0) {
        var cur = Math.max(5, Math.min(93, 50 + a.dist * 2.5));
        var dc  = a.dist >= 0 ? 'var(--grn)' : 'var(--red)';
        h += '<div style="margin:4px 0"><div style="display:flex;justify-content:space-between;font-size:.62rem;color:var(--tx2);margin-bottom:3px"><span>Cota&ccedil;&atilde;o vs strike sugerido</span><span style="color:' + dc + '">' + fmtP(a.dist) + '</span></div>';
        h += '<div class="heat-bar"><div class="heat-bg"></div><div class="heat-cursor" style="left:' + cur + '%;background:' + dc + '"></div></div>';
        h += '<div style="display:flex;justify-content:space-between;font-size:.58rem;color:var(--tx3);margin-top:3px"><span>Exerc&iacute;cio prov&aacute;vel</span><span style="color:var(--tx2)">Cota&ccedil;&atilde;o: ' + fmtK(a.cot) + '</span><span>Seguro</span></div></div>';
      }
      h += '</div></div>';
    });

    /* Strikes Sugeridos */
    h += '<div class="rp-card"><div class="rp-head" id="rph-str" data-rp-id="rpb-str"><span class="rp-head-title">&#128161; Strikes Sugeridos</span><span class="rp-arr">&#9660;</span></div>';
    h += '<div class="rp-body hide" id="rpb-str" style="padding:11px 13px">';
    ['BTC','ETH'].forEach(function (asset) {
      var a = analise[asset];
      if (!a || a.strikeCall <= 0) return;
      h += '<div class="strike-item">';
      h += '<span class="sa" style="color:' + acCol(asset) + '">' + acI(asset) + ' ' + asset + '</span>';
      h += '<span style="font-size:.58rem;font-weight:700;padding:2px 6px;border-radius:3px;background:var(--blu-bg);color:var(--blu);border:1px solid var(--blu-bdr)">CALL</span>';
      h += '<div class="si"><div class="si-v" style="color:var(--amb)">' + fmtK(a.strikeCall) + '</div><div class="si-l">+5% acima cota&ccedil;&atilde;o &middot; cot: ' + fmtK(a.cot) + '</div></div>';
      h += '<div class="sl">' + (a.lucroEx > 0 ? '<div class="sl-v">+' + fmt(a.lucroEx) + '</div><div class="sl-l">se exercida</div>' : '') + '</div>';
      h += '</div>';
    });
    h += '</div></div>';

    /* Botão análise IA */
    h += '<div class="rp-card"><div style="padding:12px 13px"><button id="btnAnaliseIACrypto" class="btn btn-sm btn-primary w-100" style="margin-bottom:8px">An&aacute;lise com IA</button><small style="color:var(--tx2)">Enviar contexto da opera&ccedil;&atilde;o para an&aacute;lise com IA</small></div></div>';

    h += '</div>';
    return h;
  }

  /* ─ Build Chart ─ */
  function buildAccChart() {
    var el = document.getElementById('rtAccChart');
    if (!el) return;
    if (accChart) { try { accChart.destroy(); } catch (e) {} accChart = null; }
    var acc = window._rtAccData;
    if (!acc || !acc.data || acc.data.length < 2) return;
    var C = window.Chart;
    if (!C) return;
    accChart = new C(el, {
      type: 'line',
      data: { labels: acc.labels, datasets: [{ data: acc.data, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.08)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#22c55e', fill: true, tension: 0.4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return 'US$ ' + c.raw.toFixed(2); } } } }, scales: { x: { display: false }, y: { display: false } } }
    });
  }

  /* ─ Filtros ─ */
  function getFilteredOps() {
    var ops = currentOperacoes.slice();
    if (filterState.period && filterState.period !== 'all') {
      var now = new Date(), cutoff = new Date();
      if      (filterState.period === 'hoje')  cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (filterState.period === '7d')   cutoff.setDate(now.getDate() - 7);
      else if (filterState.period === '30d')  cutoff.setDate(now.getDate() - 30);
      else if (filterState.period === '60d')  cutoff.setDate(now.getDate() - 60);
      else if (filterState.period === '90d')  cutoff.setDate(now.getDate() - 90);
      else if (filterState.period === 'year') cutoff = new Date(now.getFullYear(), 0, 1);
      ops = ops.filter(function (o) { return new Date((o.data_operacao || o.data_abertura || '2000-01-01') + 'T00:00:00') >= cutoff; });
    }
    if (filterState.asset && filterState.asset !== 'all') {
      ops = ops.filter(function (o) { return (o.ativo||'').toUpperCase() === filterState.asset.toUpperCase(); });
    }
    if (filterState.tipo && filterState.tipo !== 'all') {
      ops = ops.filter(function (o) { return (o.tipo||'').toUpperCase() === filterState.tipo.toUpperCase(); });
    }
    if (filterState.status && filterState.status !== 'all') {
      var st = filterState.status.toUpperCase();
      ops = ops.filter(function (o) {
        var s  = (o.status          || '').toUpperCase();
        var ex = (o.exercicio_status|| '').toUpperCase();
        if (st === 'EXERCIDA')     return s === 'FECHADA' && ex === 'SIM';
        if (st === 'NAO_EXERCIDA') return s === 'FECHADA' && ex !== 'SIM';
        if (st === 'FECHADA')      return s === 'FECHADA';
        return s === st;
      });
    }
    return ops;
  }

  /* ─ Render ciclos ─ */
  function renderCycles() {
    var ops = getFilteredOps();
    filteredCycles = groupByCycle(ops);
    var html = filteredCycles.length
      ? filteredCycles.map(function (cy, i) { return cicloBlock(cy, i === 0); }).join('')
      : '<div style="padding:20px;color:var(--tx2);text-align:center">Nenhuma opera&ccedil;&atilde;o encontrada</div>';
    var cont = document.getElementById('rtCyclesContainer');
    if (cont) cont.innerHTML = html;
    attachCycleListeners();
  }

  /* ─ Render modal ─ */
  function renderModal() {
    currentOperacoes = window.cryptoOperacoes || [];
    if (!Array.isArray(currentOperacoes)) currentOperacoes = [];
    updateLastUpdateTime();
    renderCycles();
    var sp = document.getElementById('rtSummaryPanel');
    if (sp) { sp.innerHTML = renderRightPanel(); }
    attachEventListeners();
  }

  /* ─ Atualizar (fetch) ─ */
  function updateLastUpdateTime() {
    var el = document.getElementById('rtLastUpdate');
    if (!el) return;
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    el.textContent = 'Atualizado: ' + hh + ':' + mm;
    el.style.display = '';
  }

  function handleAtualizar() {
    var btn = document.getElementById('rtCryptoRefreshBtn');
    if (btn) btn.classList.add('loading');
    /* Mostrar estado de carregamento nos valores */
    var loadingHtml = '<span class="kpi-loading">&#8226;&#8226;&#8226;</span>';
    document.querySelectorAll('#modalResultadoTotalCrypto .kpi-v').forEach(function (el) { el.innerHTML = loadingHtml; });
    document.querySelectorAll('#modalResultadoTotalCrypto .rp-row-v').forEach(function (el) { el.innerHTML = loadingHtml; });
    fetch('/api/crypto')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        window.cryptoOperacoes = Array.isArray(data) ? data : (Array.isArray(data.operacoes) ? data.operacoes : []);
        currentOperacoes = window.cryptoOperacoes;
        renderModal();
        updateLastUpdateTime();
      })
      .catch(function (e) { console.error('[CryptoModal] Erro ao atualizar:', e); })
      .finally(function () { if (btn) btn.classList.remove('loading'); });
  }

  /* ─ Event Listeners ─ */
  function attachCycleListeners() {
    document.querySelectorAll('#modalResultadoTotalCrypto .ciclo-head[data-cycle-id]').forEach(function (h) {
      h.removeEventListener('click', toggleCycle);
      h.addEventListener('click', toggleCycle);
    });
  }

  function attachEventListeners() {
    attachCycleListeners();
    document.querySelectorAll('#modalResultadoTotalCrypto .rp-head[data-rp-id]').forEach(function (h) {
      h.removeEventListener('click', toggleRpSection);
      h.addEventListener('click', toggleRpSection);
    });
    document.querySelectorAll('#modalResultadoTotalCrypto .chip[data-filter]').forEach(function (c) {
      c.removeEventListener('click', applyChipFilter);
      c.addEventListener('click', applyChipFilter);
    });
    var moedaSel = document.querySelector('#modalResultadoTotalCrypto .moeda-sel');
    if (moedaSel) { moedaSel.removeEventListener('change', applyMoedaFilter); moedaSel.addEventListener('change', applyMoedaFilter); }
    var refreshBtn = document.getElementById('rtCryptoRefreshBtn');
    if (refreshBtn) { refreshBtn.removeEventListener('click', handleAtualizar); refreshBtn.addEventListener('click', handleAtualizar); }
    var btnIA = document.getElementById('btnAnaliseIACrypto');
    if (btnIA) { btnIA.removeEventListener('click', handleAnaliseIA); btnIA.addEventListener('click', handleAnaliseIA); }
  }

  function toggleCycle() {
    var body = this.nextElementSibling;
    if (!body) return;
    this.classList.toggle('open');
    body.classList.toggle('open');
    body.style.display = body.classList.contains('open') ? 'block' : 'none';
  }

  function toggleRpSection() {
    var bodyId = this.getAttribute('data-rp-id');
    var body   = bodyId ? document.getElementById(bodyId) : this.nextElementSibling;
    if (!body) return;
    this.classList.toggle('open');
    body.classList.toggle('hide');
  }

  function applyChipFilter() {
    var filter = this.getAttribute('data-filter');
    var value  = this.getAttribute('data-value');
    document.querySelectorAll('#modalResultadoTotalCrypto .chip[data-filter="' + filter + '"]').forEach(function (c) {
      c.classList.remove('on', 'btc', 'eth', 'todos');
    });
    this.classList.add('on');
    if (filter === 'asset') {
      if (value === 'BTC') this.classList.add('btc');
      else if (value === 'ETH') this.classList.add('eth');
      else this.classList.add('todos');
    }
    filterState[filter] = value;
    renderCycles();
    var sp = document.getElementById('rtSummaryPanel');
    if (sp) { sp.innerHTML = renderRightPanel(); attachEventListeners(); }
  }

  function applyTipoFilter() {
    filterState.tipo = this.value || 'all';
    renderCycles();
    var sp = document.getElementById('rtSummaryPanel');
    if (sp) { sp.innerHTML = renderRightPanel(); attachEventListeners(); }
  }

  function applyMoedaFilter() {
    filterState.asset = this.value || 'all';
    renderCycles();
    var sp = document.getElementById('rtSummaryPanel');
    if (sp) { sp.innerHTML = renderRightPanel(); attachEventListeners(); }
  }

  function handleAnaliseIA() {
    if (!currentOperacoes || !currentOperacoes.length) {
      if (typeof iziToast !== 'undefined') iziToast.warning({ title: 'Aviso', message: 'Nenhuma operação para analisar.' });
      return;
    }

    /* Monta contexto a partir das operações atuais */
    var ops = currentOperacoes;
    var lines = ['Análise estratégica de carteira de opções crypto. Operações:\n'];
    ops.slice(0, 10).forEach(function(op) {
      var ativo  = (op.ativo  || 'CRYPTO').toUpperCase();
      var tipo   = (op.tipo   || 'CALL').toUpperCase();
      var status = (op.status || 'ABERTA').toUpperCase();
      var strike = parseFloat(op.strike       || 0);
      var cot    = parseFloat(op.cotacao_atual || 0);
      var dist   = strike && cot
        ? ((tipo === 'CALL' ? (strike - cot) / cot : (cot - strike) / strike) * 100).toFixed(2)
        : '?';
      var premio = parseFloat(op.premio_us || 0);
      var tae    = parseFloat(op.tae       || 0);
      lines.push('- ' + ativo + '/USDT ' + tipo +
        ' | Strike US$' + strike.toFixed(2) +
        ' | Cotação US$' + cot.toFixed(2) +
        ' | Dist. ' + dist + '%' +
        ' | Prêmio US$' + premio.toFixed(2) +
        ' | TAE ' + tae.toFixed(2) + '% a.a.' +
        ' | Vencimento ' + (op.exercicio || '?') +
        ' | ' + status);
    });
    lines.push('\nFaça uma análise estratégica completa: situação de cada posição, riscos de exercício, recomendações e próximos passos.');
    var context = lines.join('\n');

    var chatHistory = [{ role: 'user', content: context }];

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Analisando Carteira Crypto...',
        html: 'Consultando agente de IA especializado em opções crypto...',
        allowOutsideClick: false,
        didOpen: function() { Swal.showLoading(); }
      });
    }

    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var analysis  = data.analysis || data.response || data.message || 'Análise não disponível.';
      var agentName = data.agent_name || data.agentName || 'IA Especialista Crypto';
      var modelName = data.model_name || data.modelName || '';
      chatHistory.push({ role: 'assistant', content: analysis });
      showCryptoAiResult(analysis, agentName, modelName, chatHistory);
    })
    .catch(function(err) {
      if (typeof Swal !== 'undefined') Swal.close();
      if (typeof iziToast !== 'undefined') {
        iziToast.error({ title: 'Erro', message: 'Falha ao obter análise da IA: ' + (err.message || 'Erro desconhecido') });
      }
    });
  }

  function showCryptoAiResult(markdownContent, agentName, modelName, chatHistory) {
    if (!chatHistory) chatHistory = [];
    var useMarked   = typeof marked !== 'undefined' && typeof marked.parse === 'function';
    var headerLabel = agentName
      ? agentName + (modelName ? ' <span style="opacity:.6;font-size:.8em">(' + modelName + ')</span>' : '')
      : 'Análise IA Crypto';
    var contentHtml = useMarked ? marked.parse(markdownContent) : markdownContent.replace(/\n/g, '<br>');

    Swal.fire({
      title: '',
      html: '<div style="display:flex;flex-direction:column;height:70vh;gap:0">' +
              '<div style="font-size:.7rem;color:#7890b0;font-weight:700;letter-spacing:.05em;margin-bottom:6px;text-align:left">' + headerLabel + '</div>' +
              '<div id="ai-chat-container" style="flex:1;overflow-y:auto;text-align:left;line-height:1.6;font-size:.87rem;padding-right:4px;margin-bottom:8px">' +
                '<div id="ai-chat-messages">' +
                  '<div class="ai-msg ai-msg-assistant">' + contentHtml + '</div>' +
                '</div>' +
              '</div>' +
              '<div style="display:flex;gap:8px;border-top:1px solid rgba(255,255,255,.1);padding-top:8px">' +
                '<textarea id="ai-chat-input" rows="2" placeholder="Ex: E se o mercado cair 10%? Qual a melhor estratégia agora?" ' +
                  'style="flex:1;resize:none;background:#1a2035;border:1px solid rgba(255,255,255,.15);border-radius:8px;' +
                  'color:#e8eaf0;font-size:.82rem;padding:8px;outline:none"></textarea>' +
                '<button id="ai-chat-send" style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;' +
                  'border-radius:8px;padding:8px 14px;cursor:pointer;font-size:1rem;align-self:flex-end;min-width:44px" title="Enviar">' +
                  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
                '</button>' +
              '</div>' +
            '</div>',
      width: '760px',
      padding: '1.5rem',
      background: '#131929',
      color: '#e8eaf0',
      showConfirmButton: true,
      showDenyButton: true,
      confirmButtonText: 'Entendido',
      denyButtonText: 'Atualizar Análise',
      confirmButtonColor: '#22c55e',
      denyButtonColor: '#3b82f6',
      didOpen: function() {
        /* Desativa focus trap do Bootstrap para o campo de texto funcionar */
        var activeModal = document.querySelector('.modal.show');
        if (activeModal) {
          try {
            var bsModal = bootstrap.Modal.getInstance(activeModal);
            if (bsModal && bsModal._focustrap) bsModal._focustrap.deactivate();
          } catch(e) {}
        }

        var container = document.getElementById('ai-chat-container');
        var input     = document.getElementById('ai-chat-input');
        var sendBtn   = document.getElementById('ai-chat-send');

        if (container) container.scrollTop = container.scrollHeight;
        setTimeout(function() { if (input) input.focus(); }, 100);

        function sendMsg() {
          var text = input ? input.value.trim() : '';
          if (!text) return;
          input.value = '';
          chatHistory.push({ role: 'user', content: text });

          var msgs = document.getElementById('ai-chat-messages');
          if (msgs) {
            msgs.innerHTML += '<div class="ai-msg ai-msg-user" style="background:rgba(59,130,246,.1);border-left:3px solid #3b82f6;padding:8px 12px;border-radius:6px;margin:8px 0;font-size:.83rem">' + text.replace(/</g, '&lt;') + '</div>';
            msgs.innerHTML += '<div class="ai-msg ai-msg-thinking" id="ai-typing" style="color:#7890b0;font-style:italic;font-size:.8rem;padding:6px 0">Aguardando resposta da IA...</div>';
            container.scrollTop = container.scrollHeight;
          }
          if (sendBtn) sendBtn.disabled = true;

          fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            var reply = data.analysis || data.response || data.message || '';
            chatHistory.push({ role: 'assistant', content: reply });
            var typing = document.getElementById('ai-typing');
            if (typing) typing.remove();
            if (msgs) {
              var replyHtml = useMarked ? marked.parse(reply) : reply.replace(/\n/g, '<br>');
              msgs.innerHTML += '<div class="ai-msg ai-msg-assistant" style="margin:8px 0">' + replyHtml + '</div>';
              container.scrollTop = container.scrollHeight;
            }
          })
          .catch(function() {
            var typing = document.getElementById('ai-typing');
            if (typing) typing.textContent = 'Falha ao obter resposta.';
          })
          .finally(function() { if (sendBtn) sendBtn.disabled = false; });
        }

        if (sendBtn) sendBtn.addEventListener('click', sendMsg);
        if (input) {
          input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
          });
        }
      },
      preDeny: function() {
        Swal.close();
        setTimeout(handleAnaliseIA, 100);
        return false;
      }
    });
  }

  window.ModalResultadoTotalCryptoRenderer = { render: renderModal, refresh: renderModal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { if (document.getElementById('modalResultadoTotalCrypto')) renderModal(); });
  } else {
    if (document.getElementById('modalResultadoTotalCrypto')) renderModal();
  }

})();

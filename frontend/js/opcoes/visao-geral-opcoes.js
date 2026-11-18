// visao-geral-opcoes.js v1.0.0
// Aba "Visão Geral" da página de OPÇÕES — paridade visual com a Visão Geral de Crypto.
// Blocos: Evolução de Prêmios Acumulados + Posições Abertas Agora (termômetro) +
//         Fluxo do Ciclo (PUT -> CALL) + Projeção + Resumo Rápido.
// Domínio: opções de ações/ETFs em BRL. Sem APIs externas / websocket / TradingView.
//
// Fonte de dados: GET /api/opcoes
//   window.opcoesOperacoes | window.allOperacoes | evento document 'opcoesDataUpdated'
//   Fallback: fetch GET /api/opcoes

(function () {
  'use strict';

  var VG = {};
  var _activeOps = [];

  /* ───────────────────────── Helpers ───────────────────────── */

  function num(v) {
    if (typeof window.parseFloatSafe === 'function') {
      var r = window.parseFloatSafe(v);
      return (isFinite(r) ? r : 0);
    }
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function brl(v) {
    if (typeof window.formatCurrency === 'function') return window.formatCurrency(num(v), 'BRL');
    return 'R$ ' + num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function brlShort(v) {
    var n = num(v);
    if (Math.abs(n) >= 1000) return 'R$ ' + (n / 1000).toFixed(2) + 'k';
    return 'R$ ' + n.toFixed(2);
  }

  function fmtShort(n) {
    var abs = Math.abs(n);
    if (abs >= 1000) return (n / 1000).toFixed(2) + 'k';
    return n.toFixed(2);
  }

  function statusOf(op) { return String((op && op.status) || '').toUpperCase(); }
  function tipoOf(op) { return String((op && op.tipo) || 'CALL').toUpperCase(); }
  function tipoOperacaoOf(op) { return String((op && op.tipo_operacao) || 'VENDA').toUpperCase(); }
  function assetOf(op) { return String((op && (op.ativo_base || op.ativo)) || '?').toUpperCase(); }

  // Prêmio total recebido/pago = prêmio unitário × quantidade
  function premioTotal(op) {
    var p = Math.abs(num(op && op.premio));
    var q = Math.abs(parseInt((op && op.quantidade) || 0, 10)) || 0;
    return p * q;
  }

  function dataOf(op) {
    return String((op && (op.data_operacao || op.created_at)) || '');
  }

  function saldoCorretora() {
    try {
      var cfg = JSON.parse(localStorage.getItem('appConfig') || '{}');
      return num(cfg.saldoAcoes);
    } catch (e) { return 0; }
  }

  function getOps() {
    if (Array.isArray(window.opcoesOperacoes)) return window.opcoesOperacoes;
    if (Array.isArray(window.allOperacoes)) return window.allOperacoes;
    return [];
  }

  /* Preço médio por ativo — usa módulo oficial quando disponível, senão fallback. */
  function computePM(ops, ativoBase) {
    var key = String(ativoBase || '').toUpperCase();
    try {
      var mod = window.ModalPrecoMedioAtivoOpcoes;
      if (mod && typeof mod.computeData === 'function') {
        var d = mod.computeData(key);
        if (d) {
          var v = (typeof d === 'number')
            ? d
            : num(d.pm || d.precoMedio || d.preco_medio || d.medio || d.preco || d.preco_medio_ativo);
          if (v > 0) return v;
        }
      }
    } catch (e) { /* módulo ausente/erro → fallback */ }

    // Fallback: média ponderada de preco_entrada das posições ABERTA do ativo base
    var abertas = (ops || []).filter(function (o) {
      return assetOf(o) === key && statusOf(o) === 'ABERTA';
    });
    var totQ = 0, tot = 0;
    abertas.forEach(function (o) {
      var q = Math.abs(parseInt(o.quantidade || 0, 10)) || 0;
      var p = num(o.preco_entrada);
      if (q > 0 && p > 0) { totQ += q; tot += p * q; }
    });
    if (totQ > 0) return tot / totQ;

    // Último recurso: média simples de preco_entrada de todas as ops do ativo base
    var todas = (ops || []).filter(function (o) { return assetOf(o) === key && num(o.preco_entrada) > 0; });
    if (todas.length) {
      return todas.reduce(function (s, o) { return s + num(o.preco_entrada); }, 0) / todas.length;
    }
    return 0;
  }

  /* Status ITM/OTM (vencedor/vendedor).
     VENDA: CALL ITM se cot >= strike; PUT ITM se cot <= strike.
     COMPRA: relação invertida. */
  function thermoStatus(strike, cot, tipo, tipoOperacao) {
    var diff = cot - strike;
    var isCall = tipoOf({ tipo: tipo }) === 'CALL';
    var isVenda = tipoOperacaoOf({ tipo_operacao: tipoOperacao }) !== 'COMPRA';
    var itm;
    if (isVenda) itm = isCall ? (diff >= 0) : (diff <= 0);
    else itm = isCall ? (diff <= 0) : (diff >= 0);
    return { danger: itm };
  }

  /* PoP — usa o cálculo Black-Scholes global quando disponível; senão heurística. */
  function computePoP(op, cot) {
    try {
      if (typeof window.calcularPoP === 'function') {
        var p = window.calcularPoP(op, cot);
        if (p !== null && p !== undefined && isFinite(p)) return Math.max(0, Math.min(100, p));
      }
    } catch (e) { /* noop */ }

    var s = num(op && op.strike);
    if (!s || !cot) return null;
    var isCall = tipoOf(op) === 'CALL';
    var diff = cot - s;
    var distPct = Math.abs(diff) / s * 100;
    var isITM = isCall ? (diff > 0) : (diff < 0);
    var popEst = isITM ? Math.max(5, 50 - distPct * 4) : Math.min(95, 50 + distPct * 4);
    return popEst;
  }

  /* ───────────────────────── Estatísticas ───────────────────────── */

  function computeStats(ops) {
    var yearKey = String(new Date().getFullYear());
    var total = 0, n = 0, abertas = 0, exercidas = 0, fechadas = 0, profitable = 0;
    var mesVals = {}, mesCall = {}, mesPut = {};
    var meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    var MLBL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    (ops || []).forEach(function (op) {
      var d = dataOf(op);
      if (!d || d.substring(0, 4) !== yearKey) return;
      n++;
      var prem = premioTotal(op);
      total += prem;
      var st = statusOf(op);
      if (st === 'ABERTA') abertas++;
      if (st === 'EXERCIDA') exercidas++;
      if (st === 'FECHADA' || st === 'EXERCIDA' || st === 'ENCERRADA' || st === 'VENCIDA') {
        fechadas++;
        if (num(op.resultado) >= 0) profitable++;
      }
      var parts = d.split('-');
      if (parts.length >= 2) {
        var mk = MLBL[parseInt(parts[1], 10) - 1];
        if (mk) {
          mesVals[mk] = (mesVals[mk] || 0) + prem;
          if (tipoOf(op) === 'CALL') mesCall[mk] = (mesCall[mk] || 0) + prem;
          else mesPut[mk] = (mesPut[mk] || 0) + prem;
        }
      }
    });

    var capital = saldoCorretora();
    var wr = fechadas > 0 ? (profitable / fechadas * 100) : 0;
    var roi = capital > 0 ? (total / capital * 100) : 0;
    var semEx = n > 0 ? ((n - exercidas) / n * 100) : 0;

    var mLabels = [], mCallVals = [], mPutVals = [], mAccVals = [], mVals = [];
    var running = 0, mesesPos = 0, mesesComOp = 0;
    meses.forEach(function (m, i) {
      var v = mesVals[MLBL[i]] || 0;
      running += v;
      mLabels.push(MLBL[i]);
      mVals.push(parseFloat(v.toFixed(2)));
      mCallVals.push(parseFloat((mesCall[MLBL[i]] || 0).toFixed(2)));
      mPutVals.push(parseFloat((mesPut[MLBL[i]] || 0).toFixed(2)));
      mAccVals.push(parseFloat(running.toFixed(2)));
      if (v > 0) mesesPos++;
      if (v !== 0) mesesComOp++;
    });

    var consistencia = mesesComOp > 0 ? (mesesPos / mesesComOp * 100) : 0;

    return {
      total: total, n: n, abertas: abertas, exercidas: exercidas, fechadas: fechadas,
      profitable: profitable, capital: capital, wr: wr, roi: roi, semEx: semEx,
      consistencia: consistencia,
      mLabels: mLabels, mVals: mVals, mCallVals: mCallVals, mPutVals: mPutVals, mAccVals: mAccVals
    };
  }

  function computeAbertas(ops) {
    return (ops || []).filter(function (o) { return statusOf(o) === 'ABERTA'; });
  }

  /* Ciclos = agrupamento por data_operacao */
  function computeCiclos(ops) {
    var map = {};
    (ops || []).forEach(function (op) {
      var key = dataOf(op) || '2000-01-01';
      if (!map[key]) map[key] = { dateKey: key, ops: [] };
      map[key].ops.push(op);
    });
    return Object.keys(map).map(function (k) {
      var cy = map[k];
      var total = 0, assets = {}, hasOpen = false;
      cy.ops.forEach(function (op) {
        total += premioTotal(op);
        assets[assetOf(op)] = true;
        if (statusOf(op) === 'ABERTA') hasOpen = true;
      });
      var dp = k.substring(0, 10).split('-');
      var date = dp.length === 3 ? dp[2] + '/' + dp[1] : k;
      return {
        dateKey: k, date: date, ops: cy.ops, total: total,
        assets: Object.keys(assets).join('+'), hasOpen: hasOpen
      };
    }).sort(function (a, b) { return b.dateKey.localeCompare(a.dateKey); }).slice(0, 4);
  }

  /* Fluxo do ciclo (PUT -> CALL) do ativo selecionado */
  function computeCicloAtivo(ops, ativoBase) {
    var key = String(ativoBase || '').toUpperCase();
    var aOps = (ops || []).filter(function (o) { return assetOf(o) === key; });
    if (!aOps.length) return null;

    var puts = aOps.filter(function (o) { return tipoOf(o) === 'PUT'; })
      .sort(function (a, b) { return dataOf(a).localeCompare(dataOf(b)); });
    var calls = aOps.filter(function (o) { return tipoOf(o) === 'CALL'; })
      .sort(function (a, b) { return dataOf(b).localeCompare(dataOf(a)); });

    var putOp = puts[0];
    var putStrike = putOp ? num(putOp.strike) : 0;
    var exercida = putOp && statusOf(putOp) === 'EXERCIDA';
    var exercDate = '—';
    if (putOp) {
      var ref = putOp.vencimento || putOp.data_operacao || '';
      var p = String(ref).substring(0, 10).split('-');
      exercDate = p.length === 3 ? p[2] + '/' + p[1] : (String(ref) || '—');
    }
    var prems = calls.slice(0, 3);
    var totalPrem = 0;
    prems.forEach(function (o) { totalPrem += premioTotal(o); });
    var cm = putStrike > 0 && totalPrem > 0 ? putStrike - totalPrem : null;
    return { ativoBase: key, putStrike: putStrike, exercida: exercida, exercDate: exercDate, prems: prems, totalPrem: totalPrem, cm: cm };
  }

  /* Projeção por ativo (usa posições abertas) */
  function computeProjecao(ops) {
    var byAsset = {};
    (ops || []).forEach(function (o) { byAsset[assetOf(o)] = true; });
    var result = [];

    Object.keys(byAsset).forEach(function (asset) {
      if (asset === '?') return;
      var aOps = ops.filter(function (o) { return assetOf(o) === asset; });
      var openCalls = aOps.filter(function (o) { return tipoOf(o) === 'CALL' && statusOf(o) === 'ABERTA'; });
      var openOps = aOps.filter(function (o) { return statusOf(o) === 'ABERTA'; });
      if (!openOps.length) return;

      // Cotação: usa o preco_atual da última op com valor
      var cot = 0;
      for (var i = openOps.length - 1; i >= 0; i--) {
        if (num(openOps[i].preco_atual) > 0) { cot = num(openOps[i].preco_atual); break; }
      }
      for (var j = aOps.length - 1; j >= 0 && cot === 0; j--) {
        if (num(aOps[j].preco_atual) > 0) cot = num(aOps[j].preco_atual);
      }

      var strikeCall = openCalls.length ? num(openCalls[0].strike) : (cot > 0 ? cot * 1.05 : 0);
      // Prêmio estimado: só quando há CALL aberta com prêmio informado (opções não têm TAE)
      var premEst = openCalls.length ? premioTotal(openCalls[0]) : null;
      var dist = cot > 0 && strikeCall > 0 ? (strikeCall - cot) / cot * 100 : 0;

      // Custo médio: strike da última PUT − soma de prêmios
      var puts = aOps.filter(function (o) { return tipoOf(o) === 'PUT'; });
      var putStr = puts.length ? num(puts[puts.length - 1].strike) : 0;
      var allPrem = 0;
      aOps.forEach(function (o) { allPrem += premioTotal(o); });
      var cm = putStr > 0 && allPrem > 0 ? putStr - allPrem : computePM(ops, asset);
      var lucroEx = cm > 0 && strikeCall > 0 ? strikeCall - cm : null;

      result.push({ asset: asset, strikeCall: strikeCall, premEst: premEst, dist: dist, cot: cot, cm: cm, lucroEx: lucroEx });
    });

    return result.slice(0, 4);
  }

  /* ───────────────────────── Render HTML ───────────────────────── */

  function injectStyles() {
    if (document.getElementById('vgOpStyles')) return;
    var s = document.createElement('style');
    s.id = 'vgOpStyles';
    s.textContent = [
      '.vg-grid-top{display:grid;grid-template-columns:3fr 2fr;gap:14px;margin-bottom:14px}',
      '.vg-grid-bottom{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
      '.vg-card{background:#161c28;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px 18px}',
      '.vg-card-title{font-size:.62rem;font-weight:600;color:#7890b0;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;display:flex;align-items:center;gap:6px}',
      '.vg-chart-wrap{position:relative}',
      '.vg-legend{display:flex;gap:10px;margin-bottom:10px;font-size:.62rem;color:#7890b0}',
      '.vg-legend span{display:flex;align-items:center;gap:4px}',
      '.vg-op-row{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;background:#1c2438;border:1px solid rgba(255,255,255,.07);margin-bottom:6px}',
      '.vg-op-row.vg-op-active{background:rgba(59,130,246,.08);border-color:rgba(59,130,246,.3)}',
      '.vg-badge{font-size:.6rem;font-weight:700;padding:2px 8px;border-radius:4px;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:4px}',
      '.vg-op-toggle-ico{color:#7890b0;font-size:.7rem;margin-left:6px}',
      '.vg-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;cursor:pointer;flex-shrink:0;margin-left:4px}',
      '.vg-op-row-body{display:none;padding:12px 0 12px 34px;border-top:1px solid rgba(255,255,255,.07);margin-top:4px;background:rgba(0,0,0,.03);border-radius:0 0 8px 8px}',
      '.vg-op-thermometer-wrap{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;width:100%}',
      '.vg-op-thermo-left{flex:1 1 0;min-width:0}',
      '.vg-op-thermo-right{flex:1 1 0;min-width:0}',
      '.vg-op-thermo-svg{display:block}',
      '.vg-op-thermo-diff-row{flex-basis:100%;margin-top:8px;display:flex;gap:8px;justify-content:space-between}',
      '.vg-td-badge{flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:.7rem;font-weight:600;color:#8aa4c0;text-align:center;min-width:0}',
      '.vg-td-badge .vg-td-val{font-family:monospace;font-weight:700;font-size:.78rem}',
      '.vg-td-badge .vg-pm-link{color:#f2a900;font-weight:700;cursor:pointer;text-decoration:underline dotted}',
      '.vg-info-panel{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 14px;font-size:.72rem;height:200px;box-sizing:border-box;overflow:auto}',
      '.vg-info-row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px dashed rgba(255,255,255,.06)}',
      '.vg-info-row:last-child{border-bottom:none}',
      '.vg-info-k{color:#7890b0}',
      '.vg-info-v{font-family:monospace;font-weight:700;color:#e6edf7}',
      '.vg-info-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
      '.vg-btn{font-size:.62rem;font-weight:600;padding:5px 10px;border-radius:6px;border:1px solid rgba(59,130,246,.35);background:rgba(59,130,246,.12);color:#93b8ff;cursor:pointer}',
      '.vg-btn:hover{background:rgba(59,130,246,.22)}',
      '.vg-cycle-flow{display:flex;align-items:center;gap:0;padding:12px;background:#1c2438;border-radius:10px;border:1px solid rgba(255,255,255,.07);overflow-x:auto;margin-bottom:12px}',
      '.vg-cf-node{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:65px;text-align:center;flex-shrink:0}',
      '.vg-cf-circle{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;border:1.5px solid transparent}',
      '.vg-cf-lbl{font-size:.58rem;color:#7890b0}',
      '.vg-cf-val{font-family:monospace;font-size:.64rem;font-weight:600}',
      '.vg-cf-arrow{font-size:1rem;color:#3a4f6a;flex-shrink:0;margin:0 -4px;align-self:center;padding-bottom:20px}',
      '.vg-fc-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:7px;background:#1c2438;border:1px solid rgba(255,255,255,.07);margin-bottom:6px}',
      '.vg-fc-a{font-size:1rem;font-weight:700;min-width:52px}',
      '.vg-fc-info{flex:1;min-width:0}',
      '.vg-fc-info-v{font-family:monospace;font-size:.8rem;font-weight:700}',
      '.vg-fc-info-l{font-size:.6rem;color:#7890b0}',
      '.vg-fc-result{text-align:right}',
      '.vg-fc-result-v{font-family:monospace;font-size:.78rem;font-weight:700}',
      '.vg-fc-result-l{font-size:.58rem;color:#7890b0}',
      '.vg-prow{margin-bottom:8px}',
      '.vg-phd{display:flex;justify-content:space-between;font-size:.65rem;margin-bottom:4px}',
      '.vg-pl{color:#8aa4c0}',
      '.vg-pv{font-family:monospace;font-weight:700}',
      '.vg-pt{height:10px;border-radius:5px;background:#222d42;overflow:hidden}',
      '.vg-pf{height:100%;border-radius:5px;transition:width .4s}',
      '.vg-empty{color:#7890b0;font-size:.72rem;padding:12px 0}',
      '.vg-note{font-size:.63rem;color:#7890b0;margin-top:6px}',
      /* LIGHT THEME */
      '[data-bs-theme="light"] .vg-card{background:var(--bs-body-bg,#fff);border-color:rgba(0,0,0,.10)}',
      '[data-bs-theme="light"] .vg-card-title{color:#6c757d}',
      '[data-bs-theme="light"] .vg-legend{color:#6c757d}',
      '[data-bs-theme="light"] .vg-op-row{background:rgba(0,0,0,.025);border-color:rgba(0,0,0,.10)}',
      '[data-bs-theme="light"] .vg-op-toggle-ico{color:#6c757d}',
      '[data-bs-theme="light"] .vg-op-row-body{background:rgba(0,0,0,.02);border-color:rgba(0,0,0,.08)}',
      '[data-bs-theme="light"] .vg-td-badge{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.08);color:#6c757d}',
      '[data-bs-theme="light"] .vg-info-panel{background:rgba(0,0,0,.02);border-color:rgba(0,0,0,.08)}',
      '[data-bs-theme="light"] .vg-info-v{color:#1f2937}',
      '[data-bs-theme="light"] .vg-cycle-flow{background:rgba(0,0,0,.025);border-color:rgba(0,0,0,.10)}',
      '[data-bs-theme="light"] .vg-cf-lbl{color:#6c757d}',
      '[data-bs-theme="light"] .vg-cf-arrow{color:#adb5bd}',
      '[data-bs-theme="light"] .vg-fc-row{background:rgba(0,0,0,.025);border-color:rgba(0,0,0,.10)}',
      '[data-bs-theme="light"] .vg-pt{background:rgba(0,0,0,.08)}',
      '[data-bs-theme="light"] .vg-empty,[data-bs-theme="light"] .vg-note{color:#6c757d}',
      '@media (max-width:991px){.vg-grid-top,.vg-grid-bottom{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function renderOpenRow(op, idx) {
    var asset = assetOf(op);
    var tipo = tipoOf(op);
    var tipoOp = tipoOperacaoOf(op);
    var cot = num(op.preco_atual);
    var strike = num(op.strike);
    var premio = premioTotal(op);
    var st = thermoStatus(strike, cot, tipo, tipoOp);
    var danger = st.danger;
    var sealColor = danger ? '#ef4444' : '#22c55e';
    var sealLabel = danger ? 'EM EXERCÍCIO' : 'SEGURA';
    var sealPct = strike > 0 ? ((cot - strike) / strike * 100) : 0;
    var sealPctSign = sealPct >= 0 ? '+' : '';
    var acol = danger ? '#f97316' : '#22c55e';
    var bcol = tipo === 'CALL' ? '#3b82f6' : '#ae3ec9';
    var rowId = 'vgOpRow-' + (op.id != null ? op.id : idx);

    var h = '';
    h += '<div class="vg-op-row' + (idx === 0 ? ' vg-op-active' : '') + '" id="' + rowId + '" data-op-id="' + (op.id != null ? op.id : '') + '"' +
         ' data-par="' + asset + '" data-strike="' + strike + '" data-cotacao="' + cot + '" data-tipo="' + tipo + '" data-tipo-op="' + tipoOp + '" data-premio="' + premio + '"' +
         ' style="border-left:3px solid ' + acol + ';cursor:pointer">';
    h += '<span style="font-family:Syne,sans-serif;font-size:.8rem;font-weight:700;min-width:44px;color:' + bcol + '">' + asset + '</span>';
    h += '<span class="vg-badge" style="background:rgba(59,130,246,.1);color:#3b82f6;border:1px solid rgba(59,130,246,.26)">' + tipo + '</span>';
    h += '<span class="vg-badge" style="background:rgba(148,163,184,.12);color:#94a3b8;border:1px solid rgba(148,163,184,.3)">' + tipoOp + '</span>';
    h += '<span class="vg-badge" id="' + rowId + '-seal" style="background:rgba(' + (danger ? '239,68,68' : '34,197,94') + ',.15);color:' + sealColor + ';border:1px solid ' + sealColor + '">' +
         '<span style="width:8px;height:8px;border-radius:50%;background:' + sealColor + ';display:inline-block"></span>' + sealLabel + ' ' + sealPctSign + sealPct.toFixed(2) + '%</span>';
    h += '<div style="flex:1"></div>';
    h += '<span style="font-size:.68rem;color:#7890b0;margin-right:2px">Prêmio:</span><span style="font-family:monospace;font-size:.78rem;font-weight:700;color:#22c55e">+' + brl(premio) + '</span>';
    h += '<span class="vg-icon-btn vg-op-detail-btn" data-op-id="' + (op.id != null ? op.id : '') + '" title="Ver análise da operação" style="background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.26);color:#3b82f6">' +
         '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>';
    h += '<span class="vg-icon-btn vg-op-pm-btn" data-par="' + asset + '" title="Ver preço médio do ativo" style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.26);color:#f59e0b">' +
         '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>';
    h += '<span class="vg-op-toggle-ico">&#9654;</span>';
    h += '</div>';

    // Corpo (accordion) — termômetro + painel de info
    var dur = null;
    try { if (typeof window.calcularDuracaoDias === 'function') dur = window.calcularDuracaoDias(op.data_operacao || op.created_at, op.vencimento); } catch (e) {}
    h += '<div class="vg-op-row-body" id="' + rowId + '-body">';
    h += '  <div class="vg-op-thermometer-wrap">';
    h += '    <div class="vg-op-thermo-left"><svg class="vg-op-thermo-svg" viewBox="0 0 400 200" width="100%" height="200" preserveAspectRatio="xMidYMid meet"></svg></div>';
    h += '    <div class="vg-op-thermo-right"><div class="vg-op-info-panel">';
    h += '      <div class="vg-info-row"><span class="vg-info-k">Strike</span><span class="vg-info-v" style="color:#60a5fa">' + brl(strike) + '</span></div>';
    h += '      <div class="vg-info-row"><span class="vg-info-k">Cotação (manual)</span><span class="vg-info-v" style="color:' + (danger ? '#ef4444' : '#22c55e') + '">' + (cot > 0 ? brl(cot) : '—') + '</span></div>';
    h += '      <div class="vg-info-row"><span class="vg-info-k">Vencimento</span><span class="vg-info-v">' + (op.vencimento ? String(op.vencimento).substring(0, 10).split('-').reverse().join('/') : '—') + '</span></div>';
    h += '      <div class="vg-info-row"><span class="vg-info-k">Duração</span><span class="vg-info-v">' + (dur !== null && dur !== undefined ? dur + ' dias' : '—') + '</span></div>';
    h += '      <div class="vg-info-row"><span class="vg-info-k">Quantidade</span><span class="vg-info-v">' + (op.quantidade != null ? op.quantidade : '—') + '</span></div>';
    h += '      <div class="vg-info-row"><span class="vg-info-k">Prêmio total</span><span class="vg-info-v" style="color:#22c55e">+' + brl(premio) + '</span></div>';
    h += '      <div class="vg-info-row"><span class="vg-info-k">Resultado</span><span class="vg-info-v" style="color:' + (num(op.resultado) >= 0 ? '#22c55e' : '#ef4444') + '">' + brl(num(op.resultado)) + '</span></div>';
    h += '    </div></div>';
    h += '    <div class="vg-op-thermo-diff-row"></div>';
    h += '  </div>';
    h += '</div>';
    return h;
  }

  function renderAbertas(ops) {
    var abertas = computeAbertas(ops);
    var h = '<div class="vg-card">';
    h += '<div class="vg-card-title" style="cursor:pointer" id="vgOpOpenHeader"><span>&#128200;</span>Posições Abertas Agora</div>';
    if (!abertas.length) {
      // Estado vazio — sugestões por ativo base (paridade com o crypto)
      h += '<div id="vgOpenPosEmptyOpcoes"></div>';
    } else {
      abertas.forEach(function (op, idx) { h += renderOpenRow(op, idx); });
    }
    h += '</div>';
    return h;
  }

  function renderCiclo(ops) {
    // Ativo do ciclo: primeiro ativo com posição aberta; senão o mais frequente
    var abertas = computeAbertas(ops);
    var ativo = abertas.length ? assetOf(abertas[0]) : null;
    if (!ativo) {
      var counts = {};
      (ops || []).forEach(function (o) { var a = assetOf(o); counts[a] = (counts[a] || 0) + 1; });
      ativo = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || null;
    }

    var cy = ativo ? computeCicloAtivo(ops, ativo) : null;
    var h = '<div class="vg-card">';
    h += '<div class="vg-card-title"><span>&#128260;</span>Fluxo do Ciclo — PUT → CALL' + (ativo ? ' · ' + ativo : '') + '</div>';

    if (!cy) {
      h += '<div class="vg-empty">Sem dados suficientes para montar o ciclo.</div>';
      h += '</div>';
      return h;
    }

    var pur = '#ae3ec9', org = '#f97316', grn = '#22c55e', amb = '#f59e0b';
    h += '<div class="vg-cycle-flow">';
    h += cfNode('PUT', 'Strike PUT', cy.putStrike > 0 ? brlShort(cy.putStrike) : '—', pur);
    h += '<div class="vg-cf-arrow">&#8594;</div>';
    h += cfNode(cy.exercida ? 'EX' : 'AB', cy.exercida ? 'Exercida' : 'Em aberto', cy.exercDate, cy.exercida ? org : amb);
    cy.prems.forEach(function (p, i) {
      h += '<div class="vg-cf-arrow">&#8594;</div>';
      h += cfNode('P' + (i + 1), 'Prêmio ' + (i + 1), '+' + brlShort(premioTotal(p)), grn);
    });
    h += '<div class="vg-cf-arrow">&#8594;</div>';
    h += cfNode('CM', 'Custo Médio', (cy.cm !== null && cy.cm > 0) ? brlShort(cy.cm) : '—', amb);
    h += '</div>';

    // Prêmios por ciclo (barras)
    var ciclos = computeCiclos(ops);
    var maxTot = ciclos.reduce(function (m, c) { return Math.max(m, c.total); }, 0) || 1;
    h += '<div class="vg-card-title" style="margin-top:8px">Prêmios por ciclo</div>';
    if (!ciclos.length) {
      h += '<div class="vg-empty">Sem ciclos registrados.</div>';
    } else {
      ciclos.forEach(function (c, i) {
        var pctW = Math.min(100, (c.total / maxTot) * 100);
        var col = c.hasOpen ? '#3a4f6a' : (i % 2 === 0 ? grn : '#3b82f6');
        h += '<div class="vg-prow">';
        h += '  <div class="vg-phd"><span class="vg-pl">Ciclo ' + c.date + ' · ' + c.assets + (c.hasOpen ? ' · Em aberto' : '') + '</span>' +
             '<span class="vg-pv" style="color:' + (c.hasOpen ? '#7890b0' : grn) + '">' + (c.total > 0 ? '+' + brl(c.total) : 'aguardando') + '</span></div>';
        h += '  <div class="vg-pt"><div class="vg-pf" style="width:' + pctW.toFixed(1) + '%;background:' + col + '"></div></div>';
        h += '</div>';
      });
    }
    h += '</div>';
    return h;
  }

  function cfNode(circle, label, value, color) {
    return '<div class="vg-cf-node">' +
      '<div class="vg-cf-circle" style="background:' + hexA(color, .14) + ';border-color:' + color + ';color:' + color + (circle.length > 2 ? ';font-size:.55rem' : '') + '">' + circle + '</div>' +
      '<div class="vg-cf-lbl">' + label + '</div>' +
      '<div class="vg-cf-val" style="color:' + color + '">' + value + '</div>' +
      '</div>';
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function renderProjecao(ops) {
    var proj = computeProjecao(ops);
    var h = '<div class="vg-card">';
    h += '<div class="vg-card-title"><span>&#128302;</span>Projeção Próximas Ops</div>';
    if (!proj.length) {
      h += '<div class="vg-empty">Sem posições abertas para projetar.</div>';
      h += '</div>';
      return h;
    }
    proj.forEach(function (p) {
      var col = '#3b82f6';
      h += '<div class="vg-fc-row">';
      h += '  <span class="vg-fc-a" style="color:' + col + '">' + p.asset + '</span>';
      h += '  <div class="vg-fc-info">';
      h += '    <div class="vg-fc-info-v" style="color:#f59e0b">' + (p.strikeCall > 0 ? brl(p.strikeCall) : '—') + '</div>';
      h += '    <div class="vg-fc-info-l">' + (p.cot > 0 ? 'CALL sugerida · ' + (p.dist >= 0 ? '+' : '') + p.dist.toFixed(2) + '% vs cot. ' + brlShort(p.cot) : 'CALL sugerida · cotação indisponível') + '</div>';
      h += '  </div>';
      h += '  <div class="vg-fc-result">';
      h += '    <div class="vg-fc-result-v" style="color:' + (p.premEst != null ? '#22c55e' : '#7890b0') + '">' + (p.premEst != null ? '+' + brl(p.premEst) : '—') + '</div>';
      h += '    <div class="vg-fc-result-l">' + (p.premEst != null ? 'prêm. estimado' : 'a definir') + '</div>';
      h += '  </div>';
      h += '</div>';
    });
    var lucroRows = proj.filter(function (p) { return p.lucroEx !== null && p.lucroEx > 0; });
    if (lucroRows.length) {
      h += '<div style="margin-top:10px;padding:9px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:7px">';
      h += '<div style="font-size:.65rem;color:#22c55e;font-weight:600">&#128161; Lucro projetado se exercidas</div>';
      lucroRows.forEach(function (p) {
        h += '<div style="display:flex;justify-content:space-between;margin-top:4px">';
        h += '<span style="font-size:.63rem;color:#7890b0">' + p.asset + ': strike ' + brlShort(p.strikeCall) + ' vs custo médio ' + brlShort(p.cm) + '</span>';
        h += '<span style="font-family:monospace;font-weight:700;color:#22c55e">+' + brl(p.lucroEx) + '</span>';
        h += '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderResumo(stats) {
    var h = '<div class="vg-card">';
    h += '<div class="vg-card-title"><span>&#128202;</span>Resumo Rápido</div>';
    h += resumoBar('Taxa de acerto', stats.wr, '#22c55e', stats.fechadas ? stats.profitable + '/' + stats.fechadas + ' fechadas lucrativas' : 'sem operações fechadas');
    h += resumoBar('Ops sem exercício', stats.semEx, '#3b82f6', stats.exercidas + ' exercida(s) de ' + stats.n);
    h += resumoBar('Consistência', stats.consistencia, '#f59e0b', 'meses positivos no ano');
    h += '<div class="vg-note">ROI acumulado sobre o saldo da corretora: <strong style="color:' + (stats.roi >= 0 ? '#22c55e' : '#ef4444') + '">' + stats.roi.toFixed(2) + '%</strong></div>';
    h += '</div>';
    return h;
  }

  function resumoBar(label, pctVal, color, sub) {
    var w = Math.max(0, Math.min(100, isFinite(pctVal) ? pctVal : 0));
    return '<div class="vg-prow">' +
      '<div class="vg-phd"><span class="vg-pl">' + label + '</span><span class="vg-pv" style="color:' + color + '">' + w.toFixed(2) + '%</span></div>' +
      '<div class="vg-pt"><div class="vg-pf" style="width:' + w.toFixed(1) + '%;background:' + color + '"></div></div>' +
      (sub ? '<div class="vg-note" style="margin-top:2px">' + sub + '</div>' : '') +
      '</div>';
  }

  function renderVG(ops) {
    var stats = computeStats(ops);
    var h = '';

    /* Row 1: Evolução Acumulada + Posições Abertas */
    h += '<div class="vg-grid-top">';
    h += '<div class="vg-card">';
    h += '<div class="vg-card-title"><span>&#128200;</span>Evolução de Prêmios Acumulados — ' + new Date().getFullYear() + '</div>';
    h += '<div class="vg-legend">';
    h += '<span><span style="width:10px;height:10px;border-radius:2px;background:rgba(59,130,246,.7);display:inline-block"></span>CALL</span>';
    h += '<span><span style="width:10px;height:10px;border-radius:2px;background:rgba(174,62,201,.7);display:inline-block"></span>PUT</span>';
    h += '<span><span style="width:18px;height:3px;background:#f59e0b;display:inline-block;border-radius:2px"></span>Acumulado</span>';
    h += '</div>';
    h += '<div class="vg-chart-wrap" style="height:380px"><canvas id="vgChartAcc"></canvas></div>';
    h += '</div>';
    h += renderAbertas(ops);
    h += '</div>';

    /* Row 2: Fluxo do Ciclo (largura total) */
    h += '<div style="margin-bottom:14px">' + renderCiclo(ops) + '</div>';

    /* Row 3: Projeção + Resumo */
    h += '<div class="vg-grid-bottom">';
    h += renderProjecao(ops);
    h += renderResumo(stats);
    h += '</div>';

    return h;
  }

  /* ───────────────────────── Charts ───────────────────────── */

  var _chartAcc = null;

  function buildChart(ops) {
    var C = window.Chart;
    if (!C) return;
    var el = document.getElementById('vgChartAcc');
    if (!el) return;
    var stats = computeStats(ops);
    if (_chartAcc) { try { _chartAcc.destroy(); } catch (e) {} _chartAcc = null; }

    var isLight = document.body.getAttribute('data-bs-theme') === 'light';
    var tickColor = isLight ? '#6c757d' : '#5b7291';
    var gridColor = isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)';

    try {
      _chartAcc = new C(el, {
        type: 'bar',
        data: {
          labels: stats.mLabels,
          datasets: [
            {
              type: 'bar', label: 'CALL', data: stats.mCallVals,
              backgroundColor: 'rgba(59,130,246,.55)', borderRadius: 4, barThickness: 18,
              stack: 'premios', order: 2
            },
            {
              type: 'bar', label: 'PUT', data: stats.mPutVals,
              backgroundColor: 'rgba(174,62,201,.55)', borderRadius: 4, barThickness: 18,
              stack: 'premios', order: 2
            },
            {
              type: 'line', label: 'Acumulado', data: stats.mAccVals,
              borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.07)',
              borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#f59e0b',
              fill: true, tension: 0.38, yAxisID: 'y2', order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var v = ctx.parsed.y;
                  return ctx.dataset.label + ': ' + brl(v);
                },
                footer: function (items) {
                  var callV = 0, putV = 0;
                  items.forEach(function (it) {
                    if (it.dataset.label === 'CALL') callV = it.raw || 0;
                    else if (it.dataset.label === 'PUT') putV = it.raw || 0;
                  });
                  var tot = callV + putV;
                  return tot > 0 ? 'Prêmio do mês: ' + brl(tot) : '';
                }
              }
            }
          },
          scales: {
            x: { stacked: true, ticks: { color: tickColor, font: { size: 10 } }, grid: { display: false } },
            y: {
              stacked: true, beginAtZero: true,
              ticks: { color: tickColor, font: { size: 10 }, callback: function (v) { return brlShort(v); } },
              grid: { color: gridColor }
            },
            y2: {
              position: 'right', beginAtZero: true,
              ticks: { color: '#f59e0b', font: { size: 10 }, callback: function (v) { return brlShort(v); } },
              grid: { display: false }
            }
          }
        }
      });
    } catch (e) {
      console.warn('[opcoes][vg] Falha ao montar gráfico acumulado:', e);
    }
  }

  /* ───────────────────────── Termômetro (SVG) ───────────────────────── */

  function drawThermo(bodyEl, strike, cot, tipo, tipoOp, pm, par, op) {
    if (!bodyEl) return;
    var svg = bodyEl.querySelector('.vg-op-thermo-svg');
    var diffEl = bodyEl.querySelector('.vg-op-thermo-diff-row');
    if (!svg) return;

    if (!strike || !cot) {
      svg.innerHTML = '<text x="200" y="100" fill="#7890b0" font-size="13" text-anchor="middle">Cotação indisponível (preencha o Preço Atual)</text>' +
        '<text x="200" y="122" fill="#7890b0" font-size="11" text-anchor="middle">Strike ' + brlShort(strike) + '</text>';
      if (diffEl) diffEl.innerHTML = '';
      return;
    }

    var spread = Math.abs(cot - strike);
    var margin = Math.max(spread * 1.5, Math.max(strike, cot) * 0.08);
    var MIN = Math.max(0, Math.min(strike, cot) - margin);
    var MAX = Math.max(strike, cot) + margin;
    var clamp = function (v) { return Math.max(0, Math.min(1, (v - MIN) / (MAX - MIN))); };

    var totalH = 160, barW = 56, y0 = 20, sx = 140, qx = 250;
    var sh = clamp(strike) * totalH;
    var qh = clamp(cot) * totalH;
    var sy0 = y0 + totalH - sh;
    var qy0 = y0 + totalH - qh;

    var st = thermoStatus(strike, cot, tipo, tipoOp);
    var statusColor = st.danger ? '#ef4444' : '#22c55e';

    var zoneH = totalH / 3;
    var zoneColors = ['#991b1b', '#a16207', '#166534'];

    var h = '';
    for (var i = 0; i <= 8; i++) {
      var gy = y0 + totalH - (i / 8) * totalH;
      var val = MIN + (MAX - MIN) / 8 * i;
      var label = Math.abs(val) >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0);
      h += '<line x1="56" y1="' + gy + '" x2="344" y2="' + gy + '" stroke="#334d6e" stroke-width="1"/>';
      h += '<text x="48" y="' + (gy + 4) + '" fill="#8aa4c0" font-size="9" text-anchor="end">' + label + '</text>';
      h += '<text x="352" y="' + (gy + 4) + '" fill="#8aa4c0" font-size="9">' + label + '</text>';
    }

    function tube(cx) {
      var t = '';
      for (var z = 0; z < 3; z++) {
        var zy = y0 + totalH - (z + 1) * zoneH;
        t += '<rect x="' + (cx - barW / 2) + '" y="' + zy + '" width="' + barW + '" height="' + zoneH + '" fill="' + zoneColors[z] + '" opacity=".6" rx="2"/>';
      }
      t += '<rect x="' + (cx - barW / 2) + '" y="' + y0 + '" width="' + barW + '" height="' + totalH + '" fill="none" stroke="#334155" stroke-width="1.5" rx="8"/>';
      return t;
    }

    h += tube(sx);
    h += tube(qx);
    h += '<rect x="' + (sx - barW / 2 + 3) + '" y="' + sy0 + '" width="' + (barW - 6) + '" height="' + sh + '" fill="#60a5fa" rx="5"/>';
    h += '<circle cx="' + sx + '" cy="' + sy0 + '" r="6" fill="#93c5fd"/>';
    h += '<rect x="' + (qx - barW / 2 + 3) + '" y="' + qy0 + '" width="' + (barW - 6) + '" height="' + qh + '" fill="' + statusColor + '" rx="5"/>';
    h += '<circle cx="' + qx + '" cy="' + qy0 + '" r="6" fill="' + statusColor + '"/>';
    h += '<line x1="' + sx + '" y1="' + sy0 + '" x2="' + qx + '" y2="' + qy0 + '" stroke="' + statusColor + '" stroke-width="2" stroke-dasharray="5,4" opacity=".8"/>';

    var midX = (sx + qx) / 2;
    var arrowY = Math.min(sy0, qy0) - 18;
    var diff = cot - strike;
    var sign = diff > 0 ? '\u25B2' : diff < 0 ? '\u25BC' : '=';
    h += '<text x="' + midX + '" y="' + arrowY + '" fill="' + statusColor + '" font-size="16" text-anchor="middle">' + sign + '</text>';
    h += '<text x="' + midX + '" y="' + (arrowY + 15) + '" fill="' + statusColor + '" font-size="11" text-anchor="middle" font-weight="700">' + (diff > 0 ? '+' : '') + fmtShort(diff) + '</text>';
    h += '<text x="' + sx + '" y="' + (y0 - 6) + '" fill="#60a5fa" font-size="11" text-anchor="middle" font-weight="700">Strike</text>';
    h += '<text x="' + qx + '" y="' + (y0 - 6) + '" fill="' + statusColor + '" font-size="11" text-anchor="middle" font-weight="700">Cotação</text>';
    h += '<text x="' + sx + '" y="' + (y0 + totalH + 20) + '" fill="#60a5fa" font-size="11" text-anchor="middle" font-weight="700">' + brlShort(strike) + '</text>';
    h += '<text x="' + qx + '" y="' + (y0 + totalH + 20) + '" fill="' + statusColor + '" font-size="11" text-anchor="middle" font-weight="700">' + brlShort(cot) + '</text>';

    svg.innerHTML = h;

    if (diffEl) {
      var diffSign = diff > 0 ? '+' : '';
      var popEst = computePoP(
        op || { strike: strike, tipo: tipo, tipo_operacao: tipoOp, premio: 0, quantidade: 1 },
        cot
      );
      var popColor = (popEst !== null && popEst >= 50) ? '#22c55e' : '#ef4444';
      var popTxt = (popEst !== null) ? popEst.toFixed(0) + '%' : '—';

      var pmHtml = '';
      if (pm && pm > 0) {
        pmHtml = '<div class="vg-td-badge"><span>PM:</span> <span class="vg-pm-link" data-par="' + par + '">' + brl(pm) + '</span></div>';
      }

      diffEl.innerHTML = '<div class="vg-td-badge"><span>Diferença:</span> <span class="vg-td-val" style="color:' + statusColor + '">' + diffSign + fmtShort(diff) + '</span></div>' +
        '<div class="vg-td-badge"><span>PoP:</span> <span class="vg-td-val" style="color:' + popColor + '">' + popTxt + '</span></div>' +
        pmHtml;
    }
  }

  /* ───────────────────────── Interações ───────────────────────── */

  function bindContainer(container, ops) {
    // Delegação de eventos: cobre botões/links recriados por re-render ou
    // criados depois do bind (ex.: .vg-pm-link desenhado por drawThermo via setTimeout).
    if (!container.__vgDelegated) {
      container.__vgDelegated = true;
      container.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;

        var pmBtn = t.closest('.vg-op-pm-btn[data-par], .vg-pm-link[data-par]');
        if (pmBtn && container.contains(pmBtn)) {
          e.stopPropagation();
          var par = pmBtn.getAttribute('data-par');
          if (par && window.ModalPrecoMedioOpcoes && typeof window.ModalPrecoMedioOpcoes.open === 'function') {
            window.ModalPrecoMedioOpcoes.open(par);
          }
          return;
        }

        var dBtn = t.closest('.vg-op-detail-btn[data-op-id]');
        if (dBtn && container.contains(dBtn)) {
          e.stopPropagation();
          var opId = dBtn.getAttribute('data-op-id');
          if (opId && window.ModalAnaliseDetalheOpcoes && typeof window.ModalAnaliseDetalheOpcoes.open === 'function') {
            window.ModalAnaliseDetalheOpcoes.open(opId);
          }
        }
      });
    }

    var rows = container.querySelectorAll('.vg-op-row[data-op-id]');

    rows.forEach(function (el) {
      el.addEventListener('click', function (e) {
        var target = e.target;
        if (target.closest('.vg-op-detail-btn') || target.closest('.vg-op-pm-btn') || target.closest('.vg-pm-link')) return;

        var body = document.getElementById(el.id + '-body');
        if (!body) return;
        var isOpen = body.style.display === 'block';

        // Accordion exclusivo
        container.querySelectorAll('.vg-op-row-body').forEach(function (b) {
          if (b.id !== body.id) {
            b.style.display = 'none';
            var otherIco = b.previousElementSibling ? b.previousElementSibling.querySelector('.vg-op-toggle-ico') : null;
            if (otherIco) otherIco.innerHTML = '&#9654;';
          }
        });

        body.style.display = isOpen ? 'none' : 'block';
        var ico = el.querySelector('.vg-op-toggle-ico');
        if (ico) ico.innerHTML = isOpen ? '&#9654;' : '&#9660;';

        container.querySelectorAll('.vg-op-row').forEach(function (r) { r.classList.remove('vg-op-active'); });
        el.classList.add('vg-op-active');

        if (!isOpen) {
          var strike = num(el.getAttribute('data-strike'));
          var cot = num(el.getAttribute('data-cotacao'));
          var tipo = el.getAttribute('data-tipo') || 'CALL';
          var tipoOp = el.getAttribute('data-tipo-op') || 'VENDA';
          var par = el.getAttribute('data-par') || '';
          var opId = el.getAttribute('data-op-id');
          var op = _activeOps.find(function (o) { return String(o.id) === String(opId); });
          var pmVal = computePM(_activeOps, par);
          setTimeout(function () { drawThermo(body, strike, cot, tipo, tipoOp, pmVal, par, op); }, 10);
        }
      });
    });

    // Botões de análise (.vg-op-detail-btn), de preço médio (.vg-op-pm-btn)
    // e links de PM do termômetro (.vg-pm-link) são tratados por delegação no
    // container (acima), garantindo bind mesmo após re-render/drawThermo.

    // Cabeçalho "Posições Abertas Agora" → análise da primeira posição aberta
    var headerEl = document.getElementById('vgOpOpenHeader');
    if (headerEl) {
      headerEl.addEventListener('click', function () {
        var abertas = computeAbertas(ops);
        var first = abertas[0];
        if (first && first.id != null && window.ModalAnaliseDetalheOpcoes && typeof window.ModalAnaliseDetalheOpcoes.open === 'function') {
          window.ModalAnaliseDetalheOpcoes.open(String(first.id));
        }
      });
    }

    // Abre o primeiro accordion e desenha seu termômetro
    var firstRow = container.querySelector('.vg-op-row[data-op-id]');
    if (firstRow) {
      var firstBody = document.getElementById(firstRow.id + '-body');
      if (firstBody) {
        firstBody.style.display = 'block';
        var fi = firstRow.querySelector('.vg-op-toggle-ico');
        if (fi) fi.innerHTML = '&#9660;';
        firstRow.classList.add('vg-op-active');
        var fStrike = num(firstRow.getAttribute('data-strike'));
        var fCot = num(firstRow.getAttribute('data-cotacao'));
        var fTipo = firstRow.getAttribute('data-tipo') || 'CALL';
        var fTipoOp = firstRow.getAttribute('data-tipo-op') || 'VENDA';
        var fPar = firstRow.getAttribute('data-par') || '';
        var fOpId = firstRow.getAttribute('data-op-id');
        var fOp = ops.find(function (o) { return String(o.id) === String(fOpId); });
        var fPm = computePM(ops, fPar);
        setTimeout(function () { drawThermo(firstBody, fStrike, fCot, fTipo, fTipoOp, fPm, fPar, fOp); }, 10);
      }
    }
  }

  /* ───────────────────────── Render principal ───────────────────────── */

  function render() {
    var container = document.getElementById('vgContainer');
    if (!container) return;
    var ops = getOps();
    if (!Array.isArray(ops) || ops.length === 0) {
      container.innerHTML = '<div style="padding:32px;text-align:center;color:#7890b0;font-size:.85rem">Nenhuma operação disponível.</div>';
      return;
    }

    injectStyles();
    _activeOps = ops;
    container.innerHTML = renderVG(ops);
    /* Estado vazio do card "Posições Abertas Agora" — sugestões por ativo base */
    var vgEmpty = document.getElementById('vgOpenPosEmptyOpcoes');
    if (vgEmpty && window.CelularSugestoesOpcoes) window.CelularSugestoesOpcoes.mount(vgEmpty, ops);
    bindContainer(container, ops);
    setTimeout(function () { buildChart(ops); }, 50);
  }

  function renderFromEvent(ev) {
    if (ev && ev.detail && Array.isArray(ev.detail.operacoes)) {
      window.opcoesOperacoes = ev.detail.operacoes;
    }
    var pane = document.getElementById('tab-visao-geral');
    if (pane && pane.classList.contains('active')) render();
  }

  function fetchFallback() {
    if (getOps().length) return;
    var base = window.API_BASE || '';
    fetch(base + '/api/opcoes', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (Array.isArray(data) && data.length) {
          window.opcoesOperacoes = data;
          window.allOperacoes = window.allOperacoes || data;
          render();
        }
      })
      .catch(function () {});
  }

  function init() {
    // Tenta renderizar quando os dados aparecerem (retry curto)
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (getOps().length > 0) {
        clearInterval(timer);
        render();
      } else if (attempts > 30) {
        clearInterval(timer);
        fetchFallback();
      }
    }, 200);

    // Ao ativar a aba
    document.addEventListener('shown.bs.tab', function (e) {
      if (!e.target) return;
      var href = e.target.getAttribute('href') || e.target.dataset.bsTarget;
      if (href === '#tab-visao-geral') render();
    });

    // Quando os dados chegam
    document.addEventListener('opcoesDataUpdated', renderFromEvent);

    // Ao trocar de tema (recria o gráfico com as cores corretas)
    document.addEventListener('themeChanged', function () {
      var pane = document.getElementById('tab-visao-geral');
      if (pane && pane.classList.contains('active')) render();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.VisaoGeralOpcoes = { render: render };

})();

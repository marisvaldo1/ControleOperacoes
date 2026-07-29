/**
 * ============================================================
 *  MIGRAÇÃO Opções2026.xlsm → Google Planilhas
 *  Planilha: Investimentos (Crypto)
 *  Script: Miguel Villas Bôas
 *  Obs: Apenas funções Binance (OPLab removido)
 * ============================================================
 */

var SHEET_CRYPTO = 'Crypto';
var COLUNA_BOTAO = 17; // Coluna Q = checkboxes (botão por linha)

var CG_IDS = {
  BTC:'bitcoin', ETH:'ethereum', SOL:'solana', BNB:'binancecoin',
  XRP:'ripple', ADA:'cardano', AVAX:'avalanche-2', DOT:'polkadot',
  DOGE:'dogecoin', MATIC:'matic-network', LINK:'chainlink',
  UNI:'uniswap', SHIB:'shiba-inu', LTC:'litecoin', BCH:'bitcoin-cash',
  ATOM:'cosmos', ETC:'ethereum-classic', XLM:'stellar', NEAR:'near',
  ALGO:'algorand', FIL:'filecoin', TRX:'tron', APT:'aptos',
  ARB:'arbitrum', OP:'optimism', SUI:'sui', PEPE:'pepe',
  INJ:'injective', FTM:'fantom', AAVE:'aave', MKR:'maker',
  CRV:'curve-dao-token', SAND:'the-sandbox', MANA:'decentraland',
  AXS:'axie-infinity', GALA:'gala', APE:'apecoin', FLOKI:'floki',
  ENS:'ethereum-name-service', IMX:'immutable-x', BLUR:'blur',
  SEI:'sei-network', TIA:'celestia', ORDI:'ordinals', WIF:'dogwifcoin',
  BONK:'bonk', RUNE:'thorchain', FET:'fetch-ai', RNDR:'render-token',
  GRT:'the-graph', EOS:'eos', KAS:'kaspa', MNT:'mantle',
  STRK:'starknet', EGLD:'elrond', MINA:'mina-protocol', FLOW:'flow',
  CHZ:'chiliz', ENJ:'enjincoin', BAT:'basic-attention-token',
  NEO:'neo', XTZ:'tezos', HBAR:'hedera-hashgraph', VET:'vechain'
};

// ==========================================================
// FUNÇÃO CUSTOMIZADA: =OBTERCOTACAOBINANCE("ETHUSDT")
// ORDEM DE TENTATIVA (a primeira que responder é usada):
//   1º - Binance (5 endpoints: api, api1, api2, api3, fapi)
//   2º - Kraken
//   3º - CryptoCompare
//   4º - CoinGecko
//   5º - Coinbase
// ==========================================================

/**
 * Obtém cotação de criptomoedas (Binance + fallbacks)
 * USO NA CÉLULA: =OBTERCOTACAOBINANCE("ETHUSDT")
 * @param {string} ticker  Symbol (ex: BTCUSDT, ETHUSDT, SOLUSDT)
 * @return {number|string}
 * @customfunction
 */
function OBTERCOTACAOBINANCE(ticker) {
  if (!ticker || String(ticker).trim() === '') return 'Ticker vazio';
  var symbol = String(ticker).trim().toUpperCase();
  var base = symbol.replace(/USDT|BUSD|USDC|USD|PAX|TUSD|DAI$/i, '');

  var urls = [
    'https://api.binance.com/api/v3/ticker/price',
    'https://api1.binance.com/api/v3/ticker/price',
    'https://api2.binance.com/api/v3/ticker/price',
    'https://api3.binance.com/api/v3/ticker/price',
    'https://fapi.binance.com/fapi/v1/ticker/price'
  ];
  for (var i = 0; i < urls.length; i++) {
    try {
      var r = UrlFetchApp.fetch(urls[i] + '?symbol=' + symbol, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        muteHttpExceptions: true, timeout: 8
      });
      if (r.getResponseCode() === 200) {
        var p = parseFloat(JSON.parse(r.getContentText()).price);
        if (!isNaN(p)) return p;
      }
    } catch (e) {}
  }
  if (!base) return 'Erro: ticker inv\u00E1lido';

  var kraken = {
    BTC:'XBT', ETH:'ETH', SOL:'SOL', XRP:'XRP', ADA:'ADA',
    DOT:'DOT', DOGE:'DOGE', LINK:'LINK', LTC:'LTC', BCH:'BCH',
    AVAX:'AVAX', MATIC:'MATIC', UNI:'UNI', ATOM:'ATOM', ETC:'ETC',
    XLM:'XLM', ALGO:'ALGO', FIL:'FIL', TRX:'TRX', NEAR:'NEAR',
    APT:'APT', SUI:'SUI', PEPE:'PEPE', INJ:'INJ', FTM:'FTM',
    AAVE:'AAVE', CRV:'CRV', FLOKI:'FLOKI'
  };
  if (kraken[base]) {
    try {
      var kr = UrlFetchApp.fetch('https://api.kraken.com/0/public/Ticker?pair=' + kraken[base] + 'USD', {
        muteHttpExceptions: true, timeout: 8
      });
      if (kr.getResponseCode() === 200) {
        var kd = JSON.parse(kr.getContentText());
        if (kd.result) {
          var key = Object.keys(kd.result)[0];
          if (key && kd.result[key] && kd.result[key].c) {
            var p = parseFloat(kd.result[key].c[0]);
            if (!isNaN(p)) return p;
          }
        }
      }
    } catch (e) {}
  }

  try {
    var cc = UrlFetchApp.fetch('https://min-api.cryptocompare.com/data/price?fsym=' + base + '&tsyms=USD', {
      headers: { 'User-Agent': 'Mozilla/5.0' }, muteHttpExceptions: true, timeout: 8
    });
    if (cc.getResponseCode() === 200) {
      var cd = JSON.parse(cc.getContentText());
      if (cd.USD) return cd.USD;
    }
  } catch (e) {}

  if (CG_IDS[base]) {
    try {
      var cg = UrlFetchApp.fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=' + CG_IDS[base] + '&vs_currencies=usd',
        { headers: { 'User-Agent': 'Mozilla/5.0' }, muteHttpExceptions: true, timeout: 8 }
      );
      if (cg.getResponseCode() === 200) {
        var gd = JSON.parse(cg.getContentText());
        if (gd[CG_IDS[base]] && gd[CG_IDS[base]].usd) return gd[CG_IDS[base]].usd;
      }
    } catch (e) {}
  }

  try {
    var cb = UrlFetchApp.fetch('https://api.coinbase.com/v2/prices/' + base + '-USD/spot', {
      muteHttpExceptions: true, timeout: 8
    });
    if (cb.getResponseCode() === 200) {
      var bd = JSON.parse(cb.getContentText());
      if (bd.data && bd.data.amount) {
        var p = parseFloat(bd.data.amount);
        if (!isNaN(p)) return p;
      }
    }
  } catch (e) {}

  return 'Erro: n\u00E3o foi poss\u00EDvel obter cota\u00E7\u00E3o';
}

// ==========================================================
// TRIGGER: Clique no checkbox (botão por linha)
// ATENÇÃO: onEdit simples NÃO funciona com UrlFetchApp.
// Execute a função "instalarTrigger" UMA VEZ no editor de
// script para criar um trigger instalável (full permission).
// ==========================================================

function onEdit(e) {
  if (!e || e.value !== 'TRUE') return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_CRYPTO) return;
  if (e.range.getColumn() !== COLUNA_BOTAO) return;

  processarLinha(e.range.getRow());
  e.range.setValue('FALSE');
}

function instalarTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var trigs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trigs.length; i++) {
    if (trigs[i].getHandlerFunction() === 'onEdit' && trigs[i].getTriggerSource() === ScriptApp.TriggerSource.SPREADSHEETS)
      ScriptApp.deleteTrigger(trigs[i]);
  }
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  SpreadsheetApp.getUi().alert('Trigger instalável criado! Agora o checkbox funcionará com permissão total.');
}

// ==========================================================
// PROCESSAR UMA ÚNICA LINHA (usado pelo checkbox e pela macro)
// ==========================================================

function processarLinha(row) {
  var ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CRYPTO);
  if (!ws || row < 3) return;

  var rowValues = ws.getRange(row, 1, 1, ws.getLastColumn()).getValues()[0];
  var countA = 0;
  for (var j = 0; j < rowValues.length; j++) {
    if (rowValues[j] !== '' && rowValues[j] !== null && rowValues[j] !== undefined) countA++;
  }
  if (countA === 0) return;

  var valorO = Number(rowValues[14]);
  if (isNaN(valorO)) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Linha ' + row + ': col O não é numérico', 'Aviso', 3);
    return;
  }

  if (valorO > 0) {
    var ticker = String(rowValues[0] || '').trim();
    if (!ticker) {
      SpreadsheetApp.getActiveSpreadsheet().toast('Linha ' + row + ': coluna A vazia', 'Aviso', 3);
      return;
    }
    var symbol = ticker.toUpperCase();
    if (symbol.indexOf('USDT') === -1 && symbol.indexOf('BUSD') === -1 && symbol.indexOf('BTC') === -1 && symbol.indexOf('USD') === -1)
      symbol += 'USDT';
    var cotacao = fetchBinancePrice(symbol);
    if (cotacao !== null) {
      ws.getRange(row, 3).setValue(cotacao);
      var valorD = Number(rowValues[3]);
      if (!isNaN(valorD) && valorD === 0) {
        ws.getRange(row, 4).setValue(cotacao);
      }
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast('Linha ' + row + ' ' + symbol + ': falha ao obter cotação', 'Erro', 5);
    }
  } else {
    var tickerValor = String(rowValues[0] || '').trim();
    if (tickerValor !== '') {
      var ultimaColuna = getLastColWithData(ws, row);
      if (ultimaColuna >= COLUNA_BOTAO) ultimaColuna = COLUNA_BOTAO - 1;
      var range = ws.getRange(row, 1, 1, ultimaColuna);
      range.setBackground(null);
      range.setFontColor(null);

      var valorP = String(rowValues[15] || '').toUpperCase().trim();
      if (valorP === 'SIM') {
        range.setBackground('#646C96');
      } else {
        range.setBackground('#808080');
      }
      range.setFontColor('#FFFFFF');

      var celulaUltima = ws.getRange(row, ultimaColuna);
      if (valorP === 'SIM') {
        celulaUltima.setFontColor('#FF0000');
      } else if (valorP === 'NÃO') {
        celulaUltima.setFontColor('#00FF00');
      }
    }
  }
}

// ==========================================================
// MACRO PRINCIPAL (igual ao VBA AtualizarValorAtualSeNecessario)
// ==========================================================

function atualizarValorAtualCrypto() {
  var ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CRYPTO);
  if (!ws) { SpreadsheetApp.getUi().alert('Planilha "' + SHEET_CRYPTO + '" n\u00E3o encontrada!'); return; }

  var ult = ws.getLastRow();
  if (ult < 3) return;
  var ui = SpreadsheetApp.getUi();

  var ga = 0, linhaGrupo = 0;
  for (var i = 1; i <= ult; i++) {
    if (!ws.isRowHiddenByUser(i) && String(ws.getRange(i, 10).getValue()).trim() === 'Total Mensal') {
      var p = i + 1;
      if (p <= ult && !ws.isRowHiddenByUser(p) && String(ws.getRange(p, 1).getValue()).trim() === 'Ativo') {
        ga++; linhaGrupo = i;
      }
    }
  }
  if (ga === 0) { ui.alert('Nenhum grupo aberto!'); return; }
  if (ga > 1) { ui.alert('Mais de um grupo aberto!'); return; }

  for (var i = linhaGrupo + 2; i <= ult; i++) {
    if (String(ws.getRange(i, 1).getValue()).trim() === '') break;
    if (ws.isRowHiddenByUser(i)) continue;
    processarLinha(i);
  }
  ui.alert('Grupo atualizado.');
}

// ==========================================================
// MENU PERSONALIZADO
// ==========================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📊 Controle de Operações')
    .addItem('🔄 Atualizar Grupo', 'atualizarValorAtualCrypto')
    .addSeparator()
    .addItem('🟡 Recalcular Fórmulas Binance', 'atualizarTodasCotacoesBinance')
    .addToUi();
}

// ==========================================================
// FUNÇÕES AUXILIARES
// ==========================================================

function atualizarTodasCotacoesBinance() {
  var ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CRYPTO);
  if (!ws) return;
  var f = ws.getDataRange().getFormulas(), t = 0;
  for (var r = 0; r < f.length; r++)
    for (var c = 0; c < f[r].length; c++)
      if (String(f[r][c]).toUpperCase().indexOf('OBTERCOTACAOBINANCE(') !== -1)
        { ws.getRange(r+1, c+1).setValue(f[r][c]); t++; }
  SpreadsheetApp.getUi().alert(t + ' recalculadas.');
}

function fetchBinancePrice(symbol) {
  var r = OBTERCOTACAOBINANCE(symbol);
  return typeof r === 'number' ? r : null;
}

function getLastColWithData(ws, row) {
  for (var c = ws.getLastColumn(); c >= 1; c--)
    if (ws.getRange(row, c).getValue() !== '') return c;
  return 1;
}

function atualizarViaBotao() { atualizarValorAtualCrypto(); }
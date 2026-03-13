/* ═══════════════════════════════════════════════════════════
   CONTROLE OPERAÇÕES — TEST DASHBOARD v3
   dashboardTestes.js
═══════════════════════════════════════════════════════════ */

/* ── DADOS MOCK PARA DEMONSTRAÇÃO ── */
const MOCK_BACKEND = [
  {file:'test_api_crypto',suite:'TestListarCrypto',name:'test_listar_retorna_lista_vazia_por_padrao',status:'pass',dur:8},
  {file:'test_api_crypto',suite:'TestListarCrypto',name:'test_listar_retorna_operacoes',status:'pass',dur:12},
  {file:'test_api_crypto',suite:'TestListarCrypto',name:'test_listar_multiplas_operacoes',status:'pass',dur:10},
  {file:'test_api_crypto',suite:'TestBuscarCrypto',name:'test_buscar_operacao_existente',status:'pass',dur:9},
  {file:'test_api_crypto',suite:'TestBuscarCrypto',name:'test_buscar_operacao_inexistente_retorna_404',status:'pass',dur:8},
  {file:'test_api_crypto',suite:'TestCriarCrypto',name:'test_criar_operacao_retorna_sucesso',status:'pass',dur:14},
  {file:'test_api_crypto',suite:'TestCriarCrypto',name:'test_criar_operacao_retorna_id_correto',status:'pass',dur:11},
  {file:'test_api_crypto',suite:'TestAtualizarCrypto',name:'test_atualizar_operacao_retorna_sucesso',status:'pass',dur:10},
  {file:'test_api_crypto',suite:'TestExcluirCrypto',name:'test_excluir_operacao_retorna_sucesso',status:'pass',dur:9},
  {file:'test_api_opcoes',suite:'TestListarOpcoes',name:'test_listar_retorna_lista_vazia_por_padrao',status:'pass',dur:8},
  {file:'test_api_opcoes',suite:'TestListarOpcoes',name:'test_listar_retorna_operacoes',status:'pass',dur:12},
  {file:'test_api_opcoes',suite:'TestBuscarOpcao',name:'test_buscar_opcao_existente',status:'pass',dur:9},
  {file:'test_api_opcoes',suite:'TestBuscarOpcao',name:'test_buscar_opcao_inexistente_retorna_404',status:'pass',dur:8},
  {file:'test_api_opcoes',suite:'TestCriarOpcao',name:'test_criar_opcao_retorna_sucesso',status:'pass',dur:14},
  {file:'test_api_opcoes',suite:'TestAtualizarOpcao',name:'test_atualizar_opcao_retorna_sucesso',status:'pass',dur:10},
  {file:'test_api_opcoes',suite:'TestExcluirOpcao',name:'test_excluir_opcao_retorna_sucesso',status:'pass',dur:9},
  {file:'test_api_config',suite:'TestGetConfig',name:'test_get_config_retorna_dict_vazio_padrao',status:'pass',dur:8},
  {file:'test_api_config',suite:'TestSaveConfig',name:'test_salvar_config_retorna_sucesso',status:'pass',dur:10},
  {file:'test_api_config',suite:'TestSaveIAConfig',name:'test_salvar_ia_config_retorna_sucesso',status:'pass',dur:11},
  {file:'test_api_config',suite:'TestAvailableAIs',name:'test_available_ais_retorna_estrutura_correta',status:'pass',dur:9},
  {file:'test_api_config',suite:'TestVersion',name:'test_get_version_retorna_versao',status:'pass',dur:7},
  {file:'test_api_analyze',suite:'TestAnalyzeValidacao',name:'test_sem_api_keys_retorna_400',status:'pass',dur:15},
  {file:'test_api_analyze',suite:'TestAnalyzeComMockGemini',name:'test_analyze_gemini_retorna_analise',status:'pass',dur:22},
  {file:'test_api_analyze',suite:'TestAnalyzeForceAI',name:'test_force_ai_gemini_usa_gemini',status:'pass',dur:18},
];
const MOCK_FRONTEND = [
  {file:'opcoes.spec',suite:'Opcoes',name:'[Opcoes] nao deve ter SyntaxError no JS',status:'pass',dur:1320},
  {file:'opcoes.spec',suite:'Opcoes',name:'[Opcoes] pagina deve carregar sem erros de runtime',status:'pass',dur:1450},
  {file:'opcoes.spec',suite:'Opcoes',name:'[Opcoes] tabela de operacoes deve estar visivel',status:'pass',dur:1380},
  {file:'crypto.spec',suite:'Crypto',name:'[Crypto] nao deve ter SyntaxError no JS',status:'pass',dur:1290},
  {file:'crypto.spec',suite:'Crypto',name:'[Crypto] pagina deve carregar sem erros de runtime',status:'pass',dur:1310},
];
const MOCK_OPCOES = [
  {file:'opcoes/opcoes-assets.spec',suite:'OpcoesBE',name:'[Opcoes-Assets] CSS organizados devem carregar',status:'pass',dur:900},
  {file:'opcoes/opcoes-assets.spec',suite:'OpcoesBE',name:'[Opcoes-Assets] JS do módulo opcoes 404-free',status:'pass',dur:880},
  {file:'opcoes/opcoes-assets.spec',suite:'OpcoesBE',name:'[Opcoes-Assets] GET /api/opcoes retorna JSON',status:'pass',dur:430},
  {file:'opcoes/opcoes-assets.spec',suite:'OpcoesBE',name:'[Opcoes-Assets] POST/DELETE operação de teste',status:'pass',dur:520},
];
const MOCK_CRYPTO = [
  {file:'crypto/crypto-assets.spec',suite:'CryptoBE',name:'[Crypto-Assets] CSS e JS sem 404',status:'pass',dur:870},
  {file:'crypto/crypto-assets.spec',suite:'CryptoBE',name:'[Crypto-Assets] JS crypto/ carregado',status:'pass',dur:820},
  {file:'crypto/crypto-assets.spec',suite:'CryptoBE',name:'[Crypto-Assets] GET /api/crypto retorna JSON',status:'pass',dur:410},
  {file:'crypto/crypto-assets.spec',suite:'CryptoBE',name:'[Crypto-Assets] GET /api/crypto/estrategias',status:'pass',dur:390},
  {file:'crypto/crypto-assets.spec',suite:'CryptoBE',name:'[Crypto-Assets] POST/DELETE operação de teste',status:'pass',dur:480},
  {file:'crypto/crypto-assets.spec',suite:'CryptoBE',name:'[Crypto-Assets] tipo_estrategia persistido',status:'pass',dur:500},
];

/* ── ERRO DE DEMONSTRAÇÃO (Simular Erro) ── */
const DEMO_ERROR = {
  file: 'test_api_opcoes',
  suite: 'TestCriarOpcao',
  name: 'test_criar_opcao_retorna_sucesso',
  type: 'backend',
  status: 'fail',
  dur: 45,
  errorMessage: 'AssertionError: assert 500 == 200\n  Recebido: 500\n  Esperado: 200',
  traceback: `FAILED test_api_opcoes.py::TestCriarOpcao::test_criar_opcao_retorna_sucesso
>   assert resp.status_code == 200
E   AssertionError: 500 != 200`,
  location: 'backend/tests/test_api_opcoes.py:45',
  context: `@app.route('/api/opcoes', methods=['POST'])
def create_opcoes():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT INTO operacoes_opcoes ...', (...))
    conn.close()  # BUG: commit() nao foi chamado
    return jsonify({'success': True, 'id': c.lastrowid})`
};

/* ── MAPA DE CORES DAS SUITES ── */
const suiteColors = {
  // Crypto
  TestListarCrypto: '#ffd740', TestBuscarCrypto: '#ffab40', TestCriarCrypto: '#69f0ae',
  TestAtualizarCrypto: '#40c4ff', TestExcluirCrypto: '#ff6e40',
  // Opcoes
  TestListarOpcoes: '#b388ff', TestBuscarOpcao: '#ce93d8', TestCriarOpcao: '#80cbc4',
  TestAtualizarOpcao: '#4db6ac', TestExcluirOpcao: '#ff8a65', TestRefreshOpcoes: '#a5d6a7',
  // Config e Version
  TestGetConfig: '#64b5f6', TestSaveConfig: '#90caf9', TestSaveIAConfig: '#00e5ff',
  TestAvailableAIs: '#00bcd4', TestVersion: '#b0bec5',
  // Analyze
  TestAnalyzeValidacao: '#f48fb1', TestAnalyzeComMockGemini: '#ffd740',
  TestAnalyzeForceAI: '#00e676',
  // Frontend E2E
  Opcoes: '#00d4ff', Crypto: '#ff7043',
  // Subgrupos opcoes/crypto (novos specs)
  OpcoesBE: '#26c6da', CryptoBE: '#ef5350',
  // Grupos IA
  TestGemini: '#ffd740', TestDeepSeek: '#00e676', TestGrok: '#ff7043',
  TestOpenAI: '#64b5f6', TestOpenRouter: '#00bfff',
};

/* ── ESTADO DOS GRUPOS DO SIDEBAR ── */
const groupStates = { backend: true, frontend: true, ai: true, opcoes: true, crypto: true };

function toggleGroup(type) {
  groupStates[type] = !groupStates[type];
  const body   = document.getElementById('grp-body-' + type);
  const toggle = document.querySelector('#grp-hdr-' + type + ' .grp-toggle');
  if (body)   body.classList.toggle('grp-collapsed-body', !groupStates[type]);
  if (toggle) toggle.textContent = groupStates[type] ? '\u2212' : '+';
}

function toggleGroupSelection(type) {
  const indices = allTests
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.type === type)
    .map(({ i }) => i);
  if (indices.length === 0) return;
  const allSel = indices.every(i => selectedTests.has(i));
  indices.forEach(idx => {
    const item = document.getElementById('ti-' + idx);
    if (!item) return;
    if (allSel) {
      selectedTests.delete(idx);
      item.classList.remove('checked');
      item.querySelector('.test-check').innerHTML = '';
    } else {
      selectedTests.add(idx);
      item.classList.add('checked');
      item.querySelector('.test-check').innerHTML = '&#10003;';
    }
  });
  updateSelCount();
}

/* ── ESTADO GLOBAL ── */
let allTests      = [];
let selectedTests = new Set();
let testKeyMap    = new Map();
let allSelected   = true;
let allExpanded   = true;
let evtSource     = null;
let tableUpdateTimer    = null;
let progressPanelTimer  = null;
let serverOnline        = false;
let currentErrorData    = null;  // objeto de erro atual (substitui índice)
let lastResultsMtime    = 0;     // mtime dos arquivos de resultado (para auto-refresh)
let tdmCurrentIdx       = null;  // índice do teste aberto no modal de detalhe
let lastRunIndices      = new Set(); // índices dos testes da última execução (para KPIs parciais)

/* Configurações persistentes dos testes E2E */
let tdConfig = JSON.parse(localStorage.getItem('tdConfig') || '{"e2eHeaded":false,"e2eScreenshots":"on-error","e2eCleanupAfter":false}');

/* ─────────────────────────────────────────
   UTILITÁRIOS
───────────────────────────────────────── */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Renderiza Markdown simples em HTML */
function renderMD(t) {
  return escHtml(t)
    .replace(/```[\w]*\n?([\s\S]*?)```/g,
      '<pre style="background:var(--bg);border:1px solid var(--border2);border-radius:6px;'
      + 'padding:8px 10px;overflow-x:auto;font-size:10.5px;margin:4px 0">$1</pre>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e0e7ff">$1</strong>')
    .replace(/`([^`]+)`/g,
      '<code style="background:rgba(0,212,255,.1);padding:1px 4px;border-radius:3px;'
      + 'color:var(--accent)">$1</code>')
    .replace(/^#{1,3}\s+(.+)$/gm,
      '<b style="font-size:12px;color:var(--accent);display:block;margin-top:6px">$1</b>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function getMockData() {
  return [
    ...MOCK_BACKEND.map(t => ({ ...t, type: 'backend',  errorMessage: null, traceback: null, location: null })),
    ...MOCK_FRONTEND.map(t => ({ ...t, type: 'frontend', errorMessage: null, traceback: null, location: null })),
    ...MOCK_OPCOES.map( t => ({ ...t, type: 'opcoes',   errorMessage: null, traceback: null, location: null })),
    ...MOCK_CRYPTO.map( t => ({ ...t, type: 'crypto',   errorMessage: null, traceback: null, location: null })),
  ];
}

/* ─────────────────────────────────────────
   SIDEBAR — HAMBÚRGUER / MENU DROPDOWN
───────────────────────────────────────── */
function toggleMenu() {
  const menu = document.getElementById('sbMenu');
  const ham  = document.getElementById('hamburger');
  const isOpen = menu.classList.toggle('open');
  ham.classList.toggle('open', isOpen);
}

function menuAction(action) {
  // fecha o menu
  document.getElementById('sbMenu').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');

  switch (action) {
    case 'selectAll':
      allSelected = false; toggleSelectAll(); break;

    case 'deselectAll':
      allSelected = true; toggleSelectAll(); break;

    case 'selectBE':
      allTests.forEach((_, i) => {
        const item = document.getElementById('ti-' + i);
        if (!item) return;
        if (allTests[i].type === 'backend') {
          selectedTests.add(i);
          item.classList.add('checked');
          item.querySelector('.test-check').innerHTML = '&#10003;';
        } else {
          selectedTests.delete(i);
          item.classList.remove('checked');
          item.querySelector('.test-check').innerHTML = '';
        }
      });
      updateSelCount(); break;

    case 'selectFE':
      allTests.forEach((_, i) => {
        const item = document.getElementById('ti-' + i);
        if (!item) return;
        if (allTests[i].type === 'frontend') {
          selectedTests.add(i);
          item.classList.add('checked');
          item.querySelector('.test-check').innerHTML = '&#10003;';
        } else {
          selectedTests.delete(i);
          item.classList.remove('checked');
          item.querySelector('.test-check').innerHTML = '';
        }
      });
      updateSelCount(); break;

    case 'selectAI':
      allTests.forEach((_, i) => {
        const item = document.getElementById('ti-' + i);
        if (!item) return;
        if (allTests[i].type === 'ai') {
          selectedTests.add(i);
          item.classList.add('checked');
          item.querySelector('.test-check').innerHTML = '&#10003;';
        } else {
          selectedTests.delete(i);
          item.classList.remove('checked');
          item.querySelector('.test-check').innerHTML = '';
        }
      });
      updateSelCount(); break;

    case 'selectE2E':
      allTests.forEach((_, i) => {
        const item = document.getElementById('ti-' + i);
        if (!item) return;
        if (allTests[i].type === 'e2e') {
          selectedTests.add(i);
          item.classList.add('checked');
          item.querySelector('.test-check').innerHTML = '&#10003;';
        } else {
          selectedTests.delete(i);
          item.classList.remove('checked');
          item.querySelector('.test-check').innerHTML = '';
        }
      });
      updateSelCount(); break;

    case 'testConfig':
      openTestConfigModal(); break;

    case 'expandAll':
      setAllSuites(true); allExpanded = true; updateExpandIcon(); break;

    case 'collapseAll':
      setAllSuites(false); allExpanded = false; updateExpandIcon(); break;

    case 'selectFailed':
      allTests.forEach((t, i) => {
        const item = document.getElementById('ti-' + i);
        if (!item) return;
        if (t.status === 'fail') {
          selectedTests.add(i);
          item.classList.add('checked');
          item.querySelector('.test-check').innerHTML = '&#10003;';
        } else {
          selectedTests.delete(i);
          item.classList.remove('checked');
          item.querySelector('.test-check').innerHTML = '';
        }
      });
      updateSelCount(); break;

    case 'resetWidth':
      document.getElementById('sidebar').style.width = '290px'; break;

    case 'resetDashboard':
      if (window.confirm('Zerar todos os resultados e recarregar a lista de testes?')) {
        resetDashboard();
      }
      break;
  }
}

/* ─────────────────────────────────────────
   SIDEBAR — EXPAND / RECOLHER TODOS
───────────────────────────────────────── */
function toggleExpandAll() {
  allExpanded = !allExpanded;
  setAllSuites(allExpanded);
  updateExpandIcon();
}

function updateExpandIcon() {
  const icon = document.getElementById('expandIcon');
  const btn  = document.getElementById('btnExpandAll');
  if (!icon || !btn) return;
  if (allExpanded) {
    icon.innerHTML = '<line x1="5.5" y1="1" x2="5.5" y2="10"/>'
                   + '<line x1="1" y1="5.5" x2="10" y2="5.5"/>';
    btn.title = 'Recolher todos os grupos';
  } else {
    icon.innerHTML = '<line x1="1" y1="5.5" x2="10" y2="5.5"/>';
    btn.title = 'Expandir todos os grupos';
  }
}

/* ─────────────────────────────────────────
   SIDEBAR — RESIZE (drag)
───────────────────────────────────────── */
(function initResize() {
  // aguarda DOM pronto
  document.addEventListener('DOMContentLoaded', () => {
    const handle = document.getElementById('resizeHandle');
    const sb      = document.getElementById('sidebar');
    if (!handle || !sb) return;

    let dragging = false, startX = 0, startW = 0;

    handle.addEventListener('mousedown', e => {
      dragging = true;
      startX   = e.clientX;
      startW   = sb.offsetWidth;
      handle.classList.add('active');
      document.body.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const newW = Math.min(520, Math.max(160, startW + e.clientX - startX));
      sb.style.width = newW + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      document.body.classList.remove('dragging');
    });
  });
})();

/* Fecha menu ao clicar fora */
document.addEventListener('click', e => {
  const menu = document.getElementById('sbMenu');
  const ham  = document.getElementById('hamburger');
  if (menu && ham && !ham.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.remove('open');
    ham.classList.remove('open');
  }
});

/* ─────────────────────────────────────────
   MODAL — CONFIGURAÇÕES DE TESTES E2E
───────────────────────────────────────── */
function openTestConfigModal() {
  const modal = document.getElementById('testConfigModal');
  if (!modal) return;
  // Sincroniza UI com tdConfig atual
  const chkHeaded   = document.getElementById('cfg-e2e-headed');
  const chkCleanup  = document.getElementById('cfg-e2e-cleanup');
  if (chkHeaded)  chkHeaded.checked  = tdConfig.e2eHeaded      || false;
  if (chkCleanup) chkCleanup.checked = tdConfig.e2eCleanupAfter || false;
  const radios = document.querySelectorAll('input[name="cfg-screenshots"]');
  radios.forEach(r => { r.checked = (r.value === (tdConfig.e2eScreenshots || 'on-error')); });
  modal.classList.add('open');
}

function closeTestConfigModal() {
  const modal = document.getElementById('testConfigModal');
  if (modal) modal.classList.remove('open');
}

function saveTestConfig() {
  const chkHeaded  = document.getElementById('cfg-e2e-headed');
  const chkCleanup = document.getElementById('cfg-e2e-cleanup');
  const radio      = document.querySelector('input[name="cfg-screenshots"]:checked');
  tdConfig.e2eHeaded       = chkHeaded  ? chkHeaded.checked  : false;
  tdConfig.e2eCleanupAfter = chkCleanup ? chkCleanup.checked : false;
  tdConfig.e2eScreenshots  = radio ? radio.value : 'on-error';
  localStorage.setItem('tdConfig', JSON.stringify(tdConfig));
  closeTestConfigModal();
  addLog('log-ok', '[CONFIG] Configurações E2E salvas — headed: ' + tdConfig.e2eHeaded + ', cleanup: ' + tdConfig.e2eCleanupAfter + ', screenshots: ' + tdConfig.e2eScreenshots);
}

/* ─────────────────────────────────────────
   INICIALIZAÇÃO
───────────────────────────────────────── */
async function init() {
  updateClock();
  setInterval(updateClock, 1000);
  await checkServer();
  setInterval(pollResults, 15000); // auto-refresh a cada 15s

  if (serverOnline) {
    await loadTestList();
    try {
      const r = await fetch('/api/results');
      if (!r.ok) throw new Error('no data');
      const data = await r.json();
      if (data.mtime) lastResultsMtime = data.mtime;
      if (data.tests && data.tests.length > 0) {
        const km = new Map();
        allTests.forEach((t, i) => km.set(t.type + '::' + t.suite + '::' + t.name, i));
        data.tests.forEach(t => {
          const idx = km.get(t.type + '::' + t.suite + '::' + t.name);
          if (idx !== undefined) {
            allTests[idx] = { ...allTests[idx], ...t };
          } else {
            allTests.push(t);
          }
        });
        populateDashboard({ tests: allTests, summary: data.summary || computeSummary(allTests) });
        return;
      }
    } catch {}

    if (allTests.length > 0) {
      addLog('log-info', '[INFO] ' + allTests.length + ' testes carregados. Clique Executar para resultados.');
    } else {
      allTests = [];
      addLog('log-info', '[INFO] Servidor ativo. Clique em Executar Testes para rodar os testes reais.');
    }
  } else {
    allTests = [];
    addLog('log-warn', '[AVISO] test_server.py nao detectado (execute: python tests/test_server.py).');
    addLog('log-info', '[INFO] Servidor offline — sem dados de demonstracao. Execute: python tests/test_server.py');
  }

  populateDashboard({ tests: allTests, summary: computeSummary(allTests) });
}

async function loadTestList() {
  if (!serverOnline) return;
  try {
    const r = await fetch('/api/tests', { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const d = await r.json();
      if (d.tests && d.tests.length > 0) allTests = d.tests;
    }
  } catch {}
}

/* ─────────────────────────────────────────
   AUTO-REFRESH — polling de resultados
───────────────────────────────────────── */
async function pollResults() {
  if (!serverOnline || (evtSource && evtSource.readyState === EventSource.OPEN)) return;
  try {
    const r = await fetch('/api/results/mtime', { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return;
    const { mtime } = await r.json();
    if (lastResultsMtime > 0 && mtime > lastResultsMtime) {
      await reloadResults();
    }
    if (lastResultsMtime === 0 && mtime > 0) lastResultsMtime = mtime;
  } catch {}
}

async function reloadResults() {
  try {
    const r = await fetch('/api/results', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return;
    const data = await r.json();
    if (!data.tests || data.tests.length === 0) return;
    allTests = data.tests;
    if (data.mtime) lastResultsMtime = data.mtime;
    buildTestKeyMap();
    // NÃO reseta selectedTests — preserva seleção do usuário
    buildSidebar();
    renderTable(allTests);
    renderProgressPanels(allTests);
    renderDonut(allTests);
    const s = data.summary || computeSummary(allTests);
    updateKPIs(s);
    updateHealthItems(s);
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const status = s.failed > 0 ? 'log-fail' : 'log-ok';
    addLog(status, `[AUTO] Resultados atualizados automaticamente (${now}) — ${s.passed}/${s.total} passando`);
  } catch {}
}

async function checkServer() {
  try {
    const r = await fetch('/api/results', { signal: AbortSignal.timeout(1500) });
    serverOnline = r.ok;
  } catch {
    serverOnline = false;
  }
  const badge = document.getElementById('srvBadge');
  if (serverOnline) {
    badge.className  = 'srv-status srv-ok';
    badge.textContent = '\u2699 SERVIDOR ATIVO';
  } else {
    badge.className  = 'srv-status srv-off';
    badge.textContent = '\u2699 SERVIDOR OFF';
  }
}

/* ─────────────────────────────────────────
   POPULAR DASHBOARD
───────────────────────────────────────── */
function populateDashboard(data, preserveSel = false) {
  allTests = data.tests || [];
  buildTestKeyMap();
  if (!preserveSel) {
    // Carga inicial: seleciona todos
    selectedTests = new Set(allTests.map((_, i) => i));
  }
  buildSidebar();
  renderTable(allTests);
  renderProgressPanels(allTests);
  renderDonut(allTests);
  updateKPIs(data.summary || computeSummary(allTests));
  updateHealthItems(data.summary || computeSummary(allTests));
}

function buildTestKeyMap() {
  testKeyMap.clear();
  allTests.forEach((t, i) => testKeyMap.set(makeKey(t), i));
}

function makeKey(t) {
  return t.type + '::' + t.suite + '::' + t.name;
}

/* ─────────────────────────────────────────
   SIDEBAR — LISTA DE TESTES
───────────────────────────────────────── */
function buildSidebar() {
  const scroll   = document.getElementById('sidebarScroll');
  const suiteMap = {};

  allTests.forEach((t, i) => {
    const key = t.type + '::' + t.suite;
    if (!suiteMap[key]) suiteMap[key] = { type: t.type, suite: t.suite, tests: [] };
    suiteMap[key].tests.push({ ...t, idx: i });
  });

  let html = '';
  const groups = [
    { type: 'backend',  label: '&#x1F40D; BACKEND',  color: 'var(--purple)' },
    { type: 'frontend', label: '&#x1F3AD; FRONTEND',  color: 'var(--orange)' },
    { type: 'opcoes',   label: '&#x1F4CA; OPÇÕES',    color: '#26c6da' },
    { type: 'crypto',   label: '&#x20BF; CRYPTO',     color: '#ef5350' },
    { type: 'ai',       label: '&#x1F916; IA',        color: 'var(--ai-color)' },
    { type: 'e2e',      label: '&#x1F9CD; E2E USUÁRIO', color: '#00e5a0' },
  ];

  groups.forEach(({ type: tp, label, color }) => {
    const expanded = groupStates[tp] !== false;
    // Conta testes deste grupo
    const groupTests = Object.values(suiteMap).filter(s => s.type === tp);
    if (groupTests.length === 0) return;
    const groupCount = groupTests.reduce((a, s) => a + s.tests.length, 0);

    const allSel = allTests
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.type === tp)
      .every(({ i }) => selectedTests.has(i));
    const selIndicator = allSel
      ? `<span style="font-size:9px;color:var(--green);margin-left:4px" title="Todos selecionados">☑</span>`
      : '';

    html += `<div class="grp-header" id="grp-hdr-${tp}">
      <span class="grp-toggle" onclick="toggleGroup('${tp}')" title="Expandir/recolher">${expanded ? '\u2212' : '+'}</span>
      <span class="grp-label" style="color:${color}" onclick="toggleGroupSelection('${tp}')" title="Marcar/desmarcar todos do grupo">${label} <span style="font-size:9px;color:var(--muted);letter-spacing:0;font-weight:400">(${groupCount})</span>${selIndicator}</span>
    </div>`;
    html += `<div id="grp-body-${tp}" ${expanded ? '' : 'class="grp-collapsed-body"'}>`;

    groupTests.forEach(s => {
      const c      = suiteColors[s.suite] || '#4a5568';
      const safeId = s.suite.replace(/[^a-zA-Z0-9_-]/g, '_');
      html += `<div class="suite-group open" id="sg-${safeId}">
        <div class="suite-header">
          <div class="suite-dot" style="background:${c}"></div>
          <span class="suite-name-lbl" onclick="toggleSuiteSelection('${safeId}')" title="Marcar/desmarcar grupo">${s.suite}</span>
          <span class="gcnt">${s.tests.length}</span>
        </div>
        <div class="suite-tests">`;

      s.tests.forEach(t => {
        const dotCls = t.status === 'pass' ? 'pass' : t.status === 'fail' ? 'fail' : '';
        const chk    = selectedTests.has(t.idx) ? 'checked' : '';
        html += `<div class="test-item ${chk}" id="ti-${t.idx}" onclick="openTestDetail(${t.idx})">
          <div class="test-check" onclick="toggleTest(${t.idx});event.stopPropagation()">${selectedTests.has(t.idx) ? '&#10003;' : ''}</div>
          <div class="test-name" title="${t.name}">${t.name}</div>
          <div class="tsd ${dotCls}" id="tsd-${t.idx}"></div>
        </div>`;
      });
      html += `</div></div>`;  // fecha suite-tests e suite-group sem seta de toggle

    });

    html += `</div>`; // fecha grp-body
  });

  scroll.innerHTML = html;
  updateSelCount();
}

function toggleSuite(n) {
  const el = document.getElementById('sg-' + n);
  if (el) el.classList.toggle('open');
}

function toggleSuiteSelection(safeId) {
  const group = document.getElementById('sg-' + safeId);
  if (!group) return;
  const items  = group.querySelectorAll('.test-item');
  const allSel = [...items].every(item => item.classList.contains('checked'));
  items.forEach(item => {
    const idx = parseInt(item.id.replace('ti-', ''));
    if (allSel) {
      selectedTests.delete(idx);
      item.classList.remove('checked');
      item.querySelector('.test-check').innerHTML = '';
    } else {
      selectedTests.add(idx);
      item.classList.add('checked');
      item.querySelector('.test-check').innerHTML = '&#10003;';
    }
  });
  updateSelCount();
}

function toggleTest(idx) {
  const item = document.getElementById('ti-' + idx);
  if (selectedTests.has(idx)) {
    selectedTests.delete(idx);
    item.classList.remove('checked');
    item.querySelector('.test-check').innerHTML = '';
  } else {
    selectedTests.add(idx);
    item.classList.add('checked');
    item.querySelector('.test-check').innerHTML = '&#10003;';
  }
  updateSelCount();
}

function toggleSelectAll() {
  allSelected = !allSelected;
  allTests.forEach((_, i) => {
    const item = document.getElementById('ti-' + i);
    if (!item) return;
    if (allSelected) {
      selectedTests.add(i);
      item.classList.add('checked');
      item.querySelector('.test-check').innerHTML = '&#10003;';
    } else {
      selectedTests.delete(i);
      item.classList.remove('checked');
      item.querySelector('.test-check').innerHTML = '';
    }
  });
  const txt = document.getElementById('btnSelAllTxt');
  if (txt) txt.textContent = allSelected ? 'Desmarcar' : 'Marcar';
  updateSelCount();
}

function updateSelCount() {
  const total = allTests.length;
  const sel   = selectedTests.size;

  // contador X/Y no sidebar
  const selCount = document.getElementById('selCount');
  if (selCount) selCount.textContent = sel + '/' + total;

  // legenda no rodapé
  const runStatus = document.getElementById('runStatus');
  if (runStatus) {
    runStatus.textContent = total > 0 && sel < total
      ? sel + ' de ' + total + ' selecionados'
      : sel + ' testes selecionados';
  }

  // aviso de nenhum selecionado
  const warn = document.getElementById('noSelWarn');
  if (warn) warn.classList.toggle('show', sel === 0 && total > 0);
}

/* ─────────────────────────────────────────
   RESET / EXECUTAR
───────────────────────────────────────── */
function resetKPIsOnly() {
  ['kpi-total','kpi-pass','kpi-fail','kpi-dur'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '\u2014';
  });
  const el = document.getElementById('kpi-sub-total');
  if (el) el.textContent = 'iniciando...';
  ['kpi-sub-pass','kpi-sub-fail'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.textContent = '\u2014';
  });
  document.getElementById('runProgressBar').style.width = '0%';

  const beEl = document.getElementById('be-panel-body');
  if (beEl) beEl.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:16px 0">Aguardando execu\u00e7\u00e3o...</div>';
  const feEl = document.getElementById('fe-panel-body');
  if (feEl) feEl.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:16px 0">Aguardando execu\u00e7\u00e3o...</div>';
  const aiPanelEl = document.getElementById('ai-panel-body');
  if (aiPanelEl) aiPanelEl.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:16px 0">Aguardando execu\u00e7\u00e3o...</div>';

  document.getElementById('testTableBody').innerHTML = '';
  updateGauge(0);

  // Reset health card
  hcSetRing('hc-ring-be', 452, 0);
  hcSetRing('hc-ring-fe', 371, 0);
  hcSetRing('hc-ring-hl', 289, 0);
  const hcPct = document.getElementById('hc-ring-pct');
  if (hcPct) { hcPct.textContent = '0%'; hcPct.setAttribute('fill', '#4a5568'); }
  ['hc-leg-be','hc-leg-fe','hc-leg-hl'].forEach(id => { const e = document.getElementById(id); if (e) { e.textContent = '0%'; e.style.color = ''; } });
  ['hc-m-cov','hc-m-rel','hc-m-spd','hc-m-stab','hc-m-score'].forEach(id => { const e = document.getElementById(id); if (e) { e.textContent = '\u2014'; e.style.color = ''; } });
  ['hc-b-cov','hc-b-rel','hc-b-spd','hc-b-stab','hc-b-score'].forEach(id => { const e = document.getElementById(id); if (e) e.style.width = '0%'; });
  ['hc-d-cov','hc-d-rel','hc-d-spd','hc-d-stab','hc-d-score'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = 'aguardando'; });
  const hcHmap = document.getElementById('hc-hmap-grid'); if (hcHmap) hcHmap.innerHTML = '';
  const hcTl   = document.getElementById('hc-tl-rows');   if (hcTl)   hcTl.innerHTML   = '';
  const hcBd   = document.getElementById('hc-bd-rows');   if (hcBd)   hcBd.innerHTML   = '';
  const hcCnt  = document.getElementById('hc-hmap-count'); if (hcCnt)  hcCnt.textContent = '0 / 0';
  const pillTxt = document.getElementById('hc-pill-txt'); if (pillTxt) pillTxt.textContent = 'AGUARDANDO';
  const pillDot = document.getElementById('hc-pill-dot'); if (pillDot) pillDot.style.background = 'var(--muted)';

  const kh = document.getElementById('kpi-health');
  if (kh) { kh.textContent = '\u2014'; kh.style.color = 'var(--muted)'; }
}

function resetForNewRun() { resetKPIsOnly(); }

async function resetDashboard() {
  if (evtSource) { evtSource.close(); evtSource = null; }
  allTests = []; testKeyMap.clear(); selectedTests = new Set();
  document.getElementById('sidebarScroll').innerHTML = '';
  resetKPIsOnly();
  clearLog();
  addLog('log-info', '[INFO] Zerado. Recarregando lista de testes...');
  await loadTestList();
  if (allTests.length === 0) addLog('log-info', '[INFO] Nenhum resultado encontrado. Execute os testes para carregar os dados.');
  buildTestKeyMap();
  selectedTests = new Set(allTests.map((_, i) => i));
  buildSidebar();
  document.getElementById('runStatus').textContent = allTests.length + ' testes selecionados';
  addLog('log-info', '[INFO] Lista recarregada: ' + allTests.length + ' testes.');
}

function runTests() {
  if (selectedTests.size === 0) {
    const warn = document.getElementById('noSelWarn');
    if (warn) { warn.classList.add('show'); setTimeout(() => warn.classList.remove('show'), 4000); }
    addLog('log-warn', '[AVISO] Nenhum teste selecionado. Selecione ao menos um teste para executar.');
    return;
  }
  if (evtSource) return;
  // Registra quais testes serão executados (para KPIs parciais)
  lastRunIndices = new Set(selectedTests);
  resetKPIsOnly();
  const btn = document.getElementById('runBtn');
  btn.classList.add('running');
  btn.textContent = '\u23F3 Executando...';
  clearLog();
  if (serverOnline) {
    runTestsSSE();
  } else {
    addLog('log-warn', '[AVISO] Servidor offline — simulando execucao...');
    runTestsSimulated();
  }
}

function runTestsSSE() {
  allTests.forEach((t, i) => {
    t.status = selectedTests.has(i) ? 'running' : 'skip';
    const dot = document.getElementById('tsd-' + i);
    if (dot) dot.className = 'tsd ' + (selectedTests.has(i) ? 'running' : '');
  });
  renderTable(allTests);
  document.getElementById('runProgressBar').style.width = '0%';
  document.getElementById('runStatus').textContent = 'Aguardando servidor...';

  const _p   = new URLSearchParams();
  const isFE = t => ['frontend','opcoes','crypto'].includes(t.type);
  const _abe  = allTests.filter(t => t.type === 'backend');
  const _afe  = allTests.filter(t => isFE(t));
  const _aai  = allTests.filter(t => t.type === 'ai');
  const _ae2e = allTests.filter(t => t.type === 'e2e');
  const _sbe  = allTests.filter((t, i) => t.type === 'backend' && selectedTests.has(i));
  const _sfe  = allTests.filter((t, i) => isFE(t) && selectedTests.has(i));
  const _sai  = allTests.filter((t, i) => t.type === 'ai' && selectedTests.has(i));
  const _se2e = allTests.filter((t, i) => t.type === 'e2e' && selectedTests.has(i));

  if (_sbe.length === 0) {
    _p.set('skip_be', '1');
  } else if (_sbe.length < _abe.length) {
    _p.set('be_nodes', _sbe.map(t => 'backend/tests/' + t.file + '.py::' + t.suite + '::' + t.name).join('|'));
  }
  if (_sfe.length === 0) {
    _p.set('skip_fe', '1');
  } else if (_sfe.length < _afe.length) {
    _p.set('fe_grep', _sfe.map(t => t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
  }
  if (_sai.length === 0) {
    _p.set('skip_ai', '1');
  } else if (_sai.length < _aai.length) {
    _p.set('ai_nodes', _sai.map(t => 'backend/tests/test_ai_providers.py::' + t.suite + '::' + t.name).join('|'));
  }
  // E2E: por padrão skip_e2e=1; só roda se houver testes E2E selecionados
  if (_ae2e.length === 0 || _se2e.length === 0) {
    _p.set('skip_e2e', '1');
  } else {
    _p.set('skip_e2e', '0');
    if (_se2e.length < _ae2e.length) {
      _p.set('e2e_grep', _se2e.map(t => t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
    }
    // Passa configurações de headless/screenshots/cleanup
    if (tdConfig.e2eHeaded)        _p.set('e2e_headed',        '1');
    if (tdConfig.e2eScreenshots)   _p.set('e2e_screenshots',   tdConfig.e2eScreenshots);
    if (tdConfig.e2eCleanupAfter)  _p.set('e2e_cleanup_after', '1');
  }

  evtSource = new EventSource('/api/stream?' + _p.toString());

  evtSource.addEventListener('log', e => {
    const d   = JSON.parse(e.data);
    const cls = d.type === 'ok' ? 'log-ok' : d.type === 'fail' ? 'log-fail' : d.type === 'warn' ? 'log-warn' : 'log-info';
    addLog(cls, d.msg);
  });

  evtSource.addEventListener('test', e => {
    const t   = JSON.parse(e.data);
    const key = makeKey(t);
    let idx   = testKeyMap.get(key);
    if (idx === undefined) {
      allTests.push({ ...t });
      idx = allTests.length - 1;
      testKeyMap.set(key, idx);
      selectedTests.add(idx);
    } else {
      allTests[idx] = { ...allTests[idx], ...t };
    }
    const dot    = document.getElementById('tsd-' + idx);
    if (dot) dot.className = 'tsd ' + (t.status === 'pass' ? 'pass' : 'fail');
    const done   = allTests.filter(x => x.status === 'pass' || x.status === 'fail').length;
    const total  = allTests.length;
    const passed = allTests.filter(x => x.status === 'pass').length;
    const failed = allTests.filter(x => x.status === 'fail').length;
    const pct    = Math.round(done / total * 100);
    document.getElementById('runProgressBar').style.width = pct + '%';
    document.getElementById('runStatus').textContent = 'Executando... ' + done + '/' + total;
    document.getElementById('kpi-pass').textContent = passed;
    document.getElementById('kpi-fail').textContent = failed;
    updateGauge(total > 0 ? Math.round(passed / total * 100) : 0);
    scheduleProgressPanelUpdate();
    scheduleHealthCardUpdate();
    scheduleTableUpdate();
  });

  evtSource.addEventListener('test_detail', e => {
    const d   = JSON.parse(e.data);
    const idx = testKeyMap.get(makeKey(d));
    if (idx !== undefined) {
      allTests[idx] = { ...allTests[idx], errorMessage: d.errorMessage, traceback: d.traceback, location: d.location };
    }
  });

  evtSource.addEventListener('complete', e => {
    const data = JSON.parse(e.data);
    if (!data.error && data.tests) {
      // Merge: atualiza apenas os testes que rodaram, mantém todos os demais
      data.tests.forEach(t => {
        const idx = testKeyMap.get(makeKey(t));
        if (idx !== undefined) {
          allTests[idx] = { ...allTests[idx], ...t };
        }
        // Não adiciona novos testes aqui — evitar duplicatas
      });
      buildTestKeyMap();
    }
    finishRun(data);
  });

  evtSource.onerror = () => {
    addLog('log-fail', '[ERRO] Conexao SSE perdida. Verifique se test_server.py esta rodando.');
    finishRun({ error: 'connection_lost' });
  };
}

function runTestsSimulated() {
  const list  = [...selectedTests].map(i => allTests[i]);
  const total = list.length;
  let done    = 0;

  allTests.forEach((_, i) => {
    const dot = document.getElementById('tsd-' + i);
    if (dot) dot.className = 'tsd';
  });
  renderTable(allTests.map((t, i) => ({ ...t, status: selectedTests.has(i) ? 'running' : 'skip' })));

  let delay = 600;
  list.forEach(t => {
    const origIdx = allTests.indexOf(t);
    setTimeout(() => {
      done++;
      const pct = Math.round(done / total * 100);
      document.getElementById('runProgressBar').style.width = pct + '%';
      document.getElementById('runStatus').textContent = 'Executando... ' + done + '/' + total;
      const dot = document.getElementById('tsd-' + origIdx);
      if (dot) dot.className = 'tsd pass';
      document.getElementById('kpi-pass').textContent = done;
      updateGauge(pct);
      if (done % 10 === 0 || done === total)
        addLog('log-ok', '[PASS] ' + t.suite + ' :: ' + t.name.slice(0, 55) + (t.name.length > 55 ? '...' : ''));
      if (done === total) {
        renderTable(allTests);
        finishRun({ summary: computeSummary(allTests) });
      }
    }, delay);
    delay += Math.random() * 35 + 12;
  });
}

function scheduleTableUpdate() {
  if (tableUpdateTimer) return;
  tableUpdateTimer = setTimeout(() => { renderTable(allTests); tableUpdateTimer = null; }, 150);
}

function scheduleProgressPanelUpdate() {
  if (progressPanelTimer) return;
  progressPanelTimer = setTimeout(() => { renderProgressPanels(allTests); progressPanelTimer = null; }, 300);
}

function finishRun(data) {
  if (evtSource) { evtSource.close(); evtSource = null; }
  const btn = document.getElementById('runBtn');
  btn.classList.remove('running');
  btn.textContent = '\u25B6 Executar Testes';
  // KPIs: usa somente os testes que foram executados nesta rodada
  const runTests = lastRunIndices.size > 0
    ? allTests.filter((_, i) => lastRunIndices.has(i))
    : allTests;
  const s = lastRunIndices.size > 0
    ? computeSummary(runTests)
    : ((data && !data.error && data.summary) ? data.summary : computeSummary(allTests));
  document.getElementById('runProgressBar').style.width = '100%';
  document.getElementById('runStatus').textContent = '\u2713 ' + (s.total || 0) + ' testes concluidos';
  updateKPIs(s);
  updateHealthItems(s);
  renderProgressPanels(allTests);
  renderDonut(allTests);
  renderTable(allTests);
  buildSidebar();
}

/* ─────────────────────────────────────────
   KPIs / GAUGE / HEALTH
───────────────────────────────────────── */
function updateKPIs(s) {
  if (!s) return;
  const total = s.total   || 0;
  const passed = s.passed || 0;
  const failed = s.failed || 0;

  const kpiFailCard = document.getElementById('kpi-fail')?.closest('.kpi-card');
  if (kpiFailCard) {
    if (failed > 0) {
      kpiFailCard.classList.add('kpi-clickable');
      kpiFailCard.setAttribute('onclick', 'openFailsModal()');
      kpiFailCard.title = 'Clique para ver lista de falhas';
    } else {
      kpiFailCard.classList.remove('kpi-clickable');
      kpiFailCard.removeAttribute('onclick');
      kpiFailCard.title = '';
    }
  }

  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-pass').textContent  = passed;
  document.getElementById('kpi-fail').textContent  = failed;
  document.getElementById('kpi-dur').textContent   = (s.duration || 0) + 's';
  const aiC = s.ai_count || 0;
  document.getElementById('kpi-sub-total').textContent = (s.be_count || 0) + ' backend + ' + (s.fe_count || 0) + ' frontend' + (aiC > 0 ? ' + ' + aiC + ' IA' : '');
  document.getElementById('kpi-sub-pass').textContent  = total > 0 ? Math.round(passed / total * 100) + '% aprovacao' : '---';
  document.getElementById('kpi-sub-fail').textContent  = failed === 0 ? 'Nenhuma falha' : failed + ' falha' + (failed > 1 ? 's' : '');

  updateGauge(total > 0 ? Math.round(passed / total * 100) : 0);

  const bePassed = s.be_pass !== undefined ? s.be_pass : (s.be_count || 0) - (s.be_fail || 0);
  const fePassed = s.fe_pass !== undefined ? s.fe_pass : (s.fe_count || 0) - (s.fe_fail || 0);
  const aiPassed = s.ai_pass !== undefined ? s.ai_pass : (s.ai_count || 0) - (s.ai_fail || 0);
  const beEl = document.getElementById('be-badge');
  const feEl = document.getElementById('fe-badge');
  const aiEl = document.getElementById('ai-badge');
  if (beEl) { beEl.textContent = bePassed + ' / ' + (s.be_count || 0) + ' ' + ((s.be_fail || 0) > 0 ? 'FALHOU' : 'PASSOU'); beEl.className = 'pbadge ' + ((s.be_fail || 0) > 0 ? 'pbadge-r' : 'pbadge-g'); }
  if (feEl) { feEl.textContent = fePassed + ' / ' + (s.fe_count || 0) + ' ' + ((s.fe_fail || 0) > 0 ? 'FALHOU' : 'PASSOU'); feEl.className = 'pbadge ' + ((s.fe_fail || 0) > 0 ? 'pbadge-r' : 'pbadge-g'); }
  if (aiEl) { aiEl.textContent = aiPassed + ' / ' + (s.ai_count || 0) + ' ' + ((s.ai_fail || 0) > 0 ? 'FALHOU' : 'PASSOU'); aiEl.className = 'pbadge ' + ((s.ai_fail || 0) > 0 ? 'pbadge-r' : 'pbadge-ai'); }
}

function updateGauge(pct) {
  // Nota: gaugeArc/gaugeText foram substituidos pelo health card completo
  // Apenas atualiza o kpi-health
  const kh = document.getElementById('kpi-health');
  if (kh) {
    kh.textContent = pct + '%';
    kh.style.color = pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)';
  }
}

function updateHealthItems(s) {
  // Elementos simples de saúde foram substituídos pelo health card completo
  updateHealthCard(s, allTests);
}

/* ───────────────────────────────────────────
   HEALTH CARD COMPLETO (15.html fusion)
─────────────────────────────────────────── */
function hcSetRing(id, circum, pct) {
  const el = document.getElementById(id);
  if (el) el.style.strokeDashoffset = circum * (1 - pct / 100);
}

function hcSetMetric(valId, val, barId, pct, subId, sub, color) {
  const v = document.getElementById(valId);
  if (v) { v.textContent = val; if (color) v.style.color = color; }
  const b = document.getElementById(barId);
  if (b) b.style.width = Math.min(100, Math.max(0, pct)) + '%';
  if (subId && sub !== undefined) { const s = document.getElementById(subId); if (s) s.textContent = sub; }
}

/* Categorias para o Breakdown */
const HC_CATEGORIES = [
  { id: 'crypto', icon: '\uD83D\uDCB0', label: 'Crypto',         fn: t => /crypto/i.test(t.file) },
  { id: 'opcoes', icon: '\uD83D\uDCC8', label: 'Op\u00e7\u00f5es',        fn: t => /opcoes/i.test(t.file) && t.type !== 'ai' },
  { id: 'config', icon: '\u2699',       label: 'Config/Version', fn: t => /config|version/i.test(t.file) },
  { id: 'analyz', icon: '\uD83E\uDD16', label: 'Analyze/IA',     fn: t => /analyze/i.test(t.file) },
  { id: 'front',  icon: '\uD83C\uDF10', label: 'Frontend',       fn: t => t.type === 'frontend' },
  { id: 'ia',     icon: '\uD83E\uDDE0', label: 'IA Providers',   fn: t => t.type === 'ai' },
];

function buildBreakdown(tests) {
  const container = document.getElementById('hc-bd-rows');
  if (!container) return;
  container.innerHTML = HC_CATEGORIES.map(cat => {
    const catT   = tests.filter(cat.fn);
    const done   = catT.filter(t => t.status === 'pass' || t.status === 'fail').length;
    const passed = catT.filter(t => t.status === 'pass').length;
    const pct    = done > 0 ? Math.round(passed / done * 100) : (catT.length > 0 ? 0 : null);
    const color  = pct === null ? 'var(--muted)' : pct >= 100 ? 'var(--green)' : pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
    const trend  = pct === null ? '\u00B7' : pct >= 100 ? '\u2191' : pct === 0 ? '\u2193' : '\u2014';
    const tcolor = pct === null ? 'var(--muted)' : pct >= 100 ? 'var(--green)' : pct === 0 ? 'var(--red)' : 'var(--yellow)';
    const sub    = catT.length === 0 ? 'sem testes' : `${done}/${catT.length} executados`;
    const pctTxt = pct === null ? '\u2014' : pct + '%';
    return `<div class="hc-bd-row">
      <div class="hc-bd-icon">${cat.icon}</div>
      <div class="hc-bd-info">
        <div class="hc-bd-label">${cat.label}</div>
        <div class="hc-bd-track"><div class="hc-bd-fill" style="width:${pct || 0}%;background:${color}"></div></div>
        <div class="hc-bd-sub">${sub}</div>
      </div>
      <div class="hc-bd-right">
        <div class="hc-bd-pct" style="color:${color}">${pctTxt}</div>
        <div class="hc-bd-trend" style="color:${tcolor}">${trend}</div>
      </div>
    </div>`;
  }).join('');
}

function buildHealthHeatmap(tests) {
  const grid = document.getElementById('hc-hmap-grid');
  if (!grid) return;
  grid.innerHTML = '';
  tests.forEach((t, i) => {
    const cell = document.createElement('div');
    const st   = t.status === 'pass' ? 'pass' : t.status === 'fail' ? 'fail' : t.status === 'running' ? 'running' : 'skip';
    cell.className = 'hc-hcell ' + st;
    cell.title     = t.suite + ' :: ' + t.name;
    if (t.status === 'fail') {
      cell.setAttribute('data-tip', '⚠ ' + t.suite + '::' + t.name.slice(0, 22));
      cell.addEventListener('click', () => openErrorModal(i));
    }
    grid.appendChild(cell);
  });
  const done = tests.filter(x => x.status === 'pass' || x.status === 'fail').length;
  const cnt  = document.getElementById('hc-hmap-count');
  if (cnt) cnt.textContent = done + ' / ' + tests.length;
}

function buildHealthTimeline(tests) {
  const container = document.getElementById('hc-tl-rows');
  if (!container) return;
  const suiteMap = {};
  tests.forEach(t => {
    if (!suiteMap[t.suite]) suiteMap[t.suite] = { pass: 0, fail: 0, total: 0 };
    suiteMap[t.suite].total++;
    if (t.status === 'pass') suiteMap[t.suite].pass++;
    if (t.status === 'fail') suiteMap[t.suite].fail++;
  });
  container.innerHTML = Object.entries(suiteMap).map(([name, s]) => {
    const run = s.pass + s.fail;
    const pp  = s.total ? Math.round(s.pass / s.total * 100) : 0;
    const fp  = s.total ? Math.round(s.fail / s.total * 100) : 0;
    const pct = s.total ? Math.round(run / s.total * 100) : 0;
    return `<div class="hc-tl-row">
      <div class="hc-tl-lbl" title="${escHtml(name)}">${escHtml(name)}</div>
      <div class="hc-tl-track">
        <div class="hc-tl-pass" style="width:${pp}%"></div>
        <div class="hc-tl-fail" style="width:${fp}%"></div>
      </div>
      <div class="hc-tl-pct">${pct}%</div>
      <div class="hc-tl-cnt">${run}/${s.total}</div>
    </div>`;
  }).join('');
}

function updateHealthCard(s, tests) {
  if (!s || !tests) return;
  const total  = tests.length;
  const done   = tests.filter(t => t.status === 'pass' || t.status === 'fail').length;
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  const beT    = tests.filter(t => t.type === 'backend');
  const feT    = tests.filter(t => t.type === 'frontend');
  const beRun  = beT.filter(t => t.status === 'pass' || t.status === 'fail').length;
  const feRun  = feT.filter(t => t.status === 'pass' || t.status === 'fail').length;
  const bePass = beT.filter(t => t.status === 'pass').length;
  const fePass = feT.filter(t => t.status === 'pass').length;
  const beRate = beRun ? Math.round(bePass / beRun * 100) : 0;
  const feRate = feRun ? Math.round(fePass / feRun * 100) : 0;
  const health = done  ? Math.round(passed / done * 100) : 0;
  const cov    = total ? Math.round(done / total * 100) : 0;
  const rel    = done  ? Math.round(passed / done * 100) : 0;
  const durMs  = (s.duration || 0) * 1000;
  const avgMs  = done > 0 ? Math.round(durMs / done) : 0;
  const velScore = Math.min(100, Math.max(0, 100 - avgMs * 0.5));
  const stab   = Math.max(0, 100 - failed * 20);
  const score  = done ? Math.round(rel * .4 + velScore * .3 + stab * .3) : 0;

  // Rings
  hcSetRing('hc-ring-be', 452, beRate);
  hcSetRing('hc-ring-fe', 371, feRate);
  hcSetRing('hc-ring-hl', 289, health);
  const pctEl = document.getElementById('hc-ring-pct');
  if (pctEl) {
    pctEl.textContent = health + '%';
    pctEl.setAttribute('fill', health > 80 ? '#00e676' : health > 50 ? '#ffc107' : '#ff3d57');
  }
  const legBE = document.getElementById('hc-leg-be');
  const legFE = document.getElementById('hc-leg-fe');
  const legHL = document.getElementById('hc-leg-hl');
  if (legBE) { legBE.textContent = beRate + '%'; legBE.style.color = beRate > 80 ? '#00d084' : beRate > 50 ? '#ffc107' : '#ff3d57'; }
  if (legFE) { legFE.textContent = feRate + '%'; legFE.style.color = feRate > 80 ? '#00b8d9' : '#ffc107'; }
  if (legHL) { legHL.textContent = health + '%'; legHL.style.color = health > 80 ? '#a78bfa' : health > 50 ? '#ffc107' : '#ff3d57'; }

  // Metrics
  hcSetMetric('hc-m-cov', cov + '%', 'hc-b-cov', cov, 'hc-d-cov',
    done + ' / ' + total + ' executados',
    cov > 80 ? 'var(--accent)' : 'var(--yellow)');
  hcSetMetric('hc-m-rel', passed > 0 ? rel + '%' : '\u2014', 'hc-b-rel', rel, 'hc-d-rel',
    done > 0 ? passed + ' passou \u00b7 ' + failed + ' falhou' : 'aguardando',
    rel < 80 ? 'var(--red)' : rel < 95 ? 'var(--yellow)' : 'var(--green)');
  hcSetMetric('hc-m-spd', avgMs > 0 ? avgMs + 'ms' : '\u2014', 'hc-b-spd',
    Math.max(0, 100 - avgMs * 0.5), 'hc-d-spd',
    avgMs > 0 ? 'media ' + avgMs + 'ms' : 'aguardando',
    'var(--accent)');
  hcSetMetric('hc-m-stab', done > 0 ? stab + '%' : '\u2014', 'hc-b-stab', stab, 'hc-d-stab',
    failed === 0 ? 'sem falhas' : failed + ' falha(s)',
    failed > 0 ? 'var(--red)' : 'var(--yellow)');
  hcSetMetric('hc-m-score', score > 0 ? score : '\u2014', 'hc-b-score', score, 'hc-d-score',
    score > 0 ? 'Conf:' + rel + '% \u00b7 Vel:' + Math.round(velScore) + '% \u00b7 Estab:' + stab + '%' : 'indice combinado',
    score > 80 ? 'var(--green)' : score > 50 ? 'var(--yellow)' : (score > 0 ? 'var(--red)' : 'var(--muted)'));

  // Pill
  const pillEl  = document.getElementById('hc-main-pill');
  const pillDot = document.getElementById('hc-pill-dot');
  const pillTxt = document.getElementById('hc-pill-txt');
  if (pillEl && pillDot && pillTxt) {
    const running = tests.some(t => t.status === 'running');
    if (running) {
      pillEl.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:9px;font-weight:700;letter-spacing:.06em;padding:3px 9px;border-radius:20px;font-family:JetBrains Mono,monospace;transition:all .3s;border:1px solid rgba(0,212,255,.2);background:rgba(0,212,255,.06);color:var(--accent)';
      pillDot.style.background = 'var(--accent)';
      pillTxt.textContent = 'EXECUTANDO';
    } else if (failed > 0) {
      pillEl.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:9px;font-weight:700;letter-spacing:.06em;padding:3px 9px;border-radius:20px;font-family:JetBrains Mono,monospace;transition:all .3s;border:1px solid rgba(255,61,87,.25);background:rgba(255,61,87,.06);color:var(--red)';
      pillDot.style.background = 'var(--red)';
      pillTxt.textContent = '\u26A0 COM FALHA';
    } else if (done > 0) {
      pillEl.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:9px;font-weight:700;letter-spacing:.06em;padding:3px 9px;border-radius:20px;font-family:JetBrains Mono,monospace;transition:all .3s;border:1px solid rgba(0,230,118,.2);background:rgba(0,230,118,.06);color:var(--green)';
      pillDot.style.background = 'var(--green)';
      pillTxt.textContent = '\u2713 PASSOU';
    } else {
      pillEl.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:9px;font-weight:700;letter-spacing:.06em;padding:3px 9px;border-radius:20px;font-family:JetBrains Mono,monospace;transition:all .3s;border:1px solid rgba(90,106,138,.2);background:rgba(90,106,138,.06);color:var(--muted)';
      pillDot.style.background = 'var(--muted)';
      pillTxt.textContent = 'AGUARDANDO';
    }
  }

  // Heatmap + Timeline + Breakdown
  buildHealthHeatmap(tests);
  buildHealthTimeline(tests);
  buildBreakdown(tests);
}

let hcUpdateTimer = null;
function scheduleHealthCardUpdate() {
  if (hcUpdateTimer) return;
  hcUpdateTimer = setTimeout(() => {
    updateHealthCard(computeSummary(allTests), allTests);
    hcUpdateTimer = null;
  }, 400);
}

function computeSummary(tests) {
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  const total  = tests.length;
  const beT    = tests.filter(t => t.type === 'backend');
  const feT    = tests.filter(t => t.type === 'frontend');
  const aiT    = tests.filter(t => t.type === 'ai');
  return {
    total, passed, failed,
    health:   total > 0 ? Math.round(passed / total * 100) : 0,
    duration: Math.round(tests.reduce((a, t) => a + (t.dur || 0), 0) / 1000),
    be_count: beT.length, fe_count: feT.length, ai_count: aiT.length,
    be_pass: beT.filter(t => t.status === 'pass').length,
    be_fail: beT.filter(t => t.status === 'fail').length,
    fe_pass: feT.filter(t => t.status === 'pass').length,
    fe_fail: feT.filter(t => t.status === 'fail').length,
    ai_pass: aiT.filter(t => t.status === 'pass').length,
    ai_fail: aiT.filter(t => t.status === 'fail').length,
  };
}

/* ─────────────────────────────────────────
   PAINÉIS DE PROGRESSO
───────────────────────────────────────── */
function renderProgressPanels(tests) {
  // ── Backend
  const beMap = {};
  tests.filter(t => t.type === 'backend').forEach(t => {
    if (!beMap[t.suite]) beMap[t.suite] = { pass: 0, fail: 0, total: 0 };
    beMap[t.suite].total++;
    if (t.status === 'pass') beMap[t.suite].pass++;
    if (t.status === 'fail') beMap[t.suite].fail++;
  });
  const beEl = document.getElementById('be-panel-body');
  if (beEl) {
    beEl.innerHTML = Object.entries(beMap).map(([suite, s]) => {
      const pct    = s.total > 0 ? Math.round(s.pass / s.total * 100) : 0;
      const hasRun = (s.pass + s.fail) > 0;
      const cls    = !hasRun ? 'prog-fill-pending' : (s.pass === s.total ? 'prog-fill-g' : 'prog-fill-r');
      const fillW  = !hasRun ? 100 : pct;
      return `<div class="prog-wrap"><div class="prog-label"><span>${suite}</span><span>${hasRun ? s.pass + '/' + s.total : '\u2014'}</span></div><div class="prog-track"><div class="prog-fill ${cls}" style="width:${fillW}%"></div></div></div>`;
    }).join('') || '<div style="color:var(--muted);font-size:11px;text-align:center;padding:16px 0">Sem dados de backend</div>';
  }

  // ── Frontend
  const feMap = {};
  tests.filter(t => t.type === 'frontend').forEach(t => {
    const key = t.file + ' > ' + t.suite;
    if (!feMap[key]) feMap[key] = { pass: 0, fail: 0, total: 0 };
    feMap[key].total++;
    if (t.status === 'pass') feMap[key].pass++;
    if (t.status === 'fail') feMap[key].fail++;
  });
  const feEl = document.getElementById('fe-panel-body');
  if (feEl) {
    feEl.innerHTML = Object.entries(feMap).map(([suite, s]) => {
      const pct    = s.total > 0 ? Math.round(s.pass / s.total * 100) : 0;
      const hasRun = (s.pass + s.fail) > 0;
      const cls    = !hasRun ? 'prog-fill-pending' : (s.pass === s.total ? 'prog-fill-b' : 'prog-fill-r');
      const fillW  = !hasRun ? 100 : pct;
      return `<div class="prog-wrap"><div class="prog-label"><span>${suite}</span><span>${hasRun ? s.pass + '/' + s.total : '\u2014'}</span></div><div class="prog-track"><div class="prog-fill ${cls}" style="width:${fillW}%"></div></div></div>`;
    }).join('') || '<div style="color:var(--muted);font-size:11px;text-align:center;padding:16px 0">Sem dados de frontend</div>';
  }

  // ── IA
  const aiMap = {};
  tests.filter(t => t.type === 'ai').forEach(t => {
    if (!aiMap[t.suite]) aiMap[t.suite] = { pass: 0, fail: 0, total: 0 };
    aiMap[t.suite].total++;
    if (t.status === 'pass') aiMap[t.suite].pass++;
    if (t.status === 'fail') aiMap[t.suite].fail++;
  });
  const aiEl = document.getElementById('ai-panel-body');
  if (aiEl) {
    aiEl.innerHTML = Object.entries(aiMap).map(([suite, s]) => {
      const pct    = s.total > 0 ? Math.round(s.pass / s.total * 100) : 0;
      const hasRun = (s.pass + s.fail) > 0;
      const cls    = !hasRun ? 'prog-fill-pending' : (s.pass === s.total ? 'prog-fill-ai' : 'prog-fill-r');
      const fillW  = !hasRun ? 100 : pct;
      return `<div class="prog-wrap"><div class="prog-label"><span>${suite}</span><span>${hasRun ? s.pass + '/' + s.total : '\u2014'}</span></div><div class="prog-track"><div class="prog-fill ${cls}" style="width:${fillW}%"></div></div></div>`;
    }).join('') || '<div style="color:var(--muted);font-size:11px;text-align:center;padding:16px 0">Sem dados de IA</div>';
  }
}

/* ─────────────────────────────────────────
   DONUT
───────────────────────────────────────── */
function renderDonut(tests) {
  const be    = tests.filter(t => t.type === 'backend').length;
  const fe    = tests.filter(t => t.type === 'frontend').length;
  const ai    = tests.filter(t => t.type === 'ai').length;
  const total = tests.length;
  if (total === 0) return;

  const circ  = 2 * Math.PI * 40;
  const beArc = (be / total) * circ;
  const feArc = (fe / total) * circ;
  const aiArc = (ai / total) * circ;
  const beC   = document.getElementById('donut-be');
  const feC   = document.getElementById('donut-fe');
  const aiC   = document.getElementById('donut-ai');
  if (beC) beC.setAttribute('stroke-dasharray', beArc + ' ' + circ);
  if (feC) { feC.setAttribute('stroke-dasharray', feArc + ' ' + circ); feC.setAttribute('stroke-dashoffset', -(beArc - 62.8)); }
  if (aiC) { aiC.setAttribute('stroke-dasharray', aiArc + ' ' + circ); aiC.setAttribute('stroke-dashoffset', -(beArc + feArc - 62.8)); }

  const dt = document.getElementById('donut-text');
  if (dt) dt.textContent = total;

  const lb = document.getElementById('legend-be');
  const lf = document.getElementById('legend-fe');
  const la = document.getElementById('legend-ai');
  const lp = document.getElementById('legend-pass');
  const ld = document.getElementById('legend-fail-detail');
  if (lb) lb.textContent = be + ' (' + Math.round(be / total * 100) + '%)';
  if (lf) lf.textContent = fe + ' (' + Math.round(fe / total * 100) + '%)';
  if (la) la.textContent = ai > 0 ? ai + ' (' + Math.round(ai / total * 100) + '%)' : '-';
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  if (lp) { lp.textContent = failed === 0 ? 'Todos passaram \u2713' : failed + ' falha' + (failed > 1 ? 's' : ''); lp.style.color = failed === 0 ? 'var(--green)' : 'var(--red)'; }
  if (ld) ld.textContent = failed === 0 ? '0 falhas' : passed + ' passaram';
}

/* ─────────────────────────────────────────
   TABELA
───────────────────────────────────────── */
function renderTable(tests) {
  const tbody  = document.getElementById('testTableBody');
  const maxDur = Math.max(...tests.map(t => t.dur || 0), 1);
  tbody.innerHTML = tests.map((t, i) => {
    const typeTag = t.type === 'backend'
      ? '<span class="tag tag-be">PY</span>'
      : t.type === 'ai'
      ? '<span class="tag" style="background:rgba(0,191,255,.12);color:var(--ai-color);border:1px solid rgba(0,191,255,.25)">AI</span>'
      : '<span class="tag tag-fe">JS</span>';
    const stTag = t.status === 'pass'    ? '<span class="tag tag-pass">&#10003; PASS</span>'
                : t.status === 'running' ? '<span class="tag tag-run">&#8635; RUN</span>'
                : t.status === 'skip'    ? '<span class="tag tag-skip">&#8212; SKIP</span>'
                :                          '<span class="tag tag-fail">&#10007; FAIL</span>';
    const durStr = t.type === 'frontend' ? ((t.dur || 0) / 1000).toFixed(2) + 's' : (t.dur || 0) + 'ms';
    const barW   = Math.max(4, Math.round(((t.dur || 0) / maxDur) * 48));
    const barCol = t.type === 'backend' ? 'var(--purple)' : 'var(--orange)';
    const isFail = t.status === 'fail';
    const rowCls = isFail ? 'row-fail' : '';
    const click  = isFail ? `onclick="openErrorModal(${i})" style="cursor:pointer" title="Clique para ver detalhes do erro"` : '';
    return `<tr class="${rowCls}" data-type="${t.type}" data-status="${t.status}" ${click}>
      <td style="color:var(--muted);font-size:10px">${t.file}<br><span style="color:#2a3c50;font-size:9px">${t.suite}</span></td>
      <td style="max-width:210px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</td>
      <td>${typeTag}</td><td>${stTag}</td>
      <td><span class="dur-bar" style="width:${barW}px;background:${barCol}"></span>${durStr}</td>
    </tr>`;
  }).join('');
}

function filterTable() {
  const type   = document.getElementById('filterType').value;
  const status = document.getElementById('filterStatus').value;
  document.querySelectorAll('#testTableBody tr').forEach(r => {
    r.style.display = (!type || r.dataset.type === type) && (!status || r.dataset.status === status) ? '' : 'none';
  });
}

/* ─────────────────────────────────────────
   MODAL DE ERRO (enriquecido)
───────────────────────────────────────── */
/** Abre modal a partir de um objeto de dados (não usa índice) */
function openErrorModalFromData(t) {
  currentErrorData = t;

  document.getElementById('em-name').textContent  = t.name;
  document.getElementById('em-suite').textContent = '\uD83D\uDCE6 ' + t.suite;
  document.getElementById('em-file').textContent  = '\uD83D\uDCC4 ' + t.file;
  document.getElementById('em-type').textContent  = t.type === 'backend' ? '\uD83D\uDC0D pytest' : '\uD83C\uDFAD Playwright';
  document.getElementById('em-dur').textContent   = '\u23F1 ' + (t.type === 'frontend' ? ((t.dur || 0) / 1000).toFixed(2) + 's' : (t.dur || 0) + 'ms');

  // localização
  const loc = t.location || '';
  document.getElementById('em-location').innerHTML = (() => {
    if (!loc || loc === '---') return '---';
    const pts    = loc.split(':');
    const lastPt = pts[pts.length - 1];
    const lineNo = lastPt && !isNaN(lastPt) ? lastPt : '';
    const fileP  = lineNo ? pts.slice(0, -1).join(':') : loc;
    return lineNo
      ? fileP + ' <strong style="color:var(--yellow);font-size:15px">&rarr; linha ' + lineNo + '</strong>'
      : loc;
  })();

  // mensagem de erro
  document.getElementById('em-message').textContent = t.errorMessage || '(sem mensagem de erro)';

  // traceback
  document.getElementById('em-traceback').textContent = t.traceback
    || '(sem traceback dispon\u00edvel \u2014 execute via test_server.py para obter detalhes)';

  // contexto do código
  const ctxSection = document.getElementById('em-context-section');
  const ctxEl      = document.getElementById('em-context');
  if (ctxSection && ctxEl) {
    if (t.context) {
      // destaca linhas com BUG / ← / # bug
      const highlighted = t.context.split('\n').map(line => {
        if (line.includes('BUG') || line.includes('\u2190') || line.toLowerCase().includes('# bug'))
          return '<span class="code-line-err">' + escHtml(line) + '</span>';
        return escHtml(line);
      }).join('\n');
      ctxEl.innerHTML    = highlighted;
      ctxSection.style.display = 'flex';
    } else {
      ctxSection.style.display = 'none';
    }
  }

  // reset seção IA
  const aiSection = document.getElementById('em-ai-section');
  const aiHint    = document.getElementById('em-ai-hint');
  if (aiSection) aiSection.style.display = 'none';
  if (aiHint)    aiHint.innerHTML = '';
  const aiBtn = document.getElementById('btnAiHint');
  if (aiBtn) { aiBtn.disabled = false; aiBtn.innerHTML = '\uD83E\uDD16 Sugest\u00e3o da IA'; }

  document.getElementById('errorModal').classList.add('open');
}

/** Abre modal a partir de índice na lista allTests */
function openErrorModal(idx) {
  const t = allTests[idx];
  if (!t) return;
  openErrorModalFromData(t);
}

/** Abre modal com o erro de demonstração */
function openDemoError() {
  openErrorModalFromData(DEMO_ERROR);
}

function closeErrorModal(evt) {
  if (evt && evt.target !== document.getElementById('errorModal')) return;
  document.getElementById('errorModal').classList.remove('open');
}

async function getAiHint() {
  const t = currentErrorData;
  if (!t) return;
  const btn = document.getElementById('btnAiHint');
  btn.disabled  = true;
  btn.innerHTML = '<span class="ai-loading"><span class="ai-spinner"></span>Consultando IA...</span>';
  document.getElementById('em-ai-section').style.display = 'none';

  try {
    const resp = await fetch('/api/ai-hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:         t.name,
        suite:        t.suite,
        file:         t.file,
        type:         t.type,
        location:     t.location     || '',
        errorMessage: t.errorMessage || '',
        traceback:    t.traceback    || '',
        context:      t.context      || ''
      })
    });
    const data = await resp.json();
    if (data.hint) {
      document.getElementById('em-ai-hint').innerHTML = renderMD(data.hint);
      document.getElementById('em-ai-section').style.display = 'block';
      const providerLabel = data.provider ? ' (' + data.provider + ')' : '';
      btn.innerHTML = '\uD83E\uDD16 Atualizar dica' + providerLabel;
    } else {
      btn.innerHTML = '\u26A0 Erro: ' + (data.error || 'falhou');
    }
  } catch {
    btn.innerHTML = '\u26A0 Erro de conexao';
  }
  btn.disabled = false;
}

/* ─────────────────────────────────────────
   MODAL DE FALHAS
───────────────────────────────────────── */
function openFailsModal() {
  const fails = allTests.reduce((acc, t, i) => {
    if (t.status === 'fail') acc.push({ ...t, idx: i });
    return acc;
  }, []);

  const cnt = document.getElementById('fails-count-badge');
  if (cnt) cnt.textContent = fails.length + ' falha' + (fails.length !== 1 ? 's' : '');

  const content = document.getElementById('failsListContent');
  if (!fails.length) {
    content.innerHTML = '<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px 0">Nenhuma falha encontrada. \u2713</p>';
  } else {
    content.innerHTML = '<div class="fails-list">' + fails.map((t, n) => {
      const locRaw = t.location || '';
      const pts    = locRaw.split(':');
      const lineNo = locRaw && !isNaN(pts[pts.length - 1]) ? pts[pts.length - 1] : '';
      const fileP  = lineNo ? pts.slice(0, -1).join(':') : locRaw;
      const locHtml = locRaw
        ? '<span class="fail-item-loc">' + fileP + (lineNo ? ' <strong style="color:var(--yellow)">l.' + lineNo + '</strong>' : '') + '</span>'
        : '';
      return `<div class="fail-item" onclick="openErrorModal(${t.idx});closeFailsModal()">
        <span class="fail-item-idx">#${n + 1}</span>
        <div class="fail-item-body">
          <div class="fail-item-name">${t.suite} :: ${t.name}</div>
          <div class="fail-item-meta">
            <span class="tag ${t.type === 'backend' ? 'tag-be' : 'tag-fe'}">${t.type === 'backend' ? 'PY' : 'JS'}</span>
            <span style="color:var(--muted)">${t.file}</span>
            ${locHtml}
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
  }
  document.getElementById('failsModal').classList.add('open');
}

function closeFailsModal(evt) {
  if (evt && evt.target !== document.getElementById('failsModal')) return;
  document.getElementById('failsModal').classList.remove('open');
}

/* ─────────────────────────────────────────
   SIDEBAR / ACCORDION / LOG / RELÓGIO
───────────────────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('sb-hidden');
}

function setAllSuites(open) {
  document.querySelectorAll('.suite-group').forEach(g => {
    open ? g.classList.add('open') : g.classList.remove('open');
  });
}

function togglePanel(header) {
  header.closest('.panel').classList.toggle('acc-collapsed');
}

function addLog(cls, msg) {
  const log = document.getElementById('liveLog');
  const now = new Date();
  const ts  = String(now.getHours()).padStart(2, '0') + ':'
            + String(now.getMinutes()).padStart(2, '0') + ':'
            + String(now.getSeconds()).padStart(2, '0');
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = `<span class="log-time">${ts}</span><span class="${cls}">${msg}</span>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function clearLog() {
  document.getElementById('liveLog').innerHTML = '';
}

function copyLog() {
  const lines = [...document.querySelectorAll('#liveLog .log-line')]
    .map(l => l.textContent.trim()).filter(Boolean).join('\n');
  if (!lines) { log('Log vazio — nada para copiar.', 'warn'); return; }
  navigator.clipboard.writeText(lines)
    .then(() => log('Log copiado para area de transferencia (' + lines.split('\n').length + ' linhas).', 'ok'))
    .catch(() => log('Erro ao copiar log (sem permissao de clipboard).', 'warn'));
}

function updateClock() {
  const now = new Date();
  const el  = document.getElementById('clock');
  if (el) {
    el.textContent = String(now.getHours()).padStart(2, '0') + ':'
                   + String(now.getMinutes()).padStart(2, '0') + ':'
                   + String(now.getSeconds()).padStart(2, '0');
  }
}

/* ── TECLADO ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('errorModal').classList.remove('open');
    document.getElementById('failsModal').classList.remove('open');
    document.getElementById('testDetailModal').classList.remove('open');
    // fecha também o menu hambúrguer
    const menu = document.getElementById('sbMenu');
    const ham  = document.getElementById('hamburger');
    if (menu) menu.classList.remove('open');
    if (ham)  ham.classList.remove('open');
  }
});


/* ══════════════════════════════════════════════════════════
   MODAL DE DETALHE DO TESTE
   ══════════════════════════════════════════════════════════ */

/* ── BASE DE CONHECIMENTO DOS TESTES ── */
const TEST_INFO = {
  // ─── BACKEND: API OPCOES ────────────────────────────────
  'test_api_opcoes::TestListarOpcoes::test_listar_retorna_lista_vazia_por_padrao': {
    icon: '📋', desc: 'Verifica que GET /api/opcoes retorna um array vazio quando não há nenhuma operação de opções registrada no banco de dados.',
    validates: ['Status HTTP 200', 'Corpo da resposta é um array JSON', 'Array retornado está vazio []'],
    fails_when: ['Banco não foi limpo antes do teste (fixture mock_db com leak)', 'Endpoint /api/opcoes não registrado no Blueprint', 'Erro de conexão ao banco de dados'],
    cmd: 'curl -X GET http://localhost:8888/api/opcoes',
    pytest: 'pytest backend/tests/test_api_opcoes.py::TestListarOpcoes::test_listar_retorna_lista_vazia_por_padrao -v'
  },
  'test_api_opcoes::TestListarOpcoes::test_listar_retorna_operacoes': {
    icon: '📋', desc: 'Verifica que GET /api/opcoes retorna a lista de operações quando existem registros no banco.',
    validates: ['Status HTTP 200', 'Lista não está vazia', 'Cada item possui os campos esperados'],
    fails_when: ['Fixture de dados não inseriu registros corretamente', 'Serialização dos campos com erro', 'Campo obrigatório ausente na resposta'],
    cmd: 'curl -X GET http://localhost:8888/api/opcoes',
    pytest: 'pytest backend/tests/test_api_opcoes.py::TestListarOpcoes::test_listar_retorna_operacoes -v'
  },
  'test_api_opcoes::TestBuscarOpcao::test_buscar_opcao_existente': {
    icon: '🔍', desc: 'Verifica que GET /api/opcoes/{id} retorna a operação correta quando o ID existe no banco.',
    validates: ['Status HTTP 200', 'Objeto retornado corresponde ao ID solicitado', 'Todos os campos estão presentes'],
    fails_when: ['ID na fixture não coincide com o enviado na requisição', 'Serialização incorreta do objeto', 'Rota com parâmetro mal configurada'],
    cmd: 'curl -X GET http://localhost:8888/api/opcoes/1',
    pytest: 'pytest backend/tests/test_api_opcoes.py::TestBuscarOpcao::test_buscar_opcao_existente -v'
  },
  'test_api_opcoes::TestBuscarOpcao::test_buscar_opcao_inexistente_retorna_404': {
    icon: '🔍', desc: 'Verifica que GET /api/opcoes/{id} retorna HTTP 404 quando o ID não existe no banco.',
    validates: ['Status HTTP 404', 'Resposta com mensagem de erro adequada'],
    fails_when: ['Endpoint retorna 200 com null ao invés de 404', 'ID inexistente foi criado por outro teste (isolamento falhou)'],
    cmd: 'curl -v -X GET http://localhost:8888/api/opcoes/99999',
    pytest: 'pytest backend/tests/test_api_opcoes.py::TestBuscarOpcao::test_buscar_opcao_inexistente_retorna_404 -v'
  },
  'test_api_opcoes::TestCriarOpcao::test_criar_opcao_retorna_sucesso': {
    icon: '➕', desc: 'Verifica que POST /api/opcoes cria uma nova operação e retorna HTTP 201 com o recurso criado.',
    validates: ['Status HTTP 201', 'ID gerado retornado na resposta', 'Dados enviados persistidos corretamente'],
    fails_when: ['Payload inválido ou campos obrigatórios faltando', 'Banco não faz commit', 'Blueprint não aceita método POST'],
    cmd: 'curl -X POST http://localhost:8888/api/opcoes -H "Content-Type: application/json" -d \'{"ativo":"PETR4","tipo":"call","strike":30}\'',
    pytest: 'pytest backend/tests/test_api_opcoes.py::TestCriarOpcao::test_criar_opcao_retorna_sucesso -v'
  },
  'test_api_opcoes::TestAtualizarOpcao::test_atualizar_opcao_retorna_sucesso': {
    icon: '✏️', desc: 'Verifica que PUT /api/opcoes/{id} atualiza uma operação existente e retorna HTTP 200.',
    validates: ['Status HTTP 200', 'Dados atualizados refletidos na resposta', 'Commit realizado no banco'],
    fails_when: ['ID não encontrado (404 inesperado)', 'Campo de atualização não refletido', 'Transação não confirmada'],
    cmd: 'curl -X PUT http://localhost:8888/api/opcoes/1 -H "Content-Type: application/json" -d \'{"strike":35}\'',
    pytest: 'pytest backend/tests/test_api_opcoes.py::TestAtualizarOpcao::test_atualizar_opcao_retorna_sucesso -v'
  },
  'test_api_opcoes::TestExcluirOpcao::test_excluir_opcao_retorna_sucesso': {
    icon: '🗑️', desc: 'Verifica que DELETE /api/opcoes/{id} remove a operação existente e retorna HTTP 200 ou 204.',
    validates: ['Status HTTP 200 ou 204', 'Registro não está mais acessível via GET'],
    fails_when: ['Recurso já deletado (idempotência)', 'Sem cascade delete no banco', 'ID incorreto na fixture'],
    cmd: 'curl -X DELETE http://localhost:8888/api/opcoes/1',
    pytest: 'pytest backend/tests/test_api_opcoes.py::TestExcluirOpcao::test_excluir_opcao_retorna_sucesso -v'
  },

  // ─── BACKEND: API CRYPTO ────────────────────────────────
  'test_api_crypto::TestListarCrypto::test_listar_retorna_lista_vazia_por_padrao': {
    icon: '₿', desc: 'Verifica GET /api/crypto retorna array vazio no estado inicial limpo do banco.',
    validates: ['Status HTTP 200', 'Resposta é array vazio []'],
    fails_when: ['Leak de dados entre testes', 'Fixture mock_db não isolada'],
    cmd: 'curl -X GET http://localhost:8888/api/crypto',
    pytest: 'pytest backend/tests/test_api_crypto.py::TestListarCrypto::test_listar_retorna_lista_vazia_por_padrao -v'
  },
  'test_api_crypto::TestCriarCrypto::test_criar_operacao_retorna_sucesso': {
    icon: '₿', desc: 'Verifica que POST /api/crypto cria uma operação de criptomoeda e retorna HTTP 201.',
    validates: ['Status HTTP 201', 'ID gerado retornado', 'Dados persistidos'],
    fails_when: ['Payload inválido', 'Validação de campos negando', 'Blueprint não mapeado'],
    cmd: 'curl -X POST http://localhost:8888/api/crypto -H "Content-Type: application/json" -d \'{"ativo":"BTC","tipo":"compra","preco":50000}\'',
    pytest: 'pytest backend/tests/test_api_crypto.py::TestCriarCrypto::test_criar_operacao_retorna_sucesso -v'
  },

  // ─── BACKEND: API CONFIG ────────────────────────────────
  'test_api_config::TestGetConfig::test_get_config_retorna_dict_vazio_padrao': {
    icon: '⚙️', desc: 'Verifica GET /api/config retorna dicionário vazio quando nenhuma chave foi configurada.',
    validates: ['Status HTTP 200', 'Resposta é {} ou lista vazia'],
    fails_when: ['Config populada por outro teste', 'Fixture com dados pré-existentes'],
    cmd: 'curl -X GET http://localhost:8888/api/config',
    pytest: 'pytest backend/tests/test_api_config.py::TestGetConfig::test_get_config_retorna_dict_vazio_padrao -v'
  },
  'test_api_config::TestSaveConfig::test_salvar_config_retorna_sucesso': {
    icon: '⚙️', desc: 'Verifica POST /api/config salva chaves de configuração e retorna sucesso.',
    validates: ['Status HTTP 200', 'Confirmação de sucesso na resposta', 'Commit realizado'],
    fails_when: ['Payload mal formado', 'Banco sem permissão de escrita', 'Chave inválida ou proibida'],
    cmd: 'curl -X POST http://localhost:8888/api/config -H "Content-Type: application/json" -d \'{"GEMINI_KEY":"abc123"}\'',
    pytest: 'pytest backend/tests/test_api_config.py::TestSaveConfig::test_salvar_config_retorna_sucesso -v'
  },

  // ─── BACKEND: API ANALYZE ───────────────────────────────
  'test_api_analyze::TestAnalyzeValidacao::test_sem_api_keys_retorna_400': {
    icon: '🤖', desc: 'Verifica que POST /api/analyze retorna HTTP 400 quando nenhuma chave de API de IA está configurada.',
    validates: ['Status HTTP 400', 'Mensagem de erro indicando chaves ausentes'],
    fails_when: ['Variável de ambiente com chave definida no ambiente de CI', 'Mock de banco retornando chaves erroneamente'],
    cmd: 'curl -X POST http://localhost:8888/api/analyze -H "Content-Type: application/json" -d \'{"prompt":"teste"}\'',
    pytest: 'pytest backend/tests/test_api_analyze.py::TestAnalyzeValidacao::test_sem_api_keys_retorna_400 -v'
  },
  'test_api_analyze::TestAnalyzeComMockGemini::test_analyze_gemini_retorna_analise': {
    icon: '🤖', desc: 'Verifica que POST /api/analyze com Gemini mockado retorna uma análise estruturada válida.',
    validates: ['Status HTTP 200', 'Campos analysis/provider na resposta', 'Resposta não vazia'],
    fails_when: ['Mock do Gemini não configurado corretamente', 'Chave Gemini ausente no mock', 'Timeout simulado'],
    cmd: 'curl -X POST http://localhost:8888/api/analyze -H "Content-Type: application/json" -d \'{"prompt":"analisar risco","context":[]}\'',
    pytest: 'pytest backend/tests/test_api_analyze.py::TestAnalyzeComMockGemini::test_analyze_gemini_retorna_analise -v'
  },

  // ─── FRONTEND: PLAYWRIGHT / OPCOES ──────────────────────
  'opcoes.spec::Opcoes::[Opcoes] nao deve ter SyntaxError no JS': {
    icon: '🎭', desc: 'Playwright: carrega a página de Opções e verifica que não há SyntaxError ou erros de parse no JavaScript.',
    validates: ['Nenhum SyntaxError no console', 'Página carrega sem crashes', 'Scripts executados sem erro fatal'],
    fails_when: ['Erro de sintaxe JS introduzido por edição recente', 'Import com caminho errado', 'Transpilação com erro silencioso'],
    cmd: 'npx playwright test tests/opcoes.spec.js --reporter=list',
    pytest: null
  },
  'opcoes.spec::Opcoes::[Opcoes] pagina deve carregar sem erros de runtime': {
    icon: '🎭', desc: 'Playwright: abre a página Opções e monitora erros de runtime no console do browser (TypeError, ReferenceError etc.).',
    validates: ['Console sem erros após carregamento', 'Todas as dependências JS resolvidas', 'Inicialização do módulo concluída'],
    fails_when: ['Variável não definida no escopo global', 'API chamada antes de estar pronta', 'Fetch falhando com erro não tratado'],
    cmd: 'npx playwright test tests/opcoes.spec.js --reporter=list',
    pytest: null
  },
  'opcoes.spec::Opcoes::[Opcoes] tabela de operacoes deve estar visivel': {
    icon: '🎭', desc: 'Playwright: confirma que a tabela de operações da página Opções é visível após o carregamento.',
    validates: ['Seletor da tabela presente no DOM', 'Elemento visível (não display:none)', 'Estrutura da tabela com thead e tbody'],
    fails_when: ['Seletor CSS alterado sem atualizar o teste', 'Tabela condicionalmente escondida por estado de erro', 'Timeout no carregamento dos dados'],
    cmd: 'npx playwright test tests/opcoes.spec.js -g "tabela" --reporter=list',
    pytest: null
  },
  'crypto.spec::Crypto::[Crypto] nao deve ter SyntaxError no JS': {
    icon: '🎭', desc: 'Playwright: verifica ausência de SyntaxError na página de Crypto.',
    validates: ['Nenhum SyntaxError no console', 'Scripts Crypto executados sem interrupção'],
    fails_when: ['Erro de sintaxe no crypto.js ou módulos importados'],
    cmd: 'npx playwright test tests/crypto.spec.js --reporter=list',
    pytest: null
  },

  // ─── FRONTEND: AI PROVIDERS ─────────────────────────────
  'test_ai_providers::TestGemini::test_chave_configurada': {
    icon: '🔑', desc: 'Verifica que a chave de API do Gemini está presente e não vazia nas configurações do sistema.',
    validates: ['Chave GEMINI_API_KEY existe', 'Valor não está em branco'],
    fails_when: ['Chave não configurada no .env ou banco', 'Nome da variável diferente do esperado'],
    cmd: 'D:\\laragon\\bin\\python\\python-3.13\\python.exe -c "import os; print(bool(os.getenv(\'GEMINI_API_KEY\')))"',
    pytest: 'pytest backend/tests/test_ai_providers.py::TestGemini::test_chave_configurada -v -s'
  },
  'test_ai_providers::TestGemini::test_gemini_flash_responde': {
    icon: '🤖', desc: 'Teste de integração real com a API do Gemini Flash — requer chave válida e conexão com a internet.',
    validates: ['Resposta não vazia da API Gemini', 'Sem exceção de autenticação', 'Latência dentro do timeout'],
    fails_when: ['Chave inválida ou expirada', 'Sem acesso à internet', 'Rate limit atingido', 'Modelo gemini-flash indisponível'],
    cmd: 'D:\\laragon\\bin\\python\\python-3.13\\python.exe backend/test_gemini.py',
    pytest: 'pytest backend/tests/test_ai_providers.py::TestGemini::test_gemini_flash_responde -v -s'
  },
};

/**
 * Converte um comando curl em equivalente PowerShell (Invoke-RestMethod).
 * Suporta -X METHOD, -H "Header: Value", -d 'body', GET simples.
 */
function curlToPS(curlCmd) {
  if (!curlCmd || curlCmd.startsWith('#') || curlCmd.startsWith('pytest') || curlCmd.startsWith('npx')) {
    return curlCmd || '';
  }
  // Detectar URL
  const urlMatch = curlCmd.match(/https?:\/\/[^\s'"]+/);
  if (!urlMatch) return curlCmd;
  const url = urlMatch[0];

  // Detectar método
  const methodMatch = curlCmd.match(/-X\s+(\w+)/i);
  const method = methodMatch ? methodMatch[1] : 'GET';

  // Detectar Content-Type (de -H)
  const ctMatch = curlCmd.match(/-H\s+["']Content-Type:\s*([^"']+)["']/i);
  const ct = ctMatch ? ctMatch[1].trim() : null;

  // Detectar body (-d)
  const bodyMatch = curlCmd.match(/-d\s+['"](.+?)['"]\s*$/s) || curlCmd.match(/-d\s+'(.+?)'\s*$/s);
  const body = bodyMatch ? bodyMatch[1] : null;

  let ps = `Invoke-RestMethod -Uri "${url}"`;
  if (method !== 'GET') ps += ` -Method ${method}`;
  if (ct)   ps += ` -ContentType "${ct}"`;
  if (body) ps += ` -Body '${body}'`;
  return ps;
}

/**
 * Retorna informações enriquecidas sobre o teste, com fallback gerado automaticamente.
 */
function getTestInfo(t) {
  const key = `${t.file}::${t.suite}::${t.name}`;
  if (TEST_INFO[key]) {
    const info = TEST_INFO[key];
    // Gera cmd_ps automaticamente se não definido no TEST_INFO
    if (!info.cmd_ps && info.cmd) info.cmd_ps = curlToPS(info.cmd);
    return info;
  }

  // Fallback inteligente baseado no nome/suite do teste
  const name  = t.name || '';
  const suite = t.suite || '';
  const isE2E = t.type === 'e2e';
  const isPlaywright = t.type === 'playwright' || t.type === 'e2e' || (t.dur && t.dur > 500);
  const isBE = !isPlaywright;

  let icon = '🧪';
  if (isE2E)                             icon = '🧑‍💻';
  else if (/auth/i.test(suite + name))   icon = '🔐';
  else if (/crypt/i.test(suite + name))  icon = '₿';
  else if (/opcoes/i.test(suite + name)) icon = '📊';
  else if (/ai|gemini|deepseek|grok/i.test(suite + name)) icon = '🤖';
  else if (/config/i.test(suite + name)) icon = '⚙️';
  else if (/playwright|spec/i.test(t.file)) icon = '🎭';

  const validates = [];
  const fails_when = [];
  if (/404/.test(name))        { validates.push('Status HTTP 404 retornado corretamente'); fails_when.push('Recurso encontrado inesperadamente'); }
  if (/200/.test(name))        { validates.push('Status HTTP 200 retornado'); fails_when.push('Erro interno retornando status diferente'); }
  if (/201/.test(name))        { validates.push('Status HTTP 201 de criação'); fails_when.push('Falha na persistência do recurso'); }
  if (/vazi/i.test(name))      { validates.push('Resultado é uma coleção vazia'); fails_when.push('Dados de testes anteriores vazando'); }
  if (/sucesso/i.test(name))   { validates.push('Operação executada com sucesso'); fails_when.push('Validação do payload falhando'); }
  if (/syntax/i.test(name))    { validates.push('Nenhum SyntaxError no JavaScript'); fails_when.push('Erro de sintaxe em arquivo JS recém-editado'); }
  if (/carregar/i.test(name))  { validates.push('Página carrega sem erros de runtime'); fails_when.push('Dependência JS ou CSS não encontrada'); }
  if (validates.length === 0)  { validates.push('Comportamento esperado do endpoint/componente'); }
  if (fails_when.length === 0) { fails_when.push('Configuração incorreta do ambiente de teste'); fails_when.push('Mudança na interface da função testada'); }

  let pytest, cmd, cmd_ps;
  if (isE2E) {
    const grepArg = name ? ` -g "${name}"` : '';
    cmd    = `npx playwright test --config=playwright.usuario.config.js${grepArg}`;
    cmd_ps = `# Com browser visível (PowerShell):\n$env:PW_HEADED='1'; $env:PW_SLOW_MO='700'\nnpx playwright test --config=playwright.usuario.config.js --headed${grepArg}`;
    pytest = null;
  } else if (isBE) {
    pytest = `pytest backend/tests/${t.file}.py${suite ? '::' + suite : ''}${name ? '::' + name : ''} -v`;
    cmd    = `# Execute via pytest:\n${pytest}`;
    cmd_ps = pytest;
  } else {
    cmd    = `npx playwright test tests/${t.file}.js -g "${name}" --reporter=list`;
    cmd_ps = curlToPS(cmd);
    pytest = null;
  }

  return {
    icon,
    desc: isE2E
      ? `Teste E2E de simulação real de usuário (Playwright). Executa "${name.replace(/_/g,' ')}" diretamente no browser.`
      : `Teste ${isBE ? 'backend (pytest)' : 'frontend (Playwright)'} pertencente à suite ${suite}. Verifica o comportamento correto de "${name.replace(/_/g,' ')}".`,
    validates,
    fails_when,
    cmd,
    cmd_ps,
    pytest
  };
}

/* ── ABRIR MODAL DE DETALHE ── */
function openTestDetail(idx) {
  const t = allTests[idx];
  if (!t) return;
  tdmCurrentIdx = idx;

  const info = getTestInfo(t);

  // ícone + título
  document.getElementById('tdm-icon').textContent  = info.icon || '🧪';
  document.getElementById('tdm-title').textContent = t.name.replace(/_/g, ' ');

  // meta chips
  const statusChipCls = t.status === 'pass' ? 'tdm-chip-pass' : t.status === 'fail' ? 'tdm-chip-fail' : 'tdm-chip-pend';
  const statusLabel   = t.status === 'pass' ? '✓ PASSOU' : t.status === 'fail' ? '✗ FALHOU' : '⏸ PENDENTE';
  const typeLabel     = (t.type === 'playwright' || (t.dur && t.dur > 500)) ? 'Playwright' : 'pytest';
  const durLabel      = t.dur ? `${t.dur}ms` : '—';
  document.getElementById('tdm-meta').innerHTML = `
    <span class="tdm-chip tdm-chip-type">${typeLabel}</span>
    <span class="tdm-chip tdm-chip-suite">${escHtml(t.suite || t.file)}</span>
    <span class="tdm-chip ${statusChipCls}">${statusLabel}</span>
    <span class="tdm-chip tdm-chip-dur">⏱ ${durLabel}</span>
  `.trim();

  // descrição
  document.getElementById('tdm-desc').textContent = info.desc;

  // validações
  const valEl = document.getElementById('tdm-validates');
  valEl.innerHTML = (info.validates || []).map(v => `<li>${escHtml(v)}</li>`).join('');

  // causas de falha
  const failEl = document.getElementById('tdm-fails');
  failEl.innerHTML = (info.fails_when || []).map(f => `<li>${escHtml(f)}</li>`).join('');

  // comandos (curl, PowerShell, pytest)
  document.getElementById('tdm-cmd').textContent       = info.cmd     || '# sem comando disponível';
  document.getElementById('tdm-cmd-ps').textContent    = info.cmd_ps  || '# sem equivalente PowerShell';
  document.getElementById('tdm-cmd-pytest').textContent = info.pytest || '# não aplicável (teste Playwright)';
  // Reset tabs: mostra curl por padrão
  switchCmdTab('curl', document.querySelector('.tdm-cmd-tab'));

  // botão toggle: atualiza label
  updateTDToggleBtn();

  // oculta seção IA
  document.getElementById('tdm-ai-section').style.display = 'none';
  const aiBtn = document.getElementById('tdm-ai-btn');
  if (aiBtn) { aiBtn.disabled = false; aiBtn.textContent = '🤖 Análise da IA'; }

  // abre modal
  document.getElementById('testDetailModal').classList.add('open');
}

function closeTDModal(e) {
  if (e && e.target !== document.getElementById('testDetailModal')) return;
  document.getElementById('testDetailModal').classList.remove('open');
  tdmCurrentIdx = null;
}

function updateTDToggleBtn() {
  const btn = document.getElementById('tdm-toggle-btn');
  if (!btn || tdmCurrentIdx === null) return;
  const selected = selectedTests.has(tdmCurrentIdx);
  btn.textContent = selected ? '☑ Selecionado para execução' : '☐ Marcar para execução';
  btn.classList.toggle('selected', selected);
}

function toggleTestFromDetail() {
  if (tdmCurrentIdx === null) return;
  toggleTest(tdmCurrentIdx);
  updateTDToggleBtn();
}

function runSingleTest() {
  if (tdmCurrentIdx === null) return;
  const t = allTests[tdmCurrentIdx];
  if (!t) return;

  // Desmarcar TODOS e selecionar apenas este teste
  selectedTests.clear();
  selectedTests.add(tdmCurrentIdx);
  allSelected = false;
  const btnSelAll = document.getElementById('btnSelAllTxt');
  if (btnSelAll) btnSelAll.textContent = 'Marcar';

  // Fechar o modal antes de executar
  document.getElementById('testDetailModal').classList.remove('open');
  tdmCurrentIdx = null;

  // Atualizar sidebar com nova seleção
  buildSidebar();
  updateSelCount();

  // Executar
  runTests();
}

function copyTDCmd(elId) {
  const pre = document.getElementById(elId || 'tdm-cmd');
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent.trim())
    .then(() => {
      const btn = pre.parentElement ? pre.parentElement.querySelector('.tdm-copy-btn') : null;
      if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '📋'; }, 1500); }
    })
    .catch(() => log('Erro ao copiar comando.', 'warn'));
}

function switchCmdTab(tab, btn) {
  // Desativa todos os tab buttons
  document.querySelectorAll('.tdm-cmd-tab').forEach(b => b.classList.remove('active'));
  // Oculta todos os painéis
  ['curl', 'ps', 'pytest'].forEach(t => {
    const el = document.getElementById('tdm-cmd-panel-' + t);
    if (el) el.style.display = 'none';
  });
  // Ativa o tab clicado
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('tdm-cmd-panel-' + tab);
  if (panel) panel.style.display = 'block';
}

function getAiHintForTest() {
  if (tdmCurrentIdx === null) return;
  const t    = allTests[tdmCurrentIdx];
  const info = getTestInfo(t);
  const aiBtn = document.getElementById('tdm-ai-btn');
  const aiSec = document.getElementById('tdm-ai-section');
  const aiBox = document.getElementById('tdm-ai-hint');

  if (aiBtn) { aiBtn.disabled = true; aiBtn.textContent = '⏳ Consultando IA...'; }
  aiSec.style.display = 'flex';
  aiBox.innerHTML = '<div class="ai-loading"><div class="ai-spinner"></div> Consultando IA...</div>';

  const context = [];
  if (t.errorMessage) context.push({ role: 'user', content: `Erro: ${t.errorMessage}` });
  if (t.traceback)    context.push({ role: 'user', content: `Traceback:\n${t.traceback}` });

  const prompt = `Analise este teste: "${t.name}" da suite "${t.suite}".
Descrição: ${info.desc}
Status atual: ${t.status || 'pendente'}
${t.errorMessage ? 'Mensagem de erro: ' + t.errorMessage : ''}
${t.traceback    ? 'Traceback:\n' + t.traceback : ''}

Explique de forma concisa:
1. O que este teste verifica
2. Por que ele pode estar falhando (se status for fail)
3. Como corrigir o problema
4. Exemplo de correção de código se aplicável`;

  fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, context })
  })
  .then(r => r.json())
  .then(data => {
    const text = data.analysis || data.response || data.error || 'Sem resposta da IA.';
    aiBox.innerHTML = escHtml(text).replace(/\n/g, '<br>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  })
  .catch(err => {
    aiBox.innerHTML = `<span style="color:var(--red)">Erro ao consultar IA: ${escHtml(String(err))}</span>`;
  })
  .finally(() => {
    if (aiBtn) { aiBtn.disabled = false; aiBtn.textContent = '🤖 Análise da IA'; }
  });
}

/* ── ARRANQUE ── */
init();

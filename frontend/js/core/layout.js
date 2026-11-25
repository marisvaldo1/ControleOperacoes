// Injeta navbar e footer em todas as paginas
document.addEventListener('libsLoaded', function() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-bs-theme', theme);
    
    // Detecção de dispositivo mobile
    window.isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) 
                      || window.matchMedia('(max-width: 768px)').matches;
    if (window.isMobile) document.body.classList.add('is-mobile');
    
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    
    const navbar = `
    <header class="navbar navbar-expand-md d-print-none">
        <div class="container-fluid">
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu">
                <span class="navbar-toggler-icon"></span>
            </button>
            <h1 class="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
                <a href="../index.html" style="text-decoration:none;color:inherit;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Controle de Investimentos
                </a>
            </h1>
            <div class="navbar-nav flex-row order-md-last">
                <div class="nav-item d-flex me-2 me-md-3">
                    <div id="navbarCryptoPrices" style="display:flex;gap:6px;align-items:center;flex-wrap:nowrap;overflow-x:auto;max-width:40vw;-webkit-overflow-scrolling:touch;scrollbar-width:none;"></div>
                </div>
                <div class="nav-item d-flex me-2 me-md-3">
                    <div id="navbarAcoesPrices" style="display:flex;gap:6px;align-items:center;flex-wrap:nowrap;overflow-x:auto;max-width:40vw;-webkit-overflow-scrolling:touch;scrollbar-width:none;"></div>
                </div>
                <div class="nav-item">
                    <select class="form-select form-select-sm" id="selectAno" style="width:120px;">
                        <option value="">Ano</option>
                    </select>
                </div>
                <div class="nav-item d-flex me-2">
                    <button class="btn btn-ghost-primary btn-sm" id="btnRefresh" title="Atualizar Cotacoes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
                    </button>
                </div>
                <div class="nav-item d-flex me-2">
                    <button class="btn btn-ghost-primary btn-sm" id="btnConfig" title="Configuracoes" data-bs-toggle="offcanvas" data-bs-target="#offcanvasConfig">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                </div>
                <div class="nav-item d-flex me-2">
                    <button class="btn btn-ghost-primary btn-sm" id="btnTheme" title="Alternar Tema">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-moon d-none"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                    </button>
                </div>
            </div>
            <div class="collapse navbar-collapse" id="navbar-menu">
                <div class="d-flex flex-column flex-md-row flex-fill align-items-stretch align-items-md-center">
                    <ul class="navbar-nav">
                        <li class="nav-item ${currentPage === 'crypto' ? 'active' : ''}">
                            <a class="nav-link" href="crypto.html">
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                                </span>
                                <span class="nav-link-title">Cryptos</span>
                            </a>
                        </li>
                        <li class="nav-item ${currentPage === 'opcoes' ? 'active' : ''}">
                            <a class="nav-link" href="opcoes.html">
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                                </span>
                                <span class="nav-link-title">Opções</span>
                            </a>
                        </li>
                        <li class="nav-item ${currentPage === 'simulador' ? 'active' : ''}">
                            <a class="nav-link" href="simulador.html">
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
                                </span>
                                <span class="nav-link-title">Simulador</span>
                            </a>
                        </li>
                        <li class="nav-item d-md-none">
                            <a class="nav-link" href="posicoes-abertas.html">
                                <span class="nav-link-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                                </span>
                                <span class="nav-link-title">Posições Abertas</span>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </header>`;
    
    const offcanvasConfig = `
    <div class="offcanvas offcanvas-end" tabindex="-1" id="offcanvasConfig">
        <div class="offcanvas-header">
            <h5 class="offcanvas-title">Configuracoes</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
            <ul class="nav nav-tabs mb-3" id="configTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="configTabCryptoBtn" data-bs-toggle="tab" data-bs-target="#configTabCrypto" type="button" role="tab">🪙 Crypto</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="configTabOpcoesBtn" data-bs-toggle="tab" data-bs-target="#configTabOpcoes" type="button" role="tab">📈 Opções</button>
                </li>
            </ul>
            <div class="tab-content">
                <!-- ═══ Aba Crypto ═══ -->
                <div class="tab-pane fade show active" id="configTabCrypto" role="tabpanel">
                    <div class="mb-3">
                        <label class="form-label">API Oplab Key</label>
                        <input type="text" class="form-control config-common" id="configOplabKeyCrypto" placeholder="Sua chave API Oplab">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Meta Mensal (R$)</label>
                        <input type="number" step="0.01" class="form-control config-common" id="configMetaCrypto" placeholder="0.00">
                    </div>
                    <hr class="my-3">
                    <div class="mb-3">
                        <label class="form-label">Binance API Key</label>
                        <input type="text" class="form-control" id="configBinanceKey" placeholder="Sua chave API Binance">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Binance Secret</label>
                        <input type="password" class="form-control" id="configBinanceSecret" placeholder="Seu secret Binance">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Saldo em Crypto (USD)</label>
                        <input type="number" step="0.01" class="form-control" id="configSaldoCrypto" placeholder="0.00">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Ativos para Cotação (Navbar Crypto)</label>
                        <input type="text" class="form-control" id="configNavbarAtivos" placeholder="Ex: BTC,ETH,BNB">
                        <div class="form-text">Até 5 criptos separadas por vírgula</div>
                    </div>
                    <hr class="my-3">
                    <div class="mb-3">
                        <label class="form-label">Inteligência Artificial</label>
                        <select class="form-select config-selected-ai" id="configSelectedAICrypto">
                            <option value="">Carregando...</option>
                        </select>
                        <div class="form-text">Escolha qual IA usar para análises</div>
                    </div>
                </div>
                <!-- ═══ Aba Opções ═══ -->
                <div class="tab-pane fade" id="configTabOpcoes" role="tabpanel">
                    <p class="text-muted small mb-3" style="line-height:1.6">
                        Parâmetros do módulo de opções. A meta mensal é usada no veredito
                        <b>“Devo operar?”</b>, na escala de qualidade do prêmio e na projeção
                        por semanas restantes do mês.
                    </p>

                    <!-- ═══ Meta mensal de retorno (%) ═══ -->
                    <div class="card mb-3" id="cfgMetaCard" style="border-color:var(--bs-border-color,#26365a);">
                        <div class="card-body">
                            <label class="form-label fw-semibold" for="configMetaMensalOpcoes">
                                <span style="color:#ef4444">◉</span> Meta mensal de retorno (%)
                            </label>
                            <div class="d-flex align-items-center gap-3 flex-wrap">
                                <input type="text" inputmode="decimal" class="form-control" id="configMetaMensalOpcoes"
                                       maxlength="5" value="1,8"
                                       style="width:100px;font-size:1.35rem;font-weight:700;text-align:center;">
                                <span class="fw-bold text-muted">% ao mês</span>
                                <input type="range" class="form-range flex-grow-1" id="configMetaMensalOpcoesRange"
                                       min="0.5" max="5" step="0.1" value="1.8" style="min-width:110px;flex:1 1 110px;">
                            </div>
                            <div class="form-text mt-2">
                                Exemplo: <b>1,8</b> = 1,8% ao mês sobre o capital empregado.
                                Salvo como <code>metaMensalOpcoes</code>.
                            </div>
                        </div>
                    </div>
                    <div class="d-flex flex-wrap gap-2 mb-3" id="configMetaMensalDerivados"></div>

                    <hr class="my-3">
                    <div class="mb-3">
                        <label class="form-label">API Oplab Key</label>
                        <input type="text" class="form-control config-common" id="configOplabKeyOpcoes" placeholder="Sua chave API Oplab">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Meta Mensal (R$)</label>
                        <input type="number" step="0.01" class="form-control config-common" id="configMetaOpcoes" placeholder="0.00">
                    </div>
                    <hr class="my-3">
                    <div class="mb-3">
                        <label class="form-label">Saldo em Ações (R$)</label>
                        <input type="number" step="0.01" class="form-control" id="configSaldoAcoes" placeholder="0.00">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Ativos de Ações para Cotação (Navbar)</label>
                        <input type="text" class="form-control" id="configNavbarAtivosAcoes" placeholder="Ex: PETR4,BBAS3,ITUB4,VALE3">
                        <div class="form-text">Até 5 ações separadas por vírgula</div>
                    </div>
                    <hr class="my-3">
                    <div class="mb-3">
                        <label class="form-label">Inteligência Artificial</label>
                        <select class="form-select config-selected-ai" id="configSelectedAIOpcoes">
                            <option value="">Carregando...</option>
                        </select>
                        <div class="form-text">Escolha qual IA usar para análises</div>
                    </div>
                </div>
            </div>
            <button class="btn btn-primary w-100 mt-3" id="btnSaveConfig">Salvar Configuracoes</button>
        </div>
    </div>`;
    
    const footer = `
    <footer class="footer footer-transparent d-print-none" style="padding: 0.5rem 0;">
        <div class="container-xl">
            <div class="row text-center align-items-center">
                <div class="col-12">
                    <span class="text-muted">Controle de Investimentos © ${new Date().getFullYear()} | <span class="badge bg-blue-lt" id="footerVersion">carregando...</span></span>
                </div>
            </div>
        </div>
    </footer>`;
    
    // Inserir elementos
    const wrapper = document.querySelector('.page-wrapper');
    if (wrapper) {
        wrapper.insertAdjacentHTML('afterbegin', navbar);
        wrapper.insertAdjacentHTML('beforeend', footer);
    }
    document.body.insertAdjacentHTML('beforeend', offcanvasConfig);
    
    // Buscar versão do sistema
    fetch(API_BASE + '/api/version')
        .then(r => r.json())
        .then(data => {
            const versionEl = document.getElementById('footerVersion');
            if (versionEl && data.version) {
                versionEl.textContent = 'v' + data.version;
            }
        })
        .catch(err => {
            console.error('Erro ao carregar versão:', err);
            const versionEl = document.getElementById('footerVersion');
            if (versionEl) versionEl.textContent = 'v?.?.?';
        });
    
    // Theme toggle
    document.getElementById('btnTheme').addEventListener('click', function() {
        const current = document.body.getAttribute('data-bs-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcons(newTheme);
        
        // Dispatch event for other scripts
        document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
    });
    
    function updateThemeIcons(theme) {
        const sunIcon = document.querySelector('.icon-sun');
        const moonIcon = document.querySelector('.icon-moon');
        if (theme === 'dark') {
            sunIcon.classList.remove('d-none');
            moonIcon.classList.add('d-none');
        } else {
            sunIcon.classList.add('d-none');
            moonIcon.classList.remove('d-none');
        }
    }
    updateThemeIcons(theme);
    
    // ── Helpers dos campos de configuração (offcanvas com abas) ──────────────
    function setConfigVal(id, val) {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null && val !== '') el.value = val;
    }
    // Campos comuns repetidos nas abas Crypto/Opções
    function setCommonConfigVal(ids, val) { ids.forEach(id => setConfigVal(id, val)); }
    function getConfigVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
    function firstFilledConfigVal(a, b) {
        const va = String(getConfigVal(a) || '').trim();
        return va !== '' ? va : String(getConfigVal(b) || '').trim();
    }
    function normalizeTickerList(raw) {
        return String(raw || '').toUpperCase().split(',').map(s => s.trim()).filter(Boolean).slice(0, 5).join(',');
    }
    function setAiSelects(val) {
        if (!val) return;
        document.querySelectorAll('.config-selected-ai').forEach(sel => {
            const has = Array.prototype.some.call(sel.options, o => o.value === val);
            if (has) sel.value = val;
        });
    }
    function applyConfigToForm(cfg) {
        if (!cfg) return;
        setCommonConfigVal(['configOplabKeyCrypto', 'configOplabKeyOpcoes'], cfg.oplabKey);
        setCommonConfigVal(['configMetaCrypto', 'configMetaOpcoes'], cfg.meta);
        setConfigVal('configBinanceKey', cfg.binanceKey);
        setConfigVal('configBinanceSecret', cfg.binanceSecret);
        setConfigVal('configSaldoCrypto', cfg.saldoCrypto);
        setConfigVal('configNavbarAtivos', cfg.navbarAtivos);
        setConfigVal('configSaldoAcoes', cfg.saldoAcoes);
        setConfigVal('configNavbarAtivosAcoes', cfg.navbarAtivosAcoes);
        if (cfg.metaMensalOpcoes !== undefined && cfg.metaMensalOpcoes !== null && cfg.metaMensalOpcoes !== '') {
            const v = parseMeta(cfg.metaMensalOpcoes);
            setConfigVal('configMetaMensalOpcoes', formatMeta(v));
            const rg = document.getElementById('configMetaMensalOpcoesRange');
            if (rg) rg.value = v;
            renderMetaDerivados(v);
        }
        setAiSelects(cfg.selected_ai);
    }

    // ── Meta mensal de retorno (%) — aba Opções ──────────────────────────────
    const META_PADRAO = 1.8;
    /** Aceita "1,8" ou "1.8" e devolve o número. */
    function parseMeta(v) {
        const n = parseFloat(String(v === null || v === undefined ? '' : v).replace(',', '.'));
        return (isNaN(n) || n <= 0) ? META_PADRAO : n;
    }
    /** Exibe no padrão pt-BR: 1,8 */
    function formatMeta(v) {
        return String(parseMeta(v)).replace('.', ',');
    }
    function metaMensalAtual() {
        const el = document.getElementById('configMetaMensalOpcoes');
        return parseMeta(el ? el.value : '');
    }
    function renderMetaDerivados(v) {
        const box = document.getElementById('configMetaMensalDerivados');
        if (!box) return;
        const valor = parseMeta(v);
        const chip = (rot, val) =>
            '<span class="badge rounded-pill text-bg-secondary px-3 py-2" style="font-size:11px;letter-spacing:.02em">' +
            rot + ' <b class="ms-1" style="font-family:\'JetBrains Mono\',monospace">' + val + '</b></span>';
        box.innerHTML =
            chip('por dia (30d)', (valor / 30).toFixed(3).replace('.', ',') + '%') +
            chip('por semana', (valor * 7 / 30).toFixed(2).replace('.', ',') + '%') +
            chip('por ano (simples)', (valor * 12).toFixed(1).replace('.', ',') + '%') +
            chip('ex.: US$ 3.000 de capital', 'US$ ' + (3000 * valor / 100).toFixed(0) + '/mês');
    }
    (function initMetaMensal() {
        const inp = document.getElementById('configMetaMensalOpcoes');
        const rg = document.getElementById('configMetaMensalOpcoesRange');
        if (!inp || !rg) return;
        const sync = (valor, digitando) => {
            const v = parseMeta(valor);
            if (!digitando) inp.value = formatMeta(v);
            rg.value = v; renderMetaDerivados(v);
        };
        inp.addEventListener('input', () => sync(inp.value, true));
        inp.addEventListener('change', () => sync(inp.value, false));
        rg.addEventListener('input', () => sync(rg.value, false));
        renderMetaDerivados(metaMensalAtual());
    })();

    // Load config from localStorage
    const savedConfig = JSON.parse(localStorage.getItem('appConfig') || '{}');
    applyConfigToForm(savedConfig);
    
    // Carregar IAs disponíveis
    loadAvailableAIsInOffcanvas();

    // Fetch from backend to sync
    fetch(API_BASE + '/api/config')
        .then(r => r.json())
        .then(config => {
            applyConfigToForm(config);
            
            // Update localStorage
            const newConfig = {...savedConfig, ...config};
            localStorage.setItem('appConfig', JSON.stringify(newConfig));
        })
        .catch(err => console.error('Erro ao carregar configs do backend:', err));
    
    // Save config
    document.getElementById('btnSaveConfig').addEventListener('click', async function() {
        const config = {
            // Campos comuns às abas (usa o valor preenchido em qualquer uma delas)
            oplabKey: firstFilledConfigVal('configOplabKeyCrypto', 'configOplabKeyOpcoes'),
            meta: firstFilledConfigVal('configMetaCrypto', 'configMetaOpcoes'),
            // Crypto
            binanceKey: getConfigVal('configBinanceKey'),
            binanceSecret: getConfigVal('configBinanceSecret'),
            saldoCrypto: getConfigVal('configSaldoCrypto'),
            navbarAtivos: normalizeTickerList(getConfigVal('configNavbarAtivos')),
            // Opções
            saldoAcoes: getConfigVal('configSaldoAcoes'),
            navbarAtivosAcoes: normalizeTickerList(getConfigVal('configNavbarAtivosAcoes')),
            metaMensalOpcoes: String(metaMensalAtual())
        };
        localStorage.setItem('appConfig', JSON.stringify(config));

        // Sincronizar saldoCrypto e navbarAtivos com cryptoConfig (página crypto usa essa chave)
        try {
            const cryptoCfg = JSON.parse(localStorage.getItem('cryptoConfig') || '{}');
            if (config.saldoCrypto) cryptoCfg.saldoCrypto = config.saldoCrypto;
            if (config.navbarAtivos) cryptoCfg.navbarAtivos = config.navbarAtivos;
            if (config.navbarAtivosAcoes) cryptoCfg.navbarAtivosAcoes = config.navbarAtivosAcoes;
            localStorage.setItem('cryptoConfig', JSON.stringify(cryptoCfg));
        } catch (_) {}
        // Notifica as páginas crypto/opções para atualizar UI instantaneamente
        window.dispatchEvent(new CustomEvent('cryptoConfigUpdated', { detail: config }));
        window.dispatchEvent(new CustomEvent('opcoesConfigUpdated', { detail: config }));
        // Atualiza navbar com novos ativos
        if (window.CryptoNavbar && typeof window.CryptoNavbar.refresh === 'function') {
            window.CryptoNavbar.refresh();
        }
        if (window.AcoesNavbar && typeof window.AcoesNavbar.refresh === 'function') {
            window.AcoesNavbar.refresh();
        }
        
        try {
            // Salvar configurações gerais
            await fetch(API_BASE + '/api/config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(config)
            });
            
            // Salvar IA selecionada
            const selectedAI = getConfigVal('configSelectedAICrypto') || getConfigVal('configSelectedAIOpcoes');
            if (selectedAI) {
                await fetch(API_BASE + '/api/config-ia', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ selected_ai: selectedAI })
                });
            }
            
            iziToast.success({title: 'Sucesso', message: 'Configuracoes salvas!'});
        } catch (e) {
            iziToast.error({title: 'Erro', message: 'Erro ao salvar no servidor'});
        }
    });
    
    // --- Combo de Ano na navbar: "Todos" + 5 anos (atual + 4 anteriores) ---
    (() => {
        const select = document.getElementById('selectAno');
        if (!select) return;
        const anoAtual = new Date().getFullYear();
        // Primeiro opção: "Todos" — seleciona por defeito
        select.innerHTML = `<option value="todos" selected>Todos</option>${[anoAtual, anoAtual-1, anoAtual-2, anoAtual-3, anoAtual-4].map(y => `<option value="${y}" ${y===anoAtual?'selected':''}>${y}</option>`).join('')}`;
        // Dispatch de evento quando o usuário mudar o ano, para que outros módulos filtrem
        select.addEventListener('change', (e) => {
            const valor = e.target.value; // "todos" ou número do ano
            if (valor === 'todos') {
                document.dispatchEvent(new CustomEvent('anoSelecionado', { detail: { ano: null, todos: true } }));
                // Limpar filtro de ano: simular clique no botão "Todos" do histórico
                const btnTodos = document.querySelector('.history-filter-btn[data-filter-group="periodo"][data-filter-value="all"]');
                if (btnTodos) {
                    btnTodos.click();
                }
            } else {
                document.dispatchEvent(new CustomEvent('anoSelecionado', { detail: { ano: Number(valor), todos: false } }));
                // Aplicar filtro de ano imediatamente: simular clique no botão "Ano" do histórico
                const btnAno = document.querySelector('.history-filter-btn[data-filter-group="periodo"][data-filter-value="year"]');
                if (btnAno) {
                    btnAno.click();
                }
            }
        });
    })();
    
    // Função para carregar IAs disponíveis no offcanvas
    async function loadAvailableAIsInOffcanvas() {
        try {
            const res = await fetch(API_BASE + '/api/available-ais');
            const data = await res.json();
            
            const selects = document.querySelectorAll('.config-selected-ai');
            if (!selects.length) return;
            const optionsHtml = (data.available && data.available.length > 0)
                ? data.available.map(ai => `<option value="${ai.key}" ${ai.key === data.current ? 'selected' : ''}>${ai.name}</option>`).join('')
                : '<option value="">Nenhuma IA configurada</option>';
            selects.forEach(select => {
                select.innerHTML = optionsHtml;
                // Mantém as duas abas sincronizadas ao trocar a IA
                if (!select._aiBound) {
                    select._aiBound = true;
                    select.addEventListener('change', function () {
                        setAiSelects(this.value);
                    });
                }
            });
        } catch (e) {
            console.error('Erro ao carregar IAs disponíveis:', e);
            document.querySelectorAll('.config-selected-ai').forEach(select => {
                select.innerHTML = '<option value="">Erro ao carregar</option>';
            });
        }
    }
    
    console.log('[Layout] Disparando evento layoutReady');
    document.dispatchEvent(new Event('layoutReady'));
    // Sinaliza que layoutReady disparou E todos os handlers síncronos já rodaram
    // (dispatchEvent é síncrono — todos os handlers terminam antes desta linha)
    window.__appLayoutReady = true;
});

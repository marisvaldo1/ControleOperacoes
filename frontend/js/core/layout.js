// Injeta navbar e footer em todas as paginas
document.addEventListener('libsLoaded', function() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-bs-theme', theme);
    
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
                <div class="nav-item d-none d-md-flex me-3">
                    <span id="navbarMarketStatus" class="badge" style="font-size: 0.9rem;"></span>
                </div>
                <div class="nav-item d-none d-md-flex me-3">
                    <button class="btn btn-ghost-primary" id="btnRefresh" title="Atualizar Cotacoes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
                    </button>
                </div>
                <div class="nav-item d-none d-md-flex me-3">
                    <button class="btn btn-ghost-primary" id="btnConfig" title="Configuracoes" data-bs-toggle="offcanvas" data-bs-target="#offcanvasConfig">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                </div>
                <div class="nav-item d-none d-md-flex me-3">
                    <button class="btn btn-ghost-primary" id="btnTheme" title="Alternar Tema">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-moon d-none"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                    </button>
                </div>
            </div>
            <div class="collapse navbar-collapse" id="navbar-menu">
                <div class="d-flex flex-column flex-md-row flex-fill align-items-stretch align-items-md-center">
                    <ul class="navbar-nav">
                        <li class="nav-item ${currentPage === 'opcoes' ? 'active' : ''}">
                            <a class="nav-link" href="opcoes.html">
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                                </span>
                                <span class="nav-link-title">Opções</span>
                            </a>
                        </li>
                        <li class="nav-item ${currentPage === 'crypto' ? 'active' : ''}">
                            <a class="nav-link" href="crypto.html">
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                                </span>
                                <span class="nav-link-title">Cryptos</span>
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
            <div class="mb-3">
                <label class="form-label">API Oplab Key</label>
                <input type="text" class="form-control" id="configOplabKey" placeholder="Sua chave API Oplab">
            </div>
            <div class="mb-3">
                <label class="form-label">Binance API Key</label>
                <input type="text" class="form-control" id="configBinanceKey" placeholder="Sua chave API Binance">
            </div>
            <div class="mb-3">
                <label class="form-label">Binance Secret</label>
                <input type="password" class="form-control" id="configBinanceSecret" placeholder="Seu secret Binance">
            </div>
            <div class="mb-3">
                <label class="form-label">Meta Mensal (R$)</label>
                <input type="number" step="0.01" class="form-control" id="configMeta" placeholder="0.00">
            </div>
            <div class="mb-3">
                <label class="form-label">Saldo em Ações (R$)</label>
                <input type="number" step="0.01" class="form-control" id="configSaldoAcoes" placeholder="0.00">
            </div>
            <div class="mb-3">
                <label class="form-label">Saldo em Crypto (R$)</label>
                <input type="number" step="0.01" class="form-control" id="configSaldoCrypto" placeholder="0.00">
            </div>
            <hr class="my-4">
            <div class="mb-3">
                <label class="form-label">Inteligência Artificial</label>
                <select class="form-select" id="configSelectedAI">
                    <option value="">Carregando...</option>
                </select>
                <div class="form-text">Escolha qual IA usar para análises</div>
            </div>
            <button class="btn btn-primary w-100" id="btnSaveConfig">Salvar Configuracoes</button>
        </div>
    </div>`;
    
    const footer = `
    <footer class="footer footer-transparent d-print-none" style="padding: 0.5rem 0;">
        <div class="container-xl">
            <div class="row text-center align-items-center">
                <div class="col-12">
                    <span class="text-muted">Controle de Investimentos © 2026 | <span class="badge bg-blue-lt" id="footerVersion">carregando...</span></span>
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
    
    // Load config from localStorage
    const savedConfig = JSON.parse(localStorage.getItem('appConfig') || '{}');
    if (savedConfig.oplabKey) document.getElementById('configOplabKey').value = savedConfig.oplabKey;
    if (savedConfig.binanceKey) document.getElementById('configBinanceKey').value = savedConfig.binanceKey;
    if (savedConfig.binanceSecret) document.getElementById('configBinanceSecret').value = savedConfig.binanceSecret;
    if (savedConfig.meta) document.getElementById('configMeta').value = savedConfig.meta;
    if (savedConfig.saldoAcoes) document.getElementById('configSaldoAcoes').value = savedConfig.saldoAcoes;
    if (savedConfig.saldoCrypto) document.getElementById('configSaldoCrypto').value = savedConfig.saldoCrypto;
    
    // Carregar IAs disponíveis
    loadAvailableAIsInOffcanvas();

    // Fetch from backend to sync
    fetch(API_BASE + '/api/config')
        .then(r => r.json())
        .then(config => {
            if (config.oplabKey) document.getElementById('configOplabKey').value = config.oplabKey;
            if (config.binanceKey) document.getElementById('configBinanceKey').value = config.binanceKey;
            if (config.binanceSecret) document.getElementById('configBinanceSecret').value = config.binanceSecret;
            if (config.meta) document.getElementById('configMeta').value = config.meta;
            if (config.saldoAcoes) document.getElementById('configSaldoAcoes').value = config.saldoAcoes;
            if (config.saldoCrypto) document.getElementById('configSaldoCrypto').value = config.saldoCrypto;
            if (config.selected_ai && document.getElementById('configSelectedAI').options.length > 1) {
                document.getElementById('configSelectedAI').value = config.selected_ai;
            }
            
            // Update localStorage
            const newConfig = {...savedConfig, ...config};
            localStorage.setItem('appConfig', JSON.stringify(newConfig));
        })
        .catch(err => console.error('Erro ao carregar configs do backend:', err));
    
    // Save config
    document.getElementById('btnSaveConfig').addEventListener('click', async function() {
        const config = {
            oplabKey: document.getElementById('configOplabKey').value,
            binanceKey: document.getElementById('configBinanceKey').value,
            binanceSecret: document.getElementById('configBinanceSecret').value,
            meta: document.getElementById('configMeta').value,
            saldoAcoes: document.getElementById('configSaldoAcoes').value,
            saldoCrypto: document.getElementById('configSaldoCrypto').value
        };
        localStorage.setItem('appConfig', JSON.stringify(config));
        
        try {
            // Salvar configurações gerais
            await fetch(API_BASE + '/api/config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(config)
            });
            
            // Salvar IA selecionada
            const selectedAI = document.getElementById('configSelectedAI').value;
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
    
    // Função para carregar IAs disponíveis no offcanvas
    async function loadAvailableAIsInOffcanvas() {
        try {
            const res = await fetch(API_BASE + '/api/available-ais');
            const data = await res.json();
            
            const select = document.getElementById('configSelectedAI');
            select.innerHTML = '';
            
            if (data.available && data.available.length > 0) {
                data.available.forEach(ai => {
                    const option = document.createElement('option');
                    option.value = ai.key;
                    option.textContent = ai.name;
                    if (ai.key === data.current) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            } else {
                select.innerHTML = '<option value="">Nenhuma IA configurada</option>';
            }
        } catch (e) {
            console.error('Erro ao carregar IAs disponíveis:', e);
            document.getElementById('configSelectedAI').innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }
    
    console.log('[Layout] Disparando evento layoutReady');
    document.dispatchEvent(new Event('layoutReady'));
});

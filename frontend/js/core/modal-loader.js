/**
 * Modal Loader - Sistema de carregamento modular de modais
 * Permite carregar modais sob demanda para melhor performance e manutenibilidade
 */

class ModalLoader {
    constructor() {
        this.loadedModals = new Set();
        this.loadingPromises = new Map();
        this.baseUrl = '../components/modals';
    }

    /**
     * Carrega um modal e injeta no DOM
     * @param {string} modalPath - Caminho relativo do modal (ex: 'opcoes/modal-operacao')
     * @param {string} containerId - ID do container onde o modal será injetado (opcional)
     * @returns {Promise<void>}
     */
    async loadModal(modalPath, containerId = null) {
        // Se já está carregado, não recarrega
        if (this.loadedModals.has(modalPath)) {
            return Promise.resolve();
        }

        // Se já está carregando, retorna a promise existente
        if (this.loadingPromises.has(modalPath)) {
            return this.loadingPromises.get(modalPath);
        }

        // Inicia o carregamento
        const loadPromise = this._loadModalFiles(modalPath, containerId);
        this.loadingPromises.set(modalPath, loadPromise);

        try {
            await loadPromise;
            this.loadedModals.add(modalPath);
            this.loadingPromises.delete(modalPath);
        } catch (error) {
            this.loadingPromises.delete(modalPath);
            throw error;
        }
    }

    /**
     * Carrega múltiplos modais em paralelo
     * @param {Array<string>} modalPaths - Array de caminhos de modais
     * @returns {Promise<void[]>}
     */
    async loadModals(modalPaths) {
        return Promise.all(modalPaths.map(path => this.loadModal(path)));
    }

    /**
     * Carrega arquivos do modal (HTML, CSS, JS)
     * @private
     */
    async _loadModalFiles(modalPath, containerId) {
        const htmlPath = `${this.baseUrl}/${modalPath}.html`;
        const cssPath = `${this.baseUrl}/${modalPath}.css`;
        const jsPath = `${this.baseUrl}/${modalPath}.js`;

        // 1. Carrega HTML
        const html = await this._fetchFile(htmlPath);
        
        // 2. Injeta HTML no DOM
        const container = containerId 
            ? document.getElementById(containerId)
            : document.body;
        
        if (!container) {
            throw new Error(`Container ${containerId} não encontrado`);
        }

        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = html;
        container.appendChild(modalWrapper);

        // 3. Carrega CSS (se existir)
        try {
            await this._loadCSS(cssPath, modalPath);
        } catch (error) {
            // CSS é opcional, não falha se não existir
            console.log(`CSS opcional não encontrado: ${cssPath}`);
        }

        // 4. Carrega JS (se existir)
        try {
            await this._loadJS(jsPath, modalPath);
        } catch (error) {
            // JS é opcional, não falha se não existir
            console.log(`JS opcional não encontrado: ${jsPath}`);
        }
    }

    /**
     * Faz fetch de um arquivo
     * @private
     */
    async _fetchFile(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro ao carregar ${url}: ${response.status}`);
        }
        return response.text();
    }

    /**
     * Carrega um arquivo CSS dinamicamente
     * @private
     */
    async _loadCSS(url, modalId) {
        return new Promise((resolve, reject) => {
            // Verifica se já foi carregado
            if (document.querySelector(`link[href="${url}"]`)) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.dataset.modalId = modalId;
            
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`Erro ao carregar CSS: ${url}`));
            
            document.head.appendChild(link);
        });
    }

    /**
     * Carrega um arquivo JS dinamicamente
     * @private
     */
    async _loadJS(url, modalId) {
        return new Promise((resolve, reject) => {
            // Verifica se já foi carregado
            if (document.querySelector(`script[src="${url}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = url;
            script.dataset.modalId = modalId;
            
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Erro ao carregar JS: ${url}`));
            
            document.body.appendChild(script);
        });
    }

    /**
     * Descarrega um modal do DOM (útil para liberar memória)
     * @param {string} modalPath - Caminho do modal a descarregar
     */
    unloadModal(modalPath) {
        // Remove HTML (assume que o modal tem ID baseado no path)
        // Remove CSS
        const cssLink = document.querySelector(`link[data-modal-id="${modalPath}"]`);
        if (cssLink) cssLink.remove();

        // Remove JS
        const jsScript = document.querySelector(`script[data-modal-id="${modalPath}"]`);
        if (jsScript) jsScript.remove();

        this.loadedModals.delete(modalPath);
    }

    /**
     * Verifica se um modal já está carregado
     * @param {string} modalPath - Caminho do modal
     * @returns {boolean}
     */
    isLoaded(modalPath) {
        return this.loadedModals.has(modalPath);
    }
}

// Instância global do ModalLoader
window.modalLoader = new ModalLoader();

// Configuração de modais críticos (carregar imediatamente)
const CRITICAL_MODALS = [
    'opcoes/modal-operacao',
    'opcoes/modal-selecionar-opcao'
];

// Configuração de modais secundários (lazy loading)
const SECONDARY_MODALS = [
    'opcoes/modal-saldo-operacoes',
    'opcoes/modal-saldo-insights',
    'opcoes/modal-analise-tecnica',
    'opcoes/modal-simulacao'
];

/**
 * Inicializa o carregamento de modais
 * @param {string} strategy - 'critical' (apenas críticos), 'all' (todos), 'lazy' (sob demanda)
 */
async function initializeModals(strategy = 'critical') {
    try {
        switch (strategy) {
            case 'all':
                // Carrega todos os modais imediatamente
                await window.modalLoader.loadModals([...CRITICAL_MODALS, ...SECONDARY_MODALS]);
                console.log('✓ Todos os modais carregados');
                break;
            
            case 'critical':
                // Carrega apenas modais críticos
                await window.modalLoader.loadModals(CRITICAL_MODALS);
                console.log('✓ Modais críticos carregados');
                break;
            
            case 'lazy':
                // Não carrega nada, será carregado sob demanda
                console.log('✓ Modo lazy loading ativado');
                break;
        }
    } catch (error) {
        console.error('Erro ao inicializar modais:', error);
    }
}

/**
 * Carrega um modal sob demanda (lazy loading)
 * @param {string} modalName - Nome do modal (ex: 'saldo-operacoes')
 */
async function loadModalOnDemand(modalName) {
    const modalPath = `opcoes/modal-${modalName}`;
    
    if (window.modalLoader.isLoaded(modalPath)) {
        return; // Já está carregado
    }

    try {
        await window.modalLoader.loadModal(modalPath);
        console.log(`✓ Modal ${modalName} carregado`);
    } catch (error) {
        console.error(`Erro ao carregar modal ${modalName}:`, error);
    }
}

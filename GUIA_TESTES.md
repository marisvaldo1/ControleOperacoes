# Guia Completo de Testes — Controle Operações

> **Versão:** 1.0 · **Atualizado:** março 2026  
> Sistema de testes para a aplicação de controle de operações de opções e crypto.

---

## Sumário

1. [Visão Geral da Arquitetura de Testes](#1-visão-geral-da-arquitetura-de-testes)
2. [Pré-requisitos e Configuração Inicial](#2-pré-requisitos-e-configuração-inicial)
3. [Test Dashboard — Execução Visual](#3-test-dashboard--execução-visual)
4. [Backend (pytest) — Testes de API](#4-backend-pytest--testes-de-api)
5. [Frontend (Playwright) — Testes de Interface](#5-frontend-playwright--testes-de-interface)
6. [Testes de IA — Provedores de LLM](#6-testes-de-ia--provedores-de-llm)
7. [E2E Usuário — Simulação de Digitação](#7-e2e-usuário--simulação-de-digitação)
8. [Executar Tudo de Uma Vez](#8-executar-tudo-de-uma-vez)
9. [Criar Novos Testes](#9-criar-novos-testes)
10. [Manter e Alterar Testes Existentes](#10-manter-e-alterar-testes-existentes)
11. [Fixtures e Dados de Teste](#11-fixtures-e-dados-de-teste)
12. [Referência Rápida de Comandos](#12-referência-rápida-de-comandos)
13. [Solução de Problemas Comuns](#13-solução-de-problemas-comuns)

---

## 1. Visão Geral da Arquitetura de Testes

O projeto possui **quatro tipos** de testes, cada um com propósito e tecnologia distintos:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLE OPERAÇÕES — TESTES                  │
├───────────────┬─────────────────┬────────────────┬──────────────┤
│   BACKEND     │    FRONTEND     │       IA       │  E2E USUÁRIO │
│   (pytest)    │  (Playwright)   │   (pytest)     │  (Playwright)│
├───────────────┼─────────────────┼────────────────┼──────────────┤
│ API REST      │ Interface HTML  │ Provedores LLM │ Digitação    │
│ Banco de dados│ Componentes JS  │ OpenRouter     │ real no      │
│ Lógica Flask  │ Modais / CRUD   │ Gemini         │ browser      │
├───────────────┼─────────────────┼────────────────┼──────────────┤
│ backend/tests/│ frontend/tests/ │ backend/tests/ │ frontend/    │
│ test_api_*.py │ pages/*.spec.js │test_ai_*.py    │tests/pages/  │
│               │                 │                │e2e-usuario   │
├───────────────┼─────────────────┼────────────────┼──────────────┤
│ ~56 testes    │ ~41 testes      │ 12 testes      │ 9 testes     │
│ ≈ 0.5s        │ ≈ 50s           │ ≈ 60-120s      │ ≈ 3-5 min    │
└───────────────┴─────────────────┴────────────────┴──────────────┘
```

### Localizações dos arquivos

```
ControleOperacoes/
├── backend/tests/              ← Testes de API (pytest)
│   ├── conftest.py             ← Fixtures compartilhadas do pytest
│   ├── test_api_agenda.py
│   ├── test_api_atendimento.py
│   ├── test_api_auth.py
│   ├── test_api_financeiro.py
│   ├── test_api_pacientes.py
│   ├── test_api_relatorios.py
│   └── test_ai_providers.py   ← Testes de IA (marcados live_api)
│
├── frontend/tests/             ← Testes de interface (Playwright)
│   ├── pages/                  ← Specs dos testes
│   │   ├── e2e-smoke.spec.js   ← Smoke tests (CRUD rápido)
│   │   ├── e2e-usuario.spec.js ← Simulação com digitação visível
│   │   └── *.spec.js
│   ├── fixtures/               ← Dados de teste em JSON
│   │   ├── opcoes-fixtures.json
│   │   └── crypto-fixtures.json
│   ├── helpers/                ← Funções utilitárias de teste
│   └── setup/
│       └── global-setup.js     ← Setup antes de todos os testes
│
├── tests/                      ← Test Dashboard
│   ├── test_server.py          ← Servidor SSE do dashboard
│   ├── dashboardTestes.html    ← Interface visual
│   ├── dashboardTestes.js      ← Lógica do dashboard
│   └── results/                ← JSONs de resultado
│       ├── pytest_results.json
│       ├── playwright_results.json
│       ├── ai_results.json
│       └── e2e_results.json
│
├── playwright.config.js        ← Config principal Playwright (FE)
├── playwright.usuario.config.js← Config E2E usuário
├── run_all_tests.bat           ← Script para rodar tudo
└── GUIA_TESTES.md              ← Este guia
```

---

## 2. Pré-requisitos e Configuração Inicial

### Dependências necessárias

```powershell
# Python (backend)
pip install pytest pytest-json-report flask flask-cors

# Node.js (frontend/playwright)
npm install

# Playwright — instalar browsers
npx playwright install chromium
```

### Verificar se tudo está instalado

```powershell
# Python
python --version          # >= 3.10
pytest --version          # >= 7.0

# Node / Playwright
node --version            # >= 18
npx playwright --version  # >= 1.40
```

### Configurar variáveis de ambiente (testes de IA)

Crie ou edite `backend/.env`:

```env
# Obrigatório para testes de IA
GEMINI_API_KEY=sua_chave_aqui
OPENROUTER_API_KEY=sua_chave_aqui   # opcional, aumenta cobertura
```

> ⚠️ Sem essas chaves, os testes de IA serão pulados automaticamente.

---

## 3. Test Dashboard — Execução Visual

O dashboard é a forma mais cômoda de executar, visualizar e analisar os testes.

### Iniciar o dashboard

```powershell
# Opção 1 — Script de atalho
.\start.bat

# Opção 2 — Direto pelo Python
python tests/test_server.py
```

Acesse: **http://localhost:8883**

### Interface do dashboard

```
┌─ TopBar ──────────────────────────────────────────────────────────┐
│ ☰  Controle Operações │ 🧪 Simular Erro │ localhost:8888 │ ATIVO │
├─ Sidebar ──────────────┤ Conteúdo Central ────────────────────────┤
│ TESTES          + ☰   │ KPIs: Total | Passou | Falhou | Duração   │
│ ─────────────────────  │ Painel Backend (pytest)                   │
│ 🐍 BACKEND  (56)       │ Painel Frontend (Playwright)              │
│ 🎭 FRONTEND (41)       │ Painel IA                                 │
│ 🤖 IA       (12)       │ Saúde do Sistema                          │
│ 🧘 E2E USUÁRIO (9)     │ Resultados Detalhados                     │
│ ─────────────────────  │ Terminal Log (SSE em tempo real)          │
│ [▶ Executar Testes]    │                                           │
└────────────────────────┴───────────────────────────────────────────┘
```

### Como selecionar e executar testes

#### Executar **todos** os testes:
1. Clique no ícone `☰` (hamburger) ao lado do título "Testes"
2. Selecione **"Marcar todos"**
3. Clique **"▶ Executar Testes"**

#### Executar **apenas um tipo** (Backend, Frontend, IA ou E2E):
1. Clique `☰` → "Somente Backend" / "Somente Frontend" / "Somente IA" / "Somente E2E"
2. Clique **"▶ Executar Testes"**

#### Executar **um único teste**:
1. Clique no nome do teste na sidebar → abre modal de detalhes
2. Clique **"▶ Executar Este Teste"** no rodapé do modal

#### Executar **subconjunto** de testes:
1. Clique `☰` → **"Desmarcar todos"**
2. Clique individualmente nos testes desejados (checkbox na lateral)
3. Ou clique no nome do grupo (ex: `🐍 BACKEND`) para marcar/desmarcar o grupo inteiro
4. Clique **"▶ Executar Testes"**

### Menu hambúrguer — opções disponíveis

| Opção | Função |
|---|---|
| Marcar todos | Seleciona todos os 100+ testes |
| Desmarcar todos | Remove todas as seleções |
| Somente Backend | Seleciona só testes pytest |
| Somente Frontend | Seleciona só testes Playwright |
| Somente IA | Seleciona só testes de LLM |
| Somente E2E | Seleciona só testes de simulação |
| Expandir/Recolher todos | Expande ou colapsa grupos na sidebar |
| Só com falha | Seleciona apenas testes que falharam |
| Resetar largura | Restaura largura padrão da sidebar |
| ⚙ Configurações E2E | Abre modal de config (headed/screenshots) |
| 🗑 Zerar Resultados | Limpa todos os resultados e reinicia |

### Configurações dos testes E2E (modal)

Acessível via `☰` → **"⚙ Configurações E2E"**:

- **Abrir browser visível (`--headed`)**: abre janela do Chrome durante o teste
- **Capturas de tela**:
  - `Nunca` — sem screenshots automáticos
  - `Somente em erro` *(padrão)* — apenas quando falhar
  - `Sempre` — screenshot em cada passo
- Em caso de erro, o screenshot é **sempre** capturado

### Analisar resultados no modal de detalhe

Clique em qualquer teste na sidebar para abrir seu painel com:
- Status atual (pass/fail/pendente)
- Descrição do que é validado
- Causas prováveis de falha
- Comandos para reproduzir manualmente (Linux/curl, PowerShell, pytest)
- Botão **"🤖 Análise da IA"** para sugestão de correção

---

## 4. Backend (pytest) — Testes de API

### O que é testado

Testa endpoints REST da API Flask:
- CRUD de operações (opções e crypto)
- Autenticação
- Relatórios financeiros
- Retornos de status HTTP corretos
- Estrutura dos JSONs de resposta
- Integridade com o banco de dados (SQLite em memória)

### Executar via CLI

```powershell
# Todos os testes backend
pytest backend/tests/ -v

# Arquivo específico
pytest backend/tests/test_api_opcoes.py -v

# Classe específica
pytest backend/tests/test_api_opcoes.py::TestCriarOpcao -v

# Teste específico (mais granular)
pytest backend/tests/test_api_opcoes.py::TestCriarOpcao::test_criar_opcao_retorna_sucesso -v

# Múltiplos testes/arquivos
pytest backend/tests/test_api_opcoes.py backend/tests/test_api_crypto.py -v

# Por palavra-chave no nome
pytest backend/tests/ -k "criar" -v

# Com relatório JSON (usado pelo dashboard)
pytest backend/tests/ -v --json-report --json-report-file=tests/results/pytest_results.json

# Ver só falhas com traceback completo
pytest backend/tests/ -v --tb=long -x    # -x para na primeira falha

# Execução paralela (mais rápido)
pytest backend/tests/ -v -n auto          # requer pytest-xdist
```

### Estrutura de um arquivo de teste backend

```python
# backend/tests/test_api_exemplo.py
import pytest

class TestListarItens:
    """Testa endpoint GET /api/itens"""

    def test_retorna_lista_vazia(self, client, db_vazio):
        """Deve retornar [] quando não há registros."""
        resp = client.get('/api/itens')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data == []

    def test_retorna_itens_existentes(self, client, db_com_dados):
        """Deve retornar lista com itens após inserção."""
        resp = client.get('/api/itens')
        assert resp.status_code == 200
        itens = resp.get_json()
        assert len(itens) >= 1
        assert 'id' in itens[0]

class TestCriarItem:
    """Testa endpoint POST /api/itens"""

    def test_criar_retorna_201(self, client):
        payload = {'nome': 'Teste', 'valor': 100}
        resp = client.post('/api/itens', json=payload)
        assert resp.status_code == 201

    def test_criar_sem_campos_obrigatorios_retorna_400(self, client):
        resp = client.post('/api/itens', json={})
        assert resp.status_code == 400
```

### Fixtures do conftest.py

```python
# backend/tests/conftest.py — o que está disponível nos testes

@pytest.fixture
def client():
    """Cliente HTTP do Flask (sem I/O real no disco)."""
    ...

@pytest.fixture
def db_vazio():
    """Banco de dados vazio para testes isolados."""
    ...

@pytest.fixture
def db_com_dados():
    """Banco com dados pré-populados para testes de leitura."""
    ...
```

> 💡 **Dica**: Use sempre `client` em vez de fazer requisições HTTP reais — é mais rápido e isolado.

---

## 5. Frontend (Playwright) — Testes de Interface

### O que é testado

Testa a interface HTML no browser (headless Chromium):
- Carregamento de páginas
- Abertura/fechamento de modais
- Operações CRUD via interface
- Visualização de dados na tabela
- Filtros e buscas

### Executar via CLI

```powershell
# Todos os testes frontend
npx playwright test

# Arquivo específico
npx playwright test frontend/tests/pages/e2e-smoke.spec.js

# Por palavra-chave no nome do teste
npx playwright test --grep "modal"
npx playwright test --grep "opcoes|crypto"   # múltiplas palavras

# Com browser visível (para depurar)
npx playwright test --headed

# Com browser visível + lento (para acompanhar)
npx playwright test --headed --slow-mo=700

# Gerar relatório HTML
npx playwright test --reporter=html
npx playwright show-report .tmp/playwright-report

# Teste específico por arquivo e linha
npx playwright test frontend/tests/pages/e2e-smoke.spec.js:45

# Rodar com debug interativo (para inspecionar)
npx playwright test --debug

# Ver lista dos testes sem executar
npx playwright test --list
```

### Estrutura de um arquivo de teste frontend

```javascript
// frontend/tests/pages/meu-teste.spec.js
import { test, expect } from '@playwright/test';

test.describe('Módulo de Opções', () => {

    test.beforeEach(async ({ page }) => {
        // Navega antes de cada teste
        await page.goto('/html/opcoes.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
    });

    test('[Smoke] Página carrega sem erros', async ({ page }) => {
        // Verifica elemento principal
        await expect(page.locator('#tabelaOperacoes')).toBeVisible();
    });

    test('[CRUD] Criar operação via modal', async ({ page }) => {
        // Abre modal
        await page.locator('#btnNovaOperacao').click();
        await page.waitForSelector('#inputAtivo:visible', { timeout: 5000 });

        // Preenche campos
        await page.locator('#inputAtivo').fill('PETR4');
        await page.locator('#inputPremio').fill('1.50');

        // Salva
        await page.locator('#btnSalvar').click();

        // Verifica feedback
        await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });
    });

    test('[API] Buscar via requisição direta', async ({ page, request }) => {
        const resp = await request.get('/api/opcoes');
        expect(resp.status()).toBe(200);
        const data = await resp.json();
        expect(Array.isArray(data)).toBeTruthy();
    });
});
```

### Configuração principal — playwright.config.js

```javascript
// playwright.config.js (principais opções)
export default defineConfig({
    testDir:    './frontend/tests',
    testIgnore: ['**/e2e-usuario.spec.js'],   // E2E usuário tem config própria
    timeout:    15_000,                        // 15s por teste
    retries:    0,
    reporter:   [['json', { outputFile: 'tests/results/playwright_results.json' }], ['line']],
    use: {
        baseURL:    'http://localhost:8888',
        headless:   true,
        screenshot: 'only-on-failure',
    },
});
```

---

## 6. Testes de IA — Provedores de LLM

### O que é testado

Valida integração com APIs externas de inteligência artificial:
- Conectividade com Gemini API
- Conectividade com OpenRouter
- Formato de resposta dos provedores
- Análise de erros de teste (hint da IA)
- Fallback entre provedores

> ⚠️ **Esses testes fazem chamadas reais à internet.** Exigem chaves de API configuradas e consomem créditos dos provedores.

### Executar via CLI

```powershell
# Todos os testes de IA (marcados com live_api)
pytest backend/tests/test_ai_providers.py -m live_api -v

# Classe específica (ex: só Gemini)
pytest backend/tests/test_ai_providers.py::TestGeminiProvider -v -m live_api

# Teste específico
pytest backend/tests/test_ai_providers.py::TestGeminiProvider::test_chave_configurada -v

# Sem a marcação (inclui testes que não precisam de internet)
pytest backend/tests/test_ai_providers.py -v

# Com timeout aumentado (APIs podem demorar)
pytest backend/tests/test_ai_providers.py -m live_api -v --timeout=60
```

### Estrutura de um teste de IA

```python
# backend/tests/test_ai_providers.py
import pytest

class TestGeminiProvider:

    @pytest.mark.live_api
    def test_chave_configurada(self):
        """Verifica se a chave Gemini está no .env."""
        key = load_env_key('GEMINI_API_KEY')
        assert key, "GEMINI_API_KEY não encontrada em backend/.env"

    @pytest.mark.live_api
    def test_resposta_valida(self):
        """Faz chamada real e verifica formato da resposta."""
        # chama API real
        resp = chamar_gemini("Diga olá em duas palavras")
        assert resp is not None
        assert len(resp) > 0
```

---

## 7. E2E Usuário — Simulação de Digitação

### O que é testado

Testes de ponta-a-ponta que simulam um usuário **real** interagindo com a aplicação:
- Clicar em botões
- Digitar campo por campo com velocidade humana
- Verificar modais
- Salvar, editar e excluir registros
- Capturar screenshots em cada passo

> 🔑 **Diferença do Playwright padrão**: estes testes são mais lentos, têm `slow-mo` ativado e são projetados para ser **observados** enquanto rodam.

### Executar via CLI

```powershell
# Headless (sem ver o browser) — modo padrão
npx playwright test --config=playwright.usuario.config.js

# Com browser visível + slow-mo 700ms
npx playwright test --config=playwright.usuario.config.js --headed
# O slow-mo é configurado via variáveis de ambiente

# Com slow-mo via env (apenas Windows PowerShell)
$env:PW_HEADED='1'; $env:PW_SLOW_MO='700'; npx playwright test --config=playwright.usuario.config.js --headed

# Com screenshots sempre salvos
$env:PW_SCREENSHOTS='always'; npx playwright test --config=playwright.usuario.config.js

# Teste específico por palavra-chave
npx playwright test --config=playwright.usuario.config.js --grep "Opcoes-01"

# Múltiplos testes
npx playwright test --config=playwright.usuario.config.js --grep "Opcoes|Crypto"

# Via npm scripts (atalhos configurados)
npm run test:usuario              # headless
npm run test:usuario:headed       # com browser visível e slow-mo=700ms
npm run test:usuario:watch        # slow-mo=1200ms para observar com calma
```

### Screenshots

Os screenshots são salvos em `tests/results/screenshots/usuario-*.png`:

```
tests/results/screenshots/
├── usuario-opcoes-pagina-inicial.png
├── usuario-opcoes-modal-aberto.png
├── usuario-opcoes-formulario-preenchido.png
├── usuario-crypto-pagina-inicial.png
└── ...
```

### Estrutura de um teste E2E usuário

```javascript
// frontend/tests/pages/e2e-usuario.spec.js
import { test, expect } from '@playwright/test';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require    = createRequire(import.meta.url);
const fixtures   = require('../fixtures/opcoes-fixtures.json');

test.describe('[E2E-Usuario] Meu Módulo', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/html/opcoes.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        await shot(page, 'pagina-inicial');     // screenshot automático
    });

    test('[E2E-Usuario-Meu-01] Abrir modal', async ({ page }) => {
        const btn = page.locator('#btnNovaOperacao');
        await expect(btn).toBeVisible({ timeout: 5000 });

        console.log('  ▶ Clicando em Nova Operação...');
        await btn.click();

        // Aguarda modal abrir
        await page.waitForSelector('#inputAtivo:visible', { timeout: 8000 });
        await page.waitForTimeout(400);

        await shot(page, 'modal-aberto');

        const modal = page.locator('#modalOperacao');
        await expect(modal).toBeVisible();
        console.log('  ✓ Modal aberto com sucesso.');

        await page.keyboard.press('Escape');
    });

    test('[E2E-Usuario-Meu-02] Preencher formulário', async ({ page }) => {
        const op = fixtures.operacoes[0];   // usa fixture

        await page.locator('#btnNovaOperacao').click();
        await page.waitForSelector('#inputAtivo:visible', { timeout: 8000 });
        await page.waitForTimeout(400);

        // Preenche campo a campo (como usuário real)
        await page.locator('#inputAtivo').click();
        await page.locator('#inputAtivo').fill(op.ativo_base);
        await page.waitForTimeout(300);     // pausa entre campos

        await page.locator('#inputPremio').click();
        await page.locator('#inputPremio').fill(op.premio);
        await page.waitForTimeout(300);

        await shot(page, 'formulario-preenchido');

        // Salva
        await page.locator('#btnSalvarOperacao').click();
        await page.waitForTimeout(1000);
        await shot(page, 'apos-salvar');

        console.log('  ✓ Operação salva com sucesso.');
    });
});
```

### Variáveis de ambiente do E2E

| Variável | Valores | Efeito |
|---|---|---|
| `PW_HEADED` | `1` / `0` | Abre browser visível |
| `PW_SLOW_MO` | número (ms) | Atraso entre ações (ex: `700`) |
| `PW_SCREENSHOTS` | `always` / `on-error` / `never` | Quando capturar tela |
| `E2E_SCREENSHOTS` | mesmos acima | Usado internamente pelo spec |

---

## 8. Executar Tudo de Uma Vez

### Script de CI/CD completo

```powershell
# Windows — script oficial do projeto
.\run_all_tests.bat
```

O que `run_all_tests.bat` faz:
1. Inicia o servidor Flask (porta 8888)
2. Roda `pytest backend/tests/ -m "not live_api"` (testes backend sem IA)
3. Roda `npx playwright test` (testes frontend)
4. Para o servidor Flask
5. Exibe resumo com `[PASSOU]` ou `[FALHOU]`

> Os testes de IA (`live_api`) e E2E usuário são **excluídos do run_all_tests** por padrão para não bloquear CI.

### Executar tudo incluindo IA e E2E

```powershell
# Backend (com IA)
pytest backend/tests/ -v --json-report --json-report-file=tests/results/pytest_results.json

# Frontend Playwright
npx playwright test --reporter=json,line

# Testes de IA
pytest backend/tests/test_ai_providers.py -m live_api -v --json-report --json-report-file=tests/results/ai_results.json

# E2E usuário (headless)
npx playwright test --config=playwright.usuario.config.js
```

---

## 9. Criar Novos Testes

### 9.1 Criar teste Backend (pytest)

#### Passo a passo

**1. Identificar o endpoint** que você quer testar:
```
GET  /api/opcoes          → leitura
POST /api/opcoes          → criação
PUT  /api/opcoes/<id>     → update
DELETE /api/opcoes/<id>   → exclusão
```

**2. Criar ou editar o arquivo de teste:**
```powershell
# Criar arquivo novo (se for módulo novo)
# Arquivo: backend/tests/test_api_meuproduto.py

# Ou adicionar classe em arquivo existente
# Ex: backend/tests/test_api_opcoes.py
```

**3. Estrutura mínima:**
```python
# backend/tests/test_api_meuproduto.py
import pytest

class TestListarMeuProduto:
    """Testa GET /api/meuproduto"""

    def test_retorna_200(self, client):
        resp = client.get('/api/meuproduto')
        assert resp.status_code == 200

    def test_retorna_lista(self, client):
        resp = client.get('/api/meuproduto')
        data = resp.get_json()
        assert isinstance(data, list)

class TestCriarMeuProduto:
    """Testa POST /api/meuproduto"""

    PAYLOAD_VALIDO = {
        'nome':  'Produto Teste',
        'valor': 99.90,
    }

    def test_cria_com_dados_validos(self, client):
        resp = client.post('/api/meuproduto', json=self.PAYLOAD_VALIDO)
        assert resp.status_code in (200, 201)
        data = resp.get_json()
        assert 'id' in data

    def test_rejeita_payload_vazio(self, client):
        resp = client.post('/api/meuproduto', json={})
        assert resp.status_code == 400
```

**4. Verificar que o teste funciona:**
```powershell
pytest backend/tests/test_api_meuproduto.py -v
```

**5. O dashboard irá detectar automaticamente** o novo arquivo na próxima vez que recarregar a lista de testes (`/api/tests`).

#### Boas práticas para testes backend

- Uma classe por endpoint/operação (`TestListar`, `TestCriar`, etc.)
- Nomes de testes descritivos: `test_retorna_404_quando_nao_existe`
- Sempre testar casos de sucesso **e** de falha (status 400, 404, 500)
- Usar `PAYLOAD_VALIDO` como constante de classe
- Isolar efeitos colaterais: cada teste deve ser independente

---

### 9.2 Criar teste Frontend (Playwright)

#### Passo a passo

**1. Identificar a funcionalidade** a ser testada (página, modal, botão)

**2. Criar o arquivo spec:**
```
frontend/tests/pages/meu-modulo.spec.js
```

**3. Estrutura base:**
```javascript
// frontend/tests/pages/meu-modulo.spec.js
import { test, expect } from '@playwright/test';

test.describe('Meu Módulo', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/html/meu-modulo.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);
    });

    test('[Smoke] Página carrega', async ({ page }) => {
        await expect(page.locator('body')).toBeVisible();
        // Sem erros no console
        const errors = [];
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await page.reload();
        expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });

    test('[Modal] Abrir modal de criação', async ({ page }) => {
        // Clica no botão
        await page.locator('#btnNovo').click();

        // Aguarda modal
        await page.waitForSelector('.modal.show', { timeout: 5000 });

        // Verifica campos
        await expect(page.locator('#inputNome')).toBeVisible();
    });

    test('[CRUD] Criar e verificar na lista', async ({ page, request }) => {
        // Cria via API (mais rápido que UI)
        const resp = await request.post('/api/meuproduto', {
            data: { nome: 'Teste CRUD', valor: 100 },
        });
        expect(resp.status()).toBe(201);

        // Recarrega e verifica
        await page.reload();
        await page.waitForTimeout(600);

        const tabela = page.locator('table tbody');
        await expect(tabela).toContainText('Teste CRUD');
    });
});
```

**4. Verificar:**
```powershell
npx playwright test frontend/tests/pages/meu-modulo.spec.js --headed
```

**5. O dashboard detecta automaticamente** ao recarregar `/api/tests`.

---

### 9.3 Criar teste E2E de usuário

Use para fluxos que precisam ser **observados** ou têm muita interação humana.

**1. Adicionar no `e2e-usuario.spec.js`** (arquivo único para E2E usuário):

```javascript
// No mesmo arquivo: frontend/tests/pages/e2e-usuario.spec.js
// Adicionar novo describe após os existentes:

test.describe('[E2E-Usuario] Minha Nova Funcionalidade', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/html/minha-pagina.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        await shot(page, 'minha-pagina-inicial');
    });

    test('[E2E-Usuario-MF-01] Abrir modal', async ({ page }) => {
        console.log('  ▶ Verificando botão principal...');
        const btn = page.locator('#btnPrincipal');
        await expect(btn).toBeVisible({ timeout: 5000 });
        await btn.click();

        await page.waitForSelector('#inputPrincipal:visible', { timeout: 8000 });
        await shot(page, 'mf-modal-aberto');

        await expect(page.locator('#modalPrincipal')).toBeVisible();
        console.log('  ✓ Modal aberto.');
        await closeModal(page);
    });
});
```

**Convenção de nomes:**
- Grupo: `[E2E-Usuario-CodigoModulo]`
- Código do módulo: 2-4 letras maiúsculas (ex: `MF`, `CR`, `OPC`)
- Número sequencial: `01`, `02`, `03`
- Exemplo completo: `[E2E-Usuario-MF-01] Abrir modal`

---

### 9.4 Criar fixture de dados

Quando precisar de dados de teste reutilizáveis, adicione em:

```
frontend/tests/fixtures/meu-modulo-fixtures.json
```

```json
{
  "_descricao_arquivo": "Dados de teste para Meu Módulo",
  "operacoes": [
    {
      "_descricao": "Caso padrão — dados válidos completos",
      "nome":     "Produto A",
      "valor":    150.00,
      "tipo":     "COMPRA",
      "status":   "ABERTA"
    },
    {
      "_descricao": "Caso encerrado — status FECHADA",
      "nome":     "Produto B",
      "valor":    200.00,
      "tipo":     "VENDA",
      "status":   "FECHADA"
    }
  ],
  "crud_test": {
    "_descricao": "Usado em testes CRUD automatizados — será deletado",
    "nome":   "Produto CRUD Teste",
    "valor":  99.99,
    "tipo":   "COMPRA"
  }
}
```

Importar na spec:
```javascript
import { createRequire } from 'module';
const require  = createRequire(import.meta.url);
const meusFx   = require('../fixtures/meu-modulo-fixtures.json');

// Usar:
const op = meusFx.operacoes[0];
await page.locator('#inputNome').fill(op.nome);
```

---

## 10. Manter e Alterar Testes Existentes

### Atualizar um teste que parou de funcionar

**1. Identificar o erro no dashboard** → clique no teste com ❌ → leia a mensagem de erro no modal

**2. Causas mais comuns de quebra:**

| Sintoma | Causa provável | Solução |
|---|---|---|
| `AssertionError: 404` | Endpoint mudou de rota | Atualizar URL no teste |
| `TimeoutError: locator` | Seletor CSS mudou | Inspecionar HTML e atualizar seletor |
| `AssertionError: campo X ausente` | Response da API mudou | Atualizar campos verificados |
| `ConnectionRefused` | Flask não está rodando | Iniciar servidor: `python backend/server.py` |
| `KeyError: 'nome_campo'` | Fixture desatualizada | Atualizar `fixtures/*.json` |

**3. Alterar seletor CSS no Playwright:**
```powershell
# Inspecionar elemento no browser
npx playwright codegen http://localhost:8888/html/opcoes.html
```
O `codegen` abre o browser e gera automaticamente o seletor ao clicar.

### Renomear ou mover um teste

```python
# ANTES
class TestListarOpcoes:
    def test_lista_vazia(self, client): ...

# DEPOIS — renomear preservando compatibilidade backward
class TestListarOpcoes:
    # Manter nome antigo como alias se necessário
    def test_lista_vazia(self, client): ...           # mantém
    def test_retorna_vazio_sem_dados(self, client): ... # novo nome
```

> ⚠️ Renomear testes quebra o histórico de resultados no dashboard. Se precisar, depois clique "Zerar Resultados" para limpar.

### Desabilitar um teste temporariamente

```python
# Python (pytest) — marcar como skip
@pytest.mark.skip(reason="API em manutenção até 2026-04-01")
def test_criar_operacao(self, client): ...

# Com condição
@pytest.mark.skipif(not os.getenv('API_KEY'), reason="Chave não configurada")
def test_chama_api_externa(self): ...
```

```javascript
// JavaScript (Playwright) — marcar como skip
test.skip('[E2E] Teste com bug conhecido', async ({ page }) => { ... });

// Skip condicional
test('[E2E] Funcionalidade nova', async ({ page }) => {
    test.skip(process.env.CI === '1', 'Pulado no CI até feature flag ser ativado');
    // ... código do teste
});
```

### Atualizar fixtures

Quando a estrutura de dados mudar:

```json
// frontend/tests/fixtures/opcoes-fixtures.json
// ANTES: campo "premio" era string
// DEPOIS: passou a ser número decimal
{
  "operacoes": [
    {
      "premio": "0.85"   ← string (antigo)
      "premio": 0.85     ← number (novo)
    }
  ]
}
```

Após mudar a fixture, verificar todos os testes que a usam:
```powershell
# Buscar usos da fixture nos specs
grep -r "opcoes-fixtures" frontend/tests/
```

---

## 11. Fixtures e Dados de Teste

### Fixtures pytest (conftest.py)

```python
# backend/tests/conftest.py
import pytest
from backend.server import app as flask_app

@pytest.fixture(scope='function')
def client():
    """Cliente HTTP Flask isolado por função"""
    flask_app.config['TESTING']   = True
    flask_app.config['DATABASE']  = ':memory:'  # SQLite em memória
    with flask_app.test_client() as c:
        yield c

@pytest.fixture
def operacao_aberta(client):
    """Cria uma operação e retorna o ID"""
    resp = client.post('/api/opcoes', json={
        'ativo': 'PETR4', 'tipo': 'CALL', 'premio': '1.00', ...
    })
    return resp.get_json()['id']
```

### Fixtures Playwright (JSON)

```
frontend/tests/fixtures/
├── opcoes-fixtures.json    ← dados de opções
└── crypto-fixtures.json    ← dados de crypto
```

Convenção dos campos:
- `_descricao` — comentário humano sobre o caso de teste (prefixo `_` = ignorado pela app)
- `operacoes` — array de casos de teste para o describe principal
- `crud_test` — dados para testes de CRUD automatizado (será criado e excluído)

---

## 12. Referência Rápida de Comandos

### Backend (pytest)

```powershell
# Todos
pytest backend/tests/ -v -m "not live_api"

# Um arquivo
pytest backend/tests/test_api_opcoes.py -v

# Uma classe
pytest backend/tests/test_api_opcoes.py::TestCriarOpcao -v

# Um teste
pytest backend/tests/test_api_opcoes.py::TestCriarOpcao::test_criar_opcao_retorna_sucesso -v

# Por palavra-chave
pytest backend/tests/ -k "criar or listar" -v

# Só falhas, parar no primeiro erro
pytest backend/tests/ -v -x --tb=short

# Com relatório JSON
pytest backend/tests/ -v --json-report --json-report-file=tests/results/pytest_results.json
```

### Frontend (Playwright)

```powershell
# Todos
npx playwright test

# Um arquivo
npx playwright test frontend/tests/pages/e2e-smoke.spec.js

# Por nome
npx playwright test --grep "Criação de Operação"

# Vários nomes
npx playwright test --grep "opcoes|crypto"

# Com browser
npx playwright test --headed

# Ver relatório HTML
npx playwright show-report .tmp/playwright-report
```

### Testes de IA

```powershell
# Todos
pytest backend/tests/test_ai_providers.py -m live_api -v

# Classe específica
pytest backend/tests/test_ai_providers.py::TestGeminiProvider -v

# Teste específico
pytest backend/tests/test_ai_providers.py::TestGeminiProvider::test_chave_configurada -v
```

### E2E Usuário (Playwright)

```powershell
# Headless
npx playwright test --config=playwright.usuario.config.js

# Com browser visível (slow normal)
$env:PW_HEADED='1'; $env:PW_SLOW_MO='700'
npx playwright test --config=playwright.usuario.config.js --headed

# Com browser bem lento (observação detalhada)
$env:PW_HEADED='1'; $env:PW_SLOW_MO='1500'
npx playwright test --config=playwright.usuario.config.js --headed

# Por nome
npx playwright test --config=playwright.usuario.config.js --grep "Opcoes"

# Via npm
npm run test:usuario
npm run test:usuario:headed
npm run test:usuario:watch

# Screenshot sempre
$env:PW_SCREENSHOTS='always'
npx playwright test --config=playwright.usuario.config.js
```

### Dashboard

```powershell
# Iniciar dashboard
python tests/test_server.py
# Acessar: http://localhost:8883

# Ou via script
.\start.bat
```

### Tudo de uma vez (CI)

```powershell
.\run_all_tests.bat
```

---

## 13. Solução de Problemas Comuns

### ❌ `ConnectionRefusedError` / Flask não responde

```powershell
# Verificar se Flask está rodando
netstat -an | findstr 8888

# Iniciar Flask manualmente
python backend/server.py

# Verificar se porta está em uso por outro processo
Get-NetTCPConnection -LocalPort 8888
```

### ❌ `TimeoutError: locator('#elemento')` (Playwright)

```powershell
# Debug interativo — clicar no elemento e gerar seletor correto
npx playwright codegen http://localhost:8888/html/opcoes.html

# Aumentar timeout no teste
await page.waitForSelector('#elemento', { timeout: 15000 });
```

### ❌ Testes de IA retornam `AssertionError: API key não configurada`

```
backend/.env deve conter:
GEMINI_API_KEY=AIzaSy...
OPENROUTER_API_KEY=sk-or-...
```

### ❌ E2E usuário: `error: unknown option '--slow-mo'`

O `--slow-mo` é configurado via variável de ambiente `PW_SLOW_MO`, não como flag CLI:
```powershell
# Correto
$env:PW_SLOW_MO='700'; npx playwright test --config=playwright.usuario.config.js --headed

# Incorreto (não funciona)
npx playwright test --slow-mo=700   ← esse erro
```

### ❌ Dashboard mostra 0 testes

```powershell
# Verificar se test_server.py está rodando na porta 8883
netstat -an | findstr 8883

# Reiniciar
python tests/test_server.py
```

### ❌ Resultados do dashboard desatualizados

1. Clique `☰` → **"Zerar Resultados"** para resetar o histórico
2. Execute os testes novamente
3. Os resultados são salvos em `tests/results/*.json`

### ❌ Novo teste não aparece no dashboard

O dashboard escaneia os arquivos ao carregar. Para ele detectar novos testes:
1. Salve o arquivo `.py` ou `.spec.js`
2. Clique `☰` → **"Zerar Resultados"** (recarrega a lista de testes)
3. Ou simplesmente recarregue o dashboard no browser (`F5`)

### ❌ Screenshot não salvo no E2E

```powershell
# Verificar se diretório existe
ls tests/results/screenshots/

# Criá-lo manualmente se não existir
mkdir tests/results/screenshots

# Ou definir PW_SCREENSHOTS para garantir captura
$env:PW_SCREENSHOTS='always'
npx playwright test --config=playwright.usuario.config.js
```

---

## Apêndice — Estrutura Completa de Testes

```
Tipo          Arquivo                              Testes  Tempo
──────────────────────────────────────────────────────────────────
Backend       test_api_agenda.py                       3   ~0.01s
Backend       test_api_atendimento.py                  4   ~0.01s
Backend       test_api_auth.py                         5   ~0.01s
Backend       test_api_financeiro.py                   4   ~0.01s
Backend       test_api_opcoes.py                      16   ~0.02s
Backend       test_api_relatorios.py                   3   ~0.01s
Backend       test_api_crypto.py (se existir)         12   ~0.02s
──────────────────────────────────────────────────────────────────
Frontend      e2e-smoke.spec.js                       28   ~45s
Frontend      *.spec.js (outros)                      13   ~10s
──────────────────────────────────────────────────────────────────
IA            test_ai_providers.py (@live_api)        12   ~60-120s
──────────────────────────────────────────────────────────────────
E2E Usuário   e2e-usuario.spec.js                      9   ~3-5min
──────────────────────────────────────────────────────────────────
TOTAL                                               ~109
```

---

*Manual gerado para o projeto Controle Operações.*  
*Para sugestões ou correções, edite este arquivo diretamente.*

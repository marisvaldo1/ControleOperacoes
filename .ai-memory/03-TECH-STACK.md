# 03 — TECH-STACK: Dependências e Decisões

## Backend (Python)

| Pacote | Versão | Uso |
|--------|--------|-----|
| flask | 3.x | Framework web |
| flask-cors | 5.x | CORS para dev local |
| python-dotenv | 1.x | Carregar .env |
| requests | 2.x | Chamadas HTTP (OpLab, APIs de IA) |
| certifi | latest | Certificados SSL para OpLab |
| yfinance | 0.2.x | Cotações em tempo real (grátis, delay 5-10min) |

### Python
- Versão: **3.13.0**
- Executável: `D:\laragon\bin\python\python-3.13\python.exe`
- **Sem virtualenv** — usa Python global

---

## Frontend (Browser)

| Biblioteca | CDN / Local | Uso |
|-----------|-------------|-----|
| Bootstrap 5 | CDN | Layout, componentes |
| Tabler Icons | CDN | Ícones |
| DataTables | CDN | Tabelas interativas |
| Chart.js | CDN | Gráficos |
| Moment.js | CDN | Datas/horas |
| jQuery | CDN | DataTables dependency |

### JavaScript
- Vanilla JS (sem bundler, sem npm)
- ES Modules via `<script>` tags diretas
- `js/core/libs.js` → carrega todas as libs CDN
- `js/core/global.js` → constantes, fetch helpers
- `js/core/layout.js` → sidebar, navegação

---

## Testes

| Ferramenta | Configuração | Executa |
|-----------|-------------|---------|
| pytest | `pytest.ini` (raiz) | `python -m pytest backend/tests/` |
| Playwright | `playwright.config.js` (raiz) | `npx playwright test` |

### Pytest
- `backend/tests/conftest.py` → mock do banco via `db.get_db`
- As rotas importam `db.get_db` via `import db`, logo o mock propagado funciona

### Playwright
- `testDir: "./frontend/tests"`
- `baseURL: "http://localhost:8888"`
- `globalSetup: "./frontend/tests/setup/global-setup.js"`
- Resultados: `tests/results/playwright_results.json`

---

## Banco de dados

- SQLite — arquivo único, sem servidor
- Path: `backend/data/controle_operacoes.db`
- Migração: `db.py:_safe_add_columns()` — adiciona colunas sem quebrar base existente

---

## Providers de IA (configuráveis)

| Provider | Variável .env | Modelo padrão |
|---------|--------------|---------------|
| OpenRouter | OPENROUTER_API_KEY | openai/gpt-3.5-turbo |
| Grok (xAI) | GROK_API_KEY | grok-2-latest |
| DeepSeek | DEEPSEEK_API_KEY | deepseek-chat |
| OpenAI | OPENAI_API_KEY | gpt-3.5-turbo |
| Gemini | GEMINI_API_KEY | gemini-2.5-flash (fallback automático) |

Prioridade: configurada pelo usuário via `/api/config-ia`, fallback automático.

---

## Decisões de Design

| Decisão | Razão |
|---------|-------|
| Flask sem virtualenv | Ambiente do usuário já configurado |
| SQLite sem ORM | Simplicidade, sem dependências extras |
| `import db; db.get_db()` (não `from db import get_db`) | Permite mock centralizado nos testes |
| Arquivos JS/CSS copiados para subpastas (não movidos) | Compatibilidade retroativa durante migração |
| `modal-analise.js` como shared com `configure()` | Um arquivo para dois módulos (não duplicar) |
| Blueprint por domínio | Cada arquivo < 250 linhas, testável isoladamente |

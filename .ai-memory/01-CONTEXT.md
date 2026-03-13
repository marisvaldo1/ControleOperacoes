# 01 — CONTEXT: Descrição do Projeto

## O que é este sistema

**ControleOperacoes** — plataforma web local para controle pessoal de investimentos em:
- **Opções de B3**: travas de alta/baixa, CALL e PUT sobre ações brasileiras
- **Crypto**: Dual Investment (Binance), Opções sobre BTC/ETH, Spot, Hold, Futures, Staking

### Usuário-alvo
Investidor individual que opera opções na B3 e investe em crypto, buscando controle de resultados, análise de posições abertas e recomendações de IA.

---

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.13, Flask 3.x, Flask-CORS |
| Banco | SQLite (`backend/data/controle_operacoes.db`) |
| Dados externos | OpLab API (B3), yfinance (cotações), Binance REST API |
| IA | OpenAI, DeepSeek, Grok (xAI), Gemini (Google), OpenRouter |
| Frontend | HTML5, Bootstrap 5, Tabler Icons, DataTables, Chart.js |
| Testes | pytest (backend), Playwright (E2E frontend) |

---

## Como rodar

```bat
cd d:\Sistemas\python\ControleOperacoes
.\start.bat
```
Acessa: http://localhost:8888/html/opcoes.html  
Crypto: http://localhost:8888/html/crypto.html

## Como testar

```bat
.\run_all_tests.bat
```
Resultado: `tests/results/playwright_results.json` e `tests/results/pytest_results.json`

---

## Portas e endpoints principais

| Endpoint | Módulo | Descrição |
|----------|--------|-----------|
| `/api/opcoes` | opcoes | CRUD operações B3 |
| `/api/crypto` | crypto | CRUD operações crypto |
| `/api/crypto/estrategias` | crypto | Lista tipos de estratégia |
| `/api/analyze` | ai | Análise de IA (multi-provider) |
| `/api/config` | config | Leitura/gravação de configurações |
| `/api/available-ais` | config | IAs disponíveis |
| `/api/proxy/options/<ticker>` | market | Cadeia de opções (OpLab) |
| `/api/cotacao/realtime/<ticker>` | market | Cotação em tempo real (yfinance) |
| `/api/cotacao/hibrido/<ticker>` | market | Híbrido: spot yfinance + opções OpLab |
| `/api/proxy/crypto/<ticker>` | market | Preço crypto (Binance) |
| `/api/version` | geral | Versão do sistema |

---

## Variáveis de Ambiente (`.env` em `backend/`)

```env
OPLAB_API_KEY=...
OPENAI_API_KEY=...       # opcional
DEEPSEEK_API_KEY=...     # opcional
GROK_API_KEY=...         # opcional
GEMINI_API_KEY=...       # opcional
OPENROUTER_API_KEY=...   # opcional
OPLAB_SSL_VERIFY=auto    # auto | true | false
```

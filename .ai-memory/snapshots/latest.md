# AI PROJECT SNAPSHOT
> Cole todo este arquivo na IA para retomar o projeto sem perder contexto.
> Gerado em: 2026-04-10 15:40:38 | Branch: master

---

## COMO RETOMAR
1. Leia `.ai-memory/00-ENTRYPOINT.md` para instruções completas.
2. Use este snapshot como estado inicial da conversa.
3. Diga à IA: *"Leia o snapshot abaixo e continue de onde paramos."*

---

## GIT — últimos 5 commits
4401226 2026-04-10 Ajustes de layout
ffbe5de 2026-04-06 Ajustes de layout
1be511c 2026-04-02 Ajustes nos servicos do cliente
3716e53 2026-03-24 Tela de resultados
3aa8644 2026-03-20 Tela de resultados

## Arquivos alterados no último commit
.ai-memory/05-STATE.md
.ai-memory/08-CHANGELOG.md
.ai-memory/09-PROMPTS.md
.ai-memory/prompts_log.txt
.ai-memory/snapshots/latest.md
backend/data/controle_operacoes.db
backend/models/__pycache__/__init__.cpython-313.pyc
backend/models/__pycache__/crypto_exercise.cpython-313.pyc
backend/models/crypto_exercise.py
backend/routes/__pycache__/crypto.cpython-313.pyc
backend/routes/crypto.py
backend/tests/__pycache__/conftest.cpython-313-pytest-8.3.4.pyc
backend/tests/__pycache__/conftest.cpython-313-pytest-8.3.4.pyc.52116
backend/tests/__pycache__/conftest.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_ai_providers.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_agenda.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_analyze.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_atendimento.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_auth.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_config.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_crypto.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_financeiro.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_opcoes.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_pacientes.cpython-313-pytest-9.0.2.pyc
backend/tests/__pycache__/test_api_relatorios.cpython-313-pytest-9.0.2.pyc
backend/tests/test_api_crypto.py
frontend/css/crypto/modal-analise-detalhe-crypto.css
frontend/html/crypto.html
frontend/html/modal-analise-detalhe-crypto.html
frontend/js/core/crypto-exercise.js
frontend/js/crypto.js
frontend/js/crypto/crypto.js
frontend/js/crypto/modal-analise-detalhe-crypto.js
frontend/js/crypto/modal-detalhe-crypto.js
frontend/js/crypto/modal-detalhe-operacao-crypto.js
frontend/js/crypto/modal-resultado-total-crypto.js
frontend/js/crypto/modal-resultados-crypto-compact.js
frontend/js/opcoes/modal-detalhe-opcoes.js
ideias/Claude1.html
ideias/resumo-investimento-7-ideias.html
ideias/strike_vs_cotacao_7_ideias.html
ideias/t1.html
start.bat
start_hidden.ps1
start_silent.vbs
tests/results/playwright_results.json
tests/results/pytest_results.json

---

## CONTEXTO
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
| `/api/crypto/estrategias` | crypto | Lista 

... [truncado — 854 chars omitidos]

---

## ARQUITETURA
# 02 — ARCHITECTURE: Estrutura do Projeto

## Visão Geral

```
ControleOperacoes/
├── backend/                    ← Servidor Flask (Python)
│   ├── server.py               ← Entry point: registra Blueprints
│   ├── db.py                   ← Utilitários de banco (get_db, init_db)
│   ├── routes/                 ← Flask Blueprints por domínio
│   │   ├── crypto.py           ← /api/crypto — CRUD + estratégias
│   │   ├── opcoes.py           ← /api/opcoes — CRUD + refresh
│   │   ├── config.py           ← /api/config, /api/available-ais
│   │   ├── ai.py               ← /api/analyze — multi-provider IA
│   │   └── market.py           ← /api/proxy/*, /api/cotacao/*
│   ├── tests/
│   │   ├── conftest.py         ← Fixtures (mock db.get_db)
│   │   ├── test_api_analyze.py
│   │   ├── test_api_con

... [truncado — 4355 chars omitidos]

---

## TECH STACK
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
| Moment.j

... [truncado — 2124 chars omitidos]

---

## REGRAS PARA A IA
# 04 — RULES: Regras de Comportamento da IA

## Idioma
- Sempre responder em **português do Brasil**
- Código: variáveis, comentários e mensagens em português quando possível

## Postura Crítica
- Não concordar automaticamente — analisar riscos e trade-offs
- Sempre sugerir ao menos uma melhoria mesmo quando a solução está correta
- Priorizar respostas objetivas e técnicas

## Antes de Sugerir Alterações
1. Identificar a camada impactada (backend, frontend, banco, testes)
2. Se contexto insuficiente: fazer até 3 perguntas objetivas
3. Informar o caminho do arquivo ao sugerir mudanças

## Padrã

... [truncado — 1362 chars omitidos]

---

## ESTADO ATUAL (auto)
# STATE (auto)

Última atualização: 2026-04-10 15:40:36
Branch: master

## Commits recentes (últimos 10)
  4401226 | 2026-04-10 | â€œMarisvaldoâ€ | Ajustes de layout
  ffbe5de | 2026-04-06 | â€œMarisvaldoâ€ | Ajustes de layout
  1be511c | 2026-04-02 | â€œMarisvaldoâ€ | Ajustes nos servicos do cliente
  3716e53 | 2026-03-24 | â€œMarisvaldoâ€ | Tela de resultados
  3aa8644 | 2026-03-20 | â€œMarisvaldoâ€ | Tela de resultados
  edbb352 | 2026-03-19 | â€œMarisvaldoâ€ | Tela de resultados
  fd1a31d | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
  c9934aa | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
  c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
  6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais

## Working tree
  M backend/data/controle_operacoes.db
   M frontend/components/modals/crypto/modal-resultados-crypto-compact.html
   M frontend/css/crypto/modal-analise-detalhe-crypto.css
   M frontend/js/core/crypto-exercise.js
   M frontend/js/crypto/modal-analise-detalhe-crypto.js
   M frontend/js/crypto/modal-dashboard-crypto.js
   M frontend/js/crypto/modal-resultados-crypto-compact.js
   M frontend/js/crypto/modal-saldo-medio-crypto.js
   M tests/results/playwright_results.json
   M tests/results/pytest_results.json
  ?? backend/tests/__pycache__/

## Arquivos mais tocados (últimos 20 commits)
- .ai-memory/00-ENTRYPOINT.md
- .ai-memory/01-CONTEXT.md
- .ai-memory/02-ARCHITECTURE.md
- .ai-memory/03-TECH-STACK.md
- .ai-memory/04-RULES.md
- .ai-memory/05-

... [truncado — 740 chars omitidos]

---

## TAREFAS
# 06 — TASKS: Tarefas e Próximos Passos

## Concluídas (esta sessão)
- [x] Análise da estrutura atual e posicionamento técnico
- [x] Criação da estrutura de pastas (16 novas pastas)
- [x] `backend/db.py` — utilitários de banco centralizados
- [x] `backend/routes/crypto.py` — Blueprint crypto com suporte a tipo_estrategia
- [x] `backend/routes/opcoes.py` — Blueprint opcoes com normalize_resultado
- [x] `backend/routes/config.py` — Blueprint config/IA
- [x] `backend/routes/ai.py` — Blueprint AI multi-provider
- [x] `backend/routes/market.py` — Blueprint market/proxy
- [x] `backend/server.py` refatorado (thin entry point)
- [x] Testes pytest atualizados (mock `db.get_db` em vez de `server.get_db`)
- [x] Frontend JS/CSS copiados para subpastas organizadas
- [x] HTML atualizado com novos paths

## Pendentes (próxima sessão)

### Alta Prioridade
- [ ] **Verificar testes Playwright** — confirmar que os E2E passam com novos paths dos assets
- [ ] **Limpar duplicatas** — após E2E OK, remover arquivos originais `js/*.js` e `css/*.css` que foram copiados para subpastas

### Média Prioridade
- [ ] **Testes específicos de crypto** — criar `backend/tests/crypto/test_api_crypto_estrategias.py`
- [ ] **Testes Playwright por módulo** — criar `frontend/tests/pages/opcoes/` e `frontend/tests/pages/crypto/`
- [ ] **tipo_estrategia na UI** — adicionar campo de estratégia no modal de nova operação crypto
- [ ] **Campo observacoes na UI** — textarea de observações no modal de crypto

### Baixa Prio

... [truncado — 169 chars omitidos]

---

## DECISÕES RECENTES (ADR)
(sem decisões registradas)

---

## ÚLTIMOS PROMPTS ENVIADOS
[2026-04-10 14:36:14]  fonte: clipboard
Bedrock

[2026-04-08 15:10:06]  fonte: clipboard
//+------------------------------------------------------------------+
//|                                                   Hedge_IA.mq5   |
//|  Replica operacional baseada em parametros/logs do BS Hedge IA   |
//+------------------------------------------------------------------+
#property strict
#property version   "4.11"
#property copyright "Hedge_IA"

#include <Trade\Trade.mqh>
#include <Tra...

[2026-04-01 16:08:22]  fonte: clipboard
Esse filtro da imagem nÃ£o estÃ¡ sendo aplicado nessa tela.

Preciso de uma tela que analise minha posiÃ§Ã£o atual pra ser colocada em uma nova aba nessa tela da imagem. aba Resultado Final
O que aconteceu foi que fui exercido em call a 74.000 (btc) e fui fazendo venda de put porÃ©m fui exercido a 68,500. Portanto um prejuÃ­zo. Preciso de uma tela que mostre a execuÃ§Ã£o da Ãºltima call, as operaÃ...

[2026-04-01 09:56:44]  fonte: clipboard
10037396267

[2026-03-31 11:28:20]  fonte: clipboard
https://sei.correios.com.br/sei/controlador.php?acao=procedimento_trabalhar&acao_origem=procedimento_gerar&acao_retorno=procedimento_escolher_tipo&id_procedimento=70129174&atualizar_arvore=1&infra_sistema=100000100&infra_unidade_atual=439410&infra_hash=9a73d05b47d666fe32c75c5c621edb62550b1b592ead4c2dacb4dcd9228445dd#ID-70129174

---

*Se faltar contexto, peça o arquivo específico. Não invente.*

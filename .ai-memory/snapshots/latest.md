# AI PROJECT SNAPSHOT
> Cole todo este arquivo na IA para retomar o projeto sem perder contexto.
> Gerado em: 2026-03-18 15:38:08 | Branch: master

---

## COMO RETOMAR
1. Leia `.ai-memory/00-ENTRYPOINT.md` para instruções completas.
2. Use este snapshot como estado inicial da conversa.
3. Diga à IA: *"Leia o snapshot abaixo e continue de onde paramos."*

---

## GIT — últimos 5 commits
fd1a31d 2026-03-13 Tela de cryptos
c9934aa 2026-03-13 Tela de cryptos
c8f34d5 2026-03-05 Tela de testes
6482359 2026-02-23 Janela de totais finais
308a0b6 2026-02-23 Janela de totais finais

## Arquivos alterados no último commit
.ai-memory/05-STATE.md
.ai-memory/08-CHANGELOG.md
.ai-memory/09-PROMPTS.md
.ai-memory/prompts_log.txt
.ai-memory/snapshots/latest.md
_setup_arch.py
backend/data/controle_operacoes.db
backend/routes/__pycache__/opcoes.cpython-313.pyc
backend/routes/opcoes.py
backend/tests/test_api_opcoes.py
frontend/components/modals/opcoes/modal-analise.html
frontend/css/opcoes/opcoes.css
frontend/html/crypto.html
frontend/html/opcoes.html
frontend/js/opcoes/opcoes.js
frontend/js/shared/modal-analise.js

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

Última atualização: 2026-03-18 15:38:06
Branch: master

## Commits recentes (últimos 10)
  fd1a31d | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
  c9934aa | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
  c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
  6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
  308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
  0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
  8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
  2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
  10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
  0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths

## Working tree
  M .ai-memory/05-STATE.md
   M .ai-memory/08-CHANGELOG.md
   M .ai-memory/09-PROMPTS.md
   M .ai-memory/prompts_log.txt
   M .ai-memory/snapshots/latest.md
   M .gitignore
   M backend/data/controle_operacoes.db
   M backend/routes/__pycache__/crypto.cpython-313.pyc
   M backend/routes/crypto.py
   M backend/tests/__pycache__/test_api_crypto.cpython-313-pytest-9.0.2.pyc
   M backend/tests/__pycache__/test_api_opcoes.cpython-313-pytest-9.0.2.pyc
   M backend/tests/test_api_crypto.py
   M frontend/components/modals/crypto/modal-dashboard-crypto.html
   M frontend/html/crypto.html
   M frontend/html/opcoes.html
   M frontend/js/core/layout.js
   M frontend/js/core/libs.js
   M frontend/js/crypto/crypto.js
   M frontend/js/crypt

... [truncado — 614 chars omitidos]

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
[2026-03-16 14:19:43]  fonte: clipboard
Em opcÃ£o, cliquei no botÃ£o fechar operaÃ§Ã£o. Veja a imagem. E agora a operaÃ§Ã£o PETRO424W2 estÃ¡ mostrando que foi exercida e nÃ£o foi. Veja o cÃ¡lculo para apurar o exercÃ­cio. Note que o valor fechado oi menor que o strike. Portando a venda de put nÃ£o foi exercida. Verifique esse cÃ¡lculo e ajuste o resultado na tela.


Na tela de cypto, preciso corrigir essa tela da imagem 1
Nessa mesma te...

[2026-03-16 14:19:11]  fonte: clipboard
Em opcÃ£o, cliquei no botÃ£o fechar operaÃ§Ã£o. Veja a imagem. E agora a operaÃ§Ã£o PETRO424W2 estÃ¡ mostrando que foi exercida e nÃ£o foi. Veja o cÃ¡lculo para apurar o exercÃ­cio. Note que o valor fechado oi menor que o strike. Portando a venda de put nÃ£o foi exercida. Verifique esse cÃ¡lculo e ajuste o resultado na tela.


Na tela de cypto, preciso corrigir essa tela da imagem 1
Nessa mesma te...

[2026-03-13 16:52:09]  fonte: clipboard
Na tela de anÃ¡lise temporal de performance de crypto veio totamente vazia em todas as abas
Recebendo esses erros
Uncaught (in promise) TypeError: Cannot read properties of null (reading 'includes')
    at AutofillOverlayContentService.<anonymous> (bootstrap-autofill-overlay.js:9562:81)
    at Generator.next (<anonymous>)
    at bootstrap-autofill-overlay.js:8522:71
    at new Promise (<anonymous>...

[2026-03-12 09:04:29]  fonte: clipboard
Todas os ajustes abaixo dizem respeito Ã  tela de crypto
Preciso de ajustes no calculo de dias de duraÃ§Ã£o da operaÃ§Ã£o. Verificar o cÃ¡lculo para ser Ãºnico e utilizado em todas as telas. Veja a imagem abaixo e anlise segundo a data atual e a data de vencimento e verifique o o cÃ¡lculo de dias esta errado.  Hoje sÃ£o 12/03 o vencimento 13/03 portanto deveria aparecer 2 dias e nÃ£o 4 como estÃ¡ ...

[2026-03-12 08:35:57]  fonte: clipboard
[Thu Mar 12 08:29:21 2026] 127.0.0.1:58597 [200]: GET /resultados/results.json?_=1773314961912
[Thu Mar 12 08:29:21 2026] 127.0.0.1:58597 Closing

---

*Se faltar contexto, peça o arquivo específico. Não invente.*

# ARQUITETURA — Controle de Operações v2.0.0

> Documento gerado em 2025-07-09 após refatoração major da sessão de arquitetura.

---

## Visão Geral

O sistema é uma aplicação web local (sem login, porta **8888**) para controle pessoal de investimentos com dois domínios independentes:

| Domínio | Escopo | Página |
|---------|--------|--------|
| **Opções** | Calls e puts de ações na B3 | `/html/opcoes.html` |
| **Crypto** | Dual Investment, Opções Crypto, Spot, Hold, Futures, Staking | `/html/crypto.html` |

---

## Diagrama Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER                                     │
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐  │
│  │   opcoes.html        │    │   crypto.html                    │  │
│  │   ├── shared/style   │    │   ├── shared/style               │  │
│  │   ├── opcoes/opcoes  │    │   ├── opcoes/opcoes (shared css)  │  │
│  │   ├── opcoes/detalhe │    │   ├── crypto/crypto              │  │
│  │   ├── shared/analise │    │   └── shared/modal-analise       │  │
│  │   └── core/libs/glb  │    │       └── core/libs/global       │  │
│  └──────────┬───────────┘    └──────────────┬───────────────────┘  │
│             │ fetch /api/...                 │ fetch /api/...       │
└─────────────┼─────────────────────────────-─┼─────────────────────-┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FLASK SERVER :8888                               │
│                                                                     │
│  server.py (thin)                                                   │
│  ├── app.register_blueprint(crypto_bp,  url_prefix='/api/crypto')  │
│  ├── app.register_blueprint(opcoes_bp,  url_prefix='/api/opcoes')  │
│  ├── app.register_blueprint(config_bp,  url_prefix='/api')         │
│  ├── app.register_blueprint(ai_bp,      url_prefix='/api')         │
│  ├── app.register_blueprint(market_bp,  url_prefix='/api')         │
│  └── init_db()                                                     │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐  │
│  │ routes/crypto │  │ routes/opcoes │  │ routes/config         │  │
│  │ /api/crypto   │  │ /api/opcoes   │  │ /api/config           │  │
│  │ CRUD +        │  │ CRUD +        │  │ /api/available-ais    │  │
│  │ estrategias   │  │ normalize +   │  │ /api/config-ia        │  │
│  │               │  │ refresh       │  └───────────────────────┘  │
│  └───────┬───────┘  └───────┬───────┘                             │
│          │                  │    ┌───────────────────────────────┐ │
│          └──────────┬───────┘    │ routes/ai                    │ │
│                     │            │ /api/analyze                  │ │
│                     ▼            │ multi-provider fallback:      │ │
│              ┌──────────┐        │ OR→Grok→DS→OAI→Gemini        │ │
│              │  db.py   │        └───────────────────────────────┘ │
│              │ get_db() │                                           │
│              │ init_db()│   ┌──────────────────────────────────┐   │
│              └────┬─────┘   │ routes/market                   │   │
│                   │         │ /api/proxy/stocks,options,crypto │   │
│                   ▼         │ /api/cotacao/realtime,hibrido    │   │
│          ┌──────────────┐   │ /api/cache/clear                 │   │
│          │  SQLite DB   │   │ cache 5min em memória            │   │
│          │  ├─ crypto   │   └──────────────────────────────────┘   │
│          │  ├─ opcoes   │                                          │
│          │  └─ config   │                                          │
│          └──────────────┘                                          │
└─────────────────────────────────────────────────────────────────────┘
              │                                   │
              ▼                                   ▼
    ┌──────────────────┐              ┌──────────────────────┐
    │  OpLab API       │              │  Binance REST API     │
    │  (B3 options)    │              │  (crypto prices)      │
    └──────────────────┘              └──────────────────────┘
              │
              ▼
    ┌──────────────────┐
    │  yfinance        │
    │  (free, delay    │
    │   5-10 min)      │
    └──────────────────┘
```

---

## Estrutura de Pastas

```
ControleOperacoes/
│
├── backend/
│   ├── server.py               Entry point (thin). Registra blueprints.
│   ├── db.py                   Utilitários DB: get_db(), init_db()
│   ├── server.py.bak           Backup do monolito original (974 linhas)
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── crypto.py           Blueprint /api/crypto — CRUD + estratégias
│   │   ├── opcoes.py           Blueprint /api/opcoes — CRUD + normalize + refresh
│   │   ├── config.py           Blueprint /api/config,available-ais,config-ia
│   │   ├── ai.py               Blueprint /api/analyze — multi-provider
│   │   └── market.py           Blueprint proxy OpLab + yfinance + Binance
│   ├── tests/
│   │   ├── conftest.py         Fixtures (mock db.get_db centralizado)
│   │   ├── test_api_analyze.py 8 testes de análise IA
│   │   ├── test_api_config.py  16 testes de configuração
│   │   ├── test_api_crypto.py  14 testes CRUD crypto
│   │   ├── test_api_opcoes.py  18 testes CRUD opcoes
│   │   ├── opcoes/             ← Futuros testes específicos de opcoes
│   │   └── crypto/             ← Futuros testes específicos de crypto
│   ├── data/
│   │   └── controle_operacoes.db
│   └── requirements.txt
│
├── frontend/
│   ├── html/
│   │   ├── opcoes.html         Página de Opções B3
│   │   └── crypto.html         Página de Crypto
│   ├── js/
│   │   ├── core/               Infraestrutura base (libs, global, layout)
│   │   ├── opcoes/             JS exclusivo do módulo de opções
│   │   │   ├── opcoes.js
│   │   │   ├── detalhe-opcoes.js
│   │   │   ├── modal-resultado-total.js
│   │   │   ├── modal-saldo-medio.js
│   │   │   ├── modal-total-operacoes.js
│   │   │   └── opcoes_patch.js
│   │   ├── crypto/             JS exclusivo do módulo crypto
│   │   │   └── crypto.js
│   │   └── shared/             JS compartilhado pelos dois módulos
│   │       ├── modal-analise.js   (configure() API)
│   │       └── technical-analysis.js
│   ├── css/
│   │   ├── opcoes/             CSS exclusivo de opções
│   │   ├── crypto/             CSS exclusivo de crypto
│   │   └── shared/             CSS compartilhado
│   ├── components/modals/      Fragmentos HTML de modais
│   └── tests/                  Testes E2E Playwright
│       ├── pages/
│       │   ├── opcoes.spec.js      Testes gerais da página opcoes
│       │   ├── crypto.spec.js      Testes gerais da página crypto
│       │   ├── opcoes/
│       │   │   └── opcoes-assets.spec.js  Testes de assets + API opcoes
│       │   └── crypto/
│       │       └── crypto-assets.spec.js  Testes de assets + API crypto
│       ├── helpers/
│       └── setup/
│
├── .ai-memory/                 Contexto de IA (00-08 arquivos .md)
├── memoryIA/                   Scripts de manutenção do contexto
│   ├── ai_update.bat
│   ├── scripts/
│   │   ├── ai_memory_update.py
│   │   └── ai_snapshot.py
│   └── templates/
│
├── tests/
│   ├── results/                Resultados JSON dos testes
│   └── dashboardTestes.*       Dashboard visual de testes
│
├── start.bat                   Inicia o servidor
├── run_all_tests.bat           Executa todos os testes
├── playwright.config.js        Configuração Playwright
└── ARQUITETURA.md              Este documento
```

---

## API Reference

### Módulo Crypto (`/api/crypto`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/crypto` | Listar todas (filtro: `?tipo_estrategia=`) |
| GET | `/api/crypto/<id>` | Buscar por ID |
| POST | `/api/crypto` | Criar operação |
| PUT | `/api/crypto/<id>` | Atualizar |
| DELETE | `/api/crypto/<id>` | Excluir |
| GET | `/api/crypto/estrategias` | Listar tipos de estratégia |

**Estratégias suportadas:** `DUAL_INVESTMENT`, `OPCAO_CRYPTO`, `SPOT`, `HOLD`, `FUTURES`, `STAKING`, `OUTRO`

### Módulo Opções (`/api/opcoes`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/opcoes` | Listar todas (auto-normaliza resultados) |
| GET | `/api/opcoes/<id>` | Buscar por ID |
| POST | `/api/opcoes` | Criar operação |
| PUT | `/api/opcoes/<id>` | Atualizar |
| DELETE | `/api/opcoes/<id>` | Excluir |
| POST | `/api/opcoes/refresh` | Atualizar cotações das operações ABERTAS |

### Config (`/api`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/config` | Ler todas configurações |
| POST | `/api/config` | Salvar configurações |
| GET | `/api/available-ais` | IAs disponíveis (chaves no .env) |
| POST | `/api/config-ia` | Salvar IA selecionada |

### IA (`/api`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/analyze` | Análise com IA (context/messages + force_ai) |

### Market (`/api`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/proxy/stocks/<ticker>` | Cotação de ação (OpLab) |
| GET | `/api/proxy/options/<ticker>` | Cadeia de opções (OpLab, 3 endpoints + merge) |
| GET | `/api/cotacao/realtime/<ticker>` | Cotação em tempo real (yfinance, delay 5-10min) |
| GET | `/api/cotacao/hibrido/<ticker>` | Híbrido: spot real-time + opções OpLab |
| GET | `/api/proxy/crypto/<ticker>` | Preço crypto (Binance) |
| GET | `/api/cotacao/opcoes?symbol=XXXX` | Cotação de opção individual |
| GET | `/api/cache/clear` | Limpar cache de cotações |

---

## Banco de Dados

```sql
-- Tabela de operações crypto (nova coluna tipo_estrategia)
CREATE TABLE operacoes_crypto (
    id                INTEGER  PRIMARY KEY AUTOINCREMENT,
    ativo             TEXT     NOT NULL,
    tipo              TEXT     NOT NULL,         -- HIGH, LOW, CALL, PUT, BUY, SELL...
    tipo_estrategia   TEXT     DEFAULT 'DUAL_INVESTMENT',  -- ← NOVO
    cotacao_atual     REAL,
    abertura          REAL,
    tae               REAL,                      -- Taxa Anual Equivalente
    strike            REAL,
    distancia         REAL,                      -- % distância do spot
    prazo             INTEGER,                   -- dias até vencimento
    crypto            REAL,                      -- quantidade de crypto
    premio_us         REAL,                      -- prêmio em USD
    resultado         REAL,
    exercicio         TEXT,
    dias              INTEGER,
    exercicio_status  TEXT,
    status            TEXT     DEFAULT 'ABERTA', -- ← NOVO
    observacoes       TEXT,                      -- ← NOVO
    data_operacao     TEXT,
    created_at        TEXT     DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de operações de opcoes B3
CREATE TABLE operacoes_opcoes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    ativo_base     TEXT,                         -- Ex: PETR4
    ativo          TEXT     NOT NULL,             -- Ex: PETRA150
    tipo           TEXT     NOT NULL,             -- CALL / PUT
    tipo_operacao  TEXT     DEFAULT 'VENDA',      -- VENDA / COMPRA
    quantidade     INTEGER,
    preco_entrada  REAL,
    preco_atual    REAL,
    strike         REAL,
    vencimento     TEXT,
    premio         REAL,
    resultado      REAL,
    saldo_abertura REAL,
    status         TEXT,                          -- ABERTA / FECHADA
    data_operacao  TEXT,
    created_at     TEXT     DEFAULT CURRENT_TIMESTAMP
);
```

---

## Padrão de Testabilidade

O mock do banco de dados é centralizado em `db.py`:

```python
# backend/tests/conftest.py
import db as _db_module
_db_module.get_db = MagicMock(side_effect=_build_mock_connection)
```

Todos os blueprints usam `import db; db.get_db()` (não `from db import get_db`),
o que garante que o mock propague para todos os módulos automaticamente.

---

## Filosofia de Design

| Princípio | Implementação |
|-----------|--------------|
| **Thin server** | `server.py` < 60 linhas, apenas registra blueprints |
| **Domínios separados** | crypto e opcoes em arquivos/pastas independentes |
| **Shared sem duplicação** | `modal-analise.js` + `configure()` API: um arquivo para dois módulos |
| **Mock centralizado** | `db.get_db()` mockável de um único ponto |
| **Migração segura** | `_safe_add_columns()` para alterar DB existente sem quebrar dados |
| **Cache simples** | Dict em memória com TTL de 5 minutos (sem Redis) |
| **Sem ORM** | SQL direto com sqlite3 — simples, sem dependências extras |

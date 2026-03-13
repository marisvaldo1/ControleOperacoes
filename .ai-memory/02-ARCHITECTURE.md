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
│   │   ├── test_api_config.py
│   │   ├── test_api_crypto.py
│   │   ├── test_api_opcoes.py
│   │   ├── opcoes/             ← Testes específicos de opcoes (futuro)
│   │   └── crypto/             ← Testes específicos de crypto (futuro)
│   ├── data/
│   │   └── controle_operacoes.db
│   ├── requirements.txt
│   └── .env                    ← Chaves de API (não comitar)
│
├── frontend/
│   ├── html/
│   │   ├── opcoes.html         ← Página principal de Opções (B3)
│   │   └── crypto.html         ← Página principal de Crypto
│   ├── js/
│   │   ├── opcoes/             ← JS exclusivo do módulo opções
│   │   │   ├── opcoes.js
│   │   │   ├── detalhe-opcoes.js
│   │   │   ├── modal-resultado-total.js
│   │   │   ├── modal-saldo-medio.js
│   │   │   ├── modal-total-operacoes.js
│   │   │   └── opcoes_patch.js
│   │   ├── crypto/             ← JS exclusivo do módulo crypto
│   │   │   └── crypto.js
│   │   ├── shared/             ← JS compartilhado (opcoes + crypto)
│   │   │   ├── modal-analise.js    (configure() API)
│   │   │   └── technical-analysis.js
│   │   └── core/               ← Infraestrutura base
│   │       ├── libs.js
│   │       ├── global.js
│   │       └── layout.js
│   ├── css/
│   │   ├── opcoes/             ← CSS exclusivo do módulo opções
│   │   │   ├── opcoes.css
│   │   │   ├── detalhe-opcoes.css
│   │   │   ├── modal-resultado-total.css
│   │   │   └── modal-detalhes.css
│   │   ├── crypto/             ← CSS exclusivo do módulo crypto
│   │   │   └── crypto.css
│   │   └── shared/             ← CSS compartilhado
│   │       ├── style.css
│   │       ├── modal-analise.css
│   │       └── y2-styles.css
│   ├── components/
│   │   └── modals/
│   │       ├── opcoes/         ← Modais HTML de opcoes
│   │       └── crypto/         ← Modais HTML de crypto
│   └── tests/                  ← Playwright E2E
│       ├── pages/
│       │   ├── opcoes.spec.js
│       │   ├── crypto.spec.js
│       │   ├── opcoes/         ← Specs específicos de opcoes
│       │   └── crypto/         ← Specs específicos de crypto
│       ├── helpers/
│       └── setup/
│
├── .ai-memory/                 ← Contexto para IAs (ESTE sistema)
├── memoryIA/                   ← Scripts de manutenção do contexto
├── tests/results/              ← Resultados de testes (JSON)
├── start.bat                   ← Iniciar servidor
├── run_all_tests.bat           ← Rodar todos os testes
└── ARQUITETURA.md              ← Diagrama detalhado (gerado)
```

---

## Diagrama de responsabilidades (Backend)

```
server.py (thin)
    │
    ├── routes/crypto.py   ─→  db.get_db()  ─→  operacoes_crypto
    ├── routes/opcoes.py   ─→  db.get_db()  ─→  operacoes_opcoes
    ├── routes/config.py   ─→  db.get_db()  ─→  configuracoes
    ├── routes/ai.py       ─→  requests (OpenAI/DeepSeek/Grok/Gemini/OpenRouter)
    └── routes/market.py   ─→  requests (OpLab) + yfinance + Binance
```

---

## Banco de Dados

### `operacoes_crypto`
| Coluna | Tipo | Nota |
|--------|------|------|
| id | INTEGER PK | |
| ativo | TEXT | Ex: BTC, ETH |
| tipo | TEXT | CALL, PUT, HIGH, LOW |
| tipo_estrategia | TEXT | DUAL_INVESTMENT, OPCAO_CRYPTO, SPOT, HOLD, FUTURES, STAKING, OUTRO |
| cotacao_atual | REAL | |
| abertura | REAL | |
| tae | REAL | Taxa Anual Equivalente |
| strike | REAL | |
| distancia | REAL | % distância do spot |
| prazo | INTEGER | dias |
| crypto | REAL | quantidade |
| premio_us | REAL | prêmio em USD |
| resultado | REAL | |
| exercicio | TEXT | SIM/NAO |
| dias | INTEGER | dias restantes |
| exercicio_status | TEXT | |
| status | TEXT | ABERTA/FECHADA |
| observacoes | TEXT | |
| data_operacao | TEXT | YYYY-MM-DD |

### `operacoes_opcoes`
| Coluna | Tipo | Nota |
|--------|------|------|
| id | INTEGER PK | |
| ativo_base | TEXT | Ex: PETR4 |
| ativo | TEXT | Ex: PETRA150 |
| tipo | TEXT | CALL/PUT |
| tipo_operacao | TEXT | VENDA/COMPRA |
| quantidade | INTEGER | negativo = venda |
| preco_entrada | REAL | |
| preco_atual | REAL | atualizado por /refresh |
| strike | REAL | |
| vencimento | TEXT | YYYY-MM-DD |
| premio | REAL | |
| resultado | REAL | |
| saldo_abertura | REAL | saldo da conta ao abrir |
| status | TEXT | ABERTA/FECHADA |
| data_operacao | TEXT | |

### `configuracoes`
| Coluna | Tipo | Nota |
|--------|------|------|
| id | INTEGER PK | |
| chave | TEXT UNIQUE | Ex: selected_ai |
| valor | TEXT | |
| updated_at | TEXT | |

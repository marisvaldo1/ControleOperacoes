# CONTEXTO — ControleOperacoes (sessão acumulada)

> Última atualização: 17/04/2026
> Estado verificado nesta sessão:
> - ✅ `backend/tests/test_api_crypto.py`: 20/20 passando
> - ✅ `tests/results/pytest_results.json`: 66/66 passando (12 deselected)
> - ✅ `tests/results/playwright_results.json`: 26/26 specs OK

---

## 1. Visão Geral

Aplicação web local para controle de operações de investimento com dois domínios principais:

- **Crypto**: Dual Investment, Opções Crypto, Spot, Hold, Futures, Staking
- **Opções B3**: operações CALL/PUT em ações

Stack principal:

- **Backend**: Flask + SQLite
- **Frontend**: HTML/CSS/JS + Tabler
- **Porta padrão backend**: `8888`

---

## 2. Estrutura do Projeto

```
ControleOperacoes/
├── backend/
│   ├── server.py                # Entry point Flask (blueprints + static frontend)
│   ├── db.py                    # get_db(), init_db(), migrações leves de colunas
│   ├── routes/
│   │   ├── crypto.py            # /api/crypto
│   │   ├── opcoes.py            # /api/opcoes
│   │   ├── config.py            # /api/config, /api/available-ais, /api/config-ia
│   │   ├── ai.py                # /api/analyze
│   │   └── market.py            # proxies/cotações
│   ├── data/
│   │   └── controle_operacoes.db
│   └── tests/
│
├── frontend/
│   ├── html/
│   │   ├── crypto.html
│   │   └── opcoes.html
│   ├── js/
│   │   ├── core/
│   │   │   ├── libs.js
│   │   │   ├── global.js
│   │   │   ├── layout.js
│   │   │   ├── crypto-filter-bar.js
│   │   │   └── modal-header.js
│   │   ├── crypto/
│   │   └── opcoes/
│   ├── css/
│   │   ├── shared/
│   │   ├── crypto/
│   │   └── opcoes/
│   ├── components/modals/
│   │   ├── crypto/
│   │   └── opcoes/
│   └── tests/                   # Playwright
│
├── tests/
│   └── results/                 # JSON de resultado (pytest/playwright)
├── ARQUITETURA.md
├── README.md
├── run_all_tests.bat
└── start.bat
```

---

## 3. Endpoints Principais

### Crypto (`/api/crypto`)
- `GET /api/crypto`
- `GET /api/crypto/<id>`
- `POST /api/crypto`
- `PUT /api/crypto/<id>`
- `DELETE /api/crypto/<id>`
- `PATCH /api/crypto/<id>/fechar`
- `GET /api/crypto/estrategias`

### Opções (`/api/opcoes`)
- `GET /api/opcoes`
- `GET /api/opcoes/<id>`
- `POST /api/opcoes`
- `PUT /api/opcoes/<id>`
- `DELETE /api/opcoes/<id>`
- `POST /api/opcoes/refresh`

### Config/IA/Market (`/api`)
- `GET /api/config`
- `POST /api/config`
- `GET /api/available-ais`
- `POST /api/config-ia`
- `POST /api/analyze`
- `GET /api/proxy/stocks/<ticker>`
- `GET /api/proxy/options/<ticker>`
- `GET /api/proxy/crypto/<ticker>`
- `GET /api/cotacao/realtime/<ticker>`
- `GET /api/cotacao/hibrido/<ticker>`
- `GET /api/cache/clear`

---

## 4. Fluxo de Inicialização

1. `backend/server.py` cria app Flask e registra blueprints.
2. `init_db()` é chamado na subida para garantir tabelas/colunas.
3. Frontend é servido pelo próprio Flask (`static_folder=../frontend`).
4. `frontend/html/crypto.html` e `frontend/html/opcoes.html` carregam módulos JS específicos.

---

## 5. Estado Atual de Frontend (Crypto)

Área com maior volume de alterações locais atualmente:

- Migração para cabeçalho/filtros padronizados em modais crypto:
  - `frontend/js/core/crypto-filter-bar.js`
  - `frontend/js/core/modal-header.js`
- Novos fragmentos/componentes em `frontend/components/shared/`.
- Ajustes em múltiplos modais e estilos crypto:
  - `modal-dashboard-crypto`
  - `modal-resultados-crypto`
  - `modal-resultados-crypto-compact`
  - `modal-saldo-medio-crypto`
  - `modal-resultado-total-crypto-v2`

Observação importante:

- O repositório está com mudanças locais não commitadas, principalmente em `frontend` (crypto). Evitar resets/reverts automáticos.

---

## 6. Comandos Essenciais

- Iniciar backend:
  - `cd backend && python server.py`
- Iniciar sistema (script):
  - `./start.bat`
- Rodar testes backend:
  - `python -m pytest backend/tests -q`
- Rodar suíte completa:
  - `./run_all_tests.bat`
- Rodar Playwright:
  - `npx playwright test`

---

## 7. Próximos Ajustes Recomendados

1. Consolidar o padrão `CryptoModalHeader` em todos os modais crypto restantes.
2. Revisar caminhos de templates de modal para padronizar (`components/modals/crypto/...`).
3. Executar regressão rápida Playwright focada em `frontend/tests/pages/crypto/*.spec.js` após cada bloco de refatoração.
4. Atualizar documentação funcional (`README.md`) para refletir o novo padrão de cabeçalho/filtros compartilhados.

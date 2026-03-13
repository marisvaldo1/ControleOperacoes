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

### Baixa Prioridade
- [ ] Dashboard de testes com subgrupos por módulo (opcoes/crypto)
- [ ] Documentação interativa das rotas (Swagger/OpenAPI)
- [ ] Exportação de dados (CSV/Excel)

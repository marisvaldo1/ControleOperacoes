# 08 — CHANGELOG: Histórico de Mudanças

- **MODIFICADO** `backend/tests/conftest.py` — mock atualizado de `server.get_db` para `db.get_db`
- **MODIFICADO** `backend/tests/test_api_analyze.py` — patches atualizados de `server.requests` para `routes.ai.requests`
- **NOVO** coluna `tipo_estrategia` em `operacoes_crypto` (DEFAULT: DUAL_INVESTMENT)
- **NOVO** colunas `status` e `observacoes` em `operacoes_crypto`

### Frontend
- **NOVO** subpastas organizadas por domínio:
  - `frontend/js/opcoes/` (6 arquivos), `frontend/js/crypto/` (1), `frontend/js/shared/` (2)
  - `frontend/css/opcoes/` (4 arquivos), `frontend/css/crypto/` (1), `frontend/css/shared/` (3)
- **MODIFICADO** `frontend/html/opcoes.html` — paths de assets atualizados
- **MODIFICADO** `frontend/html/crypto.html` — paths de assets atualizados

### Testes
- **Estado:** 56/56 pytest ✅ | Playwright: pendente verificação

---

## [2025-07] — Implementação modal-analise com configure() (sessão anterior)

- `frontend/js/modal-analise.js` refatorado com `configure()` API
- Suporte a crypto e opcoes no mesmo modal

---

## [2025-07] — Crypto page implementação completa (sessão anterior)

- `frontend/html/crypto.html` reescrito com cards/tabs/modals
- `frontend/js/crypto.js` reescrito com funcionalidade completa
- `frontend/css/crypto.css` atualizado

## 2026-03-09 13:56:32 — branch: master

- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- f624116 | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- 6795244 | 2026-02-10 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-10 10:24:04 — branch: master

- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- f624116 | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- 6795244 | 2026-02-10 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-11 16:35:19 — branch: master

- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- f624116 | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- 6795244 | 2026-02-10 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-11 16:59:06 — branch: master

- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- f624116 | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- 6795244 | 2026-02-10 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-11 17:07:59 — branch: master

- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- f624116 | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- 6795244 | 2026-02-10 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-12 09:03:34 — branch: master

- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- f624116 | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- 6795244 | 2026-02-10 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-13 16:48:09 — branch: master

- c9934aa | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- f624116 | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-13 16:48:46 — branch: master

- c9934aa | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- f624116 | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-13 16:51:47 — branch: master

- c9934aa | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths
- f624116 | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-16 14:18:17 — branch: master

- fd1a31d | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c9934aa | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-16 14:19:21 — branch: master

- fd1a31d | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c9934aa | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-17 16:20:44 — branch: master

- fd1a31d | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c9934aa | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths

## 2026-03-18 15:38:06 — branch: master

- fd1a31d | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c9934aa | 2026-03-13 | â€œMarisvaldoâ€ | Tela de cryptos
- c8f34d5 | 2026-03-05 | â€œMarisvaldoâ€ | Tela de testes
- 6482359 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 308a0b6 | 2026-02-23 | â€œMarisvaldoâ€ | Janela de totais finais
- 0d01e39 | 2026-02-18 | â€œMarisvaldoâ€ | Janela de totais finais
- 8dd62bc | 2026-02-13 | â€œMarisvaldoâ€ | Janela de totais finais
- 2c2b88a | 2026-02-12 | â€œMarisvaldoâ€ | Janela de insigths
- 10a5284 | 2026-02-11 | â€œMarisvaldoâ€ | Ajustes no registro de controle
- 0fa948d | 2026-02-11 | â€œMarisvaldoâ€ | Janela de insigths

# 00 — ENTRYPOINT: Como eu leio este sistema

> **Leia este arquivo PRIMEIRO.** Ele define a ordem de leitura para absorver o contexto.

## Ordem de leitura recomendada

| # | Arquivo | O que contém |
|---|---------|--------------|
| 1 | `00-ENTRYPOINT.md` | Este arquivo — mapa de navegação |
| 2 | `01-CONTEXT.md` | Descrição do projeto, tech stack, como rodar |
| 3 | `02-ARCHITECTURE.md` | Estrutura de pastas, responsabilidades de cada módulo |
| 4 | `03-TECH-STACK.md` | Dependências, versões, decisões de tecnologia |
| 5 | `04-RULES.md` | Regras de comportamento da IA neste projeto |
| 6 | `05-STATE.md` | Estado atual — o que está pronto, o que está em andamento |
| 7 | `06-TASKS.md` | Tarefas abertas e próximos passos |
| 8 | `08-CHANGELOG.md` | Histórico de mudanças significativas |

## Contexto rápido (1 parágrafo)

**ControleOperacoes** é um sistema web de controle de investimentos com dois módulos:
- **Opções (B3)**: gerenciamento de travas, calls e puts de ações
- **Crypto**: gerenciamento de Dual Investment, Opções Crypto, Spot, Hold, Futures e Staking

Backend Flask (Python), banco SQLite, frontend HTML+JS+Bootstrap puro. Sem login.
Servidor na porta **8888**. Pytest + Playwright para testes.

## Como rodar

```bat
REM Raiz do projeto:
.\start.bat
REM Browser: http://localhost:8888/html/opcoes.html
REM Browser: http://localhost:8888/html/crypto.html
```

## Como testar

```bat
.\run_all_tests.bat
```

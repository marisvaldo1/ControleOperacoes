# CONTEXTO — CentralClinica (sessão acumulada)

> Última atualização: 04/03/2026  
> Estado: ✅ 159 pytest + 36 Playwright — todos passando

---

## 1. Estrutura do Projeto

```
CentralClinica/
├── backend/
│   ├── server.py            # Flask principal, porta 8881
│   ├── routes/              # auth, agenda, atendimento, pacientes, financeiro, relatorios, cadastros, dashboard, admin
│   ├── database.py
│   ├── utils.py             # active_tokens, parse_permissoes, log_action
│   ├── config.py
│   └── tests/               # pytest — 159 testes
├── frontend/
│   ├── html/                # dashboard, agenda, atendimento, pacientes, financeiro, relatorios, administracao, login
│   ├── js/                  # um .js por página + layout.js, app.js, auth.js
│   ├── css/
│   └── tests/               # Playwright — 36 testes
├── tests/
│   ├── dashboardTestes.html # Dashboard de testes visual
│   ├── dashboardTestes.css
│   ├── dashboardTestes.js
│   ├── test_server.py       # Servidor do dashboard, porta 8883
│   └── results/             # JSONs de resultado (gerados pelo run_all_tests.bat)
│       ├── pytest_results.json
│       ├── playwright_results.json
│       └── ai_results.json
├── run_all_tests.bat        # Suite completa: pytest + Playwright
├── start.bat                # Inicia o sistema completo
├── playwright.config.js
└── pytest.ini
```

---

## 2. Comandos Essenciais

| Ação | Comando |
|------|---------|
| Rodar todos os testes | `.\run_all_tests.bat` |
| Iniciar sistema completo | `.\start.bat` |
| Iniciar dashboard de testes | `python tests/test_server.py` → http://localhost:8883 |
| Backend apenas | `cd backend && python server.py` |
| Python do projeto | `d:\Sistemas\python\CentralClinica\.venv\Scripts\python.exe` |

---

## 3. Dashboard de Testes (`tests/dashboardTestes.*`)

### Layout do Health Card

```
[ hc-left-col 300px ] [ hc-right-col flex:1 ] [ hc-bd-col 290px ]
  rings + métricas      heatmap + timeline       breakdown categorias
```

O card ocupa **largura total** abaixo do `mid-row` (estrutura HTML):
```
.content
  ├── .kpi-row
  ├── .mid-row          (gráficos menores)
  ├── #panel-saude      ← full width (fora do mid-row)
  └── .bottom-row
```

### Componentes JS relevantes

```javascript
// Categorias para breakdown
const HC_CATEGORIES = [
  { id: 'auth',  icon: '🔒', label: 'Autenticacao',  fn: t => /auth|login/i.test(t.suite) },
  { id: 'fin',   icon: '💰', label: 'Financeiro',    fn: t => /financ/i.test(t.suite) },
  { id: 'atnd',  icon: '🦷', label: 'Atendimento',   fn: t => /atendimento|prontuario|plano|orcamento|baixa/i.test(t.suite) },
  { id: 'agnd',  icon: '📅', label: 'Agenda',        fn: t => /agenda/i.test(t.suite) },
  { id: 'pac',   icon: '🧑‍⚕️', label: 'Pacientes',   fn: t => /paciente|ocr|merge/i.test(t.suite) },
  { id: 'ia',    icon: '🤖', label: 'IA Providers',  fn: t => t.type === 'ai' },
];

// buildBreakdown(tests)   → renderiza coluna "Aprovação por Categoria"
// copyLog()               → copia log para área de transferência
// pollResults()           → polling a cada 15s, detecta novos JSONs pelo mtime
// reloadResults()         → re-popula dashboard sem recarregar a página
```

### Auto-refresh (implementado nesta sessão)

- `pollResults()` consulta `/api/results/mtime` a cada 15s
- Se `mtime` mudou, chama `reloadResults()` → atualiza tudo automaticamente
- Para quando uma execução SSE está em andamento
- Exibe no log: `[AUTO] Resultados atualizados automaticamente (HH:MM:SS) — X/Y passando`

### CSS crítico (valores atuais)

```css
.hc-card-body   { height: 680px; }          /* fixo — necessário para scroll flex */
.hc-hcell       { width: 20px; height: 20px; }
.hc-tl-rows     { overflow-y: auto; min-height: 0; }   /* min-height:0 OBRIGATÓRIO para scroll */
.hc-timeline-area { min-height: 0; }
.hc-bd-rows     { overflow-y: auto; min-height: 0; }
.hc-hmap-area   { max-height: 340px; overflow: hidden; }
```

---

## 4. Sincronismo Dashboard ↔ run_all_tests.bat

### Problema resolvido

O `run_all_tests.bat` não gravava o JSON do pytest → dashboard não refletia falhas reais.

### Solução implementada

**`run_all_tests.bat`** — pytest agora usa `--json-report`:
```bat
if not exist "tests\results" mkdir "tests\results"
"%PYTHON%" -m pytest backend/tests/ -v --json-report --json-report-file=tests/results/pytest_results.json --tb=short
```

**`tests/test_server.py`** — novo endpoint e campo `mtime`:
```python
@app.route('/api/results/mtime')   # novo endpoint
def api_results_mtime():
    resp = jsonify({'mtime': get_results_mtime()})
    ...

@app.route('/api/results')         # agora inclui 'mtime' na resposta
def api_results():
    data = load_all_results()
    data['mtime'] = get_results_mtime()
    ...
```

**Playwright** já gravava em `tests/results/playwright_results.json` via `playwright.config.js` (sem alteração necessária).

---

## 5. Arquivos Modificados (histórico desta sessão)

| Arquivo | Modificação |
|---------|-------------|
| `tests/dashboardTestes.html` | `panel-saude` fora do `mid-row` (full width), SVG 200×200, coluna breakdown, botão copiar log |
| `tests/dashboardTestes.css` | `hc-hcell` 20×20px, `height: 680px`, `min-height:0` para scroll, hc-bd-* estilos |
| `tests/dashboardTestes.js` | `HC_CATEGORIES`, `buildBreakdown()`, `copyLog()`, `pollResults()`, `reloadResults()`, `lastResultsMtime` |
| `tests/test_server.py` | `get_results_mtime()`, `/api/results/mtime`, campo `mtime` em `/api/results` |
| `run_all_tests.bat` | `--json-report` adicionado ao pytest |
| `backend/tests/test_ai_providers.py` | Skip em 404 além de 429 (Gemini 1.5-Pro deprecated) |
| `frontend/js/layout.js` | `loadSystemConfig()` em try/catch (renderFooter sempre executa) |
| `backend/routes/auth.py` | `login2` → `login` (era um teste proposital de simulação de erro) |

---

## 6. Problemas Resolvidos

### Dashboard não refletia falhas do run_all_tests.bat
- **Causa:** pytest sem `--json-report` → JSON não era gravado → dashboard lia dados stale
- **Fix:** `--json-report-file=tests/results/pytest_results.json` no bat + auto-refresh por mtime

### Gemini 1.5-Pro — teste falhando com 404
- **Causa:** Modelo deprecado pelo Google
- **Fix:** `if status in (429, 404): pytest.skip(...)`

### Footer não aparecia em testes Playwright
- **Causa:** `loadSystemConfig()` lançava exceção e bloqueava `renderFooter()`
- **Fix:** try/catch em torno de `loadSystemConfig()`

### Scroll não funcionava em `.hc-tl-rows`
- **Causa:** Flex children precisam de `min-height: 0` explícito para `overflow-y: auto` funcionar
- **Fix:** `min-height: 0` em `.hc-timeline-area`, `.hc-tl-rows`, `.hc-bd-rows`

---

## 7. Estado Atual

- ✅ **159 pytest** — todos passando
- ✅ **36 Playwright** — todos passando
- ✅ Dashboard sincronizado com `run_all_tests.bat` via JSON + polling
- ✅ Auto-refresh a cada 15s detecta novos resultados automaticamente
- ✅ `backend/routes/auth.py` — função `login()` correta

---

## 8. Próximos Passos Sugeridos

- Testar o auto-refresh visualmente: rodar `run_all_tests.bat` com error proposital e observer o dashboard atualizar em ≤15s
- Avaliar se o intervalo de 15s é adequado ou se deve ser configurável
- Considerar adicionar notificação visual (toast/badge) quando o auto-refresh detectar uma regressão

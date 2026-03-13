# Guia: Como criar um novo teste E2E

Este guia cobre o ciclo completo: escrever o teste, garantir que ele aparece no dashboard e que os dados de banco são limpos ao final.

---

## Visão geral da infraestrutura

| Camada | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| Spec   | `frontend/tests/pages/e2e-usuario.spec.js` | Código dos testes Playwright |
| Fixtures | `frontend/tests/fixtures/opcoes-fixtures.json` | Dados de entrada para testes de formulário |
| Config | `playwright.usuario.config.js` | Config do Playwright (browser, base URL, etc.) |
| Scanner | `tests/test_server.py` → `scan_e2e_tests()` | Lê o spec e popula a lista do dashboard |
| Dashboard | `tests/dashboardTestes.html` + `dashboardTestes.js` | UI que lista e executa os testes |

---

## Passo a passo

### 1 — Escolha o número e o nome do teste

Todos os testes E2E seguem o padrão:

```
[E2E-Usuario-<Categoria>-<NN>] Descrição legível do que está sendo testado
```

Exemplos existentes:
- `[E2E-Usuario-Opcoes-01] Abrir modal de nova operação`
- `[E2E-Usuario-Opcoes-04] Excluir operação via datatable`

**Regra:** o prefixo entre colchetes deve ser único. O scanner usa ele como identificador no dashboard.

---

### 2 — Escreva o teste no spec

Abra `frontend/tests/pages/e2e-usuario.spec.js`.

Encontre o `describe` da categoria onde o teste se encaixa (ex: `describe('[E2E-Usuario] Opções', ...)`).  
Adicione o teste **dentro** do describe, após o último teste existente:

```javascript
test('[E2E-Usuario-Opcoes-05] Descrição do que o teste faz', async ({ page, request }) => {

  // ── Arrange: criar dados via API (se necessário) ──────────────────────────
  const res = await request.post('http://localhost:8888/api/opcoes', {
    data: {
      ativo:        'PETRX300',
      tipo:         'PUT',
      strike:       30.00,
      premio:       0.50,
      quantidade:   100,
      vencimento:   '2026-06-20',
      // OBRIGATÓRIO: marcar como dado de teste para limpeza automática
      is_test_data: 1,
      observacoes:  '[TESTE E2E]',
    }
  });
  const { id } = await res.json();

  // ── Act: navegar e interagir ──────────────────────────────────────────────
  await page.goto('http://localhost:8888/html/opcoes.html');
  await page.waitForSelector('#tabelaOperacoes', { state: 'visible' });

  // ... suas interações aqui ...

  // ── Assert: verificar resultado ───────────────────────────────────────────
  await expect(page.locator('algum-seletor')).toBeVisible();

  // ── Cleanup explícito (opcional, afterAll já faz por is_test_data) ────────
  await request.delete(`http://localhost:8888/api/opcoes/${id}`);
});
```

> **Dica:** Se o teste for de formulário (preenche campos na tela), rastreie o ID criado em `_formCreatedIds` e deixe o `afterAll` fazer a limpeza. Veja testes 02 e 03 como exemplo.

---

### 3 — Garanta a limpeza dos dados

O describe de Opções já tem um `afterAll` que:
1. Chama `DELETE /api/opcoes/test-data` → remove todos os registros com `is_test_data=1`
2. Deleta individualmente os IDs capturados em `_formCreatedIds`

**Para que funcione, você deve:**
- Sempre passar `is_test_data: 1` em toda criação via `request.post()`
- Se criar via formulário, adicionar o `id` a `_formCreatedIds` após a criação

Se criar um novo `describe` (nova categoria), copie o bloco `afterAll` do describe de Opções:

```javascript
test.afterAll(async ({ request }) => {
  // Remove dados marcados como teste
  await request.delete('http://localhost:8888/api/opcoes/test-data').catch(() => {});
  // Remove dados criados via form (IDs rastreados)
  for (const id of _formCreatedIds) {
    await request.delete(`http://localhost:8888/api/opcoes/${id}`).catch(() => {});
  }
});
```

---

### 4 — Verifique se o teste é detectado pelo Playwright

Execute no terminal:

```powershell
cd d:\Sistemas\python\ControleOperacoes
npx playwright test --config=playwright.usuario.config.js --list
```

O nome do seu teste deve aparecer na lista. Se não aparecer, verifique:
- Se está dentro de um `describe` ativo (não comentado)
- Se a sintaxe está correta (parênteses, vírgulas)

---

### 5 — Verifique se aparece no dashboard

O scanner (`scan_e2e_tests()` em `test_server.py`) usa regex para encontrar todos os `test('...')` no spec.  
**Regra do scanner:** ele detecta qualquer linha com o padrão:

```javascript
test('Nome do teste', async ...
test("Nome do teste", async ...
```

Para confirmar via API:

```powershell
# Com o test_server.py rodando (dashboard aberto):
Invoke-RestMethod http://localhost:5000/api/tests | Select-Object -ExpandProperty tests | Where-Object { $_.type -eq 'e2e' }
```

Ou simplesmente **abra o dashboard** (`tests/dashboardTestes.html`) e veja se o teste aparece na aba/lista de E2E.

> **Importante:** o dashboard lê a lista ao carregar a página. Se você adicionou o teste com o dashboard já aberto, faça um **F5** para recarregar.

---

### 6 — Execute o teste isolado

Para rodar só o novo teste sem executar todos:

```powershell
npx playwright test --config=playwright.usuario.config.js --grep "E2E-Usuario-Opcoes-05"
```

Para rodar com browser visível (modo headed, útil para debugar):

```powershell
npx playwright test --config=playwright.usuario.config.js --headed --grep "E2E-Usuario-Opcoes-05"
```

---

### 7 — Execute a suite completa e confirme

```powershell
.\run_all_tests.bat
```

Todos os testes devem passar. Só encerre quando ver a linha:

```
[OK] Frontend: todos os testes passaram.
```

---

## Checklist rápido

```
[ ] Nome segue padrão [E2E-Usuario-Categoria-NN]?
[ ] Dados criados via API têm is_test_data: 1 e observacoes: "[TESTE E2E]"?
[ ] afterAll faz cleanup (ou reutiliza o do describe existente)?
[ ] npx playwright ... --list mostra o teste?
[ ] Dashboard mostra o teste após F5?
[ ] .\run_all_tests.bat termina sem falhas?
```

---

## Dicas extras

### SweetAlert2 (diálogos de confirmação)
Para clicar em "Confirmar" em um dialog SweetAlert2:
```javascript
await page.locator('.swal2-confirm').click();
```

### Esperar recarregamento da tabela após ação
```javascript
await page.waitForResponse(resp =>
  resp.url().includes('/api/opcoes') && resp.status() === 200
);
```

### Capturar screenshot em ponto específico
```javascript
await page.screenshot({ path: 'tests/results/screenshots/meu-teste.png' });
```

### Verificar que um item foi removido da DOM
```javascript
await expect(page.locator(`button[onclick="deleteOperacao('${id}')"]`)).toHaveCount(0);
```

### Criar operação e confirmar via GET (assert de integridade)
```javascript
const check = await request.get(`http://localhost:8888/api/opcoes/${id}`);
expect(check.status()).toBe(404); // garantia de que foi deletado
```

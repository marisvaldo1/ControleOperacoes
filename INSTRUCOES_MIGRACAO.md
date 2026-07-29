# INSTRUÇÕES DE MIGRAÇÃO — Opções2026 → Google Planilhas

## 1. ADICIONAR O SCRIPT

1. Abra sua planilha: https://docs.google.com/spreadsheets/d/1lRNef8xjmY5TPWPrvmW_HMQXLh4ii5t0lloRzRsS7ro/edit
2. Vá em **Extensões → Apps Script**
3. No editor, cole **todo o conteúdo** do arquivo `CodigoGAS.gs`
4. Salve (Ctrl+S) com o nome **"ControleOperacoes"**
5. Feche o editor e **recarregue a planilha** (F5)
6. Um menu **"📊 Controle de Operações"** aparecerá

---

## 2. CONFIGURAR O TOKEN OPLAB

1. Vá em **📊 Controle de Operações → ⚙️ Configurar Token OPLab**
2. Na janela que abrir, cole o token:
   ```
   pCRvMIyonyCf12mvb14P+qLLUu1P3CYORxsM/s9cX5ncRhRNb2XRsb5RKN5r69oc--APbF8Hkq0wXC4aWD/YEBNg==--MzM2NjE0NDlkNmFjNGI4YTMzNWM1MjY3NmY4OTdlZDQ=
   ```
3. Clique OK

> O token fica salvo com segurança no `PropertiesService` do Google (não exposto nas células).

---

## 3. CONFIGURAR ABA "Resultados"

Renomeie a aba existente (ou crie nova) para **"Resultados"**.

### Estrutura de colunas:

| Col | Largura | Cabeçalho (Linha 2) |
|-----|---------|---------------------|
| A | ~20 | Mês |
| B | ~21 | Saldo |
| C | ~19 | Resultado |
| D | ~8 | IRPF |
| E | ~18 | Retiradas |
| F | ~17 | Aportes |
| G | ~16 | Evolução |
| H | ~6 | Anos |
| I | ~13 | Saldo Real |
| J | ~13 | Valor Presente |
| K | ~15 | Valor Futuro |
| L | ~14 | Variação % |
| M | ~15 | Variação R$ |
| N | ~15 | Renda Mensal |
| O | ~18 | Renda Mensal 50% |
| P | ~15 | Previsão de Futuro |

### Dados mensais (Linhas 5 a 16):

- **A5** = Janeiro, **A6** = Fevereiro … **A16** = Dezembro
- Preencha manualmente os valores de Saldo, Resultado, IRPF, Retiradas, Aportes
- As demais colunas (G até P) use fórmulas financeiras conforme sua necessidade

### CDI (célula K4):

- A função `atualizarCDI()` alimenta **K4** com o CDI atual via API do BCB
- Use o menu **📊 Controle → 📈 Atualizar CDI** para atualizar
- K4 pode ser referenciada em fórmulas como `=K4` (ex: projeção de valor futuro)

---

## 4. CONFIGURAR ABA "Crypto"

Renomeie sua aba **"BTC" → "Crypto"** (ou crie uma nova com este nome).

### Linha 1 — Cabeçalhos principais:

| Col | Cabeçalho | Descrição |
|-----|-----------|-----------|
| A | OPERAÇÃO | Ticker na Binance (ex: BTCUSDT, ETHUSDT, SOLUSDT) |
| B | Vencimento | Data de vencimento da opção |
| C | Ação | Ativo subjacente (ex: BTC, ETH) |
| D | C/V | Compra ou Venda |
| E | Tipo | CALL ou PUT |
| F | Quantidade | Número de contratos |
| G | Valor Atual | Preço atual (preenchido pela macro) |
| H | Prêmio | Prêmio da opção |
| I | Strike | Preço de exercício |
| J | Distancia | `=I-G` |
| K | Total Prêmio | `=F*H` |
| L | Lucro | `=F*H*1` |
| M | Total Compra | `=F*I` |
| N | % Prêmio Atual | `=ABS(K/M)` |
| O | Corridos | Dias úteis corridos (0 = vencido/expirado) |
| P | Úteis | Dias úteis totais |
| Q | Saldo | Saldo parcial |
| R | Alvo | Preço alvo |
| S | Saldo Atual | Saldo do mês |
| T | Resultado Final | Resultado final da operação |

### Linha 2 — Sub-cabeçalhos (opcional, para totais mensais):

| Col | Valor |
|-----|-------|
| A | Total |
| K | `=SUM(K3:K260)` |
| L | `=SUM(L3:L260)` |
| M | `=SUM(M3:M260)` |

### Linhas 3+ — Dados das operações:

Exemplo de linha:
```
A3: BTCUSDT
B3: 17/12/2026
C3: BTC
D3: C
E3: CALL
F3: 1
G3: =OBTERCOTACAOBINANCE(A3)   ← OU deixe em branco (macro preenche)
H3: 0.05
I3: 100000
J3: =I3-G3
K3: =F3*H3
L3: =F3*H3*1
M3: =F3*I3
N3: =ABS(K3/M3)
O3: 0   ← 0 = expirado/formatação cinza, >0 = ativo
P3: SIM ou NÃO
```

> **IMPORTANTE**: A coluna O controla o comportamento da macro:
> - **O > 0** (ativo) → macro busca cotação na Binance e atualiza G (+ D se D=0)
> - **O = 0** (expirado) → macro aplica formatação **cinza** (ou cinza-azulado se P="SIM")
> - Se **O = 0 e A estiver vazio** → linha ignorada (sem formatação)

---

## 5. CRIAR GRUPOS (LINHAS AGRUPADAS)

Para replicar o agrupamento mensal do Excel:

1. Selecione as linhas de um mês (ex: 3 a 30)
2. **Dados → Visualizar grupo → Agrupar linhas**
3. Crie uma linha com **"Total Mensal" na coluna J** como cabeçalho do grupo
4. Na linha seguinte do cabeçalho, coloque **"Ativo" na coluna A**

### Estrutura de grupo esperada pela macro:

```
Linha 31:  (vazia ou separador)
Linha 32:  [col J = "Total Mensal"]  ← cabeçalho do grupo
Linha 33:  [col A = "Ativo"]         ← cabeçalho interno
Linha 34:  BTCUSDT  ...              ← primeira operação do mês
Linha 35:  ETHUSDT  ...
...
Linha 60:  (vazia)                   ← fim do grupo
```

> A macro `atualizarValorAtualCrypto()` verifica se **exatamente 1 grupo** está visível (expandido). Se nenhum ou mais de um estiver aberto, ela alerta e não executa.

---

## 6. ADICIONAR BOTÃO DE ATUALIZAÇÃO

1. Na aba **Crypto**, vá em **Inserir → Desenho**
2. Desenhe um retângulo com o texto **"🔄 Atualizar Cotações"**
3. Clique nos **3 pontos** do desenho → **Atribuir script**
4. Digite: **`atualizarViaBotao`**
5. Clique OK

Agora, ao clicar no botão, a macro executará `atualizarValorAtualCrypto()`.

---

## 7. FUNÇÕES CUSTOMIZADAS (USO DIRETO EM CÉLULAS)

### =OBTERCOTACAO(ticker; campo; isAcao)

```
=OBTERCOTACAO("PETR4H260"; "strike"; FALSO)    → retorna o strike
=OBTERCOTACAO("PETR4H260"; "ask"; FALSO)        → retorna o ask
=OBTERCOTACAO("PETR4H260"; "bid"; FALSO)        → retorna o bid
=OBTERCOTACAO("PETR4H260"; "close"; FALSO)      → retorna o close
=OBTERCOTACAO("PETR4H260"; "due_date"; FALSO)   → retorna a data
=OBTERCOTACAO("PETR4"; "close"; VERDADEIRO)     → para ações
```

### =OBTERCOTACAOBINANCE(ticker)

```
=OBTERCOTACAOBINANCE("BTCUSDT")   → retorna o preço do BTC
=OBTERCOTACAOBINANCE("ETHUSDT")   → retorna o preço do ETH
```

> **Atenção**: Custom functions no Google Sheets têm limite de execução (30s total). Se houver muitas chamadas, pode exceder. Nesse caso, use o botão/menu para atualização em lote.

### Fallback CoinGecko

Se a Binance retornar erro **451** (bloqueio regional dos servidores Google), o script automaticamente tenta a [CoinGecko API](https://www.coingecko.com/) como fallback:

```
=OBTERCOTACAOBINANCE("ETHUSDT")
├── Tenta api.binance.com, api1, api2, api3 (com User-Agent)
└── Fallback → api.coingecko.com (converte ETHUSDT → eth)
```

> A CoinGecko tem limite de **10-30 chamadas/minuto** no plano gratuito. Para muitas células, use a macro por botão em vez da função customizada. O fallback só é ativado se todos os endpoints Binance falharem.

---

## 8. FLUXO DE TRABALHO RECOMENDADO

1. Preencha suas operações manualmente (colunas A a F, H, I, O, P)
2. Use **📊 Controle → 🔄 Atualizar Valor Atual (Crypto)** para:
   - Buscar cotações da Binance nas operações ativas (O > 0)
   - Aplicar formatação cinza nas operações expiradas (O = 0)
3. Para opções brasileiras (OPLab), use **📊 Controle → 🔵 Atualizar Cotações OPLab**
4. Atualize o CDI mensalmente via **📊 Controle → 📈 Atualizar CDI**

---

## 9. DIFERENÇAS CONHECIDAS (EXCEL → GOOGLE SHEETS)

| Funcionalidade | Excel (VBA) | Google Sheets (Apps Script) |
|---------------|-------------|---------------------------|
| UDFs em células | `=ObterCotacao()` | `=OBTERCOTACAO()` |
| Atualização | Macro + botão | Menu + botão |
| Token API | Hardcoded no VBA | Armazenado em PropertiesService |
| Agrupamento | Outline (collapse/expand) | Grupo de linhas (hide/show) |
| Formatação condicional | Macro pinta células | Macro aplica Background/FontColor |
| Power Query | CDI via conexão OLE DB | API do BCB via UrlFetchApp |

---

## 10. DICA: PERMISSÕES DO SCRIPT

Na primeira execução, o Google Sheets solicitará permissões:
- **Ver e gerenciar planilhas** — necessário para ler/escrever células
- **Conectar a serviços externos** — necessário para APIs (Binance, OPLab, BCB)

Clique em **"Revisar permissões" → "Avançado" → "Ir para ControleOperacoes (não seguro)" → "Permitir"** (é seu próprio script, seguro).
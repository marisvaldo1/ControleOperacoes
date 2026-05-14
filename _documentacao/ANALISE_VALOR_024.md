# 🔍 Análise do Valor US$ 0,24

## 📊 Contexto

Na tela de Análise de Performance, aparece uma operação:

```
BTC PUT
Prêmio: US$ 17,55  Vcto: -  ABERTA  Exercício 2026-05-07
US$ 0,24  ← ESTE VALOR
```

## ❓ O Que Deveria Ser Este Valor?

Este valor **deveria representar o LUCRO/RESULTADO da operação**, ou seja:
- Para operações **FECHADAS**: Lucro ou prejuízo realizado
- Para operações **ABERTAS**: Lucro ou prejuízo não realizado (mark-to-market)

## 🔍 Possíveis Origens do Valor US$ 0,24

### Hipótese 1: Variação do Prêmio (MAIS PROVÁVEL) ✅

```javascript
// Cálculo: Prêmio Atual - Prêmio de Abertura
const premioAbertura = 17.55;  // Prêmio quando vendeu a opção
const premioAtual = 17.79;     // Prêmio atual no mercado
const resultado = premioAtual - premioAbertura;
// resultado = 17.79 - 17.55 = 0.24 ✓
```

**Interpretação:**
- Vendeu a opção por US$ 17,55
- Agora vale US$ 17,79 no mercado
- Se recomprar agora, **perderia US$ 0,24**
- Para PUT vendida: quanto maior o prêmio atual, pior (prejuízo não realizado)

### Hipótese 2: Percentual Convertido Incorretamente

```javascript
// Se o resultado for 24% e dividir por 100
const resultadoPercentual = 24;  // 24%
const resultado = resultadoPercentual / 100;
// resultado = 0.24 ❌ (ERRADO - deveria manter como 24%)
```

### Hipótese 3: Campo Errado do Banco

```javascript
// Pode estar pegando um campo de taxa/fee
const resultado = op.taxa_corretora;  // 0.24
const resultado = op.fee;             // 0.24
const resultado = op.custo_operacao;  // 0.24
```

### Hipótese 4: Cálculo de Decay Capturado

```javascript
// Para opção vendida, decay é positivo
const premioInicial = 17.55;
const premioAtual = 17.31;  // Decaiu
const decayCapturado = premioInicial - premioAtual;
// decayCapturado = 17.55 - 17.31 = 0.24 ✓
```

## 🎯 Qual Deveria Ser o Valor Correto?

Para uma operação **PUT VENDIDA (ABERTA)**:

### Cenário 1: Operação Lucrativa (OTM)
```
Prêmio Recebido:    US$ 17,55  (entrada de caixa)
Prêmio Atual:       US$ 10,00  (decaiu)
Lucro Não Realizado: US$ 7,55  ✅ (17.55 - 10.00)
```

### Cenário 2: Operação Perdendo (ITM)
```
Prêmio Recebido:    US$ 17,55  (entrada de caixa)
Prêmio Atual:       US$ 25,00  (subiu)
Prejuízo Não Realizado: -US$ 7,45  ❌ (17.55 - 25.00)
```

### Cenário 3: Operação Neutra
```
Prêmio Recebido:    US$ 17,55
Prêmio Atual:       US$ 17,79
Prejuízo Não Realizado: -US$ 0,24  ⚠️ (17.55 - 17.79)
```

## 🔧 Como Verificar a Origem

### 1. Consultar Banco de Dados

```sql
SELECT 
    id,
    ativo_base,
    tipo,
    status,
    premio_us,           -- Prêmio recebido na venda
    preco_entrada,       -- Preço de entrada
    preco_atual,         -- Preço atual da opção
    cotacao_atual,       -- Preço spot do BTC
    resultado,           -- Campo de resultado
    resultado_percentual,
    taxa_corretora,
    fee,
    abertura,
    strike
FROM operacoes_crypto
WHERE ativo_base = 'BTC' 
  AND tipo = 'PUT'
  AND premio_us = 17.55
ORDER BY created_at DESC
LIMIT 1;
```

### 2. Verificar Código JavaScript

No arquivo `frontend/js/shared/modal-analise.js`, procurar:

```javascript
// Linha ~180-200: função getNumber()
function getNumber(op, fields) {
    for (let i = 0; i < fields.length; i++) {
        const v = parseFloat(op[fields[i]]);
        if (!Number.isNaN(v)) return v;
    }
    return 0;
}

// Linha ~220-240: função calcStats()
const resultField = isCrypto
    ? ['premio_us', 'resultado']  // ← Verificar ordem
    : ['resultado', 'resultado_total'];
```

### 3. Adicionar Log de Debug

```javascript
// No renderOpsList(), adicionar:
console.log('[DEBUG] Operação BTC PUT:', {
    id: op.id,
    premio_us: op.premio_us,
    resultado: op.resultado,
    preco_entrada: op.preco_entrada,
    preco_atual: op.preco_atual,
    cotacao_atual: op.cotacao_atual,
    valorExibido: getNumber(op, resultField)
});
```

## 📋 Campos Esperados no Banco

Para operações crypto, a estrutura esperada é:

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `premio_us` | decimal | Prêmio recebido na venda (US$) | 17.55 |
| `preco_entrada` | decimal | Preço da opção na entrada | 17.55 |
| `preco_atual` | decimal | Preço atual da opção | 17.79 |
| `cotacao_atual` | decimal | Preço spot do ativo (BTC) | 65000.00 |
| `abertura` | decimal | Preço do BTC na abertura | 64500.00 |
| `strike` | decimal | Preço de exercício | 64000.00 |
| `resultado` | decimal | **Lucro/Prejuízo calculado** | **-0.24** |
| `resultado_percentual` | decimal | Resultado em % | -1.37 |

## ✅ Cálculo Correto do Resultado

### Para Operação ABERTA (Mark-to-Market)

```javascript
// PUT Vendida
const premioRecebido = 17.55;    // Entrada de caixa
const premioAtual = 17.79;       // Valor atual no mercado
const custoRecompra = premioAtual;
const mtm = premioRecebido - custoRecompra;
// mtm = 17.55 - 17.79 = -0.24 ✓

// Interpretação:
// - Recebeu US$ 17,55 na venda
// - Para fechar agora, pagaria US$ 17,79
// - Prejuízo não realizado: US$ 0,24
```

### Para Operação FECHADA

```javascript
// PUT Vendida e Recomprada
const premioRecebido = 17.55;     // Entrada de caixa
const premioRecompra = 10.00;     // Pagou para fechar
const lucroRealizado = premioRecebido - premioRecompra;
// lucroRealizado = 17.55 - 10.00 = 7.55 ✓
```

## 🎯 Conclusão

O valor **US$ 0,24** provavelmente representa:

1. **Variação do prêmio** (preco_atual - preco_entrada) = 17.79 - 17.55 = 0.24
2. Indica um **prejuízo não realizado** de US$ 0,24
3. Significa que o prêmio da opção **subiu** (ruim para quem vendeu)

### ⚠️ Problema Identificado

Se o valor exibido é **US$ 0,24** mas deveria ser **-US$ 0,24** (negativo), então:

```javascript
// ❌ ERRADO - Está pegando valor absoluto
const resultado = Math.abs(op.preco_atual - op.preco_entrada);

// ✅ CORRETO - Deve manter sinal
const resultado = op.premio_us - op.preco_atual;  // Para PUT vendida
```

## 🔧 Correção Necessária

No código `modal-analise.js`, garantir que:

```javascript
// Para crypto, o campo correto é premio_us
const resultField = isCrypto
    ? ['premio_us', 'resultado']  // ✅ Ordem correta
    : ['resultado', 'resultado_total'];

// E o cálculo deve considerar o sinal
const resultado = getNumber(op, resultField);
// Não aplicar Math.abs() no resultado!
```

## 📊 Validação

Para validar se o cálculo está correto:

1. **Operação Lucrativa** → Valor POSITIVO (verde)
2. **Operação Perdendo** → Valor NEGATIVO (vermelho)
3. **Operação Neutra** → Valor próximo de ZERO

Se todas as operações mostram valores pequenos positivos (0.13, 0.24, 0.29), pode indicar que:
- Está pegando o campo errado (taxa, fee, etc.)
- Está calculando apenas a variação absoluta
- Está dividindo por um valor grande indevidamente

---

**Próximo Passo:** Executar query SQL e adicionar logs de debug para confirmar a origem exata do valor.

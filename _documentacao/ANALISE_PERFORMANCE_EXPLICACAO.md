# Análise de Performance - Crypto: Explicação dos Valores

## 📊 Aba Desempenho - Valores Exibidos

### 1. **Gráfico Donut Central**
- **Valor Central (US$ 729,04)**: Lucro Total acumulado de todas as operações no período
  - **Cálculo**: Soma de `premio_us` (ou `resultado`) de todas as operações
  - **Fonte**: Campo `premio_us` ou `resultado` de cada operação crypto

### 2. **Distribuição por Tipo (CALL/PUT)**
- **Percentual**: Proporção do lucro total por tipo de operação
  - **CALL 58%**: US$ 425,93 (58% do total)
  - **PUT 42%**: US$ 303,11 (42% do total)

### 3. **Métricas Principais**

#### **Win Rate (98%)**
- **Cálculo**: (Operações com lucro / Total de operações) × 100
- **Exemplo**: 89 operações lucrativas de 91 total = 97.8% ≈ 98%

#### **Ticket Médio (US$ 8,01)**
- **Cálculo**: Lucro Total / Número de Operações
- **Exemplo**: US$ 729,04 / 91 operações = US$ 8,01

#### **ROI Total (+9.64%)**
- **Cálculo**: (Lucro Total / Saldo Crypto Configurado) × 100
- **Fonte**: `cryptoConfig.saldoCrypto` do localStorage
- **Exemplo**: US$ 729,04 / US$ 7,560 = 9.64%

### 4. **Lista de Operações Individuais**

Cada operação mostra:

#### **Ícones de Ordenação**
- **📅 Data**: Ordena por data da operação (mais recente primeiro)
- **💰 Resultado**: Ordena por valor do resultado (maior lucro primeiro)
- **📊 %**: Ordena por percentual de retorno sobre o saldo

#### **Informações por Operação**

**Linha 1:**
- **Ativo Base** (BTC, ETH): Badge com o ativo principal
- **Nome da Operação**: Identificação completa
- **Tipo** (CALL/PUT): Badge colorido
  - Verde (#2dc653) para CALL
  - Azul (#4d9de0) para PUT

**Linha 2:**
- **Barra de Progresso**: Representa visualmente o resultado
  - Verde: Lucro
  - Vermelho: Prejuízo
  - Largura proporcional ao maior resultado do período

**Linha 3 - Detalhes:**
- **Prêmio**: Valor recebido na venda da opção (em US$)
- **Vcto** (Vencimento): Data de expiração da opção
- **Duração**: Dias entre abertura e vencimento
- **Status**: ABERTA, FECHADA, etc.
- **Exercício**: SIM/NÃO (se a opção foi exercida)

## ⚠️ PROBLEMA IDENTIFICADO: Valor "US$ 0,13"

### Análise do Problema

Na imagem fornecida, vemos:
```
BTC PUT Data com US$ 0,13
```

Este valor de **US$ 0,13** parece **incorreto** pelos seguintes motivos:

1. **Valor muito baixo**: Para operações de opções de BTC, prêmios típicos são maiores
2. **Inconsistência**: Se o lucro total é US$ 729,04 em 91 operações, a média é US$ 8,01
3. **Possível erro de cálculo**: Pode estar usando o campo errado ou fazendo conversão incorreta

### Possíveis Causas

#### **Causa 1: Campo Errado**
```javascript
// ❌ ERRADO - pode estar pegando cotacao_atual (preço do BTC spot)
const resultado = op.cotacao_atual;

// ✅ CORRETO - deve pegar o prêmio em USD
const resultado = op.premio_us || op.resultado;
```

#### **Causa 2: Conversão Incorreta**
```javascript
// ❌ ERRADO - dividindo por 100 ou 1000 indevidamente
const resultado = op.premio_us / 100;

// ✅ CORRETO - usar valor direto
const resultado = op.premio_us;
```

#### **Causa 3: Mapeamento de Campos**
No código atual (linha 756-770 de modal-analise.js):
```javascript
state.posicoes = filtered.map(op => {
    if (op.exercicio !== undefined && op.vencimento === undefined) {
        return {
            ...op,
            vencimento: op.exercicio,
            // ⚠️ ATENÇÃO: cotacao_atual é o preço do BTC, NÃO o prêmio!
            preco_atual: null,
            preco_ativo_base: op.abertura ?? op.preco_ativo_base,
            preco_entrada: op.preco_entrada,
            premio: op.premio_us ?? op.premio,  // ✅ Correto
            quantidade: 1,
            ativo_base: op.ativo_base || op.ativo,
            cotacao_spot_atual: op.cotacao_atual,
        };
    }
    return op;
});
```

### Campos Corretos para Crypto

| Campo | Descrição | Uso |
|-------|-----------|-----|
| `premio_us` | Prêmio da opção em USD | ✅ Resultado da operação |
| `resultado` | Resultado alternativo | ✅ Fallback para premio_us |
| `cotacao_atual` | Preço spot do BTC/ETH | ❌ NÃO usar como resultado |
| `preco_entrada` | Preço de entrada | ℹ️ Referência histórica |
| `abertura` | Preço do ativo na abertura | ℹ️ Referência histórica |

## 🔧 Correções Necessárias

### 1. Verificar Função `getNumber()`
```javascript
function getNumber(op, fields) {
    for (let i = 0; i < fields.length; i++) {
        const v = parseFloat(op[fields[i]]);
        if (!Number.isNaN(v)) return v;
    }
    return 0;
}

// Uso correto para crypto:
const resultField = ['premio_us', 'resultado'];  // ✅ Ordem correta
const resultado = getNumber(op, resultField);
```

### 2. Verificar Cálculo de Estatísticas
```javascript
function calcStats(ops) {
    const isCrypto = state.apiEndpoint.includes('/crypto');
    const resultField = isCrypto
        ? ['premio_us', 'resultado']  // ✅ Correto
        : ['resultado', 'resultado_total', 'resultado_op', 'resultado_fechamento'];

    const totalResult = ops.reduce((s, op) => s + getNumber(op, resultField), 0);
    // ... resto do código
}
```

### 3. Adicionar Validação e Logs
```javascript
// Adicionar logs para debug
ops.forEach(op => {
    const resultado = getNumber(op, ['premio_us', 'resultado']);
    if (resultado < 0.5 && resultado > 0) {
        console.warn('[modal-analise] Valor suspeito:', {
            id: op.id,
            ativo: op.ativo_base,
            tipo: op.tipo,
            resultado,
            premio_us: op.premio_us,
            cotacao_atual: op.cotacao_atual,
            raw: op
        });
    }
});
```

## 💡 Melhorias Sugeridas

### 1. **Tooltips Explicativos**
Adicionar tooltips em cada métrica:
```html
<div class="ma-metric-row" title="Percentual de operações lucrativas">
    <span class="ma-metric-label">Win Rate</span>
    <span class="ma-metric-value" id="maWinRate">0%</span>
</div>
```

### 2. **Indicadores Visuais**
- Ícones para cada tipo de métrica
- Cores consistentes (verde=lucro, vermelho=prejuízo)
- Badges para status

### 3. **Detalhamento Expandido**
Ao clicar em uma operação, mostrar:
- Histórico de preços
- Gráfico de P&L
- Detalhes da estratégia
- Comparativo com média

### 4. **Filtros Adicionais**
- Por ativo (BTC, ETH, etc.)
- Por corretora (Binance, Bybit)
- Por faixa de lucro
- Por duração

### 5. **Exportação de Dados**
- CSV com todas as operações
- Relatório PDF
- Gráficos para compartilhamento

## 📋 Checklist de Verificação

- [ ] Confirmar que `premio_us` contém o valor correto no banco de dados
- [ ] Verificar se não há divisão/multiplicação indevida
- [ ] Validar que `cotacao_atual` não está sendo usado como resultado
- [ ] Testar com operações reais e comparar com valores esperados
- [ ] Adicionar logs de debug para valores suspeitos
- [ ] Implementar validação de dados na API
- [ ] Adicionar testes unitários para cálculos
- [ ] Documentar formato esperado dos dados

## 🎯 Próximos Passos

1. **Investigar dados reais**: Consultar o banco de dados para ver os valores de `premio_us`
2. **Adicionar logs**: Implementar logging detalhado para rastrear cálculos
3. **Criar testes**: Escrever testes unitários para funções de cálculo
4. **Validar API**: Garantir que a API retorna dados no formato correto
5. **Atualizar documentação**: Manter este documento atualizado com descobertas

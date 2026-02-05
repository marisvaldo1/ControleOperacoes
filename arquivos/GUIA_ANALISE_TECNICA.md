# 🚀 Guia Rápido - Análise Técnica

## Como Usar em 3 Passos

### 1️⃣ Abrir a Simulação
1. Na página de Opções, clique em **"Simular"**
2. Selecione um **Ativo Base** (ex: PETR4)
3. Clique em **"Buscar Opções"**
4. Selecione uma opção da lista

### 2️⃣ Abrir Análise Técnica
- Clique no botão azul **"Análise Técnica"** (ao lado de "Análise IA")
- Uma janela modal será aberta com os gráficos

### 3️⃣ Interpretar os Resultados

#### **Topo da Janela**
```
┌─────────────────────────────────────┐
│  COMPRA FORTE                       │ ← Recomendação consolidada
│  Baseado em 24 indicadores          │
└─────────────────────────────────────┘
```

#### **Gráfico 1: Gauge de Força**
```
      -100          0          +100
       ├────────────┼────────────┤
      VENDA      NEUTRO      COMPRA
```
- Verde: Força de compra
- Vermelho: Força de venda
- Cinza: Neutro

#### **Gráfico 2: Osciladores**
```
Compra  ████████ 5
Neutro  ██ 1
Venda   ████ 2
```
- Mostra quantos osciladores indicam cada direção

#### **Gráfico 3: Médias Móveis**
```
Compra  ████████████ 12
Neutro  ██ 2
Venda   ████ 3
```
- Mostra quantas médias móveis indicam cada direção

#### **Tabelas Detalhadas**
- Lista todos os indicadores com valores e sinais individuais
- RSI, MACD, Stochastic, CCI, etc.
- SMAs, EMAs, VWMA, HullMA, Ichimoku

## 🎯 Interpretação dos Sinais

| Recomendação | Significado | Ação Sugerida |
|--------------|-------------|---------------|
| **COMPRA FORTE** | >60% indicadores sugerem compra | Considere entrar comprado |
| **COMPRA** | 50-60% indicam compra | Sinal positivo moderado |
| **NEUTRO** | Sinais mistos | Aguarde definição |
| **VENDA** | 50-60% indicam venda | Sinal negativo moderado |
| **VENDA FORTE** | >60% indicadores sugerem venda | Considere sair ou vender |

## ⏱️ Timeframes Disponíveis

Use o dropdown no topo direito da janela para alterar:
- **1 Minuto**: Análise de curtíssimo prazo
- **5 Minutos**: Day trade
- **15 Minutos**: Day trade / Swing
- **1 Hora**: Swing trade
- **4 Horas**: Swing trade (padrão)
- **1 Dia**: Position trade

💡 **Dica**: Timeframes maiores = sinais mais confiáveis mas menos frequentes

## 📊 Indicadores Calculados

### Osciladores (7)
1. **RSI (14)**: Identifica sobrecompra/sobrevenda
2. **Stochastic (14,3)**: Momentum de curto prazo
3. **CCI (20)**: Commodity Channel Index
4. **ADX (14)**: Força da tendência
5. **Williams %R (14)**: Oscilador de momento
6. **MACD (12,26,9)**: Convergência/divergência de médias
7. **Bull/Bear Power (13)**: Força de compradores vs vendedores

### Médias Móveis (15)
1-6. **SMA**: 10, 20, 30, 50, 100, 200 períodos
7-12. **EMA**: 10, 20, 30, 50, 100, 200 períodos
13. **VWMA (20)**: Ponderada por volume
14. **HullMA (9)**: Hull Moving Average
15. **Ichimoku**: Cloud completo

## 🎨 Cores dos Sinais

| Cor | Significado |
|-----|-------------|
| 🟢 Verde | Sinal de COMPRA |
| ⚪ Cinza | Sinal NEUTRO |
| 🔴 Vermelho | Sinal de VENDA |

## ⚠️ Avisos Importantes

### ⚠️ Dados Mock (Temporário)
Atualmente, a análise usa **dados simulados** para demonstração.
- Os indicadores são calculados corretamente
- Mas os preços são gerados artificialmente
- **TODO**: Integração com API de dados reais

### 💡 Dicas de Uso
1. **Combine com análise fundamentalista**
   - Análise técnica não é garantia de lucro
   
2. **Use múltiplos timeframes**
   - Verifique se os sinais são consistentes em diferentes períodos
   
3. **Não siga cegamente**
   - Use como ferramenta de apoio, não como única fonte de decisão
   
4. **Contexto de mercado**
   - Considere notícias, eventos econômicos, etc.

## 🔧 Troubleshooting

### Problema: Modal não abre
**Solução**: Certifique-se de ter selecionado uma opção na simulação primeiro

### Problema: Gráficos não aparecem
**Solução**: 
1. Abra o Console do navegador (F12)
2. Verifique se há erros em vermelho
3. Recarregue a página (Ctrl+F5)

### Problema: Valores parecem estranhos
**Solução**: 
1. Lembre-se que estão usando dados mock
2. Os cálculos estão corretos, mas os dados de entrada são simulados
3. Aguarde integração com API real de dados

## 📚 Aprender Mais

### Sobre os Indicadores
- [Investopedia - Technical Indicators](https://www.investopedia.com/terms/t/technicalindicator.asp)
- [TradingView - Education](https://www.tradingview.com/education/)

### Sobre Chart.js
- [Chart.js Documentation](https://www.chartjs.org/)

## 🆘 Suporte

Encontrou um bug ou tem uma sugestão?
1. Abra um issue no repositório
2. Descreva o problema detalhadamente
3. Inclua prints se possível

## 🔮 Próximas Funcionalidades

- [ ] Integração com API real de dados históricos
- [ ] Padrões de candlestick (Engolfo, Martelo, etc)
- [ ] Fibonacci Retracements
- [ ] Bollinger Bands
- [ ] Alertas configuráveis
- [ ] Backtesting de estratégias
- [ ] Exportar análise em PDF
- [ ] Histórico de análises

---

**Versão**: 1.0  
**Última atualização**: 03/02/2026  
**Status**: ✅ Funcional (com dados mock)

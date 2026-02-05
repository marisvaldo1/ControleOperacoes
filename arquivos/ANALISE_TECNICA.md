# Análise Técnica - Documentação

## 📊 Visão Geral

Implementação de análise técnica avançada baseada no padrão TradingView, com 24+ indicadores técnicos incluindo osciladores, médias móveis e indicadores de tendência.

## 🎯 Funcionalidades

### 1. **Osciladores Implementados**
- **RSI (Relative Strength Index)** - Período: 14
- **Stochastic Oscillator** - Períodos: %K=14, %D=3
- **CCI (Commodity Channel Index)** - Período: 20
- **ADX (Average Directional Index)** - Período: 14
- **Williams %R** - Período: 14
- **MACD** - Períodos: 12, 26, 9
- **Bull/Bear Power** - Período: 13

### 2. **Médias Móveis Implementadas**
- **SMA** (Simple Moving Average): 10, 20, 30, 50, 100, 200
- **EMA** (Exponential Moving Average): 10, 20, 30, 50, 100, 200
- **VWMA** (Volume Weighted Moving Average): 20
- **HullMA** (Hull Moving Average): 9
- **Ichimoku Cloud** - Completo com Tenkan, Kijun, Senkou A/B

### 3. **Timeframes Disponíveis**
- 1 Minuto
- 5 Minutos
- 15 Minutos
- 1 Hora
- 4 Horas (Padrão)
- 1 Dia

## 📁 Arquivos Criados/Modificados

### Novos Arquivos
1. **`frontend/js/technical-analysis.js`**
   - Classe `TechnicalAnalysis` com todos os cálculos
   - Métodos de análise consolidada
   - Formatação de resultados para exibição

### Arquivos Modificados
1. **`frontend/html/opcoes.html`**
   - Adicionado modal `#modalAnaliseTecnica`
   - Botão "Análise Técnica" ao lado de "Análise IA"
   - Import do script `technical-analysis.js`

2. **`frontend/js/opcoes.js`**
   - Função `openTechnicalAnalysisModal()`
   - Funções de criação de gráficos (Gauge, Barras)
   - Manipulação de timeframes
   - Geração de dados mock para demonstração

3. **`frontend/css/opcoes.css`**
   - Estilos para modal de análise técnica
   - Estilos para gráficos e tabelas
   - Responsividade mobile

## 🚀 Como Usar

### 1. Acessar a Análise Técnica
1. Abra a página de Opções
2. Clique em **"Simular"**
3. Selecione uma opção na lista
4. Clique no botão **"Análise Técnica"** (ao lado de "Análise IA")

### 2. Alterar Timeframe
- Use o dropdown no canto superior direito do modal
- Os indicadores serão recalculados automaticamente

### 3. Interpretar os Resultados

#### **Recomendação Geral**
- **Compra Forte**: >60% dos indicadores sugerem compra
- **Compra**: 50-60% dos indicadores sugerem compra
- **Neutro**: Sinais mistos
- **Venda**: 50-60% dos indicadores sugerem venda
- **Venda Forte**: >60% dos indicadores sugerem venda

#### **Gauge de Força**
- Valores de -100 (Venda Forte) a +100 (Compra Forte)
- Verde: Compra
- Cinza: Neutro
- Vermelho: Venda

#### **Gráficos de Barras**
Mostram a distribuição dos sinais:
- Verde: Indicadores em Compra
- Cinza: Indicadores Neutros
- Vermelho: Indicadores em Venda

## 🔧 Arquitetura Técnica

### Classe TechnicalAnalysis

```javascript
const analyzer = new TechnicalAnalysis();

// Analisar dados
const analysis = analyzer.analyzeAll(highs, lows, closes, volumes);

// Formatar para exibição
const formatted = analyzer.formatAnalysisForDisplay(analysis);
```

### Estrutura de Retorno

```javascript
{
  summary: {
    oscillators: { buy: 3, sell: 2, neutral: 2, total: 7 },
    movingAverages: { buy: 10, sell: 4, neutral: 3, total: 17 },
    overall: {
      signal: 'BUY',
      buy: 13,
      sell: 6,
      neutral: 5,
      total: 24,
      buyPercent: '54.2',
      sellPercent: '25.0'
    }
  },
  raw: {
    oscillators: { rsi: 45.2, macd: {...}, ... },
    movingAverages: { sma10: 35.5, ema20: 36.1, ... }
  }
}
```

## 📊 Gráficos Implementados

### 1. Gauge Semicircular (Chart.js Doughnut)
- Tipo: `doughnut` com 180° de circunferência
- Mostra força do sinal de -100 a +100
- Cores dinâmicas baseadas no valor

### 2. Gráfico de Osciladores (Chart.js Bar)
- Tipo: `bar` horizontal
- 3 categorias: Compra, Neutro, Venda
- Conta quantidade de indicadores em cada categoria

### 3. Gráfico de Médias Móveis (Chart.js Bar)
- Tipo: `bar` horizontal
- 3 categorias: Compra, Neutro, Venda
- Baseado na relação preço x média

## 🔮 Próximos Passos (TODO)

### Integração com API Real
Atualmente usa dados mock. Integrar com:
1. API do backend para buscar dados históricos
2. Suporte a diferentes timeframes reais
3. Cache de dados para performance

### Melhorias Futuras
1. **Padrões de Candlestick**
   - Engolfo, Martelo, Estrela Cadente, etc.

2. **Indicadores Adicionais**
   - Fibonacci Retracements
   - Bollinger Bands
   - SAR Parabólico

3. **Backtesting**
   - Testar estratégias baseadas nos sinais
   - Relatório de performance histórica

4. **Alertas**
   - Notificações quando indicadores mudam de sinal
   - Configuração de gatilhos personalizados

## 📝 Cálculos Detalhados

### RSI (Relative Strength Index)
```
RS = Média de Ganhos / Média de Perdas
RSI = 100 - (100 / (1 + RS))

Interpretação:
- RSI < 30: Sobrevendido (Compra)
- RSI > 70: Sobrecomprado (Venda)
- RSI 30-70: Neutro
```

### MACD
```
MACD Line = EMA(12) - EMA(26)
Signal Line = EMA(9) do MACD
Histogram = MACD - Signal

Interpretação:
- Histogram > 0: Compra
- Histogram < 0: Venda
```

### Stochastic
```
%K = ((Close - Low14) / (High14 - Low14)) * 100
%D = SMA(3) de %K

Interpretação:
- %K < 20: Sobrevendido (Compra)
- %K > 80: Sobrecomprado (Venda)
```

### Médias Móveis
```
Sinal = Preço Atual vs Média

Interpretação:
- Preço > Média: Compra
- Preço < Média: Venda
```

## 🎨 Design Pattern

A implementação segue o padrão MVC:
- **Model**: `TechnicalAnalysis` class (cálculos puros)
- **View**: Modal HTML + Charts
- **Controller**: Funções em `opcoes.js`

Separação clara de responsabilidades:
- `technical-analysis.js`: Lógica de negócio
- `opcoes.js`: Integração e UI
- `opcoes.css`: Apresentação

## 🐛 Debug

### Verificar Dados Mock
```javascript
const data = generateMockHistoricalData('PETR4', 200);
console.log('Closes:', data.closes);
console.log('Highs:', data.highs);
console.log('Lows:', data.lows);
```

### Verificar Análise
```javascript
const analysis = technicalAnalyzer.analyzeAll(highs, lows, closes, volumes);
console.log('Analysis:', analysis);
```

### Verificar Gráficos
```javascript
console.log('Gauge Chart:', chartTecnicalGauge);
console.log('Oscillators Chart:', chartTecnicalOscillators);
console.log('MA Chart:', chartTecnicalMA);
```

## 📚 Referências

- **TradingView**: Padrão de referência para análise técnica
- **Chart.js**: Biblioteca de gráficos utilizada
- **Technical Analysis Library**: Algoritmos baseados em fórmulas padrão do mercado

## 🤝 Contribuindo

Para adicionar novos indicadores:
1. Adicione o cálculo em `technical-analysis.js`
2. Adicione a avaliação em `evaluateOscillators()` ou `evaluateMovingAverages()`
3. Adicione a linha na tabela de detalhes

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verifique o console do navegador
2. Valide os dados de entrada
3. Teste com diferentes timeframes
4. Revise a documentação dos indicadores

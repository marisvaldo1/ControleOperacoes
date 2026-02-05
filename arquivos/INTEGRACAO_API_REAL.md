# 🔌 Guia de Integração com API Real

## 📌 Status Atual

Atualmente, a análise técnica usa **dados históricos simulados (mock)** através da função `generateMockHistoricalData()`.

Para tornar a análise técnica **100% funcional**, é necessário integrar com uma API real de dados históricos.

## 🎯 Objetivo

Substituir a função mock por chamadas a uma API que retorne dados históricos reais de preços (OHLCV - Open, High, Low, Close, Volume).

## 🔧 Modificações Necessárias

### 1. Criar Endpoint no Backend

**Arquivo**: `backend/server.py`

Adicionar novo endpoint:

```python
@app.route('/api/historical-data/<ticker>', methods=['GET'])
def get_historical_data(ticker):
    """
    Retorna dados históricos de um ativo
    
    Query params:
    - timeframe: 1m, 5m, 15m, 1h, 4h, 1D
    - periods: quantidade de períodos (padrão: 200)
    """
    timeframe = request.args.get('timeframe', '4h')
    periods = int(request.args.get('periods', 200))
    
    try:
        # Integrar com sua fonte de dados preferida
        data = fetch_historical_data(ticker, timeframe, periods)
        
        return jsonify({
            'success': True,
            'ticker': ticker,
            'timeframe': timeframe,
            'data': data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
```

### 2. Modificar Frontend

**Arquivo**: `frontend/js/opcoes.js`

Substituir a função `loadAndAnalyzeTechnicalData()`:

```javascript
async function loadAndAnalyzeTechnicalData(ticker, timeframe) {
    try {
        // ANTES (Mock):
        // const historicalData = generateMockHistoricalData(ticker, 200);
        
        // DEPOIS (API Real):
        const response = await fetch(
            `${API_BASE}/api/historical-data/${ticker}?timeframe=${timeframe}&periods=200`
        );
        
        if (!response.ok) {
            throw new Error('Erro ao buscar dados históricos');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Dados inválidos');
        }
        
        const historicalData = result.data;
        const { highs, lows, closes, volumes } = historicalData;
        
        // Resto do código continua igual...
        const analysis = technicalAnalyzer.analyzeAll(highs, lows, closes, volumes);
        // ...
        
    } catch (error) {
        console.error('Erro na análise técnica:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Erro ao buscar dados históricos: ' + error.message,
            background: '#1f2937',
            color: '#e2e8f0'
        });
        
        document.getElementById('tecnicalLoading').style.display = 'none';
    }
}
```

## 📊 Fontes de Dados Sugeridas

### Opção 1: Yahoo Finance (Python)
```python
import yfinance as yf

def fetch_historical_data(ticker, timeframe, periods):
    # Mapear timeframe para formato yfinance
    interval_map = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        '4h': '4h',
        '1D': '1d'
    }
    
    interval = interval_map.get(timeframe, '1h')
    
    # Ajustar ticker para padrão brasileiro (se necessário)
    if not ticker.endswith('.SA'):
        ticker = ticker + '.SA'
    
    # Buscar dados
    stock = yf.Ticker(ticker)
    df = stock.history(period=f'{periods}d', interval=interval)
    
    if df.empty:
        raise ValueError(f'Nenhum dado encontrado para {ticker}')
    
    # Converter para formato esperado
    return {
        'closes': df['Close'].tolist(),
        'highs': df['High'].tolist(),
        'lows': df['Low'].tolist(),
        'volumes': df['Volume'].tolist(),
        'dates': df.index.strftime('%Y-%m-%d %H:%M:%S').tolist()
    }
```

### Opção 2: Alpha Vantage (API)
```python
import requests

ALPHA_VANTAGE_API_KEY = 'sua_chave_aqui'

def fetch_historical_data(ticker, timeframe, periods):
    # Mapear timeframe para função Alpha Vantage
    function_map = {
        '1m': 'TIME_SERIES_INTRADAY',
        '5m': 'TIME_SERIES_INTRADAY',
        '15m': 'TIME_SERIES_INTRADAY',
        '1h': 'TIME_SERIES_INTRADAY',
        '1D': 'TIME_SERIES_DAILY'
    }
    
    interval_map = {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '1h': '60min'
    }
    
    function = function_map.get(timeframe, 'TIME_SERIES_INTRADAY')
    interval = interval_map.get(timeframe, '60min')
    
    url = f'https://www.alphavantage.co/query?function={function}&symbol={ticker}&interval={interval}&apikey={ALPHA_VANTAGE_API_KEY}'
    
    response = requests.get(url)
    data = response.json()
    
    # Processar resposta e converter para formato esperado
    # ... (código específico para Alpha Vantage)
    
    return {
        'closes': [...],
        'highs': [...],
        'lows': [...],
        'volumes': [...]
    }
```

### Opção 3: Seu Próprio Banco de Dados
```python
def fetch_historical_data(ticker, timeframe, periods):
    # Buscar do seu banco de dados
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            close_price,
            high_price,
            low_price,
            volume,
            timestamp
        FROM historical_prices
        WHERE ticker = ?
        AND timeframe = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """
    
    cursor.execute(query, (ticker, timeframe, periods))
    rows = cursor.fetchall()
    
    return {
        'closes': [row['close_price'] for row in rows],
        'highs': [row['high_price'] for row in rows],
        'lows': [row['low_price'] for row in rows],
        'volumes': [row['volume'] for row in rows]
    }
```

### Opção 4: B3 API (Dados Oficiais)
```python
# Usar biblioteca especializada em B3
# Exemplo conceitual - ajustar conforme API disponível

def fetch_historical_data(ticker, timeframe, periods):
    # Conectar com API da B3 ou provedor autorizado
    # Implementação específica depende do acesso contratado
    pass
```

## 🔐 Segurança e Performance

### Cache de Dados
```python
from functools import lru_cache
from datetime import datetime, timedelta

# Cache por 5 minutos
@lru_cache(maxsize=100)
def fetch_historical_data_cached(ticker, timeframe, periods, cache_key):
    return fetch_historical_data(ticker, timeframe, periods)

@app.route('/api/historical-data/<ticker>', methods=['GET'])
def get_historical_data(ticker):
    timeframe = request.args.get('timeframe', '4h')
    periods = int(request.args.get('periods', 200))
    
    # Cache key baseado em timestamp (invalida a cada 5 min)
    cache_key = int(datetime.now().timestamp() / 300)
    
    try:
        data = fetch_historical_data_cached(ticker, timeframe, periods, cache_key)
        # ...
```

### Rate Limiting
```python
from flask_limiter import Limiter

limiter = Limiter(
    app,
    key_func=lambda: request.remote_addr,
    default_limits=["100 per hour"]
)

@app.route('/api/historical-data/<ticker>', methods=['GET'])
@limiter.limit("30 per minute")
def get_historical_data(ticker):
    # ...
```

## 📝 Checklist de Integração

### Backend
- [ ] Escolher fonte de dados (Yahoo, Alpha Vantage, etc)
- [ ] Instalar dependências necessárias (`pip install yfinance`)
- [ ] Criar endpoint `/api/historical-data/<ticker>`
- [ ] Implementar `fetch_historical_data()`
- [ ] Adicionar tratamento de erros
- [ ] Implementar cache (opcional mas recomendado)
- [ ] Adicionar rate limiting (opcional)
- [ ] Testar endpoint com Postman/curl

### Frontend
- [ ] Substituir `generateMockHistoricalData()` por `fetch()`
- [ ] Adicionar tratamento de erros
- [ ] Testar com diferentes tickers
- [ ] Testar com diferentes timeframes
- [ ] Validar formato dos dados retornados
- [ ] Adicionar loading states
- [ ] Testar em mobile

### Testes
- [ ] Testar com ativo válido (PETR4)
- [ ] Testar com ativo inválido (XXXX)
- [ ] Testar sem conexão com API
- [ ] Testar com timeframes diferentes
- [ ] Testar performance (tempo de resposta)
- [ ] Verificar se cálculos estão corretos

## 🧪 Exemplo de Teste

### 1. Testar Endpoint (Postman/curl)
```bash
curl "http://localhost:5000/api/historical-data/PETR4?timeframe=1h&periods=200"
```

Resposta esperada:
```json
{
  "success": true,
  "ticker": "PETR4",
  "timeframe": "1h",
  "data": {
    "closes": [35.50, 35.60, 35.40, ...],
    "highs": [35.70, 35.80, 35.60, ...],
    "lows": [35.30, 35.40, 35.20, ...],
    "volumes": [150000, 180000, 160000, ...]
  }
}
```

### 2. Verificar no Frontend
Abrir Console do navegador e verificar:
```javascript
console.log('Historical Data:', historicalData);
console.log('Analysis:', analysis);
```

## ⚠️ Considerações Importantes

### Limites de APIs Gratuitas
- **Yahoo Finance**: Sem limite oficial, mas pode bloquear uso excessivo
- **Alpha Vantage**: 5 requisições/minuto (plano grátis)
- **IEX Cloud**: 50.000 mensagens/mês (plano grátis)

### Dados da B3
- Atraso de 15 minutos para dados gratuitos
- Dados em tempo real requerem assinatura
- Considere custos vs benefícios

### Performance
- Dados de 1 minuto = muito volume, use com moderação
- Dados diários = menos volume, mais cache-friendly
- Considere armazenar histórico localmente

## 🚀 Próximos Passos

1. **Escolher fonte de dados** baseado em:
   - Custo
   - Latência aceitável
   - Cobertura de ativos
   - Qualidade dos dados

2. **Implementar backend primeiro**
   - Criar endpoint
   - Testar isoladamente
   - Documentar API

3. **Integrar frontend**
   - Substituir mock
   - Adicionar error handling
   - Testar end-to-end

4. **Otimizar**
   - Adicionar cache
   - Implementar retry logic
   - Monitorar performance

## 📞 Suporte

Para dúvidas sobre integração:
1. Revise a documentação da API escolhida
2. Verifique exemplos de código
3. Teste endpoints isoladamente antes de integrar

## 📚 Recursos Úteis

### Yahoo Finance
- Biblioteca: https://pypi.org/project/yfinance/
- Documentação: https://github.com/ranaroussi/yfinance

### Alpha Vantage
- Website: https://www.alphavantage.co/
- Documentação: https://www.alphavantage.co/documentation/

### IEX Cloud
- Website: https://iexcloud.io/
- Documentação: https://iexcloud.io/docs/api/

### Pandas TA (Technical Analysis)
- Biblioteca: https://github.com/twopirllc/pandas-ta
- Pode complementar seus cálculos

---

**Próximo passo recomendado**: Implementar integração com Yahoo Finance (mais simples e gratuito)

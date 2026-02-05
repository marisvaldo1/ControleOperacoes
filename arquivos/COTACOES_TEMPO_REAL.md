# Cotações em Tempo Real - Opções e Recomendações

## Situação Atual

### API OpLab (Implementada)
Você já está usando a **OpLab API** que fornece:
- ✅ **Cotações de OPÇÕES** - Diferencial importante!
- ✅ Dados estruturados (strikes, vencimentos, gregas)
- ✅ Suporte específico para mercado brasileiro
- ✅ Já integrada no sistema (`/api/proxy/options/{ticker}`)
- ⚠️ Delay de 15-20 minutos (dados gratuitos/delayed da B3)

### Problema Identificado
- **TradingView**: Mostra cotações em tempo real do ATIVO BASE (delay < 1 segundo)
- **API OpLab**: Delay de 15-20 minutos (ativo base + opções)
- **Resultado**: Valores diferentes entre o gráfico e a simulação

---

## 🎯 ANÁLISE: Vale a Pena Manter a OpLab?

### ✅ **SIM! MANTENHA A OpLab**

**Motivos:**

1. **Única Fonte Confiável de Dados de OPÇÕES**
   - Outras APIs (Alpha Vantage, Yahoo Finance, Twelve Data) têm cobertura **LIMITADA ou ZERO** de opções brasileiras
   - OpLab fornece: strikes, vencimentos, delta, theta, gamma, vega, IV
   - Essencial para seu sistema de análise de opções

2. **Já Está Integrada**
   - Backend funcionando (`server.py` com `/api/proxy/options`)
   - Frontend consumindo dados estruturados
   - Remover = reescrever muita coisa

3. **Custo-Benefício**
   - Se é gratuita ou com plano acessível, mantenha
   - Alternativas para opções são caras (B3 official > R$ 500/mês)

---

## 💡 SOLUÇÃO HÍBRIDA RECOMENDADA

### Estratégia: "Melhor dos Dois Mundos"

#### Para ATIVO BASE (PETR4, VALE3, etc.):
- 🔴 **Tempo Real**: Alpha Vantage / yfinance / Twelve Data
- 📈 **Visualização**: TradingView (já implementado)
- 🎯 **Uso**: Preço spot para cálculos de gregas e PoP

#### Para OPÇÕES (PETRK45, VALEH34, etc.):
- 🟢 **Manter OpLab**: Única fonte confiável
- ✅ **Aceitar delay**: 15-20 min é aceitável para opções
- 💡 **Explicar ao usuário**: Opções têm menos liquidez, delay menor impacto

### Por Que Isso Funciona?

| Item | Frequência de Mudança | Impacto do Delay | Solução |
|------|----------------------|------------------|---------|
| **Ativo Base** (PETR4) | Alta (segundos) | 🔴 Alto | Tempo real (Alpha/yfinance) |
| **Preço da Opção** | Média (minutos) | 🟡 Médio | OpLab (15-20 min OK) |
| **Gregas da Opção** | Baixa (horas) | 🟢 Baixo | OpLab (15-20 min OK) |
| **IV / Strikes** | Muito baixa (dias) | 🟢 Baixo | OpLab (15-20 min OK) |

**Conclusão**: Delay em opções é menos crítico que em ações!

---

## 🔧 IMPLEMENTAÇÃO: Sistema Híbrido

### Arquitetura Proposta

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  📊 Gráfico (TradingView)  →  Tempo Real       │
│  💰 Cotação Ativo Base     →  Alpha/yfinance    │
│  📋 Lista de Opções        →  OpLab             │
│  📊 Gregas/IV/PoP          →  OpLab             │
│                                                  │
└─────────────────────────────────────────────────┘
           ↓                    ↓
    ┌──────────┐          ┌──────────┐
    │ Alpha/YF │          │  OpLab   │
    │  (Real)  │          │ (Delay)  │
    └──────────┘          └──────────┘
```

### Código Backend (server.py)

```python
import requests
import yfinance as yf
from flask import jsonify

# ============================================
# ENDPOINT 1: Cotação Tempo Real (Ativo Base)
# ============================================
@app.route('/api/cotacao/realtime/<ticker>')
def get_realtime_quote(ticker):
    """
    Obtém cotação em tempo real do ATIVO BASE usando yfinance
    Delay: ~5-10 minutos (melhor que OpLab)
    Uso: Cálculos de gregas, PoP, simulações
    """
    try:
        # yfinance (gratuito, delay ~5-10 min)
        stock = yf.Ticker(f'{ticker}.SA')
        info = stock.info
        hist = stock.history(period='1d', interval='1m')
        
        if hist.empty:
            return jsonify({'error': 'Sem dados'}), 404
            
        current_price = hist['Close'].iloc[-1]
        prev_close = info.get('previousClose', current_price)
        change = current_price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0
        
        return jsonify({
            'ticker': ticker,
            'price': round(current_price, 2),
            'change': round(change, 2),
            'change_percent': round(change_pct, 2),
            'volume': int(hist['Volume'].iloc[-1]),
            'timestamp': hist.index[-1].isoformat(),
            'source': 'yfinance',
            'delay_minutes': '5-10'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# ENDPOINT 2: Opções (Manter OpLab)
# ============================================
@app.route('/api/proxy/options/<ticker>')
def get_options_chain(ticker):
    """
    Obtém chain de opções usando OpLab (já implementado)
    Delay: 15-20 minutos (aceitável para opções)
    Uso: Lista de strikes, vencimentos, gregas, IV
    """
    try:
        # Sua implementação atual da OpLab
        oplab_url = f'{OPLAB_API_BASE}/opcoes/{ticker}'
        response = requests.get(oplab_url, headers={'Authorization': f'Bearer {OPLAB_TOKEN}'})
        data = response.json()
        
        return jsonify({
            'opcoes': data.get('opcoes', []),
            'spot_price': data.get('spot_price'),
            'source': 'OpLab',
            'delay_minutes': '15-20'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# ENDPOINT 3: Híbrido - Melhor dos Dois
# ============================================
@app.route('/api/cotacao/hibrido/<ticker>')
def get_hybrid_quote(ticker):
    """
    Combina yfinance (ativo base real-time) + OpLab (opções)
    Retorna dados completos com delay reduzido no spot
    """
    try:
        # 1. Buscar ativo base (tempo real)
        realtime_data = get_realtime_quote(ticker)
        spot_price = realtime_data.json.get('price')
        
        # 2. Buscar opções (OpLab)
        options_data = get_options_chain(ticker)
        opcoes = options_data.json.get('opcoes', [])
        
        # 3. Recalcular gregas com preço spot atualizado
        for opcao in opcoes:
            # Seus cálculos existentes de Black-Scholes
            # usando spot_price atualizado em vez do delayed da OpLab
            pass
        
        return jsonify({
            'ticker': ticker,
            'spot_price': spot_price,
            'spot_source': 'yfinance (realtime)',
            'opcoes': opcoes,
            'opcoes_source': 'OpLab (delayed)',
            'hybrid': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### Código Frontend (opcoes.js)

```javascript
/**
 * Busca cotação híbrida (ativo base real + opções OpLab)
 */
async function buscarCotacaoHibrida(ticker) {
    try {
        // Usar endpoint híbrido
        const response = await fetch(`${API_BASE}/api/cotacao/hibrido/${ticker}`);
        const data = await response.json();
        
        // Atualizar cotação ativo base (tempo real)
        cotacaoAtivoBase = data.spot_price;
        
        // Atualizar lista de opções (OpLab)
        simOpcoesDisponiveis = data.opcoes;
        
        // Mostrar fonte dos dados
        console.log('Spot:', data.spot_source, '| Opções:', data.opcoes_source);
        
        return data;
    } catch (error) {
        console.error('Erro:', error);
        // Fallback: usar apenas OpLab
        return buscarOpcoesAPI(ticker);
    }
}
```

---

## 📊 COMPARATIVO: OpLab vs Alternativas

| Característica | OpLab | Alpha Vantage | Twelve Data | B3 Official | yfinance |
|----------------|-------|---------------|-------------|-------------|----------|
| **Ações BR** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Opções BR** | ✅ | ❌ | ❌ | ✅ | ⚠️ Limitado |
| **Gregas** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **IV** | ✅ | ❌ | ❌ | ✅ | ⚠️ Básico |
| **Delay** | 15-20 min | 5 min | 15 min (free) | < 1s | 5-10 min |
| **Custo** | ? | Grátis | Grátis/Pago | R$ 500+/mês | Grátis |
| **Rate Limit** | ? | 500/dia | 800/dia | Ilimitado | Flexível |

**Conclusão**: OpLab é INSUBSTITUÍVEL para dados de opções!

---

## Soluções Disponíveis

### 1️⃣ **TradingView como Fonte Principal** ⭐ RECOMENDADO

**Vantagens:**
- ✅ Dados em tempo real
- ✅ Já está integrado no sistema
- ✅ Confiável e estável
- ✅ Suporte a múltiplos ativos

**Implementação:**
```javascript
// Usar TradingView REST API ou WebSocket
// Exemplo: https://www.tradingview.com/rest-api-spec/

// Alternativa: Capturar do widget (limitado)
tradingViewWidget.onChartReady(() => {
    const chart = tradingViewWidget.activeChart();
    chart.onIntervalChanged().subscribe(null, (interval) => {
        // Capturar dados
    });
});
```

**Custo:** Grátis (widget) ou Planos pagos (API oficial)

---

### 2️⃣ **WebSocket B3 Oficial** 💎 PROFISSIONAL

**Vantagens:**
- ✅ Dados direto da fonte (B3)
- ✅ Latência mínima (< 500ms)
- ✅ 100% confiável
- ✅ Todos os ativos disponíveis

**Desvantagens:**
- ❌ **Pago** - Requer conta profissional
- ❌ Custo mensal alto (R$ 500+/mês)
- ❌ Requer certificação B3

**Documentação:** https://www.b3.com.br/data/files/28/F3/18/B4/D1F6B710D9F7B6B7AC094EA8/Manual-Conectividade.pdf

---

### 3️⃣ **Alpha Vantage API** 🆓 GRATUITO COM LIMITAÇÕES

**Vantagens:**
- ✅ Gratuito até 500 chamadas/dia
- ✅ Delay reduzido (~5 minutos)
- ✅ Fácil integração
- ✅ Suporte a ações brasileiras

**Desvantagens:**
- ⚠️ Delay de ~5 minutos (melhor que 15-20)
- ⚠️ Rate limit: 5 requests/minuto
- ⚠️ Cobertura limitada de opções

**Implementação:**
```python
# Backend (server.py)
import requests

API_KEY = 'SUA_CHAVE_AQUI'
url = f'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=PETR4.SAO&apikey={API_KEY}'
response = requests.get(url)
data = response.json()
price = float(data['Global Quote']['05. price'])
```

**Registro:** https://www.alphavantage.co/support/#api-key

---

### 4️⃣ **Twelve Data API** 💰 FREEMIUM

**Vantagens:**
- ✅ Plano gratuito: 800 chamadas/dia
- ✅ Delay ~15 minutos (grátis) ou real-time (pago)
- ✅ WebSocket disponível
- ✅ Boa cobertura de ativos

**Desvantagens:**
- ⚠️ Plano gratuito com delay
- 💰 Real-time requer plano pago ($79/mês)

**Implementação:**
```python
import requests

API_KEY = 'SUA_CHAVE_AQUI'
url = f'https://api.twelvedata.com/price?symbol=PETR4:BVMF&apikey={API_KEY}'
response = requests.get(url)
data = response.json()
price = float(data['price'])
```

**Registro:** https://twelvedata.com/pricing

---

### 5️⃣ **Yahoo Finance (yfinance)** 🆓 GRATUITO

**Vantagens:**
- ✅ Totalmente gratuito
- ✅ Sem rate limits rígidos
- ✅ Delay ~5-10 minutos
- ✅ Fácil de usar

**Desvantagens:**
- ⚠️ Não é oficial (pode quebrar)
- ⚠️ Não tem SLA/garantias
- ⚠️ Cobertura limitada de opções brasileiras

**Implementação:**
```python
import yfinance as yf

ticker = yf.Ticker('PETR4.SA')
data = ticker.history(period='1d', interval='1m')
current_price = data['Close'].iloc[-1]
```

---

### 6️⃣ **Aceitar o Delay** ⏰ ATUAL (SEM CUSTO)

**Solução:**
1. Adicionar aviso na interface:
   ```html
   <div class="alert alert-warning">
       ⚠️ Cotações com delay de 15-20 minutos (dados gratuitos da B3)
       <br>Gráfico TradingView exibe dados em tempo real
   </div>
   ```

2. Usar TradingView apenas para visualização
3. Cálculos baseados na API (com delay)
4. Transparência com o usuário

**Vantagens:**
- ✅ Grátis
- ✅ Sem mudanças no backend

**Desvantagens:**
- ❌ Experiência inferior
- ❌ Dados desatualizados para decisões

---

## Recomendação Final

### ✅ MELHOR SOLUÇÃO: **Sistema Híbrido OpLab + yfinance**

**Implementação:**
1. **Manter OpLab** para dados de opções (essencial!)
2. **Adicionar yfinance** para ativo base em tempo real (grátis!)
3. **TradingView** para visualização (já implementado)

**Benefícios:**
- ✅ Cotações de opções (único que tem)
- ✅ Ativo base com delay reduzido (15min → 5min)
- ✅ Custo zero
- ✅ Fácil implementação

### Outras Recomendações por Caso:

#### Para Projeto Pessoal/Estudos:
**OpLab (opções) + yfinance (ativo base)** ⭐ IDEAL

#### Para Uso Profissional/Clientes:
**OpLab (opções) + WebSocket B3 (ativo base)** 💎 PREMIUM

#### Se OpLab Tem Plano Pago:
Considerar upgrade da OpLab para dados em tempo real (se disponível)

---

## Implementação Sugerida (Sistema Híbrido)

### 1. Backend (server.py) - IMPLEMENTAÇÃO COMPLETA

```python
import requests
import yfinance as yf
from flask import jsonify, request
from datetime import datetime, timedelta
from functools import lru_cache

# Configurações
OPLAB_API_BASE = 'https://api.oplab.com.br'  # Ajuste conforme sua API
OPLAB_TOKEN = 'SEU_TOKEN_AQUI'

# Cache simples em memória (5 minutos)
quote_cache = {}
CACHE_DURATION = timedelta(minutes=5)

# ============================================
# ENDPOINT 1: Cotação Tempo Real (Ativo Base)
# ============================================
@app.route('/api/cotacao/realtime/<ticker>')
def get_realtime_quote(ticker):
    """
    Obtém cotação em tempo real do ATIVO BASE usando yfinance
    Delay: ~5-10 minutos (melhor que OpLab)
    Uso: Cálculos de gregas, PoP, simulações
    """
    # Verificar cache
    cache_key = f'realtime_{ticker}'
    if cache_key in quote_cache:
        cached_data, cached_time = quote_cache[cache_key]
        if datetime.now() - cached_time < CACHE_DURATION:
            cached_data['from_cache'] = True
            return jsonify(cached_data)
    
    try:
        # yfinance (gratuito, delay ~5-10 min)
        stock = yf.Ticker(f'{ticker}.SA')
        hist = stock.history(period='1d', interval='1m')
        
        if hist.empty:
            return jsonify({'error': 'Sem dados disponíveis'}), 404
            
        current_price = float(hist['Close'].iloc[-1])
        
        # Tentar obter previous close
        try:
            info = stock.info
            prev_close = info.get('previousClose', current_price)
        except:
            prev_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current_price
        
        change = current_price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0
        
        result = {
            'ticker': ticker,
            'price': round(current_price, 2),
            'change': round(change, 2),
            'change_percent': round(change_pct, 2),
            'volume': int(hist['Volume'].iloc[-1]) if 'Volume' in hist else 0,
            'timestamp': hist.index[-1].isoformat(),
            'source': 'yfinance',
            'delay_minutes': '5-10',
            'from_cache': False
        }
        
        # Salvar no cache
        quote_cache[cache_key] = (result, datetime.now())
        
        return jsonify(result)
        
    except Exception as e:
        print(f'Erro yfinance: {e}')
        return jsonify({'error': str(e)}), 500

# ============================================
# ENDPOINT 2: Opções (Manter OpLab) - JÁ EXISTE
# ============================================
# Você já tem este endpoint implementado
# Apenas certifique-se que retorna a estrutura correta

# ============================================
# ENDPOINT 3: Híbrido - Melhor dos Dois Mundos
# ============================================
@app.route('/api/cotacao/hibrido/<ticker>')
def get_hybrid_quote(ticker):
    """
    Combina yfinance (ativo base real-time) + OpLab (opções)
    Retorna dados completos com delay reduzido no spot
    """
    try:
        # 1. Buscar ativo base em tempo real (yfinance)
        realtime_response = get_realtime_quote(ticker)
        realtime_data = realtime_response.get_json()
        
        if realtime_response.status_code != 200:
            # Fallback: usar apenas OpLab
            return get_options_chain(ticker)
        
        spot_price = realtime_data.get('price')
        
        # 2. Buscar opções (OpLab) - usar seu endpoint existente
        options_response = requests.get(
            f'{OPLAB_API_BASE}/opcoes/{ticker}',
            headers={'Authorization': f'Bearer {OPLAB_TOKEN}'},
            timeout=10
        )
        
        if options_response.status_code != 200:
            return jsonify({'error': 'Erro ao buscar opções'}), 500
        
        options_data = options_response.json()
        opcoes = options_data.get('opcoes', [])
        
        # 3. Atualizar preço spot nas opções
        for opcao in opcoes:
            # Atualizar ativo_base com preço real
            opcao['spot_price_realtime'] = spot_price
            opcao['spot_source'] = 'yfinance'
        
        return jsonify({
            'ticker': ticker,
            'spot_price': spot_price,
            'spot_change': realtime_data.get('change'),
            'spot_change_percent': realtime_data.get('change_percent'),
            'spot_source': 'yfinance (5-10 min delay)',
            'spot_timestamp': realtime_data.get('timestamp'),
            'opcoes': opcoes,
            'opcoes_source': 'OpLab (15-20 min delay)',
            'total_opcoes': len(opcoes),
            'hybrid': True,
            'recommendation': 'Use spot_price para cálculos em tempo real'
        })
        
    except Exception as e:
        print(f'Erro híbrido: {e}')
        # Fallback total: apenas OpLab
        try:
            return get_options_chain(ticker)
        except:
            return jsonify({'error': f'Erro: {str(e)}'}), 500

# ============================================
# ENDPOINT 4: Limpar Cache (Útil para testes)
# ============================================
@app.route('/api/cache/clear')
def clear_cache():
    """Limpa cache de cotações"""
    global quote_cache
    quote_cache = {}
    return jsonify({'message': 'Cache limpo com sucesso'})
```

### 2. Frontend (opcoes.js) - ATUALIZAR CHAMADAS

```javascript
/**
 * Busca cotação híbrida (ativo base real + opções OpLab)
 * Use esta função em vez de buscarOpcoesAPI() para ter dados mais atualizados
 */
async function buscarOpcoesSimulacaoHibrida() {
    const ativoBase = document.getElementById('simAtivoBase').value.toUpperCase();
    if (!ativoBase) {
        iziToast.warning({title: 'Atenção', message: 'Digite o código do ativo base'});
        return;
    }

    document.getElementById('simLoading').style.display = 'block';
    const tbody = document.getElementById('simListaOpcoes');
    tbody.innerHTML = '';
    document.getElementById('btnAplicarSimulacao').disabled = true;

    try {
        // Usar endpoint híbrido
        const response = await fetch(`${API_BASE}/api/cotacao/hibrido/${ativoBase}`);
        
        if (!response.ok) {
            throw new Error('Erro ao buscar dados');
        }
        
        const data = await response.json();
        
        // Atualizar cotação ativo base (TEMPO REAL - 5-10 min)
        cotacaoAtivoBase = data.spot_price;
        
        // Mostrar info sobre fontes
        console.log('📊 Dados híbridos carregados:');
        console.log(`   Ativo Base: R$ ${data.spot_price} (${data.spot_source})`);
        console.log(`   Opções: ${data.total_opcoes} opções (${data.opcoes_source})`);
        
        // Opcional: Mostrar badge de tempo real
        const badge = document.createElement('span');
        badge.className = 'badge bg-success ms-2';
        badge.innerHTML = `📡 Spot: ${data.spot_source}`;
        badge.title = `Última atualização: ${data.spot_timestamp}`;
        // Adicionar ao título do modal se desejar
        
        // Processar opções (igual antes)
        simOpcoesDisponiveis = data.opcoes || [];
        
        if (simOpcoesDisponiveis.length === 0) {
            document.getElementById('simLoading').style.display = 'none';
            iziToast.info({
                title: 'Sem Dados',
                message: `Nenhuma opção encontrada para ${ativoBase}`
            });
            return;
        }

        // Normalizar dados
        simOpcoesDisponiveis = simOpcoesDisponiveis.map(op => ({
            ...op,
            ativo: op.ativo || op.symbol || op.ticker || '',
            ativo_base: op.ativo_base || op.underlying || ativoBase,
            tipo: op.tipo || op.type || op.category || '',
            strike: parseFloat(op.strike || op.strike_price || 0),
            vencimento: op.vencimento || op.expiration || op.due_date || '',
            premio: parseFloat(op.premio || op.price || op.close || 0),
            // Usar spot_price_realtime se disponível
            spot_price: op.spot_price_realtime || cotacaoAtivoBase,
            delta: parseFloat(op.delta || 0),
            theta: parseFloat(op.theta || 0),
            gamma: parseFloat(op.gamma || 0),
            vega: parseFloat(op.vega || 0),
            implied_volatility: parseFloat(op.implied_volatility || 0)
        }));

        // Popula vencimentos
        const vencimentos = [...new Set(simOpcoesDisponiveis
            .filter(o => o.vencimento)
            .map(o => o.vencimento))].sort();
            
        const selectVencimento = document.getElementById('simVencimento');
        selectVencimento.innerHTML = '';
        
        const today = new Date().toISOString().split('T')[0];
        let nextVenc = vencimentos.find(v => v >= today) || vencimentos[0];

        if (vencimentos.length > 0) {
            vencimentos.forEach(venc => {
                const opt = document.createElement('option');
                opt.value = venc;
                opt.textContent = new Date(venc).toLocaleDateString('pt-BR');
                if (venc === nextVenc) opt.selected = true;
                selectVencimento.appendChild(opt);
            });
        }
        
        // Renderizar lista
        renderSimOpcoesList();
        
        // Mostrar aviso sobre delay apenas das opções
        iziToast.info({
            title: '📊 Dados Híbridos',
            message: `Ativo Base: Tempo real (5-10 min) | Opções: 15-20 min delay`,
            timeout: 5000
        });

    } catch (e) {
        console.error('Erro ao buscar dados híbridos:', e);
        iziToast.error({
            title: 'Erro',
            message: 'Erro ao buscar cotações. Tentando fallback...'
        });
        
        // Fallback: usar método antigo (apenas OpLab)
        buscarOpcoesSimulacao();
        
    } finally {
        document.getElementById('simLoading').style.display = 'none';
    }
}

// Substituir a chamada antiga
// ANTES: document.getElementById('btnSimBuscar').addEventListener('click', buscarOpcoesSimulacao);
// DEPOIS:
document.getElementById('btnSimBuscar').addEventListener('click', buscarOpcoesSimulacaoHibrida);
```

### 3. Instalar Dependências

```bash
# Backend
cd backend
pip install yfinance

# requirements.txt - adicionar:
yfinance>=0.2.32
```

---

## Próximos Passos

1. ✅ **Decidir qual solução usar** baseado em:
   - Orçamento disponível
   - Nível de precisão necessário
   - Volume de usuários esperado

2. ✅ **Registrar conta** na API escolhida

3. ✅ **Implementar endpoint** no backend

4. ✅ **Atualizar frontend** para usar nova API

5. ✅ **Adicionar cache** para reduzir chamadas (Redis recomendado)

6. ✅ **Monitorar rate limits** e implementar retry logic

---

## Recursos Úteis

- **TradingView API**: https://www.tradingview.com/rest-api-spec/
- **Alpha Vantage**: https://www.alphavantage.co/documentation/
- **Twelve Data**: https://twelvedata.com/docs
- **B3 Market Data**: https://www.b3.com.br/pt_br/market-data-e-indices/
- **yfinance**: https://github.com/ranaroussi/yfinance

---

**Última atualização:** 03/02/2026

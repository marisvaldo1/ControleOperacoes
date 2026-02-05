from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import requests
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import yfinance as yf

# Carregar variáveis de ambiente do arquivo .env na mesma pasta do script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# Configurar Flask para servir arquivos estáticos da pasta frontend
# O caminho '../frontend' é relativo à pasta backend onde este script está
app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Rota principal para servir o index.html
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# Usar caminho absoluto para o banco de dados
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data', 'controle_operacoes.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS operacoes_crypto (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ativo TEXT NOT NULL,
        tipo TEXT NOT NULL,
        cotacao_atual REAL,
        abertura REAL,
        tae REAL,
        strike REAL,
        distancia REAL,
        prazo INTEGER,
        crypto REAL,
        premio_us REAL,
        resultado REAL,
        exercicio TEXT,
        dias INTEGER,
        exercicio_status TEXT,
        data_operacao TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS operacoes_opcoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ativo_base TEXT,
        ativo TEXT NOT NULL,
        tipo TEXT NOT NULL,
        quantidade INTEGER,
        preco_entrada REAL,
        preco_atual REAL,
        strike REAL,
        vencimento TEXT,
        premio REAL,
        resultado REAL,
        status TEXT,
        data_operacao TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS configuracoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chave TEXT UNIQUE NOT NULL,
        valor TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    
    conn.commit()
    conn.close()

init_db()

@app.route('/api/analyze', methods=['POST'])
def analyze_market():
    try:
        data = request.json
        context = data.get('context', '')
        messages = data.get('messages', [])
        force_ai = data.get('force_ai')  # Força uso de uma IA específica (para testes)
        
        # Se não houver messages, usa o context como primeira mensagem (compatibilidade)
        if not messages and context:
            messages = [{"role": "user", "content": context}]
        
        # Buscar IA configurada pelo usuário
        conn = get_db()
        selected_ai_row = conn.execute('SELECT valor FROM configuracoes WHERE chave=?', ('selected_ai',)).fetchone()
        conn.close()
        
        selected_ai = force_ai or (selected_ai_row['valor'] if selected_ai_row else None)
        
        # Check for API Keys
        openai_key = os.environ.get('OPENAI_API_KEY')
        deepseek_key = os.environ.get('DEEPSEEK_API_KEY')
        grok_key = os.environ.get('GROK_API_KEY')
        gemini_key = os.environ.get('GEMINI_API_KEY')
        openrouter_key = os.environ.get('OPENROUTER_API_KEY')
        
        if not any([openai_key, deepseek_key, grok_key, gemini_key, openrouter_key]):
             return jsonify({'error': 'Nenhuma chave de API encontrada no .env'}), 400
             
        response_text = ""
        error_msg = ""
        success = False
        agent_used = None
        model_used = None
        
        # System prompt padrão
        system_prompt = "Você é um especialista em mercado financeiro e opções (Black-Scholes). Analise os dados fornecidos e dê uma recomendação clara. Responda ESTRITAMENTE em Português do Brasil. Se precisar 'pensar' ou fazer raciocínio intermediário, faça-o em Português."

        # Definir ordem de prioridade baseada na seleção do usuário
        priority_order = []
        if selected_ai == 'OPENROUTER' and openrouter_key:
            priority_order = ['OPENROUTER']
        elif selected_ai == 'GROK' and grok_key:
            priority_order = ['GROK']
        elif selected_ai == 'DEEPSEEK' and deepseek_key:
            priority_order = ['DEEPSEEK']
        elif selected_ai == 'OPENAI' and openai_key:
            priority_order = ['OPENAI']
        elif selected_ai == 'GEMINI' and gemini_key:
            priority_order = ['GEMINI']
        else:
            # Fallback: ordem padrão
            priority_order = ['OPENROUTER', 'GROK', 'DEEPSEEK', 'OPENAI', 'GEMINI']
        
        # Adicionar outras IAs como fallback
        fallback_order = ['OPENROUTER', 'GROK', 'DEEPSEEK', 'OPENAI', 'GEMINI']
        for ai in fallback_order:
            if ai not in priority_order:
                priority_order.append(ai)

        # Tentar cada IA na ordem de prioridade
        for ai_name in priority_order:
            if success:
                break
                
            # OPENROUTER
            if ai_name == 'OPENROUTER' and openrouter_key:
                try:
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {openrouter_key}',
                        'HTTP-Referer': 'http://localhost:8888',
                        'X-Title': 'ControleOperacoes'
                    }
                    msgs_payload = [{"role": "system", "content": system_prompt}]
                    msgs_payload.extend(messages)
                    
                    payload = {
                        "model": "openai/gpt-3.5-turbo",  # Modelo padrão
                        "messages": msgs_payload,
                        "temperature": 0.7
                    }
                    
                    r = requests.post('https://openrouter.ai/api/v1/chat/completions', headers=headers, json=payload, timeout=30)
                    if r.status_code == 200:
                        response_text = r.json()['choices'][0]['message']['content']
                        success = True
                        agent_used = 'OPENAI'
                        model_used = payload.get('model')
                        agent_used = 'DEEPSEEK'
                        model_used = payload.get('model')
                        agent_used = 'GROK'
                        model_used = payload.get('model')
                        agent_used = 'OPENROUTER'
                        model_used = payload.get('model')
                    else:
                        error_msg += f"OpenRouter Error ({r.status_code}): {r.text[:100]} | "
                except Exception as e:
                    error_msg += f"OpenRouter Exception: {str(e)} | "

            # GROK
            elif ai_name == 'GROK' and grok_key:
                try:
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {grok_key}'
                    }
                    msgs_payload = [{"role": "system", "content": system_prompt}]
                    msgs_payload.extend(messages)

                    payload = {
                        "model": "grok-2-latest", 
                        "messages": msgs_payload,
                        "temperature": 0.7
                    }
                    
                    r = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=payload, timeout=30)
                    if r.status_code == 200:
                        response_text = r.json()['choices'][0]['message']['content']
                        success = True
                    else:
                        error_msg += f"Grok Error ({r.status_code}): {r.text[:100]} | "
                except Exception as e:
                    error_msg += f"Grok Exception: {str(e)} | "

            # DEEPSEEK
            elif ai_name == 'DEEPSEEK' and deepseek_key:
                try:
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {deepseek_key}'
                    }
                    msgs_payload = [{"role": "system", "content": system_prompt}]
                    msgs_payload.extend(messages)
                    
                    payload = {
                        "model": "deepseek-chat", 
                        "messages": msgs_payload,
                        "temperature": 0.7
                    }
                    
                    r = requests.post('https://api.deepseek.com/chat/completions', headers=headers, json=payload, timeout=30)
                    if r.status_code == 200:
                        response_text = r.json()['choices'][0]['message']['content']
                        success = True
                    else:
                        error_msg += f"DeepSeek Error ({r.status_code}): {r.text[:100]} | "
                except Exception as e:
                    error_msg += f"DeepSeek Exception: {str(e)} | "

            # OPENAI
            elif ai_name == 'OPENAI' and openai_key:
                try:
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {openai_key}'
                    }
                    msgs_payload = [{"role": "system", "content": system_prompt}]
                    msgs_payload.extend(messages)

                    payload = {
                        "model": "gpt-3.5-turbo", 
                        "messages": msgs_payload,
                        "temperature": 0.7
                    }
                    
                    r = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=payload, timeout=30)
                    if r.status_code == 200:
                        response_text = r.json()['choices'][0]['message']['content']
                        success = True
                    else:
                        error_msg += f"OpenAI Error ({r.status_code}): {r.text[:100]} | "
                except Exception as e:
                    error_msg += f"OpenAI Exception: {str(e)} | "

            # GEMINI
            elif ai_name == 'GEMINI' and gemini_key:
                gemini_models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash"]
                
                gemini_contents = []
                for i, msg in enumerate(messages):
                    role = "user" if msg['role'] == "user" else "model"
                    text = msg['content']
                    if i == 0 and msg['role'] == "user":
                        text = f"{system_prompt}\n\n{text}"
                    
                    gemini_contents.append({
                        "role": role,
                        "parts": [{"text": text}]
                    })

                for model_name in gemini_models:
                    if success:
                        break
                    try:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                        headers = {'Content-Type': 'application/json'}
                        payload = {"contents": gemini_contents}
                        
                        r = requests.post(url, headers=headers, json=payload, timeout=30)
                        if r.status_code == 200:
                            try:
                                candidate = r.json()['candidates'][0]
                                if 'content' in candidate and 'parts' in candidate['content']:
                                    response_text = candidate['content']['parts'][0]['text']
                                    success = True
                                    agent_used = 'GEMINI'
                                    model_used = model_name
                                else:
                                    error_msg += f"Gemini ({model_name}) Empty Response | "
                            except Exception as e:
                                error_msg += f"Gemini ({model_name}) Parse Error: {str(e)} | "
                        else:
                            error_msg += f"Gemini ({model_name}) Error ({r.status_code}) | "
                    except Exception as e:
                        error_msg += f"Gemini ({model_name}) Exception: {str(e)} | "

        if not success:
            # Se falhou tudo, retornar erro detalhado
            final_error = "Não foi possível obter análise."
            if error_msg:
                final_error += f" Detalhes: {error_msg}"
            
            # Sugestão amigável
            if "insufficient_quota" in final_error or "quota" in final_error:
                final_error += "\n\nDICA: Problema de cota detectado. Verifique seus créditos ou use a DeepSeek/Gemini API (gratuitas/baratas)."
            
            return jsonify({'error': final_error}), 400

        return jsonify({'analysis': response_text, 'agent': agent_used, 'model': model_used})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Proxy APIs
@app.route('/api/proxy/stocks/<ticker>')
def proxy_stocks(ticker):
    api_key = os.environ.get('OPLAB_API_KEY', '')
    headers = {'Access-Token': api_key}
    try:
        r = requests.get(f'https://api.oplab.com.br/v3/market/stocks/{ticker}', headers=headers, timeout=10)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/proxy/options/<ticker>')
def proxy_options(ticker):
    """
    Busca todas as opções de um ativo base.
    Tenta múltiplos endpoints para garantir que todas as opções sejam retornadas.
    """
    api_key = os.environ.get('OPLAB_API_KEY', '')
    headers = {'Access-Token': api_key}
    
    # Dicionário para armazenar opções únicas e mesclar dados (chave: simbolo)
    options_map = {}
    
    try:
        # Endpoint 1: options (lista de opções)
        try:
            r1 = requests.get(f'https://api.oplab.com.br/v3/market/options/{ticker}', headers=headers, timeout=15)
            if r1.status_code == 200:
                data1 = r1.json()
                items = []
                if isinstance(data1, list):
                    items = data1
                elif isinstance(data1, dict):
                    if 'options' in data1: items = data1['options']
                    elif 'data' in data1: items = data1['data']
                    elif 'calls' in data1 or 'puts' in data1:
                        items.extend(data1.get('calls', []))
                        items.extend(data1.get('puts', []))
                
                for item in items:
                    symbol = item.get('symbol', item.get('ticker', ''))
                    if symbol:
                        options_map[symbol] = item
        except Exception as e:
            print(f"Erro endpoint 1: {e}")
        
        # Endpoint 2: options/details (detalhes das opções - prioridade para dados como volatilidade)
        try:
            r2 = requests.get(f'https://api.oplab.com.br/v3/market/options/details/{ticker}', headers=headers, timeout=15)
            if r2.status_code == 200:
                data2 = r2.json()
                items = []
                if isinstance(data2, list):
                    items = data2
                elif isinstance(data2, dict):
                    if 'symbol' in data2 or 'parent_symbol' in data2 or 'due_date' in data2:
                        items.append(data2)
                    else:
                        for key, value in data2.items():
                            if isinstance(value, list): items.extend(value)
                
                for item in items:
                    symbol = item.get('symbol', item.get('ticker', ''))
                    if symbol:
                        if symbol in options_map:
                            # Mesclar dados, priorizando os novos (detalhes)
                            options_map[symbol].update(item)
                        else:
                            options_map[symbol] = item
        except Exception as e:
            print(f"Erro endpoint 2: {e}")
        
        # Endpoint 3: Tentar buscar por série (se disponível)
        try:
            r3 = requests.get(f'https://api.oplab.com.br/v3/market/options/{ticker}/series', headers=headers, timeout=15)
            if r3.status_code == 200:
                data3 = r3.json()
                if isinstance(data3, list):
                    for item in data3:
                        symbol = item.get('symbol', item.get('ticker', ''))
                        if symbol:
                            if symbol in options_map:
                                options_map[symbol].update(item)
                            else:
                                options_map[symbol] = item
        except Exception as e:
            print(f"Erro endpoint 3: {e}")
        
        all_options = list(options_map.values())
        
        # Buscar cotação do ativo base para referência (ATM)
        spot_price = 0.0
        try:
            r_spot = requests.get(f'https://api.oplab.com.br/v3/market/stocks/{ticker}', headers=headers, timeout=5)
            if r_spot.status_code == 200:
                d_spot = r_spot.json()
                spot_price = float(d_spot.get('close') or d_spot.get('price') or d_spot.get('last') or 0.0)
        except Exception as e:
            print(f"Erro ao buscar spot price: {e}")

        if all_options:
            return jsonify({'options': all_options, 'spot_price': spot_price}), 200
        else:
            return jsonify({'error': 'Nenhuma opção encontrada', 'options': [], 'spot_price': spot_price}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# SISTEMA HÍBRIDO: TEMPO REAL + OPLAB
# ==========================================

# Cache simples em memória (5 minutos)
quote_cache = {}
CACHE_DURATION = timedelta(minutes=5)

@app.route('/api/cotacao/realtime/<ticker>')
def get_realtime_quote(ticker):
    """
    Obtém cotação em tempo real do ATIVO BASE usando yfinance
    Delay: ~5-10 minutos (melhor que OpLab's 15-20 min)
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

@app.route('/api/cotacao/hibrido/<ticker>')
def get_hybrid_quote(ticker):
    """
    SISTEMA HÍBRIDO: Combina yfinance (ativo base real-time) + OpLab (opções)
    Retorna dados completos com delay reduzido no spot
    """
    try:
        # 1. Buscar ativo base em tempo real (yfinance)
        realtime_response = get_realtime_quote(ticker)
        realtime_data = realtime_response.get_json()
        
        if realtime_response.status_code != 200:
            # Fallback: usar apenas OpLab
            print(f'Fallback para OpLab - erro yfinance: {realtime_data}')
            return proxy_options(ticker)
        
        spot_price = realtime_data.get('price')
        
        # 2. Buscar opções (OpLab) - usar função existente
        options_response = proxy_options(ticker)
        options_data = options_response.get_json()
        
        if options_response.status_code != 200:
            return jsonify({'error': 'Erro ao buscar opções'}), 500
        
        opcoes = options_data.get('options', [])
        
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
            'spot_from_cache': realtime_data.get('from_cache', False),
            'options': opcoes,
            'opcoes': opcoes,  # Alias para compatibilidade
            'opcoes_source': 'OpLab (15-20 min delay)',
            'total_opcoes': len(opcoes),
            'hybrid': True,
            'recommendation': 'Use spot_price para cálculos em tempo real'
        })
        
    except Exception as e:
        print(f'Erro híbrido: {e}')
        # Fallback total: apenas OpLab
        try:
            return proxy_options(ticker)
        except:
            return jsonify({'error': f'Erro: {str(e)}'}), 500

@app.route('/api/cache/clear')
def clear_cache():
    """Limpa cache de cotações (útil para testes)"""
    global quote_cache
    count = len(quote_cache)
    quote_cache = {}
    return jsonify({
        'message': 'Cache limpo com sucesso',
        'items_cleared': count
    })

# ==========================================
# FIM SISTEMA HÍBRIDO
# ==========================================

@app.route('/api/proxy/crypto/<ticker>')
def proxy_crypto(ticker):
    try:
        r = requests.get(f'https://api.binance.com/api/v3/ticker/price?symbol={ticker}', timeout=10)
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cotacao/opcoes')
def get_cotacao_opcao():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Symbol required'}), 400
        
    api_key = os.environ.get('OPLAB_API_KEY', '')
    headers = {'Access-Token': api_key}
    
    try:
        # Tentar buscar como stock (muitas vezes funciona para opções individuais)
        r = requests.get(f'https://api.oplab.com.br/v3/market/stocks/{symbol}', headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            return jsonify(data)
            
        # Se falhar, tentar buscar detalhes de opções
        r2 = requests.get(f'https://api.oplab.com.br/v3/market/options/details/{symbol}', headers=headers, timeout=10)
        if r2.status_code == 200:
            data2 = r2.json()
            # Oplab pode retornar lista ou dict
            if isinstance(data2, list) and len(data2) > 0:
                return jsonify(data2[0])
            return jsonify(data2)
            
        return jsonify({'error': 'Opção não encontrada'}), 404
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# CRUD Operacoes Crypto
@app.route('/api/crypto', methods=['GET'])
def get_crypto():
    conn = get_db()
    ops = conn.execute('SELECT * FROM operacoes_crypto ORDER BY data_operacao DESC').fetchall()
    conn.close()
    return jsonify([dict(o) for o in ops])

@app.route('/api/crypto/<int:id>', methods=['GET'])
def get_crypto_item(id):
    conn = get_db()
    op = conn.execute('SELECT * FROM operacoes_crypto WHERE id=?', (id,)).fetchone()
    conn.close()
    if op:
        return jsonify(dict(op))
    return jsonify({'error': 'Operação não encontrada'}), 404

@app.route('/api/crypto', methods=['POST'])
def create_crypto():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('''INSERT INTO operacoes_crypto 
        (ativo, tipo, cotacao_atual, abertura, tae, strike, distancia, prazo, crypto, premio_us, resultado, exercicio, dias, exercicio_status, data_operacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (data.get('ativo'), data.get('tipo'), data.get('cotacao_atual'), data.get('abertura'),
         data.get('tae'), data.get('strike'), data.get('distancia'), data.get('prazo'),
         data.get('crypto'), data.get('premio_us'), data.get('resultado'), data.get('exercicio'),
         data.get('dias'), data.get('exercicio_status'), data.get('data_operacao', datetime.now().strftime('%Y-%m-%d'))))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': c.lastrowid})

@app.route('/api/crypto/<int:id>', methods=['PUT'])
def update_crypto(id):
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('''UPDATE operacoes_crypto SET
        ativo=?, tipo=?, cotacao_atual=?, abertura=?, tae=?, strike=?, distancia=?, prazo=?,
        crypto=?, premio_us=?, resultado=?, exercicio=?, dias=?, exercicio_status=?, data_operacao=?
        WHERE id=?''',
        (data.get('ativo'), data.get('tipo'), data.get('cotacao_atual'), data.get('abertura'),
         data.get('tae'), data.get('strike'), data.get('distancia'), data.get('prazo'),
         data.get('crypto'), data.get('premio_us'), data.get('resultado'), data.get('exercicio'),
         data.get('dias'), data.get('exercicio_status'), data.get('data_operacao'), id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/crypto/<int:id>', methods=['DELETE'])
def delete_crypto(id):
    conn = get_db()
    conn.execute('DELETE FROM operacoes_crypto WHERE id=?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# CRUD Operacoes Opcoes
@app.route('/api/opcoes', methods=['GET'])
def get_opcoes():
    conn = get_db()
    ops = conn.execute('SELECT * FROM operacoes_opcoes ORDER BY data_operacao DESC').fetchall()
    conn.close()
    return jsonify([dict(o) for o in ops])

@app.route('/api/opcoes/<int:id>', methods=['GET'])
def get_opcao(id):
    conn = get_db()
    op = conn.execute('SELECT * FROM operacoes_opcoes WHERE id=?', (id,)).fetchone()
    conn.close()
    if op:
        return jsonify(dict(op))
    return jsonify({'error': 'Operação não encontrada'}), 404

@app.route('/api/opcoes', methods=['POST'])
def create_opcoes():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('''INSERT INTO operacoes_opcoes 
        (ativo_base, ativo, tipo, quantidade, preco_entrada, preco_atual, strike, vencimento, premio, resultado, status, data_operacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (data.get('ativo_base'), data.get('ativo'), data.get('tipo'), data.get('quantidade'), data.get('preco_entrada'),
         data.get('preco_atual'), data.get('strike'), data.get('vencimento'), data.get('premio'),
         data.get('resultado'), data.get('status'), data.get('data_operacao', datetime.now().strftime('%Y-%m-%d'))))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': c.lastrowid})

@app.route('/api/opcoes/<int:id>', methods=['PUT'])
def update_opcoes(id):
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('''UPDATE operacoes_opcoes SET
        ativo_base=?, ativo=?, tipo=?, quantidade=?, preco_entrada=?, preco_atual=?, strike=?, vencimento=?,
        premio=?, resultado=?, status=?, data_operacao=?
        WHERE id=?''',
        (data.get('ativo_base'), data.get('ativo'), data.get('tipo'), data.get('quantidade'), data.get('preco_entrada'),
         data.get('preco_atual'), data.get('strike'), data.get('vencimento'), data.get('premio'),
         data.get('resultado'), data.get('status'), data.get('data_operacao'), id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/opcoes/<int:id>', methods=['DELETE'])
def delete_opcoes(id):
    conn = get_db()
    conn.execute('DELETE FROM operacoes_opcoes WHERE id=?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# Configuracoes
@app.route('/api/config', methods=['GET'])
def get_config():
    conn = get_db()
    configs = conn.execute('SELECT chave, valor FROM configuracoes').fetchall()
    conn.close()
    return jsonify({c['chave']: c['valor'] for c in configs})

@app.route('/api/config', methods=['POST'])
def save_config():
    data = request.json
    conn = get_db()
    for k, v in data.items():
        conn.execute('''INSERT INTO configuracoes (chave, valor, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(chave) DO UPDATE SET valor=?, updated_at=?''',
            (k, v, datetime.now().isoformat(), v, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# APIs disponíveis e configuração de IA
@app.route('/api/available-ais', methods=['GET'])
def get_available_ais():
    """Retorna lista de IAs disponíveis baseado nas chaves configuradas no .env"""
    available = []
    ai_mapping = {
        'OPENAI': ('OPENAI_API_KEY', 'OpenAI (GPT-3.5/GPT-4)'),
        'DEEPSEEK': ('DEEPSEEK_API_KEY', 'DeepSeek'),
        'GROK': ('GROK_API_KEY', 'Grok (xAI)'),
        'GEMINI': ('GEMINI_API_KEY', 'Gemini (Google)'),
        'OPENROUTER': ('OPENROUTER_API_KEY', 'OpenRouter (Múltiplos modelos)')
    }
    
    for key, (env_var, name) in ai_mapping.items():
        if os.environ.get(env_var):
            available.append({'key': key, 'name': name})
    
    # Buscar IA atual configurada
    conn = get_db()
    current = conn.execute('SELECT valor FROM configuracoes WHERE chave=?', ('selected_ai',)).fetchone()
    conn.close()
    
    current_ai = current['valor'] if current else (available[0]['key'] if available else None)
    
    return jsonify({'available': available, 'current': current_ai})

@app.route('/api/config-ia', methods=['POST'])
def save_ia_config():
    """Salva a IA selecionada pelo usuário"""
    data = request.json
    selected_ai = data.get('selected_ai')
    
    if not selected_ai:
        return jsonify({'error': 'selected_ai é obrigatório'}), 400
    
    conn = get_db()
    conn.execute('''INSERT INTO configuracoes (chave, valor, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(chave) DO UPDATE SET valor=?, updated_at=?''',
        ('selected_ai', selected_ai, datetime.now().isoformat(), selected_ai, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'selected_ai': selected_ai})

@app.route('/api/opcoes/refresh', methods=['POST'])
def refresh_opcoes_quotes():
    conn = get_db()
    c = conn.cursor()
    
    # Buscar operações abertas
    ops = c.execute("SELECT id, ativo FROM operacoes_opcoes WHERE status = 'ABERTA'").fetchall()
    
    api_key = os.environ.get('OPLAB_API_KEY', '')
    headers = {'Access-Token': api_key}
    
    updated_count = 0
    
    for op in ops:
        ticker = op['ativo']
        price = None
        
        try:
            # Tentar buscar cotação
            # 1. Tentar como stock/option direta
            r = requests.get(f'https://api.oplab.com.br/v3/market/stocks/{ticker}', headers=headers, timeout=5)
            if r.status_code == 200:
                data = r.json()
                price = data.get('close') or data.get('price') or data.get('last')
            
            # 2. Se falhar, tentar detalhes de opção
            if price is None:
                r2 = requests.get(f'https://api.oplab.com.br/v3/market/options/details/{ticker}', headers=headers, timeout=5)
                if r2.status_code == 200:
                    data2 = r2.json()
                    if isinstance(data2, list) and len(data2) > 0:
                        price = data2[0].get('price') or data2[0].get('close')
                    elif isinstance(data2, dict):
                        price = data2.get('price') or data2.get('close')
            
            if price is not None:
                c.execute("UPDATE operacoes_opcoes SET preco_atual=? WHERE id=?", (price, op['id']))
                updated_count += 1
                
        except Exception as e:
            print(f"Erro ao atualizar {ticker}: {e}")
            
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'updated': updated_count})

if __name__ == '__main__':
    app.run(debug=True, port=8888)

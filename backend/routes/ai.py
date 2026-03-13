"""
routes/ai.py — Análise de Mercado com IA
Escopo: COMPARTILHADO (opcoes + crypto)

Rotas registradas:
  POST /api/analyze — análise com IA selecionada (multi-provider com fallback)

Providers suportados (em ordem de prioridade configurável):
  OPENROUTER → GROK → DEEPSEEK → OPENAI → GEMINI
"""
from flask              import Blueprint, request, jsonify
from requests.exceptions import SSLError
import requests
import os
import db

ai_bp = Blueprint('ai', __name__)

# System prompt padrão (português)
_SYSTEM_PROMPT = (
    "Você é um especialista em mercado financeiro e opções (Black-Scholes). "
    "Analise os dados fornecidos e dê uma recomendação clara. "
    "Responda ESTRITAMENTE em Português do Brasil. "
    "Se precisar 'pensar' ou fazer raciocínio intermediário, faça-o em Português."
)


# ─── Análise com IA ───────────────────────────────────────────────────────────
@ai_bp.route('/analyze', methods=['POST'])
def analyze_market():
    try:
        data      = request.json
        context   = data.get('context', '')
        messages  = data.get('messages', [])
        force_ai  = data.get('force_ai')

        # Compatibilidade retroativa com campo 'context'
        if not messages and context:
            messages = [{'role': 'user', 'content': context}]

        # Buscar IA configurada
        conn = db.get_db()
        row  = conn.execute(
            'SELECT valor FROM configuracoes WHERE chave=?', ('selected_ai',)
        ).fetchone()
        conn.close()
        selected_ai = force_ai or (row['valor'] if row else None)

        # Chaves de API
        openai_key     = os.environ.get('OPENAI_API_KEY')
        deepseek_key   = os.environ.get('DEEPSEEK_API_KEY')
        grok_key       = os.environ.get('GROK_API_KEY')
        gemini_key     = os.environ.get('GEMINI_API_KEY')
        openrouter_key = os.environ.get('OPENROUTER_API_KEY')

        if not any([openai_key, deepseek_key, grok_key, gemini_key, openrouter_key]):
            return jsonify({'error': 'Nenhuma chave de API encontrada no .env'}), 400

        response_text = ''
        error_msg     = ''
        success       = False
        agent_used    = None
        model_used    = None

        # Definir ordem de prioridade
        _prio_map = {
            'OPENROUTER': openrouter_key,
            'GROK':       grok_key,
            'DEEPSEEK':   deepseek_key,
            'OPENAI':     openai_key,
            'GEMINI':     gemini_key,
        }
        priority_order = []
        if selected_ai and _prio_map.get(selected_ai):
            priority_order.append(selected_ai)
        for ai in ['OPENROUTER', 'GROK', 'DEEPSEEK', 'OPENAI', 'GEMINI']:
            if ai not in priority_order:
                priority_order.append(ai)

        def _msgs(extra=None):
            base = [{'role': 'system', 'content': _SYSTEM_PROMPT}]
            base.extend(messages)
            return base

        for ai_name in priority_order:
            if success:
                break

            # ── OPENROUTER ────────────────────────────────────────────────────
            if ai_name == 'OPENROUTER' and openrouter_key:
                try:
                    r = requests.post(
                        'https://openrouter.ai/api/v1/chat/completions',
                        headers={
                            'Content-Type':  'application/json',
                            'Authorization': f'Bearer {openrouter_key}',
                            'HTTP-Referer':  'http://localhost:8888',
                            'X-Title':       'ControleOperacoes',
                        },
                        json={'model': 'openai/gpt-3.5-turbo', 'messages': _msgs(), 'temperature': 0.7},
                        timeout=30,
                    )
                    if r.status_code == 200:
                        response_text = r.json()['choices'][0]['message']['content']
                        success    = True
                        agent_used = 'OPENROUTER'
                        model_used = 'openai/gpt-3.5-turbo'
                    else:
                        error_msg += f'OpenRouter ({r.status_code}): {r.text[:100]} | '
                except Exception as e:
                    error_msg += f'OpenRouter err: {e} | '

            # ── GROK ──────────────────────────────────────────────────────────
            elif ai_name == 'GROK' and grok_key:
                try:
                    r = requests.post(
                        'https://api.x.ai/v1/chat/completions',
                        headers={'Content-Type': 'application/json',
                                 'Authorization': f'Bearer {grok_key}'},
                        json={'model': 'grok-2-latest', 'messages': _msgs(), 'temperature': 0.7},
                        timeout=30,
                    )
                    if r.status_code == 200:
                        response_text = r.json()['choices'][0]['message']['content']
                        success    = True
                        agent_used = 'GROK'
                        model_used = 'grok-2-latest'
                    else:
                        error_msg += f'Grok ({r.status_code}): {r.text[:100]} | '
                except Exception as e:
                    error_msg += f'Grok err: {e} | '

            # ── DEEPSEEK ──────────────────────────────────────────────────────
            elif ai_name == 'DEEPSEEK' and deepseek_key:
                try:
                    r = requests.post(
                        'https://api.deepseek.com/chat/completions',
                        headers={'Content-Type': 'application/json',
                                 'Authorization': f'Bearer {deepseek_key}'},
                        json={'model': 'deepseek-chat', 'messages': _msgs(), 'temperature': 0.7},
                        timeout=30,
                    )
                    if r.status_code == 200:
                        response_text = r.json()['choices'][0]['message']['content']
                        success    = True
                        agent_used = 'DEEPSEEK'
                        model_used = 'deepseek-chat'
                    else:
                        error_msg += f'DeepSeek ({r.status_code}): {r.text[:100]} | '
                except Exception as e:
                    error_msg += f'DeepSeek err: {e} | '

            # ── OPENAI ────────────────────────────────────────────────────────
            elif ai_name == 'OPENAI' and openai_key:
                try:
                    r = requests.post(
                        'https://api.openai.com/v1/chat/completions',
                        headers={'Content-Type': 'application/json',
                                 'Authorization': f'Bearer {openai_key}'},
                        json={'model': 'gpt-3.5-turbo', 'messages': _msgs(), 'temperature': 0.7},
                        timeout=30,
                    )
                    if r.status_code == 200:
                        response_text = r.json()['choices'][0]['message']['content']
                        success    = True
                        agent_used = 'OPENAI'
                        model_used = 'gpt-3.5-turbo'
                    else:
                        error_msg += f'OpenAI ({r.status_code}): {r.text[:100]} | '
                except Exception as e:
                    error_msg += f'OpenAI err: {e} | '

            # ── GEMINI ────────────────────────────────────────────────────────
            elif ai_name == 'GEMINI' and gemini_key:
                gemini_models = [
                    'gemini-2.5-flash', 'gemini-flash-latest',
                    'gemini-2.0-flash', 'gemini-1.5-flash',
                ]
                gemini_contents = []
                for i, msg in enumerate(messages):
                    text = msg['content']
                    if i == 0 and msg['role'] == 'user':
                        text = f'{_SYSTEM_PROMPT}\n\n{text}'
                    gemini_contents.append({
                        'role':  'user' if msg['role'] == 'user' else 'model',
                        'parts': [{'text': text}],
                    })
                for model_name in gemini_models:
                    if success:
                        break
                    try:
                        url = (f'https://generativelanguage.googleapis.com/v1beta/models/'
                               f'{model_name}:generateContent?key={gemini_key}')
                        r = requests.post(url,
                                          headers={'Content-Type': 'application/json'},
                                          json={'contents': gemini_contents},
                                          timeout=30)
                        if r.status_code == 200:
                            candidate = r.json()['candidates'][0]
                            if 'content' in candidate and 'parts' in candidate['content']:
                                response_text = candidate['content']['parts'][0]['text']
                                success    = True
                                agent_used = 'GEMINI'
                                model_used = model_name
                            else:
                                error_msg += f'Gemini ({model_name}) resposta vazia | '
                        else:
                            error_msg += f'Gemini ({model_name}): {r.status_code} | '
                    except Exception as e:
                        error_msg += f'Gemini ({model_name}) err: {e} | '

        if not success:
            msg = 'Não foi possível obter análise.'
            if error_msg:
                msg += f' Detalhes: {error_msg}'
            if 'quota' in msg.lower() or 'insufficient_quota' in msg:
                msg += ('\n\nDICA: Verifique seus créditos ou use DeepSeek/Gemini '
                        '(gratuitas/baratas).')
            return jsonify({'error': msg}), 400

        return jsonify({'analysis': response_text, 'agent': agent_used, 'model': model_used})

    except SSLError as e:
        return jsonify({
            'error':   'Falha na verificação SSL.',
            'details': str(e),
            'hint':    'Instale certificados raiz ou defina OPLAB_SSL_VERIFY=false.',
        }), 502
    except Exception as e:
        return jsonify({'error': str(e)}), 500

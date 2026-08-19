"""
routes/config.py — Configurações do Sistema e seleção de IA
Escopo: COMPARTILHADO (opcoes + crypto)

Rotas registradas:
  GET  /api/config             — ler configurações
  POST /api/config             — salvar configurações
  GET  /api/available-ais      — listar IAs disponíveis (com chave no .env)
  POST /api/config-ia          — salvar IA selecionada
"""
from flask    import Blueprint, request, jsonify
from datetime import datetime
import os
import db

config_bp = Blueprint('config', __name__)


# ─── Ler configurações ────────────────────────────────────────────────────────
@config_bp.route('/config', methods=['GET'])
def get_config():
    conn    = db.get_db()
    configs = conn.execute('SELECT chave, valor FROM configuracoes').fetchall()
    conn.close()
    return jsonify({c['chave']: c['valor'] for c in configs})


# ─── Salvar configurações ─────────────────────────────────────────────────────
@config_bp.route('/config', methods=['POST'])
def save_config():
    data = request.json
    conn = db.get_db()
    for k, v in data.items():
        conn.execute('''INSERT INTO configuracoes (chave, valor, updated_at) VALUES (?,?,?)
            ON CONFLICT(chave) DO UPDATE SET valor=?, updated_at=?''',
            (k, v, datetime.now().isoformat(), v, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ─── IAs disponíveis ──────────────────────────────────────────────────────────
def _ai_keys_in_db():
    """Lê chaves de IA armazenadas na tabela configuracoes."""
    keys = {}
    try:
        conn = db.get_db()
        rows = conn.execute(
            "SELECT chave, valor FROM configuracoes WHERE chave IN "
            "('openai_key','deepseek_key','grok_key','gemini_key','openrouter_key')"
        ).fetchall()
        conn.close()
        for r in rows:
            keys[r['chave']] = r['valor']
    except Exception:
        pass
    return keys


@config_bp.route('/available-ais', methods=['GET'])
def get_available_ais():
    """Retorna lista de IAs com chave configurada no .env OU no banco."""
    ai_mapping = {
        'OPENAI':      ('OPENAI_API_KEY',      'openai_key',      'OpenAI (GPT-3.5/GPT-4)'),
        'DEEPSEEK':    ('DEEPSEEK_API_KEY',     'deepseek_key',    'DeepSeek'),
        'GROK':        ('GROK_API_KEY',         'grok_key',        'Grok (xAI)'),
        'GEMINI':      ('GEMINI_API_KEY',       'gemini_key',      'Gemini (Google)'),
        'OPENROUTER':  ('OPENROUTER_API_KEY',   'openrouter_key',  'OpenRouter (Múltiplos modelos)'),
    }
    db_keys = _ai_keys_in_db()
    available = []
    for key, (env_var, db_key, name) in ai_mapping.items():
        if os.environ.get(env_var) or db_keys.get(db_key):
            available.append({'key': key, 'name': name})
    conn = db.get_db()
    current_row = conn.execute(
        'SELECT valor FROM configuracoes WHERE chave=?', ('selected_ai',)
    ).fetchone()
    conn.close()
    current_ai = current_row['valor'] if current_row else (available[0]['key'] if available else None)
    return jsonify({'available': available, 'current': current_ai})


# ─── Salvar IA selecionada ────────────────────────────────────────────────────
@config_bp.route('/config-ia', methods=['POST'])
def save_ia_config():
    data        = request.json
    selected_ai = data.get('selected_ai')
    if not selected_ai:
        return jsonify({'error': 'selected_ai é obrigatório'}), 400
    conn = db.get_db()
    conn.execute('''INSERT INTO configuracoes (chave, valor, updated_at) VALUES (?,?,?)
        ON CONFLICT(chave) DO UPDATE SET valor=?, updated_at=?''',
        ('selected_ai', selected_ai, datetime.now().isoformat(),
         selected_ai, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'selected_ai': selected_ai})

"""
server.py — Entry Point do Sistema de Controle de Operações
Versão: 2.0.0

Responsabilidades únicas deste arquivo:
  - Criar a aplicação Flask
  - Registrar Blueprints
  - Inicializar banco de dados
  - Servir arquivos estáticos do frontend

Rotas de cada módulo:
  /api/crypto     → routes/crypto.py     (crypto_bp)
  /api/opcoes     → routes/opcoes.py     (opcoes_bp)
  /api/*config*   → routes/config.py     (config_bp)
  /api/analyze    → routes/ai.py         (ai_bp)
  /api/proxy/*    → routes/market.py     (market_bp)
  /api/cotacao/*  → routes/market.py     (market_bp)
  /api/cache/*    → routes/market.py     (market_bp)
  /api/market/*   → routes/market.py     (market_bp)
"""
from flask      import Flask, send_from_directory
from flask_cors import CORS
import os
from dotenv import load_dotenv

# ─── Configuração de ambiente ─────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# ─── Aplicação Flask ──────────────────────────────────────────────────────────
app = Flask(
    __name__,
    static_folder='../frontend',
    static_url_path='',
)
CORS(app)

VERSION = '2.0.0'

# ─── Blueprints ───────────────────────────────────────────────────────────────
from routes.crypto  import crypto_bp
from routes.opcoes  import opcoes_bp
from routes.config  import config_bp
from routes.ai      import ai_bp
from routes.market  import market_bp

app.register_blueprint(crypto_bp,  url_prefix='/api/crypto')
app.register_blueprint(opcoes_bp,  url_prefix='/api/opcoes')
app.register_blueprint(config_bp,  url_prefix='/api')
app.register_blueprint(ai_bp,      url_prefix='/api')
app.register_blueprint(market_bp,  url_prefix='/api')

# ─── Rotas utilitárias ────────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/api/version')
def get_version():
    from flask import jsonify
    return jsonify({'version': VERSION})


# ─── Inicialização do banco ───────────────────────────────────────────────────
from db import init_db
init_db()

# ─── Start ────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, port=8888)

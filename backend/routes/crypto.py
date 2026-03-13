"""
routes/crypto.py — API de Operações Crypto
Escopo: módulo crypto EXCLUSIVAMENTE

Estratégias suportadas (tipo_estrategia):
  - DUAL_INVESTMENT  : Dual Investment da Binance (HIGH/LOW)
  - OPCAO_CRYPTO     : Opções sobre BTC/ETH/etc
  - SPOT             : Compra e venda à vista
  - HOLD             : Posição de longo prazo (buy-and-hold)
  - FUTURES          : Contratos futuros
  - STAKING          : Rendimento de staking/yield
  - OUTRO            : Outras estratégias

Rotas registradas:
  GET    /api/crypto              — listar todas
  GET    /api/crypto/<id>         — buscar por ID
  POST   /api/crypto              — criar
  PUT    /api/crypto/<id>         — atualizar
  DELETE /api/crypto/<id>         — excluir
  GET    /api/crypto/estrategias  — listar tipos de estratégia disponíveis
"""
from flask        import Blueprint, request, jsonify
from datetime     import datetime
import db
import requests
import urllib3

# Suprime warnings de SSL em ambiente local (Laragon/Windows sem certificado raiz)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Blueprint registrado com prefixo /api/crypto em server.py
crypto_bp = Blueprint('crypto', __name__)

# Estratégias suportadas pelo módulo crypto
ESTRATEGIAS_CRYPTO = [
    {'key': 'DUAL_INVESTMENT', 'label': 'Dual Investment',       'desc': 'HIGH/LOW — Binance Dual Investment'},
    {'key': 'OPCAO_CRYPTO',    'label': 'Opção sobre Crypto',    'desc': 'CALL/PUT sobre BTC, ETH, etc.'},
    {'key': 'SPOT',            'label': 'Spot (Compra/Venda)',   'desc': 'Operação à vista'},
    {'key': 'HOLD',            'label': 'Buy & Hold',            'desc': 'Posição de longo prazo'},
    {'key': 'FUTURES',         'label': 'Futuros',               'desc': 'Contratos futuros perpétuos ou datados'},
    {'key': 'STAKING',         'label': 'Staking / Yield',       'desc': 'Rendimento de staking ou DeFi'},
    {'key': 'OUTRO',           'label': 'Outro',                 'desc': 'Outras estratégias'},
]


# ─── Listar estratégias disponíveis ─────────────────────────────────────────
@crypto_bp.route('/estrategias', methods=['GET'])
def get_estrategias():
    return jsonify(ESTRATEGIAS_CRYPTO)


# ─── Refresh de cotações ao vivo (Binance) para posições abertas ─────────────
@crypto_bp.route('/refresh', methods=['POST'])
def refresh_crypto_quotes():
    """Busca cotação atual (Binance) para cada operação crypto com status=ABERTA.
       Também auto-fecha operações cujo exercício (vencimento) já passou.
       Retorna lista [{id, spot_price, option_price, pop}] — mesmo contrato do
       endpoint /api/opcoes/refresh, permitindo que modal-analise.js reutilize
       a mesma lógica."""
    from datetime import date
    today_str = date.today().strftime('%Y-%m-%d')

    conn = db.get_db()

    # 1. Auto-fecha operações ABERTAS cujo exercício já passou
    conn.execute(
        "UPDATE operacoes_crypto SET status='FECHADA' "
        "WHERE status='ABERTA' AND exercicio IS NOT NULL AND exercicio < ?",
        (today_str,)
    )
    conn.commit()

    # 2. Busca cotações ao vivo apenas para as que ainda estão ABERTAS
    ops  = conn.execute(
        "SELECT id, ativo, cotacao_atual FROM operacoes_crypto WHERE status='ABERTA'"
    ).fetchall()
    conn.close()

    results = []
    for op in ops:
        ticker     = (op['ativo'] or 'BTC').upper() + 'USDT'
        spot_price = None
        try:
            r = requests.get(
                f'https://api.binance.com/api/v3/ticker/price?symbol={ticker}',
                timeout=5,
                verify=False,
            )
            if r.status_code == 200:
                spot_price = float(r.json().get('price', 0) or 0)
        except Exception:
            spot_price = float(op['cotacao_atual'] or 0)

        results.append({
            'id':           op['id'],
            'spot_price':   spot_price or float(op['cotacao_atual'] or 0),
            'option_price': 0,
            'pop':          0,
        })

    return jsonify({'data': results})


# ─── Produtos Binance Dual Investment (proxy público) ────────────────────────
@crypto_bp.route('/dual-investment', methods=['GET'])
def get_dual_investment():
    """Retorna lista de produtos Dual Investment disponíveis na Binance."""
    option_type = request.args.get('optionType', '')   # CALL, PUT ou '' (todos)
    page_index  = request.args.get('pageIndex', '1')
    page_size   = request.args.get('pageSize',  '20')
    asset       = request.args.get('asset', '')        # BTC, ETH, etc.

    params = {
        'pageIndex': page_index,
        'pageSize':  page_size,
    }
    # Só adiciona filtro de tipo quando usuário escolheu explicitamente
    if option_type in ('CALL', 'PUT'):
        params['optionType'] = option_type
    if asset:
        # Envia apenas o ativo base (ex. BTC), sem USDT duplicado
        clean_asset = asset.replace('USDT', '').strip().upper()
        params['underlying'] = clean_asset + 'USDT'

    # URLs alternativas — Binance frequentemente muda endpoints públicos
    ENDPOINTS = [
        'https://www.binance.com/bapi/dual/v1/public/dual/product/list',
        'https://www.binance.com/bapi/earn/v1/friendly/finance-union/simple-earn/rate-history/dual/list',
    ]

    import traceback
    last_error = None
    for url in ENDPOINTS:
        try:
            r = requests.get(
                url,
                params=params,
                headers={
                    'Accept':     'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                timeout=10,
                verify=False,
            )
            if r.status_code == 403:
                # Binance bloqueia IP externo — retorna vazio sem erro 500
                last_error = f'403 Forbidden ({url}) — Binance está bloqueando o acesso a partir deste servidor.'
                continue
            if not r.ok:
                last_error = f'{r.status_code} {r.reason} ({url})'
                continue
            data = r.json()
            # Normaliza para frontend
            products = []
            raw_list = []
            if isinstance(data, dict):
                inner = data.get('data', {})
                if isinstance(inner, dict):
                    raw_list = inner.get('list', []) or inner.get('rows', [])
                elif isinstance(inner, list):
                    raw_list = inner
            elif isinstance(data, list):
                raw_list = data
            for p in (raw_list or []):
                products.append({
                    'underlying':          p.get('underlying', ''),
                    'optionType':          p.get('optionType', option_type),
                    'strikePrice':         p.get('strikePrice'),
                    'annualInterestRate':  p.get('annualInterestRate'),
                    'deliveryDate':        p.get('deliveryDate'),
                    'duration':            p.get('duration'),
                    'minInvestCoinAssets': p.get('minInvestCoinAssets', []),
                    'purchaseEndTime':     p.get('purchaseEndTime'),
                    'productId':           p.get('productId', p.get('id', '')),
                })
            return jsonify({'success': True, 'data': products, 'count': len(products)})
        except Exception as e:
            traceback.print_exc()
            last_error = f"{type(e).__name__}: {e}"
            continue  # tenta próximo endpoint

    return jsonify({
        'success': False,
        'error':   last_error or 'Falha ao contatar a Binance',
        'data':    [],
        'hint':    'A Binance pode ter bloqueado o IP ou alterado o endpoint público.'
    }), 200  # 200 para o frontend processar o JSON normalmente


# ─── Listar todas ────────────────────────────────────────────────────────────
@crypto_bp.route('', methods=['GET'])
def get_crypto():
    tipo_estrategia = request.args.get('tipo_estrategia')
    conn = db.get_db()
    if tipo_estrategia:
        ops = conn.execute(
            'SELECT * FROM operacoes_crypto WHERE tipo_estrategia=? ORDER BY data_operacao DESC',
            (tipo_estrategia,)
        ).fetchall()
    else:
        ops = conn.execute(
            'SELECT * FROM operacoes_crypto ORDER BY data_operacao DESC'
        ).fetchall()  # noqa: E501
    conn.close()
    return jsonify([dict(o) for o in ops])


# ─── Buscar por ID ────────────────────────────────────────────────────────────
@crypto_bp.route('/<int:id>', methods=['GET'])
def get_crypto_item(id):
    conn = db.get_db()
    op   = conn.execute('SELECT * FROM operacoes_crypto WHERE id=?', (id,)).fetchone()
    conn.close()
    if op:
        return jsonify(dict(op))
    return jsonify({'error': 'Operação não encontrada'}), 404


# ─── Criar ────────────────────────────────────────────────────────────────────
@crypto_bp.route('', methods=['POST'])
def create_crypto():
    data = request.json
    conn = db.get_db()
    c    = conn.cursor()
    c.execute('''
        INSERT INTO operacoes_crypto
            (ativo, tipo, tipo_estrategia, cotacao_atual, abertura, tae, strike,
             distancia, prazo, crypto, premio_us, resultado, exercicio, dias,
             exercicio_status, status, observacoes, data_operacao, is_test_data)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        data.get('ativo'),
        data.get('tipo'),
        data.get('tipo_estrategia', 'DUAL_INVESTMENT'),
        data.get('cotacao_atual'),
        data.get('abertura'),
        data.get('tae'),
        data.get('strike'),
        data.get('distancia'),
        data.get('prazo'),
        data.get('crypto'),
        data.get('premio_us'),
        data.get('resultado'),
        data.get('exercicio'),
        data.get('dias'),
        data.get('exercicio_status'),
        data.get('status', 'ABERTA'),
        data.get('observacoes'),
        data.get('data_operacao', datetime.now().strftime('%Y-%m-%d')),
        int(data.get('is_test_data', 0)),
    ))
    conn.commit()
    new_id = c.lastrowid
    conn.close()
    return jsonify({'success': True, 'id': new_id})


# ─── Atualizar ────────────────────────────────────────────────────────────────
@crypto_bp.route('/<int:id>', methods=['PUT'])
def update_crypto(id):
    data = request.json
    conn = db.get_db()
    conn.execute('''
        UPDATE operacoes_crypto SET
            ativo=?, tipo=?, tipo_estrategia=?, cotacao_atual=?, abertura=?, tae=?,
            strike=?, distancia=?, prazo=?, crypto=?, premio_us=?, resultado=?,
            exercicio=?, dias=?, exercicio_status=?, status=?, observacoes=?,
            data_operacao=?, is_test_data=?
        WHERE id=?
    ''', (
        data.get('ativo'),
        data.get('tipo'),
        data.get('tipo_estrategia', 'DUAL_INVESTMENT'),
        data.get('cotacao_atual'),
        data.get('abertura'),
        data.get('tae'),
        data.get('strike'),
        data.get('distancia'),
        data.get('prazo'),
        data.get('crypto'),
        data.get('premio_us'),
        data.get('resultado'),
        data.get('exercicio'),
        data.get('dias'),
        data.get('exercicio_status'),
        data.get('status', 'ABERTA'),
        data.get('observacoes'),
        data.get('data_operacao'),
        int(data.get('is_test_data', 0)),
        id,
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ─── Fechar manualmente ───────────────────────────────────────────────────────
@crypto_bp.route('/<int:id>/fechar', methods=['PATCH'])
def fechar_operacao(id):
    """Fecha manualmente uma operação crypto (muda status para FECHADA)."""
    conn = db.get_db()
    op = conn.execute('SELECT id, status FROM operacoes_crypto WHERE id=?', (id,)).fetchone()
    if not op:
        conn.close()
        return jsonify({'error': 'Operação não encontrada'}), 404
    conn.execute("UPDATE operacoes_crypto SET status='FECHADA' WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Operação fechada com sucesso'})


# ─── Excluir dados de teste ───────────────────────────────────────────────────
@crypto_bp.route('/test-data', methods=['DELETE'])
def delete_test_data():
    conn = db.get_db()
    result = conn.execute(
        'DELETE FROM operacoes_crypto WHERE is_test_data = 1'
    )
    deleted = result.rowcount
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'deleted': deleted})


# ─── Excluir ──────────────────────────────────────────────────────────────────
@crypto_bp.route('/<int:id>', methods=['DELETE'])
def delete_crypto(id):
    conn = db.get_db()
    conn.execute('DELETE FROM operacoes_crypto WHERE id=?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

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
import certifi
from models.crypto_exercise import (
    calculate_crypto_exercicio_status,
    serialize_crypto_operation,
)

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


def _row_value(row, key, default=None):
    """Lê chave de sqlite.Row/dict com fallback seguro."""
    if row is None:
        return default
    if isinstance(row, dict):
        return row.get(key, default)
    try:
        return row[key]
    except Exception:
        try:
            keys = row.keys()
            if key in keys:
                return row[key]
        except Exception:
            pass
    return default


# ─── Listar estratégias disponíveis ─────────────────────────────────────────
@crypto_bp.route('/estrategias', methods=['GET'])
def get_estrategias():
    return jsonify(ESTRATEGIAS_CRYPTO)


# ─── Fechamento automático de operações vencidas ─────────────────────────────
def _auto_close_expired(conn):
    """Fecha operações ABERTAS cujo exercício já venceu.

    Regra:
      - exercicio < hoje               → sempre fecha
      - exercicio == hoje e hora >= 05:00  → fecha no dia do vencimento
    Retorna o número de operações fechadas."""
    from datetime import datetime, time as dt_time
    now       = datetime.now()
    today_str = now.strftime('%Y-%m-%d')

    # Determina limite superior da comparação
    if now.time() >= dt_time(5, 0):  # após 05:00 h fecha também as de hoje
        cutoff = today_str          # exercicio <= today
        op_str = "exercicio <= ?"
    else:
        cutoff = today_str          # exercicio < today (ontem ou antes)
        op_str = "exercicio < ?"

    ops_to_close = conn.execute(
        f"SELECT id, tipo, abertura, cotacao_atual, strike, exercicio_status FROM operacoes_crypto "
        f"WHERE status='ABERTA' AND exercicio IS NOT NULL AND {op_str}",
        (cutoff,)
    ).fetchall()
    for op in ops_to_close:
        abertura_ref = _row_value(op, 'abertura')
        if abertura_ref is None:
            abertura_ref = _row_value(op, 'cotacao_atual')
        ex_status = _calc_exercicio_status_no_fechamento(
            _row_value(op, 'tipo'),
            abertura_ref,
            _row_value(op, 'strike'),
            _row_value(op, 'exercicio_status'),
        )
        conn.execute(
            "UPDATE operacoes_crypto SET status='FECHADA', exercicio_status=? WHERE id=?",
            (ex_status, _row_value(op, 'id'))
        )
    if ops_to_close:
        conn.commit()
    return len(ops_to_close)


# ─── Refresh de cotações ao vivo (Binance) para posições abertas ─────────────
@crypto_bp.route('/refresh', methods=['POST'])
def refresh_crypto_quotes():
    """Busca cotação atual (Binance) para cada operação crypto com status=ABERTA.
       Também auto-fecha operações cujo exercício (vencimento) já passou ou vence
       hoje após 05:00 h.
       Retorna lista [{id, spot_price, option_price, pop}] — mesmo contrato do
       endpoint /api/opcoes/refresh, permitindo que modal-analise.js reutilize
       a mesma lógica."""
    conn = db.get_db()

    # 1. Auto-fecha operações vencidas (inclui hoje se >= 05:00 h)
    _auto_close_expired(conn)

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
                verify=certifi.where(),
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
        'https://www.binance.com/bapi/dual/v2/public/dual/product/list',
        'https://www.binance.com/bapi/earn/v2/public/dual/product/list',
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
                verify=certifi.where(),
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


# ─── Última PUT exercida por ativo (base para cálculo de Preço Médio) ────────
@crypto_bp.route('/ultima-put-exercida', methods=['GET'])
def get_ultima_put_exercida():
    """Retorna a última PUT exercida de cada ativo para cálculo do Preço Médio.
    Query params: ?ativo=BTC (opcional, filtra por ativo)
    """
    ativo = request.args.get('ativo', '').upper()
    conn = db.get_db()
    if ativo:
        row = conn.execute('''
            SELECT * FROM operacoes_crypto
            WHERE tipo = 'PUT'
              AND exercicio_status = 'SIM'
              AND exercicio <= date('now')
              AND UPPER(ativo) = ?
            ORDER BY exercicio DESC
            LIMIT 1
        ''', (ativo,)).fetchone()
        conn.close()
        if row:
            return jsonify(serialize_crypto_operation(row))
        return jsonify(None)
    else:
        # Retorna a última PUT exercida para cada ativo distinto
        rows = conn.execute('''
            SELECT * FROM operacoes_crypto
            WHERE tipo = 'PUT'
              AND exercicio_status = 'SIM'
              AND exercicio <= date('now')
            ORDER BY exercicio DESC
        ''').fetchall()
        conn.close()
        # Agrupa por ativo, mantendo apenas a mais recente de cada
        result = {}
        for row in rows:
            a = (_row_value(row, 'ativo') or '').upper()
            if a and a not in result:
                result[a] = serialize_crypto_operation(row)
    return jsonify(result)


# ─── Capturar operações Dual Investment da Binance (abertas + fechadas) ──────
@crypto_bp.route('/dual-investment/sync', methods=['POST'])
def sync_dual_investment():
    """Busca operações Dual Investment (abertas e fechadas) na Binance e insere no banco.
    
    Verifica duplicatas por productId antes de inserir.
    Para SETTLED, calcula prêmio real a partir de settleAmount/settlePrice.
    Retorna resumo: quantas encontradas, inseridas, já existiam.
    """
    api_key = os.getenv('BINANCE_API_KEY', '')
    secret = os.getenv('BINANCE_SECRET', '')
    if not api_key or not secret:
        return jsonify({'success': False, 'error': 'Chaves Binance não configuradas'}), 400

    base = 'https://api.binance.com'
    headers = {'X-MBX-APIKEY': api_key}

    def signed_get(path, extra_params=None):
        params = {'timestamp': int(time.time() * 1000), 'recvWindow': 30000}
        if extra_params:
            params.update(extra_params)
        query, signature = _binance_sign(params, secret)
        params['signature'] = signature
        return requests.get(f'{base}{path}', headers=headers, params=params, timeout=15)

    # ── Busca posições (abertas + fechadas) com paginação ──
    all_positions = []
    statuses_to_fetch = ['PURCHASE_SUCCESS', 'SETTLED']

    for status in statuses_to_fetch:
        page = 1
        while True:
            try:
                r = signed_get('/sapi/v1/dci/product/positions', {
                    'status': status,
                    'pageSize': 50,
                    'pageIndex': page,
                })
                if r.status_code == 200:
                    data = r.json()
                    if isinstance(data, dict):
                        lst = data.get('list', []) or data.get('rows', [])
                        total = data.get('total', 0)
                        all_positions.extend(lst)
                        if len(all_positions) >= total or not lst:
                            break
                        page += 1
                    else:
                        break
                else:
                    break
            except Exception:
                break

    if not all_positions:
        return jsonify({
            'success': True,
            'found': 0,
            'inserted': 0,
            'duplicated': 0,
            'message': 'Nenhuma operação Dual Investment encontrada na Binance.',
            'positions': []
        })

    conn = db.get_db()
    c = conn.cursor()
    
    inserted = 0
    duplicated = 0
    inserted_ops = []

    for pos in all_positions:
        product_id = pos.get('id', pos.get('productId', ''))
        if not product_id:
            continue

        existing = c.execute(
            'SELECT id FROM operacoes_crypto WHERE observacoes LIKE ?',
            (f'%productId:{product_id}%',)
        ).fetchone()
        
        if existing:
            duplicated += 1
            continue

        # ── Dados básicos ──
        option_type = (pos.get('optionType', '') or '').upper()
        invest_coin = (pos.get('investCoin', '') or '').upper()
        # CALL: investCoin é o crypto vendido; PUT: exercisedCoin é o crypto comprado
        if option_type == 'PUT':
            underlying = (pos.get('exercisedCoin', '') or '').upper()
        else:
            underlying = invest_coin
        purchase_status = pos.get('purchaseStatus', '')
        is_settled = purchase_status == 'SETTLED'

        strike_price = 0
        try:
            strike_price = float(pos.get('strikePrice', 0) or 0)
        except (ValueError, TypeError):
            pass

        annual_rate = 0
        try:
            annual_rate = float(pos.get('apr', 0) or 0)
        except (ValueError, TypeError):
            pass

        duration = 0
        try:
            duration = int(pos.get('duration', 0) or 0)
        except (ValueError, TypeError):
            pass

        invest_amount = 0
        try:
            invest_amount = float(pos.get('subscriptionAmount', 0) or 0)
        except (ValueError, TypeError):
            pass

        # ── Datas ──
        from datetime import datetime

        settle_date = pos.get('settleDate', 0)
        delivery_date = ''
        if isinstance(settle_date, (int, float)) and settle_date > 1e10:
            delivery_date = datetime.fromtimestamp(settle_date / 1000).strftime('%Y-%m-%d')

        purchase_end_ts = pos.get('purchaseEndTime', 0)
        purchase_end = ''
        if isinstance(purchase_end_ts, (int, float)) and purchase_end_ts > 1e10:
            purchase_end = datetime.fromtimestamp(purchase_end_ts / 1000).strftime('%Y-%m-%d')

        subs_time = pos.get('subscriptionTime', 0)
        data_operacao = ''
        if isinstance(subs_time, (int, float)) and subs_time > 1e10:
            data_operacao = datetime.fromtimestamp(subs_time / 1000).strftime('%Y-%m-%d')

        prazo = duration

        # ── Observações ──
        obs = f'productId:{product_id}'
        if purchase_status:
            obs += f' | status:{purchase_status}'

        data_op = data_operacao if data_operacao else purchase_end
        if not data_op:
            try:
                data_op = datetime.now().strftime('%Y-%m-%d')
            except:
                data_op = None

        # ── Abertura em USDT ──
        abertura_usd = None
        if invest_amount > 0:
            if invest_coin == 'USDT':
                abertura_usd = invest_amount
            elif strike_price > 0:
                abertura_usd = invest_amount * strike_price

        # ── Prêmio e resultado ──
        premio_us = None
        resultado = None
        exercicio_status_db = None
        is_exercised = False

        if is_settled:
            # Posição fechada: usa dados reais da liquidação
            settle_amount = 0
            settle_price = 0
            try:
                settle_amount = float(pos.get('settleAmount', 0) or 0)
            except (ValueError, TypeError):
                pass
            try:
                settle_price = float(pos.get('settlePrice', 0) or 0)
            except (ValueError, TypeError):
                pass

            is_exercised = pos.get('isExercised', False)

            if is_exercised:
                # Exercida: comprou crypto ao strike (USDT → crypto)
                exercicio_status_db = 'SIM'
                if underlying == 'USDT':
                    resultado = settle_amount - invest_amount
                elif strike_price > 0 and settle_price > 0 and invest_amount > 0:
                    crypto_qty = invest_amount / strike_price
                    resultado = (strike_price - settle_price) * crypto_qty
                # premio = premium recebido (APR * dias / 365), sempre positivo
                premio_us = invest_amount * annual_rate * prazo / 365 if (invest_amount > 0 and annual_rate > 0 and prazo > 0) else 0
                if invest_coin != 'USDT' and strike_price > 0:
                    premio_us = premio_us * strike_price
            else:
                # Nao exercida: recebeu ativo de volta + premium
                exercicio_status_db = 'NAO'
                if settle_amount > 0 and invest_amount > 0:
                    if invest_coin == 'USDT':
                        premio_us = settle_amount - invest_amount
                    elif settle_price > 0:
                        premio_us = (settle_amount - invest_amount) * settle_price
                    resultado = premio_us
        else:
            # Posicao aberta: estima premio pelo APR
            if invest_amount > 0 and annual_rate > 0 and prazo > 0 and strike_price > 0:
                premio_crypto = invest_amount * annual_rate * prazo / 365
                premio_us = premio_crypto * strike_price if invest_coin != 'USDT' else premio_crypto

        # ── Status ──
        status_db = 'FECHADA' if is_settled else 'ABERTA'

        c.execute('''
            INSERT INTO operacoes_crypto
                (ativo, tipo, tipo_estrategia, cotacao_atual, abertura, tae, strike,
                 distancia, prazo, crypto, premio_us, resultado, exercicio, dias,
                 exercicio_status, status, observacoes, data_operacao, corretora)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            underlying,
            option_type,
            'DUAL_INVESTMENT',
            strike_price if strike_price > 0 else None,
            abertura_usd,
            annual_rate * 100 if annual_rate <= 1 else annual_rate,
            strike_price if strike_price > 0 else None,
            None,
            prazo if prazo > 0 else None,
            invest_amount if invest_amount > 0 and invest_coin != 'USDT' else (invest_amount / strike_price if invest_amount > 0 and strike_price > 0 and invest_coin == 'USDT' else None),
            round(premio_us, 2) if premio_us else None,
            round(resultado, 2) if resultado else None,
            delivery_date if delivery_date else None,
            prazo if prazo > 0 else None,
            exercicio_status_db,
            status_db,
            obs,
            data_op,
            'BINANCE',
        ))
        inserted += 1
        inserted_ops.append({
            'productId': product_id,
            'underlying': underlying,
            'optionType': option_type,
            'strike': strike_price,
            'duration': prazo,
            'deliveryDate': delivery_date,
            'status': status_db,
            'premio_us': round(premio_us, 2) if premio_us else None,
        })

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'found': len(all_positions),
        'inserted': inserted,
        'duplicated': duplicated,
        'message': f'{inserted} operacao(oes) inserida(s), {duplicated} ja existia(m).',
        'positions': inserted_ops,
    })


# ─── Capturar operações Dual Investment — Streaming SSE ─────────────────────
@crypto_bp.route('/dual-investment/stream', methods=['POST'])
def stream_dual_investment():
    """Busca operações Dual Investment com progresso em tempo real via SSE.
    
    Envia eventos: progress, coin, done, error
    """
    from flask import Response, stream_with_context
    import json as _json

    api_key = os.getenv('BINANCE_API_KEY', '')
    secret = os.getenv('BINANCE_SECRET', '')
    if not api_key or not secret:
        return jsonify({'success': False, 'error': 'Chaves Binance nao configuradas'}), 400

    base = 'https://api.binance.com'
    headers_bin = {'X-MBX-APIKEY': api_key}

    def signed_get(path, extra_params=None):
        params = {'timestamp': int(time.time() * 1000), 'recvWindow': 30000}
        if extra_params:
            params.update(extra_params)
        query, signature = _binance_sign(params, secret)
        params['signature'] = signature
        return requests.get(f'{base}{path}', headers=headers_bin, params=params, timeout=15)

    def generate():
        # Fase 1: buscar posições da Binance
        yield _json.dumps({'event': 'progress', 'pct': 0, 'done': 0, 'total': 0, 'status': 'fetching', 'msg': 'Conectando a Binance...'}) + '\n'

        all_positions = []
        statuses_to_fetch = ['PURCHASE_SUCCESS', 'SETTLED']

        for status in statuses_to_fetch:
            page = 1
            while True:
                try:
                    r = signed_get('/sapi/v1/dci/product/positions', {
                        'status': status,
                        'pageSize': 50,
                        'pageIndex': page,
                    })
                    if r.status_code == 200:
                        data = r.json()
                        if isinstance(data, dict):
                            lst = data.get('list', []) or data.get('rows', [])
                            total_api = data.get('total', 0)
                            all_positions.extend(lst)
                            if len(all_positions) >= total_api or not lst:
                                break
                            page += 1
                        else:
                            break
                    else:
                        break
                except Exception:
                    break

        if not all_positions:
            yield _json.dumps({'event': 'done', 'found': 0, 'inserted': 0, 'duplicated': 0, 'coins': {}}) + '\n'
            return

        total = len(all_positions)
        yield _json.dumps({'event': 'progress', 'pct': 0, 'done': 0, 'total': total, 'status': 'importing', 'msg': f'{total} operacoes encontradas'}) + '\n'

        # Fase 2: importar posições uma a uma
        conn = db.get_db()
        c = conn.cursor()

        inserted = 0
        duplicated = 0
        coin_counts = {}
        done = 0
        from datetime import datetime

        for pos in all_positions:
            product_id = pos.get('id', pos.get('productId', ''))
            option_type = (pos.get('optionType', '') or '').upper()
            invest_coin = (pos.get('investCoin', '') or '').upper()
            # CALL: investCoin é o crypto vendido; PUT: exercisedCoin é o crypto comprado
            if option_type == 'PUT':
                underlying = (pos.get('exercisedCoin', '') or '').upper()
            else:
                underlying = invest_coin

            if not product_id:
                done += 1
                pct = round((done / total) * 100)
                yield _json.dumps({'event': 'progress', 'pct': pct, 'done': done, 'total': total, 'status': 'importing', 'coin': underlying, 'type': option_type}) + '\n'
                continue

            existing = c.execute(
                'SELECT id FROM operacoes_crypto WHERE observacoes LIKE ?',
                (f'%productId:{product_id}%',)
            ).fetchone()

            if existing:
                duplicated += 1
                done += 1
                pct = round((done / total) * 100)
                yield _json.dumps({'event': 'progress', 'pct': pct, 'done': done, 'total': total, 'status': 'importing', 'coin': underlying, 'type': option_type}) + '\n'
                continue

            purchase_status = pos.get('purchaseStatus', '')
            is_settled = purchase_status == 'SETTLED'

            strike_price = 0
            try:
                strike_price = float(pos.get('strikePrice', 0) or 0)
            except (ValueError, TypeError):
                pass

            annual_rate = 0
            try:
                annual_rate = float(pos.get('apr', 0) or 0)
            except (ValueError, TypeError):
                pass

            duration = 0
            try:
                duration = int(pos.get('duration', 0) or 0)
            except (ValueError, TypeError):
                pass

            invest_amount = 0
            try:
                invest_amount = float(pos.get('subscriptionAmount', 0) or 0)
            except (ValueError, TypeError):
                pass

            settle_date = pos.get('settleDate', 0)
            delivery_date = ''
            if isinstance(settle_date, (int, float)) and settle_date > 1e10:
                delivery_date = datetime.fromtimestamp(settle_date / 1000).strftime('%Y-%m-%d')

            purchase_end_ts = pos.get('purchaseEndTime', 0)
            purchase_end = ''
            if isinstance(purchase_end_ts, (int, float)) and purchase_end_ts > 1e10:
                purchase_end = datetime.fromtimestamp(purchase_end_ts / 1000).strftime('%Y-%m-%d')

            subs_time = pos.get('subscriptionTime', 0)
            data_operacao = ''
            if isinstance(subs_time, (int, float)) and subs_time > 1e10:
                data_operacao = datetime.fromtimestamp(subs_time / 1000).strftime('%Y-%m-%d')

            prazo = duration
            obs = f'productId:{product_id}'
            if purchase_status:
                obs += f' | status:{purchase_status}'

            data_op = data_operacao if data_operacao else purchase_end
            if not data_op:
                try:
                    data_op = datetime.now().strftime('%Y-%m-%d')
                except:
                    data_op = None

            abertura_usd = None
            if invest_amount > 0:
                if invest_coin == 'USDT':
                    abertura_usd = invest_amount
                elif strike_price > 0:
                    abertura_usd = invest_amount * strike_price

            premio_us = None
            resultado = None
            exercicio_status_db = None

            if is_settled:
                settle_amount = 0
                settle_price = 0
                try:
                    settle_amount = float(pos.get('settleAmount', 0) or 0)
                except (ValueError, TypeError):
                    pass
                try:
                    settle_price = float(pos.get('settlePrice', 0) or 0)
                except (ValueError, TypeError):
                    pass
                is_exercised = pos.get('isExercised', False)

                if is_exercised:
                    exercicio_status_db = 'SIM'
                    if underlying == 'USDT':
                        resultado = settle_amount - invest_amount
                    elif strike_price > 0 and settle_price > 0 and invest_amount > 0:
                        crypto_qty = invest_amount / strike_price
                        resultado = (strike_price - settle_price) * crypto_qty
                    # premio = premium recebido (APR * dias / 365), sempre positivo
                    premio_us = invest_amount * annual_rate * prazo / 365 if (invest_amount > 0 and annual_rate > 0 and prazo > 0) else 0
                    if invest_coin != 'USDT' and strike_price > 0:
                        premio_us = premio_us * strike_price
                else:
                    exercicio_status_db = 'NAO'
                    if settle_amount > 0 and invest_amount > 0:
                        if invest_coin == 'USDT':
                            premio_us = settle_amount - invest_amount
                        elif settle_price > 0:
                            premio_us = (settle_amount - invest_amount) * settle_price
                        resultado = premio_us
            else:
                if invest_amount > 0 and annual_rate > 0 and prazo > 0 and strike_price > 0:
                    premio_crypto = invest_amount * annual_rate * prazo / 365
                    premio_us = premio_crypto * strike_price if invest_coin != 'USDT' else premio_crypto

            status_db = 'FECHADA' if is_settled else 'ABERTA'

            c.execute('''
                INSERT INTO operacoes_crypto
                    (ativo, tipo, tipo_estrategia, cotacao_atual, abertura, tae, strike,
                     distancia, prazo, crypto, premio_us, resultado, exercicio, dias,
                     exercicio_status, status, observacoes, data_operacao, corretora)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ''', (
                underlying, option_type, 'DUAL_INVESTMENT',
                strike_price if strike_price > 0 else None,
                abertura_usd,
                annual_rate * 100 if annual_rate <= 1 else annual_rate,
                strike_price if strike_price > 0 else None,
                None, prazo if prazo > 0 else None,
                invest_amount if invest_amount > 0 and invest_coin != 'USDT' else (invest_amount / strike_price if invest_amount > 0 and strike_price > 0 and invest_coin == 'USDT' else None),
                round(premio_us, 2) if premio_us else None,
                round(resultado, 2) if resultado else None,
                delivery_date if delivery_date else None,
                prazo if prazo > 0 else None,
                exercicio_status_db, status_db, obs, data_op, 'BINANCE',
            ))
            inserted += 1
            coin_counts[underlying] = coin_counts.get(underlying, 0) + 1

            done += 1
            pct = round((done / total) * 100)
            evt = {
                'event': 'progress',
                'pct': pct,
                'done': done,
                'total': total,
                'status': 'importing',
                'coin': underlying,
                'type': option_type,
                'op_status': status_db,
            }
            yield _json.dumps(evt) + '\n'

            # Pequena pausa para o frontend processar
            if done % 5 == 0:
                time.sleep(0.01)

        conn.commit()
        conn.close()

        yield _json.dumps({
            'event': 'done',
            'found': total,
            'inserted': inserted,
            'duplicated': duplicated,
            'coins': coin_counts,
        }) + '\n'

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        }
    )


# ─── Listar todas ────────────────────────────────────────────────────────────
@crypto_bp.route('', methods=['GET'])
def get_crypto():
    tipo_estrategia = request.args.get('tipo_estrategia')
    conn = db.get_db()
    # Auto-fecha operações vencidas antes de retornar a lista
    _auto_close_expired(conn)
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
    return jsonify([serialize_crypto_operation(o) for o in ops])


# ─── Buscar por ID ────────────────────────────────────────────────────────────
@crypto_bp.route('/<int:id>', methods=['GET'])
def get_crypto_item(id):
    conn = db.get_db()
    op   = conn.execute('SELECT * FROM operacoes_crypto WHERE id=?', (id,)).fetchone()
    conn.close()
    if op:
        return jsonify(serialize_crypto_operation(op))
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
             exercicio_status, status, observacoes, data_operacao, is_test_data, corretora)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
        data.get('corretora', 'BINANCE'),
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
            data_operacao=?, is_test_data=?, corretora=?
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
        data.get('corretora', 'BINANCE'),
        id,
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


def _calc_exercicio_status(tipo, cotacao_atual, strike):
    """Calcula exercício com a regra unificada do módulo crypto."""
    return calculate_crypto_exercicio_status(tipo, cotacao_atual, strike)


def _calc_exercicio_status_no_fechamento(tipo, abertura, strike, exercicio_status_persistido=None):
    """Calcula exercício no fechamento usando abertura x strike (ou status persistido)."""
    persisted = str(exercicio_status_persistido or '').strip().upper()
    if persisted == 'NÃO':
        persisted = 'NAO'
    if persisted in ('SIM', 'NAO'):
        return persisted
    return calculate_crypto_exercicio_status(tipo, abertura, strike)


# ─── Fechar manualmente ───────────────────────────────────────────────────────
@crypto_bp.route('/<int:id>/fechar', methods=['PATCH'])
def fechar_operacao(id):
    """Fecha manualmente uma operação crypto (muda status para FECHADA) e calcula exercicio_status."""
    conn = db.get_db()
    op = conn.execute(
        'SELECT id, status, tipo, abertura, cotacao_atual, strike, exercicio_status FROM operacoes_crypto WHERE id=?',
        (id,)
    ).fetchone()
    if not op:
        conn.close()
        return jsonify({'error': 'Operação não encontrada'}), 404
    abertura_ref = _row_value(op, 'abertura')
    if abertura_ref is None:
        abertura_ref = _row_value(op, 'cotacao_atual')
    ex_status = _calc_exercicio_status_no_fechamento(
        _row_value(op, 'tipo'),
        abertura_ref,
        _row_value(op, 'strike'),
        _row_value(op, 'exercicio_status'),
    )
    conn.execute("UPDATE operacoes_crypto SET status='FECHADA', exercicio_status=? WHERE id=?", (ex_status, id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Operação fechada com sucesso', 'exercicio_status': ex_status})


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


# ─── Saldo Binance ────────────────────────────────────────────────────────────
import os, time, hashlib, hmac
from urllib.parse import urlencode

def _binance_sign(params, secret):
    query = urlencode(params)
    signature = hmac.new(secret.encode(), query.encode(), hashlib.sha256).hexdigest()
    return query, signature

@crypto_bp.route('/balance', methods=['GET'])
def binance_balance():
    """Retorna saldo total da conta Binance (todas as carteiras acessíveis via API).
    
    NOTA: A API da Binance NÃO fornece saldo de Dual Investment/Advanced Earn.
    O saldo retornado é: Spot + Earn Flexible + Earn Locked + Funding.
    Para incluir Dual Investment, configure manualmente em Configurações."""
    api_key = os.getenv('BINANCE_API_KEY', '')
    secret = os.getenv('BINANCE_SECRET', '')
    if not api_key or not secret:
        return jsonify({'error': 'Chaves Binance não configuradas'}), 400

    base = 'https://api.binance.com'
    headers = {'X-MBX-APIKEY': api_key}

    def signed_params():
        return {'timestamp': int(time.time() * 1000), 'recvWindow': 30000}

    def signed_get(path):
        p = signed_params()
        query, sig = _binance_sign(p, secret)
        p['signature'] = sig
        return requests.get(f'{base}{path}', headers=headers, params=p, timeout=15)

    def signed_post(path):
        p = signed_params()
        query, sig = _binance_sign(p, secret)
        p['signature'] = sig
        return requests.post(f'{base}{path}', headers=headers, data=p, timeout=15)

    # 1) Busca cotações atuais
    prices = {}
    try:
        r_price = requests.get(f'{base}/api/v3/ticker/price', timeout=10)
        if r_price.status_code == 200:
            for p in r_price.json():
                prices[p['symbol']] = float(p['price'])
    except Exception:
        pass

    all_assets = {}

    # 2) Spot Account
    try:
        r = signed_get('/api/v3/account')
        if r.status_code == 200:
            for b in r.json().get('balances', []):
                free = float(b.get('free', 0)) + float(b.get('locked', 0))
                if free > 0:
                    all_assets[b['asset']] = all_assets.get(b['asset'], 0) + free
    except Exception:
        pass

    # 3) Simple Earn Flexible
    try:
        r = signed_get('/sapi/v1/simple-earn/flexible/position')
        if r.status_code == 200:
            for row in r.json().get('rows', []):
                amt = float(row.get('totalAmount', 0))
                if amt > 0:
                    all_assets[row['asset']] = all_assets.get(row['asset'], 0) + amt
    except Exception:
        pass

    # 4) Simple Earn Locked
    try:
        r = signed_get('/sapi/v1/simple-earn/locked/position')
        if r.status_code == 200:
            for row in r.json().get('rows', []):
                amt = float(row.get('totalAmount', 0))
                if amt > 0:
                    all_assets[row['asset']] = all_assets.get(row['asset'], 0) + amt
    except Exception:
        pass

    # 5) Funding Wallet (requer POST)
    try:
        r = signed_post('/sapi/v1/asset/get-funding-asset')
        if r.status_code == 200:
            for row in r.json():
                amt = float(row.get('free', 0)) + float(row.get('locked', 0))
                if amt > 0:
                    all_assets[row['asset']] = all_assets.get(row['asset'], 0) + amt
    except Exception:
        pass

    # 6) Converte tudo para USDT
    total_usdt = 0.0
    for asset, amount in all_assets.items():
        if asset in ('USDT', 'USDC', 'BUSD', 'FDUSD'):
            total_usdt += amount
        elif f'{asset}USDT' in prices:
            total_usdt += amount * prices[f'{asset}USDT']

    # 7) Salva no banco
    if total_usdt > 0:
        try:
            conn = db.get_db()
            conn.execute('''INSERT INTO configuracoes (chave, valor, updated_at) VALUES (?,?,?)
                ON CONFLICT(chave) DO UPDATE SET valor=?, updated_at=?''',
                ('saldoCrypto', str(round(total_usdt, 2)),
                 datetime.now().isoformat(),
                 str(round(total_usdt, 2)),
                 datetime.now().isoformat()))
            conn.commit()
            conn.close()
        except Exception:
            pass

    return jsonify({
        'success': True,
        'total_usdt': round(total_usdt, 2),
    })


@crypto_bp.route('/balance/test', methods=['GET'])
def binance_balance_test():
    """Endpoint de diagnóstico - testa múltiplas APIs da Binance."""
    api_key = os.getenv('BINANCE_API_KEY', '')
    secret = os.getenv('BINANCE_SECRET', '')
    if not api_key or not secret:
        return jsonify({'error': 'Chaves não configuradas', 'api_key_set': bool(api_key), 'secret_set': bool(secret)})

    base = 'https://api.binance.com'
    headers = {'X-MBX-APIKEY': api_key}

    def signed_get(path):
        params = {'timestamp': int(time.time() * 1000), 'recvWindow': 30000}
        query, signature = _binance_sign(params, secret)
        params['signature'] = signature
        return requests.get(f'{base}{path}', headers=headers, params=params, timeout=15)

    result = {'api_key_prefix': api_key[:8] + '...', 'secret_set': bool(secret)}

    # 1) Account Spot
    try:
        r = signed_get('/api/v3/account')
        result['account_status'] = r.status_code
        if r.status_code == 200:
            account = r.json()
            non_zero = [b for b in account.get('balances', []) if float(b.get('free', 0)) + float(b.get('locked', 0)) > 0]
            result['spot_assets'] = [{'asset': b['asset'], 'free': b['free'], 'locked': b['locked']} for b in non_zero[:30]]
    except Exception as e:
        result['account_error'] = str(e)

    # 2) Total balance - POST (método correto)
    try:
        p = {'timestamp': int(time.time() * 1000), 'recvWindow': 30000}
        query, sig = _binance_sign(p, secret)
        p['signature'] = sig
        r = requests.post(f'{base}/sapi/v1/asset/get-total-balance', headers=headers, data=p, timeout=15)
        result['total_balance_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['totalWalletBalance'] = data.get('totalWalletBalance')
            result['totalMarginBalance'] = data.get('totalMarginBalance')
        else:
            result['total_balance_error'] = r.text[:300]
    except Exception as e:
        result['total_balance_error'] = str(e)

    # 3) Fund value (outra API de saldo total)
    try:
        p = {'timestamp': int(time.time() * 1000), 'recvWindow': 30000}
        query, sig = _binance_sign(p, secret)
        p['signature'] = sig
        r = requests.post(f'{base}/sapi/v1/asset/get-fund-value', headers=headers, data=p, timeout=15)
        result['fund_value_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['fund_value'] = data
    except Exception as e:
        result['fund_value_error'] = str(e)

    # 3) Simple Earn Flexible
    try:
        r = signed_get('/sapi/v1/simple-earn/flexible/position')
        result['simple_earn_flexible_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['simple_earn_flexible'] = data.get('rows', [])[:10]
    except Exception as e:
        result['simple_earn_flexible_error'] = str(e)

    # 4) Simple Earn Locked
    try:
        r = signed_get('/sapi/v1/simple-earn/locked/position')
        result['simple_earn_locked_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['simple_earn_locked'] = data.get('rows', [])[:10]
    except Exception as e:
        result['simple_earn_locked_error'] = str(e)

    # 5) Funding wallet
    try:
        r = signed_get('/sapi/v1/asset/get-funding-asset')
        result['funding_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['funding_assets'] = [{'asset': a['asset'], 'free': a['free'], 'locked': a['locked']} for a in data[:20]]
    except Exception as e:
        result['funding_error'] = str(e)

    # 6) Savings account (Earn)
    try:
        r = signed_get('/sapi/v1/savings/product/list')
        result['savings_product_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['savings_product_count'] = len(data) if isinstance(data, list) else 0
    except Exception as e:
        result['savings_product_error'] = str(e)

    # 7) Dual Investment positions (v3 API)
    try:
        r = signed_get('/sapi/v1/dual-investment/position')
        result['dual_investment_v3_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['dual_investment_positions'] = data.get('rows', [])[:10]
    except Exception as e:
        result['dual_investment_v3_error'] = str(e)

    # 8) Margin account
    try:
        r = signed_get('/sapi/v1/margin/account')
        result['margin_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['margin_assets'] = [{'asset': a['asset'], 'free': a['free'], 'locked': a['locked'], 'borrowed': a['borrowed'], 'interest': a['interest']} for a in data.get('userAssets', []) if float(a.get('free', 0)) + float(a.get('locked', 0)) + float(a.get('borrowed', 0)) > 0][:20]
    except Exception as e:
        result['margin_error'] = str(e)

    # 9) Futures account (USDT-M)
    try:
        r = signed_get('/fapi/v2/account')
        result['futures_usdt_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['futures_usdt_assets'] = [{'asset': a['asset'], 'walletBalance': a['walletBalance'], 'availableBalance': a['availableBalance']} for a in data.get('assets', []) if float(a.get('walletBalance', 0)) > 0][:20]
    except Exception as e:
        result['futures_usdt_error'] = str(e)

    # 10) Futures account (COIN-M)
    try:
        r = signed_get('/dapi/v1/account')
        result['futures_coin_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['futures_coin_assets'] = [{'asset': a['asset'], 'walletBalance': a['walletBalance'], 'availableBalance': a['availableBalance']} for a in data.get('assets', []) if float(a.get('walletBalance', 0)) > 0][:20]
    except Exception as e:
        result['futures_coin_error'] = str(e)

    # 11) Launchpool
    try:
        r = signed_get('/sapi/v1/launchpool/userPosition')
        result['launchpool_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['launchpool_positions'] = data.get('rows', [])[:10]
    except Exception as e:
        result['launchpool_error'] = str(e)

    # 12) Auto-Invest
    try:
        r = signed_get('/sapi/v1/lending/auto-invest/plan/list')
        result['auto_invest_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['auto_invest_plans'] = data.get('data', [])[:10]
    except Exception as e:
        result['auto_invest_error'] = str(e)

    # 13) Convert/Trade history (para ver se há BTC/ETH recentes)
    try:
        r = signed_get('/sapi/v1/convert/tradeFlow')
        result['convert_history_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['convert_trades'] = data.get('list', [])[:10]
    except Exception as e:
        result['convert_history_error'] = str(e)

    # 14) Dual Investment v1/v2 (endpoint antigo)
    try:
        r = signed_get('/sapi/v1/dual-investment/positions')
        result['dual_investment_positions_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['dual_investment_positions'] = data.get('rows', [])[:10]
    except Exception as e:
        result['dual_investment_positions_error'] = str(e)

    # 15) ETH Staking (ETH 2.0)
    try:
        r = signed_get('/sapi/v1/eth-staking/eth/history/rateHistory')
        result['eth_staking_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['eth_staking_data'] = data
    except Exception as e:
        result['eth_staking_error'] = str(e)

    # 16) Staking positions
    try:
        r = signed_get('/sapi/v1/staking/position')
        result['staking_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['staking_positions'] = data[:10]
    except Exception as e:
        result['staking_error'] = str(e)

    # 17) Asset transfer history (pode mostrar movimentos de BTC/ETH)
    try:
        r = signed_get('/sapi/v1/asset/transfer')
        result['asset_transfer_status'] = r.status_code
        if r.status_code == 200:
            data = r.json()
            result['asset_transfers'] = data.get('rows', [])[:10]
    except Exception as e:
        result['asset_transfer_error'] = str(e)

    return jsonify(result)

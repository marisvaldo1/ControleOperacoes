"""
routes/market.py — Proxy de Mercado (OpLab + yfinance + Binance)
Escopo: COMPARTILHADO (opcoes + crypto)

Rotas registradas:
  GET /api/proxy/stocks/<ticker>       — cotação de ação (OpLab)
  GET /api/proxy/options/<ticker>      — cadeia de opções (OpLab)
  GET /api/market/opcoes/<ticker>      — alias de proxy/options
  GET /api/opcoes/market/<ticker>      — alias de proxy/options
  GET /api/cotacao/realtime/<ticker>   — cotação em tempo real (yfinance)
  GET /api/cotacao/hibrido/<ticker>    — sistema híbrido yfinance + OpLab
  GET /api/cache/clear                 — limpar cache de cotações
  GET /api/proxy/crypto/<ticker>       — preço de crypto (Binance)
  GET /api/cotacao/opcoes              — cotação de opção individual (?symbol=)
  GET /api/cotacao/opcoes/<symbol>     — cotação de opção individual (path)
"""
from flask              import Blueprint, request, jsonify
from requests.exceptions import SSLError
from datetime           import datetime, timedelta
import certifi
import requests
import os
import yfinance as yf

market_bp = Blueprint('market', __name__)

# ─── Cache de cotações (5 minutos) ───────────────────────────────────────────
_cache: dict  = {}
_CACHE_TTL    = timedelta(minutes=5)


# ─── Helpers OpLab ───────────────────────────────────────────────────────────
def _oplab_verify():
    mode = os.environ.get('OPLAB_SSL_VERIFY', 'auto').lower()
    if mode in ('false', '0', 'no'):
        return False
    if mode in ('true', '1', 'yes'):
        return certifi.where()
    return 'auto'


def oplab_get(url, headers=None, timeout=10):
    verify = _oplab_verify()
    if verify != 'auto':
        return requests.get(url, headers=headers, timeout=timeout, verify=verify)
    try:
        return requests.get(url, headers=headers, timeout=timeout, verify=certifi.where())
    except SSLError:
        return requests.get(url, headers=headers, timeout=timeout, verify=False)


def _oplab_headers():
    return {'Access-Token': os.environ.get('OPLAB_API_KEY', '')}


def _normalize_flask_response(response):
    if isinstance(response, tuple):
        resp   = response[0]
        status = response[1] if len(response) > 1 else None
    else:
        resp   = response
        status = getattr(resp, 'status_code', None)
    data = resp.get_json() if hasattr(resp, 'get_json') else resp
    return resp, status, data


# ─── Cotação de ação (OpLab) ──────────────────────────────────────────────────
@market_bp.route('/proxy/stocks/<ticker>')
def proxy_stocks(ticker):
    try:
        r = oplab_get(
            f'https://api.oplab.com.br/v3/market/stocks/{ticker}',
            headers=_oplab_headers(),
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Cadeia de opções (OpLab) — múltiplos endpoints + merge ──────────────────
@market_bp.route('/proxy/options/<ticker>')
def proxy_options(ticker):
    headers     = _oplab_headers()
    options_map = {}

    try:
        # Endpoint 1: /options
        try:
            r1 = oplab_get(
                f'https://api.oplab.com.br/v3/market/options/{ticker}',
                headers=headers, timeout=15,
            )
            if r1.status_code == 200:
                d = r1.json()
                items = (d if isinstance(d, list)
                         else d.get('options', d.get('data',
                         d.get('calls', []) + d.get('puts', []))))
                for item in (items if isinstance(items, list) else []):
                    sym = item.get('symbol', item.get('ticker', ''))
                    if sym:
                        options_map[sym] = item
        except Exception as e:
            print(f'[market] opt endpoint1: {e}')

        # Endpoint 2: /options/details
        try:
            r2 = oplab_get(
                f'https://api.oplab.com.br/v3/market/options/details/{ticker}',
                headers=headers, timeout=15,
            )
            if r2.status_code == 200:
                d = r2.json()
                items = (d if isinstance(d, list)
                         else ([d] if isinstance(d, dict) and ('symbol' in d or 'due_date' in d)
                               else [v for v in d.values() if isinstance(v, list)]))
                flat = []
                for i in (items if isinstance(items, list) else []):
                    (flat.extend(i) if isinstance(i, list) else flat.append(i))
                for item in flat:
                    sym = item.get('symbol', item.get('ticker', ''))
                    if sym:
                        if sym in options_map:
                            options_map[sym].update(item)
                        else:
                            options_map[sym] = item
        except Exception as e:
            print(f'[market] opt endpoint2: {e}')

        # Endpoint 3: /series
        try:
            r3 = oplab_get(
                f'https://api.oplab.com.br/v3/market/options/{ticker}/series',
                headers=headers, timeout=15,
            )
            if r3.status_code == 200:
                for item in (r3.json() if isinstance(r3.json(), list) else []):
                    sym = item.get('symbol', item.get('ticker', ''))
                    if sym:
                        if sym in options_map:
                            options_map[sym].update(item)
                        else:
                            options_map[sym] = item
        except Exception as e:
            print(f'[market] opt endpoint3: {e}')

        all_options = list(options_map.values())

        # Spot price do ativo base
        spot_price = 0.0
        try:
            rs = oplab_get(
                f'https://api.oplab.com.br/v3/market/stocks/{ticker}',
                headers=headers, timeout=5,
            )
            if rs.status_code == 200:
                ds = rs.json()
                spot_price = float(
                    ds.get('close') or ds.get('price') or ds.get('last') or 0.0
                )
        except Exception:
            pass

        if all_options:
            return jsonify({'options': all_options, 'spot_price': spot_price}), 200
        return jsonify({'error': 'Nenhuma opção encontrada', 'options': [],
                        'spot_price': spot_price}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Aliases ──────────────────────────────────────────────────────────────────
@market_bp.route('/market/opcoes/<ticker>')
def market_opcoes_alias(ticker):
    return proxy_options(ticker)


@market_bp.route('/opcoes/market/<ticker>')
def opcoes_market_alias(ticker):
    return proxy_options(ticker)


# ─── Cotação em tempo real (yfinance) ─────────────────────────────────────────
@market_bp.route('/cotacao/realtime/<ticker>')
def get_realtime_quote(ticker):
    cache_key = f'realtime_{ticker}'
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if datetime.now() - ts < _CACHE_TTL:
            data['from_cache'] = True
            return jsonify(data)
    try:
        stock = yf.Ticker(f'{ticker}.SA')
        hist  = stock.history(period='1d', interval='1m')
        if hist.empty:
            return jsonify({'error': 'Sem dados disponíveis'}), 404

        current_price = float(hist['Close'].iloc[-1])
        try:
            prev_close = stock.info.get('previousClose', current_price)
        except Exception:
            prev_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current_price

        change     = current_price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0

        result = {
            'ticker':         ticker,
            'price':          round(current_price, 2),
            'change':         round(change, 2),
            'change_percent': round(change_pct, 2),
            'volume':         int(hist['Volume'].iloc[-1]) if 'Volume' in hist else 0,
            'timestamp':      hist.index[-1].isoformat(),
            'source':         'yfinance',
            'delay_minutes':  '5-10',
            'from_cache':     False,
        }
        _cache[cache_key] = (result, datetime.now())
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Sistema híbrido (yfinance spot + OpLab opções) ───────────────────────────
@market_bp.route('/cotacao/hibrido/<ticker>')
def get_hybrid_quote(ticker):
    try:
        rt_resp                 = get_realtime_quote(ticker)
        _, rt_status, rt_data   = _normalize_flask_response(rt_resp)

        if rt_status and rt_status != 200:
            return proxy_options(ticker)

        spot_price = rt_data.get('price')

        opt_resp                = proxy_options(ticker)
        _, opt_status, opt_data = _normalize_flask_response(opt_resp)

        opcoes = []
        if opt_status == 200 and isinstance(opt_data, dict):
            opcoes = opt_data.get('options', []) or opt_data.get('opcoes', [])

        for op in opcoes:
            op['spot_price_realtime'] = spot_price
            op['spot_source']         = 'yfinance'

        return jsonify({
            'ticker':               ticker,
            'spot_price':           spot_price,
            'spot_change':          rt_data.get('change'),
            'spot_change_percent':  rt_data.get('change_percent'),
            'spot_source':          'yfinance (5-10 min delay)',
            'spot_timestamp':       rt_data.get('timestamp'),
            'spot_from_cache':      rt_data.get('from_cache', False),
            'options':              opcoes,
            'opcoes':               opcoes,
            'opcoes_source':        'OpLab (15-20 min delay)',
            'total_opcoes':         len(opcoes),
            'hybrid':               True,
            'recommendation':       'Use spot_price para cálculos em tempo real',
        })
    except Exception as e:
        try:
            return proxy_options(ticker)
        except Exception:
            return jsonify({'error': str(e)}), 500


# ─── Limpar cache ─────────────────────────────────────────────────────────────
@market_bp.route('/cache/clear')
def clear_cache():
    global _cache
    count  = len(_cache)
    _cache = {}
    return jsonify({'message': 'Cache limpo com sucesso', 'items_cleared': count})


# ─── Preço de crypto (Binance) ────────────────────────────────────────────────
@market_bp.route('/proxy/crypto/<ticker>')
def proxy_crypto(ticker):
    try:
        r = requests.get(
            f'https://api.binance.com/api/v3/ticker/price?symbol={ticker}',
            timeout=10,
            verify=False,  # Evita erro de certificado SSL em ambientes locais (Laragon)
        )
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Cotação de opção individual ─────────────────────────────────────────────
def _fetch_cotacao_opcao(symbol):
    headers = _oplab_headers()
    try:
        r = oplab_get(
            f'https://api.oplab.com.br/v3/market/stocks/{symbol}',
            headers=headers, timeout=10,
        )
        if r.status_code == 200:
            return jsonify(r.json())

        r2 = oplab_get(
            f'https://api.oplab.com.br/v3/market/options/details/{symbol}',
            headers=headers, timeout=10,
        )
        if r2.status_code == 200:
            d = r2.json()
            return jsonify(d[0] if isinstance(d, list) and d else d)

        # Fallback yfinance
        try:
            stock = yf.Ticker(f'{symbol}.SA')
            hist  = stock.history(period='1d', interval='1m')
            if not hist.empty:
                return jsonify({
                    'price':          float(hist['Close'].iloc[-1]),
                    'source':         'yfinance',
                    'delay_minutes':  '5-10',
                })
        except Exception:
            pass

        return jsonify({'error': 'Opção não encontrada'}), 404
    except Exception as e:
        try:
            stock = yf.Ticker(f'{symbol}.SA')
            hist  = stock.history(period='1d', interval='1m')
            if not hist.empty:
                return jsonify({
                    'price':          float(hist['Close'].iloc[-1]),
                    'source':         'yfinance',
                    'delay_minutes':  '5-10',
                })
        except Exception:
            pass
        return jsonify({'error': str(e)}), 500


@market_bp.route('/cotacao/opcoes')
def get_cotacao_opcao():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Symbol required'}), 400
    return _fetch_cotacao_opcao(symbol)


@market_bp.route('/cotacao/opcoes/<symbol>')
def get_cotacao_opcao_path(symbol):
    if not symbol:
        return jsonify({'error': 'Symbol required'}), 400
    return _fetch_cotacao_opcao(symbol)

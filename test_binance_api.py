"""
test_binance_api.py — Teste direto da API da Binance
Le as chaves do .env e testa os endpoints de saldo e Dual Investment.

Uso:
    python test_binance_api.py
"""
import os
import sys
import io
import time
import json
import hashlib
import hmac
import requests
from urllib.parse import urlencode
from datetime import datetime

# Forca UTF-8 no output (Windows)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Carrega .env
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', '.env')
def load_env(path):
    vars = {}
    with open(path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, val = line.split('=', 1)
                vars[key.strip()] = val.strip()
    return vars

env = load_env(ENV_PATH)
API_KEY = env.get('BINANCE_API_KEY', '')
SECRET = env.get('BINANCE_SECRET', '')

if not API_KEY or not SECRET:
    print("ERRO: Chaves BINANCE_API_KEY e BINANCE_SECRET não encontradas em .env")
    sys.exit(1)

print(f"API Key: {API_KEY[:8]}...{API_KEY[-4:]}")
print(f"Secret:  {SECRET[:4]}...{SECRET[-4:]}")
print("=" * 70)

BASE = 'https://api.binance.com'
HEADERS = {'X-MBX-APIKEY': API_KEY}

def sign(params):
    query = urlencode(params)
    sig = hmac.new(SECRET.encode(), query.encode(), hashlib.sha256).hexdigest()
    return query, sig

def signed_get(path, extra=None):
    params = {'timestamp': int(time.time() * 1000), 'recvWindow': 30000}
    if extra:
        params.update(extra)
    query, signature = sign(params)
    params['signature'] = signature
    return requests.get(f'{BASE}{path}', headers=HEADERS, params=params, timeout=15)

def signed_post(path, extra=None):
    params = {'timestamp': int(time.time() * 1000), 'recvWindow': 30000}
    if extra:
        params.update(extra)
    query, signature = sign(params)
    params['signature'] = signature
    return requests.post(f'{BASE}{path}', headers=HEADERS, data=params, timeout=15)

def test_section(title):
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print('=' * 70)

# ══════════════════════════════════════════════════════════════════════════════
# 1) TESTE DE CONEXÃO BÁSICA
# ══════════════════════════════════════════════════════════════════════════════
test_section("1. CONEXÃO - API pública (sem auth)")
try:
    r = requests.get(f'{BASE}/api/v3/ping', timeout=5)
    print(f"Status: {r.status_code} - {'OK' if r.status_code == 200 else 'FALHA'}")
except Exception as e:
    print(f"ERRO: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# 2) SALDO TOTAL (get-total-balance)
# ══════════════════════════════════════════════════════════════════════════════
test_section("2. SALDO TOTAL - /sapi/v1/asset/get-total-balance (POST)")
try:
    r = signed_post('/sapi/v1/asset/get-total-balance')
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"totalWalletBalance: {data.get('totalWalletBalance')}")
        print(f"totalMarginBalance: {data.get('totalMarginBalance')}")
        print(f"totalAvailableBalance: {data.get('totalAvailableBalance')}")
    else:
        print(f"Resposta: {r.text[:500]}")
except Exception as e:
    print(f"ERRO: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# 3) SALDO FUND VALUE
# ══════════════════════════════════════════════════════════════════════════════
test_section("3. SALDO FUND VALUE - /sapi/v1/asset/get-fund-value (POST)")
try:
    r = signed_post('/sapi/v1/asset/get-fund-value')
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(json.dumps(data, indent=2)[:1000])
    else:
        print(f"Resposta: {r.text[:500]}")
except Exception as e:
    print(f"ERRO: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# 4) SPOT ACCOUNT
# ══════════════════════════════════════════════════════════════════════════════
test_section("4. SPOT ACCOUNT - /api/v3/account")
try:
    r = signed_get('/api/v3/account')
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        balances = data.get('balances', [])
        non_zero = [b for b in balances if float(b.get('free', 0)) + float(b.get('locked', 0)) > 0]
        print(f"Total de ativos com saldo: {len(non_zero)}")
        for b in non_zero[:20]:
            free = float(b['free'])
            locked = float(b['locked'])
            total = free + locked
            print(f"  {b['asset']:10s}  free={free:.8f}  locked={locked:.8f}  total={total:.8f}")
    else:
        print(f"Resposta: {r.text[:500]}")
except Exception as e:
    print(f"ERRO: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# 5) SIMPLE EARN FLEXIBLE
# ══════════════════════════════════════════════════════════════════════════════
test_section("5. SIMPLE EARN FLEXIBLE - /sapi/v1/simple-earn/flexible/position")
try:
    r = signed_get('/sapi/v1/simple-earn/flexible/position')
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        rows = data.get('rows', [])
        print(f"Total posições: {len(rows)}")
        for row in rows[:20]:
            print(f"  {row.get('asset', '?'):10s}  totalAmount={row.get('totalAmount', 0)}  earnings={row.get('totalInterest', 0)}")
    else:
        print(f"Resposta: {r.text[:500]}")
except Exception as e:
    print(f"ERRO: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# 6) SIMPLE EARN LOCKED
# ══════════════════════════════════════════════════════════════════════════════
test_section("6. SIMPLE EARN LOCKED - /sapi/v1/simple-earn/locked/position")
try:
    r = signed_get('/sapi/v1/simple-earn/locked/position')
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        rows = data.get('rows', [])
        print(f"Total posições: {len(rows)}")
        for row in rows[:20]:
            print(f"  {row.get('asset', '?'):10s}  totalAmount={row.get('totalAmount', 0)}  productId={row.get('projectId', '')}")
    else:
        print(f"Resposta: {r.text[:500]}")
except Exception as e:
    print(f"ERRO: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# 7) FUNDING WALLET
# ══════════════════════════════════════════════════════════════════════════════
test_section("7. FUNDING WALLET - /sapi/v1/asset/get-funding-asset (POST)")
try:
    r = signed_post('/sapi/v1/asset/get-funding-asset')
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"Total ativos: {len(data)}")
        for row in data[:20]:
            free = float(row.get('free', 0))
            locked = float(row.get('locked', 0))
            print(f"  {row.get('asset', '?'):10s}  free={free:.8f}  locked={locked:.8f}")
    else:
        print(f"Resposta: {r.text[:500]}")
except Exception as e:
    print(f"ERRO: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# 8) DUAL INVESTMENT - MÚLTIPLOS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
test_section("8. DUAL INVESTMENT - Teste de múltiplos endpoints")

endpoints_di = [
    # endpoint CORRETO encontrado na documentacao Binance 2026
    ('GET', '/sapi/v1/dci/product/positions', {'status': 'HOLDING'}),
    ('GET', '/sapi/v1/dci/product/positions', {}),
    ('GET', '/sapi/v1/dci/product/positions', {'pageSize': 20, 'pageIndex': 1}),
    ('POST', '/sapi/v1/dci/product/positions', {'status': 'HOLDING'}),
    ('POST', '/sapi/v1/dci/product/positions', {}),
]

print(f"\n{'Metodo':<6} {'Endpoint':<50} {'Status':>6} {'Res':>4}  Notas")
print("-" * 110)

for method, endpoint, params in endpoints_di:
    try:
        if method == 'GET':
            r = signed_get(endpoint, params)
        else:
            r = signed_post(endpoint, params)
        
        status = r.status_code
        data = {}
        try:
            data = r.json() if status == 200 else {}
        except:
            pass
        
        rows = []
        if isinstance(data, dict):
            rows = data.get('rows', []) or data.get('list', []) or data.get('positionList', []) or data.get('data', [])
        elif isinstance(data, list):
            rows = data
        
        found = len(rows) if rows else 0
        note = ''
        if status == 200 and found > 0:
            note = f'OK! {found} posicoes'
        elif status == 404:
            note = 'nao existe'
        elif status == 403:
            note = 'sem permissao'
        elif status == 400:
            note = data.get('msg', data.get('message', ''))[:50]
        elif status == 451:
            note = 'IP bloqueado'
        
        print(f"{method:<6} {endpoint:<50} {status:>6} {found:>4}  {note}")
        
        if found > 0:
            for p in rows[:2]:
                print(f"       -> {json.dumps(p, ensure_ascii=False)[:200]}")
    except Exception as e:
        print(f"{method:<6} {endpoint:<50} {'ERR':>6}      {str(e)[:60]}")

# ══════════════════════════════════════════════════════════════════════════════
# 9) PREÇOS ATUAIS
# ══════════════════════════════════════════════════════════════════════════════
test_section("9. PREÇOS ATUAIS - /api/v3/ticker/price")
try:
    r = requests.get(f'{BASE}/api/v3/ticker/price', timeout=10)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        prices = r.json()
        targets = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'USDCUSDT']
        for p in prices:
            if p['symbol'] in targets:
                print(f"  {p['symbol']:12s} = US$ {float(p['price']):,.2f}")
except Exception as e:
    print(f"ERRO: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# 10) RESUMO DO SALDO CALCULADO
# ══════════════════════════════════════════════════════════════════════════════
test_section("10. RESUMO - Cálculo de Saldo Total")

prices = {}
try:
    r = requests.get(f'{BASE}/api/v3/ticker/price', timeout=10)
    if r.status_code == 200:
        for p in r.json():
            prices[p['symbol']] = float(p['price'])
except:
    pass

all_assets = {}

# Spot
try:
    r = signed_get('/api/v3/account')
    if r.status_code == 200:
        for b in r.json().get('balances', []):
            free = float(b.get('free', 0)) + float(b.get('locked', 0))
            if free > 0:
                all_assets[b['asset']] = all_assets.get(b['asset'], 0) + free
except:
    pass

# Earn Flexible
try:
    r = signed_get('/sapi/v1/simple-earn/flexible/position')
    if r.status_code == 200:
        for row in r.json().get('rows', []):
            amt = float(row.get('totalAmount', 0))
            if amt > 0:
                all_assets[row['asset']] = all_assets.get(row['asset'], 0) + amt
except:
    pass

# Earn Locked
try:
    r = signed_get('/sapi/v1/simple-earn/locked/position')
    if r.status_code == 200:
        for row in r.json().get('rows', []):
            amt = float(row.get('totalAmount', 0))
            if amt > 0:
                all_assets[row['asset']] = all_assets.get(row['asset'], 0) + amt
except:
    pass

# Funding
try:
    r = signed_get('/sapi/v1/asset/get-funding-asset')
    if r.status_code == 200:
        for row in r.json():
            amt = float(row.get('free', 0)) + float(row.get('locked', 0))
            if amt > 0:
                all_assets[row['asset']] = all_assets.get(row['asset'], 0) + amt
except:
    pass

total_usdt = 0
print(f"\n{'Ativo':<12} {'Quantidade':>20} {'Preco USDT':>15} {'Valor USDT':>15}")
print("-" * 65)
for asset, amount in sorted(all_assets.items()):
    if asset in ('USDT', 'USDC', 'BUSD', 'FDUSD'):
        valor = amount
        preco = 1.0
    elif f'{asset}USDT' in prices:
        preco = prices[f'{asset}USDT']
        valor = amount * preco
    else:
        continue
    total_usdt += valor
    print(f"{asset:<12} {amount:>20.8f} {preco:>15,.2f} {valor:>15,.2f}")

print("-" * 65)
print(f"{'TOTAL':.<12} {'':>20} {'':>15} {total_usdt:>15,.2f}")
print(f"\n>>> SALDO TOTAL EM USDT: US$ {total_usdt:,.2f}")

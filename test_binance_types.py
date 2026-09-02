import requests, json, time, os, hmac, hashlib
from urllib.parse import urlencode
from dotenv import load_dotenv
load_dotenv('backend/.env')
api_key = os.getenv('BINANCE_API_KEY', '')
secret = os.getenv('BINANCE_SECRET', '')

# Check SETTLED to see PUT examples
params = {'timestamp': int(time.time() * 1000), 'recvWindow': 30000, 'status': 'SETTLED', 'pageSize': 20, 'pageIndex': 1}
query = urlencode(params)
sig = hmac.new(secret.encode(), query.encode(), hashlib.sha256).hexdigest()
params['signature'] = sig
r = requests.get('https://api.binance.com/sapi/v1/dci/product/positions', headers={'X-MBX-APIKEY': api_key}, params=params, timeout=15)
data = r.json()
print(f'Total SETTLED: {data.get("total", 0)}')
print()

call_count = 0
put_count = 0
for p in data.get('list', []):
    ot = p.get('optionType', '')
    ic = p.get('investCoin', '')
    ec = p.get('exercisedCoin', '')
    if ot == 'CALL':
        call_count += 1
    elif ot == 'PUT':
        put_count += 1
        # Show first 5 PUT examples
        if put_count <= 5:
            sp = p.get('strikePrice', '')
            sa = p.get('subscriptionAmount', '')
            print(f'PUT | investCoin={ic} | exercisedCoin={ec} | strike={sp} | amount={sa}')

print(f'\nCALL count: {call_count}')
print(f'PUT count: {put_count}')

import requests, json

# 1. Test sync
r = requests.post('http://localhost:8888/api/crypto/dual-investment/sync')
d = r.json()
print('1. Sync:', d.get('success'), '- inserted:', d.get('inserted'), '- duplicated:', d.get('duplicated'))

# 2. Test get crypto
r = requests.get('http://localhost:8888/api/crypto')
d = r.json()
total = len(d)
premio = sum(float(o.get('premio_us',0) or 0) for o in d)
print(f'3. Crypto ops: {total}, Premio total: R$ {premio:.2f}')

# 4. Test stream (just check it starts)
r = requests.post('http://localhost:8888/api/crypto/dual-investment/stream', stream=True)
lines = []
for line in r.iter_lines():
    if line:
        lines.append(json.loads(line))
    if len(lines) >= 3:
        break
print('4. Stream first 3 events:')
for l in lines[:3]:
    evt = l.get('event', '?')
    coin = l.get('coin', '?')
    pct = l.get('pct', 0)
    print(f'   event={evt}: coin={coin} pct={pct}%')
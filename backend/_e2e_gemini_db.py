import os, sys, sqlite3
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import server
import db

base_conn = sqlite3.connect(':memory:', check_same_thread=False)
base_conn.row_factory = sqlite3.Row
proxy = type('P', (), {'_c': base_conn, 'close': lambda self: None,
    '__getattr__': lambda self, n: getattr(self._c, n)})()
def _get_test_db():
    return proxy
db.get_db = _get_test_db
db.DB_PATH = ':memory:'
db.init_db()

# copiar a chave real do banco para o DB de teste, como se estivesse configurada
import sqlite3 as sq
real = sq.connect(r'D:\Sistemas\python\ControleOperacoes\backend\data\controle_operacoes.db')
real.row_factory = sq.Row
row = real.execute("SELECT valor FROM configuracoes WHERE chave='gemini_key'").fetchone()
real.close()
proxy.execute("INSERT INTO configuracoes (chave, valor) VALUES ('gemini_key', ?)", (row['valor'],))
proxy.execute("INSERT INTO configuracoes (chave, valor) VALUES ('selected_ai', 'GEMINI')")
proxy.commit()

# REMOVE as chaves do ambiente para provar que le do banco
for k in list(os.environ):
    if k.endswith('_API_KEY'):
        os.environ.pop(k, None)

server.app.config.update({'TESTING': True})
c = server.app.test_client()
resp = c.post('/api/analyze', json={'messages': [{'role': 'user', 'content': 'Responda apenas com a palavra: OK'}]})
print('status:', resp.status_code)
print('resp:', resp.get_json())

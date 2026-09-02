import sqlite3
conn = sqlite3.connect('backend/data/controle_operacoes.db')
c = conn.cursor()
tables = c.execute('SELECT name FROM sqlite_master WHERE type="table"').fetchall()
print('Tables:', tables)
if tables:
    for t in tables:
        count = c.execute(f'SELECT COUNT(*) FROM {t[0]}').fetchone()[0]
        print(f'{t[0]}: {count} registros')
conn.close()
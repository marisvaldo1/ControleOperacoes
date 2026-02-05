import sqlite3

DB_PATH = r'd:\Sistemas\python\ControleOperacoesMiniMax\backend\data\controle_operacoes.db'

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Atualizar dados existentes
c.execute('UPDATE operacoes_opcoes SET ativo_base = "PETR4" WHERE ativo LIKE "PETR%"')
c.execute('UPDATE operacoes_opcoes SET ativo_base = "VALE3" WHERE ativo LIKE "VALE%"')

conn.commit()
conn.close()

print('Dados atualizados com sucesso!')

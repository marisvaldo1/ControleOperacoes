"""
Script de migração para adicionar campo tipo_operacao na tabela operacoes_opcoes
e atualizar todas as operações existentes como VENDA
"""
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data', 'controle_operacoes.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Verificar se a coluna já existe
    cols = [row[1] for row in c.execute('PRAGMA table_info(operacoes_opcoes)').fetchall()]
    
    if 'tipo_operacao' not in cols:
        print("Adicionando coluna tipo_operacao...")
        c.execute('ALTER TABLE operacoes_opcoes ADD COLUMN tipo_operacao TEXT DEFAULT "VENDA"')
        
        # Atualizar todas as operações existentes como VENDA
        c.execute('UPDATE operacoes_opcoes SET tipo_operacao = "VENDA" WHERE tipo_operacao IS NULL')
        
        conn.commit()
        print(f"✅ Coluna tipo_operacao adicionada com sucesso!")
        
        # Verificar quantidade de operações atualizadas
        count = c.execute('SELECT COUNT(*) FROM operacoes_opcoes').fetchone()[0]
        print(f"✅ {count} operações atualizadas como VENDA")
    else:
        print("ℹ️  Coluna tipo_operacao já existe")
    
    conn.close()

if __name__ == '__main__':
    migrate()

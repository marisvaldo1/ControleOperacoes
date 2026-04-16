"""
db.py — Utilitários de banco de dados compartilhados
Escopo: TODOS os módulos (opcoes, crypto, config, ai)

Responsabilidades:
  - Conexão SQLite
  - Inicialização das tabelas
  - Sem lógica de negócio
"""
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'data', 'controle_operacoes.db')


def get_db():
    """Retorna conexão SQLite com row_factory configurado."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """
    Cria/atualiza todas as tabelas do banco.
    Chamada uma única vez na inicialização do servidor.
    """
    conn = get_db()
    c    = conn.cursor()

    # ─── Tabela: operacoes_crypto ────────────────────────────────────────
    # Escopo: módulo crypto — Dual Investment, Opções Crypto, Spot, Hold, etc.
    c.execute('''CREATE TABLE IF NOT EXISTS operacoes_crypto (
        id                INTEGER  PRIMARY KEY AUTOINCREMENT,
        ativo             TEXT     NOT NULL,
        tipo              TEXT     NOT NULL,
        tipo_estrategia   TEXT     DEFAULT 'DUAL_INVESTMENT',
        cotacao_atual     REAL,
        abertura          REAL,
        tae               REAL,
        strike            REAL,
        distancia         REAL,
        prazo             INTEGER,
        crypto            REAL,
        premio_us         REAL,
        resultado         REAL,
        exercicio         TEXT,
        dias              INTEGER,
        exercicio_status  TEXT,
        status            TEXT     DEFAULT 'ABERTA',
        observacoes       TEXT,
        data_operacao     TEXT,
        created_at        TEXT     DEFAULT CURRENT_TIMESTAMP
    )''')

    # Migração: adiciona colunas que podem não existir em bases antigas
    _safe_add_columns(c, 'operacoes_crypto', {
        'tipo_estrategia': "TEXT DEFAULT 'DUAL_INVESTMENT'",
        'status':          "TEXT DEFAULT 'ABERTA'",
        'observacoes':     "TEXT",
        'is_test_data':    'INTEGER DEFAULT 0',
        'corretora':       "TEXT DEFAULT 'BINANCE'",
    })

    # ─── Tabela: operacoes_opcoes ────────────────────────────────────────
    # Escopo: módulo opcoes — Opções de B3 (CALL/PUT)
    c.execute('''CREATE TABLE IF NOT EXISTS operacoes_opcoes (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        ativo_base     TEXT,
        ativo          TEXT    NOT NULL,
        tipo           TEXT    NOT NULL,
        tipo_operacao  TEXT    DEFAULT 'VENDA',
        quantidade     INTEGER,
        preco_entrada  REAL,
        preco_atual    REAL,
        strike         REAL,
        vencimento     TEXT,
        premio         REAL,
        resultado      REAL,
        saldo_abertura REAL,
        status         TEXT,
        data_operacao  TEXT,
        created_at     TEXT    DEFAULT CURRENT_TIMESTAMP
    )''')

    _safe_add_columns(c, 'operacoes_opcoes', {
        'saldo_abertura': 'REAL',
        'tipo_operacao':  'TEXT DEFAULT "VENDA"',
        'observacoes':    'TEXT',
        'is_test_data':   'INTEGER DEFAULT 0',
    })
    # Garante que tipo_operacao nunca é NULL
    c.execute('UPDATE operacoes_opcoes SET tipo_operacao = "VENDA" WHERE tipo_operacao IS NULL')

    # ─── Tabela: configuracoes ───────────────────────────────────────────
    # Escopo: TODOS os módulos
    c.execute('''CREATE TABLE IF NOT EXISTS configuracoes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        chave      TEXT    UNIQUE NOT NULL,
        valor      TEXT,
        updated_at TEXT    DEFAULT CURRENT_TIMESTAMP
    )''')

    conn.commit()
    conn.close()


def _safe_add_columns(cursor, table: str, columns: dict):
    """Adiciona colunas a uma tabela existente sem erro se já existirem."""
    existing = {
        row['name']
        for row in cursor.execute(f'PRAGMA table_info({table})').fetchall()
    }
    for col, definition in columns.items():
        if col not in existing:
            cursor.execute(f'ALTER TABLE {table} ADD COLUMN {col} {definition}')

"""
Fixtures globais para os testes do Controle de Operações.

Estratégia:
- O banco de dados (SQLite) é completamente mockado após o import do server,
  evitando dependência de arquivo físico durante os testes.
- Esta aplicação NÃO possui autenticação — todas as rotas são acessíveis diretamente.
"""
import pytest
import os
import sys
from unittest.mock import MagicMock

# ─────────────────────────────────────────
# CONFIGURAR PATH
# ─────────────────────────────────────────
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Alterar diretório de trabalho para o backend
os.chdir(BACKEND_DIR)


# ─────────────────────────────────────────
# MOCK DO BANCO DE DADOS
# ─────────────────────────────────────────
def _build_mock_connection():
    """Cria um objeto mock que simula uma conexão SQLite."""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.lastrowid = 1
    cursor.fetchone.return_value = None
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    conn.execute.return_value = cursor
    conn.commit.return_value = None
    conn.close.return_value = None
    return conn


# Importar o app Flask (init_db roda na DB real uma única vez — sem impacto nos testes)
import server as _server_module

# Substituir get_db no módulo server pelo mock
_server_module.get_db = MagicMock(side_effect=_build_mock_connection)


@pytest.fixture(scope='session')
def app():
    """App Flask configurado para testes."""
    _server_module.app.config.update({'TESTING': True})
    yield _server_module.app


@pytest.fixture(scope='function')
def mock_db():
    """
    Fornece uma conexão mockada configurável por teste.

    Uso típico:
        mock_db.execute.return_value.fetchall.return_value = [{'id': 1, ...}]
        mock_db.execute.return_value.fetchone.return_value = {'id': 1, ...}
        mock_db.cursor.return_value.lastrowid = 5
    """
    db = _build_mock_connection()
    # Todas as chamadas a get_db() no escopo deste teste retornam o MESMO mock
    _server_module.get_db.side_effect = None
    _server_module.get_db.return_value = db
    yield db
    # Restaurar comportamento padrão após o teste
    _server_module.get_db.return_value = None
    _server_module.get_db.side_effect = _build_mock_connection


@pytest.fixture(scope='function')
def client(app, mock_db):
    """Test client Flask com banco mockado."""
    with app.test_client() as c:
        yield c

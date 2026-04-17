"""
Global backend fixtures without mocked DB connections.
"""
import os
import sys
import sqlite3
import pytest


BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

import db as _db_module  # noqa: E402
import server as _server_module  # noqa: E402


class _ConnectionProxy:
    """Proxy that keeps a shared in-memory SQLite connection alive during all tests."""

    def __init__(self, conn):
        self._conn = conn

    def close(self):
        # Routes call close() after each request. Keep shared DB alive for the session.
        return None

    def real_close(self):
        self._conn.close()

    def __getattr__(self, name):
        return getattr(self._conn, name)


@pytest.fixture(scope='session', autouse=True)
def _configure_test_db():
    """Use one real in-memory sqlite DB shared by all tests in this process."""
    base_conn = sqlite3.connect(':memory:', check_same_thread=False)
    base_conn.row_factory = sqlite3.Row
    proxy = _ConnectionProxy(base_conn)

    def _get_test_db():
        return proxy

    _db_module.get_db = _get_test_db
    _db_module.DB_PATH = ':memory:'
    _db_module.init_db()
    yield
    proxy.real_close()


@pytest.fixture(scope='session')
def app():
    _server_module.app.config.update({'TESTING': True})
    return _server_module.app


@pytest.fixture(scope='function')
def db_conn():
    yield _db_module.get_db()


@pytest.fixture(scope='function', autouse=True)
def _clean_db():
    """Guarantee test isolation by truncating tables before each test."""
    conn = _db_module.get_db()
    conn.execute('DELETE FROM operacoes_crypto')
    conn.execute('DELETE FROM operacoes_opcoes')
    conn.execute('DELETE FROM configuracoes')
    conn.commit()
    yield


@pytest.fixture(scope='function')
def client(app):
    with app.test_client() as c:
        yield c

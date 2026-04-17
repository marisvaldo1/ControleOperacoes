"""
Testes de Configuração - /api/config, /api/config-ia e /api/available-ais sem mock de banco.
"""
import os


def _set_config(db_conn, chave, valor):
    db_conn.execute(
        '''
        INSERT INTO configuracoes (chave, valor)
        VALUES (?, ?)
        ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor
        ''',
        (chave, valor),
    )
    db_conn.commit()


class TestGetConfig:
    def test_get_config_retorna_dict_vazio_padrao(self, client):
        resp = client.get('/api/config')
        assert resp.status_code == 200
        assert resp.get_json() == {}

    def test_get_config_retorna_chaves(self, client, db_conn):
        _set_config(db_conn, 'selected_ai', 'GEMINI')
        _set_config(db_conn, 'tema', 'dark')
        resp = client.get('/api/config')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('selected_ai') == 'GEMINI'
        assert data.get('tema') == 'dark'

    def test_get_config_retorna_formato_chave_valor(self, client, db_conn):
        _set_config(db_conn, 'k1', 'v1')
        resp = client.get('/api/config')
        assert isinstance(resp.get_json(), dict)


class TestSaveConfig:
    def test_salvar_config_retorna_sucesso(self, client):
        resp = client.post('/api/config', json={'selected_ai': 'GROK'})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_salvar_multiplas_chaves(self, client):
        resp = client.post('/api/config', json={
            'selected_ai': 'DEEPSEEK',
            'tema': 'light',
            'notificacoes': 'on',
        })
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_salvar_config_persiste_valor(self, client, db_conn):
        client.post('/api/config', json={'selected_ai': 'OPENAI'})
        row = db_conn.execute(
            'SELECT valor FROM configuracoes WHERE chave=?',
            ('selected_ai',),
        ).fetchone()
        assert row is not None
        assert row['valor'] == 'OPENAI'

    def test_salvar_config_payload_vazio(self, client):
        resp = client.post('/api/config', json={})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True


class TestSaveIAConfig:
    def test_salvar_ia_config_retorna_sucesso(self, client):
        resp = client.post('/api/config-ia', json={'selected_ai': 'GEMINI'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True
        assert data.get('selected_ai') == 'GEMINI'

    def test_salvar_ia_config_sem_selected_ai_retorna_400(self, client):
        resp = client.post('/api/config-ia', json={})
        assert resp.status_code == 400
        assert 'error' in resp.get_json()

    def test_salvar_ia_config_todos_provedores(self, client):
        for ai in ('OPENAI', 'DEEPSEEK', 'GROK', 'GEMINI', 'OPENROUTER'):
            resp = client.post('/api/config-ia', json={'selected_ai': ai})
            assert resp.status_code == 200, f'Falhou para {ai}'
            data = resp.get_json()
            assert data.get('success') is True
            assert data.get('selected_ai') == ai

    def test_salvar_ia_config_persiste_valor(self, client, db_conn):
        client.post('/api/config-ia', json={'selected_ai': 'OPENAI'})
        row = db_conn.execute(
            'SELECT valor FROM configuracoes WHERE chave=?',
            ('selected_ai',),
        ).fetchone()
        assert row is not None
        assert row['valor'] == 'OPENAI'


class TestAvailableAIs:
    def test_available_ais_retorna_estrutura_correta(self, client):
        resp = client.get('/api/available-ais')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'available' in data
        assert 'current' in data

    def test_available_ais_lista_vazia_sem_chaves(self, client):
        ai_envs = ('OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROK_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY')
        saved = {k: os.environ.pop(k, None) for k in ai_envs}
        try:
            resp = client.get('/api/available-ais')
            assert resp.status_code == 200
            data = resp.get_json()
            assert isinstance(data['available'], list)
            assert len(data['available']) == 0
        finally:
            for key, val in saved.items():
                if val:
                    os.environ[key] = val

    def test_available_ais_busca_ia_configurada(self, client, db_conn):
        _set_config(db_conn, 'selected_ai', 'DEEPSEEK')
        resp = client.get('/api/available-ais')
        assert resp.status_code == 200
        assert resp.get_json()['current'] == 'DEEPSEEK'


class TestVersion:
    def test_get_version_retorna_versao(self, client):
        resp = client.get('/api/version')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'version' in data
        assert isinstance(data['version'], str)
        assert len(data['version']) > 0

    def test_get_version_formato_valido(self, client):
        resp = client.get('/api/version')
        version = resp.get_json()['version']
        partes = version.split('.')
        assert len(partes) >= 2, f'Formato inválido: {version}'

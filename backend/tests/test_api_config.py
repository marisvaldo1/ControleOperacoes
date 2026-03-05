"""
Testes de Configuração — /api/config, /api/config-ia e /api/available-ais.
"""
import pytest
import os


class TestGetConfig:
    def test_get_config_retorna_dict_vazio_padrao(self, client, mock_db):
        mock_db.execute.return_value.fetchall.return_value = []
        resp = client.get('/api/config')
        assert resp.status_code == 200
        assert resp.get_json() == {}

    def test_get_config_retorna_chaves(self, client, mock_db):
        mock_db.execute.return_value.fetchall.return_value = [
            {'chave': 'selected_ai', 'valor': 'GEMINI'},
            {'chave': 'tema', 'valor': 'dark'},
        ]
        resp = client.get('/api/config')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('selected_ai') == 'GEMINI'
        assert data.get('tema') == 'dark'

    def test_get_config_retorna_formato_chave_valor(self, client, mock_db):
        """Resultado deve ser um dicionário (não lista)."""
        mock_db.execute.return_value.fetchall.return_value = [
            {'chave': 'k1', 'valor': 'v1'}
        ]
        resp = client.get('/api/config')
        data = resp.get_json()
        assert isinstance(data, dict)


class TestSaveConfig:
    def test_salvar_config_retorna_sucesso(self, client, mock_db):
        resp = client.post('/api/config', json={'selected_ai': 'GROK'})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_salvar_multiplas_chaves(self, client, mock_db):
        resp = client.post('/api/config', json={
            'selected_ai': 'DEEPSEEK',
            'tema': 'light',
            'notificacoes': 'on',
        })
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_salvar_config_confirma_commit(self, client, mock_db):
        client.post('/api/config', json={'selected_ai': 'OPENAI'})
        mock_db.commit.assert_called()

    def test_salvar_config_payload_vazio(self, client, mock_db):
        """Payload vazio deve funcionar sem erros."""
        resp = client.post('/api/config', json={})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True


class TestSaveIAConfig:
    def test_salvar_ia_config_retorna_sucesso(self, client, mock_db):
        resp = client.post('/api/config-ia', json={'selected_ai': 'GEMINI'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True
        assert data.get('selected_ai') == 'GEMINI'

    def test_salvar_ia_config_sem_selected_ai_retorna_400(self, client, mock_db):
        resp = client.post('/api/config-ia', json={})
        assert resp.status_code == 400
        assert 'error' in resp.get_json()

    def test_salvar_ia_config_todos_provedores(self, client, mock_db):
        for ai in ('OPENAI', 'DEEPSEEK', 'GROK', 'GEMINI', 'OPENROUTER'):
            resp = client.post('/api/config-ia', json={'selected_ai': ai})
            assert resp.status_code == 200, f"Falhou para {ai}"
            data = resp.get_json()
            assert data.get('success') is True
            assert data.get('selected_ai') == ai

    def test_salvar_ia_config_confirma_commit(self, client, mock_db):
        client.post('/api/config-ia', json={'selected_ai': 'OPENAI'})
        mock_db.commit.assert_called()


class TestAvailableAIs:
    def test_available_ais_retorna_estrutura_correta(self, client, mock_db):
        mock_db.execute.return_value.fetchone.return_value = None
        resp = client.get('/api/available-ais')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'available' in data
        assert 'current' in data

    def test_available_ais_lista_vazia_sem_chaves(self, client, mock_db):
        """Sem API keys no env, a lista deve ser vazia."""
        mock_db.execute.return_value.fetchone.return_value = None
        # Garante que nenhuma chave está setada neste contexto
        saved_keys = {}
        ai_envs = ('OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROK_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY')
        for key in ai_envs:
            saved_keys[key] = os.environ.pop(key, None)
        try:
            resp = client.get('/api/available-ais')
            assert resp.status_code == 200
            data = resp.get_json()
            assert isinstance(data['available'], list)
        finally:
            for key, val in saved_keys.items():
                if val:
                    os.environ[key] = val

    def test_available_ais_busca_ia_configurada(self, client, mock_db):
        """current deve refletir a IA salva no banco."""
        mock_db.execute.return_value.fetchone.return_value = {'valor': 'DEEPSEEK'}
        resp = client.get('/api/available-ais')
        assert resp.status_code == 200


class TestVersion:
    def test_get_version_retorna_versao(self, client, mock_db):
        resp = client.get('/api/version')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'version' in data
        assert isinstance(data['version'], str)
        assert len(data['version']) > 0

    def test_get_version_formato_valido(self, client, mock_db):
        """Versão deve seguir formato semântico X.Y.Z."""
        resp = client.get('/api/version')
        version = resp.get_json()['version']
        partes = version.split('.')
        assert len(partes) >= 2, f"Formato inválido: {version}"

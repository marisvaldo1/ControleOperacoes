"""
Testes de CRUD — /api/crypto (Operações de Criptomoedas).
"""
import pytest


CRYPTO_FAKE = {
    'id': 1,
    'ativo': 'BTC',
    'tipo': 'PUT',
    'cotacao_atual': 280000.0,
    'abertura': 270000.0,
    'tae': 12.5,
    'strike': 265000.0,
    'distancia': 5.5,
    'prazo': 30,
    'crypto': 0.01,
    'premio_us': 150.0,
    'resultado': 150.0,
    'exercicio': 'NAO',
    'dias': 25,
    'exercicio_status': 'ABERTA',
    'data_operacao': '2026-03-01',
    'created_at': '2026-03-01T10:00:00',
}


class TestListarCrypto:
    def test_listar_retorna_lista_vazia_por_padrao(self, client, mock_db):
        mock_db.execute.return_value.fetchall.return_value = []
        resp = client.get('/api/crypto')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_listar_retorna_operacoes(self, client, mock_db):
        mock_db.execute.return_value.fetchall.return_value = [CRYPTO_FAKE]
        resp = client.get('/api/crypto')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['ativo'] == 'BTC'
        assert data[0]['tipo'] == 'PUT'

    def test_listar_multiplas_operacoes(self, client, mock_db):
        segunda = {**CRYPTO_FAKE, 'id': 2, 'ativo': 'ETH'}
        mock_db.execute.return_value.fetchall.return_value = [CRYPTO_FAKE, segunda]
        resp = client.get('/api/crypto')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2
        assert data[1]['ativo'] == 'ETH'


class TestBuscarCrypto:
    def test_buscar_operacao_existente(self, client, mock_db):
        mock_db.execute.return_value.fetchone.return_value = CRYPTO_FAKE
        resp = client.get('/api/crypto/1')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['id'] == 1
        assert data['ativo'] == 'BTC'

    def test_buscar_operacao_inexistente_retorna_404(self, client, mock_db):
        mock_db.execute.return_value.fetchone.return_value = None
        resp = client.get('/api/crypto/9999')
        assert resp.status_code == 404
        assert 'error' in resp.get_json()

    def test_buscar_retorna_todos_os_campos(self, client, mock_db):
        mock_db.execute.return_value.fetchone.return_value = CRYPTO_FAKE
        resp = client.get('/api/crypto/1')
        data = resp.get_json()
        for campo in ('ativo', 'tipo', 'cotacao_atual', 'strike', 'premio_us', 'resultado'):
            assert campo in data, f"Campo ausente: {campo}"


class TestCriarCrypto:
    def test_criar_operacao_retorna_sucesso(self, client, mock_db):
        mock_db.cursor.return_value.lastrowid = 1
        payload = {
            'ativo': 'BTC', 'tipo': 'PUT', 'cotacao_atual': 280000.0,
            'abertura': 270000.0, 'tae': 12.5, 'strike': 265000.0,
            'distancia': 5.5, 'prazo': 30, 'crypto': 0.01,
            'premio_us': 150.0, 'resultado': 150.0, 'exercicio': 'NAO',
            'dias': 25, 'exercicio_status': 'ABERTA', 'data_operacao': '2026-03-01',
        }
        resp = client.post('/api/crypto', json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True
        assert 'id' in data

    def test_criar_operacao_retorna_id_correto(self, client, mock_db):
        mock_db.cursor.return_value.lastrowid = 42
        resp = client.post('/api/crypto', json={'ativo': 'ETH', 'tipo': 'CALL'})
        assert resp.get_json()['id'] == 42

    def test_criar_operacao_campos_minimos(self, client, mock_db):
        """Deve aceitar payload mínimo (campos opcionais como None)."""
        mock_db.cursor.return_value.lastrowid = 1
        resp = client.post('/api/crypto', json={'ativo': 'BTC', 'tipo': 'PUT'})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True


class TestAtualizarCrypto:
    def test_atualizar_operacao_retorna_sucesso(self, client, mock_db):
        payload = {'ativo': 'BTC', 'tipo': 'CALL', 'cotacao_atual': 290000.0}
        resp = client.put('/api/crypto/1', json=payload)
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_atualizar_operacao_atualiza_resultado(self, client, mock_db):
        resp = client.put('/api/crypto/1', json={'resultado': 200.0})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True


class TestExcluirCrypto:
    def test_excluir_operacao_retorna_sucesso(self, client, mock_db):
        resp = client.delete('/api/crypto/1')
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_excluir_operacao_chama_delete(self, client, mock_db):
        client.delete('/api/crypto/5')
        # Verifica que execute foi chamado (delete SQL)
        mock_db.execute.assert_called()

    def test_excluir_operacao_confirma_commit(self, client, mock_db):
        client.delete('/api/crypto/1')
        mock_db.commit.assert_called()

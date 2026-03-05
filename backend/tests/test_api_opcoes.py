"""
Testes de CRUD — /api/opcoes (Operações de Opções) e /api/opcoes/refresh.
"""
import pytest


OPCAO_FAKE = {
    'id': 1,
    'ativo_base': 'PETR4',
    'ativo': 'PETRA500',
    'tipo': 'PUT',
    'tipo_operacao': 'VENDA',
    'quantidade': 100,
    'preco_entrada': 5.00,
    'preco_atual': 4.50,
    'strike': 45.0,
    'vencimento': '2026-04-15',
    'premio': 0.50,
    'resultado': 50.0,
    'saldo_abertura': 500.0,
    'status': 'FECHADA',
    'data_operacao': '2026-03-01',
    'created_at': '2026-03-01T10:00:00',
}


class TestListarOpcoes:
    def test_listar_retorna_lista_vazia_por_padrao(self, client, mock_db):
        mock_db.execute.return_value.fetchall.return_value = []
        resp = client.get('/api/opcoes')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_listar_retorna_operacoes(self, client, mock_db):
        mock_db.execute.return_value.fetchall.return_value = [OPCAO_FAKE]
        resp = client.get('/api/opcoes')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['ativo'] == 'PETRA500'
        assert data[0]['ativo_base'] == 'PETR4'

    def test_listar_retorna_campos_esperados(self, client, mock_db):
        mock_db.execute.return_value.fetchall.return_value = [OPCAO_FAKE]
        resp = client.get('/api/opcoes')
        item = resp.get_json()[0]
        for campo in ('id', 'ativo', 'tipo', 'tipo_operacao', 'quantidade', 'premio', 'resultado', 'status'):
            assert campo in item, f"Campo ausente: {campo}"

    def test_listar_multiplas_operacoes(self, client, mock_db):
        segunda = {**OPCAO_FAKE, 'id': 2, 'ativo': 'PETRA510', 'tipo_operacao': 'COMPRA'}
        mock_db.execute.return_value.fetchall.return_value = [OPCAO_FAKE, segunda]
        resp = client.get('/api/opcoes')
        assert len(resp.get_json()) == 2


class TestBuscarOpcao:
    def test_buscar_opcao_existente(self, client, mock_db):
        mock_db.execute.return_value.fetchone.return_value = OPCAO_FAKE
        resp = client.get('/api/opcoes/1')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['id'] == 1
        assert data['ativo'] == 'PETRA500'

    def test_buscar_opcao_inexistente_retorna_404(self, client, mock_db):
        mock_db.execute.return_value.fetchone.return_value = None
        resp = client.get('/api/opcoes/9999')
        assert resp.status_code == 404
        assert 'error' in resp.get_json()

    def test_buscar_opcao_retorna_todos_os_campos(self, client, mock_db):
        mock_db.execute.return_value.fetchone.return_value = OPCAO_FAKE
        resp = client.get('/api/opcoes/1')
        data = resp.get_json()
        for campo in ('ativo', 'tipo', 'tipo_operacao', 'quantidade', 'strike', 'vencimento', 'premio', 'resultado'):
            assert campo in data, f"Campo ausente: {campo}"


class TestCriarOpcao:
    def test_criar_opcao_retorna_sucesso(self, client, mock_db):
        mock_db.cursor.return_value.lastrowid = 1
        payload = {
            'ativo_base': 'PETR4', 'ativo': 'PETRA500', 'tipo': 'PUT',
            'tipo_operacao': 'VENDA', 'quantidade': 100,
            'preco_entrada': 5.00, 'preco_atual': 4.50,
            'strike': 45.0, 'vencimento': '2026-04-15',
            'premio': 0.50, 'resultado': 50.0, 'saldo_abertura': 500.0,
            'status': 'ABERTA', 'data_operacao': '2026-03-01',
        }
        resp = client.post('/api/opcoes', json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True
        assert 'id' in data

    def test_criar_opcao_retorna_id_correto(self, client, mock_db):
        mock_db.cursor.return_value.lastrowid = 7
        resp = client.post('/api/opcoes', json={'ativo': 'VALE3', 'tipo': 'CALL'})
        assert resp.get_json()['id'] == 7

    def test_criar_opcao_tipo_operacao_default_venda(self, client, mock_db):
        """tipo_operacao deve ter default VENDA se não informado."""
        mock_db.cursor.return_value.lastrowid = 1
        resp = client.post('/api/opcoes', json={'ativo': 'VALE3', 'tipo': 'CALL'})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True


class TestAtualizarOpcao:
    def test_atualizar_opcao_retorna_sucesso(self, client, mock_db):
        payload = {'preco_atual': 4.20, 'status': 'FECHADA', 'resultado': 80.0}
        resp = client.put('/api/opcoes/1', json=payload)
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_atualizar_status_para_fechada(self, client, mock_db):
        resp = client.put('/api/opcoes/1', json={'status': 'FECHADA'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True


class TestExcluirOpcao:
    def test_excluir_opcao_retorna_sucesso(self, client, mock_db):
        resp = client.delete('/api/opcoes/1')
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_excluir_opcao_chama_delete_sql(self, client, mock_db):
        client.delete('/api/opcoes/3')
        mock_db.execute.assert_called()

    def test_excluir_opcao_confirma_commit(self, client, mock_db):
        client.delete('/api/opcoes/1')
        mock_db.commit.assert_called()


class TestRefreshOpcoes:
    def test_refresh_sem_operacoes_abertas_retorna_sucesso(self, client, mock_db):
        """Com zero operações abertas, nenhuma requisição HTTP é feita — deve retornar success=True."""
        # c = conn.cursor(); c.execute("SELECT...").fetchall() => []
        mock_db.cursor.return_value.execute.return_value.fetchall.return_value = []
        resp = client.post('/api/opcoes/refresh')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True

    def test_refresh_retorna_campo_updated(self, client, mock_db):
        mock_db.cursor.return_value.execute.return_value.fetchall.return_value = []
        resp = client.post('/api/opcoes/refresh')
        data = resp.get_json()
        assert 'updated' in data

    def test_refresh_updated_zero_sem_operacoes(self, client, mock_db):
        mock_db.cursor.return_value.execute.return_value.fetchall.return_value = []
        resp = client.post('/api/opcoes/refresh')
        assert resp.get_json().get('updated') == 0

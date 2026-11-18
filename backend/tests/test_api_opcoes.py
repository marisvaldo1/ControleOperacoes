"""
Testes de CRUD - /api/opcoes (operaÃ§Ãµes de opÃ§Ãµes) sem mocks de banco.
"""


def _insert_opcao(db_conn, **overrides):
    base = {
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
        'observacoes': 'teste',
        'is_test_data': 1,
    }
    base.update(overrides)

    c = db_conn.cursor()
    c.execute(
        '''
        INSERT INTO operacoes_opcoes
            (ativo_base, ativo, tipo, tipo_operacao, quantidade, preco_entrada,
             preco_atual, strike, vencimento, premio, resultado, saldo_abertura,
             status, data_operacao, observacoes, is_test_data)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''',
        (
            base['ativo_base'],
            base['ativo'],
            base['tipo'],
            base['tipo_operacao'],
            base['quantidade'],
            base['preco_entrada'],
            base['preco_atual'],
            base['strike'],
            base['vencimento'],
            base['premio'],
            base['resultado'],
            base['saldo_abertura'],
            base['status'],
            base['data_operacao'],
            base['observacoes'],
            base['is_test_data'],
        ),
    )
    db_conn.commit()
    return c.lastrowid


class TestListarOpcoes:
    def test_listar_retorna_lista_vazia_por_padrao(self, client):
        resp = client.get('/api/opcoes')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_listar_retorna_operacoes(self, client, db_conn):
        _insert_opcao(db_conn)
        resp = client.get('/api/opcoes')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['ativo'] == 'PETRA500'
        assert data[0]['ativo_base'] == 'PETR4'

    def test_listar_retorna_campos_esperados(self, client, db_conn):
        _insert_opcao(db_conn)
        item = client.get('/api/opcoes').get_json()[0]
        for campo in ('id', 'ativo', 'tipo', 'tipo_operacao', 'quantidade', 'premio', 'resultado', 'status'):
            assert campo in item

    def test_listar_multiplas_operacoes(self, client, db_conn):
        _insert_opcao(db_conn, ativo='PETRA500')
        _insert_opcao(db_conn, ativo='PETRA510', tipo_operacao='COMPRA')
        resp = client.get('/api/opcoes')
        assert len(resp.get_json()) == 2


class TestBuscarOpcao:
    def test_buscar_opcao_existente(self, client, db_conn):
        op_id = _insert_opcao(db_conn)
        resp = client.get(f'/api/opcoes/{op_id}')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['id'] == op_id
        assert data['ativo'] == 'PETRA500'

    def test_buscar_opcao_inexistente_retorna_404(self, client):
        resp = client.get('/api/opcoes/999999')
        assert resp.status_code == 404
        assert 'error' in resp.get_json()

    def test_buscar_opcao_retorna_todos_os_campos(self, client, db_conn):
        op_id = _insert_opcao(db_conn)
        data = client.get(f'/api/opcoes/{op_id}').get_json()
        for campo in ('ativo', 'tipo', 'tipo_operacao', 'quantidade', 'strike', 'vencimento', 'premio', 'resultado'):
            assert campo in data


class TestCriarOpcao:
    def test_criar_opcao_retorna_sucesso(self, client):
        payload = {
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
            'status': 'ABERTA',
            'data_operacao': '2026-03-01',
        }
        resp = client.post('/api/opcoes', json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True
        assert isinstance(data.get('id'), int)

    def test_criar_opcao_retorna_id_correto(self, client, db_conn):
        before = db_conn.execute('SELECT COUNT(*) AS c FROM operacoes_opcoes').fetchone()['c']
        resp = client.post('/api/opcoes', json={'ativo': 'VALE3', 'tipo': 'CALL'})
        assert isinstance(resp.get_json()['id'], int)
        after = db_conn.execute('SELECT COUNT(*) AS c FROM operacoes_opcoes').fetchone()['c']
        assert after == before + 1

    def test_criar_opcao_tipo_operacao_default_venda(self, client, db_conn):
        resp = client.post('/api/opcoes', json={'ativo': 'VALE3', 'tipo': 'CALL'})
        assert resp.status_code == 200
        op_id = resp.get_json()['id']
        row = db_conn.execute('SELECT tipo_operacao FROM operacoes_opcoes WHERE id=?', (op_id,)).fetchone()
        assert row['tipo_operacao'] == 'VENDA'


class TestAtualizarOpcao:
    def test_atualizar_opcao_retorna_sucesso(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA')
        payload = {
            'ativo': 'PETRA500',
            'tipo': 'PUT',
            'preco_atual': 4.20,
            'status': 'FECHADA',
            'resultado': 80.0,
        }
        resp = client.put(f'/api/opcoes/{op_id}', json=payload)
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_atualizar_status_para_fechada(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA')
        resp = client.put(
            f'/api/opcoes/{op_id}',
            json={'ativo': 'PETRA500', 'tipo': 'PUT', 'status': 'FECHADA'},
        )
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True


class TestExcluirOpcao:
    def test_excluir_opcao_retorna_sucesso(self, client, db_conn):
        op_id = _insert_opcao(db_conn)
        resp = client.delete(f'/api/opcoes/{op_id}')
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_excluir_opcao_remove_do_banco(self, client, db_conn):
        op_id = _insert_opcao(db_conn)
        client.delete(f'/api/opcoes/{op_id}')
        row = db_conn.execute('SELECT id FROM operacoes_opcoes WHERE id=?', (op_id,)).fetchone()
        assert row is None


class TestRefreshOpcoes:
    def test_refresh_sem_operacoes_abertas_retorna_sucesso(self, client):
        resp = client.post('/api/opcoes/refresh')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True

    def test_refresh_retorna_campo_updated(self, client):
        resp = client.post('/api/opcoes/refresh')
        assert 'updated' in resp.get_json()

    def test_refresh_updated_zero_sem_operacoes(self, client):
        resp = client.post('/api/opcoes/refresh')
        assert resp.get_json().get('updated') == 0


class TestFecharOpcao:
    def test_fechar_operacao_retorna_sucesso(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar', json={'status': 'FECHADA'})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_fechar_com_resultado_retorna_sucesso(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar', json={
            'status': 'EXERCIDA',
            'resultado': 150.0,
            'preco_atual': 4.75,
        })
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_fechar_sem_payload_usa_status_fechada(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar', json={})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_fechar_status_vencida(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar', json={'status': 'VENCIDA'})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True


class TestFecharAntecipado:
    """Fechamento antecipado: POST /api/opcoes/<id>/fechar-antecipado."""

    def _get(self, db_conn, op_id):
        row = db_conn.execute('SELECT * FROM operacoes_opcoes WHERE id=?', (op_id,)).fetchone()
        return dict(row) if row else None

    # â”€â”€ ValidaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_operacao_inexistente_retorna_404(self, client):
        resp = client.post('/api/opcoes/999999/fechar-antecipado', json={'valor': 1.0, 'quantidade': 1})
        assert resp.status_code == 404

    def test_operacao_fechada_retorna_400(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='FECHADA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado', json={'valor': 1.0, 'quantidade': 1})
        assert resp.status_code == 400
        assert 'ABERTA' in resp.get_json()['error']

    def test_valor_invalido_retorna_400(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado', json={'valor': 0, 'quantidade': 10})
        assert resp.status_code == 400

    def test_quantidade_zero_retorna_400(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado', json={'valor': 1.0, 'quantidade': 0})
        assert resp.status_code == 400

    def test_quantidade_maior_que_aberta_retorna_400(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100)
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado', json={'valor': 1.0, 'quantidade': 101})
        assert resp.status_code == 400

    # â”€â”€ Fechamento total (VENDA) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_fechamento_total_venda_retorna_sucesso(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100,
                              preco_entrada=0.50, premio=0.50, tipo_operacao='VENDA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado',
                           json={'valor': 0.20, 'quantidade': 100})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['parcial'] is False
        assert data['tipo_operacao'] == 'COMPRA'
        # (0.50 âˆ’ 0.20) Ã— 100 = +30
        assert round(data['resultado'], 2) == 30.0

    def test_fechamento_total_atualiza_banco(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100,
                              preco_entrada=0.50, premio=0.50, tipo_operacao='VENDA')
        client.post(f'/api/opcoes/{op_id}/fechar-antecipado',
                    json={'valor': 0.20, 'quantidade': 100})
        op = self._get(db_conn, op_id)
        assert op['status'] == 'FECHADA'
        assert op['preco_saida'] == 0.20
        assert op['preco_atual'] == 0.20
        assert op['data_fechamento'] is not None
        assert round(op['resultado'], 2) == 30.0
        assert 'Fechamento antecipado total' in op['observacoes']
        # Total: quantidade preservada, nenhum espelho criado
        assert op['quantidade'] == 100
        espelhos = db_conn.execute(
            'SELECT COUNT(*) FROM operacoes_opcoes WHERE op_fechamento=?', (op_id,)
        ).fetchone()[0]
        assert espelhos == 0

    def test_fechamento_total_compra_lucro(self, client, db_conn):
        # COMPRA a 0.50 vendida a 0.80 â†’ (0.80 âˆ’ 0.50) Ã— 100 = +30
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100,
                              preco_entrada=0.50, premio=0.50, tipo_operacao='COMPRA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado',
                           json={'valor': 0.80, 'quantidade': 100})
        data = resp.get_json()
        assert data['tipo_operacao'] == 'VENDA'
        assert round(data['resultado'], 2) == 30.0

    def test_fechamento_total_prejuizo_venda(self, client, db_conn):
        # VENDA a 0.50 recomprada a 0.80 â†’ (0.50 âˆ’ 0.80) Ã— 100 = âˆ’30
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100,
                              preco_entrada=0.50, premio=0.50, tipo_operacao='VENDA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado',
                           json={'valor': 0.80, 'quantidade': 100})
        assert resp.get_json()['resultado'] == -30.0

    # â”€â”€ Fechamento parcial (espelho) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_fechamento_parcial_mantem_aberta(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100,
                              preco_entrada=0.50, premio=0.50, tipo_operacao='VENDA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado',
                           json={'valor': 0.20, 'quantidade': 40})
        data = resp.get_json()
        assert data['parcial'] is True
        assert data['quantidade_restante'] == 60

        op = self._get(db_conn, op_id)
        assert op['status'] == 'ABERTA'
        assert op['quantidade'] == 60
        assert op['qtd_fechada'] == 40
        assert op['preco_saida'] is None

    def test_fechamento_parcial_cria_espelho(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100,
                              preco_entrada=0.50, premio=0.50, tipo_operacao='VENDA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado',
                           json={'valor': 0.20, 'quantidade': 40})
        espelho_id = resp.get_json()['espelho_id']
        assert espelho_id

        esp = self._get(db_conn, espelho_id)
        assert esp['status'] == 'FECHADA'
        assert esp['tipo_operacao'] == 'COMPRA'      # lado oposto
        assert esp['quantidade'] == 40
        assert esp['preco_entrada'] == 0.20
        assert esp['op_fechamento'] == op_id
        # (0.50 âˆ’ 0.20) Ã— 40 = +12
        assert round(esp['resultado'], 2) == 12.0
        assert esp['data_fechamento'] is not None

    def test_fechamento_parcial_compra_cria_espelho_venda(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100,
                              preco_entrada=0.50, premio=0.50, tipo_operacao='COMPRA')
        resp = client.post(f'/api/opcoes/{op_id}/fechar-antecipado',
                           json={'valor': 0.70, 'quantidade': 30})
        esp = self._get(db_conn, resp.get_json()['espelho_id'])
        assert esp['tipo_operacao'] == 'VENDA'
        # (0.70 âˆ’ 0.50) Ã— 30 = +6
        assert round(esp['resultado'], 2) == 6.0

    def test_fechamento_parcial_atualiza_resultado_esperado(self, client, db_conn):
        # VENDA ABERTA: resultado esperado = qtd_rest Ã— prÃªmio (convenÃ§Ã£o do form)
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100,
                              preco_entrada=0.50, premio=0.50, tipo_operacao='VENDA')
        client.post(f'/api/opcoes/{op_id}/fechar-antecipado',
                    json={'valor': 0.20, 'quantidade': 40})
        op = self._get(db_conn, op_id)
        assert op['resultado'] == 60 * 0.50  # 30.0

    def test_fechamento_parcial_soma_qtd_fechada(self, client, db_conn):
        op_id = _insert_opcao(db_conn, status='ABERTA', quantidade=100,
                              preco_entrada=0.50, premio=0.50, tipo_operacao='VENDA')
        client.post(f'/api/opcoes/{op_id}/fechar-antecipado', json={'valor': 0.20, 'quantidade': 30})
        client.post(f'/api/opcoes/{op_id}/fechar-antecipado', json={'valor': 0.30, 'quantidade': 20})
        op = self._get(db_conn, op_id)
        assert op['quantidade'] == 50
        assert op['qtd_fechada'] == 50
        assert op['status'] == 'ABERTA'

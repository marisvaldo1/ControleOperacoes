"""
Testes de CRUD - /api/crypto (operações de criptomoedas) sem mocks de banco.
"""


def _insert_crypto(db_conn, **overrides):
    base = {
        'ativo': 'BTC',
        'tipo': 'PUT',
        'tipo_estrategia': 'DUAL_INVESTMENT',
        'cotacao_atual': 280000.0,
        'abertura': 270000.0,
        'tae': 12.5,
        'strike': 265000.0,
        'distancia': 5.5,
        'prazo': 30,
        'crypto': 0.01,
        'premio_us': 150.0,
        'resultado': 150.0,
        'exercicio': '2026-03-31',
        'dias': 25,
        'exercicio_status': 'NAO',
        'status': 'ABERTA',
        'observacoes': 'teste',
        'data_operacao': '2026-03-01',
        'is_test_data': 1,
        'corretora': 'BINANCE',
    }
    base.update(overrides)

    c = db_conn.cursor()
    c.execute(
        '''
        INSERT INTO operacoes_crypto
            (ativo, tipo, tipo_estrategia, cotacao_atual, abertura, tae, strike,
             distancia, prazo, crypto, premio_us, resultado, exercicio, dias,
             exercicio_status, status, observacoes, data_operacao, is_test_data, corretora)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''',
        (
            base['ativo'],
            base['tipo'],
            base['tipo_estrategia'],
            base['cotacao_atual'],
            base['abertura'],
            base['tae'],
            base['strike'],
            base['distancia'],
            base['prazo'],
            base['crypto'],
            base['premio_us'],
            base['resultado'],
            base['exercicio'],
            base['dias'],
            base['exercicio_status'],
            base['status'],
            base['observacoes'],
            base['data_operacao'],
            base['is_test_data'],
            base['corretora'],
        ),
    )
    db_conn.commit()
    return c.lastrowid


class TestListarCrypto:
    def test_listar_retorna_lista_vazia_por_padrao(self, client):
        resp = client.get('/api/crypto')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_listar_retorna_operacoes(self, client, db_conn):
        _insert_crypto(db_conn, ativo='BTC', tipo='PUT')
        resp = client.get('/api/crypto')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['ativo'] == 'BTC'
        assert data[0]['tipo'] == 'PUT'

    def test_listar_aberta_calcula_exercicio_pela_cotacao_atual(self, client, db_conn):
        _insert_crypto(
            db_conn,
            tipo='PUT',
            status='ABERTA',
            exercicio='2099-12-31',
            cotacao_atual=72430.63,
            strike=72000.0,
            exercicio_status='NAO',
        )
        resp = client.get('/api/crypto')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data[0]['exercicio_status_atual'] == 'SIM'
        assert data[0]['exercicio_status_exibicao'] == 'SIM'
        assert data[0]['exercicio_status'] == 'SIM'

    def test_listar_multiplas_operacoes(self, client, db_conn):
        _insert_crypto(db_conn, ativo='BTC')
        _insert_crypto(db_conn, ativo='ETH', tipo='CALL')
        resp = client.get('/api/crypto')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2
        ativos = {d['ativo'] for d in data}
        assert ativos == {'BTC', 'ETH'}


class TestBuscarCrypto:
    def test_buscar_operacao_existente(self, client, db_conn):
        op_id = _insert_crypto(db_conn, ativo='BTC')
        resp = client.get(f'/api/crypto/{op_id}')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['id'] == op_id
        assert data['ativo'] == 'BTC'

    def test_buscar_operacao_inexistente_retorna_404(self, client):
        resp = client.get('/api/crypto/999999')
        assert resp.status_code == 404
        assert 'error' in resp.get_json()

    def test_buscar_retorna_todos_os_campos(self, client, db_conn):
        op_id = _insert_crypto(db_conn)
        resp = client.get(f'/api/crypto/{op_id}')
        data = resp.get_json()
        for campo in ('ativo', 'tipo', 'cotacao_atual', 'strike', 'premio_us', 'resultado'):
            assert campo in data

    def test_buscar_fechada_preserva_exercicio_status_persistido(self, client, db_conn):
        op_id = _insert_crypto(
            db_conn,
            status='FECHADA',
            tipo='CALL',
            cotacao_atual=75000.0,
            strike=74000.0,
            exercicio_status='NAO',
        )
        resp = client.get(f'/api/crypto/{op_id}')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['exercicio_status_persistido'] == 'NAO'
        assert data['exercicio_status'] == 'NAO'


class TestCriarCrypto:
    def test_criar_operacao_retorna_sucesso(self, client):
        payload = {
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
            'exercicio': '2026-03-31',
            'dias': 25,
            'exercicio_status': 'NAO',
            'data_operacao': '2026-03-01',
        }
        resp = client.post('/api/crypto', json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True
        assert isinstance(data.get('id'), int)

    def test_criar_operacao_retorna_id_correto(self, client, db_conn):
        before = db_conn.execute('SELECT COUNT(*) AS c FROM operacoes_crypto').fetchone()['c']
        resp = client.post('/api/crypto', json={'ativo': 'ETH', 'tipo': 'CALL'})
        assert resp.status_code == 200
        new_id = resp.get_json()['id']
        assert isinstance(new_id, int)
        after = db_conn.execute('SELECT COUNT(*) AS c FROM operacoes_crypto').fetchone()['c']
        assert after == before + 1

    def test_criar_operacao_campos_minimos(self, client):
        resp = client.post('/api/crypto', json={'ativo': 'BTC', 'tipo': 'PUT'})
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True


class TestAtualizarCrypto:
    def test_atualizar_operacao_retorna_sucesso(self, client, db_conn):
        op_id = _insert_crypto(db_conn, cotacao_atual=280000.0)
        payload = {'ativo': 'BTC', 'tipo': 'CALL', 'cotacao_atual': 290000.0}
        resp = client.put(f'/api/crypto/{op_id}', json=payload)
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_atualizar_operacao_atualiza_resultado(self, client, db_conn):
        op_id = _insert_crypto(db_conn, resultado=120.0)
        resp = client.put(
            f'/api/crypto/{op_id}',
            json={'ativo': 'BTC', 'tipo': 'PUT', 'resultado': 200.0},
        )
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True


class TestExcluirCrypto:
    def test_excluir_operacao_retorna_sucesso(self, client, db_conn):
        op_id = _insert_crypto(db_conn)
        resp = client.delete(f'/api/crypto/{op_id}')
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_excluir_operacao_remove_do_banco(self, client, db_conn):
        op_id = _insert_crypto(db_conn)
        client.delete(f'/api/crypto/{op_id}')
        row = db_conn.execute('SELECT id FROM operacoes_crypto WHERE id=?', (op_id,)).fetchone()
        assert row is None


class TestFecharCrypto:
    def test_fechar_operacao_existente_retorna_sucesso(self, client, db_conn):
        op_id = _insert_crypto(db_conn, status='ABERTA', tipo='CALL', abertura=75000.0, strike=74000.0)
        resp = client.patch(f'/api/crypto/{op_id}/fechar')
        assert resp.status_code == 200
        assert resp.get_json().get('success') is True

    def test_fechar_operacao_inexistente_retorna_404(self, client):
        resp = client.patch('/api/crypto/999999/fechar')
        assert resp.status_code == 404
        assert 'error' in resp.get_json()

    def test_fechar_operacao_atualiza_status_no_banco(self, client, db_conn):
        op_id = _insert_crypto(db_conn, status='ABERTA', tipo='CALL', abertura=75000.0, strike=74000.0)
        client.patch(f'/api/crypto/{op_id}/fechar')
        row = db_conn.execute('SELECT status FROM operacoes_crypto WHERE id=?', (op_id,)).fetchone()
        assert row['status'] == 'FECHADA'

    def test_fechar_put_com_status_persistido_nao_preserva_nao(self, client, db_conn):
        op_id = _insert_crypto(
            db_conn,
            status='ABERTA',
            tipo='PUT',
            abertura=72430.63,
            strike=72000.0,
            exercicio_status='NAO',
        )
        resp = client.patch(f'/api/crypto/{op_id}/fechar')
        assert resp.status_code == 200
        assert resp.get_json()['exercicio_status'] == 'NAO'

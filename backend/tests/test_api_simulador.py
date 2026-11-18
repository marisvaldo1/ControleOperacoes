"""
Testes do módulo simulador — /api/simulador (integração tastytrade).

Os testes de cálculo são puros; os testes de rede substituem `routes.simulador._tt_get`
por uma fake, de modo que nenhum teste faz chamada HTTP real (a suíte padrão
exclui o marcador `live_api`).
"""
import copy
import math
from datetime import date, timedelta

import pytest

import routes.simulador as sim


# ─── Cenário de referência usado na maioria dos testes de cálculo ────────────
PAGINA_BASE = {
    'acao_selecionada':      'SPY',
    'preco_referencia':      60.0,
    'tipo_operacao':         'PUT',
    'premio_diario_put':     1.0,
    'premio_diario_call':    0.9,
    'dias':                  5,
    'capital_referencia':    10000.0,
    'limite_acao':           36.0,
    'limite_lote':           3600.0,
    'risco_max_posicao_pct': 25.0,     # limite de posição = US$ 2.500 por lote
    'candidatos': [
        # apto nos dois cenários (pagadora de dividendos)
        {'simbolo': 'AAA', 'preco': 10.0, 'premio_semanal_put': 0.50,
         'premio_semanal_call': 0.60, 'dividendos': True, 'variacao_dia_pct': -1.0},
        # apto apenas no conservador (não paga dividendos)
        {'simbolo': 'BBB', 'preco': 20.0, 'premio_semanal_put': 0.90,
         'premio_semanal_call': 1.00, 'dividendos': False, 'variacao_dia_pct': 0.5},
        # fora: acima de 50% do preço da referência (30,00)
        {'simbolo': 'CCC', 'preco': 35.0, 'premio_semanal_put': 1.50,
         'premio_semanal_call': 1.60, 'dividendos': True, 'variacao_dia_pct': -2.0},
        # melhor rentabilidade diária do conservador, sem dividendos
        {'simbolo': 'DDD', 'preco': 15.0, 'premio_semanal_put': 0.90,
         'premio_semanal_call': 1.10, 'dividendos': False, 'variacao_dia_pct': -0.5},
        # fora: bloqueio por saldo (capital do lote 2.600 > 2.500)
        {'simbolo': 'EEE', 'preco': 26.0, 'premio_semanal_put': 0.80,
         'premio_semanal_call': 0.90, 'dividendos': True, 'variacao_dia_pct': 0.1},
    ],
}


def _payload(**trocas):
    pagina = copy.deepcopy(PAGINA_BASE)
    pagina.update(trocas)
    return pagina


def _por_simbolo(cenario, simbolo):
    return next(l for l in cenario['linhas'] if l['simbolo'] == simbolo)


def _fake_perfil(simbolo):
    """Substitui o yfinance nos testes — nenhum teste consulta a rede."""
    return {
        'empresa':   f'Empresa {simbolo}',
        'setor':     'Tecnologia',
        'atividade': 'Software',
        'perfil':    'Beta 1,00 · volatilidade moderada',
    }


# ─── Estado do módulo isolado entre testes ───────────────────────────────────
@pytest.fixture(autouse=True)
def _limpar_estado(monkeypatch):
    sim._cache.clear()
    sim._limpar_token()
    monkeypatch.delenv('TASTYTRADE_REFRESH_TOKEN', raising=False)
    # Nenhum teste consulta o yfinance de verdade (mesma regra da tastytrade)
    monkeypatch.setattr(sim, '_dados_perfil', _fake_perfil)
    yield
    sim._cache.clear()
    sim._limpar_token()


# ═════════════════════════════════════════════════════════════════════════════
# Cálculo puro
# ═════════════════════════════════════════════════════════════════════════════
class TestPremioDiarioEquivalente:
    def test_divide_premio_pelo_numero_de_dias(self):
        assert sim.premio_diario_equivalente(0.90, 5) == pytest.approx(0.18)

    def test_dias_zero_ou_negativo_retorna_none(self):
        assert sim.premio_diario_equivalente(0.90, 0) is None
        assert sim.premio_diario_equivalente(0.90, -3) is None

    def test_premio_ausente_retorna_none(self):
        assert sim.premio_diario_equivalente(None, 5) is None


class TestCalcularComparacao:
    def test_retorna_parametros_e_cenarios(self):
        res = sim.calcular_comparacao(_payload())
        assert set(res['cenarios']) == {'conservador', 'arrojado'}
        assert res['parametros']['premio_diario_referencia'] == 1.0
        assert res['parametros']['limite_posicao'] == 2500.0
        assert res['premissas']

    def test_erro_sem_preco_referencia(self):
        with pytest.raises(ValueError, match='preço atual da ação de referência'):
            sim.calcular_comparacao(_payload(preco_referencia=None))

    def test_erro_dias_invalido(self):
        with pytest.raises(ValueError, match='dias'):
            sim.calcular_comparacao(_payload(dias=0))

    def test_erro_tipo_operacao_invalido(self):
        with pytest.raises(ValueError, match='tipo_operacao'):
            sim.calcular_comparacao(_payload(tipo_operacao='FUTURE'))

    def test_conservador_exclui_acima_de_metade_da_referencia(self):
        cenario = sim.calcular_comparacao(_payload())['cenarios']['conservador']
        linha = _por_simbolo(cenario, 'CCC')
        assert linha['ate_metade_referencia'] is False
        assert linha['apto'] is False

    def test_conservador_exclui_bloqueio_por_saldo(self):
        cenario = sim.calcular_comparacao(_payload())['cenarios']['conservador']
        linha = _por_simbolo(cenario, 'EEE')
        assert linha['bloqueio_saldo'] is True
        assert linha['apto'] is False
        assert any('bloqueio por saldo' in m for m in linha['motivos'])

    def test_conservador_exclui_acima_do_limite_por_acao(self):
        pagina = _payload(limite_acao=8.0)
        cenario = sim.calcular_comparacao(pagina)['cenarios']['conservador']
        linha = _por_simbolo(cenario, 'AAA')
        assert linha['dentro_limite_acao'] is False
        assert linha['apto'] is False

    def test_conservador_exclui_acima_do_limite_por_lote(self):
        pagina = _payload(limite_lote=1000.0)
        cenario = sim.calcular_comparacao(pagina)['cenarios']['conservador']
        # capital do lote da AAA = 10 × 100 = 1.000 (nao passa quando o limite e 999)
        pagina = _payload(limite_lote=999.0)
        cenario = sim.calcular_comparacao(pagina)['cenarios']['conservador']
        linha = _por_simbolo(cenario, 'AAA')
        assert linha['dentro_limite_lote'] is False
        assert linha['apto'] is False

    def test_conservador_ranqueia_por_rentabilidade_diaria(self):
        cenario = sim.calcular_comparacao(_payload())['cenarios']['conservador']
        assert cenario['ranqueamento'] == ['DDD', 'AAA', 'BBB']
        assert cenario['melhor_acao']['simbolo'] == 'DDD'
        # DDD: 0,90 ÷ 5 = 0,18 sobre capital de 1.500 → 0,012% ao dia
        assert cenario['melhor_acao']['rentabilidade_diaria_pct'] == pytest.approx(0.012)

    def test_arrojado_exige_dividendos_e_usa_premio_de_call(self):
        cenario = sim.calcular_comparacao(_payload())['cenarios']['arrojado']
        assert cenario['exige_dividendos'] is True
        assert cenario['ranqueamento'] == ['AAA']
        # prêmio de call da AAA: 0,60 ÷ 5 = 0,12 (não usa o put de 0,50)
        assert _por_simbolo(cenario, 'AAA')['premio_semanal'] == pytest.approx(0.60)

    def test_arrojado_marca_nao_pagadora_como_inapta(self):
        cenario = sim.calcular_comparacao(_payload())['cenarios']['arrojado']
        linha = _por_simbolo(cenario, 'DDD')
        assert linha['apto'] is False
        assert any('pagadora de dividendos' in m for m in linha['motivos'])

    def test_recomendacao_swing_trade_quando_nao_paga_dividendos(self):
        cenario = sim.calcular_comparacao(_payload())['cenarios']['conservador']
        rec = cenario['recomendacao']
        assert rec['acao'] == 'DDD'
        assert rec['estrategia'] == 'SWING_TRADE'
        assert 'swing trade' in rec['motivo'].lower()
        assert 'queda' in rec['motivo'].lower()   # variação negativa no dia

    def test_recomendacao_buy_and_hold_quando_paga_dividendos(self):
        cenario = sim.calcular_comparacao(_payload())['cenarios']['arrojado']
        rec = cenario['recomendacao']
        assert rec['acao'] == 'AAA'
        assert rec['estrategia'] == 'BUY_AND_HOLD'
        assert 'buy and hold' in rec['motivo'].lower()

    def test_lucro_liberado_usa_multiplicador_de_100(self):
        res = sim.calcular_comparacao(_payload())
        conservador = res['cenarios']['conservador']
        # DDD 0,90 + AAA 0,50 + BBB 0,90 → 90 + 50 + 90 = 230
        assert conservador['lucro_liberado_total'] == pytest.approx(230.0)
        assert _por_simbolo(conservador, 'AAA')['lucro_liberado'] == pytest.approx(50.0)

    def test_candidato_sem_premio_fica_fora_do_ranking(self):
        pagina = _payload()
        pagina['candidatos'][0]['premio_semanal_put'] = None
        cenario = sim.calcular_comparacao(pagina)['cenarios']['conservador']
        assert 'AAA' not in cenario['ranqueamento']
        assert any('sem prêmio' in m for m in _por_simbolo(cenario, 'AAA')['motivos'])

    def test_diferenca_em_relacao_a_referencia(self):
        cenario = sim.calcular_comparacao(_payload())['cenarios']['conservador']
        linha = _por_simbolo(cenario, 'AAA')
        # equivalente 0,10 − referência 1,00 = −0,90 → −90%
        assert linha['premio_diario_equiv'] == pytest.approx(0.10)
        assert linha['diferenca_valor'] == pytest.approx(-0.90)
        assert linha['diferenca_pct'] == pytest.approx(-90.0)


# ═════════════════════════════════════════════════════════════════════════════
# Rotas
# ═════════════════════════════════════════════════════════════════════════════
class TestStatus:
    def test_status_sem_refresh_token(self, client, monkeypatch):
        monkeypatch.delenv('TASTYTRADE_REFRESH_TOKEN', raising=False)
        data = client.get('/api/simulador/status').get_json()
        assert data['success'] is True
        assert data['configurado'] is False
        assert data['tem_refresh_token'] is False
        assert data['premissas']
        assert data['limites']['limite_acao'] == 36.0
        assert data['limites']['limite_lote'] == 3600.0
        assert data['limites']['risco_max_posicao_pct'] == 25.0

    def test_status_com_refresh_token(self, client, monkeypatch):
        monkeypatch.setenv('TASTYTRADE_REFRESH_TOKEN', 'rt-teste')
        data = client.get('/api/simulador/status').get_json()
        assert data['configurado'] is True
        assert data['tem_refresh_token'] is True

    def test_status_nao_expoe_segredos(self, client, monkeypatch):
        monkeypatch.setenv('TASTYTRADE_REFRESH_TOKEN', 'rt-super-secreto')
        monkeypatch.setenv('TASTYTRADE_CLIENT_SECRET', 'cs-super-secreto')
        corpo = client.get('/api/simulador/status').get_data(as_text=True)
        assert 'rt-super-secreto' not in corpo
        assert 'cs-super-secreto' not in corpo
        assert '"client_secret"' not in corpo
        assert '"refresh_token"' not in corpo


class TestUniverso:
    def test_sem_refresh_token_retorna_erro_amigavel(self, client):
        resp = client.get('/api/simulador/universo?simbolos=SPY')
        assert resp.status_code == 400
        assert resp.get_json()['codigo'] == 'refresh_token_ausente'

    def test_filtra_por_limite_de_acao_e_lote(self, client, monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get(
            '/api/simulador/universo?max_preco=36&max_lote=3600&simbolos=SPY,QQQ,TLT'
        ).get_json()
        assert data['success'] is True
        assert data['total_considerados'] == 3
        simbolos = [i['simbolo'] for i in data['itens']]
        assert 'SPY' not in simbolos          # 600,00 > limite de ação
        assert simbolos == ['QQQ', 'TLT']
        assert data['itens'][0]['capital_lote'] == pytest.approx(1000.0)

    def test_traz_dividendos_e_variacao_do_dia(self, client, monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get(
            '/api/simulador/universo?max_preco=36&max_lote=3600&simbolos=QQQ,TLT'
        ).get_json()
        por_simbolo = {i['simbolo']: i for i in data['itens']}
        assert por_simbolo['QQQ']['dividendos']['paga'] is False
        assert por_simbolo['TLT']['dividendos']['paga'] is True
        assert por_simbolo['QQQ']['variacao_dia_pct'] == pytest.approx(-0.99)


class TestCadeia:
    def test_exige_simbolo(self, client):
        resp = client.get('/api/simulador/cadeia')
        assert resp.status_code == 400
        assert resp.get_json()['codigo'] == 'parametro_ausente'

    def test_retorna_expiracoes_e_premios_reais(self, client, monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get('/api/simulador/cadeia?simbolo=SPY&distancia_pct=5').get_json()
        assert data['success'] is True
        assert data['simbolo'] == 'SPY'
        assert data['preco'] == pytest.approx(600.0)
        assert data['variacao_dia_pct'] == pytest.approx(-0.5)
        assert data['dividendos']['paga'] is True

        assert len(data['expiracoes']) == 2
        tipos = sorted(e['tipo'] for e in data['expiracoes'])
        assert tipos == ['diario', 'semanal'] or tipos == ['diario', 'mensal']

        premios = data['premios']
        assert premios['premio_semanal_put'] == pytest.approx(1.10)
        assert premios['premio_diario_put'] == pytest.approx(1.10)
        assert premios['tem_vencimento_diario'] is True
        assert premios['dias_semanal'] >= 1

    def test_strike_escolhido_na_distancia_definida(self, client, monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get('/api/simulador/cadeia?simbolo=SPY&distancia_pct=5').get_json()
        # preço 600 → CALL alvo 630 e PUT alvo 570
        assert data['alvo_call'] == pytest.approx(630.0)
        assert data['alvo_put'] == pytest.approx(570.0)
        for exp in data['expiracoes']:
            assert exp['call']['strike'] == pytest.approx(630.0)
            assert exp['put']['strike'] == pytest.approx(570.0)
            assert exp['call']['premio'] == pytest.approx(1.10)


class TestPremios:
    def test_exige_simbolos(self, client):
        resp = client.get('/api/simulador/premios')
        assert resp.status_code == 400
        assert resp.get_json()['codigo'] == 'parametro_ausente'

    def test_retorna_resumo_para_varios_ativos(self, client, monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get('/api/simulador/premios?simbolos=SPY,QQQ&distancia_pct=5').get_json()
        assert data['success'] is True
        assert [i['simbolo'] for i in data['itens']] == ['SPY', 'QQQ']
        for item in data['itens']:
            assert item['premio_semanal_put'] == pytest.approx(1.10)
            assert item['premio_semanal_call'] == pytest.approx(1.10)
            assert item['premio_diario_put'] == pytest.approx(1.10)
            assert item['vencimento_semanal']
            assert item['vencimento_diario']

    def test_erro_no_ativo_nao_derruba_os_demais(self, client, monkeypatch):
        def _fake_com_erro(caminho, params=None, timeout=25):
            if 'SEMCADEIA' in str(caminho):
                raise sim.TastyError('sem_cadeia', 'Sem cadeia de opções.', 404)
            return _fake_tt_get(caminho, params, timeout)

        monkeypatch.setattr(sim, '_tt_get', _fake_com_erro)
        data = client.get('/api/simulador/premios?simbolos=SPY,SEMCADEIA').get_json()
        assert [i['simbolo'] for i in data['itens']] == ['SPY']
        assert data['erros'][0]['simbolo'] == 'SEMCADEIA'

    def test_todos_os_ativos_da_lote_recebem_premio(self, client, monkeypatch):
        """Regressão: nenhum ativo pode ficar sem prêmio por truncamento."""
        def _cadeia_larga(simbolo, n=30):
            expiracoes = []
            for i in range(n):
                dtv = date(2026, 11, 20) + timedelta(days=i)
                expiracoes.append({
                    'expiration-date': dtv.isoformat(),
                    'days-to-expiration': i,
                    'expiration-type': 'Weekly' if i % 2 else 'Regular',
                    'strikes': [{'strike-price': '8.20',
                                 'call': f'{simbolo:<6}{dtv.strftime("%y%m%d")}C00008200',
                                 'put':  f'{simbolo:<6}{dtv.strftime("%y%m%d")}P00008200'}],
                })
            return {'data': {'items': [{'root-symbol': simbolo,
                                        'expirations': expiracoes}]}}

        def _fake_larga(caminho, params=None, timeout=25):
            caminho = str(caminho)
            if caminho.startswith('/option-chains'):
                simbolo = caminho.split('/')[3].upper()
                return copy.deepcopy(_cadeia_larga(simbolo))
            if params and 'equity-option' in params:
                itens = [{'symbol': s, 'bid': '1.00', 'ask': '1.20'}
                         for s in params['equity-option'].split(',') if s]
                return {'data': {'items': itens}}
            return _fake_tt_get(caminho, params, timeout)

        monkeypatch.setattr(sim, '_tt_get', _fake_larga)
        data = client.get(
            '/api/simulador/premios?simbolos=SPY,QQQ,TLT,AAPL&distancia_pct=5').get_json()
        assert [i['simbolo'] for i in data['itens']] == ['SPY', 'QQQ', 'TLT', 'AAPL']
        for item in data['itens']:
            assert item['premio_semanal_put'] == pytest.approx(1.10), item['simbolo']
            assert item['vencimento_semanal'], item['simbolo']


class TestCompararRota:
    def test_calcula_cenarios(self, client):
        resp = client.post('/api/simulador/comparar', json=_payload())
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['cenarios']['conservador']['ranqueamento'] == ['DDD', 'AAA', 'BBB']
        assert data['cenarios']['arrojado']['ranqueamento'] == ['AAA']

    def test_payload_invalido_retorna_400(self, client):
        resp = client.post('/api/simulador/comparar', json={'candidatos': []})
        assert resp.status_code == 400
        assert resp.get_json()['codigo'] == 'payload_invalido'


# ═════════════════════════════════════════════════════════════════════════════
# Classificação dos vencimentos (expiration-type da tastytrade)
# ═════════════════════════════════════════════════════════════════════════════
def _strikes():
    return [{'strike-price': '8.20',
             'call': 'BB    261120C00008200',
             'put':  'BB    261120P00008200'}]


def _cadeia_com_tipos(vencimentos):
    """Monta uma cadeia aninhada com expiration-type explícito."""
    return {'data': {'items': [{'root-symbol': 'BB', 'expirations': [
        {'expiration-date': data,
         'days-to-expiration': dias,
         'expiration-type':   tipo,
         'option': _strikes()}
        for data, dias, tipo in vencimentos
    ]}]}}


class TestClassificacaoVencimentos:
    def test_expiration_type_da_api_define_o_ciclo(self):
        corpo = _cadeia_com_tipos([
            ('2026-11-20',  3, 'Regular'),
            ('2026-11-27', 10, 'Weekly'),
            ('2027-01-15', 59, 'Monthly'),
            ('2027-03-31', 134, 'Quarterly'),
            ('2027-04-14', 148, 'Daily'),
        ])
        expiracoes = sim._extrair_expiracoes(corpo)
        tipos = {e['data']: e['tipo'] for e in expiracoes}
        assert tipos['2026-11-20'] == 'regular'
        assert tipos['2026-11-27'] == 'semanal'
        assert tipos['2027-01-15'] == 'mensal'
        assert tipos['2027-03-31'] == 'trimestral'
        assert tipos['2027-04-14'] == 'diario'

    def test_vencimento_de_quinta_isolado_nao_e_diario(self):
        """Cadeia do BB: 24/12 e 31/12 são Weekly, não vencimentos diários."""
        corpo = _cadeia_com_tipos([
            ('2026-11-20',  3, 'Regular'),
            ('2026-11-27', 10, 'Weekly'),
            ('2026-12-24', 37, 'Weekly'),
            ('2026-12-31', 44, 'Weekly'),
            ('2027-06-17', 212, 'Regular'),
        ])
        expiracoes = sim._extrair_expiracoes(corpo)
        tipos = {e['data']: e['tipo'] for e in expiracoes}
        assert tipos['2026-12-24'] == 'semanal'
        assert tipos['2026-12-31'] == 'semanal'
        assert tipos['2027-06-17'] == 'regular'
        assert not any(e['tipo'] == 'diario' for e in expiracoes)

    def test_serie_de_dias_consecutivos_marca_diarios(self):
        """SPY/QQQ: série seg-ter-qua = vencimentos diários."""
        corpo = _cadeia_com_tipos([
            ('2026-11-16', 1, 'Weekly'),
            ('2026-11-17', 2, 'Weekly'),
            ('2026-11-18', 3, 'Weekly'),
            ('2026-11-20', 5, 'Regular'),
            ('2026-11-27', 12, 'Weekly'),
        ])
        expiracoes = sim._extrair_expiracoes(corpo)
        tipos = {e['data']: e['tipo'] for e in expiracoes}
        assert tipos['2026-11-16'] == 'diario'
        assert tipos['2026-11-17'] == 'diario'
        assert tipos['2026-11-18'] == 'diario'
        assert tipos['2026-11-20'] == 'regular'
        assert tipos['2026-11-27'] == 'semanal'

    def test_sexta_e_sabado_nunca_sao_diarios(self):
        corpo = _cadeia_com_tipos([
            ('2026-11-19', 2, 'Weekly'),      # quinta
            ('2026-11-20', 3, 'Weekly'),      # sexta
            ('2026-11-21', 4, 'Weekly'),      # sábado
        ])
        expiracoes = sim._extrair_expiracoes(corpo)
        tipos = {e['data']: e['tipo'] for e in expiracoes}
        assert tipos['2026-11-19'] == 'diario'
        assert tipos['2026-11-20'] == 'semanal'
        assert tipos['2026-11-21'] == 'semanal'

    def test_resumo_usa_weekly_da_api_como_vencimento_semanal(self):
        expiracoes = sim._extrair_expiracoes(_cadeia_com_tipos([
            ('2026-11-20',  3, 'Regular'),
            ('2026-11-27', 10, 'Weekly'),
            ('2026-12-24', 37, 'Weekly'),
        ]))
        analise = {'expiracoes': expiracoes}
        resumo = sim._resumo_premios(analise)
        assert resumo['vencimento_semanal'] == '2026-11-27'
        assert resumo['dias_semanal'] == 10
        assert resumo['vencimento_diario'] is None
        assert resumo['tem_vencimento_diario'] is False

    def test_resumo_pega_o_diario_mais_proximo(self):
        expiracoes = sim._extrair_expiracoes(_cadeia_com_tipos([
            ('2026-11-16', 1, 'Weekly'),
            ('2026-11-17', 2, 'Weekly'),
            ('2026-11-27', 12, 'Weekly'),
        ]))
        resumo = sim._resumo_premios({'expiracoes': expiracoes})
        assert resumo['vencimento_diario'] == '2026-11-16'
        assert resumo['dias_diario'] == 1
        assert resumo['tem_vencimento_diario'] is True

    def test_sem_expiration_type_usa_heuristica_por_dia(self):
        assert sim._classificar_vencimento(date(2026, 11, 16)) == 'diario'   # segunda
        assert sim._classificar_vencimento(date(2026, 11, 27)) == 'semanal'  # sexta
        assert sim._classificar_vencimento(date(2026, 11, 20)) == 'mensal'   # 3ª sexta
        assert sim._classificar_vencimento(date(2026, 11, 20), 'Weekly') == 'semanal'


class TestCadeiaNested:
    """O endpoint /option-chains/nested nomeia as opções em 'call'/'put'."""

    def _cadeia_nested(self):
        return {'data': {'items': [{'root-symbol': 'BB', 'expirations': [
            {'expiration-date': '2026-11-20', 'days-to-expiration': 3,
             'expiration-type': 'Regular',
             'strikes': [{'strike-price': '8.20',
                          'call': 'BB    261120C00008200',
                          'put':  'BB    261120P00008200'}]},
        ]}]}}

    def test_le_o_simbolo_oc_no_formato_nested(self):
        expiracoes = sim._extrair_expiracoes(self._cadeia_nested())
        assert len(expiracoes) == 1
        strike = expiracoes[0]['strikes'][0]
        assert strike['strike'] == pytest.approx(8.20)
        assert strike['call'] == 'BB    261120C00008200'
        assert strike['put'] == 'BB    261120P00008200'

    def test_gera_alvos_de_cotacao_no_formato_nested(self):
        expiracoes = sim._extrair_expiracoes(self._cadeia_nested())
        alvos = sim._simbolos_opcao_para_cotar(expiracoes, 8.20, 5)
        assert len(alvos) == 2
        assert {a['simbolo'] for a in alvos} == {
            'BB    261120C00008200', 'BB    261120P00008200'}

    def test_cadeia_nested_gera_premios_na_rota(self, client, monkeypatch):
        def _fake_nested(caminho, params=None, timeout=25):
            if str(caminho).startswith('/option-chains'):
                return copy.deepcopy(self._cadeia_nested())
            return _fake_tt_get(caminho, params, timeout)

        monkeypatch.setattr(sim, '_tt_get', _fake_nested)
        data = client.get('/api/simulador/cadeia?simbolo=BB&distancia_pct=5').get_json()
        assert data['success'] is True
        exp = data['expiracoes'][0]
        assert exp['call']['premio'] == pytest.approx(1.10)
        assert exp['put']['premio'] == pytest.approx(1.10)
        assert data['premios']['premio_semanal_call'] == pytest.approx(1.10)


# ═════════════════════════════════════════════════════════════════════════════
# Fake da API tastytrade (nenhuma chamada HTTP real nos testes)
# ═════════════════════════════════════════════════════════════════════════════
COTACOES = {
    'SPY': {'symbol': 'SPY', 'mid': '600.00', 'prev-close': '603.00',
            'dividend-amount': '0.50', 'dividend-frequency': 'quarterly'},
    'QQQ': {'symbol': 'QQQ', 'mid': '10.00', 'prev-close': '10.10',
            'dividend-amount': '0', 'dividend-frequency': None},
    'TLT': {'symbol': 'TLT', 'mid': '10.00', 'prev-close': '10.10',
            'dividend-amount': '0.30', 'dividend-frequency': 'monthly'},
}


def _cotacao_padrao(simbolo):
    return {'symbol': simbolo, 'mid': '10.00', 'prev-close': '10.10',
            'dividend-amount': '0'}


def _occ(root, dtv, tipo, strike):
    return f"{root:<6}{dtv.strftime('%y%m%d')}{tipo}{int(round(strike * 1000)):08d}"


def _segunda():
    d = date.today() + timedelta(days=1)
    while d.weekday() != 0:
        d += timedelta(days=1)
    return d


def _proxima_sexta():
    d = date.today() + timedelta(days=1)
    while d.weekday() != 4:
        d += timedelta(days=1)
    return d


def _cadeia_teste():
    seg, sex = _segunda(), _proxima_sexta()
    strikes = [{'strike-price': '570',
                'call-symbol': _occ('SPY', seg, 'C', 570),
                'put-symbol':  _occ('SPY', seg, 'P', 570)},
               {'strike-price': '630',
                'call-symbol': _occ('SPY', seg, 'C', 630),
                'put-symbol':  _occ('SPY', seg, 'P', 630)}]
    strikes_sex = [{'strike-price': '570',
                    'call-symbol': _occ('SPY', sex, 'C', 570),
                    'put-symbol':  _occ('SPY', sex, 'P', 570)},
                   {'strike-price': '630',
                    'call-symbol': _occ('SPY', sex, 'C', 630),
                    'put-symbol':  _occ('SPY', sex, 'P', 630)}]
    return {'data': {'items': [{'root-symbol': 'SPY', 'expirations': [
        {'expiration-date': seg.isoformat(),
         'days-to-expiration': (seg - date.today()).days,
         'option': strikes},
        {'expiration-date': sex.isoformat(),
         'days-to-expiration': (sex - date.today()).days,
         'option': strikes_sex},
    ]}]}}


# ═════════════════════════════════════════════════════════════════════════════
# Cálculo financeiro (Black-Scholes, IV implícita e métricas de strike)
# ═════════════════════════════════════════════════════════════════════════════
class TestCalculoFinanceiro:
    def test_norm_cdf_simetrica(self):
        assert sim._norm_cdf(0) == pytest.approx(0.5, abs=1e-6)
        assert sim._norm_cdf(1.96) == pytest.approx(0.975, abs=0.005)
        assert sim._norm_cdf(-1.96) == pytest.approx(0.025, abs=0.005)

    def test_black_scholes_parity_put_call(self):
        # C − P = S − K·e^(−rT)
        spot, strike, dias, iv = 100.0, 100.0, 30, 0.25
        put  = sim._black_scholes('PUT',  spot, strike, dias, iv)
        call = sim._black_scholes('CALL', spot, strike, dias, iv)
        df = math.exp(-sim.TAXA_LIVRE_RISCO * dias / sim.DIAS_PREGAO_ANO)
        assert call['preco'] - put['preco'] == pytest.approx(
            spot - strike * df, rel=1e-4, abs=1e-4)

    def test_black_scholes_delta_e_pop(self):
        # PUT OTM: spot ACIMA do strike (vende a 100, mercado a 105)
        put_otm  = sim._black_scholes('PUT',  105.0, 100.0, 30, 0.30)
        # CALL OTM: spot ABAIXO do strike (compra a 100, mercado a 95)
        call_otm = sim._black_scholes('CALL', 95.0, 100.0, 30, 0.30)

        assert -1.0 <= put_otm['delta'] <= 0.0
        assert 0.0 <= call_otm['delta'] <= 1.0
        # As duas estão fora do dinheiro → probabilidade de exercício < 50%
        assert put_otm['pop'] < 0.5
        assert call_otm['pop'] < 0.5

        # Quanto mais OTM (spot mais acima do strike), menor a PoP da PUT
        put_mais_otm = sim._black_scholes('PUT', 110.0, 100.0, 30, 0.30)
        assert put_mais_otm['pop'] < put_otm['pop']

    def test_black_scholes_vencimento_sem_dias(self):
        put = sim._black_scholes('PUT', 90.0, 100.0, 0, 0.30)
        assert put['preco'] == pytest.approx(10.0)   # valor intrínseco
        assert put['delta'] == -1.0
        assert put['pop'] == 1.0

        call = sim._black_scholes('CALL', 110.0, 100.0, 0, 0.30)
        assert call['preco'] == pytest.approx(10.0)
        assert call['delta'] == 1.0

    def test_black_scholes_parametros_invalidos(self):
        r = sim._black_scholes('PUT', 0, 100, 30, 0.3)
        assert r['preco'] is None and r['delta'] is None and r['pop'] is None

    def test_iv_implicita_round_trip(self):
        # Preço gerado por uma IV conhecida → a biseção recupera a IV
        spot, strike, dias, iv_real = 100.0, 95.0, 30, 0.42
        preco = sim._black_scholes('PUT', spot, strike, dias, iv_real)['preco']
        iv = sim._iv_implicita('PUT', spot, strike, dias, preco)
        assert iv == pytest.approx(iv_real, abs=0.005)

    def test_iv_implicita_sem_premio(self):
        assert sim._iv_implicita('PUT', 100, 95, 30, None) is None
        assert sim._iv_implicita('PUT', 100, 95, 30, 0) is None
        assert sim._iv_implicita('PUT', 100, 95, 0, 1.5) is None
        assert sim._iv_implicita('PUT', 0, 95, 30, 1.5) is None

    def test_iv_implicita_limites_da_faixa(self):
        # Prêmio acima do máximo teórico → topo da faixa
        assert sim._iv_implicita('PUT', 100, 100, 30, 999.0) == sim.IV_MAX
        # Prêmio abaixo do mínimo teórico → piso da faixa
        assert sim._iv_implicita('PUT', 100, 150, 30, 0.001) == sim.IV_MIN

    def test_calcular_strikes_metricas_put(self):
        linhas = [
            {'strike': 95.0,
             'call': {'bid': 6.0, 'ask': 6.4, 'premio': 6.2},
             'put':  {'bid': 1.0, 'ask': 1.2, 'premio': 1.1}},
            {'strike': 90.0,
             'call': {'bid': None, 'ask': None, 'premio': None},
             'put':  {'bid': None, 'ask': None, 'premio': None}},
        ]
        saida = sim.calcular_strikes(100.0, linhas, 'PUT', 30, 50.0,
                                     fill='mid', contratos=1, comissao=1.0)
        assert len(saida) == 2

        a = saida[0]
        assert a['strike'] == 95.0
        assert a['otm'] is True
        assert a['dist'] == pytest.approx(5.0, abs=0.01)
        assert a['premio'] == pytest.approx(1.1)
        assert a['breakeven'] == pytest.approx(93.9)        # K − prêmio
        assert a['capital'] == pytest.approx(9500.0)         # K × 100
        assert a['premio_liquido'] == pytest.approx(110.0 - 1.0)
        assert a['roc'] == pytest.approx(109.0 / 9500.0, rel=1e-4)
        assert a['anualizado'] == pytest.approx(a['roc'] * 252 / 30, rel=1e-4)
        assert a['delta'] is not None and -1.0 <= a['delta'] <= 0.0
        assert a['pop'] is not None and 0.0 <= a['pop'] <= 1.0
        assert a['iv'] is not None and a['iv'] > 0

        # Strike sem cotação não gera IV nem delta
        b = saida[1]
        assert b['premio'] is None and b['iv'] is None and b['delta'] is None
        assert b['roc'] is None and b['anualizado'] is None

    def test_calcular_strikes_otm_por_lado(self):
        linhas = [{'strike': 105.0,
                   'call': {'bid': 2.0, 'ask': 2.2, 'premio': 2.1},
                   'put':  {'bid': 0.1, 'ask': 0.2, 'premio': 0.15}}]
        call = sim.calcular_strikes(100.0, linhas, 'CALL', 30, 50.0)[0]
        assert call['otm'] is True            # strike acima do spot
        assert call['breakeven'] == pytest.approx(107.1)   # K + prêmio

        # O mesmo strike é ITM para PUT → não é candidato à venda OTM
        put = sim.calcular_strikes(100.0, linhas, 'PUT', 30, 50.0)[0]
        assert put['otm'] is False

    def test_calcular_strikes_fill_bid_e_mid(self):
        linhas = [{'strike': 95.0,
                   'call': {'bid': 6.0, 'ask': 6.4, 'premio': 6.2},
                   'put':  {'bid': 1.0, 'ask': 1.2, 'premio': 1.1}}]
        mid = sim.calcular_strikes(100.0, linhas, 'PUT', 30, 50.0, fill='mid')[0]
        bid = sim.calcular_strikes(100.0, linhas, 'PUT', 30, 50.0, fill='bid')[0]
        assert mid['premio'] == pytest.approx(1.1)
        assert bid['premio'] == pytest.approx(1.0)

    def test_calcular_strikes_hv_altera_ev(self):
        # HV maior → valor justo maior (opção teoricamente mais cara) →
        # o edge (prêmio − fair) encolhe e o EV cai
        linhas = [{'strike': 95.0,
                   'call': {'bid': 6.0, 'ask': 6.4, 'premio': 6.2},
                   'put':  {'bid': 1.0, 'ask': 1.2, 'premio': 1.1}}]
        baixa = sim.calcular_strikes(100.0, linhas, 'PUT', 30, 20.0)[0]
        alta  = sim.calcular_strikes(100.0, linhas, 'PUT', 30, 80.0)[0]
        assert alta['fair'] > baixa['fair']
        assert alta['ev'] < baixa['ev']

    def test_calcular_strikes_pop_lucro_no_break_even(self):
        # chance de lucro = 1 − prob. de exercício calculada no break-even
        linhas = [{'strike': 95.0, 'put': {'bid': 1.0, 'ask': 1.2, 'premio': 1.1}}]
        r = sim.calcular_strikes(100.0, linhas, 'PUT', 30, 50.0)[0]
        assert r['pop_lucro'] is not None
        assert 0.0 < r['pop_lucro'] < 1.0
        # PUT OTM: break-even (93,9) abaixo da cotação → mais da metade das
        # distribuições termina acima dele
        assert r['pop_lucro'] > 0.5
        no_be = sim._black_scholes('PUT', 100.0, r['breakeven'], 30, r['iv'])
        assert r['pop_lucro'] == pytest.approx(1 - no_be['pop'], abs=1e-3)

    def test_calcular_strikes_pop_lucro_sem_dados_fica_none(self):
        linhas = [{'strike': 95.0, 'put': {'bid': None, 'ask': None, 'premio': None}}]
        r = sim.calcular_strikes(100.0, linhas, 'PUT', 30, 50.0)[0]
        assert r['pop_lucro'] is None


# ═════════════════════════════════════════════════════════════════════════════
# Vencimento por DTE, zonas dos strikes e identificação do ativo (yfinance)
# ═════════════════════════════════════════════════════════════════════════════
class TestVencimentoParaDte:
    def _expiracoes(self):
        return [
            {'data': '2026-11-18', 'dias': 0,  'tipo': 'diario',   'strikes': []},
            {'data': '2026-11-19', 'dias': 1,  'tipo': 'diario',   'strikes': []},
            {'data': '2026-11-20', 'dias': 2,  'tipo': 'regular',  'strikes': []},
            {'data': '2026-11-27', 'dias': 9,  'tipo': 'semanal',  'strikes': []},
            {'data': '2026-12-18', 'dias': 30, 'tipo': 'regular',  'strikes': []},
        ]

    def test_ignora_vencimento_sem_dias(self):
        escolhido = sim.vencimento_para_dte(self._expiracoes(), None)
        assert escolhido['dias'] == 1

    def test_escolhe_o_vencimento_mais_proximo_do_alvo(self):
        assert sim.vencimento_para_dte(self._expiracoes(), 4)['dias'] == 2
        assert sim.vencimento_para_dte(self._expiracoes(), 8)['dias'] == 9
        assert sim.vencimento_para_dte(self._expiracoes(), 45)['dias'] == 30

    def test_alvo_nulo_devolve_o_primeiro_util(self):
        assert sim.vencimento_para_dte(self._expiracoes(), None)['dias'] == 1

    def test_sem_vencimento_util_devolve_none(self):
        assert sim.vencimento_para_dte([{'data': 'x', 'dias': 0}], 5) is None
        assert sim.vencimento_para_dte([], 5) is None


class TestMarcarZonas:
    def test_tres_mais_proximos_sao_atm(self):
        strikes = [{'strike': 95.0}, {'strike': 97.0}, {'strike': 99.0},
                   {'strike': 104.0}, {'strike': 110.0}]
        sim.marcar_zonas(strikes, 100.0)
        zonas = {s['strike']: s['zona'] for s in strikes}
        assert zonas[99.0] == 'ATM' and zonas[104.0] == 'ATM' and zonas[97.0] == 'ATM'
        assert zonas[95.0] == 'OTM'      # abaixo da cotação
        assert zonas[110.0] == 'ITM'     # acima da cotação

    def test_lista_vazia_nao_erro(self):
        assert sim.marcar_zonas([], 100.0) == []


class TestTraducaoEPerfil:
    def test_traduz_setores_gics_conhecidos(self):
        assert sim._traduz_setor('Technology') == 'Tecnologia'
        assert sim._traduz_setor('Financial Services') == 'Serviços Financeiros'
        assert sim._traduz_setor('Consumer Cyclical') == 'Consumo Discricionário'

    def test_setor_desconhecido_fica_original_e_vazio_vira_none(self):
        assert sim._traduz_setor('Setor Inexistente') == 'Setor Inexistente'
        assert sim._traduz_setor(None) is None
        assert sim._traduz_setor('') is None

    def test_rotulo_perfil_faixas_de_beta(self):
        assert sim._rotulo_perfil(1.80) == 'Beta 1,80 · alta volatilidade'
        assert sim._rotulo_perfil(1.00) == 'Beta 1,00 · volatilidade moderada'
        assert sim._rotulo_perfil(0.40) == 'Beta 0,40 · baixa volatilidade'
        assert sim._rotulo_perfil(None) is None

    def test_cache_de_perfil_evita_reconsulta(self, monkeypatch):
        chamadas = []

        def _contando(simb):
            chamadas.append(simb)
            return {'empresa': simb, 'setor': None, 'atividade': None, 'perfil': None}

        monkeypatch.setattr(sim, '_dados_perfil', _contando)
        sim._perfis_dos_ativos(['AAA'])
        sim._perfis_dos_ativos(['AAA'])
        assert chamadas == ['AAA']

    def test_falha_do_yfinance_nao_derruba_o_universo(self, monkeypatch):
        def _estoura(simb):
            raise RuntimeError('sem rede')

        monkeypatch.setattr(sim, '_dados_perfil', _estoura)
        saida = sim._perfis_dos_ativos(['AAA'])
        assert saida['AAA']['erro'] is True
        assert saida['AAA']['empresa'] is None
        # a falha fica em cache com TTL curto → não repete a consulta
        chamadas = []
        monkeypatch.setattr(sim, '_dados_perfil',
                            lambda s: chamadas.append(s) or {})
        sim._perfis_dos_ativos(['AAA'])
        assert chamadas == []


class TestRotaStrikes:
    def _cadeia_do_dia(self):
        """Cadeia com o vencimento de hoje (dias=0) e o de amanhã (dias=1)."""
        hoje, amanha = date.today(), date.today() + timedelta(days=1)
        return {'data': {'items': [{'root-symbol': 'SPY', 'expirations': [
            {'expiration-date': hoje.isoformat(), 'days-to-expiration': 0,
             'expiration-type': 'Regular',
             'strikes': [{'strike-price': '590',
                          'call-symbol': _occ('SPY', hoje, 'C', 590),
                          'put-symbol':  _occ('SPY', hoje, 'P', 590)}]},
            {'expiration-date': amanha.isoformat(), 'days-to-expiration': 1,
             'expiration-type': 'Weekly',
             'strikes': [{'strike-price': '590',
                          'call-symbol': _occ('SPY', amanha, 'C', 590),
                          'put-symbol':  _occ('SPY', amanha, 'P', 590)}]},
        ]}]}}

    def test_ignora_vencimento_do_dia_e_usa_o_seguinte(self, client, monkeypatch):
        def _fake(caminho, params=None, timeout=25):
            if str(caminho).startswith('/option-chains'):
                return copy.deepcopy(self._cadeia_do_dia())
            return _fake_tt_get(caminho, params, timeout)

        monkeypatch.setattr(sim, '_tt_get', _fake)
        resp = client.get('/api/simulador/strikes?simbolo=SPY')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['vencimento']['dias'] == 1
        assert all(v['dias'] >= 1 for v in data['vencimentos'])

    def test_parametro_dte_escolhe_o_vencimento_mais_proximo(self, client,
                                                             monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        dias_sexta = (_proxima_sexta() - date.today()).days
        data = client.get(
            f'/api/simulador/strikes?simbolo=SPY&dte={dias_sexta}').get_json()
        assert data['vencimento']['dias'] == dias_sexta
        assert data['parametros']['dte'] == float(dias_sexta)

    def test_sem_comissao_no_padrao_da_rota(self, client, monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get('/api/simulador/strikes?simbolo=SPY').get_json()
        assert data['parametros']['comissao'] == 0.0
        for linha in data['strikes']:
            if linha['premio'] is not None:
                assert linha['premio_liquido'] == pytest.approx(
                    linha['premio'] * 100, rel=1e-4)

    def test_incluir_itm_mostra_strikes_fora_do_filtro(self, client, monkeypatch):
        # sem incluir_itm, só os strikes OTM (abaixo da cotação de 600)
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        largos = 'dist_min=0&dist_max=100&delta_max=1'
        sem_itm = client.get(
            f'/api/simulador/strikes?simbolo=SPY&{largos}').get_json()
        assert [s['strike'] for s in sem_itm['strikes']] == [570.0]

        # com incluir_itm=1 aparece também o strike 630 (ITM para PUT)
        com_itm = client.get(
            f'/api/simulador/strikes?simbolo=SPY&{largos}&incluir_itm=1').get_json()
        strikes = [s['strike'] for s in com_itm['strikes']]
        assert 630.0 in strikes and 570.0 in strikes


class TestPremiosComStrikes:
    def test_devolve_strikes_zonas_e_iv_do_card(self, client, monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get(
            '/api/simulador/premios?simbolos=SPY&com_strikes=1&dte=5').get_json()
        item = data['itens'][0]

        assert item['dte']['dias'] >= 1
        assert item['strikes'], 'deve devolver os strikes do vencimento'
        assert {s['zona'] for s in item['strikes']} <= {'ITM', 'ATM', 'OTM'}
        assert item['iv_atm'] is not None

        campos = {'strike', 'zona', 'dist', 'delta', 'pop', 'pop_lucro',
                  'breakeven', 'capital', 'roc', 'anualizado', 'premio',
                  'premio_liquido'}
        assert campos <= set(item['strikes'][0])
        # sem comissão: o prêmio líquido é o bruto × 100
        s = item['strikes'][0]
        assert s['premio_liquido'] == pytest.approx(s['premio'] * 100, rel=1e-4)

    def test_sem_com_strikes_nao_traz_a_lista(self, client, monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get('/api/simulador/premios?simbolos=SPY').get_json()
        assert 'strikes' not in data['itens'][0]

    def test_dte_invalido_ou_cadeia_sem_opcao_nao_derruba(self, client,
                                                          monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get(
            '/api/simulador/premios?simbolos=SPY,QQQ&com_strikes=1').get_json()
        assert len(data['itens']) == 2
        for item in data['itens']:
            assert isinstance(item['strikes'], list)


class TestRotaUniversoPerfis:
    def test_universo_traz_empresa_setor_e_perfil(self, client, monkeypatch):
        monkeypatch.setattr(sim, '_tt_get', _fake_tt_get)
        data = client.get('/api/simulador/universo?simbolos=SPY,QQQ').get_json()
        # a rota devolve ordenada por preço (QQQ antes de SPY)
        assert sorted(i['simbolo'] for i in data['itens']) == ['QQQ', 'SPY']
        for item in data['itens']:
            assert item['empresa'] == f"Empresa {item['simbolo']}"
            assert item['setor'] == 'Tecnologia'
            assert item['atividade'] == 'Software'
            assert item['perfil'].startswith('Beta')


def _fake_tt_get(caminho, params=None, timeout=25):
    """Substitui a chamada real à tastytrade nos testes."""
    if str(caminho).startswith('/option-chains'):
        return copy.deepcopy(_cadeia_teste())

    if params and 'equity' in params:
        itens = [copy.deepcopy(COTACOES.get(s) or _cotacao_padrao(s))
                 for s in params['equity'].split(',') if s]
        return {'data': {'items': itens}}

    if params and 'equity-option' in params:
        itens = [{'symbol': s, 'bid': '1.00', 'ask': '1.20', 'bid-size': '10',
                  'ask-size': '10'} for s in params['equity-option'].split(',') if s]
        return {'data': {'items': itens}}

    raise AssertionError(f'requisição inesperada na fake: {caminho} params={params}')

"""
Testes do endpoint /api/analyze (Análise de Mercado com IA).
"""
import pytest
import os
import json
from unittest.mock import patch, MagicMock


def _make_response_mock(status_code=200, json_data=None):
    """Helper para criar mock de resposta requests."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    resp.text = json.dumps(json_data or {})
    return resp


PAYLOAD_VALIDO = {
    'messages': [{'role': 'user', 'content': 'Analise PETR4 PUT strike 35 vencimento abril'}],
}

PAYLOAD_CONTEXT = {
    'context': 'Analise PETR4 com Strike 35',
}


class TestAnalyzeValidacao:
    def test_sem_api_keys_retorna_400(self, client, mock_db):
        """Sem nenhuma chave de IA configurada, deve retornar 400."""
        mock_db.execute.return_value.fetchone.return_value = None
        # Remove todas as API keys do env temporariamente
        ai_keys = ('OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROK_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY')
        saved = {k: os.environ.pop(k, None) for k in ai_keys}
        try:
            resp = client.post('/api/analyze', json=PAYLOAD_VALIDO)
            assert resp.status_code == 400
            data = resp.get_json()
            assert 'error' in data
        finally:
            for k, v in saved.items():
                if v:
                    os.environ[k] = v

    def test_mensagem_erro_sem_chaves(self, client, mock_db):
        """Mensagem de erro deve mencionar ausência de chave de API."""
        mock_db.execute.return_value.fetchone.return_value = None
        ai_keys = ('OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROK_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY')
        saved = {k: os.environ.pop(k, None) for k in ai_keys}
        try:
            resp = client.post('/api/analyze', json=PAYLOAD_VALIDO)
            error_msg = resp.get_json().get('error', '').lower()
            assert 'chave' in error_msg or 'api' in error_msg or 'key' in error_msg
        finally:
            for k, v in saved.items():
                if v:
                    os.environ[k] = v

    def test_context_converte_para_messages(self, client, mock_db):
        """Quando context é fornecido sem messages, deve converter para messages."""
        mock_db.execute.return_value.fetchone.return_value = None
        ai_keys = ('OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROK_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY')
        saved = {k: os.environ.pop(k, None) for k in ai_keys}
        try:
            # Sem chaves, retorna 400, mas o endpoint não deve crashar
            resp = client.post('/api/analyze', json=PAYLOAD_CONTEXT)
            # 400 é esperado (sem keys), mas não deve ser 500
            assert resp.status_code in (400, 200)
        finally:
            for k, v in saved.items():
                if v:
                    os.environ[k] = v


class TestAnalyzeComMockGemini:
    def test_analyze_gemini_retorna_analise(self, client, mock_db):
        """Com GEMINI_API_KEY e requests.post mockado, deve retornar análise."""
        mock_db.execute.return_value.fetchone.return_value = None
        gemini_resp = {
            'candidates': [{
                'content': {'parts': [{'text': 'Análise: PETR4 está em tendência de queda.'}]}
            }]
        }
        gemini_mock = _make_response_mock(200, gemini_resp)

        with patch.dict(os.environ, {'GEMINI_API_KEY': 'fake-key-test', 'OPENAI_API_KEY': '', 'OPENROUTER_API_KEY': '', 'DEEPSEEK_API_KEY': '', 'GROK_API_KEY': ''}):
            with patch('server.requests.post', return_value=gemini_mock):
                resp = client.post('/api/analyze', json={
                    **PAYLOAD_VALIDO,
                    'force_ai': 'GEMINI',
                })
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'analysis' in data
        assert 'Análise' in data['analysis'] or 'PETR4' in data['analysis']
        assert data.get('agent') == 'GEMINI'

    def test_analyze_retorna_campos_obrigatorios(self, client, mock_db):
        """Resposta de sucesso deve conter analysis e agent."""
        mock_db.execute.return_value.fetchone.return_value = None
        gemini_resp = {
            'candidates': [{'content': {'parts': [{'text': 'Recomendação de venda.'}]}}]
        }
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'fake-key', 'OPENAI_API_KEY': '', 'OPENROUTER_API_KEY': '', 'DEEPSEEK_API_KEY': '', 'GROK_API_KEY': ''}):
            with patch('server.requests.post', return_value=_make_response_mock(200, gemini_resp)):
                resp = client.post('/api/analyze', json={**PAYLOAD_VALIDO, 'force_ai': 'GEMINI'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'analysis' in data
        assert 'agent' in data

    def test_analyze_deepseek_retorna_analise(self, client, mock_db):
        """Com DEEPSEEK_API_KEY e requests.post mockado, deve retornar análise."""
        mock_db.execute.return_value.fetchone.return_value = None
        ds_resp = {
            'choices': [{'message': {'content': 'Análise técnica: suporte em 34.80.'}}]
        }
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'fake-ds-key', 'OPENAI_API_KEY': '', 'OPENROUTER_API_KEY': '', 'GEMINI_API_KEY': '', 'GROK_API_KEY': ''}):
            with patch('server.requests.post', return_value=_make_response_mock(200, ds_resp)):
                resp = client.post('/api/analyze', json={**PAYLOAD_VALIDO, 'force_ai': 'DEEPSEEK'})
        assert resp.status_code == 200
        assert 'analysis' in resp.get_json()


class TestAnalyzeForceAI:
    def test_force_ai_gemini_usa_gemini(self, client, mock_db):
        mock_db.execute.return_value.fetchone.return_value = None
        gemini_resp = {
            'candidates': [{'content': {'parts': [{'text': 'ok gemini'}]}}]
        }
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'fake', 'OPENAI_API_KEY': '', 'OPENROUTER_API_KEY': '', 'DEEPSEEK_API_KEY': '', 'GROK_API_KEY': ''}):
            with patch('server.requests.post', return_value=_make_response_mock(200, gemini_resp)):
                resp = client.post('/api/analyze', json={**PAYLOAD_VALIDO, 'force_ai': 'GEMINI'})
        data = resp.get_json()
        assert data.get('agent') == 'GEMINI'

    def test_force_ai_com_api_falhando_retorna_400(self, client, mock_db):
        """Se o provedor retorna erro HTTP, o endpoint deve retornar 400."""
        mock_db.execute.return_value.fetchone.return_value = None
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'fake', 'OPENAI_API_KEY': '', 'OPENROUTER_API_KEY': '', 'DEEPSEEK_API_KEY': '', 'GROK_API_KEY': ''}):
            with patch('server.requests.post', return_value=_make_response_mock(500, {'error': 'Internal Server Error'})):
                resp = client.post('/api/analyze', json={**PAYLOAD_VALIDO, 'force_ai': 'GEMINI'})
        assert resp.status_code == 400
        assert 'error' in resp.get_json()

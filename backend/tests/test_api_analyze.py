"""
Testes de validação do endpoint /api/analyze sem mock de respostas externas.
"""
import os


PAYLOAD_VALIDO = {
    'messages': [{'role': 'user', 'content': 'Analise PETR4 PUT strike 35 vencimento abril'}],
}

PAYLOAD_CONTEXT = {
    'context': 'Analise PETR4 com Strike 35',
}


def _pop_all_ai_keys():
    ai_keys = ('OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROK_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY')
    return {k: os.environ.pop(k, None) for k in ai_keys}


def _restore_ai_keys(saved):
    for k, v in saved.items():
        if v:
            os.environ[k] = v


class TestAnalyzeValidacao:
    def test_sem_api_keys_retorna_400(self, client):
        saved = _pop_all_ai_keys()
        try:
            resp = client.post('/api/analyze', json=PAYLOAD_VALIDO)
            assert resp.status_code == 400
            assert 'error' in resp.get_json()
        finally:
            _restore_ai_keys(saved)

    def test_mensagem_erro_sem_chaves(self, client):
        saved = _pop_all_ai_keys()
        try:
            resp = client.post('/api/analyze', json=PAYLOAD_VALIDO)
            msg = resp.get_json().get('error', '').lower()
            assert 'chave' in msg or 'api' in msg or 'key' in msg
        finally:
            _restore_ai_keys(saved)

    def test_context_sem_messages_nao_quebra_endpoint(self, client):
        saved = _pop_all_ai_keys()
        try:
            resp = client.post('/api/analyze', json=PAYLOAD_CONTEXT)
            # Sem API key o retorno é 400, mas não deve estourar 500.
            assert resp.status_code in (200, 400)
        finally:
            _restore_ai_keys(saved)

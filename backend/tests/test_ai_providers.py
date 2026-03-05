"""
Testes reais de conectividade com provedores de IA.

Estratégia:
- Lê as chaves diretamente de backend/.env
- Cada teste faz uma chamada HTTP real ao provedor
- São marcados com @pytest.mark.live_api para poder rodar separadamente
- Falham se a chave não existir ou se o provedor retornar erro
- pytest -m live_api  → só estes testes
- pytest -m "not live_api" → todos exceto estes
"""
import os
import json
import pytest
import urllib.request
import urllib.error
from pathlib import Path

# ─────────────────────────────────────────
# CARREGAR CHAVES DO .env
# ─────────────────────────────────────────
_ENV_FILE = Path(__file__).parent.parent / '.env'

def _load_env() -> dict:
    """Lê backend/.env e retorna dicionário de chaves."""
    keys = {}
    if _ENV_FILE.exists():
        for line in _ENV_FILE.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                keys[k.strip()] = v.strip()
    return keys

_ENV = _load_env()


def _get_key(name: str) -> str | None:
    return _ENV.get(name) or os.environ.get(name)


# ─────────────────────────────────────────
# UTILITÁRIOS
# ─────────────────────────────────────────
def _post_json(url: str, headers: dict, payload: dict, timeout: int = 20) -> tuple[int, dict]:
    """Faz POST JSON e retorna (status_code, response_dict)."""
    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8'))
        except Exception:
            return e.code, {}
    except Exception as e:
        pytest.fail(f'Erro de rede: {e}')


PERGUNTA_TESTE = 'Responda apenas com a palavra: OK'


# ═══════════════════════════════════════════════════
# GEMINI
# ═══════════════════════════════════════════════════
class TestGemini:
    """Testa a API Gemini 2.0 Flash diretamente (sem mock)."""

    @pytest.mark.live_api
    def test_chave_configurada(self):
        """Verifica que GEMINI_API_KEY está no .env."""
        key = _get_key('GEMINI_API_KEY')
        assert key, 'GEMINI_API_KEY não encontrada em backend/.env'
        assert len(key) > 10, 'GEMINI_API_KEY parece inválida (muito curta)'

    @pytest.mark.live_api
    def test_gemini_flash_responde(self):
        """Chamada real ao Gemini 2.0 Flash — deve retornar 200 com texto."""
        key = _get_key('GEMINI_API_KEY')
        if not key:
            pytest.skip('GEMINI_API_KEY ausente')

        url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}'
        headers = {'Content-Type': 'application/json'}
        payload = {
            'contents': [{'parts': [{'text': PERGUNTA_TESTE}]}],
            'generationConfig': {'temperature': 0, 'maxOutputTokens': 20}
        }

        status, data = _post_json(url, headers, payload)
        error_msg = data.get('error', {}).get('message', str(data))
        if status == 429:
            pytest.skip(f'Gemini 2.0 Flash: quota excedida (free tier) — {error_msg}')
        assert status == 200, f'Gemini retornou {status}. Erro: {error_msg}'
        text = data['candidates'][0]['content']['parts'][0]['text']
        assert text.strip(), 'Gemini retornou resposta vazia'

    @pytest.mark.live_api
    def test_gemini_15_pro_responde(self):
        """Testa modelo alternativo gemini-1.5-pro como fallback."""
        key = _get_key('GEMINI_API_KEY')
        if not key:
            pytest.skip('GEMINI_API_KEY ausente')

        url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={key}'
        headers = {'Content-Type': 'application/json'}
        payload = {
            'contents': [{'parts': [{'text': PERGUNTA_TESTE}]}],
            'generationConfig': {'temperature': 0, 'maxOutputTokens': 20}
        }

        status, data = _post_json(url, headers, payload)
        error_msg = data.get('error', {}).get('message', str(data))
        if status in (429, 404):
            pytest.skip(f'Gemini 1.5-Pro: modelo indisponível ou quota excedida — {error_msg}')
        assert status == 200, f'Gemini 1.5-Pro retornou {status}. Erro: {error_msg}'
        text = data['candidates'][0]['content']['parts'][0]['text']
        assert text.strip(), 'Gemini 1.5-Pro retornou resposta vazia'


# ═══════════════════════════════════════════════════
# DEEPSEEK
# ═══════════════════════════════════════════════════
class TestDeepSeek:
    """Testa a API DeepSeek diretamente."""

    @pytest.mark.live_api
    def test_chave_configurada(self):
        key = _get_key('DEEPSEEK_API_KEY')
        assert key, 'DEEPSEEK_API_KEY não encontrada em backend/.env'

    @pytest.mark.live_api
    def test_deepseek_chat_responde(self):
        """Chamada real ao DeepSeek Chat."""
        key = _get_key('DEEPSEEK_API_KEY')
        if not key:
            pytest.skip('DEEPSEEK_API_KEY ausente')

        url = 'https://api.deepseek.com/chat/completions'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
        }
        payload = {
            'model': 'deepseek-chat',
            'messages': [{'role': 'user', 'content': PERGUNTA_TESTE}],
            'max_tokens': 20,
            'temperature': 0,
        }

        status, data = _post_json(url, headers, payload)
        error_msg = data.get('error', {}).get('message', str(data))
        if status == 402:
            pytest.skip(f'DeepSeek: saldo insuficiente — {error_msg}')
        assert status == 200, f'DeepSeek retornou {status}. Erro: {error_msg}'
        text = data['choices'][0]['message']['content']
        assert text.strip(), 'DeepSeek retornou resposta vazia'


# ═══════════════════════════════════════════════════
# GROK (xAI)
# ═══════════════════════════════════════════════════
class TestGrok:
    """Testa a API Grok da xAI."""

    @pytest.mark.live_api
    def test_chave_configurada(self):
        key = _get_key('GROK_API_KEY')
        assert key, 'GROK_API_KEY não encontrada em backend/.env'

    @pytest.mark.live_api
    def test_grok_2_latest_responde(self):
        """Chamada real ao Grok 2 Latest."""
        key = _get_key('GROK_API_KEY')
        if not key:
            pytest.skip('GROK_API_KEY ausente')

        url = 'https://api.x.ai/v1/chat/completions'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
        }
        payload = {
            'model': 'grok-2-latest',
            'messages': [{'role': 'user', 'content': PERGUNTA_TESTE}],
            'max_tokens': 20,
            'temperature': 0,
        }

        status, data = _post_json(url, headers, payload)
        error_msg = data.get('error', {}).get('message', str(data))
        if status == 403:
            pytest.skip(f'Grok: acesso negado (plano sem permissão) — {error_msg}')
        assert status == 200, f'Grok retornou {status}. Erro: {error_msg}'
        text = data['choices'][0]['message']['content']
        assert text.strip(), 'Grok retornou resposta vazia'


# ═══════════════════════════════════════════════════
# OPENAI
# ═══════════════════════════════════════════════════
class TestOpenAI:
    """Testa a API OpenAI."""

    @pytest.mark.live_api
    def test_chave_configurada(self):
        key = _get_key('OPENAI_API_KEY')
        assert key, 'OPENAI_API_KEY não encontrada em backend/.env'

    @pytest.mark.live_api
    def test_gpt_3_5_turbo_responde(self):
        """Chamada real ao GPT-3.5-turbo."""
        key = _get_key('OPENAI_API_KEY')
        if not key:
            pytest.skip('OPENAI_API_KEY ausente')

        url = 'https://api.openai.com/v1/chat/completions'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
        }
        payload = {
            'model': 'gpt-3.5-turbo',
            'messages': [{'role': 'user', 'content': PERGUNTA_TESTE}],
            'max_tokens': 20,
            'temperature': 0,
        }

        status, data = _post_json(url, headers, payload)
        error_msg = data.get('error', {}).get('message', str(data))
        if status == 429:
            pytest.skip(f'OpenAI: quota excedida (free tier) — {error_msg}')
        assert status == 200, f'OpenAI retornou {status}. Erro: {error_msg}'
        text = data['choices'][0]['message']['content']
        assert text.strip(), 'OpenAI retornou resposta vazia'


# ═══════════════════════════════════════════════════
# OPENROUTER
# ═══════════════════════════════════════════════════
class TestOpenRouter:
    """Testa a API OpenRouter."""

    @pytest.mark.live_api
    def test_chave_configurada(self):
        key = _get_key('OPENROUTER_API_KEY')
        assert key, 'OPENROUTER_API_KEY não encontrada em backend/.env'

    @pytest.mark.live_api
    def test_deepseek_via_openrouter_responde(self):
        """Testa DeepSeek Chat roteado via OpenRouter."""
        key = _get_key('OPENROUTER_API_KEY')
        if not key:
            pytest.skip('OPENROUTER_API_KEY ausente')

        url = 'https://openrouter.ai/api/v1/chat/completions'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
            'HTTP-Referer': 'http://localhost:8881',
            'X-Title': 'CentralClinica',
        }
        payload = {
            'model': 'deepseek/deepseek-chat',
            'messages': [{'role': 'user', 'content': PERGUNTA_TESTE}],
            'max_tokens': 20,
        }

        status, data = _post_json(url, headers, payload)

        assert status == 200, (
            f'OpenRouter (DeepSeek) retornou {status}. '
            f'Erro: {data.get("error", {}).get("message", str(data))}'
        )
        text = data['choices'][0]['message']['content']
        assert text.strip(), 'OpenRouter retornou resposta vazia'

    @pytest.mark.live_api
    def test_gemini_via_openrouter_responde(self):
        """Testa Gemini Pro roteado via OpenRouter como fallback."""
        key = _get_key('OPENROUTER_API_KEY')
        if not key:
            pytest.skip('OPENROUTER_API_KEY ausente')

        url = 'https://openrouter.ai/api/v1/chat/completions'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
            'HTTP-Referer': 'http://localhost:8881',
            'X-Title': 'CentralClinica',
        }
        payload = {
            'model': 'google/gemini-2.0-flash-001',
            'messages': [{'role': 'user', 'content': PERGUNTA_TESTE}],
            'max_tokens': 20,
        }

        status, data = _post_json(url, headers, payload)

        assert status == 200, (
            f'OpenRouter (Gemini) retornou {status}. '
            f'Erro: {data.get("error", {}).get("message", str(data))}'
        )

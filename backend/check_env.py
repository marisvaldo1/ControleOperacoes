import os
from dotenv import load_dotenv

# Caminho explícito para o arquivo .env
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, '.env')

print(f"Tentando carregar .env de: {env_path}")

if os.path.exists(env_path):
    print("Arquivo .env encontrado!")
else:
    print("ERRO: Arquivo .env NÃO encontrado neste caminho.")

# Carregar
load_dotenv(env_path)

# Verificar chaves
openai_key = os.environ.get('OPENAI_API_KEY')
gemini_key = os.environ.get('GEMINI_API_KEY')
deepseek_key = os.environ.get('DEEPSEEK_API_KEY')
grok_key = os.environ.get('GROK_API_KEY')

print("-" * 30)

if grok_key:
    print(f"✅ GROK_API_KEY carregada com sucesso! (Inicia com: {grok_key[:8]}...)")
    # Testar chamada real
    print("Testando conexão com Grok (modelo: grok-2-latest)...")
    try:
        import requests
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {grok_key}'
        }
        payload = {
            "model": "grok-2-latest",
            "messages": [{"role": "user", "content": "Teste de conexão."}],
            "max_tokens": 5
        }
        r = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=payload, timeout=10)
        if r.status_code == 200:
            print("✅ Teste de API Grok: SUCESSO! O modelo respondeu.")
        else:
            print(f"❌ Teste de API Grok: FALHOU. Status: {r.status_code}")
            print(f"Resposta: {r.text}")
    except Exception as e:
        print(f"❌ Erro ao conectar com Grok: {e}")
else:
    print("❌ GROK_API_KEY não encontrada nas variáveis de ambiente.")

if deepseek_key:
    print(f"✅ DEEPSEEK_API_KEY carregada com sucesso! (Inicia com: {deepseek_key[:8]}...)")
    # Testar chamada real
    print("Testando conexão com DeepSeek (modelo: deepseek-chat)...")
    try:
        import requests
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {deepseek_key}'
        }
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": "Teste de conexão."}],
            "max_tokens": 5
        }
        r = requests.post('https://api.deepseek.com/chat/completions', headers=headers, json=payload, timeout=10)
        if r.status_code == 200:
            print("✅ Teste de API DeepSeek: SUCESSO! O modelo respondeu.")
        else:
            print(f"❌ Teste de API DeepSeek: FALHOU. Status: {r.status_code}")
            print(f"Resposta: {r.text}")
    except Exception as e:
        print(f"❌ Erro ao conectar com DeepSeek: {e}")
else:
    print("❌ DEEPSEEK_API_KEY não encontrada nas variáveis de ambiente.")

if openai_key:
    print(f"✅ OPENAI_API_KEY carregada com sucesso! (Inicia com: {openai_key[:8]}...)")
    
    # Testar chamada real
    print("Testando conexão com OpenAI (modelo: gpt-3.5-turbo)...")
    try:
        import requests
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {openai_key}'
        }
        payload = {
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": "Teste de conexão."}],
            "max_tokens": 5
        }
        r = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=payload, timeout=10)
        if r.status_code == 200:
            print("✅ Teste de API OpenAI: SUCESSO! O modelo respondeu.")
        else:
            print(f"❌ Teste de API OpenAI: FALHOU. Status: {r.status_code}")
            print(f"Resposta: {r.text}")
    except Exception as e:
        print(f"❌ Erro ao conectar com OpenAI: {e}")

else:
    print("❌ OPENAI_API_KEY não encontrada nas variáveis de ambiente.")


if gemini_key:
    print(f"✅ GEMINI_API_KEY carregada com sucesso! (Inicia com: {gemini_key[:8]}...)")
    # Testar chamada real com múltiplos modelos
    print("Testando conexão com Gemini (tentando: gemini-2.5-pro, 2.0-flash, 1.5-flash)...")
    try:
        import requests
        gemini_models = ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"]
        success_gemini = False
        
        for model_name in gemini_models:
            if success_gemini: break
            print(f"  > Tentando {model_name}...", end=" ")
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                headers = {'Content-Type': 'application/json'}
                payload = {
                    "contents": [{
                        "parts": [{"text": "Teste de conexão."}]
                    }]
                }
                r = requests.post(url, headers=headers, json=payload, timeout=10)
                if r.status_code == 200:
                    print(f"✅ SUCESSO!")
                    success_gemini = True
                else:
                    print(f"❌ ({r.status_code})")
            except Exception as e:
                print(f"❌ Erro: {e}")
        
        if success_gemini:
             print("✅ Teste de API Gemini: CONCLUÍDO COM SUCESSO em pelo menos um modelo.")
        else:
             print("❌ Teste de API Gemini: FALHOU para todos os modelos tentados.")

    except Exception as e:
        print(f"❌ Erro geral no teste Gemini: {e}")
else:
    print("❌ GEMINI_API_KEY não encontrada nas variáveis de ambiente.")

print("-" * 30)

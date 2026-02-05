import requests
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))
gemini_key = os.environ.get('GEMINI_API_KEY')

if not gemini_key:
    print("❌ Erro: GEMINI_API_KEY não encontrada no .env")
    exit()

print(f"Chave encontrada: {gemini_key[:10]}...")

# Listar modelos disponíveis
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={gemini_key}"
try:
    r = requests.get(url)
    if r.status_code == 200:
        data = r.json()
        print("\n✅ Modelos Disponíveis:")
        if 'models' in data:
            for model in data['models']:
                if 'generateContent' in model.get('supportedGenerationMethods', []):
                    print(f" - {model['name']}")
        else:
            print("Nenhum modelo encontrado na lista.")
    else:
        print(f"❌ Erro ao listar modelos: {r.status_code} - {r.text}")

    # Testar especificamente o gemini-pro (que costuma funcionar)
    print("\nTestando modelo 'gemini-pro'...")
    test_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={gemini_key}"
    payload = {"contents": [{"parts": [{"text": "Oi"}]}]}
    r = requests.post(test_url, json=payload)
    if r.status_code == 200:
        print("✅ gemini-pro: FUNCIONANDO")
    else:
        print(f"❌ gemini-pro: FALHOU ({r.status_code})")

except Exception as e:
    print(f"Erro de conexão: {e}")

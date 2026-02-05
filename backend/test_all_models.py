import requests
import os
import json
from dotenv import load_dotenv

# Carregar variáveis
load_dotenv('.env')

print("="*60)
print("🧪 TESTE DE TODAS AS APIs DE IA DISPONÍVEIS")
print("="*60)

# Verificar quais chaves estão disponíveis
api_keys = {
    'OPENAI': os.environ.get('OPENAI_API_KEY'),
    'DEEPSEEK': os.environ.get('DEEPSEEK_API_KEY'),
    'GROK': os.environ.get('GROK_API_KEY'),
    'GEMINI': os.environ.get('GEMINI_API_KEY'),
    'OPENROUTER': os.environ.get('OPENROUTER_API_KEY')
}

print("\n📋 Chaves encontradas:")
for name, key in api_keys.items():
    if key:
        print(f"  ✅ {name}: {key[:10]}...")
    else:
        print(f"  ❌ {name}: Não encontrada")

# ============= TESTE OPENROUTER =============
def test_openrouter():
    print("\n" + "="*60)
    print("🔄 TESTANDO OPENROUTER")
    print("="*60)
    
    key = api_keys.get('OPENROUTER')
    if not key:
        print("❌ Chave não encontrada")
        return []
    
    # Modelos populares do OpenRouter
    models_to_test = [
        "openai/gpt-3.5-turbo",
        "openai/gpt-4",
        "anthropic/claude-3-haiku",
        "google/gemini-pro",
        "meta-llama/llama-3-8b-instruct",
        "deepseek/deepseek-chat"
    ]
    
    working_models = []
    
    for model in models_to_test:
        print(f"Testing {model}...", end=" ")
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
            'HTTP-Referer': 'http://localhost:5000',
            'X-Title': 'ControleOperacoes'
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "Oi, responda apenas: OK"}]
        }
        
        try:
            r = requests.post('https://openrouter.ai/api/v1/chat/completions', 
                            headers=headers, json=payload, timeout=15)
            
            if r.status_code == 200:
                response_text = r.json()['choices'][0]['message']['content']
                print(f"✅ SUCESSO! Resposta: {response_text[:30]}")
                working_models.append(model)
            else:
                error_msg = r.json().get('error', {}).get('message', r.text[:100])
                print(f"❌ FALHOU ({r.status_code}): {error_msg[:50]}")
        except Exception as e:
            print(f"❌ ERRO: {str(e)[:50]}")
    
    return working_models

# ============= TESTE GROK =============
def test_grok():
    print("\n" + "="*60)
    print("🔄 TESTANDO GROK (xAI)")
    print("="*60)
    
    key = api_keys.get('GROK')
    if not key:
        print("❌ Chave não encontrada")
        return []
    
    models_to_test = ["grok-2-latest", "grok-beta"]
    working_models = []
    
    for model in models_to_test:
        print(f"Testing {model}...", end=" ")
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}'
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "Oi, responda apenas: OK"}]
        }
        
        try:
            r = requests.post('https://api.x.ai/v1/chat/completions', 
                            headers=headers, json=payload, timeout=15)
            
            if r.status_code == 200:
                response_text = r.json()['choices'][0]['message']['content']
                print(f"✅ SUCESSO! Resposta: {response_text[:30]}")
                working_models.append(model)
            else:
                print(f"❌ FALHOU ({r.status_code})")
        except Exception as e:
            print(f"❌ ERRO: {str(e)[:50]}")
    
    return working_models

# ============= TESTE DEEPSEEK =============
def test_deepseek():
    print("\n" + "="*60)
    print("🔄 TESTANDO DEEPSEEK")
    print("="*60)
    
    key = api_keys.get('DEEPSEEK')
    if not key:
        print("❌ Chave não encontrada")
        return []
    
    model = "deepseek-chat"
    print(f"Testing {model}...", end=" ")
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {key}'
    }
    
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Oi, responda apenas: OK"}]
    }
    
    try:
        r = requests.post('https://api.deepseek.com/chat/completions', 
                        headers=headers, json=payload, timeout=15)
        
        if r.status_code == 200:
            response_text = r.json()['choices'][0]['message']['content']
            print(f"✅ SUCESSO! Resposta: {response_text[:30]}")
            return [model]
        else:
            print(f"❌ FALHOU ({r.status_code})")
    except Exception as e:
        print(f"❌ ERRO: {str(e)[:50]}")
    
    return []

# ============= TESTE OPENAI =============
def test_openai():
    print("\n" + "="*60)
    print("🔄 TESTANDO OPENAI")
    print("="*60)
    
    key = api_keys.get('OPENAI')
    if not key:
        print("❌ Chave não encontrada")
        return []
    
    models_to_test = ["gpt-3.5-turbo", "gpt-4"]
    working_models = []
    
    for model in models_to_test:
        print(f"Testing {model}...", end=" ")
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}'
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "Oi, responda apenas: OK"}]
        }
        
        try:
            r = requests.post('https://api.openai.com/v1/chat/completions', 
                            headers=headers, json=payload, timeout=15)
            
            if r.status_code == 200:
                response_text = r.json()['choices'][0]['message']['content']
                print(f"✅ SUCESSO! Resposta: {response_text[:30]}")
                working_models.append(model)
            else:
                print(f"❌ FALHOU ({r.status_code})")
        except Exception as e:
            print(f"❌ ERRO: {str(e)[:50]}")
    
    return working_models

# ============= TESTE GEMINI =============
def test_gemini():
    print("\n" + "="*60)
    print("🔄 TESTANDO GEMINI")
    print("="*60)
    
    key = api_keys.get('GEMINI')
    if not key:
        print("❌ Chave não encontrada")
        return []
    
    models_to_test = [
        "gemini-2.5-flash",
        "gemini-flash-latest", 
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    ]
    
    working_models = []
    
    for model in models_to_test:
        print(f"Testing {model}...", end=" ")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        headers = {'Content-Type': 'application/json'}
        payload = {
            "contents": [{
                "parts": [{"text": "Oi, responda apenas: OK"}]
            }]
        }
        
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=15)
            
            if r.status_code == 200:
                response_text = r.json()['candidates'][0]['content']['parts'][0]['text']
                print(f"✅ SUCESSO! Resposta: {response_text[:30]}")
                working_models.append(model)
            else:
                print(f"❌ FALHOU ({r.status_code})")
        except Exception as e:
            print(f"❌ ERRO: {str(e)[:50]}")
    
    return working_models

# ============= EXECUTAR TODOS OS TESTES =============
all_results = {
    'OPENROUTER': test_openrouter(),
    'GROK': test_grok(),
    'DEEPSEEK': test_deepseek(),
    'OPENAI': test_openai(),
    'GEMINI': test_gemini()
}

# ============= RESUMO FINAL =============
print("\n" + "="*60)
print("📊 RESUMO GERAL")
print("="*60)

for api_name, models in all_results.items():
    if models:
        print(f"\n✅ {api_name}:")
        for m in models:
            print(f"   - {m}")
    else:
        print(f"\n❌ {api_name}: Nenhum modelo funcionou")

print("\n" + "="*60)
print("💡 RECOMENDAÇÃO")
print("="*60)

# Priorizar OpenRouter se funcionar
if all_results['OPENROUTER']:
    print(f"✨ Use OPENROUTER com o modelo: {all_results['OPENROUTER'][0]}")
    print("   OpenRouter oferece acesso a vários modelos com uma única chave!")
elif all_results['GROK']:
    print(f"✨ Use GROK com o modelo: {all_results['GROK'][0]}")
elif all_results['DEEPSEEK']:
    print(f"✨ Use DEEPSEEK com o modelo: {all_results['DEEPSEEK'][0]}")
elif all_results['GEMINI']:
    print(f"✨ Use GEMINI com o modelo: {all_results['GEMINI'][0]}")
elif all_results['OPENAI']:
    print(f"✨ Use OPENAI com o modelo: {all_results['OPENAI'][0]}")
else:
    print("⚠️ Nenhuma API funcionou. Verifique suas chaves e quotas.")

print("="*60)

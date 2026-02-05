import requests
import json

API_KEY = "pCRvMIyonyCf12mvb14P+qLLUu1P3CYORxsM/s9cX5ncRhRNb2XRsb5RKN5r69oc--APbF8Hkq0wXC4aWD/YEBNg==--MzM2NjE0NDlkNmFjNGI4YTMzNWM1MjY3NmY4OTdlZDQ="
HEADERS = {'Access-Token': API_KEY}
TICKER = "PETR4"

def check_endpoint(url_suffix):
    url = f"https://api.oplab.com.br/v3/market/options/{url_suffix}"
    print(f"\n--- Checking {url} ---")
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and len(data) > 0:
                print("First item keys:", data[0].keys())
                print("First item sample:", json.dumps(data[0], indent=2))
            elif isinstance(data, dict):
                print("Keys:", data.keys())
                # Check for list inside
                for k, v in data.items():
                    if isinstance(v, list) and len(v) > 0:
                        print(f"List in '{k}' - First item sample:", json.dumps(v[0], indent=2))
                        break
        else:
            print("Error body:", r.text)
    except Exception as e:
        print(f"Exception: {e}")

# Check standard options endpoint
check_endpoint(TICKER)

# Check details endpoint
check_endpoint(f"details/{TICKER}")

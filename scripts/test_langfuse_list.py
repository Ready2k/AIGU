import os
import json
from langfuse import Langfuse

# Manual .env parser for test resilience
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                key, value = line.strip().split("=", 1)
                os.environ[key] = value.strip('"' )

LANGFUSE_PUBLIC_KEY = os.environ.get("LANGFUSE_PUBLIC_KEY")
LANGFUSE_SECRET_KEY = os.environ.get("LANGFUSE_SECRET_KEY")
LANGFUSE_HOST = os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com")

langfuse = Langfuse(
    public_key=LANGFUSE_PUBLIC_KEY,
    secret_key=LANGFUSE_SECRET_KEY,
    host=LANGFUSE_HOST
)

try:
    if hasattr(langfuse, 'api'):
        print(f"\nFound langfuse.api, methods: {dir(langfuse.api)}")
        # Check if prompts is in api
        if hasattr(langfuse.api, 'prompts'):
            print(f"Found langfuse.api.prompts, methods: {dir(langfuse.api.prompts)}")
            # Try to list
            try:
                resp = langfuse.api.prompts.list()
                print(f"List response type: {type(resp)}")
                # resp might be a list or a paged object
                if isinstance(resp, list):
                     for p in resp:
                         print(f" - {p.name}")
                if hasattr(resp, 'data'):
                     for p in resp.data:
                         print(f" - {p.name} | Tags: {getattr(p, 'labels', 'N/A')} | Version: {getattr(p, 'version', 'N/A')}")
                         # Also print dict of first one
                         print(f"DEBUG: {p.__dict__}")
                         break
            except Exception as nested_e:
                print(f"Nested Error listing prompts: {nested_e}")
        else:
            print("langfuse.api.prompts not found.")

    # Try standard requests again with correct auth
    import requests
    from requests.auth import HTTPBasicAuth
    
    auth = HTTPBasicAuth(LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY)
    # The public API URL for prompts
    list_url = f"{LANGFUSE_HOST}/api/public/prompts"
    print(f"\nTrying direct REST API: {list_url}")
    response = requests.get(list_url, auth=auth)
    if response.status_code == 200:
        print("Success! Data:")
        data = response.json()
        if 'data' in data:
            for p in data['data']:
                print(f" - {p['name']} (v{p['version']})")
        else:
             print(json.dumps(data, indent=2))
    else:
        print(f"Status: {response.status_code}, Body: {response.text}")

except Exception as e:
    print(f"Error: {e}")

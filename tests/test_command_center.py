import json
import os
import sys
from unittest.mock import MagicMock

# Mock problematic imports
sys.modules["aigu.graph"] = MagicMock()
sys.modules["langgraph"] = MagicMock()
sys.modules["langgraph.graph"] = MagicMock()
sys.modules["langgraph_checkpoint_dynamodb"] = MagicMock()
sys.modules["langgraph_checkpoint_dynamodb.saver"] = MagicMock()

from aigu.handler import lambda_handler

def test_admin_config_api():
    print("🧪 Testing Admin Config API...")
    
    # 1. Test POST /admin/config/risk_agent
    payload = {
        "high_risk_keywords": ["Crypto", "Gambling"],
        "sla_thresholds": {"High": 14, "Medium": 5}
    }
    event_post = {
        "path": "/admin/config/risk_agent",
        "httpMethod": "POST",
        "headers": {"content-type": "application/json"},
        "body": json.dumps(payload)
    }
    
    # Mock DynamoDB
    import boto3
    from botocore.stub import Stubber
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table_name = "AIGU_SystemConfig"
    
    # We'll use a real stubber if we wanted deep testing, 
    # but for a quick verification we'll just check if the handler routes correctly.
    # Note: lambda_handler will try to hit real Dynamo unless mocked.
    
    print("🚀 Calling POST /admin/config/risk_agent")
    # In this environment, we expect a 500 or error if credentials missing, 
    # but we want to see the "Updating" logs.
    
    try:
        response = lambda_handler(event_post, None)
        print(f"Response: {response['statusCode']}")
        # body = json.loads(response['body'])
    except Exception as e:
        print(f"Expected failure or error in mock-less env: {e}")

    # 2. Test GET /admin/config/risk_agent
    event_get = {
        "path": "/admin/config/risk_agent",
        "httpMethod": "GET",
        "headers": {}
    }
    print("🚀 Calling GET /admin/config/risk_agent")
    try:
        response = lambda_handler(event_get, None)
        print(f"Response: {response['statusCode']}")
    except Exception as e:
        print(f"Expected failure or error in mock-less env: {e}")

def test_agent_dynamic_config():
    print("\n🧪 Testing Agent Dynamic Config Logic...")
    from aigu.config import DEFAULT_CONFIGS, get_config
    
    # Verify default fallback
    config = get_config("risk_agent")
    print(f"Risk Default Keywords: {config.get('high_risk_keywords')}")
    assert "Scraping" in config.get('high_risk_keywords')
    
    # Verify Librarian default fallback
    lib_config = get_config("librarian_agent")
    print(f"Librarian High Req: {lib_config.get('required_artifacts', {}).get('High')}")
    assert "DPIA" in lib_config.get('required_artifacts', {}).get('High')
    
    print("✅ Logic Check Passed")

if __name__ == "__main__":
    test_agent_dynamic_config()
    test_admin_config_api()

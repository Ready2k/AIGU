import boto3
import json
import os
from typing import Dict, Any, List, Optional

# Configuration
REGION = os.environ.get("AWS_REGION", "us-east-1")
NOVA_MODEL_ID = os.environ.get("NOVA_MODEL_ID", "amazon.nova-pro-v1:0")

def get_bedrock_client():
    return boto3.client("bedrock-runtime", region_name=REGION)

def invoke_nova(
    system_prompt: str,
    messages: List[Dict[str, str]],
    max_tokens: int = 2000,
    temperature: float = 0.0
) -> str:
    """
    Invokes the Amazon Nova model using the Bedrock Converse API.
    """
    client = get_bedrock_client()
    
    # Format messages for Converse API
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            "role": msg["role"],
            "content": [{"text": msg["content"]}]
        })

    try:
        response = client.converse(
            modelId=NOVA_MODEL_ID,
            messages=formatted_messages,
            system=[{"text": system_prompt}],
            inferenceConfig={
                "maxTokens": max_tokens,
                "temperature": temperature
            }
        )
        
        return response["output"]["message"]["content"][0]["text"]
    except Exception as e:
        print(f"Error invoking Amazon Nova: {e}")
        # Fallback to a structured error message that agents can handle
        return json.dumps({
            "error": str(e),
            "fallback": True,
            "decision": "Manual Review Required"
        })

def query_nova_json(
    system_prompt: str,
    user_prompt: str,
    expected_keys: List[str]
) -> Dict[str, Any]:
    """
    Helper to get structured JSON output from Nova.
    Automatically appends JSON instructions to the prompt.
    """
    full_system = f"{system_prompt}\n\nYou MUST return a valid JSON object. Do not include any markdown formatting or extra text. Expected keys: {', '.join(expected_keys)}"
    
    response_text = invoke_nova(
        system_prompt=full_system,
        messages=[{"role": "user", "content": user_prompt}]
    )
    
    try:
        # Strip potential markdown code blocks if the model ignored instructions
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        
        return json.loads(clean_text.strip())
    except Exception as e:
        print(f"Failed to parse Nova JSON response: {e}")
        print(f"Raw response: {response_text}")
        return {k: "Error" for k in expected_keys}

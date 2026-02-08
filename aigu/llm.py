import boto3
import json
import os
from typing import Dict, Any, List, Optional

import os
from langfuse import Langfuse
from typing import Dict, Any, List, Optional

# Configuration
REGION = os.environ.get("AWS_REGION", "us-east-1")
DEFAULT_MODEL = os.environ.get("NOVA_MODEL_ID", "amazon.nova-pro-v1:0")
LANGFUSE_PUBLIC_KEY = os.environ.get("LANGFUSE_PUBLIC_KEY")
LANGFUSE_SECRET_KEY = os.environ.get("LANGFUSE_SECRET_KEY")
LANGFUSE_HOST = os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com")

# Initialize Langfuse
langfuse = Langfuse(
    public_key=LANGFUSE_PUBLIC_KEY,
    secret_key=LANGFUSE_SECRET_KEY,
    host=LANGFUSE_HOST
)

def get_langfuse_client():
    """
    Returns the initialized Langfuse client instance.
    """
    return langfuse

# Runtime Override
_runtime_model_override = None

_PROMPT_CACHE = {}

def set_model_id(model_id: str):
    global _runtime_model_override
    print(f"LLM: Setting runtime model override to: {model_id}")
    _runtime_model_override = model_id

def get_model_id() -> str:
    return _runtime_model_override or DEFAULT_MODEL

def get_active_prompt(prompt_name: str, tag: str = 'production'):
    """
    Fetches and caches the prompt object from LangFuse.
    """
    cache_key = f"{prompt_name}:{tag}"
    if cache_key in _PROMPT_CACHE:
        return _PROMPT_CACHE[cache_key]
    
    try:
        print(f"LangFuse: Fetching prompt '{prompt_name}' (tag: {tag})")
        prompt = langfuse.get_prompt(prompt_name, label=tag)
        _PROMPT_CACHE[cache_key] = prompt
        return prompt
    except Exception as e:
        print(f"Error fetching prompt {prompt_name}: {e}")
        # In production, you might want to load a local fallback file here
        raise e

def get_bedrock_client():
    return boto3.client("bedrock-runtime", region_name=REGION)

def invoke_nova(
    prompt_object: Any,  # LangFuse Prompt Object
    messages: List[Dict[str, str]],
    state: Optional[Dict[str, Any]] = None  # For variable substitution
) -> str:
    """
    Invokes Amazon Nova using LangFuse Prompt Object with dynamic config.
    
    Args:
        prompt_object: LangFuse Prompt Object with .prompt and .config
        messages: Conversation messages
        state: Optional state dict for prompt variable substitution
    
    Returns:
        Model response text
    """
    client = get_bedrock_client()
    
    # Extract system prompt (with variable substitution if state provided)
    system_prompt = prompt_object.prompt if hasattr(prompt_object, 'prompt') else str(prompt_object)
    
    # Try to compile prompt with state variables if available
    if state and hasattr(prompt_object, 'compile'):
        try:
            system_prompt = prompt_object.compile(**state)
        except Exception as e:
            print(f"Warning: Could not compile prompt with state: {e}")
            # Fall back to raw prompt
    
    # Extract config from LangFuse (with robust fallbacks)
    config = {}
    if hasattr(prompt_object, 'config') and prompt_object.config:
        config = prompt_object.config
    
    # User Request: Provide safe fallbacks for all config values
    model_id = config.get("model") or get_model_id() or "amazon.nova-lite-v1:0"
    parameters = config.get("parameters") or {}
    temperature = parameters.get("temperature", 0.3)  # Default for governance
    max_tokens = parameters.get("max_tokens", 500)   # Safe default for structured responses
    
    # Print only if debug is enabled or briefly
    print(f"LLM: Invoke {model_id} (T={temperature}, M={max_tokens})")
    
    # Format messages for Converse API
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            "role": msg["role"],
            "content": [{"text": msg["content"]}]
        })

    try:
        response = client.converse(
            modelId=model_id,
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
    prompt_name: str,
    user_prompt: str,
    expected_keys: List[str],
    state: Optional[Dict[str, Any]] = None,
    tag: str = 'production'
) -> Dict[str, Any]:
    """
    Helper to get structured JSON output from Nova using LangFuse prompts.
    
    Args:
        prompt_name: Name of the LangFuse prompt to fetch
        user_prompt: User message content
        expected_keys: Expected JSON keys in response
        state: Optional state dict for prompt variable substitution
        tag: LangFuse prompt label/tag (default: 'production')
    
    Returns:
        Parsed JSON dict or error dict
    """
    # Fetch prompt from LangFuse
    prompt_object = get_active_prompt(prompt_name, tag=tag)
    
    # Add JSON instructions to user prompt
    full_user_prompt = f"{user_prompt}\n\nYou MUST return a valid JSON object. Do not include any markdown formatting or extra text. Expected keys: {', '.join(expected_keys)}"
    
    response_text = invoke_nova(
        prompt_object=prompt_object,
        messages=[{"role": "user", "content": full_user_prompt}],
        state=state
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

import boto3
import os
import json
import time
from typing import Dict, Any
from functools import lru_cache

# Fail-safe defaults if DB is unreachable
DEFAULT_CONFIGS = {
    "risk_agent": {
        "high_risk_keywords": ["Scraping", "No-Reply", "100k+"],
        "sla_thresholds": {"High": 10, "Medium": 7, "Low": 3}
    },
    "librarian_agent": {
        "required_artifacts": {
            "High": ["intakeData", "technicalDesign", "DPIA", "securityReview", "complianceStatus"],
            "Medium": ["intakeData", "technicalDesign", "complianceStatus"],
            "Low": ["intakeData", "technicalDesign"]
        }
    }
}

class ConfigManager:
    _cache = {}
    _cache_ttl = 300 # 5 minutes

    @classmethod
    def get_config(cls, agent_id: str) -> Dict[str, Any]:
        now = time.time()
        
        # Check cache
        if agent_id in cls._cache:
            entry, expiry = cls._cache[agent_id]
            if now < expiry:
                return entry

        # Fetch from DynamoDB
        try:
            dynamodb = boto3.resource('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))
            table = dynamodb.Table(os.environ.get("CONFIG_TABLE_NAME", "AIGU_SystemConfig"))
            
            response = table.get_item(Key={"agentId": agent_id})
            if 'Item' in response:
                config_data = response['Item'].get('config', {})
                cls._cache[agent_id] = (config_data, now + cls._cache_ttl)
                return config_data
        except Exception as e:
            print(f"Error fetching config for {agent_id}: {e}")

        # Fallback to defaults
        return DEFAULT_CONFIGS.get(agent_id, {})

    @classmethod
    def update_config(cls, agent_id: str, config_data: Dict[str, Any], user: str = "system") -> bool:
        """Update configuration in DynamoDB and invalidate local cache."""
        try:
            dynamodb = boto3.resource('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))
            table = dynamodb.Table(os.environ.get("CONFIG_TABLE_NAME", "AIGU_SystemConfig"))
            
            timestamp = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            
            item = {
                "agentId": agent_id,
                "config": config_data,
                "lastUpdated": timestamp,
                "updatedBy": user
            }
            
            table.put_item(Item=item)
            
            # Invalidate cache
            if agent_id in cls._cache:
                del cls._cache[agent_id]
            
            return True
        except Exception as e:
            print(f"Error updating config for {agent_id}: {e}")
            return False

def get_config(agent_id: str) -> Dict[str, Any]:
    """Helper function to fetch agent configuration with caching."""
    return ConfigManager.get_config(agent_id)

def update_config(agent_id: str, config_data: Dict[str, Any], user: str = "system") -> bool:
    """Helper function to update agent configuration and invalidate cache."""
    return ConfigManager.update_config(agent_id, config_data, user)

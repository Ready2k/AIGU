import boto3
import os
import json
from datetime import datetime, timezone

def seed_system_config():
    print("🌱 Seeding AIGU_SystemConfig table...")
    
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table_name = os.environ.get("SYS_CONFIG_TABLE", "AIGU_SystemConfig")
    table = dynamodb.Table(table_name)
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    configs = [
        {
            "agentId": "risk_agent",
            "config": {
                "high_risk_keywords": ["Scraping", "No-Reply", "100k+"],
                "sla_thresholds": {"High": 10, "Medium": 7, "Low": 3}
            },
            "lastUpdated": timestamp,
            "updatedBy": "System Seed"
        },
        {
            "agentId": "librarian_agent",
            "config": {
                "required_artifacts": {
                    "High": ["intakeData", "technicalDesign", "DPIA", "securityReview", "complianceStatus"],
                    "Medium": ["intakeData", "technicalDesign", "complianceStatus"],
                    "Low": ["intakeData", "technicalDesign"]
                }
            },
            "lastUpdated": timestamp,
            "updatedBy": "System Seed"
        }
    ]
    
    for item in configs:
        print(f"  - Seeding {item['agentId']}...")
        table.put_item(Item=item)
        
    print("✅ Seeding complete.")

if __name__ == "__main__":
    seed_system_config()


import boto3
import os
import json

# Configuration
REGION = os.environ.get("AWS_REGION", "us-east-1")
TABLE_NAME = os.environ.get("CONFIG_TABLE_NAME", "AIGU_System_Config")

def seed_config():
    print(f"Seeding System Config to table: {TABLE_NAME} in {REGION}")
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)

    # 1. Risk Agent Config
    risk_config = {
        "configType": "AGENT_CONFIG",
        "configId": "risk_triage",
        "data": {
            "high_risk_keywords": ["Scraping", "PII", "Bio-metric", "Facial Recognition", "Medical"],
            "sla_days": {
                "High": 10,
                "Medium": 7,
                "Low": 3
            },
            "enabled": True
        }
    }

    # 2. Librarian Agent Config
    librarian_config = {
        "configType": "AGENT_CONFIG",
        "configId": "librarian",
        "data": {
            "required_artifacts": {
                "High": ["technicalDesign", "securityReview", "dataFlowDiagram", "complianceStatus"],
                "Medium": ["technicalDesign", "complianceStatus"],
                "Low": ["technicalDesign"]
            },
            "doc_retention_days": 365,
            "enabled": True
        }
    }

    try:
        print("Putting Risk Config...")
        table.put_item(Item=risk_config)
        
        print("Putting Librarian Config...")
        table.put_item(Item=librarian_config)
        
        print("✅ Configuration Seeded Successfully.")
    except Exception as e:
        print(f"❌ Error seeding config: {e}")

if __name__ == "__main__":
    seed_config()

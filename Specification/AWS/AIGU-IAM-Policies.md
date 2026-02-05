# AIGU AWS IAM Policy Requirements

This document outlines the security constraints for the 6-agent LangGraph orchestration.

## 1. Support & Insights Agent (Read-Only)
**Requirement:** Must be able to query the state but cannot modify it.
**Scope:** `SupportAgentRole`

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowStateReadAccess",
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:Query"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/AIGU_Global_State"
        },
        {
            "Sid": "AllowNovaInference",
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel"
            ],
            "Resource": "arn:aws:bedrock:*:*:foundation-model/amazon.nova-lite-v1:0"
        }
    ]
}
```
2. Governance Orchestrator (Write-Access)
Requirement: Agents like Intake, Risk, and Librarian must be able to update the "Brain" state.
Scope: OrchestratorAgentRole

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowStateFullAccess",
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/AIGU_Global_State"
        },
        {
            "Sid": "AllowNovaProInference",
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel"
            ],
            "Resource": "arn:aws:bedrock:*:*:foundation-model/amazon.nova-pro-v1:0"
        }
    ]
}
```
3. Compliance Guardrails
* State Table: Use DynamoDB "On-Demand" scaling to handle fluctuating governance requests.
* Audit Logs: The UpdateItem action for the Orchestrator must be used strictly to append to the auditLog list, never to delete previous entries.
* Model Choice: Use Nova Pro for complex reasoning (Risk & Gatekeeper) and Nova Lite for high-speed user support queries.
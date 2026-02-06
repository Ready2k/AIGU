# 📊 AIGU DynamoDB State Schema

This schema is designed to support the **LangGraph** "Brain" and ensure the **Support Agent** can recover sessions and provide transparency.

## 1. Table Configuration
- **Table Name:** `AIGU_Global_State`
- **Partition Key:** `submissionId` (String)
- **Sort Key:** `userId` (String) - Enables users to have multiple active submissions.

## 2. Item Structure (The "Single Source of Truth")

{
  "submissionId": "uuid-12345", 
  "userId": "user-888",
  "projectMetadata": {
    "name": "Project Antigravity",
    "riskLevel": "High",          // Low | Med | High
    "path": "Accelerator",        // Accelerator | BAU
    "currentStage": "Pilot"       // Intake | POC | Pilot | Production
  },
  "artifacts": {
    "intakeData": { ... },        // Replaces legacy intake forms
    "technicalDesign": { ... },   // Expanded for "High Risk"
    "complianceStatus": [         // Tracked by Gatekeeper Agent
       {"horizontal": "GIGC", "status": "Approved"},
       {"horizontal": "Legal", "status": "Challenged", "comment": "Review logging"}
    ]
  },
  "governance": {
    "status": "Blocked",          // Draft | In-Review | Blocked | Approved
    "slaDeadline": "2026-02-15",  // 3, 7, or 10 day logic
    "blockers": ["Legal Challenge"] // Surface for Support Agent
  },
  "auditLog": [                   // Immutable history for TDD/Compliance
    {
      "timestamp": "2026-02-05T22:00:00Z",
      "agent": "Risk & Triage",
      "action": "Elevated to High Risk",
      "reason": "GenAI Model used",
      "reasoningContext": "s3://aigu-artifacts/reasoning/uuid-123/risk-step-1.txt", // Full CoT
      "signature": "sha256-hash-of-entry", // Immutable verification
      "userIdentity": "arn:aws:sts::123:assumed-role/FederatedUser/jim" // HITL Attribution
    }
  ]
}

## 3. NEW Table: AIGU_System_Config
*This table allows Admins and Tribe Owners to tune the "Brain" logic.*

- **Partition Key:** `configType` (String) - e.g., "Tribe_Rule", "Global_Settings"
- **Sort Key:** `configId` (String) - e.g., "Legal_Gold_Standard", "Link_Whitelist"

### Config Item Examples:

#### A. Tribe Rule (Gold Standard)
{
  "configType": "Tribe_Rule",
  "configId": "Security_Artifacts",
  "owner": "CISO_Office",
  "mandatorySections": ["DataFlowDiagram", "IAM_Specs", "Encryption_Standard"],
  "goldStandardS3Uri": "s3://aigu-gold-standards/security-v1.pdf",
  "description": "The benchmark for all Security Technical Reviews."
}

#### B. Global Settings (Tuneable Items)
{
  "configType": "Global_Settings",
  "configId": "Verification_Parameters",
  "linkDomainWhitelist": ["github.com", "sharepoint.com", "internal.corp"],
  "deltaThreshold": 0.15, // 15% change triggers a "Blocked" state for Prod
  "allowAIAutoApproval": true
}
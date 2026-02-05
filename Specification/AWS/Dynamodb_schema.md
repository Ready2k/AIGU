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
      "reason": "GenAI Model used"
    }
  ]
}
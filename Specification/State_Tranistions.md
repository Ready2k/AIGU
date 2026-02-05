# 🔄 AIGU State Transition Logic

This document defines how the LangGraph orchestrator moves a submission between agents based on data input and governance logic.

## 1. Node Map & Triggers

| Current Node | Transition Trigger | Target Node | Action/Result |
| :--- | :--- | :--- | :--- |
| **Start** | User initiates new project | **Intake Orchestrator** | Initialize `submissionId` |
| **Intake** | Decision = 'Approved' | **Risk & Triage** | Set `projectMetadata.path` |
| **Intake** | Decision = 'Stop' | **Support Agent** | Notify user & End flow |
| **Risk & Triage** | Risk Calculated (L/M/H) | **Gov Librarian** | Set `slaDeadline` (3/7/10 days) |
| **Gov Librarian** | Template Condensed | **Gatekeeper** | Notify "Horizontals" (GIGC/Legal) |
| **Gatekeeper** | "Challenged" status | **Support Agent** | Flag `governance.blockers` |
| **Gatekeeper** | "Approved" status | **Outcome Tracker** | Move to `Production` stage |
| **Outcome** | KPIs Validated | **End** | Final Audit & Close Submission |

## 2. Global State Updates
Every transition must append an entry to the `auditLog`.
* **Example:** `{"agent": "Risk & Triage", "action": "Risk Escalated to High", "reason": "New GenAI Model detected"}`

## 3. The "Interrupt" Pattern
To handle the "Offline Approval" requirement (IMG_4590), the Graph must support a **Break** state:
* When `Gatekeeper` sends a notification to a Horizontal, the Graph enters a `waiting` state.
* The state is "hydrated" and resumes only when an external webhook or human-in-the-loop (HITL) signal is received.
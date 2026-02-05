```markdown
# 🧠 Project: Google Antigravity - The "Brain" Specification
**Project Goal:** A dynamic, LangGraph-powered governance service following A2UI principles.
**Core Principles:** Test-Driven Design, Clean React Native UI, Full Audit Logging, Incremental Risk Assessment.

---

## 1. The Global State Object (The Shared Memory)
All agents operate on this persistent state. This allows users to leave and return to their submission seamlessly.

```typescript
type RiskLevel = 'Low' | 'Med' | 'High' | 'Unknown';
type Stage = 'Intake' | 'POC' | 'Pilot' | 'Production';

interface AntigravityState {
  // Session Management
  submissionId: string;
  lastUpdated: string;
  userId: string;

  // Project Definition
  projectMetadata: {
    name: string;
    description: string;
    path: 'Accelerator' | 'BAU' | 'Stop';
    riskLevel: RiskLevel;
  };

  // The "9 different things" / Artifacts
  artifacts: {
    intakeData: Record<string, any>;
    technicalDesign: Record<string, any>;
    complianceChecklist: Array<{ horizontal: string; status: 'Pending' | 'Approved' | 'Challenged'; comments: string }>;
    kpiMetrics: Record<string, any>;
  };

  // Progress & Timelines
  governance: {
    currentStage: Stage;
    status: 'Draft' | 'In-Review' | 'Blocked' | 'Approved';
    slaDeadline: string | null; // e.g., 3, 7, or 10 days
    blockers: string[]; // Reasons for "Why is it taking so long?"
  };

  // Full Audit Logging
  auditLog: Array<{
    timestamp: string;
    agent: string;
    action: string;
    previousValue?: any;
    newValue?: any;
  }>;
}

```

---

## 2. Agent Roles & Logic

| Agent | Responsibility | Key "Brain" Logic |
| --- | --- | --- |
| **1. Intake Orchestrator** | Initial screening & route selection. | Maps idea to "Accelerator" or "BAU." Sets `currentStage` to 'Intake'. |
| **2. Risk & Triage** | Categorizes risk (Low/Med/High). | Calculates `slaDeadline` based on 3/7/10 day rules. Triggers "Additional Questions." |
| **3. Governance Librarian** | Artifact management & deduplication. | Checks `auditLog` to ensure users aren't re-entering data. Replaces 9 artifacts with 1. |
| **4. Gatekeeper** | Challenge/Approval & Horizontal Liaison. | Manages the "Offline Approval" flow. Notifies GIGC. Sets `status` to 'Blocked' if criteria aren't met. |
| **5. Outcome Tracker** | KPI & Production verification. | Ensures `incrementalRisksOnly` are measured during Pilot  Prod transition. |
| **6. Support & Insights** | User interface & Query handler. | **The "Why" Agent.** Interprets the `governance` state and `auditLog` to answer user queries. |

---

## 3. The "Support Agent" Interaction Logic

This agent provides the transparency required to solve the "Lack of understanding of the process" pain point.

### Query Handling Patterns:

* **"Where is it?"** * *Brain Logic:* Reads `governance.currentStage` and `governance.status`.
* *Response:* "You are currently in the **Pilot (High Risk)** stage. We are waiting for the **Horizontal Review**."


* **"How long will it take?"**
* *Brain Logic:* Compares `lastUpdated` vs `slaDeadline`.
* *Response:* "Based on your risk level, this usually takes 10 days. Your estimated decision date is **Oct 14th**."


* **"Why is it taking so long?"**
* *Brain Logic:* Scans `governance.blockers` and `complianceChecklist`.
* *Response:* "The **Legal Horizontal** has 'Challenged' the data privacy artifact. They require clarification on audit logging."



---

## 4. A2UI Integration (The "Face")

The React Native UI will be **driven by the State**, not hardcoded.

* **Resumability:** Upon login, the app queries the `submissionId`. If `status === 'Draft'`, A2UI renders the last incomplete section from `artifacts`.
* **Dynamic Content:** A2UI components listen to `projectMetadata.riskLevel`.
* If `Low`: Render a simple "Tickbox for LCT."
* If `High`: Render the full "Technical Design" module.


* **Audit Visualization:** A chronological feed component that maps the `auditLog` array into a user-friendly "Activity History."

---

## 5. Coding Directives (Antigravity Prototype)

1. **TDD:** Write a test case for every state transition (e.g., `test_intake_to_pilot_high_risk_transition`).
2. **Persistence:** Use a state-saving middleware so LangGraph can "hibernate" while waiting for offline approvals.
3. **Audit:** Every user interaction MUST trigger an `auditLog` entry. No silent state changes.

```

---
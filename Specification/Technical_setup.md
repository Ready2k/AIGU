# 🛠️ AIGU Technical Setup & Architecture

## 1. Technology Stack
* **Orchestration:** LangGraph (Python or JS)
* **LLM Interface:** Gemini 1.5 Pro (via Vertex AI)
* **Frontend:** React Native (Clean UI)
* **UI Framework:** [A2UI](https://github.com/google/A2UI)
* **Persistence:** Firestore / PostgreSQL (for session resumability)
* **Testing:** Pytest / Jest (TDD focus)

## 2. Directory Structure (Proposed)
```text
aigu-unit/
├── agents/             # LangGraph node definitions
│   ├── intake.py
│   ├── risk_triage.py
│   └── support.py      # Query handler for users
├── state/              # Schema definitions (The "Brain")
├── ui/                 # React Native / A2UI components
├── tests/              # TDD suite (State transition tests)
└── shared/             # Audit logging & notification utilities
```

## 🛡️ AIGU Implementation Guardrails
These are the non-negotiable technical constraints for the development of the AI Governance Unit (AIGU).

### A. User Session Recovery
* **Requirement:** The system must look up the `submissionId` upon every frontend mount. 
* **Logic:** If an active state exists in the database, the **Support Agent** must greet the user with a summary of progress rather than presenting a blank form. 
* **Goal:** Ensure seamless "resumability" across different sessions or devices.

### B. A2UI Dynamic Rendering
* **Requirement:** The frontend must not hardcode screens or linear flows. 
* **Logic:** The UI must be "state-driven," rendering components based on the `currentStage` and `riskLevel` stored in the state.
* **Example:** ```javascript
  if (state.riskLevel === 'High') { 
    render(AdvancedTechnicalModule) 
  }
  ```   
### C. The "Query" Interface (Support Agent)
* **Requirement:** The Support Agent must have "Read-Only" access to the global state and audit history.
* **Logic:** It is designed to explain "Why" a project is delayed or "Where" it sits in the flow.
* **Constraint:** It must never have the permission to modify approval statuses or bypass governance gates.
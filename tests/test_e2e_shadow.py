import pytest
from aigu.graph import build_aigu_graph
from aigu.state import GlobalState
import json

def test_e2e_shadow_run():
    """
    E2E Shadow Run: Full simulation from DiscoveryCanvas to Production.
    Equivalent to the UI driving the backend via useAiguState.js
    """
    app = build_aigu_graph()
    
    # 1. Start: User loads DiscoveryCanvas (Session Recovery Init)
    # Hooks: useAiguState(subId, userId) -> fetches empty/initial state
    state = {
        "submissionId": "shadow-1",
        "userId": "user-shadow",
        "artifacts": {},
        "projectMetadata": {},
        "governance": {},
        "auditLog": [],
        "systemConfig": {"deltaThreshold": 0.15, "linkDomainWhitelist": ["github.com"]}
    }
    
    print("\n--- Step 1: User submits Intake (UI: initiateIntake) ---")
    # UI Action: initiateIntake({ description: "GenAI Pilot Project" })
    # Backend: Graph runs Intake -> Risk -> Librarian -> Gatekeeper
    
    state["artifacts"]["intakeData"] = {
        "projectName": "Shadow Pilot", 
        "description": "GenAI Pilot Project"
    }
    
    # Invoke Graph (simulating the API Gateway call wrapper)
    state = app.invoke(state)
    
    # Validation 1: Check blocked state (Gatekeeper should have put it In-Review for High Risk)
    assert state["projectMetadata"]["riskLevel"] == "High"
    assert state["governance"]["status"] == "In-Review"
    print(f"Status: {state['governance']['status']}")
    print(f"Audit Log Triggered: {state['auditLog'][-1]['action']}")
    
    # 2. Offline Loop: Stakeholders Approve
    print("\n--- Step 2: Offline Approvals (UI: Polling...) ---")
    
    # Simulate External Signal (mocks what the Lambda callback does)
    state["artifacts"]["complianceStatus"] = [
        {"horizontal": "Legal", "status": "Approved"},
        {"horizontal": "GIGC", "status": "Approved"}
    ]
    state["artifacts"]["technicalDesign"] = {"repo": "http://github.com/my-org/code"} # Valid link
    
    # Invoke Graph again to process the signal
    state = app.invoke(state)
    
    # Validation 2: Should be Approved
    assert state["governance"]["status"] == "Approved"
    print(f"Status: {state['governance']['status']}")
    
    # 3. Pilot -> Production (Outcome Agent)
    print("\n--- Step 3: Transition to Prod (UI: submitDelta) ---")
    
    # Set stage to Pilot (Graph doesn't auto-move Intake->Pilot in this simplified version, manually set for simulation)
    state["projectMetadata"]["currentStage"] = "Pilot"
    
    # Scenario: Scope Creep Exceeded!
    state["artifacts"]["technicalDesign"]["scopeChange"] = 0.20 # 20% > 15%
    
    # Invoke Graph
    state = app.invoke(state)
    
    # Validation 3: Blocked by Delta
    assert state["governance"]["status"] == "Blocked"
    assert "Delta Threshold Exceeded" in state["governance"]["blockers"][0]
    print(f"Status: {state['governance']['status']} (Reason: {state['governance']['blockers'][0]})")
    
    # 4. User Acknowledges Delta (DeltaReview Screen)
    print("\n--- Step 4: User Acknowledges Delta (UI: submitDelta confirm) ---")
    
    # UI Action: Submits a new delta that is acceptable or overrides?
    # For this test, let's say they reduce scope to 10%
    state["artifacts"]["technicalDesign"]["scopeChange"] = 0.10
    state["governance"]["status"] = "Approved" # Reset status to allow re-check or Gatekeeper re-eval
    
    # Invoke Graph
    state = app.invoke(state)
    
    # Validation 4: Production
    assert state["projectMetadata"]["currentStage"] == "Production"
    print(f"Current Stage: {state['projectMetadata']['currentStage']}")
    print("--- E2E Simulation Complete ---")
    
    # Final Audit Log Dump
    print(f"\nTotal Audit Entries: {len(state['auditLog'])}")
    for entry in state['auditLog']:
        print(f"[{entry['timestamp']}] {entry['agent']}: {entry['action']}")

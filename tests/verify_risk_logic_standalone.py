
# Standalone logic verification
from typing import Literal, Dict, Any

# Mock GlobalState as dict
GlobalState = Dict[str, Any]

def route_risk_triage(state: GlobalState) -> Literal["poc", "librarian", "support"]:
    """
    Risk Triage Router: Evaluates path and risk level.
    (Copied from aigu/graph.py logic)
    """
    governance = state.get("governance", {})
    status = governance.get("status")
    
    # [OVERRIDE CHECK]
    if status in ["Blocked", "Rejected"]:
        print(f"  → Project is {status}: Routing to Support")
        return "support"

    metadata = state.get("projectMetadata", {})
    path = metadata.get("path", "Standard") # Default to standard if not set
    
    if path == "Stop":
        print("  → Routing to Support (project stopped)")
        return "support"
        
    if path == "Accelerator":
        print("  → Accelerator path: Routing to POC")
        return "poc"
    else:
        print("  → Standard path: Routing to Librarian (skipping sandbox)")
        return "librarian"

def test_risk_routing():
    print("Running Logic Verification...")
    
    # Case 1: Blocked regardless of path
    state_blocked = {
        "governance": {"status": "Blocked"},
        "projectMetadata": {"path": "Standard"}
    }
    assert route_risk_triage(state_blocked) == "support", "Case 1 Failed"
    print("Test 1 Passed: Blocked -> Support")

    # Case 2: Approved / Standard
    state_standard = {
        "governance": {"status": "Approved"},
        "projectMetadata": {"path": "Standard"}
    }
    assert route_risk_triage(state_standard) == "librarian", "Case 2 Failed"
    print("Test 2 Passed: Approved/Standard -> Librarian")

    # Case 3: Approved / Accelerator
    state_accel = {
        "governance": {"status": "Approved"},
        "projectMetadata": {"path": "Accelerator"}
    }
    assert route_risk_triage(state_accel) == "poc", "Case 3 Failed"
    print("Test 3 Passed: Approved/Accelerator -> POC")
    
    print("ALL TESTS PASSED")

if __name__ == "__main__":
    test_risk_routing()

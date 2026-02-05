import pytest
from aigu.agents.outcome import outcome_agent
from aigu.state import GlobalState

def test_outcome_pilot_to_prod():
    """
    TC-GAT-02 (Partial): Verify transition from Pilot to Production.
    """
    initial_state: GlobalState = {
        "submissionId": "test-out-1",
        "userId": "user-001",
        "projectMetadata": {"currentStage": "Pilot"},
        "governance": {"status": "Approved"},
        "artifacts": {},
        "auditLog": []
    }
    
    result = outcome_agent(initial_state)
    
    assert result["projectMetadata"]["currentStage"] == "Production"
    assert "Transitioned Pilot to Production" in result["auditLog"][-1]["reason"]

def test_outcome_fail_if_not_approved():
    """
    Ensure no transition if not approved (though graph shouldn't route here).
    """
    initial_state: GlobalState = {
        "submissionId": "test-out-2",
        "userId": "user-001",
        "projectMetadata": {"currentStage": "Pilot"},
        "governance": {"status": "Blocked"},
        "artifacts": {},
        "auditLog": []
    }
    
    result = outcome_agent(initial_state)
    
    assert not result # Empty dict

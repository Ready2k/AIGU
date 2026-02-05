import pytest
from aigu.agents.outcome import outcome_agent
from aigu.state import GlobalState

def test_outcome_delta_block():
    """
    Verification Rule 5: Auto-Block if Delta Threshold > Tunable Limit.
    """
    initial_state: GlobalState = {
        "submissionId": "test-ver-3",
        "userId": "u1",
        "systemConfig": {
            "deltaThreshold": 0.10 # 10% limit
        },
        "projectMetadata": {"currentStage": "Pilot"},
        "artifacts": {
            "technicalDesign": {
                "scopeChange": 0.25 # 25% change
            }
        },
        "governance": {"status": "Approved"},
        "auditLog": []
    }
    
    result = outcome_agent(initial_state)
    
    # Should block instead of transitioning
    assert result["governance"]["status"] == "Blocked"
    assert "Delta Threshold Exceeded" in result["governance"]["blockers"][0]
    assert result["auditLog"][-1]["action"] == "Delta Check Failed"

def test_outcome_delta_pass():
    """
    Verification Rule 5: Pass if Delta is within limits.
    """
    initial_state: GlobalState = {
        "submissionId": "test-ver-4",
        "userId": "u1",
        "systemConfig": {
            "deltaThreshold": 0.10 
        },
        "projectMetadata": {"currentStage": "Pilot"},
        "artifacts": {
            "technicalDesign": {
                "scopeChange": 0.05 # 5% change
            }
        },
        "governance": {"status": "Approved"},
        "auditLog": []
    }
    
    result = outcome_agent(initial_state)
    
    assert result["projectMetadata"]["currentStage"] == "Production"

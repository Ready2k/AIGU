import pytest
from aigu.agents.gatekeeper import gatekeeper_agent
from aigu.state import GlobalState

def test_gatekeeper_trigger_review():
    """
    Test that Gatekeeper initializes review for High Risk Draft projects.
    """
    initial_state: GlobalState = {
        "submissionId": "test-gate-1",
        "userId": "user-001",
        "projectMetadata": {"riskLevel": "High", "currentStage": "Intake"},
        "artifacts": {
            "complianceStatus": [] # Empty
        },
        "governance": {"status": "Draft"},
        "auditLog": []
    }
    
    result = gatekeeper_agent(initial_state)
    
    # Check Status Move
    assert result["governance"]["status"] == "In-Review"
    # Check Compliance Init
    compliance = result["artifacts"]["complianceStatus"]
    assert len(compliance) == 2 # Legal + GIGC
    assert compliance[0]["status"] == "Pending"
    # Check Audit
    assert "Initiated GIGC/Legal Review" in result["auditLog"][-1]["reason"]

def test_gatekeeper_blocking_signal():
    """
    TC-GAT-01 (Partial): Legal clicks 'Challenge'. 
    Expected: Governance status 'Blocked', blockers list populated.
    """
    initial_state: GlobalState = {
        "submissionId": "test-gate-2",
        "userId": "user-001",
        "projectMetadata": {"riskLevel": "High"},
        "artifacts": {
            "complianceStatus": [
                {"horizontal": "Legal", "status": "Challenged", "comment": "Data Privacy missing"},
                {"horizontal": "GIGC", "status": "Approved"}
            ]
        },
        "governance": {"status": "In-Review"},
        "auditLog": []
    }
    
    result = gatekeeper_agent(initial_state)
    
    assert result["governance"]["status"] == "Blocked"
    assert "Legal: Data Privacy missing" in result["governance"]["blockers"]
    assert "Blocked by 1 horizontal(s)" in result["auditLog"][-1]["reason"]

def test_gatekeeper_approval_signal():
    """
    TC-GAT-01 (Full): All Approved.
    Expected: Governance status 'Approved'.
    """
    initial_state: GlobalState = {
        "submissionId": "test-gate-3",
        "userId": "user-001",
        "projectMetadata": {"riskLevel": "High"},
        "artifacts": {
            "complianceStatus": [
                {"horizontal": "Legal", "status": "Approved"},
                {"horizontal": "GIGC", "status": "Approved"}
            ]
        },
        "governance": {"status": "Blocked", "blockers": ["Old Blocker"]}, # Was blocked
        "auditLog": []
    }
    
    result = gatekeeper_agent(initial_state)
    
    assert result["governance"]["status"] == "Approved"
    assert result["governance"]["blockers"] == [] # Cleared
    assert "All Horizontals Approved" in result["auditLog"][-1]["reason"]

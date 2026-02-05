import pytest
from aigu.agents.support import support_agent
from aigu.state import GlobalState

def test_support_blocked_msg():
    """
    TC-SUP-01: User queries 'Where is my project?' while in Legal Review (Blocked).
    Expected: Reports 'Blocked by Legal'.
    """
    initial_state: GlobalState = {
        "submissionId": "test-sup-1",
        "userId": "user-001",
        "projectMetadata": {"currentStage": "Pilot", "riskLevel": "High"},
        "artifacts": {},
        "governance": {
            "status": "Blocked",
            "blockers": ["Legal: Privacy Issue", "GIGC: Security Issue"]
        },
        "auditLog": []
    }
    
    result = support_agent(initial_state)
    ui = result["ui_overlay"]
    
    assert ui["showBlockerAlert"] is True
    assert "BLOCKED by 2 team(s)" in ui["supportMessage"]
    assert "Legal: Privacy Issue" in ui["supportMessage"]

def test_support_sla_msg():
    """
    Test SLA transparency in In-Review state.
    """
    initial_state: GlobalState = {
        "submissionId": "test-sup-2",
        "userId": "user-001",
        "projectMetadata": {"currentStage": "Pilot"},
        "artifacts": {},
        "governance": {
            "status": "In-Review",
            "slaDeadline": "2026-03-01"
        },
        "auditLog": []
    }
    
    result = support_agent(initial_state)
    ui = result["ui_overlay"]
    
    assert "Expected completion by 2026-03-01" in ui["supportMessage"]
    assert ui["slaDisplay"] == "2026-03-01"

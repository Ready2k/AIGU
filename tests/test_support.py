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
    # Relaxed assertions to be less sensitive to LLM wording
    assert "Legal" in ui["supportMessage"]
    assert "GIGC" in ui["supportMessage"] or "governance" in ui["supportMessage"].lower()

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
    
    # Relaxed assertion for date presence
    assert "2026-03-01" in ui["supportMessage"] or "March 1" in ui["supportMessage"]
    assert ui["slaDisplay"] == "2026-03-01"

def test_support_red_flag_warning():
    """
    TC-SUP-03: User provides a draft description with a red flag (scraping).
    Expected: Agent provides a Governance Warning.
    """
    initial_state: GlobalState = {
        "submissionId": "test-sup-3",
        "userId": "user-001",
        "projectMetadata": {
            "name": "Scraper Pro",
            "description": "I want to build a tool to scrape LinkedIn for lead generation.",
            "currentStage": "Intake"
        },
        "governance": {"status": "Draft"},
        "artifacts": {}
    }
    
    result = support_agent(initial_state)
    ui = result["ui_overlay"]
    
    assert "Governance Warning" in ui["supportMessage"]
    assert "compliance violations" in ui["supportMessage"]
    assert "Scraping" in ui["supportMessage"] or "scraping" in ui["supportMessage"].lower()

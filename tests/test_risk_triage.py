import pytest
from datetime import datetime, timedelta, timezone
from aigu.agents.risk_triage import risk_triage_agent
from aigu.state import GlobalState

def test_risk_high_sla():
    """
    TC-RSK-01: Project identified as 'High Risk' (GenAI).
    Expected: slaDeadline set to +10 days.
    """
    # Arrange
    initial_state: GlobalState = {
        "submissionId": "test-risk-1",
        "userId": "user-001",
        "projectMetadata": {"path": "Accelerator"},
        "artifacts": {
            "intakeData": {
                "projectName": "GenAI Chatbot",
                "description": "Using LLM for customer support."
            }
        },
        "governance": {},
        "auditLog": []
    }

    # Act
    result = risk_triage_agent(initial_state)

    # Assert
    assert result["projectMetadata"]["riskLevel"] == "High"
    
    # Verify SLA is roughly 10 days out
    sla_str = result["governance"]["slaDeadline"]
    target_date = (datetime.now(timezone.utc) + timedelta(days=10)).date().isoformat()
    assert sla_str == target_date
    
    # Audit Check
    assert result["auditLog"][-1]["agent"] == "Risk & Triage"
    assert "High" in result["auditLog"][-1]["action"]

def test_risk_low_sla():
    """
    TC-RSK-02: Project identified as 'Low Risk'.
    Expected: slaDeadline set to +3 days.
    """
    # Arrange
    initial_state: GlobalState = {
        "submissionId": "test-risk-2",
        "userId": "user-002",
        "projectMetadata": {"path": "BAU"},
        "artifacts": {
            "intakeData": {
                "projectName": "Simple Tool",
                "description": "Standard utility."
            }
        },
        "governance": {},
        "auditLog": []
    }

    # Act
    result = risk_triage_agent(initial_state)

    # Assert
    assert result["projectMetadata"]["riskLevel"] == "Low"
    
    # Verify SLA is roughly 3 days out
    sla_str = result["governance"]["slaDeadline"]
    target_date = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
    assert sla_str == target_date

def test_risk_core_principles_warning():
    """
    TC-RSK-03: Project violates Core Risk Principles (Scraping).
    Expected: RiskLevel set to 'High' and Governance Pre-Triage Warning in UI.
    """
    # Arrange
    initial_state: GlobalState = {
        "submissionId": "test-risk-3",
        "userId": "user-003",
        "projectMetadata": {"path": "Standard"},
        "artifacts": {
            "intakeData": {
                "projectName": "LinkedIn Scraper",
                "description": "I want to scrape LinkedIn to get lead contact info."
            }
        },
        "governance": {},
        "auditLog": []
    }

    # Act
    result = risk_triage_agent(initial_state)
    ui = result["ui_overlay"]

    # Assert
    assert result["projectMetadata"]["riskLevel"] == "High"
    assert "Governance Pre-Triage Warning" in ui["supportMessage"]
    
    # Verify the reasoning contains the violation context
    reasoning = result["chainOfThought"][-1]["reasoning"].lower()
    assert "scrape" in reasoning or "scraping" in reasoning or "data acquisition" in reasoning

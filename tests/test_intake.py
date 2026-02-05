import pytest
from aigu.agents.intake import intake_orchestrator
from aigu.state import GlobalState

def test_intake_accelerator_path():
    """
    TC-INT-01: User submits a project for a 'Hero Capability.'
    Expected: Intake Orchestrator marks path as 'Accelerator'.
    """
    # Arrange
    initial_state: GlobalState = {
        "submissionId": "test-123",
        "userId": "user-001",
        "projectMetadata": {},
        "artifacts": {
            "intakeData": {
                "projectName": "Super GenAI App",
                "description": "We want to build a Hero Capability using GenAI."
            }
        },
        "governance": {},
        "auditLog": []
    }

    # Act
    result = intake_orchestrator(initial_state)

    # Assert
    assert result["projectMetadata"]["path"] == "Accelerator"
    assert result["projectMetadata"]["currentStage"] == "Intake"
    
    # Audit Log Check
    assert len(result["auditLog"]) == 1
    audit = result["auditLog"][0]
    assert audit["agent"] == "Intake Orchestrator"
    assert audit["action"] == "Path set to Accelerator"
    assert "GenAI/Hero Capability detected" in audit["reason"]

def test_intake_bau_path():
    """
    TC-INT-02: User submits a non-AI standard request.
    Expected: Intake Orchestrator marks path as 'BAU'.
    """
    # Arrange
    initial_state: GlobalState = {
        "submissionId": "test-456",
        "userId": "user-002",
        "projectMetadata": {},
        "artifacts": {
            "intakeData": {
                "projectName": "Standard App",
                "description": "Just a standard crud app."
            }
        },
        "governance": {},
        "auditLog": []
    }

    # Act
    result = intake_orchestrator(initial_state)

    # Assert
    assert result["projectMetadata"]["path"] == "BAU"
    
def test_intake_stop_path():
    """
    Test fallback to Stop.
    """
    # Arrange
    initial_state: GlobalState = {
        "submissionId": "test-789",
        "userId": "user-003",
        "projectMetadata": {},
        "artifacts": {
            "intakeData": {
                "projectName": "Bad App",
                "description": "Doing something undefined."
            }
        },
        "governance": {},
        "auditLog": []
    }

    # Act
    result = intake_orchestrator(initial_state)

    # Assert
    assert result["projectMetadata"]["path"] == "Stop"

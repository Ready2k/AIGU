import pytest
from aigu.agents.librarian import librarian_agent
from aigu.state import GlobalState

def test_librarian_deduplication():
    """
    TC-LIB-01: Data present in Intake should be promoted to Technical Design
    without asking user again.
    """
    # Arrange
    initial_state: GlobalState = {
        "submissionId": "test-lib-1",
        "userId": "user-001",
        "projectMetadata": {"riskLevel": "Low"},
        "artifacts": {
            "intakeData": {
                "projectName": "Existing Project",
                "description": "Already captured description"
            },
            "technicalDesign": {} # Empty receiving artifact
        },
        "governance": {},
        "auditLog": []
    }

    # Act
    result = librarian_agent(initial_state)
    
    # Assert
    # Check Promotion
    tech_design = result["artifacts"]["technicalDesign"]
    assert tech_design["projectName"] == "Existing Project"
    assert tech_design["description"] == "Already captured description"
    
    # Check Audit
    audit = result["auditLog"][-1]
    assert audit["agent"] == "Gov Librarian"
    assert "Promoted keys: projectName, description" in audit["reason"]

def test_librarian_no_overwrite():
    """
    TC-LIB-02: If Technical Design has specific data, do not overwrite with generic Intake data.
    """
    # Arrange
    initial_state: GlobalState = {
        "submissionId": "test-lib-2",
        "userId": "user-001",
        "projectMetadata": {"riskLevel": "Low"},
        "artifacts": {
            "intakeData": {
                "projectName": "Generic Intake Name",
            },
            "technicalDesign": {
                "projectName": "Specific Technical Name" # Should persist
            }
        },
        "governance": {},
        "auditLog": []
    }

    # Act
    result = librarian_agent(initial_state)

    # Assert
    tech_design = result["artifacts"]["technicalDesign"]
    assert tech_design["projectName"] == "Specific Technical Name"
    assert "promoted" not in result["auditLog"][-1]["reason"].lower() # Should be no promotion

def test_librarian_compliance_init():
    """
    TC-LIB-03: High Risk projects must have complianceStatus initialized.
    """
    initial_state: GlobalState = {
        "submissionId": "test-lib-3",
        "userId": "user-001",
        "projectMetadata": {"riskLevel": "High"},
        "artifacts": {
             "intakeData": {},
             "technicalDesign": {}
        },
        "governance": {},
        "auditLog": []
    }
    
    result = librarian_agent(initial_state)
    
    assert "complianceStatus" in result["artifacts"]
    assert result["artifacts"]["complianceStatus"] == []

import pytest
from aigu.agents.gatekeeper import gatekeeper_agent
from aigu.state import GlobalState

def test_gatekeeper_bad_link_block():
    """
    Verification Rule 3: Links to non-whitelisted domains are flagged.
    """
    initial_state: GlobalState = {
        "submissionId": "test-ver-1",
        "userId": "u1",
        "systemConfig": {
            "linkDomainWhitelist": ["github.com", "internal.corp"] 
        },
        "projectMetadata": {"riskLevel": "Low"},
        "artifacts": {
            "technicalDesign": {
                "repo": "http://evil-site.com/malware"
            }
        },
        "governance": {"status": "Draft"},
        "auditLog": []
    }
    
    result = gatekeeper_agent(initial_state)
    
    # Should block
    assert result["governance"]["status"] == "Blocked"
    assert "Security Rule Violation" in result["governance"]["blockers"][0]
    assert "evil-site" in result["governance"]["blockers"][0]

def test_gatekeeper_good_link_pass():
    """
    Verification Rule 3: Whitelisted links pass.
    """
    initial_state: GlobalState = {
        "submissionId": "test-ver-2",
        "userId": "u1",
        "systemConfig": {
            "linkDomainWhitelist": ["github.com"] 
        },
        "artifacts": {
            "technicalDesign": {
                "repo": "http://github.com/my-org/repo" 
            },
            "complianceStatus": [{"horizontal": "Legal", "status": "Approved"}]
        },
        "projectMetadata": {"riskLevel": "High"},
        "governance": {"status": "Draft"}, # Will trigger eval
        "auditLog": []
    }
    
    result = gatekeeper_agent(initial_state)
    
    assert result["governance"]["status"] == "Approved"
    assert not result["governance"]["blockers"]

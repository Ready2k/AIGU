"""
Unit Tests for Multi-Stage Lifecycle Agents

Tests POC, Pilot, Production, and Handover agents with various scenarios.
"""

import pytest
from datetime import datetime, timedelta
from aigu.agents.poc import poc_agent
from aigu.agents.pilot import pilot_agent
from aigu.agents.production import production_agent
from aigu.agents.handover import handover_agent
from aigu.delta_calculator import calculate_delta, get_delta_details


class TestPOCAgent:
    """Tests for POC Agent"""
    
    def test_hero_capability_skips_poc(self):
        """Hero capabilities should skip POC and go directly to Pilot"""
        state = {
            "projectMetadata": {"capabilityType": "Hero"},
            "artifacts": {},
            "governance": {},
            "ui_overlay": {}
        }
        
        result = poc_agent(state)
        
        assert result["projectMetadata"]["currentStage"] == "Pilot"
        assert result["projectMetadata"]["pocRequired"] == False
        assert "proceeding directly" in result["ui_overlay"]["supportMessage"].lower()
    
    def test_new_capability_requires_poc(self):
        """New capabilities should require POC artifacts"""
        state = {
            "projectMetadata": {"capabilityType": "New"},
            "artifacts": {"pocData": {}},
            "governance": {},
            "ui_overlay": {}
        }
        
        result = poc_agent(state)
        
        assert result["projectMetadata"]["currentStage"] == "POC"
        assert result["projectMetadata"]["pocRequired"] == True
        assert result["governance"]["status"] == "Blocked"
        assert len(result["governance"]["blockers"]) > 0
    
    def test_poc_with_complete_artifacts(self):
        """POC with all required artifacts should be pending CAF approval"""
        state = {
            "projectMetadata": {"capabilityType": "New"},
            "artifacts": {
                "pocData": {
                    "testPlan": "Comprehensive test plan",
                    "successCriteria": "90% accuracy",
                    "resourceEstimate": "$50k",
                    "technicalApproach": "LLM-based approach",
                    "cafApprovalStatus": "Pending"
                }
            },
            "governance": {},
            "ui_overlay": {}
        }
        
        result = poc_agent(state)
        
        assert result["governance"]["status"] == "Pending"
        assert result["governance"]["blockers"] == []
        assert "CAF" in result["ui_overlay"]["supportMessage"]
    
    def test_poc_caf_approved(self):
        """POC with CAF approval should be ready for Pilot"""
        state = {
            "projectMetadata": {"capabilityType": "New"},
            "artifacts": {
                "pocData": {
                    "testPlan": "Test plan",
                    "successCriteria": "Criteria",
                    "resourceEstimate": "Estimate",
                    "technicalApproach": "Approach",
                    "cafApprovalStatus": "Approved"
                }
            },
            "governance": {},
            "ui_overlay": {}
        }
        
        result = poc_agent(state)
        
        assert result["governance"]["status"] == "POC-Approved"
        assert result["governance"]["blockers"] == []
        assert "approved" in result["ui_overlay"]["supportMessage"].lower()


class TestPilotAgent:
    """Tests for Pilot Agent"""
    
    def test_pilot_sla_low_risk(self):
        """Low risk projects should get 3-day SLA"""
        state = {
            "projectMetadata": {"riskLevel": "Low"},
            "governance": {},
            "artifacts": {},
            "ui_overlay": {}
        }
        
        result = pilot_agent(state)
        
        assert result["projectMetadata"]["currentStage"] == "Pilot"
        assert result["governance"]["slaDays"] == 3
        assert result["governance"]["slaType"] == "3-Day Pilot Review"
    
    def test_pilot_sla_medium_risk(self):
        """Medium risk projects should get 7-day SLA"""
        state = {
            "projectMetadata": {"riskLevel": "Med"},
            "governance": {},
            "artifacts": {},
            "ui_overlay": {}
        }
        
        result = pilot_agent(state)
        
        assert result["governance"]["slaDays"] == 7
        assert result["governance"]["slaType"] == "7-Day Pilot Review"
    
    def test_pilot_sla_high_risk(self):
        """High risk projects should get 10-day SLA"""
        state = {
            "projectMetadata": {"riskLevel": "High"},
            "governance": {},
            "artifacts": {},
            "ui_overlay": {}
        }
        
        result = pilot_agent(state)
        
        assert result["governance"]["slaDays"] == 10
        assert result["governance"]["slaType"] == "10-Day Pilot Review"
    
    def test_pilot_admin_approved(self):
        """Admin approval should activate pilot"""
        state = {
            "projectMetadata": {"riskLevel": "Med"},
            "governance": {"adminApproved": True},
            "artifacts": {},
            "ui_overlay": {}
        }
        
        result = pilot_agent(state)
        
        assert result["governance"]["status"] == "Pilot-Active"
        assert result["governance"]["adminApproved"] == True
        assert "pilotData" in result["artifacts"]
        assert "pilotStartDate" in result["artifacts"]["pilotData"]
    
    def test_pilot_admin_request_info(self):
        """Admin requesting info should block pilot"""
        state = {
            "projectMetadata": {"riskLevel": "Med"},
            "governance": {
                "adminAction": "ADMIN_REQUEST_INFO",
                "adminMessage": "Need more details"
            },
            "artifacts": {},
            "ui_overlay": {}
        }
        
        result = pilot_agent(state)
        
        assert result["governance"]["status"] == "Blocked"
        assert len(result["governance"]["blockers"]) > 0
        assert "Need more details" in result["ui_overlay"]["supportMessage"]


class TestProductionAgent:
    """Tests for Production Agent"""
    
    def test_production_no_delta(self):
        """Production without previous version should validate artifacts"""
        state = {
            "projectMetadata": {},
            "artifacts": {
                "productionData": {
                    "kpiMetrics": {"accuracy": 0.95},
                    "costAnalysis": {"monthly": 1000},
                    "incrementalRisk": "Low",
                    "outcomeReport": "Pilot successful"
                }
            },
            "governance": {},
            "ui_overlay": {}
        }
        
        result = production_agent(state)
        
        assert result["projectMetadata"]["currentStage"] == "Production"
        assert result["governance"]["status"] == "Production-Ready"
        assert result["governance"]["slaDays"] == 7
    
    def test_production_missing_artifacts(self):
        """Production with missing artifacts should be blocked"""
        state = {
            "projectMetadata": {},
            "artifacts": {"productionData": {}},
            "governance": {},
            "ui_overlay": {}
        }
        
        result = production_agent(state)
        
        assert result["governance"]["status"] == "Blocked"
        assert len(result["governance"]["blockers"]) == 4  # All 4 controls missing
    
    def test_production_delta_within_threshold(self):
        """Delta < 15% should proceed to production"""
        state = {
            "projectMetadata": {
                "previousVersionId": "v1",
                "deltaPercentage": 10.5
            },
            "artifacts": {
                "productionData": {
                    "kpiMetrics": {},
                    "costAnalysis": {},
                    "incrementalRisk": "Low",
                    "outcomeReport": "Report"
                }
            },
            "governance": {},
            "ui_overlay": {}
        }
        
        result = production_agent(state)
        
        assert result["governance"]["status"] == "Production-Ready"
        assert result["governance"]["blockers"] == []
    
    def test_production_delta_exceeds_threshold(self):
        """Delta > 15% should route back to GIGC"""
        state = {
            "projectMetadata": {
                "previousVersionId": "v1",
                "deltaPercentage": 18.5
            },
            "artifacts": {"productionData": {}},
            "governance": {},
            "ui_overlay": {}
        }
        
        result = production_agent(state)
        
        assert result["governance"]["status"] == "Pending"
        assert len(result["governance"]["blockers"]) > 0
        assert "18.5%" in result["governance"]["blockers"][0]
        assert "15%" in result["governance"]["blockers"][0]


class TestHandoverAgent:
    """Tests for Handover Agent"""
    
    def test_handover_approved_project(self):
        """Approved projects should transition to Live"""
        state = {
            "submissionId": "test-001",
            "projectMetadata": {"name": "Test Project", "riskLevel": "Med"},
            "governance": {"status": "Approved"},
            "artifacts": {},
            "ui_overlay": {},
            "auditLog": []
        }
        
        result = handover_agent(state)
        
        assert result["projectMetadata"]["currentStage"] == "Handover"
        assert result["governance"]["status"] == "Live"
        assert "handoverData" in result["artifacts"]
        assert len(result["artifacts"]["handoverData"]["tasks"]) == 3
    
    def test_handover_tasks_assigned(self):
        """Handover should assign tasks to IRIS, LCT, RTB"""
        state = {
            "submissionId": "test-001",
            "projectMetadata": {"name": "Test Project"},
            "governance": {"status": "Production-Ready"},
            "artifacts": {},
            "ui_overlay": {},
            "auditLog": []
        }
        
        result = handover_agent(state)
        
        tasks = result["artifacts"]["handoverData"]["tasks"]
        teams = [task["team"] for task in tasks]
        
        assert "IRIS" in teams
        assert "LCT" in teams
        assert "RTB" in teams
    
    def test_handover_not_approved(self):
        """Non-approved projects should not handover"""
        state = {
            "submissionId": "test-001",
            "projectMetadata": {},
            "governance": {"status": "Blocked"},
            "artifacts": {},
            "ui_overlay": {},
            "auditLog": []
        }
        
        result = handover_agent(state)
        
        # Should return unchanged state
        assert result["governance"]["status"] == "Blocked"


class TestDeltaCalculator:
    """Tests for Delta Calculation Engine"""
    
    def test_delta_no_change(self):
        """Identical versions should have 0% delta"""
        state = {
            "artifacts": {
                "intakeData": {
                    "description": "Test project",
                    "dataSources": ["S3", "RDS"],
                    "securityControls": "Encryption",
                    "architecture": "Serverless"
                }
            }
        }
        
        delta = calculate_delta(state, state)
        assert delta == 0.0
    
    def test_delta_major_change(self):
        """Major changes should exceed 15% threshold"""
        current = {
            "artifacts": {
                "intakeData": {
                    "description": "Completely different project with new scope and objectives",
                    "dataSources": ["S3", "RDS", "DynamoDB", "Kinesis"],
                    "securityControls": "Encryption at rest and in transit, MFA, VPC",
                    "architecture": "Microservices with API Gateway and Lambda"
                }
            }
        }
        
        previous = {
            "artifacts": {
                "intakeData": {
                    "description": "Original project",
                    "dataSources": ["S3"],
                    "securityControls": "Basic encryption",
                    "architecture": "Monolith"
                }
            }
        }
        
        delta = calculate_delta(current, previous)
        assert delta > 15.0
    
    def test_delta_details(self):
        """Delta details should identify specific changes"""
        current = {
            "artifacts": {
                "intakeData": {
                    "description": "Updated description",
                    "dataSources": ["S3", "RDS", "DynamoDB"],
                    "securityControls": "Enhanced security",
                    "architecture": "Serverless"
                }
            }
        }
        
        previous = {
            "artifacts": {
                "intakeData": {
                    "description": "Original description",
                    "dataSources": ["S3"],
                    "securityControls": "Basic security",
                    "architecture": "Serverless"
                }
            }
        }
        
        details = get_delta_details(current, previous)
        
        assert "deltaPercentage" in details
        assert "changes" in details
        assert len(details["changes"]) > 0
        
        # Should detect data source addition
        change_fields = [c["field"] for c in details["changes"]]
        assert "Data Sources" in change_fields


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

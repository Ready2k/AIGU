
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load .env BEFORE imports that might need AWS credentials
load_dotenv()

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from aigu.graph import app
from aigu.state import GlobalState

def print_step(title, state):
    print("\n" + "="*50)
    print(f"STEP: {title}")
    metadata = state.get("projectMetadata", {})
    gov = state.get("governance", {})
    print(f"Stage: {metadata.get('currentStage')} | Status: {gov.get('status')} | Path: {metadata.get('path')}")
    if gov.get('blockers'):
        print(f"Blockers: {gov.get('blockers')}")
    print("="*50)

def simulate_hero_path():
    print("🚀 SIMULATING ACCELERATOR PATH (Hero Capability)...")
    
    # 1. INITIAL INTAKE
    state: GlobalState = {
        "submissionId": "hero-sim-123",
        "userId": "tester-1",
        "artifacts": {
            "intakeData": {
                "projectName": "Hero Project",
                "description": "This is a new hero capability for our GenAI suite.",
                "dataSources": ["S3"],
                "securityControls": "None"
            }
        },
        "projectMetadata": {"capabilityType": "Hero"}, # Set by UI usually
        "governance": {"status": "New"},
        "auditLog": [],
        "ui_overlay": {}
    }

    # Step: Intake
    print("\n--- Running Intake ---")
    state = app.invoke(state)
    print_step("Intake Result", state)
    
    # Because it's Accelerator, it should route to POC.
    # POC Agent for Hero skips directly to Pilot.
    # So we should be at Pilot stage.
    
    # Step: Pilot (Admin Approval)
    print("\n--- Pilot: Simulating Admin Approval ---")
    state["governance"]["adminAction"] = "ADMIN_APPROVE"
    state["governance"]["adminApproved"] = True
    state = app.invoke(state)
    print_step("Pilot Approval Result", state)
    
    # Now it should be Pilot-Active.
    # Then it goes to Risk -> Librarian -> Gatekeeper.
    # We need to simulate Librarian artifacts.
    
    # Step: Librarian (Artifacts)
    print("\n--- Librarian: Providing Artifacts ---")
    state["artifacts"]["librarianData"] = {
        "securityReview": "Safe",
        "dataPrivacy": "GDPR Compliant",
        "legalApproval": "Approved"
    }
    state = app.invoke(state)
    print_step("Librarian Result", state)
    
    # Step: Gatekeeper (Final Pilot Approval)
    print("\n--- Gatekeeper: Final Pilot Approval ---")
    state["governance"]["adminAction"] = "ADMIN_APPROVE"
    # Gatekeeper should detect Pilot stage and route to Production stage.
    state = app.invoke(state)
    print_step("Gatekeeper Result", state)
    
    # Step: Production (Artifact Submission)
    print("\n--- Production: Submitting Controls ---")
    state["artifacts"]["productionData"] = {
        "kpiMetrics": {"summary": "KPIs met"},
        "costAnalysis": {"summary": "Within budget"},
        "incrementalRisk": "None",
        "outcomeReport": "Pilot successful"
    }
    # No delta for now (first production run)
    state = app.invoke(state)
    print_step("Production Result", state)
    
    # Step: Final Approval (Handover)
    print("\n--- Final Approval: Handover ---")
    state["governance"]["adminAction"] = "ADMIN_APPROVE"
    state["governance"]["status"] = "Approved" # Simulating final decision
    state = app.invoke(state)
    print_step("Handover Result", state)
    
    tasks = state.get("artifacts", {}).get("handoverData", {}).get("tasks", [])
    print(f"Handover Tasks Generated: {len(tasks)}")
    for t in tasks:
        print(f"  - [{t.get('team')}] {t.get('task')} (Due: {t.get('dueDate')})")

def simulate_new_capability_path():
    print("\n" + "#"*60)
    print("🚀 SIMULATING ACCELERATOR PATH (New Capability)...")
    print("#"*60)
    
    # 1. INITIAL INTAKE
    state: GlobalState = {
        "submissionId": "new-sim-456",
        "userId": "tester-2",
        "artifacts": {
            "intakeData": {
                "projectName": "New AI Algorithm",
                "description": "This is a brand new GenAI capability requiring deep research.",
                "dataSources": ["Personal S3"],
                "securityControls": "None"
            }
        },
        "projectMetadata": {"capabilityType": "New"},
        "governance": {"status": "New"},
        "auditLog": [],
        "ui_overlay": {}
    }

    # Step: Intake
    state = app.invoke(state)
    print_step("Intake Result (Should require POC)", state)
    
    # Step: POC (Artifact Submission)
    print("\n--- POC: Submitting Test Plan ---")
    state["artifacts"]["pocData"] = {
        "testPlan": "POC Test Plan",
        "successCriteria": "95%",
        "resourceEstimate": "$20k",
        "technicalApproach": "Novel architecture",
        "cafApprovalStatus": "Pending"
    }
    state = app.invoke(state)
    print_step("POC Artifact Result", state)
    
    # Step: CAF Approval
    print("\n--- POC: CAF Approval ---")
    state["artifacts"]["pocData"]["cafApprovalStatus"] = "Approved"
    state = app.invoke(state)
    print_step("CAF Approval Result", state)
    
    # Now it should be Pilot.
    # Step: Pilot Activation
    state["governance"]["adminAction"] = "ADMIN_APPROVE"
    state["governance"]["adminApproved"] = True
    state = app.invoke(state)
    print_step("Pilot Activation Result", state)

def simulate_delta_review():
    print("\n" + "#"*60)
    print("🚀 SIMULATING DELTA REVIEW (>15% Change)...")
    print("#"*60)
    
    # 1. Pilot State (Previous Version)
    previous_state = {
        "submissionId": "delta-v1",
        "artifacts": {
            "intakeData": {
                "projectName": "Delta Project",
                "description": "Original simple chatbot.",
                "dataSources": ["S3"],
                "securityControls": "None",
                "architecture": "Single Lambda"
            }
        },
        "projectMetadata": {"currentStage": "Pilot-Complete"}
    }
    
    # 2. Production Submission (Major Change)
    current_state: GlobalState = {
        "submissionId": "delta-v2",
        "userId": "tester-3",
        "artifacts": {
            "intakeData": {
                "projectName": "Delta Project v2",
                "description": "Now a multi-agent system with deep integration and autonomous decision making.",
                "dataSources": ["S3", "RDS", "DynamoDB", "External API"],
                "securityControls": "MFA, VPC, Encryption, IAM Roles",
                "architecture": "Microservices with Step Functions and Bedrock"
            },
            "productionData": {
                "kpiMetrics": {"summary": "High KPIs"},
                "costAnalysis": {"summary": "Economical"},
                "incrementalRisk": "Medium",
                "outcomeReport": "Pilot done"
            }
        },
        "projectMetadata": {
            "currentStage": "Production",
            "path": "Accelerator",
            "previousVersionId": "delta-v1",
            "deltaPercentage": 45.5 # Simulated calculation
        },
        "governance": {"status": "New"},
        "auditLog": [],
        "ui_overlay": {}
    }

    print("\n--- Production: Submitting with 45.5% Delta ---")
    current_state = app.invoke(current_state)
    print_step("Production Delta Result (Should route to Gatekeeper)", current_state)

def simulate_standard_path():
    print("\n" + "#"*60)
    print("🚀 SIMULATING STANDARD PATH (Soft Pivot)...")
    print("#"*60)
    
    # 1. INITIAL INTAKE
    state: GlobalState = {
        "submissionId": "standard-sim-789",
        "userId": "tester-4",
        "artifacts": {
            "intakeData": {
                "projectName": "Internal Wiki Migration",
                "description": "Just migrating some internal wiki pages to a new platform. No AI involved.",
                "dataSources": ["VPC"],
                "securityControls": "Standard"
            }
        },
        "projectMetadata": {}, # Empty
        "governance": {"status": "New"},
        "auditLog": [],
        "ui_overlay": {}
    }

    # Step: Intake
    state = app.invoke(state)
    print_step("Intake Result (Should be Standard)", state)
    
    # It should route to risk_triage in the graph.
    # Standard path: Risk -> Handover.
    state = app.invoke(state)
    print_step("Final Result (Should be Auto-Approved)", state)

if __name__ == "__main__":
    # Mock environment for local execution
    os.environ["DYNAMODB_TABLE_NAME"] = "AIGU_Global_State"
    simulate_hero_path()
    simulate_new_capability_path()
    simulate_delta_review()
    simulate_standard_path()


import os
import sys
import json
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Load .env
load_dotenv()

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from aigu.graph import app
from aigu.state import GlobalState

def print_audit_step(title, state):
    print("\n" + "🛡️ " + "="*60)
    print(f"AUDIT STEP: {title}")
    metadata = state.get("projectMetadata", {})
    gov = state.get("governance", {})
    artifacts = state.get("artifacts", {})
    
    print(f"  Stage:    {metadata.get('currentStage')}")
    print(f"  Status:   {gov.get('status')}")
    print(f"  Path:     {metadata.get('path')}")
    print(f"  Risk:     {metadata.get('riskLevel')}")
    print(f"  SLA DL:   {gov.get('slaDeadline')}")
    
    if gov.get('blockers'):
        print(f"  Blockers: {gov.get('blockers')}")
    
    # Check for PII handling confirmation in Audit Log
    last_audit = state.get("auditLog", [])[-1] if state.get("auditLog") else {}
    print(f"  Last Action: {last_audit.get('action')} - {last_audit.get('reason')}")
    print("="*60)

def ultimate_audit():
    print("🎯 STARTING ULTIMATE AUDIT: PROJECT SYNERGY")
    
    # 1. INITIAL INTAKE
    # Description specifically mentions PII and high-impact AI
    description = (
        "Project Synergy: A high-impact multi-agent orchestration system for customer support. "
        "This project handles sensitive Personal Identifiable Information (PII) including customer names, "
        "emails, and transaction history to provide personalized financial advice using advanced LLMs."
    )
    
    state: GlobalState = {
        "submissionId": "synergy-audit-999",
        "userId": "senior-auditor",
        "artifacts": {
            "intakeData": {
                "projectName": "Project Synergy",
                "description": description
            }
        },
        "projectMetadata": {}, # Fresh start
        "governance": {"status": "New"},
        "auditLog": [],
        "ui_overlay": {}
    }

    # --- PHASE 1: INTAKE ---
    print("\n[Audit] Invoke: Intake Orchestrator")
    state = app.invoke(state)
    print_audit_step("Intake Result (Should be Accelerator)", state)
    
    # --- PHASE 2: POC (if routed there) ---
    # The graph routes Accelerator/Intake -> POC
    if state["projectMetadata"].get("currentStage") == "POC":
        print("\n[Audit] Invoke: POC Agent (Approving for Pilot)")
        state["artifacts"]["pocData"] = {
            "testPlan": "Synergy PII Secure Test Plan",
            "cafApprovalStatus": "Approved" # Move to Pilot
        }
        state["governance"]["status"] = "POC-Approved"
        state = app.invoke(state)
        print_audit_step("POC result", state)

    # --- PHASE 3: PILOT & RISK TRIAGE ---
    # Graph routes Pilot -> Risk Triage
    # We should see the 10-day SLA here
    print("\n[Audit] Invoke: Pilot & Risk Triage")
    state = app.invoke(state)
    print_audit_step("Risk Triage Result (Expected: High Risk, 10-day SLA)", state)
    
    # Verification of SLA
    risk_level = state["projectMetadata"].get("riskLevel")
    sla_deadline_str = state["governance"].get("slaDeadline")
    
    if risk_level == "High" and sla_deadline_str:
        deadline = datetime.fromisoformat(sla_deadline_str)
        today = datetime.now(timezone.utc).date()
        days_diff = (deadline.date() - today).days
        print(f"✅ VERIFIED: Risk Level is {risk_level} and SLA is set for approximately {days_diff} days.")
    else:
        print(f"❌ FAILED: Risk Level {risk_level} or SLA {sla_deadline_str} incorrect.")

    # --- PHASE 4: LIBRARIAN & GATEKEEPER ---
    # Risk Triage -> Librarian -> Gatekeeper
    print("\n[Audit] Invoke: Librarian & Gatekeeper Cycle")
    state = app.invoke(state)
    print_audit_step("Librarian & Gatekeeper (In-Review)", state)

    # --- PHASE 5: ADMIN APPROVAL ---
    # Simulate the Admin Queue approval
    print("\n[Audit] Simulating Admin approval for Pilot -> Production")
    state["governance"]["adminAction"] = "ADMIN_APPROVE"
    state = app.invoke(state)
    print_audit_step("Post-Approval Result (Should move to Production)", state)

    # Final Verification
    final_status = state["governance"].get("status")
    final_stage = state["projectMetadata"].get("currentStage")
    
    if final_status == "Approved" or final_stage == "Production":
        print("\n🏆 ULTIMATE AUDIT PASSED: Project Synergy successfully navigated governance with proper risk scoring.")
    else:
        print(f"\n⚠️ AUDIT INCOMPLETE: Final state was {final_status} in stage {final_stage}.")

if __name__ == "__main__":
    # Ensure Nova is available or expected to be called
    if not os.environ.get("AWS_REGION"):
        os.environ["AWS_REGION"] = "us-east-1"
    
    # Run the audit
    try:
        ultimate_audit()
    except Exception as e:
        print(f"\n💥 AUDIT CRASHED: {e}")
        import traceback
        traceback.print_exc()

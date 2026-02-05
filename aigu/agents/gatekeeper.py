from datetime import datetime, timezone
from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry

def gatekeeper_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Gatekeeper Agent Node.
    Manages 'Offline Approvals' and transitions based on External Signals.
    Ref: agents/gatekeeper.md, A2UI/OFFLINE_WORKFLOW_MECHANISM.md
    """
    project_metadata = state.get("projectMetadata", {})
    risk_level = project_metadata.get("riskLevel", "Low")
    current_stage = project_metadata.get("currentStage", "Intake")
    
    artifacts = state.get("artifacts", {})
    compliance_status = artifacts.get("complianceStatus", [])
    
    governance = state.get("governance", {})
    current_status = governance.get("status", "Draft")
    
    action_log = []
    
    # New State Containers
    new_governance = governance.copy()
    new_compliance = compliance_status[:] # Shallow copy list
    
    # Logic 1: Triggering Event (Review Ready -> In-Review)
    # If High Risk and we haven't started reviews yet (and not already broken/approved)
    if risk_level == "High" and not compliance_status and current_status == "Draft":
        # Initialize Reviews
        # In a real app, we'd determine WHICH horizontals based on artifacts
        # For simulation, we add 'Legal' and 'GIGC'
        new_compliance = [
            {"horizontal": "Legal", "status": "Pending"},
            {"horizontal": "GIGC", "status": "Pending"}
        ]
        new_governance["status"] = "In-Review"
        action_log.append("Initiated GIGC/Legal Review")
        action_log.append("SES Notification Sent (Mock)")
        
    # Logic 2: Evaluate Signals (The Loop)
    # Check the complianceStatus array for external updates
    
    blockers = []
    all_approved = True
    has_pending = False
    
    if new_compliance:
        for item in new_compliance:
            status = item.get("status", "Pending")
            if status == "Challenged":
                all_approved = False
                comment = item.get("comment", "No comment provided")
                blockers.append(f"{item['horizontal']}: {comment}")
            elif status == "Pending":
                all_approved = False
                has_pending = True
            elif status == "Approved":
                pass # Good
    
    # Logic 3: State Mutation
    if blockers:
        new_governance["status"] = "Blocked"
        new_governance["blockers"] = blockers
        action_log.append(f"Blocked by {len(blockers)} horizontal(s)")
    elif all_approved and new_compliance: # Must have at least one approval to be approved
        new_governance["status"] = "Approved"
        new_governance["blockers"] = [] # Clear blockers
        action_time = "Production" if current_stage == "Pilot" else "Pilot" # Move to next? 
        # For simplicity, we just mark status Approved. The graph orchestrator handles stage moves usually.
        # But Gatekeeper spec says "Transitions project to the next node."
        action_log.append("All Horizontals Approved")
    elif has_pending:
        # Still waiting
        new_governance["status"] = "In-Review"
    
    # Logic 4: Incremental Risk (Pilot -> Prod) check
    # If we are already in Pilot and Status is Approved, we might move to Prod
    if current_stage == "Pilot" and new_governance["status"] == "Approved":
        # Check if this is a delta review? 
        # For now, we assume if we reached Approved in Pilot, we are ready for Outcome
        pass

    # Audit Log
    if action_log:
        audit_entry: AuditLogEntry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent": "Gatekeeper",
            "action": "Gateway Evaluation",
            "reason": "; ".join(action_log)
        }
        new_audit_log = state.get("auditLog", []).copy()
        new_audit_log.append(audit_entry)
        return {
            "governance": new_governance,
            "artifacts": {**artifacts, "complianceStatus": new_compliance},
            "auditLog": new_audit_log
        }
    
    return {} # No change

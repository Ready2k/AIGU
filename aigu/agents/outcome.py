from typing import Dict, Any, List
from datetime import datetime, timezone
from aigu.state import GlobalState, AuditLogEntry

def outcome_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Outcome Tracker Agent Node.
    Handles Pilot -> Production transition and Final Logic.
    Ref: agents/outcome.md
    """
    project_metadata = state.get("projectMetadata", {})
    current_stage = project_metadata.get("currentStage", "Pilot")
    governance = state.get("governance", {})
    status = governance.get("status", "Unknown")
    
    # Validation: Can only run if Approved
    if status != "Approved":
        return {} # Should ideally raise error or log warning
        
    action_log = []
    new_stage = current_stage
    
    # Logic: Move Stage
    if current_stage == "Pilot":
        new_stage = "Production"
        action_log.append("Transitioned Pilot to Production")
    elif current_stage == "Production":
        action_log.append("Final Governance Review Complete")
        # Could mark as Archived or Live-Monitored
        
    # Validation of Incremental Delta (Stub)
    # in real app, we check KPIs here
    
    # Audit Log
    audit_entry: AuditLogEntry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent": "Outcome Tracker",
        "action": "Stage Transition" if new_stage != current_stage else "Final Sign-off",
        "reason": "; ".join(action_log)
    }
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    new_metadata = project_metadata.copy()
    new_metadata["currentStage"] = new_stage
    
    return {
        "projectMetadata": new_metadata,
        "auditLog": new_audit_log
    }

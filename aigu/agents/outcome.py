from datetime import datetime, timezone
from typing import Dict, Any
from aigu.state import GlobalState, AuditLogEntry

def outcome_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Outcome Tracker Agent Node.
    Handles Pilot -> Production transition and Verification Rules (Delta Threshold).
    Ref: agents/outcome.md
    Ref: verification_rules.md
    """
    project_metadata = state.get("projectMetadata", {})
    current_stage = project_metadata.get("currentStage", "Pilot")
    governance = state.get("governance", {})
    status = governance.get("status", "Unknown")
    
    # NEW: System Config
    system_config = state.get("systemConfig", {})
    delta_threshold = system_config.get("deltaThreshold", 0.15) # Default 15%
    
    if status != "Approved":
        return {}
        
    action_log = []
    new_stage = current_stage
    blockers = []
    
    # Logic: Move Stage
    if current_stage == "Pilot":
        # Verification Rule 5: Incremental Delta & Scope Creep
        # In a real app, this compares the Technical Design JSON Diff
        # For simulation, we check for a 'metrics' artifact or similar stub
        # We'll simulate a 'scopeChange' metric injected into artifacts
        
        artifacts = state.get("artifacts", {})
        tech_design = artifacts.get("technicalDesign", {})
        scope_change = tech_design.get("scopeChange", 0.0) # Float 0.0 to 1.0
        
        if scope_change > delta_threshold:
            # Auto-BIock per Rule 5
            new_governance = governance.copy()
            new_governance["status"] = "Blocked"
            new_governance["blockers"] = [f"Delta Threshold Exceeded ({scope_change*100}% > {delta_threshold*100}%)"]
            
            audit_entry: AuditLogEntry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "agent": "Outcome Tracker",
                "action": "Delta Check Failed",
                "reason": "Scope creep exceeded tuneable threshold"
            }
            new_audit_log = state.get("auditLog", []).copy()
            new_audit_log.append(audit_entry)
            
            return {
                "governance": new_governance,
                "auditLog": new_audit_log
            }
            
        else:
            new_stage = "Production"
            action_log.append("Transitioned Pilot to Production")
            
    elif current_stage == "Production":
        action_log.append("Final Governance Review Complete")
        
    # Validation Passed
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

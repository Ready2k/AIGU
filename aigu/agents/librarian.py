from datetime import datetime, timezone
from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry

def librarian_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Governance Librarian Agent Node.
    Consolidates data into the 'technicalDesign' artifact and prevents duplication.
    Ref: agents/librarian.md
    """
    artifacts = state.get("artifacts", {})
    intake_data = artifacts.get("intakeData", {})
    tech_design = artifacts.get("technicalDesign", {})
    
    action_log = []
    
    # 1. Deduplication Logic
    # Verify if core fields already exist in technicalDesign before overwriting/requesting
    # In this simulation, we "promote" intake data to technical design if missing
    
    fields_to_promote = ["projectName", "description"]
    promoted_fields = []
    
    for field in fields_to_promote:
        if field in intake_data and field not in tech_design:
            tech_design[field] = intake_data[field]
            promoted_fields.append(field)
            
    # 2. Artifact Management (Condensation)
    # Ensure the technicalDesign has the correct structure for the Gatekeeper
    # If High Risk, we explicitly initialize the compliance section if missing
    risk_level = state.get("projectMetadata", {}).get("riskLevel", "Low")
    
    if risk_level == "High" and "complianceStatus" not in artifacts:
        # Initialize empty compliance list for Gatekeeper to track
        artifacts["complianceStatus"] = []
        action_log.append("Initialized Compliance Status for High Risk")

    # Audit Entry
    if promoted_fields:
        action_log.append(f"Promoted keys: {', '.join(promoted_fields)}")
    
    action_msg = "Artifacts Consolidated"
    reason_msg = "Deduplication check complete"
    
    if not action_log:
        reason_msg = "No new data to merge"
        
    audit_entry: AuditLogEntry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent": "Gov Librarian",
        "action": action_msg,
        "reason": f"{reason_msg}. Actions: {'; '.join(action_log)}"
    }
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    return {
        "artifacts": artifacts, # Updated in-place but returned to be explicit
        "auditLog": new_audit_log
    }

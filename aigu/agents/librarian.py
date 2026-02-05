from datetime import datetime, timezone
from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry

def librarian_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Governance Librarian Agent Node.
    Consolidates data into the 'technicalDesign' artifact and prevents duplication.
    Ref: agents/librarian.md
    Ref: verification_rules.md
    """
    artifacts = state.get("artifacts", {})
    intake_data = artifacts.get("intakeData", {})
    tech_design = artifacts.get("technicalDesign", {})
    
    # NEW: System Config for Mandatory Sections
    # In a real app, this is fetched from the NEW Table: AIGU_System_Config
    # For simulation, we assume it's injected into state or we default it
    system_config = state.get("systemConfig", {})
    mandatory_sections = system_config.get("mandatorySections", ["DataFlowDiagram", "IAM_Specs"])
    
    action_log = []
    
    # 1. Deduplication Logic
    fields_to_promote = ["projectName", "description"]
    promoted_fields = []
    for field in fields_to_promote:
        if field in intake_data and field not in tech_design:
            tech_design[field] = intake_data[field]
            promoted_fields.append(field)
            
    # 2. Automated Content Review (Mandatory Sections)
    # Check if technicalDesign contains the mandatory keys (simulated verification)
    missing_sections = []
    # Only verify if we are actively building tech design (e.g. Risk > Low)
    risk_level = state.get("projectMetadata", {}).get("riskLevel", "Low")
    
    if risk_level in ["Med", "High"]:
        for section in mandatory_sections:
            if section not in tech_design:
                missing_sections.append(section)
    
    # 3. Artifact Management
    if risk_level == "High" and "complianceStatus" not in artifacts:
        artifacts["complianceStatus"] = []
        action_log.append("Initialized Compliance Status for High Risk")

    # Audit Entry
    status_msg = "Artifacts Consolidated"
    if promoted_fields:
        action_log.append(f"Promoted keys: {', '.join(promoted_fields)}")
    
    if missing_sections:
        action_log.append(f"Missing Mandatory Sections: {', '.join(missing_sections)}")
        # In a real app we might flag this as 'Incomplete' in state
    
    reason_msg = "Deduplication check complete"
    if not action_log:
        reason_msg = "No new data to merge"
        
    audit_entry: AuditLogEntry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent": "Gov Librarian",
        "action": status_msg,
        "reason": f"{reason_msg}. Actions: {'; '.join(action_log)}"
    }
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    return {
        "artifacts": artifacts, 
        "auditLog": new_audit_log
    }

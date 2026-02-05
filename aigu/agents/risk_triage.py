from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Literal
from aigu.state import GlobalState, AuditLogEntry

def risk_triage_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Risk & Triage Agent Node.
    Analyzes project details to assign Risk Level and SLA Deadlines.
    Ref: agents/risk_triage.md
    """
    intake_data = state.get("artifacts", {}).get("intakeData", {})
    description = intake_data.get("description", "").lower()
    path = state.get("projectMetadata", {}).get("path", "BAU")
    
    risk_level: Literal["Low", "Med", "High"] = "Low"
    sla_days = 3
    
    # Logic based on agents/risk_triage.md
    if path == "Accelerator" or "genai" in description or "llm" in description:
        risk_level = "High"
        sla_days = 10
    elif "internal data" in description or "new implementation" in description:
        risk_level = "Med"
        sla_days = 7
    else:
        # Default Low
        risk_level = "Low"
        sla_days = 3
        
    # Calculate Deadline
    # For simulation purposes, we set a fixed date relative to "now". 
    # In a real app, this would be strictly business days.
    deadline_date = datetime.now(timezone.utc) + timedelta(days=sla_days)
    sla_deadline_str = deadline_date.date().isoformat()
    
    # Update State
    new_metadata = state.get("projectMetadata", {}).copy()
    new_metadata["riskLevel"] = risk_level
    
    new_governance = state.get("governance", {}).copy()
    new_governance["slaDeadline"] = sla_deadline_str
    # If High Risk, we might want to flag specific A2UI components in a real app,
    # but the A2UI Component Map says it reacts to 'riskLevel', so state update is sufficient.

    # Audit Log
    audit_entry: AuditLogEntry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent": "Risk & Triage",
        "action": f"Risk set to {risk_level}",
        "reason": f"SLA set to {sla_days} days based on content analysis"
    }
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    return {
        "projectMetadata": new_metadata,
        "governance": new_governance,
        "auditLog": new_audit_log
    }

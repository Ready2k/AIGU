from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Literal
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity

def risk_triage_agent(state: GlobalState) -> Dict[str, Any]:
    project_metadata = state.get("projectMetadata", {})
    description = state.get("artifacts", {}).get("intakeData", {}).get("description", "").lower()
    path = project_metadata.get("path", "Stop")
    submission_id = state.get("submissionId", "unknown")
    
    risk_level: Literal["Low", "Med", "High"] = "Low"
    sla_days = 3
    
    cot_steps = [
        f"Path: {path}",
        "Evaluating usage of LLMs, Internal Data, or New Implementation context..."
    ]

    if path == "Accelerator" or "genai" in description or "llm" in description:
        risk_level = "High"
        sla_days = 10
        cot_steps.append("High Risk detected due to Accelerator path or GenAI terms.")
    elif "internal data" in description or "new implementation" in description:
        risk_level = "Med"
        sla_days = 7
        cot_steps.append("Medium Risk detected due to internal data usage.")
    else:
        risk_level = "Low"
        sla_days = 3
        cot_steps.append("Defaulting to Low Risk.")
        
    deadline_date = datetime.now(timezone.utc) + timedelta(days=sla_days)
    sla_deadline_str = deadline_date.date().isoformat()
    cot_steps.append(f"assigned SLA: {sla_days} days (Deadline: {sla_deadline_str})")
    
    # State Update
    new_metadata = project_metadata.copy()
    new_metadata["riskLevel"] = risk_level
    
    new_governance = state.get("governance", {}).copy()
    new_governance["slaDeadline"] = sla_deadline_str
    
    if path == "Standard":
        new_governance["status"] = "Approved"
        cot_steps.append("Standard path detected: Project Auto-Approved.")
    
    reasoning_text = "\n".join(cot_steps)
    s3_uri = upload_reasoning_to_s3(submission_id, "Risk & Triage", reasoning_text)

    # Audit
    timestamp = datetime.now(timezone.utc).isoformat()
    raw_entry = {
        "timestamp": timestamp,
        "agent": "Risk & Triage",
        "action": f"Risk set to {risk_level}",
        "reason": f"SLA set to {sla_days} days based on path {path}",
        "reasoningContext": s3_uri,
        "userIdentity": get_current_user_identity()
    }
    signature = generate_audit_signature(raw_entry)
    audit_entry: AuditLogEntry = {**raw_entry, "signature": signature}
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)

    return {
        "projectMetadata": new_metadata,
        "governance": new_governance,
        "auditLog": new_audit_log
    }

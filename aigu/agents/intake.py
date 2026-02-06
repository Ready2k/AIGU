from datetime import datetime, timezone
from typing import Dict, Any
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity

def intake_orchestrator(state: GlobalState) -> Dict[str, Any]:
    """
    Intake Orchestrator Node.
    """
    intake_data = state.get("artifacts", {}).get("intakeData", {})
    description = intake_data.get("description", "").lower()
    project_name = intake_data.get("projectName", "Unknown Project")
    submission_id = state.get("submissionId", "unknown-submission")

    existing_metadata = state.get("projectMetadata", {})
    existing_stage = existing_metadata.get("currentStage", "Intake")
    
    path = "Stop"
    action = "Project Stopped"
    reason = "Does not meet criteria"
    
    # CoT Simulation
    cot_steps = [
        f"Analyzing description: '{description[:50]}...'",
        "Checking for 'Hero Capability' or 'GenAI' keywords...",
    ]

    if "hero capability" in description or "genai" in description or "llm" in description:
        path = "Accelerator"
        action = "Path set to Accelerator"
        reason = "GenAI/Hero Capability detected"
        cot_steps.append("Match found: GenAI/Hero keywords present.")
        cot_steps.append("Decision: Route to Accelerator Path.")
    elif "standard" in description or "bau" in description:
        path = "BAU"
        action = "Path set to BAU"
        reason = "Standard project request"
        cot_steps.append("Match found: Standard/BAU keywords.")
        cot_steps.append("Decision: Route to BAU Path.")
    else:
        cot_steps.append("No valid keywords found.")
        cot_steps.append("Decision: Stop process.")

    reasoning_text = "\n".join(cot_steps)
    s3_uri = upload_reasoning_to_s3(submission_id, "Intake Orchestrator", reasoning_text)

    # Update State
    new_metadata = existing_metadata.copy()
    new_metadata["path"] = path
    if path != "Stop":
        new_metadata["currentStage"] = "Pilot"
    else:
        new_metadata["currentStage"] = "Intake"
    if "name" not in new_metadata:
        new_metadata["name"] = project_name

    # Audit Log
    timestamp = datetime.now(timezone.utc).isoformat()
    raw_entry = {
        "timestamp": timestamp,
        "agent": "Intake Orchestrator",
        "action": action,
        "reason": reason,
        "reasoningContext": s3_uri,
        "userIdentity": get_current_user_identity()
    }
    signature = generate_audit_signature(raw_entry)
    
    audit_entry: AuditLogEntry = {
        **raw_entry,
        "signature": signature
    }
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    new_governance = state.get("governance", {}).copy()
    if path == "Stop":
        new_governance["status"] = "Blocked"
        new_governance["blockers"] = [reason]
    elif not new_governance.get("status") or new_governance.get("status") == "New":
        new_governance["status"] = "Draft"

    return {
        "projectMetadata": new_metadata,
        "auditLog": new_audit_log,
        "governance": new_governance
    }

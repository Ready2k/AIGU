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
    
    # Shadow IT Detection (Domain Specificity)
    unapproved_domains = ["dropbox.com", "dropbox", "googledrive.com", "unverified-docs-site.io", "github.com/personal"]
    detected_domains = [d for d in unapproved_domains if d in description]
    
    # CoT Simulation
    cot_steps = [
        f"Analyzing description: '{description[:50]}...'",
        "Checking for unapproved external domains (Shadow IT)...",
    ]

    path = "Standard"
    action = "Path set to Standard (Default)"
    reason = "Default standard governance path"
    # Multi-Stage Support: If project is already past Intake, pass through
    if existing_stage != "Intake" and existing_metadata.get("path") in ["Accelerator", "BAU", "Standard"]:
        cot_steps.append(f"Project already in {existing_stage} stage. Passing through.")
        return {
            "projectMetadata": existing_metadata,
            "auditLog": state.get("auditLog", []),
            "governance": state.get("governance", {})
        }

    remediation = None
    if detected_domains:
        path = "Stop"
        action = "Project Blocked (Security)"
        reason = f"Blocked due to unapproved external domains: {', '.join(detected_domains)}."
        cot_steps.append(f"CRITICAL: {reason}")
        remediation = "Please migrate code to the official GitLab and use approved documentation sources to proceed."
        cot_steps.append(f"Remediation suggested: {remediation}")
    elif "hero capability" in description or "genai" in description or "llm" in description:
        path = "Accelerator"
        action = "Path set to Accelerator"
        reason = "GenAI/Hero Capability detected"
        cot_steps.append("Match found: GenAI/Hero keywords present.")
        cot_steps.append("Decision: Route to Accelerator Path.")
    elif "standard" in description or "bau" in description:
        path = "Standard"
        action = "Path set to Standard"
        reason = "Standard project request"
        cot_steps.append("Match found: Standard/BAU keywords.")
        cot_steps.append("Decision: Route to Standard Path.")
    else:
        cot_steps.append("No prohibited domains detected. No specific GenAI keywords found.")
        cot_steps.append("Decision: Soft pivot to Standard Path.")

    reasoning_text = "\n".join(cot_steps)
    s3_uri = upload_reasoning_to_s3(submission_id, "Intake Orchestrator", reasoning_text)

    # Update State
    new_metadata = existing_metadata.copy()
    new_metadata["path"] = path
    
    if path == "Accelerator":
        # Accelerator projects go to Design/POC first
        new_metadata["currentStage"] = "POC"
    elif path == "Standard":
        # Standard projects go to Risk Triage
        new_metadata["currentStage"] = "Risk"
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
        if remediation:
            new_governance["remediation"] = remediation
    elif not new_governance.get("status") or new_governance.get("status") == "New":
        # Successfully passed intake, move to Draft
        new_governance["status"] = "Draft"

    return {
        "projectMetadata": new_metadata,
        "auditLog": new_audit_log,
        "governance": new_governance
    }

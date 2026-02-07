from datetime import datetime, timezone
from typing import Dict, Any
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity
from aigu.llm import query_nova_json, get_active_prompt

def intake_orchestrator(state: GlobalState) -> Dict[str, Any]:
    """
    Intake Orchestrator Node powered by Amazon Nova.
    """
    intake_data = state.get("artifacts", {}).get("intakeData", {})
    description = intake_data.get("description", "")
    project_name = intake_data.get("projectName")
    
    if not project_name or project_name == "Unknown Project":
        # Extract name from first 50 chars of description
        clean_desc = description.strip().replace("\n", " ")
        project_name = (clean_desc[:47] + "...") if len(clean_desc) > 50 else clean_desc
        if not project_name:
            project_name = "Untitled Project"
    submission_id = state.get("submissionId", "unknown-submission")

    existing_metadata = state.get("projectMetadata", {})
    existing_stage = existing_metadata.get("currentStage", "Intake")
    
    # 1. Multi-Stage Support: If project is already past Intake, pass through
    if existing_stage != "Intake" and existing_metadata.get("path") in ["Accelerator", "Standard"]:
        return {
            "projectMetadata": existing_metadata,
            "auditLog": state.get("auditLog", []),
            "governance": state.get("governance", {})
        }

    # 2. Invoke Amazon Nova for Intelligent Analysis
    print(f"Intake: Invoking Amazon Nova for project: {project_name}")
    
    try:
        prompt_tmpl = get_active_prompt("intake-orchestrator", tag="production")
        system_prompt = prompt_tmpl.compile(description=description)
    except Exception as e:
        print(f"Error loading prompt 'intake-orchestrator': {e}")
        system_prompt = "You are the AIGU Intake Orchestrator. Analyze the description. classify as 'Accelerator', 'Standard', or 'Stop'."

    
    analysis = query_nova_json(
        prompt_name="intake-orchestrator",  # Use LangFuse prompt
        user_prompt=f"Project Description: {description}",
        expected_keys=["path", "reason", "action", "thoughtProcess"],
        state=state  # Pass full state for variable substitution
    )

    path = analysis.get("path", "Standard")
    reason = analysis.get("reason", "Analyzed via Amazon Nova")
    action = analysis.get("action", "Path Categorization Complete")
    remediation = analysis.get("remediation")
    thought_process = analysis.get("thoughtProcess", "Step-by-step analysis carried out.")

    # 3. Persistence & Audit
    s3_uri = upload_reasoning_to_s3(submission_id, "Intake Orchestrator", thought_process)

    # Update Metadata
    new_metadata = existing_metadata.copy()
    new_metadata["path"] = path
    
    if path == "Accelerator":
        new_metadata["currentStage"] = "POC"
    elif path == "Standard":
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
    
    audit_entry: AuditLogEntry = {**raw_entry, "signature": signature}
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    # Governance Status
    new_governance = state.get("governance", {}).copy()
    if path == "Stop":
        new_governance["status"] = "Blocked"
        new_governance["blockers"] = [reason]
        if remediation:
            new_governance["remediation"] = remediation
    elif not new_governance.get("status") or new_governance.get("status") == "New":
        new_governance["status"] = "Draft"

    return {
        "projectMetadata": new_metadata,
        "auditLog": new_audit_log,
        "governance": new_governance
    }

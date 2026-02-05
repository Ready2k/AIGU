from datetime import datetime, timezone
from typing import Dict, Any
from aigu.state import GlobalState, AuditLogEntry

def intake_orchestrator(state: GlobalState) -> Dict[str, Any]:
    """
    Intake Orchestrator Node.
    Analyzes the project proposal and determines the governance path.
    """
    intake_data = state.get("artifacts", {}).get("intakeData", {})
    description = intake_data.get("description", "").lower()
    project_name = intake_data.get("projectName", "Unknown Project")
    
    path = "Stop"
    action = "Project Stopped"
    reason = "Does not meet criteria"
    
    # Logic based on agents/intake.md and TEST_SCENARIOS.md
    if "hero capability" in description or "genai" in description or "llm" in description:
        path = "Accelerator"
        action = "Path set to Accelerator"
        reason = "GenAI/Hero Capability detected"
    elif "standard" in description or "bau" in description:
        path = "BAU"
        action = "Path set to BAU"
        reason = "Standard project request"
        
    # Update State
    new_metadata = state.get("projectMetadata", {}).copy()
    new_metadata["path"] = path
    new_metadata["currentStage"] = "Intake" # Remain in Intake or move next? logic says "Initialize"
    if "name" not in new_metadata:
        new_metadata["name"] = project_name

    # Audit Log
    audit_entry: AuditLogEntry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent": "Intake Orchestrator",
        "action": action,
        "reason": reason
    }
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    return {
        "projectMetadata": new_metadata,
        "auditLog": new_audit_log
    }

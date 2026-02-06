from datetime import datetime, timezone
from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity
from aigu.llm import query_nova_json

LIBRARIAN_SYSTEM_PROMPT = """
You are the AIGU Governance Librarian. Your role is to consolidate project information into a 'technicalDesign' artifact while eliminating redundancy.

Responsibilities:
1. Deduplication: Identify information in 'intakeData' that should be 'promoted' to the 'technicalDesign' Single Source of Truth if it's missing or more detailed.
2. Technical Gap Analysis: For Medium or High risk projects, check if the project has sufficient technical detail (e.g., DataFlow, IAM configuration, or specific architectural patterns).
3. Consistency: Ensure the project name and basic scope are consistent across all artifacts.

Input will include 'intakeData', 'technicalDesign', and 'projectMetadata' (Risk Level).

JSON Structure Required:
- updatedTechnicalDesign: Object (The merged Single Source of Truth)
- missingSections: List of Strings (Any technical gaps identified)
- actionsTaken: List of Strings (Specific changes made)
- thoughtProcess: String (Detailed analysis)
"""

def librarian_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Governance Librarian Agent powered by Amazon Nova.
    """
    artifacts = state.get("artifacts", {})
    intake_data = artifacts.get("intakeData", {})
    tech_design = artifacts.get("technicalDesign", {})
    project_metadata = state.get("projectMetadata", {})
    risk_level = project_metadata.get("riskLevel", "Low")
    submission_id = state.get("submissionId", "unknown")
    
    # 1. Invoke Amazon Nova for Intelligent Consolidation
    print(f"Librarian: Invoking Amazon Nova for artifact consolidation.")
    analysis = query_nova_json(
        system_prompt=LIBRARIAN_SYSTEM_PROMPT,
        user_prompt=f"Risk Level: {risk_level}\nIntake Data: {intake_data}\nExisting technicalDesign: {tech_design}",
        expected_keys=["updatedTechnicalDesign", "actionsTaken", "thoughtProcess"]
    )

    updated_tech_design = analysis.get("updatedTechnicalDesign", tech_design)
    actions_taken = analysis.get("actionsTaken", ["Routine deduplication check."])
    thought_process = analysis.get("thoughtProcess", "Step-by-step consolidation carried out.")
    missing_sections = analysis.get("missingSections", [])

    # 2. Artifact Management (Logic 3 in spec)
    new_artifacts = artifacts.copy()
    new_artifacts["technicalDesign"] = updated_tech_design
    
    if risk_level == "High" and "complianceStatus" not in new_artifacts:
        new_artifacts["complianceStatus"] = []
        actions_taken.append("Initialized Compliance Status for High Risk context.")

    # 3. Persistence & Audit
    s3_uri = upload_reasoning_to_s3(submission_id, "Gov Librarian", thought_process)

    timestamp = datetime.now(timezone.utc).isoformat()
    raw_entry = {
        "timestamp": timestamp,
        "agent": "Gov Librarian",
        "action": "Artifact Consolidation",
        "reason": f"Actions: {'; '.join(actions_taken)}",
        "reasoningContext": s3_uri,
        "userIdentity": get_current_user_identity()
    }
    signature = generate_audit_signature(raw_entry)
    audit_entry: AuditLogEntry = {**raw_entry, "signature": signature}
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    return {
        "artifacts": new_artifacts, 
        "auditLog": new_audit_log
    }

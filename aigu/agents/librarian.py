from datetime import datetime, timezone
from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity
from aigu.llm import query_nova_json

# LangFuse Prompt: librarian_agent

def librarian_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Governance Librarian Agent.
    """
    artifacts = state.get("artifacts", {})
    intake_data = artifacts.get("intakeData", {})
    tech_design = artifacts.get("technicalDesign", {})
    project_metadata = state.get("projectMetadata", {})
    risk_level = project_metadata.get("riskLevel", "Low")
    submission_id = state.get("submissionId", "unknown")
    
    # 1. Invoke Upgraded Librarian Service for Extraction & Audit
    from services.librarian.main import librarian_audit_handler
    
    print(f"Librarian: Running Unified Extractor for artifacts and links.")
    audit_results = librarian_audit_handler(state)
    audit_context = audit_results.get("librarian_context", "No additional document context extracted.")
    
    # 2. Invoke Amazon Nova for Intelligent Consolidation
    print(f"Librarian: Invoking Amazon Nova for artifact consolidation.")
    
    user_prompt = f"""
    Risk Level: {risk_level}
    Intake Data: {intake_data}
    Existing technicalDesign: {tech_design}
    
    --- EXTRACTED CONTENT FROM FILES & LINKS ---
    {audit_context}
    """
    
    analysis = query_nova_json(
        prompt_name="librarian_agent",
        user_prompt=user_prompt,
        expected_keys=["updatedTechnicalDesign", "actionsTaken", "thoughtProcess", "missingSections"],
        state=state
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

    # 3. Artifact Validation (NEW)
    # Define required artifacts based on risk level
    required_artifacts = ["intakeData", "technicalDesign"]
    if risk_level == "Medium":
        required_artifacts.append("complianceStatus")
    elif risk_level == "High":
        required_artifacts.extend(["complianceStatus", "securityReview", "dataFlowDiagram"])
    
    # Check for missing artifacts
    missing_artifacts = [
        art for art in required_artifacts 
        if art not in new_artifacts or not new_artifacts.get(art)
    ]
    artifacts_valid = len(missing_artifacts) == 0
    
    print(f"Librarian: Artifact validation - Valid: {artifacts_valid}, Missing: {missing_artifacts}")

    # 4. Persistence & Audit
    s3_uri = upload_reasoning_to_s3(submission_id, "Gov Librarian", thought_process)

    timestamp = datetime.now(timezone.utc).isoformat()
    raw_entry = {
        "timestamp": timestamp,
        "agent": "Gov Librarian",
        "action": "Artifact Consolidation & Validation",
        "reason": f"Actions: {'; '.join(actions_taken)}. Artifacts Valid: {artifacts_valid}",
        "reasoningContext": s3_uri,
        "userIdentity": get_current_user_identity()
    }
    signature = generate_audit_signature(raw_entry)
    audit_entry: AuditLogEntry = {**raw_entry, "signature": signature}
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    # Update project metadata with validation results
    new_project_metadata = project_metadata.copy()
    new_project_metadata["artifactsValid"] = artifacts_valid
    new_project_metadata["missingArtifacts"] = missing_artifacts
    
    # 5. Handle Rejection (Block) if artifacts are missing
    new_governance = state.get("governance", {}).copy()
    if not artifacts_valid:
        print(f"Librarian: Rejecting project {submission_id} due to missing artifacts: {missing_artifacts}")
        new_governance["status"] = "Blocked"
        existing_blockers = new_governance.get("blockers", [])
        # Avoid duplicate blockers
        new_blockers = list(set(existing_blockers + [f"Missing Artifact: {art}" for art in missing_artifacts]))
        new_governance["blockers"] = new_blockers
    
    return {
        "artifacts": new_artifacts, 
        "auditLog": new_audit_log,
        "projectMetadata": new_project_metadata,
        "governance": new_governance
    }

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
    
    # 1. Fetch Dynamic Config
    from aigu.config import get_config
    librarian_config = get_config("librarian_agent")
    config_required_artifacts = librarian_config.get("required_artifacts", {
        "High": ["intakeData", "technicalDesign", "DPIA", "securityReview", "complianceStatus"],
        "Medium": ["intakeData", "technicalDesign", "complianceStatus"],
        "Low": ["intakeData", "technicalDesign"]
    })

    # 2. Determine Required Artifacts based on Risk Level
    dynamic_reqs = config_required_artifacts.get(risk_level)
    if dynamic_reqs:
        required_artifacts = dynamic_reqs
    else:
        # Fallback Hardcoded Defaults
        required_artifacts = ["intakeData", "technicalDesign"]
        if risk_level == "Medium":
            required_artifacts.append("complianceStatus")
        elif risk_level == "High":
            required_artifacts.extend(["complianceStatus", "securityReview", "dataFlowDiagram"])

    # 3. Invoke Upgraded Librarian Service for Extraction
    from services.librarian.main import librarian_audit_handler
    
    print(f"Librarian: Running Unified Extractor for artifacts and links.")
    audit_results = librarian_audit_handler(state)
    audit_context = audit_results.get("librarian_context", "No additional document context extracted.")
    
    # 4. Invoke Amazon Nova for Intelligent Categorization
    print(f"Librarian: Invoking Amazon Nova to map content to required artifacts: {required_artifacts}")
    
    user_prompt = f"""
    The project is at a {risk_level} risk level.
    The following artifacts are REQUIRED: {', '.join(required_artifacts)}
    
    CURRENT INTAKE DATA:
    {intake_data}
    
    --- EXTRACTED CONTENT FROM UPLOADED FILES & LINKS ---
    {audit_context}
    
    --- TASK ---
    1. Analyze the extracted content.
    2. Map the content to the REQUIRED artifacts listed above.
    3. If content for an artifact (like 'technicalDesign' or 'securityReview') is found in the documents, summarize/extract it into that field.
    4. If no clear content is found for a required artifact, return an empty string or "Not Found" for that field.
    5. 'intakeData' should reflect the latest understanding, merged with new details.
    """
    
    # We want the LLM to return exactly the fields we need
    expected_keys = required_artifacts + ["actionsTaken", "thoughtProcess"]
    
    analysis = query_nova_json(
        prompt_name="librarian_agent",
        user_prompt=user_prompt,
        expected_keys=expected_keys,
        state=state
    )

    # 5. Process Results & Update State
    new_artifacts = artifacts.copy()
    actions_taken = analysis.get("actionsTaken", ["Routine document analysis. -- File Verification Step Added"])
    thought_process = analysis.get("thoughtProcess", "AI-driven content mapping performed.")
    
    missing_artifacts = []
    
    # CRITICAL FIX: Enforce Physical File Presence
    # We must check if a file was actually uploaded, not just if text was extracted.
    uploaded_files = state.get("artifacts", {}).get("files", [])
    # For now, we do a naive check: if required > 0, we expect files > 0
    # In a more advanced version, we'd map specific files to specific artifacts (e.g. "design.pdf" -> "technicalDesign")
    
    has_physical_files = len(uploaded_files) > 0
    
    for art in required_artifacts:
        content = analysis.get(art)
        
        # Check 1: Did the LLM find content?
        has_content = content and content != "Not Found" and len(str(content)) > 20
        
        # Check 2 (NEW): Is there a physical file for this? (For Technical Design/Security)
        # We enforce this strictly for 'technicalDesign' and 'securityReview'
        requires_physical_file = art in ["technicalDesign", "securityReview", "complianceStatus"]
        
        if has_content:
            new_artifacts[art] = content
            print(f"Librarian: Identified content for {art}")
            
            if requires_physical_file and not has_physical_files:
                 # AUTOMATIC FLAGGING FOR "PHANTOM FILES"
                 print(f"Librarian: ALERT - Content found for {art} but NO physical files uploaded. Marking as MISSING.")
                 missing_artifacts.append(f"{art} (Physical File Required)")
        else:
            if art not in new_artifacts or not new_artifacts.get(art):
                missing_artifacts.append(art)
                print(f"Librarian: Missing content for {art}")

    artifacts_valid = len(missing_artifacts) == 0
    print(f"Librarian: Artifact validation - Valid: {artifacts_valid}, Missing: {missing_artifacts}")

    # 6. Persistence & Audit
    s3_uri = upload_reasoning_to_s3(submission_id, "Gov Librarian", thought_process)

    timestamp = datetime.now(timezone.utc).isoformat()
    raw_entry = {
        "timestamp": timestamp,
        "agent": "Gov Librarian",
        "action": "Content-Aware Artifact Validation",
        "reason": f"Analyzed uploaded docs. Artifacts Valid: {artifacts_valid}. missing: {missing_artifacts}",
        "reasoningContext": s3_uri,
        "userIdentity": get_current_user_identity()
    }
    signature = generate_audit_signature(raw_entry)
    audit_entry: AuditLogEntry = {**raw_entry, "signature": signature}
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    # Update project metadata
    new_project_metadata = project_metadata.copy()
    new_project_metadata["artifactsValid"] = artifacts_valid
    new_project_metadata["missingArtifacts"] = missing_artifacts
    
    # 7. Handle Rejection (Block) if artifacts are missing
    new_governance = state.get("governance", {}).copy()
    if not artifacts_valid:
        print(f"Librarian: Rejecting project {submission_id} due to missing content for: {missing_artifacts}")
        new_governance["status"] = "Blocked"
        new_governance["blockers"] = [f"Missing Content: {art}" for art in missing_artifacts]
    
    # CoT Appending
    cot_entry = {
        "agent": "Librarian",
        "timestamp": timestamp,
        "decision": f"Artifacts Valid: {artifacts_valid}",
        "reasoning": thought_process,
        "missingArtifacts": missing_artifacts,
        "actionsTaken": actions_taken
    }
    new_chain_of_thought = state.get("chainOfThought", []).copy()
    new_chain_of_thought.append(cot_entry)

    return {
        "artifacts": new_artifacts, 
        "auditLog": new_audit_log,
        "projectMetadata": new_project_metadata,
        "governance": new_governance,
        "chainOfThought": new_chain_of_thought
    }

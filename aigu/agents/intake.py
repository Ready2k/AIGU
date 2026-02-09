from datetime import datetime, timezone
from typing import Dict, Any
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity
from aigu.llm import query_nova_json, get_active_prompt

def intake_orchestrator(state: GlobalState) -> Dict[str, Any]:
    """
    Intake Orchestrator Node.
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

    # 2. Invoke Amazon Nova for Intelligent Analysis and Extraction
    print(f"Intake: Invoking Amazon Nova for project: {project_name}")
    
    # Define fields and their purpose for context
    intake_fields = {
        "projectName": "Use Case Name (Project Title)",
        "owner": "Use Case Owner (Internal email or Emp ID)",
        "businessArea": "Area being represented",
        "problemStatement": "Problem being solved",
        "solutionBrief": "How it is being solved",
        "timelines": "Q1 2024 or MM/YYYY format",
        "sponsorship": "Internal champion",
        "lifecycleStatus": "POC, Pilot, or Production",
        "successCriteria": "Measurements of success",
        "technicalApproach": "Specific engineering experiment details",
        "resources": "Staffing availability",
        "businessValue": "Primary benefits",
        "financialBenefits": "NPS increase or cost savings",
        "funding": "Budget source (Value or TBD)",
        "raids": "Risks, Assumptions, Issues, Dependencies",
        "architectureVision": "High-level diagrammatic description"
    }

    try:
        prompt_tmpl = get_active_prompt("intake-orchestrator", tag="production")
    except Exception as e:
        print(f"Error loading prompt 'intake-orchestrator': {e}")
        prompt_tmpl = "Analyze project and extract fields."

    # Perform analysis and extraction
    analysis = query_nova_json(
        prompt_name="intake-orchestrator",
        user_prompt=(
            f"Project Context: {description}\n"
            f"Existing Data: {json.dumps(intake_data)}\n\n"
            "1. Extract/refine fields: " + ", ".join(intake_fields.keys()) + "\n"
            "2. Identify missing fields.\n"
            "3. FOR EACH MISSING FIELD: Provide 'helpText' and a 'contextualExample' tailored to this project's theme.\n"
            "   (e.g., If it's a Chatbot, an extraction for 'raids' might suggest 'Model Latency').\n"
            "4. Categorize path as 'Accelerator', 'Standard', or 'Stop'.\n"
        ),
        expected_keys=["path", "reason", "action", "thoughtProcess", "extractedData", "missingFields", "contextualHelp", "preliminaryRiskLevel"],
        state=state
    )

    path = analysis.get("path", "Standard")
    extracted_data = analysis.get("extractedData", {})
    missing_fields = analysis.get("missingFields", list(intake_fields.keys()))
    contextual_help = analysis.get("contextualHelp", {}) # Map: field -> {helpText, example}
    prelim_risk = analysis.get("preliminaryRiskLevel", "Low")
    
    # 3. Predict Required Documents Preview
    required_docs = ["Technical Design Document"] # Baseline
    
    desc_lower = description.lower()
    is_gen_ai = any(kw in desc_lower for kw in ["genai", "llm", "bedrock", "gpt", "model", "foundation"])
    is_pii = any(kw in desc_lower for kw in ["pii", "customer data", "personal information", "email", "phone"])
    
    if prelim_risk == "High":
        required_docs.extend(["Security Architecture Review", "Data Flow Diagram"])
    elif prelim_risk == "Medium":
        required_docs.append("Compliance Checklist")
        
    if is_gen_ai or is_pii:
        required_docs.append("Data Protection Impact Assessment (DPIA)")
        
    if is_gen_ai:
        required_docs.append("GenAI Safety Assessment")

    # 4. Path Validation
    valid_paths = ["Accelerator", "Standard", "Stop"]
    if path not in valid_paths:
        path = "Standard"
        reason = f"Path validation failed. Defaulted to Standard."
    else:
        reason = analysis.get("reason", "Analyzed via Amazon Nova")

    # 5. Data Merging (Memory Enhancement)
    new_intake_data = intake_data.copy()
    for key, value in extracted_data.items():
        # Only overwrite if new value is more substantive than "Unknown" or empty
        if value and str(value).lower() not in ["unknown", "n/a", "none"]:
            new_intake_data[key] = value
    
    # Update description to combine info if necessary
    new_intake_data["description"] = description

    # Ensure projectName is synced
    if "projectName" in new_intake_data:
        project_name = new_intake_data["projectName"]

    # 6. Validation Logic
    from aigu.state import IntakeValidation
    validation_errors = []
    
    # Check Critical Gaps
    critical_gaps = [f for f in IntakeValidation.CRITICAL_FIELDS if f in missing_fields or not new_intake_data.get(f)]
    
    # Run Specific Rules
    if new_intake_data.get("timelines") and not IntakeValidation.validate_timelines(new_intake_data["timelines"]):
        validation_errors.append("Invalid timeline format. Use Q[1-4] YYYY or MM/YYYY.")
    
    if new_intake_data.get("owner") and not IntakeValidation.validate_email_or_id(new_intake_data["owner"]):
        validation_errors.append("Owner must be a valid internal email or Employee ID (Exxxxx).")
        
    if new_intake_data.get("funding") and not IntakeValidation.validate_funding(new_intake_data["funding"]):
        validation_errors.append("Funding must be a numeric value or 'TBD'.")

    is_intake_complete = len(critical_gaps) == 0 and len(validation_errors) == 0

    # 7. Persistence & Audit
    s3_uri = upload_reasoning_to_s3(submission_id, "Intake Orchestrator", analysis.get("thoughtProcess", ""))

    # Update Metadata
    new_metadata = existing_metadata.copy()
    new_metadata["path"] = path
    new_metadata["riskLevel"] = prelim_risk # Preliminary guess
    new_metadata["missingIntakeFields"] = missing_fields
    new_metadata["validationErrors"] = validation_errors
    new_metadata["isIntakeComplete"] = is_intake_complete
    new_metadata["contextualHelp"] = contextual_help # Store for UI
    
    if path == "Stop":
        new_metadata["currentStage"] = "Intake"
    elif not is_intake_complete:
        new_metadata["currentStage"] = "Intake" # Stay in Intake until complete
    elif path == "Accelerator":
        new_metadata["currentStage"] = "POC"
    else:
        new_metadata["currentStage"] = "Risk"

    if "name" not in new_metadata or new_metadata["name"] == "Untitled Project":
        new_metadata["name"] = project_name

    # Audit Log
    timestamp = datetime.now(timezone.utc).isoformat()
    raw_entry = {
        "timestamp": timestamp,
        "agent": "Intake Orchestrator",
        "action": analysis.get("action", "Intake Analysis Complete"),
        "reason": reason if is_intake_complete else f"Incomplete Intake: {', '.join(critical_gaps + validation_errors)}",
        "reasoningContext": s3_uri,
        "userIdentity": get_current_user_identity()
    }
    signature = generate_audit_signature(raw_entry)
    audit_entry: AuditLogEntry = {**raw_entry, "signature": signature}
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    # Governance Status
    new_governance = state.get("governance", {}).copy()
    new_governance["requiredDocsPreview"] = required_docs
    
    if path == "Stop":
        new_governance["status"] = "Blocked"
        new_governance["blockers"] = [reason]
    elif not is_intake_complete:
        new_governance["status"] = "Draft"
        new_governance["blockers"] = critical_gaps + validation_errors
    elif not new_governance.get("status") or new_governance.get("status") == "New":
        new_governance["status"] = "Draft"

    return {
        "projectMetadata": new_metadata,
        "auditLog": new_audit_log,
        "governance": new_governance,
        "artifacts": {**state.get("artifacts", {}), "intakeData": new_intake_data}
    }

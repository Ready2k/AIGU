from datetime import datetime, timezone
from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity
from aigu.llm import query_nova_json, get_active_prompt

def gatekeeper_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Gatekeeper Agent.
    """
    project_metadata = state.get("projectMetadata", {})
    risk_level = project_metadata.get("riskLevel", "Low")
    submission_id = state.get("submissionId", "unknown")
    
    artifacts = state.get("artifacts", {})
    compliance_status = artifacts.get("complianceStatus", [])
    tech_design = artifacts.get("technicalDesign", {})
    
    governance = state.get("governance", {})
    current_status = governance.get("status", "Draft")
    
    system_config = state.get("systemConfig", {})
    whitelist = system_config.get("linkDomainWhitelist", ["github.com", "sharepoint.com"])

    # 1. Invoke Amazon Nova for Intelligent Gatekeeping
    print(f"Gatekeeper: Invoking Amazon Nova for compliance evaluation.")
    
    # Prepare state for prompt variable substitution
    prompt_state = {
        "risk_level": risk_level,
        "current_status": current_status,
        "compliance_status": compliance_status,
        "tech_design": tech_design,
        "whitelist": whitelist,
        "files_uploaded": artifacts.get("files_uploaded", []),
        "complianceStatus": compliance_status,
        **state  # Include full state for any other variables
    }
    
    analysis = query_nova_json(
        prompt_name="gatekeeper",  # Use LangFuse prompt
        user_prompt=f"Current Status: {current_status}\nRisk Level: {risk_level}\nCompliance Signals: {compliance_status}\nTechnical Design: {tech_design}\nLink Whitelist: {whitelist}",
        expected_keys=["status", "blockers", "complianceStatus", "thoughtProcess", "actionSummary"],
        state=prompt_state  # Pass full state for variable substitution
    )


    new_status = analysis.get("status", current_status)
    blockers = analysis.get("blockers", [])
    new_compliance = analysis.get("complianceStatus", compliance_status)
    thought_process = analysis.get("thoughtProcess", "Compliance check complete.")
    if not isinstance(thought_process, str):
        thought_process = json.dumps(thought_process) if isinstance(thought_process, (dict, list)) else str(thought_process)
    action_summary = analysis.get("actionSummary", "Evaluated signals.")

    # --- GATEKEEPER ENFORCEMENT RULES (Refactored) ---
    path = project_metadata.get("path", "Standard")
    current_stage = project_metadata.get("currentStage", "Intake")
    
    # Rule 1 & 3: Mandatory Admin Signature for Accelerator Path
    if path == "Accelerator" and new_status in ["Approved", "Live", "Production-Ready", "POC-Approved"]:
        has_admin_approval = False
        audit_log = state.get("auditLog", [])
        for entry in audit_log:
            # Check for Admin approval signal
            if entry.get("agent") in ["Admin", "GIGC Admin"] and "APPROVE" in str(entry.get("action", "")).upper():
                has_admin_approval = True
                break
        
        if not has_admin_approval:
            print("Gatekeeper: Blocking Accelerator project due to missing Admin Signature.")
            new_status = "Blocked"
            blockers.append("GIGC Admin Approval Required (Accelerator Path)")
            thought_process += "\n\n[Gatekeeper Oversight]: Accelerator projects require formal Admin signature (HITL) before approval. Sending back to user for coordination."
            action_summary = "Blocked: Missing Admin Signature"
            # Specific reasoning for Support Agent
            compliance_note = "Your technical approach is excellent, but because this is a High-Impact AI project, it requires a formal GIGC Admin signature before moving to the next phase."
    
    # Rule 2: Lifecycle Enforcement (Pilot Check for High Risk)
    if risk_level in ["High", "Critical"] and new_status in ["Live", "Production-Ready"] and current_stage not in ["Pilot", "Production"]:
        print("Gatekeeper: Blocking High-Risk project skipping Pilot.")
        new_status = "Blocked"
        blockers.append("Must complete Pilot Phase verification")
        thought_process += "\n\n[Gatekeeper Oversight]: High-Risk projects cannot skip Pilot phase. Sending back to user for lifecycle correction."
        action_summary = "Blocked: Lifecycle Violation (Skipped Pilot)"
    
    # Rule 3 (NEW): No-Reply Communications Block (PECR/CAN-SPAM)
    # We check the raw description for specific trigger phrases even if the LLM missed it.
    description_raw = state.get("artifacts", {}).get("intakeData", {}).get("description", "").lower()
    
    is_no_reply = "no-reply" in description_raw or "no reply" in description_raw
    is_mass_comms = "sms" in description_raw or "email" in description_raw or "outreach" in description_raw
    
    if is_no_reply and is_mass_comms:
        print("Gatekeeper: Blocking 'No-Reply' mass communication.")
        new_status = "Blocked"
        blockers.append("Regulatory Violation: No-Reply Communication")
        thought_process += "\n\n[Gatekeeper Oversight]: 'No-Reply' mass communication violates PECR/CAN-SPAM. User must implement Opt-Out/Reply mechanism."
        action_summary = "Blocked: Regulatory Violation (No-Reply)"
        compliance_note = "Using a 'No-Reply' mechanism for mass outreach is a violation of digital communication laws (PECR/CAN-SPAM). You must implement a valid Opt-Out or Reply channel."
        
    # -----------------------------------------------

    # 2. Persistence & Audit
    s3_uri = upload_reasoning_to_s3(submission_id, "Gatekeeper", thought_process)

    new_governance = governance.copy()
    new_governance["status"] = new_status
    new_governance["blockers"] = blockers
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Use compliance_note if defined, else construct one
    reason_text = locals().get('compliance_note', f"Decision: {new_status}. Blockers: {len(blockers)}")

    raw_entry = {
        "timestamp": timestamp,
        "agent": "Gatekeeper",
        "action": action_summary,
        "reason": reason_text,
        "reasoningContext": s3_uri,
        "userIdentity": get_current_user_identity()
    }
    signature = generate_audit_signature(raw_entry)
    audit_entry: AuditLogEntry = {**raw_entry, "signature": signature}
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)
    
    # 3. Notification Trigger (New: Task B Integration)
    if new_status != current_status:
        from aigu.notifications import send_governance_email
        from aigu.agents.support import support_agent
        
        # Synthesize message using Support Agent (Pass NEW Audit Log)
        temp_state = {
            **state, 
            "governance": new_governance, 
            "projectMetadata": project_metadata,
            "auditLog": new_audit_log  # Crucial: Pass the new log so Support sees the reasoning
        }
        support_output = support_agent(temp_state)
        ui_overlay = support_output.get("ui_overlay", {})
        message = ui_overlay.get("supportMessage", "New governance status update.")
        
        # Notify User
        user_email = state.get("userId", "user@company.com") # Should ideally be an email
        if "@" not in user_email: user_email = f"{user_email}@company.com" # Mocking email
        
        send_governance_email(
            project_id=submission_id,
            recipient_email=user_email,
            role="User",
            status_update=message,
            sla_deadline=new_governance.get("slaDeadline"),
            blockers=blockers if new_status == "Blocked" else None
        )
        
        # Notify Admin if Pending/In-Review
        if new_status in ["In-Review", "Pending"]:
            send_governance_email(
                project_id=submission_id,
                recipient_email="admin@aigu.io", # Configurable
                role="Admin",
                status_update=f"Project {submission_id} is awaiting your review: {blockers}",
                admin_link="https://aigu.io/admin/queue"
            )

    # CoT Appending
    cot_entry = {
        "agent": "Gatekeeper",
        "timestamp": timestamp,
        "decision": f"Status: {new_status}",
        "reasoning": thought_process,
        "actionSummary": action_summary,
        "blockers": blockers
    }
    new_chain_of_thought = state.get("chainOfThought", []).copy()
    new_chain_of_thought.append(cot_entry)

    # 4. UI Overlay Update
    new_ui_overlay = state.get("ui_overlay", {}).copy()
    new_ui_overlay["adminAnalysis"] = thought_process
    
    return {
        "governance": new_governance,
        "artifacts": {**artifacts, "complianceStatus": new_compliance},
        "auditLog": new_audit_log,
        "chainOfThought": new_chain_of_thought,
        "ui_overlay": new_ui_overlay
    }

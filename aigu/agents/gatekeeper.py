from datetime import datetime, timezone
from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity
from aigu.llm import query_nova_json

GATEKEEPER_SYSTEM_PROMPT = """
You are the AIGU Gatekeeper Agent. Your role is to manage compliance approvals and security guardrails for AI projects.

Responsibilities:
1. Security Check: Verify technical design links against the whitelisted domains: github.com, sharepoint.com. (Or as provided in the whitelist).
2. Signal Evaluation: Analyze the 'complianceStatus' array which contains signals from Legal, GIGC, and other stakeholders.
   - If ALL required stakeholders are 'Approved', and there are no security violations, the status should be 'Approved'.
   - If ANY stakeholder is 'Challenged', or there is a security violation, the status should be 'Blocked'.
   - If any stakeholder is 'Pending', the status remains 'In-Review'.
3. Bootstrap: If this is a High Risk project with no 'complianceStatus' initialized yet, create the initial 'Pending' entries for 'Legal' and 'GIGC' and set status to 'In-Review'.

JSON Structure Required:
- status: String ('Approved', 'Blocked', 'In-Review')
- blockers: List of Strings (Specific reasons if Blocked)
- complianceStatus: List of Objects (Each with: horizontal, status, comment)
- thoughtProcess: String (Detailed analysis)
- actionSummary: String (Short description of what you did)
"""

def gatekeeper_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Gatekeeper Agent powered by Amazon Nova.
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
    analysis = query_nova_json(
        system_prompt=GATEKEEPER_SYSTEM_PROMPT,
        user_prompt=f"Current Status: {current_status}\nRisk Level: {risk_level}\nCompliance Signals: {compliance_status}\nTechnical Design: {tech_design}\nLink Whitelist: {whitelist}",
        expected_keys=["status", "blockers", "complianceStatus", "thoughtProcess", "actionSummary"]
    )

    new_status = analysis.get("status", current_status)
    blockers = analysis.get("blockers", [])
    new_compliance = analysis.get("complianceStatus", compliance_status)
    thought_process = analysis.get("thoughtProcess", "Compliance check complete.")
    action_summary = analysis.get("actionSummary", "Evaluated signals.")

    # 2. Persistence & Audit
    s3_uri = upload_reasoning_to_s3(submission_id, "Gatekeeper", thought_process)

    new_governance = governance.copy()
    new_governance["status"] = new_status
    new_governance["blockers"] = blockers
    
    timestamp = datetime.now(timezone.utc).isoformat()
    raw_entry = {
        "timestamp": timestamp,
        "agent": "Gatekeeper",
        "action": action_summary,
        "reason": f"Decision: {new_status}. Blockers: {len(blockers)}",
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
        
        # Synthesize message using Support Agent
        temp_state = {**state, "governance": new_governance, "projectMetadata": project_metadata}
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
                status_update=f"Project {submission_id} is awaiting your review.",
                admin_link="https://aigu.io/admin/queue"
            )

    return {
        "governance": new_governance,
        "artifacts": {**artifacts, "complianceStatus": new_compliance},
        "auditLog": new_audit_log
    }

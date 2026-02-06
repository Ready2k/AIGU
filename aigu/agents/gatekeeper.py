from datetime import datetime, timezone
from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity

def gatekeeper_agent(state: GlobalState) -> Dict[str, Any]:
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
    
    action_log = []
    blockers = []
    cot_steps = ["Starting Gateway Verification..."]
    
    new_governance = governance.copy()
    new_compliance = compliance_status[:]
    
    # Logic 0: Link Security
    invalid_links = []
    cot_steps.append(f"Checking links against whitelist: {whitelist}")
    for key, val in tech_design.items():
        if isinstance(val, str) and val.startswith("http"):
            domain_ok = False
            for safe_domain in whitelist:
                if safe_domain in val:
                    domain_ok = True
                    break
            if not domain_ok:
                invalid_links.append(f"{key}: {val}")
                cot_steps.append(f"Found invalid link: {val}")
    
    if invalid_links:
        blockers.append(f"Security Rule Violation: Non-whitelisted domains: {'; '.join(invalid_links)}")

    # Logic 1: Trigger Event
    if risk_level == "High" and not compliance_status and current_status == "Draft" and not blockers:
        new_compliance = [
            {"horizontal": "Legal", "status": "Pending"},
            {"horizontal": "GIGC", "status": "Pending"}
        ]
        new_governance["status"] = "In-Review"
        action_log.append("Initiated GIGC/Legal Review")
        cot_steps.append("High Risk detected. Initializing Pending status for Legal/GIGC.")

    # Logic 2: Evaluate Signals
    all_approved = True
    has_pending = False
    
    if new_compliance:
        for item in new_compliance:
            status = item.get("status", "Pending")
            cot_steps.append(f"Evaluating {item.get('horizontal', 'Unknown')}: {status}")
            if status == "Challenged":
                all_approved = False
                comment = item.get("comment", "No comment")
                blockers.append(f"{item['horizontal']}: {comment}")
            elif status == "Pending":
                all_approved = False
                has_pending = True
    
    # Logic 3: Transition
    if blockers:
        new_governance["status"] = "Blocked"
        new_governance["blockers"] = blockers
        action_log.append(f"Blocked by {len(blockers)} check(s)")
        cot_steps.append("Decision: Blocked due to validation failures.")
    elif all_approved and new_compliance and not invalid_links:
        new_governance["status"] = "Approved"
        new_governance["blockers"] = []
        action_log.append("All Verification Checks Passed")
        cot_steps.append("Decision: Approved. All checks passed.")
    elif has_pending:
        new_governance["status"] = "In-Review"
        cot_steps.append("Decision: Remain In-Review (Pending signals).")
    
    # Audit & CoT
    if action_log or cot_steps:
        reasoning_text = "\n".join(cot_steps)
        s3_uri = upload_reasoning_to_s3(submission_id, "Gatekeeper", reasoning_text)
        
        timestamp = datetime.now(timezone.utc).isoformat()
        raw_entry = {
            "timestamp": timestamp,
            "agent": "Gatekeeper",
            "action": "Gateway Evaluation",
            "reason": "; ".join(action_log) if action_log else "Routine Check",
            "reasoningContext": s3_uri,
            "userIdentity": get_current_user_identity()
        }
        signature = generate_audit_signature(raw_entry)
        audit_entry: AuditLogEntry = {**raw_entry, "signature": signature}
        
        new_audit_log = state.get("auditLog", []).copy()
        new_audit_log.append(audit_entry)
        return {
            "governance": new_governance,
            "artifacts": {**artifacts, "complianceStatus": new_compliance},
            "auditLog": new_audit_log
        }
    
    return {}

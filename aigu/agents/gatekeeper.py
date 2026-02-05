from datetime import datetime, timezone
from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry

def gatekeeper_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Gatekeeper Agent Node.
    Manages 'Offline Approvals', transitions, and link verification.
    Ref: agents/gatekeeper.md, A2UI/OFFLINE_WORKFLOW_MECHANISM.md, verification_rules.md
    """
    project_metadata = state.get("projectMetadata", {})
    risk_level = project_metadata.get("riskLevel", "Low")
    current_stage = project_metadata.get("currentStage", "Intake")
    
    artifacts = state.get("artifacts", {})
    compliance_status = artifacts.get("complianceStatus", [])
    tech_design = artifacts.get("technicalDesign", {})
    
    governance = state.get("governance", {})
    current_status = governance.get("status", "Draft")
    
    # NEW: System Config
    system_config = state.get("systemConfig", {})
    whitelist = system_config.get("linkDomainWhitelist", ["github.com", "sharepoint.com"])
    
    action_log = []
    blockers = []
    
    new_governance = governance.copy()
    new_compliance = compliance_status[:]
    
    # Logic 0: Link & Source Security (verification_rules.md)
    # Check for invalid links in technicalDesign
    # (Simple logic: check any string value starting with http)
    invalid_links = []
    for key, val in tech_design.items():
        if isinstance(val, str) and val.startswith("http"):
            domain_ok = False
            for safe_domain in whitelist:
                if safe_domain in val:
                    domain_ok = True
                    break
            if not domain_ok:
                invalid_links.append(f"{key}: {val}")
    
    if invalid_links:
        # If links are bad, we BLOCK immediately per Rule 3
        blockers.append(f"Security Rule Violation: Non-whitelisted domains found: {'; '.join(invalid_links)}")

    # Logic 1: Triggering Event
    if risk_level == "High" and not compliance_status and current_status == "Draft" and not blockers:
        new_compliance = [
            {"horizontal": "Legal", "status": "Pending"},
            {"horizontal": "GIGC", "status": "Pending"}
        ]
        new_governance["status"] = "In-Review"
        action_log.append("Initiated GIGC/Legal Review")
        
    # Logic 2: Evaluate Signals
    all_approved = True
    has_pending = False
    
    # If already blocked by Logic 0, we don't need deep link check yet, or merge them?
    # Let's merge
    
    if new_compliance:
        for item in new_compliance:
            status = item.get("status", "Pending")
            if status == "Challenged":
                all_approved = False
                comment = item.get("comment", "No comment provided")
                blockers.append(f"{item['horizontal']}: {comment}")
            elif status == "Pending":
                all_approved = False
                has_pending = True
    
    # Logic 3: State Mutation
    if blockers:
        new_governance["status"] = "Blocked"
        new_governance["blockers"] = blockers
        action_log.append(f"Blocked by {len(blockers)} check(s)")
    elif all_approved and new_compliance and not invalid_links:
        new_governance["status"] = "Approved"
        new_governance["blockers"] = []
        action_log.append("All Verification Checks Passed")
    elif has_pending:
        new_governance["status"] = "In-Review"
    
    # Audit Log
    if action_log:
        audit_entry: AuditLogEntry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent": "Gatekeeper",
            "action": "Gateway Evaluation",
            "reason": "; ".join(action_log)
        }
        new_audit_log = state.get("auditLog", []).copy()
        new_audit_log.append(audit_entry)
        return {
            "governance": new_governance,
            "artifacts": {**artifacts, "complianceStatus": new_compliance},
            "auditLog": new_audit_log
        }
    
    return {}

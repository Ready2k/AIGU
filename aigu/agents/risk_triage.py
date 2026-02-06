from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Literal
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity
from aigu.llm import query_nova_json

RISK_SYSTEM_PROMPT = """
You are the AIGU Risk & Triage Agent. Your role is to evaluate the technical complexity and data sensitivity of AI projects and assign a Risk Level and SLA.

Risk Levels:
- 'High': Assigned to all Generative AI (GenAI), Large Language Model (LLM), or AI Agent projects. These require deep scrutiny. SLA: 10 days.
- 'Med': Assigned to projects involving internal data, new technical implementations, or medium complexity integrations. SLA: 7 days.
- 'Low': Assigned to standard software deployments, low-risk tactical tools, or projects with no sensitive data/complex logic. SLA: 3 days.

Analyze the description and path provided and return your decision in JSON format.
If the path is 'Accelerator', it MUST be 'High' risk.
If 'Standard', it is likely 'Low' or 'Med' unless specifically complex.

JSON Structure Required:
- riskLevel: String ('High', 'Med', 'Low')
- slaDays: Integer (3, 7, or 10)
- thoughtProcess: String (Detailed analysis of risk factors)
"""

def risk_triage_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Risk & Triage Agent powered by Amazon Nova.
    """
    project_metadata = state.get("projectMetadata", {})
    description = state.get("artifacts", {}).get("intakeData", {}).get("description", "")
    path = project_metadata.get("path", "Stop")
    submission_id = state.get("submissionId", "unknown")

    # 1. Invoke Amazon Nova for Intelligent Risk Analysis
    print(f"Risk: Invoking Amazon Nova for project risk triage.")
    analysis = query_nova_json(
        system_prompt=RISK_SYSTEM_PROMPT,
        user_prompt=f"Path: {path}\nProject Description: {description}",
        expected_keys=["riskLevel", "slaDays", "thoughtProcess"]
    )

    risk_level = analysis.get("riskLevel", "Low")
    sla_days = analysis.get("slaDays", 3)
    thought_process = analysis.get("thoughtProcess", "Step-by-step risk analysis carried out.")

    # 2. State & SLA Logic
    deadline_date = datetime.now(timezone.utc) + timedelta(days=sla_days)
    sla_deadline_str = deadline_date.date().isoformat()
    
    new_metadata = project_metadata.copy()
    new_metadata["riskLevel"] = risk_level
    
    new_governance = state.get("governance", {}).copy()
    new_governance["slaDeadline"] = sla_deadline_str
    
    if path == "Standard":
        new_governance["status"] = "Approved"
        thought_process += "\n\nStandard path detected: Project Auto-Approved per governance rules."
    
    # 3. Persistence & Audit
    s3_uri = upload_reasoning_to_s3(submission_id, "Risk & Triage", thought_process)

    timestamp = datetime.now(timezone.utc).isoformat()
    raw_entry = {
        "timestamp": timestamp,
        "agent": "Risk & Triage",
        "action": f"Risk set to {risk_level}",
        "reason": f"SLA set to {sla_days} days powered by Amazon Nova.",
        "reasoningContext": s3_uri,
        "userIdentity": get_current_user_identity()
    }
    signature = generate_audit_signature(raw_entry)
    audit_entry: AuditLogEntry = {**raw_entry, "signature": signature}
    
    new_audit_log = state.get("auditLog", []).copy()
    new_audit_log.append(audit_entry)

    return {
        "projectMetadata": new_metadata,
        "governance": new_governance,
        "auditLog": new_audit_log
    }

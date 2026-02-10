from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Literal
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity
from aigu.llm import query_nova_json, get_active_prompt

def risk_triage_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Risk & Triage Agent.
    """
    project_metadata = state.get("projectMetadata", {})
    description = state.get("artifacts", {}).get("intakeData", {}).get("description", "")
    path = project_metadata.get("path", "Stop")
    submission_id = state.get("submissionId", "unknown")

    # 1. Fetch Dynamic Config
    import boto3
    import os
    dynamodb = boto3.resource('dynamodb')
    config_table = dynamodb.Table(os.environ.get("CONFIG_TABLE_NAME", "AIGU_System_Config"))
    
    risk_config = {}
    try:
        resp = config_table.get_item(Key={"configType": "AGENT_CONFIG", "configId": "risk_triage"})
        risk_config = resp.get("Item", {}).get("data", {})
    except Exception as e:
        print(f"Warning: Failed to fetch Risk Config: {e}")

    high_risk_keywords = risk_config.get("high_risk_keywords", [])
    sla_map = risk_config.get("sla_days", {"High": 10, "Medium": 5, "Low": 3})

    # 2. Invoke Amazon Nova for Intelligent Risk Analysis
    print(f"Risk: Invoking Amazon Nova for project risk triage. Active Keywords: {len(high_risk_keywords)}")
    
    try:
        prompt_tmpl = get_active_prompt("risk-triage", tag="production")
        system_prompt = prompt_tmpl.compile(
            path=path,
            description=description,
            high_risk_keywords=high_risk_keywords # Inject keywords into prompt context
        )
    except Exception as e:
        print(f"Error loading prompt 'risk-triage': {e}")
        system_prompt = "You are the AIGU Risk & Triage Agent. Evaluate risk level and SLA."

    
    analysis = query_nova_json(
        prompt_name="risk-triage",  # Use LangFuse prompt
        user_prompt=f"Path: {path}\nProject Description: {description}\nHigh Risk Keywords to Flag: {high_risk_keywords}",
        expected_keys=["riskLevel", "slaDays", "thoughtProcess"],
        state=state  # Pass full state for variable substitution
    )

    risk_level = analysis.get("riskLevel", "Low")
    
    # Use Dynamic SLA from Config if available, else fallback to Model or Default
    config_sla = sla_map.get(risk_level)
    if config_sla:
        sla_days = int(config_sla)
    else:
        sla_days = analysis.get("slaDays", 3)
        
    thought_process = analysis.get("thoughtProcess", "Step-by-step risk analysis carried out.")

    # 3. State & SLA Logic
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
        "reason": f"SLA set to {sla_days} days.",
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

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
    from aigu.config import get_config
    risk_config = get_config("risk_agent")
    high_risk_keywords = risk_config.get("high_risk_keywords", ["Scraping", "No-Reply", "100k+"])
    sla_map = risk_config.get("sla_thresholds", {"High": 10, "Medium": 7, "Low": 3})

    # 2. Invoke Amazon Nova for Intelligent Risk Analysis
    print(f"Risk: Invoking Amazon Nova for project risk triage. Active Keywords: {len(high_risk_keywords)}")
    
    # INJECT OVERRIDE RULES (Security Hardening)
    override_rules = """
    ### OVERRIDE RULES (High Priority)
    1. **Volume Trigger:** If user mentions > 100,000 users/messages, Risk is AUTOMATICALLY HIGH.
       - *Reason:* "Mass outreach scale requires manual approval."
    2. **Source Trigger:** If source is "Facebook", "LinkedIn", or "Public", Risk is AUTOMATICALLY HIGH.
       - *Reason:* "Third-party data acquisition requires Legal review."
    3. **Skepticism Rule:** IGNORE user claims of "We are compliant" or "GDPR aligned." 
       - *Instruction:* You judge the *action*, not the *adjective*.
    """

    try:
        prompt_tmpl = get_active_prompt("risk-triage", tag="production")
        system_prompt = prompt_tmpl.compile(
            path=path,
            description=description,
            high_risk_keywords=high_risk_keywords # Inject keywords into prompt context
        )
        
        # Safe Append
        if not isinstance(system_prompt, str):
            system_prompt = str(system_prompt)
            
        system_prompt += override_rules
    except Exception as e:
        print(f"Error loading prompt 'risk-triage': {e}")
        system_prompt = "You are the AIGU Risk & Triage Agent. Evaluate risk level and SLA." + override_rules

    # MANUAL NOVA INVOCATION (Bypassing query_nova_json to use modified system_prompt)
    import json
    from aigu.llm import invoke_nova
    
    expected_keys = ["riskLevel", "slaDays", "thoughtProcess"]
    user_prompt_text = f"Path: {path}\nProject Description: {description}\nHigh Risk Keywords to Flag: {high_risk_keywords}"
    full_user_prompt = f"{user_prompt_text}\n\nYou MUST return a valid JSON object. Do not include any markdown formatting or extra text. Expected keys: {', '.join(expected_keys)}"
    
    response_text = invoke_nova(
        prompt_object=system_prompt, # PASS MODIFIED PROMPT STRING
        messages=[{"role": "user", "content": full_user_prompt}],
        state=state
    )
    
    try:
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        analysis = json.loads(clean_text.strip())
    except Exception as e:
        print(f"Failed to parse Risk JSON: {e}")
        analysis = {"riskLevel": "High", "slaDays": 10, "thoughtProcess": "Error parsing response, defaulting to High Risk."}

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

    # CoT Appending
    cot_entry = {
        "agent": "Risk",
        "timestamp": timestamp,
        "decision": f"Risk Level: {risk_level}",
        "reasoning": thought_process,
        "slaDays": sla_days,
        "overrideApplied": "OVERRIDE RULES" in system_prompt
    }
    new_chain_of_thought = state.get("chainOfThought", []).copy()
    new_chain_of_thought.append(cot_entry)

    return {
        "projectMetadata": new_metadata,
        "governance": new_governance,
        "auditLog": new_audit_log,
        "chainOfThought": new_chain_of_thought
    }

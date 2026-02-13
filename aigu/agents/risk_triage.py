from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Literal
from aigu.state import GlobalState, AuditLogEntry
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity
from aigu.llm import query_nova_json, get_active_prompt

def risk_triage_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Risk & Triage Agent.
    """
    # [FIX] Respect Admin Action: If admin requested info or approved, bypass
    gov_state = state.get("governance", {})
    if gov_state.get("adminAction") == "ADMIN_REQUEST_INFO" or gov_state.get("adminApproved"):
        print("Risk: Admin Action detected. Bypassing model assessment.")
        return {
            "projectMetadata": state.get("projectMetadata", {}),
            "governance": gov_state,
            "auditLog": state.get("auditLog", []),
            "chainOfThought": state.get("chainOfThought", []),
            "ui_overlay": state.get("ui_overlay", {})
        }

    project_metadata = state.get("projectMetadata", {})
    description = state.get("artifacts", {}).get("intakeData", {}).get("description", "")
    path = project_metadata.get("path", "Stop")
    submission_id = state.get("submissionId", "unknown")
    
    # [FIX] Respect Admin Approval
    if state.get("governance", {}).get("adminApproved"):
        print("Risk: Project is Admin Approved. Bypassing risk re-evaluation.")
        return {
            "projectMetadata": project_metadata,
            "governance": state.get("governance", {}),
            "auditLog": state.get("auditLog", []),
            "chainOfThought": state.get("chainOfThought", []),
            "ui_overlay": state.get("ui_overlay", {})
        }
    
    # 1. Fetch Dynamic Config
    from aigu.config import get_config
    risk_config = get_config("risk_agent")
    high_risk_keywords = risk_config.get("high_risk_keywords", ["Scraping", "No-Reply", "100k+"])
    sla_map = risk_config.get("sla_thresholds", {"High": 10, "Medium": 7, "Low": 3})

    # 2. Invoke Amazon Nova for Intelligent Risk Analysis
    print(f"Risk: Invoking Amazon Nova for project risk triage. Active Keywords: {len(high_risk_keywords)}")
    
    # 2. Invoke Amazon Nova for Intelligent Risk Analysis
    print(f"Risk: Invoking Amazon Nova for project risk triage. Active Keywords: {len(high_risk_keywords)}")
    
    try:
        prompt_tmpl = get_active_prompt("risk-triage", tag="production")
        
        # Build state dict for prompt variable substitution
        prompt_state = {
            **state,
            'path': path,
            'description': description,
            'high_risk_keywords': high_risk_keywords
        }
    except Exception as e:
        print(f"Error loading prompt 'risk-triage': {e}")
        # Comprehensive fallback that enforces Core Principles even when Langfuse is down
        fallback_prompt = """You are the AIGU Risk & Triage Agent. Evaluate risk level and SLA.
        
        ### CORE RISK PRINCIPLES
        If the project involves Scraping, Mass Outreach, or High-Stakes HR Automation:
        1. Set riskLevel to "High".
        2. Include the exact string "Governance Pre-Triage Warning" in your thoughtProcess.
        
        If path is 'Accelerator', riskLevel MUST be 'High'."""
        
        prompt_state = state
        prompt_tmpl = fallback_prompt

    # MANUAL NOVA INVOCATION (Bypassing query_nova_json to use prompt_tmpl)
    import json
    from aigu.llm import invoke_nova
    
    expected_keys = ["riskLevel", "slaDays", "thoughtProcess"]
    user_prompt_text = f"Path: {path}\nProject Description: {description}\nHigh Risk Keywords to Flag: {high_risk_keywords}"
    full_user_prompt = f"{user_prompt_text}\n\nYou MUST return a valid JSON object. Do not include any markdown formatting or extra text. Expected keys: {', '.join(expected_keys)}"
    
    response_text = invoke_nova(
        prompt_object=prompt_tmpl,
        messages=[{"role": "user", "content": full_user_prompt}],
        state=prompt_state
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
    if not isinstance(thought_process, str):
        thought_process = json.dumps(thought_process) if isinstance(thought_process, (dict, list)) else str(thought_process)

    # 3. State & SLA Logic
    deadline_date = datetime.now(timezone.utc) + timedelta(days=sla_days)
    sla_deadline_str = deadline_date.date().isoformat()
    
    new_metadata = project_metadata.copy()
    new_metadata["riskLevel"] = risk_level
    
    new_governance = state.get("governance", {}).copy()
    new_governance["slaDeadline"] = sla_deadline_str
    
    if path == "Standard":
        new_governance["status"] = "In-Review"
        new_metadata["currentStage"] = "Librarian"
        thought_process += "\n\nStandard path detected: Project moves to Librarian stage."
    elif path == "Accelerator":
        new_governance["status"] = "In-Review"
        new_metadata["currentStage"] = "POC"
    else:
        new_governance["status"] = "In-Review"
        new_metadata["currentStage"] = "Librarian" # Standard default next step
    
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
        "overrideApplied": "CORE RISK PRINCIPLES" in str(prompt_tmpl)
    }
    new_chain_of_thought = state.get("chainOfThought", []).copy()
    new_chain_of_thought.append(cot_entry)

    # 4. UI Overlay & Admin Analysis
    # We provide two distinct views:
    # - supportMessage: For the End User (Polite, high-level)
    # - adminAnalysis: For the Admin/SME (Detailed, raw reasoning)
    
    user_message = f"**Risk Level:** {risk_level}\n**SLA:** {sla_days} Days\n\nYour project has been assessed. {thought_process.split('.')[0]}."
    
    # [NEW] Governance Pre-Triage Warning Injection
    # More robust detection (case-insensitive and principle names)
    thought_lower = thought_process.lower()
    violation_keywords = ["governance pre-triage warning", "violates", "violation", "core risk principle"]
    
    if any(kw in thought_lower for kw in violation_keywords) and risk_level == "High":
        warning_msg = "⚠️ **Governance Pre-Triage Warning:** This project contains elements that appear to violate AIGU standards."
        user_message = f"{warning_msg}\n\n{user_message}"

    new_ui_overlay = state.get("ui_overlay", {}).copy()
    new_ui_overlay["supportMessage"] = user_message
    new_ui_overlay["adminAnalysis"] = thought_process # Raw SME technical analysis
    
    return {
        "projectMetadata": new_metadata,
        "governance": new_governance,
        "auditLog": new_audit_log,
        "chainOfThought": new_chain_of_thought,
        "ui_overlay": new_ui_overlay
    }

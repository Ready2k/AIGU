from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry
from aigu.llm import invoke_nova, get_active_prompt
import boto3
import os

# Initialize S3
s3_client = boto3.client('s3')

def generate_presigned_url(s3_uri: str, expiration=3600) -> str:
    """
    Generates a secure pre-signed URL for an S3 URI.
    Format: s3://bucket/key
    """
    try:
        # Parse URI
        if not s3_uri.startswith("s3://"):
            return ""
        
        parts = s3_uri.replace("s3://", "").split("/", 1)
        if len(parts) != 2:
            return ""
            
        bucket = parts[0]
        key = parts[1]
        
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': bucket, 'Key': key},
                                                    ExpiresIn=expiration)
        return response
    except Exception as e:
        print(f"Error generating pre-signed URL: {e}")
        return ""

def support_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Support & Insights Agent Node powered by Amazon Nova.
    Provides transparent feedback and secure access to audit reasoning.
    """
    # Read-Only Access
    project_metadata = state.get("projectMetadata", {})
    governance = state.get("governance", {})
    audit_log = state.get("auditLog", [])
    
    # 1. Invoke Amazon Nova for Personalized Status Synthesis
    print(f"Support: Invoking Amazon Nova for status summary.")
    
    # Construct context for Nova
    status = governance.get("status", "Unknown")
    stage = project_metadata.get("currentStage", "Intake")
    blockers = governance.get('blockers', [])
    missing_artifacts = [b.split(": Missing ")[1] for b in blockers if ": Missing " in b]
    
    context_str = f"""
    Current Status: {status}
    Current Stage: {stage}
    Risk Level: {project_metadata.get('riskLevel', 'Low')}
    SLA Deadline: {governance.get('slaDeadline', 'TBD')}
    Blockers: {blockers}
    Missing Artifacts Checklist: {missing_artifacts}
    Path: {project_metadata.get('path', 'Standard')}
    """
    
    try:
        prompt_tmpl = get_active_prompt("support-agent", tag="production")
        system_prompt = prompt_tmpl.compile(
            status=status,
            stage=stage,
            risk_level=project_metadata.get('riskLevel', 'Low'),
            sla_deadline=governance.get('slaDeadline', 'TBD'),
            blockers=blockers,
            missing_artifacts=missing_artifacts,
            path=project_metadata.get('path', 'Standard')
        )
    except Exception as e:
        print(f"Error loading prompt 'support-agent': {e}")
        system_prompt = "You are a professional GIGC Assistant. Help user navigate governance."

    try:
        message = invoke_nova(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": f"State Summary:\n{context_str}"}]
        ).strip()
    except Exception as e:
        print(f"Nova invocation failed for support: {e}")
        message = f"Your project is currently {status} in the {stage} phase."


    # 3. Secure Reasoning Access (Hydrate Audit Log for Viewer)
    presigned_urls = {}
    for entry in audit_log:
        uri = entry.get("reasoningContext")
        if uri:
            url = generate_presigned_url(uri)
            if url:
                presigned_urls[uri] = url

    # 4. Output
    return {
        "ui_overlay": {
            "supportMessage": message,
            "showBlockerAlert": len(governance.get("blockers", [])) > 0,
            "slaDisplay": governance.get("slaDeadline", "TBD"),
            "reasoningUrls": presigned_urls # Map: s3_uri -> https://presigned-url...
        }
    }

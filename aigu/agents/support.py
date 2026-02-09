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
    Support & Insights Agent Node.
    Provides transparent feedback and secure access to audit reasoning.
    """
    # Read-Only Access
    project_metadata = state.get("projectMetadata", {})
    governance = state.get("governance", {})
    audit_log = state.get("auditLog", [])
    artifacts = state.get("artifacts", {})
    
    # [CONTEXT INJECTION] Support for live draft visibility
    # Check if a frontend contextOverride was passed into the graph state
    context_override = state.get("contextOverride")
    if context_override:
        print(f"Support: Merging Context Override into agent reasoning: {list(context_override.keys())}")
        project_metadata = {**project_metadata, **context_override}
        # Sync description into intakeData artifacts if present
        if 'description' in context_override:
            if 'intakeData' not in artifacts: artifacts['intakeData'] = {}
            artifacts['intakeData']['description'] = context_override['description']
        # Sync other form fields
        for k, v in context_override.items():
            if k != 'description' and v:
                if 'intakeData' not in artifacts: artifacts['intakeData'] = {}
                artifacts['intakeData'][k] = v
    
    # 1. Extract Comprehensive Context for Nova
    print(f"Support: Extracting comprehensive state context for personalized guidance.")
    
    # Basic status
    status = governance.get("status", "Unknown")
    stage = project_metadata.get("currentStage", "Intake")
    blockers = governance.get('blockers', [])
    
    # Extract missing artifacts from projectMetadata (set by Librarian)
    missing_artifacts_list = project_metadata.get('missingArtifacts', [])
    
    # Extract risk reasoning from audit log (from Risk & Triage agent)
    risk_level = project_metadata.get('riskLevel', '')
    risk_reasoning = "No specific reasoning recorded."
    for entry in audit_log:
        if entry.get('agent') == 'Risk & Triage':
            # Extract reasoning from the reasoningContext or reason field
            risk_reasoning = entry.get('reason', risk_reasoning)
            break
    
    # Extract technical approach details from artifacts
    tech_design = artifacts.get('technicalDesign', {})
    technical_approach = ""
    if tech_design:
        # Build a summary of key technical details
        tech_parts = []
        if tech_design.get('securityMeasures'):
            tech_parts.append(f"Security: {tech_design.get('securityMeasures')}")
        if tech_design.get('architecture'):
            tech_parts.append(f"Architecture: {tech_design.get('architecture')}")
        if tech_design.get('dataFlow'):
            tech_parts.append(f"Data Flow: {tech_design.get('dataFlow')}")
        technical_approach = "; ".join(tech_parts) if tech_parts else "Not yet specified"
    else:
        technical_approach = "Not yet specified"
    
    # Format lists for prompt
    blockers_str = ", ".join(blockers) if blockers else "None"
    missing_artifacts_str = ", ".join(missing_artifacts_list) if missing_artifacts_list else ""
    
    # Construct context string for fallback
    context_str = f"""
    Current Status: {status}
    Current Stage: {stage}
    Risk Level: {risk_level}
    Risk Reasoning: {risk_reasoning}
    SLA Deadline: {governance.get('slaDeadline', 'TBD')}
    Blockers: {blockers_str}
    Missing Artifacts: {missing_artifacts_str}
    Technical Approach: {technical_approach}
    Path: {project_metadata.get('path', 'Standard')}
    """
    
    # 2. Invoke Amazon Nova for Personalized Status Synthesis
    print(f"Support: Invoking Amazon Nova for status summary.")
    
    try:
        prompt_tmpl = get_active_prompt("support-agent", tag="production")
        
        # Build state dict for prompt variable substitution
        prompt_state = {
            'projectName': project_metadata.get('name', 'Unknown'),
            'status': status,
            'stage': stage,
            'riskLevel': risk_level,
            'riskReasoning': risk_reasoning,
            'slaDeadline': governance.get('slaDeadline', 'TBD'),
            'blockers': blockers_str,
            'missingArtifacts': missing_artifacts_str,
            'technicalApproach': technical_approach,
            'path': project_metadata.get('path', 'Standard')
        }
        
        message = invoke_nova(
            prompt_object=prompt_tmpl,
            messages=[{"role": "user", "content": f"State Summary:\n{context_str}"}],
            state=prompt_state
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

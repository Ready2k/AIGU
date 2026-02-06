from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry
import boto3
import os

# Initialize S3 (Outside handler for reuse)
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
    Ref: agents/support.md
    """
    # Read-Only Access
    project_metadata = state.get("projectMetadata", {})
    governance = state.get("governance", {})
    audit_log = state.get("auditLog", [])
    
    # 1. Gather Context
    status = governance.get("status", "Unknown")
    stage = project_metadata.get("currentStage", "Intake")
    risk = project_metadata.get("riskLevel", "Low")
    deadline = governance.get("slaDeadline", "TBD")
    blockers = governance.get("blockers", [])
    
    # 2. Construct The Message
    message = ""
    if status == "Blocked":
        message = f"Your project is currently BLOCKED by {len(blockers)} team(s)."
        if blockers:
            message += f" Reason(s): {'; '.join(blockers)}."
        message += " Please resolve these challenges to proceed."
    elif status == "In-Review":
         message = f"Your project is under review (Stage: {stage})."
         message += f" We are waiting for offline approvals."
         if deadline != "TBD":
             message += f" Expected completion by {deadline}."
    elif status == "Approved":
        message = f"Congratulations! Your {risk}-Risk project is Approved for {stage}."
    elif status == "Draft":
        message = f"Welcome back. You are currently in the {stage} phase."
    else:
        message = "How can I help you today?"

    # 3. Secure Reasoning Access (Hydrate Audit Log for Viewer)
    # We iterate the log and generate presigned URLs for any reasoningContext
    # This keeps the bucket private while allowing the UI to fetch the text transparently.
    enhanced_audit_log = []
    # Optimization: Only generate if requested or recent? 
    # For now, we'll map the last 5 or just provide a helper capability.
    # Since we can't easily "modify" the input state audit log continuously without bloating,
    # we return a transient map of signed URLs in the ui_overlay.
    
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
            "showBlockerAlert": len(blockers) > 0,
            "slaDisplay": deadline,
            "reasoningUrls": presigned_urls # Map: s3_uri -> https://presigned-url...
        }
    }

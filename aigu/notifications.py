import boto3
import os
import json
from typing import List, Optional

# Initialize SES Client
ses_client = boto3.client('ses', region_name=os.environ.get("AWS_REGION", "us-east-1"))
SENDER_EMAIL = os.environ.get("NOTIFY_EMAIL_SENDER", "governance@aigu.io")

def send_governance_email(
    project_id: str,
    recipient_email: str,
    role: str,
    status_update: str,
    sla_deadline: Optional[str] = None,
    blockers: Optional[List[str]] = None,
    admin_link: Optional[str] = None
):
    """
    Sends a governance notification email using AWS SES.
    Aligned with AIGU Radical Transparency goals.
    """
    subject = f"AIGU Governance Update: Project {project_id} | {role}"
    
    # Construct Body
    body_text = f"Hello {role},\n\n"
    body_text += f"You have a new update regarding Project: {project_id}\n\n"
    body_text += f"Status Summary:\n{status_update}\n\n"
    
    if sla_deadline:
        body_text += f"📅 SLA Deadline: {sla_deadline}\n"
        
    if blockers:
        body_text += "\n🚫 Missing Artifacts / Blockers:\n"
        for blocker in blockers:
            body_text += f"- {blocker}\n"
            
    if admin_link and role.lower() == "admin":
        body_text += f"\n👉 Review Action Required: {admin_link}\n"
        
    body_text += "\nThank you,\nAIGU Governance Orchestrator"

    print(f"Notifications: Sending email to {recipient_email} for project {project_id}")
    
    try:
        response = ses_client.send_email(
            Source=SENDER_EMAIL,
            Destination={'ToAddresses': [recipient_email]},
            Message={
                'Subject': {'Data': subject},
                'Body': {
                    'Text': {'Data': body_text}
                }
            }
        )
        return response['MessageId']
    except Exception as e:
        print(f"Failed to send email: {e}")
        return None

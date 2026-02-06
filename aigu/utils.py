import boto3
import os
import json
import hashlib
from datetime import datetime, timezone

# Initialize S3 Client (Mocked in tests, Real in Prod)
s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get("ARTIFACT_BUCKET", "aigu-artifacts-mock")

def upload_reasoning_to_s3(submission_id: str, agent_name: str, reasoning_text: str) -> str:
    """
    Uploads the Chain-of-Thought (CoT) reasoning to S3 and returns the URI.
    Format: s3://<bucket>/reasoning/<submissionId>/<timestamp>-<agent>.txt
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    safe_agent = agent_name.replace(" ", "_").lower()
    key = f"reasoning/{submission_id}/{timestamp}-{safe_agent}.txt"
    
    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=key,
            Body=reasoning_text,
            ContentType="text/plain"
        )
        return f"s3://{BUCKET_NAME}/{key}"
    except Exception as e:
        print(f"Error uploading reasoning to S3: {e}")
        return "s3://upload-failed"

def generate_audit_signature(entry: dict) -> str:
    """
    Generates an immutable SHA-256 signature for the audit log entry.
    Fields: timestamp + agent + action + reason + reasoningContext
    """
    # Canonical string format
    payload = f"{entry.get('timestamp')}|{entry.get('agent')}|{entry.get('action')}|{entry.get('reason')}|{entry.get('reasoningContext')}"
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()

def get_current_user_identity() -> str:
    """
    Retrieves the IAM Identity or equivalent.
    In Lambda context, this could come from the event context. 
    Here we stub it or retrieve from env if mocked.
    """
    # For now, return a placeholder or mock
    # In real AWS Lambda with Identity Federation, we'd parse the request context
    return "arn:aws:sts::123456789012:assumed-role/AIGU_User/simulation"

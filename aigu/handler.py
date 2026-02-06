import json
import os
from aigu.graph import app
from typing import Dict, Any

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Unified AWS Lambda Handler for AIGU LangGraph Engine.
    Routes requests to Invoke (agents) or State (persistence).
    """
    print(f"Received event: {json.dumps(event)}")
    
    path = event.get("path", "")
    method = event.get("httpMethod", "POST")
    
    try:
        # Normalize response headers for CORS
        headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
        }

        # 1. OPTION Request (CORS Preflight)
        if method == "OPTIONS":
            return {"statusCode": 204, "headers": headers, "body": ""}

        # 2. Extract Submission ID (The Thread ID for LangGraph)
        submission_id = None
        user_id = None
        payload = {}

        if method == "POST":
            body_str = event.get("body", "{}")
            payload = json.loads(body_str) if isinstance(body_str, str) else body_str
            submission_id = payload.get("submissionId")
            user_id = payload.get("userId")
        else:
            query_params = event.get("queryStringParameters", {}) or {}
            submission_id = query_params.get("submissionId")
            user_id = query_params.get("userId")

        if not submission_id:
            # Fallback for old tests that might use projectName as ID or missing ID
            submission_id = payload.get("projectName", "default-session")
        
        # 3. Configure LangGraph
        config = {"configurable": {"thread_id": submission_id}}

        # 4. Handle Routing
        # --- PATH: /invoke ---
        if "/invoke" in path:
            # Initialize LangFuse
            from langfuse.langchain import CallbackHandler
            langfuse_handler = CallbackHandler()
            
            # 4.1 Normalize Payload for LangGraph State
            metadata = {
                "langfuse_session_id": submission_id,
                "langfuse_user_id": user_id
            }
            agent = payload.get("agent")
            inner_payload = payload.get("payload", {})

            # --- Explicit Initialization Block ---
            if agent == "intake":
                import boto3
                dynamodb = boto3.resource('dynamodb')
                state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
                
                project_id = submission_id
                print(f"Attempting to persist state for project: {project_id}")
                state_table.put_item(Item={
                    "submissionId": submission_id,
                    "userId": user_id,
                    "artifacts": {"intakeData": inner_payload},
                    "projectMetadata": {"currentStage": "Intake", "path": "Pending"},
                    "governance": {"status": "Draft"},
                    "auditLog": []
                })

            graph_input = {
                "submissionId": submission_id,
                "userId": user_id
            }

            if agent == "intake":
                graph_input["artifacts"] = {"intakeData": inner_payload}
            elif agent == "outcome":
                graph_input["governance"] = {"status": "Approved" if inner_payload.get("scopeAck") else "Blocked"}
            else:
                graph_input.update(payload)

            # Pass trace callbacks and metadata
            print(f"Invoking graph with input: {json.dumps(graph_input, default=str)}")
            # LangGraph handles persistence via the DynamoDBSaver checkpointer configured in graph.py
            result = app.invoke(
                graph_input, 
                config={**config, "callbacks": [langfuse_handler], "metadata": metadata}
            )
            print(f"Graph result: {json.dumps(result, default=str)}")
            
            if hasattr(langfuse_handler, "client"):
                langfuse_handler.client.flush()
            
            # Enrich with fresh pre-signed URLs
            enriched_result = enrich_state_with_presigned_urls(result)
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(enriched_result, default=str)
            }

        # --- PATH: /state ---
        elif "/state" in path:
            state_data = app.get_state(config)
            
            if not state_data or not state_data.values:
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({
                        "submissionId": submission_id,
                        "userId": user_id,
                        "projectMetadata": {"currentStage": "Intake", "path": "Pending"},
                        "governance": {"status": "New"},
                        "auditLog": [],
                        "ui_overlay": {"reasoningUrls": {}}
                    })
                }

            # Enrich with fresh pre-signed URLs
            enriched_state = enrich_state_with_presigned_urls(dict(state_data.values))

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(enriched_state, default=str)
            }

        # --- UNKNOWN PATH ---
        return {
            "statusCode": 404,
            "headers": headers,
            "body": json.dumps({"message": f"Path {path} not found"})
        }

    except Exception as e:
        print(f"Execution Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"message": str(e), "type": type(e).__name__})
        }

def enrich_state_with_presigned_urls(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates fresh pre-signed S3 URLs for all reasoning context URIs in the audit log.
    Stored in ui_overlay.reasoningUrls mapping.
    """
    import boto3
    s3 = boto3.client('s3')
    reasoning_urls = {}
    
    audit_log = state.get("auditLog", [])
    for entry in audit_log:
        s3_uri = entry.get("reasoningContext")
        if s3_uri and s3_uri.startswith("s3://"):
            try:
                # Parse URI: s3://bucket/key
                parts = s3_uri.replace("s3://", "").split("/", 1)
                if len(parts) == 2:
                    bucket, key = parts
                    url = s3.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': bucket, 'Key': key},
                        ExpiresIn=3600 # 1 Hour
                    )
                    reasoning_urls[s3_uri] = url
            except Exception as e:
                print(f"Warning: Failed to pre-sign {s3_uri}: {e}")

    state["ui_overlay"] = {
        **(state.get("ui_overlay", {}) or {}),
        "reasoningUrls": reasoning_urls
    }
    return state

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
            # The frontend sends: { agent, submissionId, userId, payload }
            # LangGraph expects GlobalState structure.
            agent = payload.get("agent")
            inner_payload = payload.get("payload", {})
            
            graph_input = {
                "submissionId": submission_id,
                "userId": user_id
            }

            if agent == "intake":
                # Map DiscoveryCanvas data
                graph_input["artifacts"] = {
                    "intakeData": inner_payload
                }
            elif agent == "outcome":
                # Map DeltaReview data (e.g. scopeAck)
                # In this mock, we might just merge it or use it to update governance
                graph_input["governance"] = {
                    "status": "Approved" if inner_payload.get("scopeAck") else "Blocked"
                }
            else:
                # Direct invocation fallback (for CLI tests)
                graph_input.update(payload)

            # Pass trace callbacks
            print(f"Invoking graph with input: {json.dumps(graph_input, default=str)}")
            result = app.invoke(graph_input, config={**config, "callbacks": [langfuse_handler]})
            print(f"Graph result: {json.dumps(result, default=str)}")
            
            if hasattr(langfuse_handler, "client"):
                langfuse_handler.client.flush()
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(result, default=str)
            }

        # --- PATH: /state ---
        elif "/state" in path:
            state_data = app.get_state(config)
            
            # If no state exists yet, return an empty template rather than a 404
            # to prevent frontend from breaking on new submissions
            if not state_data or not state_data.values:
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({
                        "submissionId": submission_id,
                        "userId": user_id,
                        "projectMetadata": {"currentStage": "Intake", "path": "Pending"},
                        "governance": {"status": "New"},
                        "auditLog": []
                    })
                }

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(state_data.values, default=str)
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

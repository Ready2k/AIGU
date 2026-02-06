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
    
    # 0. Load System Config (Bootstrap)
    load_system_config()
    
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
                # Ensure userId is a string for DynamoDB sort key
                effective_userId = user_id if user_id and user_id != 'null' else "anonymous"
                
                print(f"Attempting to persist initial state for project: {project_id}")
                state_table.put_item(Item={
                    "submissionId": submission_id,
                    "userId": effective_userId,
                    "artifacts": {"intakeData": inner_payload},
                    "projectMetadata": {"currentStage": "Intake", "path": "Pending"},
                    "governance": {"status": "Draft"},
                    "auditLog": []
                })

            graph_input = {
                "submissionId": submission_id,
                "userId": user_id if user_id and user_id != 'null' else "anonymous"
            }

            if agent == "intake":
                graph_input["artifacts"] = {"intakeData": inner_payload}
            elif agent == "admin_action":
                action = inner_payload.get("action")
                print(f"Applying Admin Action: {action} for {submission_id}")
                
                # Fetch current state from Global State table to ensure we have the whole picture
                import boto3
                dynamodb = boto3.resource('dynamodb')
                state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
                response = state_table.get_item(Key={"submissionId": submission_id, "userId": graph_input["userId"]})
                current_state = response.get("Item", {})
                
                # Merge Admin Action into Governance
                new_gov = current_state.get("governance", {}).copy()
                if action == "ADMIN_APPROVE":
                    new_gov.update({
                        "status": "Approved",
                        "adminApproved": True,
                        "adminAction": "ADMIN_APPROVE"
                    })
                elif action == "ADMIN_REQUEST_INFO":
                    msg = inner_payload.get("message", "Missing Information")
                    new_gov.update({
                        "status": "Blocked",
                        "adminAction": "ADMIN_REQUEST_INFO",
                        "adminMessage": msg,
                        "blockers": [f"Admin Request: {msg}"]
                    })
                
                graph_input["governance"] = new_gov
            elif agent == "outcome" or agent == "handover":
                graph_input["governance"] = {"status": "Approved" if inner_payload.get("scopeAck") else "Blocked"}
            elif agent == "production":
                # Handle production resubmission with delta calculation
                previous_version_id = inner_payload.get("previousVersionId")
                if previous_version_id:
                    print(f"Production resubmission: Calculating delta from {previous_version_id}")
                    
                    import boto3
                    dynamodb = boto3.resource('dynamodb')
                    state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
                    
                    try:
                        # Fetch previous version
                        prev_response = state_table.get_item(Key={"submissionId": previous_version_id, "userId": graph_input["userId"]})
                        if "Item" in prev_response:
                            from aigu.delta_calculator import get_delta_details
                            previous_state = prev_response["Item"]
                            
                            # Fetch current state (to combine with new data)
                            curr_response = state_table.get_item(Key={"submissionId": submission_id, "userId": graph_input["userId"]})
                            current_state = curr_response.get("Item", {})
                            
                            # Temp state for delta calculation
                            temp_state = json.loads(json.dumps(current_state))
                            if "artifacts" not in temp_state: temp_state["artifacts"] = {}
                            
                            delta_details = get_delta_details(temp_state, previous_state)
                            delta_pct = delta_details["deltaPercentage"]
                            print(f"Delta calculated: {delta_pct}%")
                            
                            graph_input["projectMetadata"] = {
                                "previousVersionId": previous_version_id,
                                "deltaPercentage": delta_pct
                            }
                        else:
                            print(f"Warning: Previous version {previous_version_id} not found")
                    except Exception as e:
                        print(f"Error calculating delta in handler: {e}")
                
                graph_input["artifacts"] = {
                    "productionData": inner_payload.get("productionData", {})
                }
            else:
                graph_input.update(payload)

            # Pass trace callbacks and metadata
            print(f"Invoking graph with input: {json.dumps(graph_input, default=str)}")
            result = app.invoke(
                graph_input, 
                config={**config, "callbacks": [langfuse_handler], "metadata": metadata}
            )
            print(f"Graph result keys: {list(result.keys())}")
            
            # For admin actions & persistent state sync, update the Global State table
            import boto3
            dynamodb = boto3.resource('dynamodb')
            state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
            
            # Ensure submissionId and userId are present in the result for the put_item key requirement
            if "submissionId" not in result: result["submissionId"] = submission_id
            if "userId" not in result: result["userId"] = graph_input["userId"]
            
            print(f"Updating Global State for {submission_id} (Status: {result.get('governance', {}).get('status')})")
            state_table.put_item(Item=result)
            
            if hasattr(langfuse_handler, "client"):
                langfuse_handler.client.flush()
            
            # Enrich with fresh pre-signed URLs
            enriched_result = enrich_state_with_presigned_urls(result)
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(enriched_result, default=str)
            }

        # --- PATH: /admin/list ---
        elif "/admin/list" in path:
            import boto3
            dynamodb = boto3.resource('dynamodb')
            state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
            
            # Simple Scan for Demo (Production should use a Global Secondary Index on Status)
            response = state_table.scan()
            items = response.get('Items', [])
            
            print(f"Admin Queue: Scanned {len(items)} items from DynamoDB")
            for item in items:
                status = item.get('governance', {}).get('status', 'Unknown')
                print(f"  - Project {item.get('submissionId')}: status={status}")
            
            # Filter for Reviewable items (Draft, Pending, In-Review, Blocked)
            review_queue = [
                item for item in items 
                if item.get('governance', {}).get('status') in ['Draft', 'Pending', 'In-Review', 'Blocked']
            ]
            
            print(f"Admin Queue: Filtered to {len(review_queue)} reviewable items")
            
            # Enrich items with reasoning URLs for admin preview
            enriched_queue = [enrich_state_with_presigned_urls(item) for item in review_queue]
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(enriched_queue, default=str)
            }

        # --- PATH: /delta ---
        elif "/delta" in path:
            import boto3
            from aigu.delta_calculator import get_delta_details, format_delta_for_display
            
            dynamodb = boto3.resource('dynamodb')
            state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
            
            # Get current and previous version IDs
            current_id = payload.get("currentVersionId") or submission_id
            previous_id = payload.get("previousVersionId")
            
            if not previous_id:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "previousVersionId is required"})
                }
            
            try:
                # Fetch both versions
                curr_response = state_table.get_item(Key={"submissionId": current_id})
                prev_response = state_table.get_item(Key={"submissionId": previous_id})
                
                if "Item" not in curr_response or "Item" not in prev_response:
                    return {
                        "statusCode": 404,
                        "headers": headers,
                        "body": json.dumps({"error": "One or both versions not found"})
                    }
                
                current_state = curr_response["Item"]
                previous_state = prev_response["Item"]
                
                # Calculate delta
                delta_details = get_delta_details(current_state, previous_state)
                formatted_output = format_delta_for_display(delta_details)
                
                print(f"Delta calculation complete: {delta_details['deltaPercentage']}%")
                
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({
                        "deltaDetails": delta_details,
                        "formattedOutput": formatted_output
                    }, default=str)
                }
            except Exception as e:
                print(f"Error calculating delta endpoint: {e}")
                return {
                    "statusCode": 500,
                    "headers": headers,
                    "body": json.dumps({"error": str(e)})
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

        # --- PATH: /config ---
        elif "/config" in path:
            import boto3
            dynamodb = boto3.resource('dynamodb')
            config_table = dynamodb.Table(os.environ.get("CONFIG_TABLE_NAME", "AIGU_System_Config"))
            
            if method == "POST":
                # Save config (e.g. modelId)
                config_item = {
                    "configType": "SYSTEM",
                    "configId": "CORE",
                    "data": payload
                }
                config_table.put_item(Item=config_item)
                # Re-bootstrap for current execution
                load_system_config()
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"status": "Configuration Updated", "activeModel": payload.get("novaModelId")})
                }
            else:
                # GET config
                response = config_table.get_item(Key={"configType": "SYSTEM", "configId": "CORE"})
                config_data = response.get("Item", {}).get("data", {})
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps(config_data)
                }

        # --- PATH: /models ---
        elif "/models" in path:
            import boto3
            client = boto3.client("bedrock", region_name=os.environ.get("AWS_REGION", "us-east-1"))
            response = client.list_foundation_models(byOutputModality='TEXT')
            
            # Filter for Amazon Nova models
            nova_models = [
                {
                    "modelId": m["modelId"],
                    "modelName": m["modelName"]
                }
                for m in response.get("modelSummaries", [])
                if "nova" in m["modelId"]
            ]
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(nova_models)
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

def load_system_config():
    """
    Bootstraps the execution with system-wide configuration from DynamoDB.
    """
    try:
        import boto3
        from aigu.llm import set_model_id
        
        config_table_name = os.environ.get("CONFIG_TABLE_NAME", "AIGU_System_Config")
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(config_table_name)
        
        response = table.get_item(Key={"configType": "SYSTEM", "configId": "CORE"})
        if "Item" in response:
            config_data = response["Item"].get("data", {})
            model_id = config_data.get("novaModelId")
            if model_id:
                set_model_id(model_id)
    except Exception as e:
        print(f"Failed to load system config: {e}")

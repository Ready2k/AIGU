import json
import os
import traceback
import decimal
import boto3
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from boto3.dynamodb.conditions import Key, Attr
from aigu.graph import app
from aigu.utils import generate_audit_signature, get_current_user_identity, delete_s3_prefix, upload_reasoning_to_s3

def convert_floats_to_decimals(obj):
    if isinstance(obj, float):
        return decimal.Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: convert_floats_to_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_floats_to_decimals(i) for i in obj]
    return obj

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Unified AWS Lambda Handler for AIGU LangGraph Engine.
    Routes requests to Invoke (agents) or State (persistence).
    """
    print(f"Received event: {json.dumps(event)}")
    
    
    path = event.get("path", "")
    method = event.get("httpMethod", "POST")
    
    # Normalize Path (Handle AWS API Gateway Stage /v1/)
    if path.startswith("/v1/"):
        path = path.replace("/v1/", "/", 1)
        
    # 0. Load System Config (Bootstrap)
    load_system_config()
    
    try:
        # Normalize response headers for CORS
        headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        }

        # 1. OPTION Request (CORS Preflight)
        if method == "OPTIONS":
            return {"statusCode": 204, "headers": headers, "body": ""}

        # 2. Extract Submission ID (The Thread ID for LangGraph)
        submission_id = None
        user_id = None
        payload = {}

        if method in ["POST", "DELETE", "PUT"]:
            body_str = event.get("body", "{}")
            if body_str:
                try:
                    payload = json.loads(body_str) if isinstance(body_str, str) else body_str
                    submission_id = payload.get("submissionId")
                    user_id = payload.get("userId")
                except:
                    payload = {}
        
        # Fallback to query parameters if not found in body
        query_params = event.get("queryStringParameters", {}) or {}
        if not submission_id:
            submission_id = query_params.get("submissionId")
        if not user_id:
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
                "langfuse_user_id": user_id,
                "sessionId": submission_id  # Crucial for grouping in LangFuse UI
            }
            agent = payload.get("agent")
            inner_payload = payload.get("payload", {})

            # --- Explicit Initialization Block ---
            if agent == "intake":
                import boto3
                dynamodb = boto3.resource('dynamodb')
                state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
                
                # Standardize ID naming: submissionId is the source of truth
                submission_id_val = submission_id
                # Ensure userId is a string for DynamoDB sort key
                effective_userId = user_id if user_id and user_id != 'null' else "anonymous"
                
                print(f"Attempting to persist initial state for project: {submission_id_val}")
                initial_item = {
                    "submissionId": submission_id,
                    "userId": effective_userId,
                    "artifacts": {"intakeData": inner_payload},
                    "projectMetadata": {"currentStage": "Intake", "path": "Pending"},
                    "governance": {"status": "Draft"},
                    "auditLog": []
                }
                state_table.put_item(Item=convert_floats_to_decimals(initial_item))

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
                    
                    
                    # [NEW] Persist in Audit Log so it appears in the WorkflowProgress timeline
                    
                    audit_entry = {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "agent": "Admin",
                        "action": "Information Requested",
                        "reason": msg,
                        "userIdentity": get_current_user_identity()
                    }
                    audit_entry["signature"] = generate_audit_signature(audit_entry)
                    
                    new_audit_log = current_state.get("auditLog", []).copy()
                    new_audit_log.append(audit_entry)
                    graph_input["auditLog"] = new_audit_log
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
            elif agent == "poc":
                graph_input["artifacts"] = {
                    "pocData": inner_payload.get("pocData", {})
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
            try:
                # Convert any floats to Decimals for DynamoDB
                serializable_result = convert_floats_to_decimals(result)
                state_table.put_item(Item=serializable_result)
            except Exception as db_err:
                print(f"Error persisting state to DynamoDB: {db_err}")
                traceback.print_exc()
                # Continue if possible, or raise if critical
            
            if hasattr(langfuse_handler, "client"):
                langfuse_handler.client.flush()
            
            # Flush global client for manual generations in LLM utils
            try:
                from aigu.llm import get_langfuse_client as get_global_lc
                global_lc = get_global_lc()
                if global_lc:
                    global_lc.flush()
            except Exception as e:
                print(f"Warning: Failed to flush global Langfuse client: {e}")
            
            # Enrich with fresh pre-signed URLs
            enriched_result = enrich_state_with_presigned_urls(result)
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(enriched_result, default=str)
            }

        # --- PATH: /upload (S3 Pre-Signed POST) ---
        elif "/upload" in path and method == "POST":
            import boto3
            from datetime import timedelta
            
            s3_client = boto3.client('s3')
            bucket_name = os.environ.get('ARTIFACT_BUCKET', 'aigu-artifacts')
            
            file_name = payload.get('fileName')
            file_type = payload.get('fileType', 'application/octet-stream')
            submission_id_for_file = payload.get('submissionId', submission_id)
            
            if not file_name or not submission_id_for_file:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "fileName and submissionId required"})
                }
            
            # Generate unique S3 key
            # Standardized path: uploads/{userId}/{submissionId}/{filename}
            upload_user_id = user_id if user_id and user_id != 'null' else "anonymous"
            s3_key = f"uploads/{upload_user_id}/{submission_id_for_file}/{file_name}"
            
            try:
                # Generate pre-signed POST URL
                presigned_post = s3_client.generate_presigned_post(
                    Bucket=bucket_name,
                    Key=s3_key,
                    Fields={"Content-Type": file_type},
                    Conditions=[
                        {"Content-Type": file_type},
                        ["content-length-range", 0, 10485760]  # 10MB max
                    ],
                    ExpiresIn=3600
                )
                
                print(f"Generated pre-signed POST for: {s3_key}")
                print(f"DEBUG UPLOAD: userId={user_id}, submissionId={submission_id_for_file}, key={s3_key}")
                
                # [CRITICAL 'Sight' FIX]: Connect S3 Uploads to Global State
                # Immediately register the file in the artifacts list so the Librarian can see it.
                try:
                    dynamodb = boto3.resource('dynamodb')
                    state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
                    
                    # Ensure effective userId logic matches other handlers
                    upload_user_id = user_id if user_id and user_id != 'null' else "anonymous"
                    
                    # 3. Register in Global State
                    # [ROBUST UPDATE] Fetch first to avoid list_append vs map conflict
                    try:
                        resp = state_table.get_item(Key={"submissionId": submission_id_for_file, "userId": upload_user_id})
                        item = resp.get("Item", {})
                        artifacts = item.get("artifacts", {})
                        files = artifacts.get("files")
                        
                        # Unify to List
                        if isinstance(files, dict):
                            # Convert Map to List (just key URIs)
                            new_files_list = list(files.keys())
                        elif isinstance(files, list):
                            new_files_list = files
                        else:
                            new_files_list = []
                            
                        s3_uri = f"s3://{bucket_name}/{s3_key}"
                        if s3_uri not in new_files_list:
                            new_files_list.append(s3_uri)
                            
                        print(f"Updating files list for {submission_id_for_file}: {new_files_list}")
                        state_table.update_item(
                            Key={"submissionId": submission_id_for_file, "userId": upload_user_id},
                            UpdateExpression="SET artifacts.files = :f",
                            ExpressionAttributeValues={":f": new_files_list}
                        )
                    except Exception as db_err:
                        print(f"Error updating global state: {db_err}")
                except Exception as state_err:
                    print(f"Warning: Failed to update state for upload {file_name}: {state_err}")
                    # Non-blocking, continue to return URL

                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({
                        "url": presigned_post['url'],
                        "fields": presigned_post['fields'],
                        "key": s3_key
                    })
                }
            except Exception as e:
                print(f"Error generating pre-signed POST: {str(e)}")
                return {
                    "statusCode": 500,
                    "headers": headers,
                    "body": json.dumps({"error": f"Failed to generate upload URL: {str(e)}"})
                }

        # --- PATH: /upload (Delete File) ---
        elif "/upload" in path and method == "DELETE":
            import boto3
            s3_client = boto3.client('s3')
            bucket_name = os.environ.get('ARTIFACT_BUCKET', 'aigu-artifacts')
            dynamodb = boto3.resource('dynamodb')
            state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))

            file_name = payload.get('fileName')
            submission_id_for_file = payload.get('submissionId', submission_id)

            if not file_name or not submission_id_for_file:
                 return {
                     "statusCode": 400,
                     "headers": headers,
                     "body": json.dumps({"error": "fileName and submissionId required"})
                 }

            upload_user_id = user_id if user_id and user_id != 'null' else "anonymous"
            s3_key = f"uploads/{upload_user_id}/{submission_id_for_file}/{file_name}"

            try:
                # Delete from S3
                s3_client.delete_object(Bucket=bucket_name, Key=s3_key)
                print(f"Deleted S3 object: {s3_key}")
                
                # Update DynamoDB
                current_files = []
                try:
                    state_resp = state_table.get_item(Key={"submissionId": submission_id_for_file, "userId": upload_user_id})
                    if 'Item' in state_resp:
                        current_files = state_resp['Item'].get('artifacts', {}).get('files', [])
                        
                        # Flexible matching: matches exact filename OR URI ending in /filename
                        new_files = [f for f in current_files if f != file_name and not f.endswith("/" + file_name)]
                        
                        if len(new_files) < len(current_files):
                            print(f"Removing {file_name} from DynamoDB artifacts list")
                            state_table.update_item(
                                Key={"submissionId": submission_id_for_file, "userId": upload_user_id},
                                UpdateExpression="SET artifacts.files = :files",
                                ExpressionAttributeValues={":files": new_files}
                            )
                            current_files = new_files
                except Exception as db_err:
                     print(f"Warning: Failed to update DynamoDB on delete: {db_err}")

                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"message": "File deleted", "artifacts": {"files": current_files}})
                }
            except Exception as e:
                print(f"Error deleting file: {e}")
                return {
                    "statusCode": 500,
                    "headers": headers,
                    "body": json.dumps({"error": str(e)})
                }

        # --- PATH: /submit-revision (Remediation Trigger) ---
        elif "/submit-revision" in path and method == "POST":
            import boto3
            dynamodb = boto3.resource('dynamodb')
            state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
            
            print(f"Handling Revision for Submission: {submission_id}")

            # 1. Update status to 'Under Review' directly in DynamoDB
            try:
                effective_userId = user_id if user_id and user_id != 'null' else "anonymous"
                
                # Try direct update first
                try:
                    state_table.update_item(
                        Key={"submissionId": submission_id, "userId": effective_userId},
                        UpdateExpression="SET governance.#s = :status",
                        ExpressionAttributeNames={"#s": "status"},
                        ExpressionAttributeValues={":status": "Under Review"}
                    )
                except state_table.meta.client.exceptions.ConditionalCheckFailedException:
                    # Fallback: Query for the authoritative userId for this submissionId
                    from boto3.dynamodb.conditions import Key
                    q_resp = state_table.query(KeyConditionExpression=Key('submissionId').eq(submission_id))
                    if q_resp.get('Items'):
                        found_userId = q_resp['Items'][0].get('userId')
                        print(f"Authoritative userId for {submission_id} is {found_userId}. Updating that item.")
                        state_table.update_item(
                            Key={"submissionId": submission_id, "userId": found_userId},
                            UpdateExpression="SET governance.#s = :status",
                            ExpressionAttributeNames={"#s": "status"},
                            ExpressionAttributeValues={":status": "Under Review"}
                        )
                        # Update our local user_id for graph config below
                        user_id = found_userId
            except Exception as e:
                print(f"Status update failed: {e}")
                return {
                    "statusCode": 500,
                    "headers": headers,
                    "body": json.dumps({"error": f"Failed to update status: {e}"})
                }
            
            # 2. Invoke Graph (Targeting Librarian by resuming from Support)
            try:
                # Ensure we use the correct userId for graph config
                # Re-fetch from DB if we haven't confirmed it yet
                final_userId = user_id if user_id and user_id != 'null' else "anonymous"
                config = {"configurable": {"thread_id": submission_id}}
                
                # Sync artifacts from DynamoDB to checkpoint so Librarian sees latest files
                full_item = state_table.get_item(Key={"submissionId": submission_id, "userId": final_userId}).get("Item", {})
                artifacts_from_db = full_item.get("artifacts", {})
                
                app.update_state(config, {
                    "governance": {"status": "Under Review"}, 
                    "userId": final_userId, 
                    "artifacts": artifacts_from_db
                }, as_node="support")
                
                # Pass trace callbacks 
                from langfuse.langchain import CallbackHandler
                langfuse_handler = CallbackHandler()
                metadata = {
                    "langfuse_session_id": submission_id,
                    "langfuse_user_id": final_userId,
                    "sessionId": submission_id
                }

                # Invoke to proceed from 'support'
                result = app.invoke(None, config={**config, "callbacks": [langfuse_handler], "metadata": metadata})
                
                # Sync results back to Global State table
                if "submissionId" not in result: result["submissionId"] = submission_id
                if "userId" not in result: result["userId"] = final_userId
                
                print(f"Updating Global State after revision: {submission_id} (Status: {result.get('governance', {}).get('status')})")
                state_table.put_item(Item=result)

                if hasattr(langfuse_handler, "client"):
                    langfuse_handler.client.flush()
                
                # Enrich with pre-signed URLs for UI consistency
                enriched_result = enrich_state_with_presigned_urls(result)
                
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"message": "Revision submitted", "result": enriched_result}, default=str)
                }
            except Exception as graph_err:
                 print(f"Graph invocation failed: {graph_err}")
                 import traceback
                 traceback.print_exc()
                 return {
                     "statusCode": 500, 
                     "headers": headers, 
                     "body": json.dumps({"error": f"Failed to invoke graph: {graph_err}"})
                 }

        # --- PATH: /files (List Submission Files) ---
        elif "/files" in path and method == "GET":
            import boto3
            
            s3_client = boto3.client('s3')
            bucket_name = os.environ.get('ARTIFACT_BUCKET', 'aigu-artifacts')
            
            if not submission_id:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "submissionId required"})
                }
            
            try:
                # 1. Standardize userId and prefix
                list_user_id = user_id if user_id and user_id != 'null' else "anonymous"
                prefix = f"uploads/{list_user_id}/{submission_id}/"
                print(f"DEBUG LIST FILES: userId={user_id} -> {list_user_id}, submissionId={submission_id}, prefix={prefix}")
                
                response = s3_client.list_objects_v2(
                    Bucket=bucket_name,
                    Prefix=prefix
                )
                
                # 2. Fallback: If no files found, check if the project belongs to a different (case-different) user in DynamoDB
                if not response.get('Contents'):
                    try:
                        import boto3
                        dynamodb = boto3.resource('dynamodb')
                        state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
                        from boto3.dynamodb.conditions import Key
                        q_resp = state_table.query(KeyConditionExpression=Key('submissionId').eq(submission_id))
                        if q_resp.get('Items'):
                            actual_user_id = q_resp['Items'][0].get('userId')
                            if actual_user_id and actual_user_id != list_user_id:
                                print(f"Redirecting list_objects to authoritative userId: {actual_user_id}")
                                prefix = f"uploads/{actual_user_id}/{submission_id}/"
                                response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
                    except Exception as fallback_err:
                        print(f"Warning: File list fallback failed: {fallback_err}")

                files = []
                for obj in response.get('Contents', []):
                    # Generate pre-signed URL for viewing
                    presigned_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': bucket_name, 'Key': obj['Key']},
                        ExpiresIn=3600
                    )
                    
                    file_name = obj['Key'].split('/')[-1]
                    file_type = "application/octet-stream"
                    if file_name.lower().endswith('.pdf'): file_type = "application/pdf"
                    elif file_name.lower().endswith(('.png', '.jpg', '.jpeg')): file_type = "image/auto"
                    
                    files.append({
                        "key": obj['Key'],
                        "name": file_name,
                        "type": file_type,
                        "size": obj['Size'],
                        "uploadedAt": obj['LastModified'].isoformat(),
                        "presignedUrl": presigned_url
                    })
                
                print(f"Listed {len(files)} files for submission: {submission_id}")
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps(files, default=str)
                }
            except Exception as e:
                print(f"Error listing files: {str(e)}")
                return {
                    "statusCode": 500,
                    "headers": headers,
                    "body": json.dumps({"error": f"Failed to list files: {str(e)}"})
                }

        # --- PATH: /support/ask (LLM Support Chat) ---
        elif "/support/ask" in path and method == "POST":
            from aigu.llm import invoke_nova, get_active_prompt
            
            user_message = payload.get('message')
            context = payload.get('context', {})
            
            if not user_message:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "message required"})
                }
            
            # 1. Prepare Context Variables for LangFuse substitution
            stage = context.get('stage', 'Unknown')
            status = context.get('status', 'Unknown')
            blockers = context.get('blockers', [])
            blockers_text = ', '.join(blockers) if blockers else 'None'

            project_metadata = context.get('projectMetadata', {})
            
            # [CONTEXT INJECTION] Overlay active draft data if provided
            context_override = payload.get('context', {}).get('contextOverride')
            if context_override:
                merged_metadata = {**project_metadata, **context_override}
                project_metadata = merged_metadata
                if 'description' in context_override:
                    project_metadata['description'] = context_override['description']

            risk_level = project_metadata.get('riskLevel', 'Unknown')
            risk_reason = "No specific reasoning recorded."
            
            audit_log = context.get('auditLog', [])
            for entry in audit_log:
                if entry.get('agent') == 'Risk & Triage':
                    risk_reason = entry.get('reason', risk_reason)
                    break
            
            residual_risks_text = ""
            if status == 'Live' or stage == 'Handover':
                tasks = context.get('tasks', [])
                lct_task = next((t for t in tasks if t.get('team') == 'LCT'), None)
                if lct_task:
                    residual_risks_text = f"Lean Control Tool Task: {lct_task.get('task')} (Status: {lct_task.get('status')})"

            # 2. Fetch Prompt and Invoke
            try:
                is_admin = payload.get('isAdmin', False)
                prompt_name = "admin-support-agent" if is_admin else "support-agent"
                print(f"Support Request: isAdmin={is_admin} -> Using prompt '{prompt_name}'")
                
                prompt_tmpl = get_active_prompt(prompt_name, tag="production")
                
                prompt_state = {
                    'projectName': project_metadata.get('projectName') or project_metadata.get('name') or 'Draft Project',
                    'description': project_metadata.get('description', 'No description yet'),
                    'status': status,
                    'stage': stage,
                    'riskLevel': risk_level,
                    'riskReasoning': risk_reason,
                    'residualRisks': residual_risks_text,
                    'blockers': blockers_text,
                    'missingArtifacts': ', '.join(project_metadata.get('missingArtifacts', [])),
                    'technicalApproach': project_metadata.get('technicalApproach') or 'Not yet specified',
                    'path': project_metadata.get('path', 'Standard'),
                    'slaDeadline': context.get('slaDeadline') or 'TBD'
                }
                
                ai_message = invoke_nova(
                    prompt_object=prompt_tmpl,
                    messages=[{"role": "user", "content": user_message}],
                    state=prompt_state
                )
                
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"message": ai_message})
                }
            except Exception as e:
                print(f"Error in Managed Support Chat: {str(e)}")
                # Critical Fallback if LangFuse fails
                return {
                    "statusCode": 500,
                    "headers": headers,
                    "body": json.dumps({
                        "message": "I apologize, but I'm currently having trouble connecting to my knowledge base. Please try again or check back later."
                    })
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
            
            # Filter for active governance items
            review_queue = [
                item for item in items 
                if item.get('governance', {}).get('status') in ['Draft', 'Pending', 'In-Review', 'Under Review', 'Blocked', 'Approved', 'Live', 'Risk']
            ]
            
            print(f"Admin Queue: Filtered to {len(review_queue)} reviewable items")
            
            # Enrich items with reasoning URLs for admin preview
            enriched_queue = [enrich_state_with_presigned_urls(item) for item in review_queue]
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(enriched_queue, default=str)
            }

        # --- PATH: /admin/prompts ---
        elif "/admin/prompts" in path:
            from aigu.llm import get_langfuse_client
            
            if method == "GET":
                # Fetch all prompts with 'production' tag from LangFuse
                try:
                    langfuse = get_langfuse_client()
                    if not langfuse:
                        return {
                            "statusCode": 500,
                            "headers": headers,
                            "body": json.dumps({"error": "LangFuse client not configured"})
                        }
                    
                    # Fetch prompts - LangFuse SDK returns prompt objects
                    # We need to get the list and extract relevant fields
                    # Fetch all prompt metadata dynamically from LangFuse
                    try:
                        # LangFuse SDK v3 provides an api wrapper for paged results
                        prompts_meta_resp = langfuse.api.prompts.list()
                        prompt_metas = prompts_meta_resp.data if hasattr(prompts_meta_resp, 'data') else []
                        
                        prompts_list = []
                        print(f"Admin Prompts: Dynamic sync started. Found {len(prompt_metas)} metadata entries.")
                        
                        for meta in prompt_metas:
                            prompt_name = meta.name
                            try:
                                # Fetch the actual prompt content for each name
                                # We prioritize 'production' tag if available
                                prompt = langfuse.get_prompt(prompt_name, label='production')
                                if prompt:
                                    prompts_list.append({
                                        'name': prompt_name,
                                        'content': prompt.prompt,
                                        'type': prompt.type if hasattr(prompt, 'type') else 'text',
                                        'version': prompt.version if hasattr(prompt, 'version') else 1,
                                        'tags': prompt.labels if hasattr(prompt, 'labels') else ['production']
                                    })
                            except Exception as e:
                                print(f"  - Sync Warning: Could not fetch 'production' version for {prompt_name}: {e}")
                                # Try fetching without tag as fallback?
                                try:
                                    prompt = langfuse.get_prompt(prompt_name)
                                    if prompt:
                                        prompts_list.append({
                                            'name': prompt_name,
                                            'content': prompt.prompt,
                                            'type': prompt.type if hasattr(prompt, 'type') else 'text',
                                            'version': prompt.version if hasattr(prompt, 'version') else 1,
                                            'tags': prompt.labels if hasattr(prompt, 'labels') else ['latest']
                                        })
                                except:
                                    pass
                                continue
                        
                        print(f"Admin Prompts: Sync complete. {len(prompts_list)} prompts ready.")
                        return {
                            "statusCode": 200,
                            "headers": headers,
                            "body": json.dumps(prompts_list)
                        }
                    except Exception as meta_err:
                        print(f"Error listing prompt metadata: {meta_err}")
                        # Fallback to hard-coded list if dynamic listing fails
                        prompt_names = ['intake-orchestrator', 'risk-triage', 'gatekeeper', 'support-agent', 'admin-support-agent', 'librarian_agent']
                        prompts_list = []
                        
                        for prompt_name in prompt_names:
                            try:
                                prompt = langfuse.get_prompt(prompt_name, label='production')
                                if prompt:
                                    prompts_list.append({
                                        'name': prompt_name,
                                        'content': prompt.prompt,
                                        'type': prompt.type if hasattr(prompt, 'type') else 'text',
                                        'version': prompt.version if hasattr(prompt, 'version') else 1,
                                        'tags': prompt.labels if hasattr(prompt, 'labels') else ['production']
                                    })
                            except:
                                continue
                        return {
                            "statusCode": 200,
                            "headers": headers,
                            "body": json.dumps(prompts_list)
                        }
                except Exception as e:
                    print(f"Error fetching prompts: {e}")
                    return {
                        "statusCode": 500,
                        "headers": headers,
                        "body": json.dumps({"error": str(e)})
                    }
            
            elif method == "POST":
                # Create or update a prompt in LangFuse
                try:
                    langfuse = get_langfuse_client()
                    if not langfuse:
                        return {
                            "statusCode": 500,
                            "headers": headers,
                            "body": json.dumps({"error": "LangFuse client not configured"})
                        }
                    
                    prompt_data = payload
                    name = prompt_data.get('name')
                    content = prompt_data.get('content')
                    tags = prompt_data.get('tags', ['production'])
                    
                    if not name or not content:
                        return {
                            "statusCode": 400,
                            "headers": headers,
                            "body": json.dumps({"error": "name and content required"})
                        }
                    
                    # Create prompt in LangFuse
                    langfuse.create_prompt(
                        name=name,
                        prompt=content,
                        labels=tags
                    )
                    
                    return {
                        "statusCode": 200,
                        "headers": headers,
                        "body": json.dumps({"status": "success", "name": name})
                    }
                except Exception as e:
                    print(f"Error updating prompt: {e}")
                    return {
                        "statusCode": 500,
                        "headers": headers,
                        "body": json.dumps({"error": str(e)})
                    }

        # --- PATH: /sessions ---
        elif "/sessions" in path:
            import boto3
            dynamodb = boto3.resource('dynamodb')
            state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
            
            user_id = query_params.get("userId")
            if not user_id:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "userId required"})}
            
            # Use Scan with FilterExpression for user specific sessions
            # In production, a GSI on userId would be more efficient
            response = state_table.scan(FilterExpression=Attr('userId').eq(user_id))
            items = response.get('Items', [])
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(items, default=str)
            }

        # --- PATH: /cancel ---
        elif "/cancel" in path and method == "POST":
            import boto3
            dynamodb = boto3.resource('dynamodb')
            state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
            
            if not submission_id or not user_id:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "submissionId and userId required"})
                }
            
            try:
                print(f"Cancelling project: {submission_id} for user: {user_id}")
                
                # Fetch current state
                response = state_table.get_item(Key={"submissionId": submission_id, "userId": user_id})
                if 'Item' not in response:
                    return {
                        "statusCode": 404,
                        "headers": headers,
                        "body": json.dumps({"error": "Project not found"})
                    }
                
                item = response['Item']
                
                # Update status
                if "governance" not in item: item["governance"] = {}
                item["governance"]["status"] = "Cancelled"
                
                # Audit Log Entry
                timestamp = datetime.now(timezone.utc).isoformat()
                audit_entry = {
                    "timestamp": timestamp,
                    "agent": "User Action",
                    "action": "PROJECT_CANCELLED",
                    "reason": payload.get("reason", "Cancelled by user"),
                    "userIdentity": get_current_user_identity()
                }
                audit_entry["signature"] = generate_audit_signature(audit_entry)
                
                current_log = item.get("auditLog", [])
                if not isinstance(current_log, list): current_log = []
                current_log.append(audit_entry)
                item["auditLog"] = current_log
                
                # Persist
                state_table.put_item(Item=item)
                
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps(item, default=str)
                }
            except Exception as e:
                print(f"Error cancelling project: {e}")
                return {
                    "statusCode": 500,
                    "headers": headers,
                    "body": json.dumps({"error": str(e)})
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
            # Handle DELETE method for admin project deletion
            if method == "DELETE":
                import boto3
                dynamodb = boto3.resource('dynamodb')
                state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
                
                if not submission_id or not user_id:
                    return {
                        "statusCode": 400,
                        "headers": headers,
                        "body": json.dumps({"error": "submissionId and userId required for deletion"})
                    }
                
                try:
                    print(f"Deleting project: {submission_id} for user: {user_id}")
                    state_table.delete_item(
                        Key={
                            "submissionId": submission_id,
                            "userId": user_id
                        }
                    )
                    
                    # [CLEANUP] Delete associated S3 assets (uploads and reasoning)
                    bucket_name = os.environ.get('ARTIFACT_BUCKET', 'aigu-artifacts')
                    
                    # 1. Delete Uploads
                    upload_prefix = f"uploads/{user_id}/{submission_id}/"
                    delete_s3_prefix(bucket_name, upload_prefix)
                    
                    # 2. Delete Reasoning
                    reasoning_prefix = f"reasoning/{submission_id}/"
                    delete_s3_prefix(bucket_name, reasoning_prefix)
                    
                    print(f"Successfully deleted project and cleared S3 assets: {submission_id}")
                    return {
                        "statusCode": 200,
                        "headers": headers,
                        "body": json.dumps({"success": True, "message": "Project and S3 assets deleted"})
                    }
                except Exception as e:
                    print(f"Error deleting project: {str(e)}")
                    return {
                        "statusCode": 500,
                        "headers": headers,
                        "body": json.dumps({"error": f"Failed to delete project: {str(e)}"})
                    }
            
            # Handle GET method for fetching state
            import boto3
            dynamodb = boto3.resource('dynamodb')
            state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
            
            # 1. Authoritative fetch from Global State table (contains uploads & manual overrides)
            detailed_state = {}
            try:
                # Try fetching with provide userId first
                effective_userId = user_id if user_id and user_id != 'null' else "anonymous"
                print(f"Fetching Global State for {submission_id} (user: {effective_userId})")
                
                response = state_table.get_item(Key={"submissionId": submission_id, "userId": effective_userId})
                if 'Item' in response:
                    detailed_state = response['Item']
                else:
                    # Fallback: Query by submissionId only if userId mismatch (e.g. casing)
                    print(f"No exact match for {submission_id}/{effective_userId}. Trying query by submissionId...")
                    q_resp = state_table.query(KeyConditionExpression=Key('submissionId').eq(submission_id))
                    if q_resp.get('Items'):
                        detailed_state = q_resp['Items'][0]
                        print(f"Found item under different userId: {detailed_state.get('userId')}")
            except Exception as db_err:
                print(f"Warning: Failed to fetch detailed state from DB: {db_err}")

            # 2. Sync with LangGraph Checkpoint (if needed, though detailed_state is preferred)
            state_data = app.get_state(config)
            
            # 3. Merge or fallback
            result_state = detailed_state
            if not result_state and state_data and state_data.values:
                result_state = dict(state_data.values)
            
            if not result_state:
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

            # 4. Enrich with fresh pre-signed URLs
            enriched_state = enrich_state_with_presigned_urls(result_state)

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(enriched_state, default=str)
            }

        # --- PATH: /governance/override ---
        elif "/governance/override" in path and method == "POST":
            import boto3
            dynamodb = boto3.resource('dynamodb')
            state_table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State"))
            
            # SubId, NewStatus, NewRisk, Justification
            body_str = event.get("body", "{}")
            payload = json.loads(body_str) if isinstance(body_str, str) else body_str
            target_id = payload.get("submissionId")
            new_status = payload.get("newStatus")
            new_risk = payload.get("newRiskLevel")
            justification = payload.get("justification", "Manual Override")
            target_user_id = payload.get("userId") 
            
            if not target_id:
                return {
                    "statusCode": 400, "headers": headers, "body": json.dumps({"error": "submissionId required"})
                }

            # --- AUDIT LOGGING ---
            timestamp = datetime.now(timezone.utc).isoformat()
            audit_entry = {
                "timestamp": timestamp,
                "agent": "Human Operator",
                "action": "MANUAL_OVERRIDE",
                "reason": justification,
                "userIdentity": get_current_user_identity() # Mocked identity
            }
            # Generate signature
            audit_entry["signature"] = generate_audit_signature(audit_entry)
            
            # 1. Get Item
            if not target_user_id:
                 # Fallback query
                 q_resp = state_table.query(KeyConditionExpression=Key('submissionId').eq(target_id))
                 if q_resp.get('Items'):
                     target_user_id = q_resp['Items'][0].get('userId')
            
            if not target_user_id:
                return {"statusCode": 404, "headers": headers, "body": json.dumps({"error": "Project not found"})}

            # 2. Update Item (Read-Modify-Write)
            try:
                print(f"Applying Manual Override to {target_id} (Status: {new_status})")
                item_resp = state_table.get_item(Key={"submissionId": target_id, "userId": target_user_id})
                item = item_resp.get("Item", {})
                
                if "governance" not in item: item["governance"] = {}
                if "projectMetadata" not in item: item["projectMetadata"] = {}
                # Ensure auditLog is a list
                current_log = item.get("auditLog", [])
                if not isinstance(current_log, list): current_log = []
                
                item["governance"]["status"] = new_status
                if new_risk: item["projectMetadata"]["riskLevel"] = new_risk

                # Add to log
                current_log.append(audit_entry)
                item["auditLog"] = current_log
                
                # Write Back
                state_table.put_item(Item=item)

                # [CRITICAL UPDATE] Trigger Graph Resumption
                try:
                    print(f"Triggering graph resumption for override on {target_id}")
                    
                    config = {"configurable": {"thread_id": target_id}}
                    
                    # Force update the state in LangGraph to match DynamoDB
                    # Use 'risk_triage' as the resumption point if status is overridden
                    app.update_state(config, {
                        "governance": {"status": new_status},
                        "projectMetadata": {"riskLevel": new_risk} if new_risk else {}
                    }, as_node="risk_triage") # Resuming from Risk Triage allows the router to see the new status
                    
                    # Invoke graph to process the new state
                    app.invoke(None, config)
                    
                except Exception as graph_err:
                    print(f"Warning: Failed to resume graph after override: {graph_err}")

                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"success": True, "status": new_status, "auditEntry": audit_entry})
                }
            except Exception as e:
                print(f"Error in manual override: {e}")
                return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": str(e)})}

        # --- PATH: /config ---
        elif "/config" in path:
            import boto3
            dynamodb = boto3.resource('dynamodb')
            config_table = dynamodb.Table(os.environ.get("CONFIG_TABLE_NAME", "AIGU_System_Config"))
            
            # Extract agent ID from path if present (e.g. /config/risk_triage)
            # Assumption: path structure is /config or /config/{agentId}
            path_parts = path.split('/')
            agent_id = path_parts[-1] if len(path_parts) > 2 and path_parts[-1] != 'config' else None
            
            if method == "POST":
                # Save config
                if agent_id:
                    # Agent Config Update
                    config_type = "AGENT_CONFIG"
                    config_id = agent_id
                    print(f"Updating Agent Config: {agent_id}")
                else:
                    # System Config Update (Legacy/Global)
                    config_type = "SYSTEM"
                    config_id = "CORE"
                    print("Updating System Core Config")

                config_item = {
                    "configType": config_type,
                    "configId": config_id,
                    "data": payload
                }
                config_table.put_item(Item=config_item)
                
                # Re-bootstrap system if valid
                if config_type == "SYSTEM":
                    load_system_config()
                    
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"status": "Configuration Updated", "id": config_id})
                }
            else:
                # GET config
                if agent_id:
                    # Fetch specific agent config
                    response = config_table.get_item(Key={"configType": "AGENT_CONFIG", "configId": agent_id})
                    print(f"Fetching config for agent: {agent_id}")
                else:
                    # Fetch core system config
                    response = config_table.get_item(Key={"configType": "SYSTEM", "configId": "CORE"})
                
                config_data = response.get("Item", {}).get("data", {})
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps(config_data, default=str)
                }

        # --- PATH: /admin/config ---
        elif "/admin/config" in path:
            dynamodb = boto3.resource('dynamodb')
            config_table = dynamodb.Table(os.environ.get("SYS_CONFIG_TABLE", "AIGU_SystemConfig"))
            
            path_parts = path.split('/')
            # Expected path: /admin/config/{agentId}
            agent_id = path_parts[-1] if len(path_parts) > 3 else None
            
            if not agent_id:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "agentId required"})}

            if method == "POST":
                from aigu.config import update_config
                payload = json.loads(event.get("body", "{}"))
                user = get_current_user_identity()
                
                success = update_config(agent_id, payload, user=user)
                
                if not success:
                    return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": "Failed to update config"})}
                
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"success": True, "agentId": agent_id, "lastUpdated": datetime.now(timezone.utc).isoformat()})
                }
            else:
                # GET
                response = config_table.get_item(Key={"agentId": agent_id})
                item = response.get("Item", {})
                
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps(item, default=str)
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
            "headers": headers if 'headers' in locals() else {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "message": str(e),
                "type": type(e).__name__,
                "stack": traceback.format_exc() if os.environ.get("DEBUG_ERRORS") == "true" else None
            })
        }

def enrich_state_with_presigned_urls(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates fresh pre-signed S3 URLs for all reasoning context URIs in the audit log.
    Stored in ui_overlay.reasoningUrls mapping.
    """
    try:
        import boto3
        s3 = boto3.client('s3')
        reasoning_urls = {}
        
        audit_log = state.get("auditLog", [])
        if isinstance(audit_log, list):
            for entry in audit_log:
                if not isinstance(entry, dict): continue
                s3_uri = entry.get("reasoningContext")
                if s3_uri and isinstance(s3_uri, str) and s3_uri.startswith("s3://"):
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
    except Exception as e:
        print(f"Warning: Failed to process audit log for pre-signing: {e}")

    try:
        state["ui_overlay"] = {
            **(state.get("ui_overlay", {}) or {}),
            "reasoningUrls": reasoning_urls if 'reasoning_urls' in locals() else {}
        }
    except:
        pass
    
    # 2. Enrich Project Files in artifacts.files
    try:
        artifacts = state.get("artifacts", {})
        files = artifacts.get("files", [])
        submission_id = state.get("submissionId")
        user_id = state.get("userId")
        bucket_name = os.environ.get('ARTIFACT_BUCKET', 'aigu-artifacts')
        
        # If it's a list, process each file
        if isinstance(files, list):
            enriched_files = []
            for f in files:
                file_uri = f
                # Reconstruct legacy URI if missing
                if isinstance(f, str) and not f.startswith("s3://") and submission_id and user_id:
                    file_uri = f"s3://{bucket_name}/uploads/{user_id}/{submission_id}/{f}"
                
                # Now process the URI (either original or reconstructed)
                target_path = file_uri.get("uri") if isinstance(file_uri, dict) else file_uri
                
                if isinstance(target_path, str) and target_path.startswith("s3://"):
                    try:
                        import boto3
                        s3 = boto3.client('s3')
                        parts = target_path.replace("s3://", "").split("/", 1)
                        if len(parts) == 2:
                            bucket, key = parts
                            filename = key.split("/")[-1]
                            url = s3.generate_presigned_url(
                                'get_object',
                                Params={'Bucket': bucket, 'Key': key},
                                ExpiresIn=3600
                            )
                            enriched_files.append({"name": filename, "presignedUrl": url, "uri": target_path})
                    except Exception as e:
                        print(f"Warning: Failed to sign artifact {target_path}: {e}")
                elif isinstance(f, dict): # Already enriched?
                    enriched_files.append(f)
            
            # Update the state with enriched files
            artifacts["files"] = enriched_files
    except Exception as e:
        print(f"Warning: Failed to enrich files with pre-signed URLs: {e}")
    
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

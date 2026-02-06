"""
Handover Agent (formerly Outcome Agent)

Purpose: Manages final handover to operations teams (IRIS/LCT/RTB).
This is the final stage after production approval.

Flow:
- Verify production approval
- Generate handover checklist
- Notify IRIS (engagement plans)
- Log residual risks to LCT
- Transition to RTB (Run the Bank)
- Mark project as Live
"""

from datetime import datetime, timezone, timedelta
from aigu.state import GlobalState
from aigu.utils import upload_reasoning_to_s3, generate_audit_signature, get_current_user_identity

def handover_agent(state: GlobalState) -> GlobalState:
    """
    Handover Agent manages final transition to operations.
    
    Logic:
    1. Verify production approval
    2. Generate handover tasks
    3. Create engagement plans (IRIS)
    4. Log residual risks (LCT)
    5. Notify operations (RTB)
    6. Mark as Live in Production
    
    Args:
        state: Current global state
        
    Returns:
        Updated state with handover complete
    """
    print("🎯 Handover Agent: Finalizing transition to operations...")
    
    # Extract project data
    project_metadata = state.get("projectMetadata", {})
    governance = state.get("governance", {})
    submission_id = state.get("submissionId", "unknown")
    
    # Verify approval
    status = governance.get("status")
    if status not in ["Approved", "Production-Ready"]:
        print(f"  ⚠️ Cannot handover - status is {status}, not Approved")
        return state
    
    print("  ✅ Production approval verified")
    
    # Update stage
    state["projectMetadata"]["currentStage"] = "Handover"
    state["projectMetadata"]["lifecyclePhase"] = "Live"
    state["governance"]["status"] = "Live"
    
    # Generate handover checklist
    handover_tasks = [
        {
            "team": "IRIS",
            "task": "Create engagement plan and training materials",
            "status": "Assigned",
            "dueDate": (datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + 
                       timedelta(days=7)).isoformat()
        },
        {
            "team": "LCT",
            "task": "Log residual risks in risk tracking system",
            "status": "Assigned",
            "dueDate": (datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + 
                       timedelta(days=3)).isoformat()
        },
        {
            "team": "RTB",
            "task": "Transition to Run the Bank operations team",
            "status": "Assigned",
            "dueDate": (datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + 
                       timedelta(days=14)).isoformat()
        }
    ]
    
    # Store handover data
    if "handoverData" not in state["artifacts"]:
        state["artifacts"]["handoverData"] = {}
    
    state["artifacts"]["handoverData"] = {
        "tasks": handover_tasks,
        "completionDate": datetime.now().isoformat(),
        "finalStatus": "Live in Production",
        "projectName": project_metadata.get("name", "Untitled Project"),
        "riskLevel": project_metadata.get("riskLevel", "Unknown")
    }
    
    # Update UI message
    if "ui_overlay" not in state:
        state["ui_overlay"] = {}
    
    state["ui_overlay"]["supportMessage"] = (
        "🎉 Congratulations! Your project has been approved and is now LIVE in production. "
        "Handover tasks have been assigned to:\n"
        "• IRIS: Engagement planning and training\n"
        "• LCT: Residual risk logging\n"
        "• RTB: Operations transition\n\n"
        "You will receive notifications as each team completes their tasks."
    )
    state["ui_overlay"]["showBlockerAlert"] = False
    
    # Chain of thought for audit trail
    cot_steps = [
        f"Handover initiated for: {project_metadata.get('name', 'Unknown')}",
        f"Previous stage: {project_metadata.get('currentStage', 'Unknown')}",
        f"Governance status: {status}",
        "Handover tasks assigned:",
        "  - IRIS: Engagement plan (7 days)",
        "  - LCT: Risk logging (3 days)",
        "  - RTB: Operations transition (14 days)",
        "Project marked as LIVE in production"
    ]
    
    reasoning_text = "\n".join(cot_steps)
    s3_uri = upload_reasoning_to_s3(submission_id, "Handover Agent", reasoning_text)
    
    # Create audit log entry
    timestamp = datetime.now(timezone.utc).isoformat()
    raw_entry = {
        "timestamp": timestamp,
        "agent": "Handover Agent",
        "action": "Production Handover Complete",
        "reason": "Project approved and transitioned to operations",
        "reasoningContext": s3_uri,
        "userIdentity": get_current_user_identity()
    }
    signature = generate_audit_signature(raw_entry)
    
    if "auditLog" not in state:
        state["auditLog"] = []
    state["auditLog"].append({**raw_entry, "signature": signature})
    
    # Add to chain of thought
    reasoning = {
        "agent": "handover",
        "timestamp": datetime.now().isoformat(),
        "decision": "Handover Complete",
        "tasks": handover_tasks,
        "finalStatus": "Live"
    }
    
    if "chainOfThought" not in state:
        state["chainOfThought"] = []
    state["chainOfThought"].append(reasoning)
    
    print("  ✓ Handover Agent complete: Project is now LIVE")
    return state

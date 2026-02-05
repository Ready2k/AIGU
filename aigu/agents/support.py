from typing import Dict, Any, List
from aigu.state import GlobalState, AuditLogEntry

def support_agent(state: GlobalState) -> Dict[str, Any]:
    """
    Support & Insights Agent Node.
    Provides transparent feedback on status, blockers, and SLAs.
    Ref: agents/support.md
    """
    # Read-Only Access
    project_metadata = state.get("projectMetadata", {})
    governance = state.get("governance", {})
    
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

    # 3. Output (Support agent doesn't change state, just returns a message usually)
    # In LangGraph/Nodes, we might return a 'messages' key or similar.
    # For this architecture, we'll append a transient 'supportMessage' to the return
    # which the UI would consume.
    
    return {
        "ui_overlay": {
            "supportMessage": message,
            "showBlockerAlert": len(blockers) > 0,
            "slaDisplay": deadline
        }
    }

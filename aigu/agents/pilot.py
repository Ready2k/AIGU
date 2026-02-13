"""
Pilot Agent

Purpose: Manages the pilot phase with SLA-based approval workflow.
Sets appropriate SLA deadlines based on risk level and tracks pilot progress.

Flow:
- Low Risk: 3-day SLA
- Medium Risk: 7-day SLA  
- High Risk: 10-day SLA
- Tracks admin approval status
- Monitors pilot completion
"""

from datetime import datetime, timedelta
from aigu.state import GlobalState

def pilot_agent(state: GlobalState) -> GlobalState:
    """
    Pilot Agent manages the pilot phase with SLA tracking.
    
    Logic:
    1. Determine risk level
    2. Set SLA deadline (3/7/10 days)
    3. Check admin approval status
    4. Set pilot phase status
    5. Track pilot progress
    
    Args:
        state: Current global state
        
    Returns:
        Updated state with pilot phase configuration
    """
    risk_level = state.get("projectMetadata", {}).get("riskLevel", "Med")
    print(f"🧪 Pilot Agent: Operating under {risk_level} Risk Guardrails.")
    
    # Extract project data
    project_metadata = state.get("projectMetadata", {})
    governance = state.get("governance", {})
    risk_level = project_metadata.get("riskLevel", "Med")
    
    # Set SLA based on risk level
    sla_mapping = {
        "Low": 3,
        "Med": 7,
        "High": 10
    }
    sla_days = sla_mapping.get(risk_level, 7)
    deadline = datetime.now() + timedelta(days=sla_days)
    
    print(f"  → Risk Level: {risk_level}")
    print(f"  → SLA: {sla_days} days (deadline: {deadline.strftime('%Y-%m-%d')})")
    
    # Update stage and SLA
    state["projectMetadata"]["currentStage"] = "Pilot"
    state["projectMetadata"]["lifecyclePhase"] = "Pilot"
    state["governance"]["slaDeadline"] = deadline.isoformat()
    state["governance"]["slaType"] = f"{sla_days}-Day Pilot Review"
    state["governance"]["slaDays"] = sla_days
    
    # Check admin approval status
    admin_approved = governance.get("adminApproved", False)
    admin_action = governance.get("adminAction")
    
    if admin_approved or admin_action == "ADMIN_APPROVE":
        print("  ✅ Admin approval received")
        state["governance"]["status"] = "Pilot-Active"
        state["governance"]["adminApproved"] = True
        state["governance"]["approvalDate"] = datetime.now().isoformat()
        
        # Initialize pilot tracking
        if "pilotData" not in state["artifacts"]:
            state["artifacts"]["pilotData"] = {}
        
        state["artifacts"]["pilotData"]["pilotStartDate"] = datetime.now().isoformat()
        state["artifacts"]["pilotData"]["expectedEndDate"] = (
            datetime.now() + timedelta(days=30)  # Default 30-day pilot
        ).isoformat()
        
        state["ui_overlay"]["supportMessage"] = (
            f"🎉 Your pilot has been approved by the GIGC! "
            f"SLA: {sla_days} days for review. "
            f"Expected completion: {deadline.strftime('%Y-%m-%d')}. "
            f"You can now begin your pilot implementation."
        )
        state["ui_overlay"]["showBlockerAlert"] = False
        
    elif admin_action == "ADMIN_REQUEST_INFO":
        print("  📨 Admin requested additional information")
        state["governance"]["status"] = "Blocked"
        admin_message = governance.get("adminMessage", "Please provide additional documentation")
        state["governance"]["blockers"] = [f"Admin Request: {admin_message}"]
        state["ui_overlay"]["supportMessage"] = (
            f"The GIGC has requested additional information: {admin_message}. "
            "Please provide the requested details to proceed with your pilot."
        )
        state["ui_overlay"]["showBlockerAlert"] = True
        
    else:
        print("  ⏳ Awaiting admin approval")
        state["governance"]["status"] = "Pending"
        state["governance"]["blockers"] = []
        
        # Calculate days remaining
        days_remaining = (deadline - datetime.now()).days
        urgency = "URGENT" if days_remaining <= 3 else "on track"
        
        state["ui_overlay"]["supportMessage"] = (
            f"Your project is in the GIGC admin queue for pilot approval. "
            f"SLA: {sla_days} days ({days_remaining} days remaining - {urgency}). "
            f"Expected decision by: {deadline.strftime('%Y-%m-%d')}."
        )
        state["ui_overlay"]["showBlockerAlert"] = False
    
    # Check if pilot is complete (for resubmission to production)
    pilot_data = state.get("artifacts", {}).get("pilotData", {})
    pilot_complete = pilot_data.get("pilotComplete", False)
    
    if pilot_complete:
        print("  ✓ Pilot phase complete, ready for production review")
        state["projectMetadata"]["currentStage"] = "Pilot-Complete"
        state["ui_overlay"]["supportMessage"] = (
            "Your pilot phase is complete! You can now submit for production deployment. "
            "Please provide pilot results, lessons learned, and production readiness documentation."
        )
    
    # Add reasoning for audit trail
    reasoning = {
        "agent": "pilot",
        "timestamp": datetime.now().isoformat(),
        "decision": state["governance"]["status"],
        "riskLevel": risk_level,
        "slaDays": sla_days,
        "deadline": deadline.isoformat(),
        "adminApproved": admin_approved,
        "pilotComplete": pilot_complete
    }
    
    if "chainOfThought" not in state:
        state["chainOfThought"] = []
    state["chainOfThought"].append(reasoning)
    
    # UI Overlay - Admin Analysis
    admin_analysis = (
        f"**Pilot Status:** {state['governance']['status']}\n"
        f"**Risk Level:** {risk_level}\n"
        f"**SLA:** {sla_days} Days (Deadline: {deadline.strftime('%Y-%m-%d')})\n"
        f"**Admin Approved:** {admin_approved}\n"
        f"**Pilot Complete:** {pilot_complete}"
    )
    if "ui_overlay" not in state: state["ui_overlay"] = {}
    state["ui_overlay"]["adminAnalysis"] = admin_analysis

    print(f"  ✓ Pilot Agent complete: Status = {state['governance']['status']}")
    return state

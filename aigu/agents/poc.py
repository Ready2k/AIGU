"""
POC (Proof of Concept) Agent

Purpose: Validates proof-of-concept requirements for new AI capabilities.
Determines if a project requires POC validation or can proceed directly to Pilot.

Flow:
- Hero Capabilities: Skip POC, go directly to Pilot
- New Capabilities: Require POC artifacts and CAF approval
"""

from datetime import datetime
from aigu.state import GlobalState

def poc_agent(state: GlobalState) -> GlobalState:
    """
    POC Agent validates proof-of-concept requirements.
    
    Logic:
    1. Check capability type (Hero vs New)
    2. For Hero: Skip POC, mark as Pilot-ready
    3. For New: Validate POC artifacts
    4. Check CAF approval status
    5. Set appropriate status and blockers
    
    Args:
        state: Current global state
        
    Returns:
        Updated state with POC validation results
    """
    risk_level = state.get("projectMetadata", {}).get("riskLevel", "Med")
    print(f"🔬 POC Agent: Operating under {risk_level} Risk Guardrails.")
    
    # Extract project metadata
    project_metadata = state.get("projectMetadata", {})
    capability_type = project_metadata.get("capabilityType", "New")
    artifacts = state.get("artifacts", {})
    governance = state.get("governance", {})
    
    # Hero capabilities skip POC
    if capability_type == "Hero":
        print("  → Hero Capability detected: Skipping POC phase")
        state["projectMetadata"]["currentStage"] = "Pilot"
        state["projectMetadata"]["pocRequired"] = False
        state["ui_overlay"]["supportMessage"] = (
            "Your Hero Capability project is proceeding directly to Pilot phase. "
            "POC validation is not required for established capabilities."
        )
        return state
    
    # New capabilities require POC
    print("  → New Capability detected: POC validation required")
    state["projectMetadata"]["currentStage"] = "POC"
    state["projectMetadata"]["pocRequired"] = True
    
    # Check for POC artifacts
    poc_data = artifacts.get("pocData", {})
    required_poc_docs = {
        "testPlan": "Test Plan",
        "successCriteria": "Success Criteria",
        "resourceEstimate": "Resource Estimate",
        "technicalApproach": "Technical Approach"
    }
    
    missing_docs = []
    for key, label in required_poc_docs.items():
        if key not in poc_data or not poc_data[key]:
            missing_docs.append(label)
    
    # Check CAF approval status
    caf_status = poc_data.get("cafApprovalStatus", "Pending")
    
    # Determine status based on artifacts and CAF approval
    if missing_docs:
        print(f"  ⚠️ Missing POC artifacts: {', '.join(missing_docs)}")
        state["governance"]["status"] = "Blocked"
        state["governance"]["blockers"] = [
            f"POC: Missing {doc}" for doc in missing_docs
        ]
        state["ui_overlay"]["supportMessage"] = (
            f"Your POC submission is incomplete. Please provide: {', '.join(missing_docs)}. "
            "These artifacts are required before CAF approval can be requested."
        )
        state["ui_overlay"]["showBlockerAlert"] = True
        
    elif caf_status == "Pending":
        print("  ⏳ POC artifacts complete, awaiting CAF approval")
        state["governance"]["status"] = "Pending"
        state["governance"]["blockers"] = []
        state["ui_overlay"]["supportMessage"] = (
            "Your POC artifacts are complete and have been submitted for CAF (Cloud Approval Forum) review. "
            "Expected approval timeline: 3-5 business days."
        )
        state["ui_overlay"]["showBlockerAlert"] = False
        
    elif caf_status == "Rejected":
        print("  ❌ CAF approval rejected")
        state["governance"]["status"] = "Blocked"
        state["governance"]["blockers"] = ["CAF approval rejected"]
        rejection_reason = poc_data.get("cafRejectionReason", "No reason provided")
        state["ui_overlay"]["supportMessage"] = (
            f"Your POC has been rejected by the CAF. Reason: {rejection_reason}. "
            "Please address the feedback and resubmit."
        )
        state["ui_overlay"]["showBlockerAlert"] = True
        
    else:  # Approved
        print("  ✅ POC artifacts complete and CAF approved")
        state["governance"]["status"] = "POC-Approved"
        state["governance"]["blockers"] = []
        state["ui_overlay"]["supportMessage"] = (
            "🎉 Your POC has been approved by the CAF! "
            "Your project is now advancing to the Pilot phase."
        )
        state["ui_overlay"]["showBlockerAlert"] = False
        
        # Record POC completion
        if "pocData" not in state["artifacts"]:
            state["artifacts"]["pocData"] = {}
        state["artifacts"]["pocData"]["completionDate"] = datetime.now().isoformat()
        state["artifacts"]["pocData"]["approvalDate"] = datetime.now().isoformat()
    
    # Add reasoning for audit trail
    reasoning = {
        "agent": "poc",
        "timestamp": datetime.now().isoformat(),
        "decision": state["governance"]["status"],
        "capabilityType": capability_type,
        "pocRequired": state["projectMetadata"]["pocRequired"],
        "cafStatus": caf_status,
        "missingArtifacts": missing_docs
    }
    
    if "chainOfThought" not in state:
        state["chainOfThought"] = []
    state["chainOfThought"].append(reasoning)
    
    print(f"  ✓ POC Agent complete: Status = {state['governance']['status']}")
    return state

"""
Production Agent

Purpose: Handles production deployment with delta review and production controls.
Implements the 15% delta rule for pilot-to-production transitions.

Flow:
- Check for previous version (pilot resubmission)
- Calculate delta percentage
- If delta > 15%: Route back to GIGC for full review
- If delta < 15%: Validate production artifacts
- Check KPIs, cost analysis, and incremental risk
- Set 7-day production approval SLA
"""

from datetime import datetime, timedelta
from aigu.state import GlobalState

def production_agent(state: GlobalState) -> GlobalState:
    """
    Production Agent handles production deployment with delta review.
    
    Logic:
    1. Check if this is a resubmission from pilot
    2. Calculate delta if previous version exists
    3. Apply 15% threshold rule
    4. Validate production control artifacts
    5. Set production approval SLA (7 days)
    
    Args:
        state: Current global state
        
    Returns:
        Updated state with production validation results
    """
    print("🚀 Production Agent: Validating production readiness...")
    
    # Extract project data
    project_metadata = state.get("projectMetadata", {})
    artifacts = state.get("artifacts", {})
    governance = state.get("governance", {})
    
    # Update stage
    state["projectMetadata"]["currentStage"] = "Production"
    state["projectMetadata"]["lifecyclePhase"] = "Production"
    
    # Check for delta review (pilot to production transition)
    previous_version_id = project_metadata.get("previousVersionId")
    
    if previous_version_id:
        print(f"  → Resubmission detected: Comparing with version {previous_version_id}")
        
        # Get delta percentage (should be calculated by delta_calculator)
        delta_pct = project_metadata.get("deltaPercentage", 0)
        
        print(f"  → Delta: {delta_pct}% (threshold: 15%)")
        
        if delta_pct > 15:
            print("  ⚠️ Delta exceeds 15% threshold - routing to GIGC for full review")
            state["governance"]["status"] = "Pending"
            state["governance"]["blockers"] = [
                f"Delta threshold exceeded: {delta_pct}% (limit: 15%)"
            ]
            state["ui_overlay"]["supportMessage"] = (
                f"Your changes from the pilot version ({delta_pct}%) exceed the 15% delta threshold. "
                "This requires a full GIGC review before production deployment. "
                "Your project has been added to the admin queue."
            )
            state["ui_overlay"]["showBlockerAlert"] = True
            
            # Add to reasoning
            reasoning = {
                "agent": "production",
                "timestamp": datetime.now().isoformat(),
                "decision": "Delta threshold exceeded - routing to GIGC",
                "deltaPercentage": delta_pct,
                "threshold": 15,
                "previousVersionId": previous_version_id
            }
            
            if "chainOfThought" not in state:
                state["chainOfThought"] = []
            state["chainOfThought"].append(reasoning)
            
            return state
        else:
            print(f"  ✓ Delta within threshold ({delta_pct}% < 15%)")
    
    # Validate production control artifacts
    production_data = artifacts.get("productionData", {})
    
    required_controls = {
        "kpiMetrics": "Benefits and KPI Measurements",
        "costAnalysis": "Cost Control Documentation",
        "incrementalRisk": "Incremental Risk Assessment",
        "outcomeReport": "Pilot Outcome Report"
    }
    
    missing_controls = []
    for key, label in required_controls.items():
        value = production_data.get(key)
        # For dicts (kpiMetrics, costAnalysis), just check if key exists
        # For strings (incrementalRisk, outcomeReport), check if non-empty
        if key not in production_data:
            missing_controls.append(label)
        elif isinstance(value, str) and not value:
            missing_controls.append(label)
    
    # Check production readiness
    if missing_controls:
        print(f"  ⚠️ Missing production controls: {', '.join(missing_controls)}")
        state["governance"]["status"] = "Blocked"
        state["governance"]["blockers"] = [
            f"Production: Missing {control}" for control in missing_controls
        ]
        state["ui_overlay"]["supportMessage"] = (
            f"Your production submission requires {len(missing_controls)} additional artifacts: "
            f"{', '.join(missing_controls)}. "
            "These controls are mandatory for production deployment."
        )
        state["ui_overlay"]["showBlockerAlert"] = True
        
    else:
        print("  ✅ All production controls validated")
        state["governance"]["status"] = "Production-Ready"
        state["governance"]["blockers"] = []
        
        # Set 7-day production approval SLA
        deadline = datetime.now() + timedelta(days=7)
        state["governance"]["slaDeadline"] = deadline.isoformat()
        state["governance"]["slaType"] = "7-Day Production Approval"
        state["governance"]["slaDays"] = 7
        
        state["ui_overlay"]["supportMessage"] = (
            "✅ Production artifacts complete! Your project is ready for final approval. "
            f"Expected decision by: {deadline.strftime('%Y-%m-%d')} (7-day SLA). "
            "The GIGC will review your KPIs, cost analysis, and risk assessment."
        )
        state["ui_overlay"]["showBlockerAlert"] = False
        
        # Record production submission
        if "productionData" not in state["artifacts"]:
            state["artifacts"]["productionData"] = {}
        state["artifacts"]["productionData"]["submissionDate"] = datetime.now().isoformat()
        state["artifacts"]["productionData"]["expectedApprovalDate"] = deadline.isoformat()
    
    # Add reasoning for audit trail
    reasoning = {
        "agent": "production",
        "timestamp": datetime.now().isoformat(),
        "decision": state["governance"]["status"],
        "deltaPercentage": project_metadata.get("deltaPercentage"),
        "previousVersionId": previous_version_id,
        "missingControls": missing_controls,
        "productionReadiness": len(missing_controls) == 0
    }
    
    if "chainOfThought" not in state:
        state["chainOfThought"] = []
    state["chainOfThought"].append(reasoning)
    
    print(f"  ✓ Production Agent complete: Status = {state['governance']['status']}")
    return state

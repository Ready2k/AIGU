import os
from typing import Literal
from langgraph.graph import StateGraph, START, END
from langgraph_checkpoint_dynamodb.saver import DynamoDBSaver
from aigu.state import GlobalState
from aigu.agents.intake import intake_orchestrator
from aigu.agents.risk_triage import risk_triage_agent
from aigu.agents.librarian import librarian_agent
from aigu.agents.gatekeeper import gatekeeper_agent
from aigu.agents.support import support_agent

# NEW AGENTS
from aigu.agents.poc import poc_agent
from aigu.agents.pilot import pilot_agent
from aigu.agents.production import production_agent
from aigu.agents.handover import handover_agent

def build_aigu_graph():
    """
    Constructs the AIGU Governance LangGraph with multi-stage lifecycle support.
    
    Flow:
    - Intake → Design/Standard/Stop
    - Design → POC (New) / Pilot (Hero)
    - POC → CAF Approval → Pilot
    - Pilot → Risk → Librarian → Gatekeeper
    - Gatekeeper → Production (if approved)
    - Production → Delta Check → Gatekeeper (if >15%) / Handover (if <15%)
    - Handover → END
    """
    workflow = StateGraph(GlobalState)
    
    # Add all nodes
    workflow.add_node("intake", intake_orchestrator)
    workflow.add_node("poc", poc_agent)
    workflow.add_node("pilot", pilot_agent)
    workflow.add_node("risk_triage", risk_triage_agent)
    workflow.add_node("librarian", librarian_agent)
    workflow.add_node("gatekeeper", gatekeeper_agent)
    workflow.add_node("production", production_agent)
    workflow.add_node("handover", handover_agent)
    workflow.add_node("support", support_agent)
    
    # Start with intake
    workflow.add_edge(START, "intake")
    
    # Route from intake based on path
    def route_intake(state: GlobalState) -> Literal["poc", "risk_triage", "support"]:
        """
        Route from intake based on project path.
        
        - Stop → Support (project rejected)
        - Standard → Risk Triage (low-risk auto-approve path)
        - Accelerator → POC (high-risk multi-stage path)
        """
        path = state.get("projectMetadata", {}).get("path", "Stop")
        
        if path == "Stop":
            print("  → Routing to Support (project stopped)")
            return "support"
        elif path == "Standard":
            print("  → Routing to Risk Triage (standard path)")
            return "risk_triage"
        else:  # Accelerator
            print("  → Routing to POC (accelerator path)")
            return "poc"
    
    workflow.add_conditional_edges("intake", route_intake)
    
    # Route from POC based on capability type and CAF approval
    def route_poc(state: GlobalState) -> Literal["pilot", "support"]:
        """
        Route from POC based on approval status.
        
        - Hero Capability → Pilot (skip POC)
        - CAF Approved → Pilot
        - CAF Rejected/Blocked → Support
        """
        capability_type = state.get("projectMetadata", {}).get("capabilityType", "New")
        
        # Hero capabilities skip POC
        if capability_type == "Hero":
            print("  → Hero capability: Routing to Pilot")
            return "pilot"
        
        # Check CAF approval for New capabilities
        caf_status = state.get("artifacts", {}).get("pocData", {}).get("cafApprovalStatus", "Pending")
        governance_status = state.get("governance", {}).get("status", "Draft")
        
        if caf_status == "Approved" or governance_status == "POC-Approved":
            print("  → POC approved: Routing to Pilot")
            return "pilot"
        else:
            print(f"  → POC not approved (status: {governance_status}): Routing to Support")
            return "support"
    
    workflow.add_conditional_edges("poc", route_poc)
    
    # Pilot always goes to risk triage for SLA assignment
    workflow.add_edge("pilot", "risk_triage")
    
    # Standard path: Risk → Handover (auto-approve)
    # Accelerator path: Risk → Librarian → Gatekeeper
    def route_risk(state: GlobalState) -> Literal["librarian", "handover"]:
        """
        Route from risk triage based on path.
        
        - Standard path → Handover (auto-approve)
        - Accelerator path → Librarian (requires review)
        """
        path = state.get("projectMetadata", {}).get("path", "Standard")
        
        if path == "Standard":
            print("  → Standard path: Auto-approve → Handover")
            return "handover"
        else:
            print("  → Accelerator path: Routing to Librarian")
            return "librarian"
    
    workflow.add_conditional_edges("risk_triage", route_risk)
    
    # Librarian → Gatekeeper
    workflow.add_edge("librarian", "gatekeeper")
    
    # Route from gatekeeper based on approval and stage
    def route_gatekeeper(state: GlobalState) -> Literal["production", "handover", "support"]:
        """
        Route from gatekeeper based on approval status and current stage.
        
        - Approved + Pilot stage → Production
        - Approved + Production stage → Handover
        - Rejected/Blocked → Support
        """
        status = state.get("governance", {}).get("status", "Draft")
        current_stage = state.get("projectMetadata", {}).get("currentStage", "Pilot")
        admin_action = state.get("governance", {}).get("adminAction")
        
        # Check for admin approval
        if status == "Approved" or admin_action == "ADMIN_APPROVE":
            if current_stage == "Pilot" or current_stage == "Pilot-Complete":
                print("  → Pilot approved: Routing to Production")
                return "production"
            else:
                print("  → Production approved: Routing to Handover")
                return "handover"
        else:
            print(f"  → Not approved (status: {status}): Routing to Support")
            return "support"
    
    workflow.add_conditional_edges("gatekeeper", route_gatekeeper)
    
    # Route from production based on delta threshold
    def route_production(state: GlobalState) -> Literal["gatekeeper", "handover", "support"]:
        """
        Route from production based on delta threshold and status.
        
        - Delta > 15% → Gatekeeper (full review required)
        - Delta < 15% + Production-Ready → Handover
        - Blocked → Support
        """
        delta_pct = state.get("projectMetadata", {}).get("deltaPercentage", 0)
        status = state.get("governance", {}).get("status", "Draft")
        
        # Check delta threshold
        if delta_pct > 15:
            print(f"  → Delta {delta_pct}% exceeds 15%: Routing to Gatekeeper for review")
            return "gatekeeper"
        
        # Check production readiness
        if status == "Production-Ready" or status == "Approved":
            print("  → Production ready: Routing to Handover")
            return "handover"
        else:
            print(f"  → Production blocked (status: {status}): Routing to Support")
            return "support"
    
    workflow.add_conditional_edges("production", route_production)
    
    # Terminal nodes
    workflow.add_edge("handover", END)
    workflow.add_edge("support", END)
    
    # Persistence Setup
    checkpoints_table = os.environ.get("CHECKPOINTS_TABLE_NAME")
    writes_table = os.environ.get("WRITES_TABLE_NAME")
    project_id = os.environ.get("DYNAMODB_TABLE_NAME", "AIGU_Global_State")

    if checkpoints_table and writes_table:
        print(f"Initializing LangGraph persistence with tables: {checkpoints_table}, {writes_table}")
        print(f"Primary Application State Table identified as: {project_id}")
        
        checkpointer = DynamoDBSaver(
            checkpoints_table_name=checkpoints_table,
            writes_table_name=writes_table
        )
        return workflow.compile(checkpointer=checkpointer)
    else:
        print("WARNING: Persistence tables not found in environment. Using in-memory fallback.")
        return workflow.compile()

# Singleton accessor
app = build_aigu_graph()

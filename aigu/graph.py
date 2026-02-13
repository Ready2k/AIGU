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
    
    # MANDATORY: Intake always goes to Risk Triage first
    workflow.add_edge("intake", "risk_triage")
    
    # Route from Risk Triage based on path
    def route_risk_triage(state: GlobalState) -> Literal["poc", "librarian", "support"]:
        """
        Risk Triage Router: Evaluates path and risk level.
        """
        governance = state.get("governance", {})
        status = governance.get("status")
        
        # [OVERRIDE CHECK]
        if status in ["Blocked", "Rejected"]:
            print(f"  → Project is {status}: Routing to Support")
            return "support"

        metadata = state.get("projectMetadata", {})
        path = metadata.get("path", "Standard") # Default to standard if not set
        
        if path == "Stop":
            print("  → Routing to Support (project stopped)")
            return "support"
            
        if path == "Accelerator":
            print("  → Accelerator path: Routing to POC")
            return "poc"
        else:
            print("  → Standard path: Routing to Librarian (skipping sandbox)")
            return "librarian"
    
    workflow.add_conditional_edges("risk_triage", route_risk_triage)
    
    # Accelerator Flow: POC -> Pilot -> Librarian
    def route_poc(state: GlobalState) -> Literal["pilot", "support"]:
        """
        Route from POC based on approval status.
        """
        governance_status = state.get("governance", {}).get("status", "Draft")
        
        if governance_status == "POC-Approved":
            print("  → POC approved: Routing to Pilot")
            return "pilot"
        elif governance_status == "Blocked":
            print("  → POC blocked: Routing to Support")
            return "support"
        else:
            # If still in draft/pending, it stays or goes to support for guidance
            return "support"
            
    workflow.add_conditional_edges("poc", route_poc)
    workflow.add_edge("pilot", "librarian")
    
    # Universal Convergence: Librarian -> Gatekeeper -> Handover
    workflow.add_edge("librarian", "gatekeeper")
    
    def route_gatekeeper(state: GlobalState) -> Literal["handover", "support"]:
        """
        Gatekeeper routes to Handover upon approval.
        """
        status = state.get("governance", {}).get("status", "Draft")
        admin_action = state.get("governance", {}).get("adminAction")
        
        if status == "Approved" or admin_action == "ADMIN_APPROVE":
            print("  → Approved: Proceeding to Handover")
            return "handover"
        else:
            print(f"  → Not Approved (status: {status}): Routing to Support")
            return "support"

    workflow.add_conditional_edges("gatekeeper", route_gatekeeper)
    
    # Terminal nodes
    workflow.add_edge("handover", END)

    # Support Loopback
    def route_support(state: GlobalState) -> Literal["librarian", END]:
        """
        Support Loopback to Librarian on resubmission.
        """
        status = state.get("governance", {}).get("status")
        if status == "Under Review":
            print("  → Revision submitted: Routing back to Librarian")
            return "librarian"
        return END

    workflow.add_conditional_edges("support", route_support)
    
    # Terminal nodes
    workflow.add_edge("handover", END)
    
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

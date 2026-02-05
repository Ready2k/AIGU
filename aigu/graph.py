from typing import Literal
from langgraph.graph import StateGraph, START, END
from aigu.state import GlobalState
from aigu.agents.intake import intake_orchestrator
from aigu.agents.risk_triage import risk_triage_agent
from aigu.agents.librarian import librarian_agent
from aigu.agents.gatekeeper import gatekeeper_agent
from aigu.agents.outcome import outcome_agent
from aigu.agents.support import support_agent

def build_aigu_graph():
    """
    Constructs the AIGU Governance LangGraph.
    Ref: Specification/STATE_TRANSITIONS.md
    """
    workflow = StateGraph(GlobalState)
    
    # 1. Add Nodes
    workflow.add_node("intake", intake_orchestrator)
    workflow.add_node("risk_triage", risk_triage_agent)
    workflow.add_node("librarian", librarian_agent)
    workflow.add_node("gatekeeper", gatekeeper_agent)
    workflow.add_node("outcome", outcome_agent)
    workflow.add_node("support", support_agent) # Optional leaf for visibility/logging
    
    # 2. Edges
    
    # Start -> Intake
    workflow.add_edge(START, "intake")
    
    # Intake Logic
    def route_intake(state: GlobalState) -> Literal["risk_triage", "support"]:
        path = state.get("projectMetadata", {}).get("path", "Stop")
        if path == "Stop":
            return "support" # Inform user why stopped
        return "risk_triage"
        
    workflow.add_conditional_edges(
        "intake",
        route_intake
    )
    
    # Risk -> Librarian
    workflow.add_edge("risk_triage", "librarian")
    
    # Librarian -> Gatekeeper
    workflow.add_edge("librarian", "gatekeeper")
    
    # Gatekeeper Logic (The Loop/Break)
    def route_gatekeeper(state: GlobalState) -> Literal["outcome", "support", "__end__"]:
        status = state.get("governance", {}).get("status", "Draft")
        
        if status == "Approved":
            return "outcome"
        elif status == "Blocked" or status == "In-Review":
            # In a real app with "interrupt", we might end here and wait for resumption.
            # Or route to support to output the status message then end.
            return "support"
        
        # Default fallback (e.g. Draft -> In-Review happened)
        # If we just switched to In-Review, also go to support
        return "support"

    workflow.add_conditional_edges(
        "gatekeeper",
        route_gatekeeper
    )
    
    # Outcome -> End
    workflow.add_edge("outcome", END)
    
    # Support -> End
    workflow.add_edge("support", END)
    
    return workflow.compile()

# Singleton accessor
app = build_aigu_graph()

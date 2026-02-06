import os
from typing import Literal
from langgraph.graph import StateGraph, START, END
# Note: Using the specific package for DynamoDB persistence in LangGraph
from langgraph_checkpoint_dynamodb.saver import DynamoDBSaver
from aigu.state import GlobalState
from aigu.agents.intake import intake_orchestrator
from aigu.agents.risk_triage import risk_triage_agent
from aigu.agents.librarian import librarian_agent
from aigu.agents.gatekeeper import gatekeeper_agent
from aigu.agents.outcome import outcome_agent
from aigu.agents.support import support_agent

def build_aigu_graph():
    """
    Constructs the AIGU Governance LangGraph with persistent DynamoDB storage.
    """
    workflow = StateGraph(GlobalState)
    
    # Nodes
    workflow.add_node("intake", intake_orchestrator)
    workflow.add_node("risk_triage", risk_triage_agent)
    workflow.add_node("librarian", librarian_agent)
    workflow.add_node("gatekeeper", gatekeeper_agent)
    workflow.add_node("outcome", outcome_agent)
    workflow.add_node("support", support_agent)
    
    # Core Flow
    workflow.add_edge(START, "intake")
    
    def route_intake(state: GlobalState) -> Literal["risk_triage", "support"]:
        path = state.get("projectMetadata", {}).get("path", "Stop")
        return "risk_triage" if path != "Stop" else "support"
        
    workflow.add_conditional_edges("intake", route_intake)
    workflow.add_edge("risk_triage", "librarian")
    workflow.add_edge("librarian", "gatekeeper")
    
    def route_gatekeeper(state: GlobalState) -> Literal["outcome", "support"]:
        status = state.get("governance", {}).get("status", "Draft")
        return "outcome" if status == "Approved" else "support"

    workflow.add_conditional_edges("gatekeeper", route_gatekeeper)
    workflow.add_edge("outcome", END)
    workflow.add_edge("support", END)
    
    # Persistence
    checkpoints_table = os.environ.get("CHECKPOINTS_TABLE_NAME")
    writes_table = os.environ.get("WRITES_TABLE_NAME")

    if checkpoints_table and writes_table:
        # The DynamoDBSaver in langgraph-checkpoint-dynamodb 0.1.0 
        # requires both table names as strings.
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

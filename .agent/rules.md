# AIGU Project Rules & Architectural DNA

This document defines the core principles and rules for the AIGU project. All developers and AI agents MUST adhere to these patterns to ensure system integrity and alignment with the A2UI (Agent-to-User Interface) protocol.

## 1. A2UI Architectural Principles
- **Thin Client, Smart Brain**: The UI MUST be a reactive observer of the `GlobalState`. Avoid hardcoding navigation paths or complex business logic in the frontend.
- **Protocol-Oriented Development**: Changes to the workflow MUST start with the `GlobalState` definition in `aigu/state.py` and the Graph logic in `aigu/graph.py`.
- **Enriched View-Models**: The Lambda handler (the "Bridge") is responsible for transforming raw agent data into "UI-Ready" maps via the `ui_overlay` field (e.g., generating pre-signed URLs, adding UI hints).
- **Immutable Auditability**: Every agent decision must be logged in the `auditLog` with:
    - `timestamp`
    - `agent` name
    - `action` taken
    - `reasoningContext` (S3 URI for the Chain-of-Thought)
    - `signature` (SHA-256 hash of the entry)
    - `userIdentity` (IAM ARN of the caller)

## 2. Infrastructure & Persistence
- **State Sovereignty**: `AIGU_Global_State` is the source of truth for the enterprise audit trail and current project status.
- **Node Resilience**: LangGraph internal checkpoints (stored in `AIGU_Checkpoints`) are used for execution recovery and history, separate from the high-level Global State.
- **S3 Reasoning Vault**: Chain-of-Thought (CoT) reasoning MUST be stored as `.txt` files in S3 and never inlined directly in the primary database.

## 3. Security & IAM
- **Zero Secrets Policy**: NO AWS keys (AKIA/Secret) should ever be committed to the repository. Use environment variables or IAM Roles.
- **IAM Authorization**: All API Gateway endpoints (except OPTIONS) MUST require `AuthorizationType: AWS_IAM`.
- **CORS Restricted**: S3 and Gateway CORS must be explicitly limited to authorized development/production origins.

## 4. Development Workflow
- **LangFuse Tracing**: All graph invocations MUST pass `langfuse_session_id` and `langfuse_user_id` as metadata for full observability.
- **TDD Enforcement**: Critical logic changes should be verified using `aigu_manager.sh test`.

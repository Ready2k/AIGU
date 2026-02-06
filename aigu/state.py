from typing import TypedDict, List, Optional, Dict, Any

class ProjectMetadata(TypedDict, total=False):
    name: str
    riskLevel: Optional[str]  # Low, Med, High
    path: Optional[str]  # Accelerator, BAU
    currentStage: str  # Intake, POC, Pilot, Production

class Artifacts(TypedDict, total=False):
    intakeData: Dict[str, Any]
    technicalDesign: Dict[str, Any]
    complianceStatus: List[Dict[str, str]]

class Governance(TypedDict, total=False):
    status: str  # Draft, In-Review, Blocked, Approved
    slaDeadline: Optional[str]
    blockers: List[str]

class AuditLogEntry(TypedDict, total=False): # Changed to total=False to allow optional fields seamlessly, though usually all present
    timestamp: str
    agent: str
    action: str
    reason: str
    reasoningContext: Optional[str] # S3 URI for CoT
    signature: Optional[str] # SHA-256 Hash
    userIdentity: Optional[str] # HITL IAM ARN

class SystemConfig(TypedDict, total=False):
    linkDomainWhitelist: List[str]
    deltaThreshold: float
    allowAIAutoApproval: bool
    mandatorySections: List[str]

class GlobalState(TypedDict, total=False):
    submissionId: str
    userId: str
    projectMetadata: ProjectMetadata
    artifacts: Artifacts
    governance: Governance
    auditLog: List[AuditLogEntry]
    ui_overlay: Dict[str, Any]
    systemConfig: SystemConfig

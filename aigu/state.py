from typing import TypedDict, List, Optional, Dict, Any

class ProjectMetadata(TypedDict, total=False):
    name: str
    riskLevel: Optional[str]  # Low, Med, High
    path: Optional[str]  # Accelerator, Standard, Stop
    currentStage: str  # Intake, Design, POC, Pilot, Risk, Librarian, Gatekeeper, Production, Handover
    
    # NEW FIELDS for multi-stage lifecycle
    capabilityType: Optional[str]  # Hero, New
    pocRequired: bool
    previousVersionId: Optional[str]  # For delta comparison
    deltaPercentage: Optional[float]  # Calculated change percentage
    lifecyclePhase: Optional[str]  # POC, Pilot, Production, Live
    versionHistory: Optional[List[Dict[str, Any]]]  # Version tracking

class POCData(TypedDict, total=False):
    testPlan: str
    successCriteria: str
    resourceEstimate: str
    technicalApproach: str
    cafApprovalStatus: Optional[str]  # Pending, Approved, Rejected
    cafRejectionReason: Optional[str]
    completionDate: Optional[str]
    approvalDate: Optional[str]

class PilotData(TypedDict, total=False):
    pilotStartDate: Optional[str]
    expectedEndDate: Optional[str]
    pilotComplete: bool
    pilotResults: Optional[str]
    lessonsLearned: Optional[str]

class ProductionData(TypedDict, total=False):
    kpiMetrics: Optional[Dict[str, Any]]
    costAnalysis: Optional[Dict[str, Any]]
    incrementalRisk: Optional[str]
    outcomeReport: Optional[str]
    submissionDate: Optional[str]
    expectedApprovalDate: Optional[str]

class HandoverTask(TypedDict, total=False):
    team: str
    task: str
    status: str
    dueDate: str

class HandoverData(TypedDict, total=False):
    tasks: List[HandoverTask]
    completionDate: Optional[str]
    finalStatus: Optional[str]
    projectName: Optional[str]
    riskLevel: Optional[str]

class Artifacts(TypedDict, total=False):
    intakeData: Dict[str, Any]
    technicalDesign: Dict[str, Any]
    complianceStatus: List[Dict[str, str]]
    
    # NEW ARTIFACT SECTIONS
    pocData: Optional[POCData]
    pilotData: Optional[PilotData]
    productionData: Optional[ProductionData]
    handoverData: Optional[HandoverData]

class Governance(TypedDict, total=False):
    status: str  # Draft, In-Review, Blocked, Approved, POC-Approved, Pilot-Active, Production-Ready, Live
    slaDeadline: Optional[str]
    slaType: Optional[str]  # e.g., "3-Day Pilot Review", "7-Day Production Approval"
    slaDays: Optional[int]
    blockers: List[str]
    
    # Admin approval tracking
    adminApproved: Optional[bool]
    adminAction: Optional[str]  # ADMIN_APPROVE, ADMIN_REQUEST_INFO
    adminMessage: Optional[str]
    approvalDate: Optional[str]

class AuditLogEntry(TypedDict, total=False):
    timestamp: str
    agent: str
    action: str
    reason: str
    reasoningContext: Optional[str]  # S3 URI for CoT
    signature: Optional[str]  # SHA-256 Hash
    userIdentity: Optional[str]  # HITL IAM ARN

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
    chainOfThought: Optional[List[Dict[str, Any]]]  # Agent reasoning history

from typing import TypedDict, List, Optional, Dict, Any

class ProjectMetadata(TypedDict, total=False):
    name: str
    riskLevel: Optional[str]  # Low, Med, High
    path: Optional[str]  # Accelerator, Standard, Stop
    currentStage: str  # Intake, Design, POC, Pilot, Risk, Librarian, Gatekeeper, Production, Handover
    artifactsValid: bool
    missingArtifacts: List[str]
    missingIntakeFields: List[str]  # NEW: Track specific missing fields in intake
    validationErrors: List[str]    # NEW: Specific validation failures
    isIntakeComplete: bool         # NEW: Whether all critical fields are present
    
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

class IntakeData(TypedDict, total=False):
    projectName: str
    owner: str
    businessArea: str
    problemStatement: str
    solutionBrief: str
    timelines: str
    sponsorship: str
    lifecycleStatus: str  # e.g., POC, Pilot, Production
    successCriteria: str
    technicalApproach: str
    resources: str
    businessValue: str
    financialBenefits: str
    funding: str
    raids: str  # Risks, Assumptions, Issues, Dependencies
    architectureVision: str
    description: str  # Raw description for LLM processing

class IntakeValidation:
    """Utility for intake field validation logic."""
    CRITICAL_FIELDS = ["projectName", "owner", "funding", "problemStatement", "businessArea"]
    
    @staticmethod
    def validate_timelines(timeline_str: str) -> bool:
        import re
        # Support Q[1-4] YYYY or MM/YYYY
        q_pattern = r"^Q[1-4] \d{4}$"
        m_pattern = r"^(0[1-9]|1[0-2])/\d{4}$"
        return bool(re.match(q_pattern, timeline_str) or re.match(m_pattern, timeline_str))

    @staticmethod
    def validate_email_or_id(owner_str: str) -> bool:
        import re
        # Basic email or employee ID (e.g. E12345)
        email_pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        id_pattern = r"^[Ee]\d{5,}$"
        name_pattern = r"^[a-zA-Z0-9 ]{2,}$"  # Allow basic names for testing
        return bool(re.match(email_pattern, owner_str) or re.match(id_pattern, owner_str) or re.match(name_pattern, owner_str))

    @staticmethod
    def validate_funding(funding_str: str) -> bool:
        # Numeric or 'TBD'
        if funding_str.upper() == "TBD":
            return True
        try:
            # Strip currency symbols/commas/spaces
            clean = funding_str.replace("$", "").replace("£", "").replace("€", "").replace(",", "").strip()
            float(clean)
            return True
        except ValueError:
            return False

class HandoverData(TypedDict, total=False):
    tasks: List[HandoverTask]
    completionDate: Optional[str]
    finalStatus: Optional[str]
    projectName: Optional[str]
    riskLevel: Optional[str]

class Artifacts(TypedDict, total=False):
    intakeData: IntakeData
    technicalDesign: Dict[str, Any]
    complianceStatus: List[Dict[str, str]]
    
    # NEW ARTIFACT SECTIONS
    pocData: Optional[POCData]
    pilotData: Optional[PilotData]
    productionData: Optional[ProductionData]
    handoverData: Optional[HandoverData]
    files: Optional[List[str]]  # Track S3 filenames

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
    requiredDocsPreview: List[str] # Predicted documents for user "heads up"

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

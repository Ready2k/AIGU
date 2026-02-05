# 🧪 AIGU TDD Roadmap: Test Scenarios

This document defines the automated test cases required to validate the orchestration logic of the AI Governance Unit. Each test must pass before moving a project to the next lifecycle stage.

## 1. Intake & Routing Logic
| Scenario ID | Description | Expected Outcome |
| :--- | :--- | :--- |
| **TC-INT-01** | User submits a project for a "Hero Capability." | Intake Orchestrator marks path as "Accelerator" and triggers Risk Agent. |
| **TC-INT-02** | User submits a non-AI standard request. | Intake Orchestrator marks path as "BAU" and provides legacy links. |
| **TC-INT-03** | User attempts to re-submit an existing project ID. | Gov Librarian blocks duplication and returns the current state. |

## 2. Risk & SLA Enforcement
| Scenario ID | Description | Expected Outcome |
| :--- | :--- | :--- |
| **TC-RSK-01** | Project identified as "High Risk" (GenAI). | `slaDeadline` set to +10 days; A2UI renders "9 artifact" technical module. |
| **TC-RSK-02** | Project identified as "Low Risk." | `slaDeadline` set to +3 days; A2UI renders minimalist "Tickbox for LCT". |

## 3. Support Agent & Transparency
| Scenario ID | Description | Expected Outcome |
| :--- | :--- | :--- |
| **TC-SUP-01** | User queries "Where is my project?" while in Legal Review. | Support Agent reads `governance.status` and reports "Blocked by Legal". |
| **TC-SUP-02** | App mounts with an existing `submissionId` in DynamoDB. | Support Agent greets user with progress summary instead of blank form. |

## 4. Offline Approval & Gatekeeping
| Scenario ID | Description | Expected Outcome |
| :--- | :--- | :--- |
| **TC-GAT-01** | Legal clicks "Approve" link in external email. | DynamoDB `complianceStatus` updates to 'Approved'; Gatekeeper triggers Pilot -> Prod move. |
| **TC-GAT-02** | Pilot moving to Production. | Outcome Tracker verifies *only* incremental risks since the last Pilot approval. |

---

## 🛠️ Automated Verification Logic
All tests must verify the **Audit Log Requirement**:
- Every state change MUST result in an entry in the `auditLog` array.
- **Failure Condition:** If a state changes without an audit entry, the CI/CD pipeline must fail the build.
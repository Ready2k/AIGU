# 📩 AIGU Offline Approval & External Signals

This document defines how non-technical stakeholders (Legal, GIGC, ARB) provide the "Offline Approvals" required by the governance flow.

## 1. The Triggering Event
When a project enters a stage requiring external review (e.g., Pilot High-Risk), the **Gatekeeper Agent** initiates the following:
1. Updates the DynamoDB state to `status: 'In-Review'`.
2. Triggers an AWS SES (Simple Email Service) notification to the relevant "Horizontal" team.
3. Appends a "Notification Sent" entry to the `auditLog`.

## 2. Secure Approval Mechanism
To solve the friction of "challenging legacy processes," we utilize **Signed Approval Tokens**:

* **Actionable Email:** The stakeholder receives an email containing a secure, time-limited URL.
* **Payload:** The URL contains a JWT (JSON Web Token) encoding the `submissionId`, the `horizontalId` (e.g., Legal), and an `action` (Approve/Challenge).
* **Execution:** Clicking the link triggers an AWS Lambda function that validates the token and updates the "Brain" state directly.

## 3. Signal Integration with LangGraph



| Stakeholder Signal | State Mutation | Gatekeeper Action |
| :--- | :--- | :--- |
| **Approve** | `complianceStatus.status = 'Approved'` | Transitions project to the next node. |
| **Challenge** | `governance.status = 'Blocked'` | Updates `governance.blockers` with stakeholder comments. |
| **Request Info**| `governance.status = 'Draft'` | Moves the project back to the user for "Additional Questions." |

## 4. Solving the "Why is it taking so long?" Pain Point
The **Support Agent** interprets these offline signals to provide real-time feedback to the user:
- **Scenario:** Legal clicks the "Challenge" link in their email.
- **Support Agent Query:** "Why is my project blocked?"
- **Response:** "The Legal team has challenged the data privacy artifact. They require clarification on your audit logging methodology."

## 5. Security Guardrails
- **One-Time Use:** Approval tokens are invalidated immediately upon use.
- **Audit Trails:** The `auditLog` must record the specific IP and timestamp of the external stakeholder's action to satisfy the "Full Audit Logging" principle.
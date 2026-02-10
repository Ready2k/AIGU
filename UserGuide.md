# AIGU User Guide - Version 2.0

Welcome to the **AI Governance Unit (AIGU)**. This guide provides step-by-step instructions for using the AIGU platform to manage AI project governance throughout its entire lifecycle.

---

## 👥 User Personas

### 1. Project Submitter
- **Goal:** Get AI projects approved and deployed to production.
- **Responsibilities:** Provide project details, upload artifacts, and respond to governance challenges.

### 2. GIGC Admin (Governance Agent)
- **Goal:** Ensure all AI projects comply with corporate governance standards.
- **Responsibilities:** Review submissions, approve/block projects, and manage the horizontal approval queue.

---

## 🚀 The Lifecycle Walkthrough

### Phase 1: Intake & Routing
Every project starts with the **Intake**.
1. **Enter Project Details:** Provide name, description, and technical approach.
2. **Path Selection:** The system automatically routes you:
   - **Accelerator:** For high-impact AI capabilities.
   - **Standard:** For low-risk, non-AI or BAU projects (Auto-approved).
   - **Stop:** If criteria aren't met.

### Phase 2: Design & POC (Accelerator Only)
If your project uses a **"New" AI Capability**, you must complete a POC.
1. **Upload POC Data:** Test plan, success criteria, and resource estimates.
2. **CAF Approval:** The POC results are reviewed by the Cloud Advisory Forum (CAF).
> [!NOTE]
> **"Hero" Capabilities** skip the POC stage and move directly to Pilot.

### Phase 3: Pilot & Risk Assessment
The **Pilot** stage is where detailed governance happens.
1. **Risk Triage:** Based on your inputs, the system assigns a Risk Level (Low/Med/High).
2. **SLA Assignment:**
   - **Low Risk:** 3 Days
   - **Med Risk:** 7 Days
   - **High Risk:** 10 Days
3. **Artifact Collection:** The **Librarian Agent** identifies missing documentation (Security, Privacy, Legal).

### Phase 4: Production Submission & Delta Review
Before going live, projects move to the **Production** stage.
1. **Submit Production Data:** KPIs, cost analysis, and outcome reports.
2. **The 15% Delta Rule:**
   - If you update a project and the changes exceed **15%**, the system routes you back to the **Gatekeeper** for a full re-review.
   - Changes under 15% follow an expedited path.

### Phase 5: Handover to Operations
Once approved for production, the **Handover Agent** takes over.
1. **Task Generation:** Automated tasks are created for:
   - **IRIS:** Stakeholder engagement.
   - **LCT:** Residual risk tracking.
   - **RTB:** Run-the-Bank operations.

---

## 🛠 Admin Functions

Admins use the **Admin Dashboard** to manage the flow:
- **Review Queue:** See all projects awaiting approval or review.
- **Detailed Action:** Approve, Block, or Request Information.
- **Delta Viewer:** For production updates, view exactly what changed between versions to assess risk.

---

## 💬 Interacting with the Support Agent

The **Support Agent** is available on every screen. Use it to:
- **Query Status:** *"Where is my project currently?"*
- **Understand Blockers:** *"Why is my project blocked at the Librarian stage?"*
- **Get Advice:** *"What documentation do I need for a High-Risk project?"*

> [!TIP]
> Use the **Log Viewer** to see a full audit trail of every decision made by the AI agents and Admins.

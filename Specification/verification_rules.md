# 🛡️ AIGU Verification & Validation Logic

This document defines the rules for how agents verify documentation, links, and delta changes during the governance lifecycle.

## 1. Document Tribe "Gold Standards"
- **Rule Attribution**: Each "Document Tribe" owner (Legal, Architecture, Security) defines the "Completeness" and "Accuracy" rules for their specific artifacts.
- **Reference Model**: Agents must cross-reference uploaded documents against a "Gold Standard" example provided by the Tribe owner to ensure stylistic and technical alignment.

## 2. Automated Content Review
- **Mandatory Sections**: The **Librarian** agent enforces mandatory fields (e.g., Data Flow Diagrams, IAM Specs). If missing, the project is flagged as "Incomplete".
- **Accuracy Cross-Check**: Agents MUST cross-reference document text against UI form data. 
    - *Example Conflict*: If the UI says "Low Risk" but a PDF mentions "Customer PII," the agent triggers an immediate "High Risk" escalation alert.
- **Catalogue Matching**: Agents review the existing "Single Source of Truth" to ensure classification consistency with past projects.

## 3. Link & Source Security
- **Domain Whitelist**: An Admin-defined whitelist of URL domains (e.g., internal GitHub, SharePoint) is enforced. Links to non-approved domains are flagged.
- **Crawl & Summarize**: Agents attempt to scrape/summarize link content for the Gatekeeper. 
- **Human-in-the-Loop (HITL)**: If a link is inaccessible, irrelevant, or too complex for the AI to understand, the agent must flag the item for human review.

## 4. Helpful Drafting & Suggestion
- **Pre-Submission Feedback**: The **Support Agent** provides real-time feedback on "Rough Drafts," highlighting missing requirements before a user officially submits.
- **Proactive Suggestions**: The **Librarian** suggests relevant documents or past project links based on the current submission context to aid the user.

## 5. Incremental Delta & Scope Creep
- **The "Delta" Threshold**: When moving from Pilot to Production, the agent calculates the percentage of change in the Technical Design.
- **Auto-Block**: If the change exceeds a "Tuneable Threshold" (set by Admins), the status is automatically set to "Blocked" for a mandatory full re-review.
- **Supported Formats**: Verification is supported for PDF, Email (.msg/.eml), PPTX, and DOCX.
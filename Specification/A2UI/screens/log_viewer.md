AIGU Log Viewer Specification

1. Functional Requirements

State-Linked Retrieval: The viewer must identify the submissionId and fetch the complete auditLog array from DynamoDB.

S3 Hydration: For any log entry containing an S3_Object_URI, the viewer must fetch the "Chain-of-Thought" (CoT) text using a pre-signed URL (to maintain S3 bucket security).

Immutable Verification: The UI must display a visual "Verified" checkmark if the SHA-256 hash of the log entry matches the current data, ensuring no post-hoc tampering.

Chronological Playback: Logs must be presented in a vertical timeline, showing the progression from Intake through Risk and Gatekeeper stages.

2. UI/UX Design (A2UI Principles)

The "Support" Overlay Integration: The Log Viewer should be accessible via a "View Reasoning" button on the SupportStatus screen.

Component Pattern:

Timeline Node: Displays the timestamp, agentName, and the action (e.g., "Risk Categorized: High").

Reasoning Expandable: A collapsible section using typography.mono to display the raw "Chain-of-Thought" reasoning from the Amazon Nova model.

Status Indicators: Uses AIGU_THEME.colors.info for standard logs and error for blocked transitions.

3. Data Schema Mapping

Field	Source	UI Display Role
timestamp	DynamoDB	Sorts the timeline entries.
agent	DynamoDB	Identifies which agent "thought" this (e.g., Gov Librarian).
reasoningContext	S3 (via URI)	Provides the "Why" behind the "What".
action	DynamoDB	The final decision made by that agent.
🚀 Prompt for AntiGravity
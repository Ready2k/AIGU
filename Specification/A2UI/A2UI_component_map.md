# 🎨 AIGU Dynamic UI Component Map

This document maps the **Global State** values to specific **A2UI** React Native components. The goal is a "Zero-Redundancy" interface that expands or contracts based on project risk.

## 1. Stage-Based Layouts
The primary navigation and screen layout are determined by `governance.currentStage`.

| Stage | A2UI Core Component | Primary User Action |
| :--- | :--- | :--- |
| **Intake** | `DiscoveryCanvas` | Define project goal and type (Accelerator/BAU) |
| **POC** | `RapidTrialDashboard` | Log initial testing results and "Offline CAF" status |
| **Pilot** | `StructuredGovernanceHub` | Complete risk-tier specific technical artifacts |
| **Production** | `ValueRealizationTracker` | Submit KPI reports and Final Outcome data |

---

## 2. Risk-Based Component Injection
Within the **Pilot** stage, the UI injects specific modules based on `projectMetadata.riskLevel`. This solves the "9 different artifacts" pain point by only showing what is required.

| Risk Level | Injected A2UI Module | Purpose |
| :--- | :--- | :--- |
| **Low** | `LCT_Checklist` | Simple "Tickbox for LCT" for standard AI tools. |
| **Med** | `DataPrivacyModule` | Additional questions regarding internal data usage. |
| **High** | `AdvancedTechReview` | The "9 different things" required for GenAI. |
| **High** | `IncrementalRiskDelta` | Comparison tool for Pilot vs. Prod risk. |

---

## 3. Status & Support Overlays
The **Support Agent** uses these components to provide "Radical Transparency" into the governance process.

* **`SLA_CountdownTimer`**: 
    - **Trigger**: `governance.slaDeadline` is not null.
    - **Visual**: Renders a 3, 7, or 10-day countdown based on risk.
* **`BlockerAlert`**: 
    - **Trigger**: `governance.status === 'Blocked'`.
    - **Visual**: Highlights the specific "Horizontal" (e.g., Legal) that has challenged the flow.
* **`AuditTimeline`**: 
    - **Trigger**: Persistent footer or side-drawer.
    - **Visual**: Maps the `auditLog` into a human-readable activity feed (e.g., "GIGC notified 2 days ago").

---

## 4. Dynamic Logic Example (React Native)

```javascript
// A2UI uses a Higher-Order Component to wrap these governed modules
const PilotScreen = ({ state }) => {
  return (
    <View>
      <BasicProjectHeader data={state.projectMetadata} />
      
      {/* Dynamic Injection based on The Brain */}
      {state.riskLevel === 'High' && <AdvancedTechReview />}
      {state.riskLevel === 'Low' && <LCT_Checklist />}
      
      {/* The Support Agent's Transparency Layer */}
      <SupportAgentInterface status={state.governance.status} />
    </View>
  );
};
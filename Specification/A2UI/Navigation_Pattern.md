Rule: The root navigator must subscribe to the currentStage from the DynamoDB state.

If currentStage == 'Intake', show DiscoveryCanvas.

If governance.status == 'Blocked', show SupportOverlay as a priority modal.

If currentStage == 'Pilot' AND riskLevel == 'High', inject the AdvancedTechReview module.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';

/**
 * WorkflowProgress Component
 * 
 * Displays the governance workflow path based on currentPath and riskLevel.
 * - Accelerator path: Goes through GIGC Admin Queue
 * - Standard path: Direct to Implementation
 * - Highlights the current stage and completed stages
 */
const WorkflowProgress = ({ state }) => {
    const { theme } = useAiguTheme();

    // Extract state data
    const currentStage = state.projectMetadata?.currentStage || 'Intake';
    const currentPath = state.projectMetadata?.path || 'Standard';
    const riskLevel = state.projectMetadata?.riskLevel || 'Low';
    const status = state.governance?.status || 'Draft';

    // Define the workflow stages
    const commonStages = [
        { key: 'Intake', label: 'Intake', description: 'Initial submission' }
    ];

    // Path-specific stages
    const acceleratorStages = [
        { key: 'POC', label: 'POC Phase', description: 'Technical validation' },
        { key: 'Pilot', label: 'Pilot Phase', description: 'Risk controlled testing' },
        { key: 'Risk', label: 'Risk Analysis', description: 'Compliance review' },
        { key: 'Librarian', label: 'Documentation', description: 'Artifact validation' },
        { key: 'Gatekeeper', label: 'GIGC Approval', description: 'Executive sign-off' },
        { key: 'Production', label: 'Production', description: 'Live deployment' },
        { key: 'Handover', label: 'Handover', description: 'BAU Operations' }
    ];

    const standardStages = [
        { key: 'Risk', label: 'Risk Triage', description: 'Automated analysis' },
        { key: 'Handover', label: 'Auto-Approve', description: 'Direct to Operations' }
    ];

    // Determine which path to show
    const isAccelerator = currentPath === 'Accelerator' || riskLevel === 'High' || riskLevel === 'Med';
    const pathStages = isAccelerator ? acceleratorStages : standardStages;
    const allStages = [...commonStages, ...pathStages];

    // Find current stage index
    const currentIndex = allStages.findIndex(s => s.key === currentStage);
    const activeIndex = currentIndex >= 0 ? currentIndex : 0;

    const [selectedStep, setSelectedStep] = React.useState(null);

    const handleStagePress = (stage) => {
        // Extract CoT and Artifacts for this stage
        const cot = (state.chainOfThought || []).filter(c =>
            c.agent?.toLowerCase() === stage.key.toLowerCase() ||
            (stage.key === 'Intake' && c.agent === 'Intake Orchestrator')
        );

        let stageArtifacts = null;
        if (stage.key === 'Intake') stageArtifacts = state.artifacts?.intakeData;
        if (stage.key === 'POC') stageArtifacts = state.artifacts?.pocData;
        if (stage.key === 'Production') stageArtifacts = state.artifacts?.productionData;

        setSelectedStep({
            ...stage,
            cot,
            artifacts: stageArtifacts
        });
    };

    return (
        <View style={styles.container}>
            {/* Step Details Modal */}
            {selectedStep && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[theme.typography.header, { color: theme.colors.primary }]}>{selectedStep.label}</Text>
                            <TouchableOpacity onPress={() => setSelectedStep(null)}>
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 24 }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 500 }}>
                            <Text style={[styles.modalSectionTitle, { color: theme.colors.textSecondary }]}>AGENT REASONING (CoT)</Text>
                            {selectedStep.cot.length > 0 ? selectedStep.cot.map((c, i) => (
                                <View key={i} style={[styles.cotBlock, { backgroundColor: theme.colors.background }]}>
                                    <Text style={[theme.typography.caption, { color: theme.colors.accent, fontWeight: '700' }]}>DECISION: {c.decision || c.action}</Text>
                                    <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginTop: 4, fontSize: 13 }]}>{c.reason || 'Decision processed.'}</Text>
                                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 8 }]}>{new Date(c.timestamp).toLocaleString()}</Text>
                                </View>
                            )) : (
                                <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic', marginBottom: 20 }}>No reasoning recorded for this stage yet.</Text>
                            )}

                            <Text style={[styles.modalSectionTitle, { color: theme.colors.textSecondary, marginTop: 16 }]}>SUBMITTED ARTIFACTS</Text>
                            {selectedStep.artifacts ? (
                                <View style={[styles.artifactBlock, { borderColor: theme.colors.border }]}>
                                    {Object.entries(selectedStep.artifacts).map(([k, v]) => (
                                        <View key={k} style={{ marginBottom: 8 }}>
                                            <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>{k.toUpperCase()}</Text>
                                            <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontSize: 12 }]}>{typeof v === 'string' ? v : JSON.stringify(v)}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic' }}>No artifacts associated with this stage.</Text>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => setSelectedStep(null)}
                        >
                            <Text style={styles.closeButtonText}>CLOSE INSIGHTS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Path Indicator */}
            <View style={styles.pathHeader}>
                <View style={[styles.pathBadge, {
                    backgroundColor: isAccelerator ? theme.colors.warning : theme.colors.success
                }]}>
                    <Text style={styles.pathBadgeText}>
                        {isAccelerator ? '🚀 ACCELERATOR PATH' : '✅ STANDARD PATH'}
                    </Text>
                </View>
                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 8 }}>
                    {isAccelerator
                        ? 'Multi-stage governance for high/medium risk projects'
                        : 'Fast-track governance for low-risk BAU projects'}
                </Text>
            </View>

            {/* Workflow Stages */}
            <View style={styles.timeline}>
                {allStages.map((stage, index) => {
                    const isActive = index === activeIndex;
                    const isCompleted = index < activeIndex;
                    const isPending = index > activeIndex;

                    // Determine if this is a branching point
                    const isBranchPoint = stage.key === 'Intake';

                    return (
                        <View key={stage.key}>
                            {/* Stage Node */}
                            <TouchableOpacity
                                style={styles.stageRow}
                                onPress={() => handleStagePress(stage)}
                                activeOpacity={0.7}
                            >
                                {/* Stage Circle */}
                                <View style={[
                                    styles.stageCircle,
                                    {
                                        backgroundColor: isActive
                                            ? theme.colors.primary
                                            : isCompleted
                                                ? theme.colors.success
                                                : theme.colors.border,
                                        borderWidth: isActive ? 3 : 1,
                                        borderColor: isActive ? theme.colors.accent : theme.colors.border
                                    }
                                ]}>
                                    <Text style={[
                                        styles.stageNumber,
                                        { color: isActive || isCompleted ? '#FFF' : theme.colors.textSecondary }
                                    ]}>
                                        {isCompleted ? '✓' : index + 1}
                                    </Text>
                                </View>

                                {/* Stage Info */}
                                <View style={styles.stageInfo}>
                                    <Text style={[
                                        theme.typography.body,
                                        {
                                            color: isActive ? theme.colors.primary : theme.colors.textPrimary,
                                            fontWeight: isActive ? '700' : '600'
                                        }
                                    ]}>
                                        {stage.label}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={[
                                            theme.typography.caption,
                                            { color: theme.colors.textSecondary, fontSize: 11, flex: 1 }
                                        ]}>
                                            {stage.description}
                                        </Text>

                                        {/* Show current status on active stage */}
                                        {isActive && (
                                            <View style={[styles.statusBadge, {
                                                backgroundColor: getStatusColor(status, theme)
                                            }]}>
                                                <Text style={styles.statusText}>{status}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Connector Line */}
                            {index < allStages.length - 1 && (
                                <View style={[
                                    styles.connector,
                                    {
                                        backgroundColor: isCompleted
                                            ? theme.colors.success
                                            : theme.colors.border
                                    }
                                ]} />
                            )}

                            {/* Branch Indicator */}
                            {isBranchPoint && (
                                <View style={styles.branchIndicator}>
                                    <Text style={[
                                        theme.typography.caption,
                                        {
                                            color: theme.colors.textSecondary,
                                            fontStyle: 'italic',
                                            fontSize: 11
                                        }
                                    ]}>
                                        ↓ {isAccelerator ? 'Routing to Multi-Stage Governance' : 'Automated Triage Path'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Path Legend */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                        Completed
                    </Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                        Current
                    </Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.colors.border }]} />
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                        Pending
                    </Text>
                </View>
            </View>
        </View>
    );
};

const getStatusColor = (status, theme) => {
    switch (status) {
        case 'Approved':
        case 'POC-Approved':
        case 'Production-Ready':
        case 'Live':
            return theme.colors.success;
        case 'Blocked':
            return theme.colors.error;
        case 'Pilot-Active':
            return theme.colors.accent;
        case 'In-Review':
        case 'InReview':
        case 'Pending':
            return theme.colors.warning;
        case 'Draft':
            return theme.colors.info || '#0dcaf0';
        default: return '#6c757d';
    }
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: 'transparent',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent'
    },
    pathHeader: {
        marginBottom: 24,
        alignItems: 'center'
    },
    pathBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4
    },
    pathBadgeText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 1
    },
    timeline: {
        paddingLeft: 8
    },
    stageRow: {
        flexDirection: 'row',
        alignItems: 'flex-start'
    },
    stageCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3
    },
    stageNumber: {
        fontSize: 14,
        fontWeight: '800'
    },
    stageInfo: {
        flex: 1,
        marginLeft: 16,
        paddingBottom: 8
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 6
    },
    statusText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    connector: {
        width: 3,
        height: 32,
        marginLeft: 18,
        borderRadius: 2
    },
    branchIndicator: {
        marginLeft: 56,
        marginTop: -8,
        marginBottom: 8,
        paddingLeft: 12,
        borderLeftWidth: 2,
        borderLeftColor: 'rgba(128,128,128,0.3)',
        borderStyle: 'dashed'
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(128,128,128,0.2)'
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 12
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 6
    },
    modalContent: {
        width: '90%',
        maxWidth: 600,
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        maxHeight: '80%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    modalSectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 12
    },
    cotBlock: {
        padding: 16,
        borderRadius: 8,
        marginBottom: 12
    },
    artifactBlock: {
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    closeButton: {
        marginTop: 24,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center'
    },
    closeButtonText: {
        color: '#FFF',
        fontWeight: '700'
    }
});

export default WorkflowProgress;

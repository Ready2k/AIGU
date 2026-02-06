import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';

const AdminQueue = ({ actions }) => {
    const { theme } = useAiguTheme();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReasoning, setSelectedReasoning] = useState(null);
    const [reasoningContent, setReasoningContent] = useState('');
    const [loadingReasoning, setLoadingReasoning] = useState(false);
    const [expandedReasoningCards, setExpandedReasoningCards] = useState({});
    const [requestInfoModal, setRequestInfoModal] = useState(null);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [deltaModal, setDeltaModal] = useState(null);
    const [deltaDetails, setDeltaDetails] = useState(null);
    const [loadingDelta, setLoadingDelta] = useState(false);

    const handleViewDelta = async (item) => {
        setDeltaModal(item);
        setLoadingDelta(true);
        setDeltaDetails(null);

        try {
            const result = await actions.fetchDelta(item.submissionId, item.projectMetadata?.previousVersionId);
            setDeltaDetails(result);
        } catch (error) {
            console.error("Failed to fetch delta:", error);
        } finally {
            setLoadingDelta(false);
        }
    };

    const refreshQueue = async () => {
        setLoading(true);
        const data = await actions.fetchAdminQueue();
        console.log("Admin queue data:", data);
        setQueue(data);
        setLoading(false);
    };

    useEffect(() => {
        refreshQueue();
    }, []);

    const handleApprove = async (item) => {
        Alert.alert(
            "Confirm Approval",
            `Are you sure you want to approve "${item.projectMetadata?.name || item.submissionId}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Approve",
                    style: "default",
                    onPress: async () => {
                        console.log("Approving project:", item.submissionId, item.userId);
                        const success = await actions.adminAction(item.submissionId, item.userId, "ADMIN_APPROVE");
                        if (success) {
                            Alert.alert("✅ Approved", `Project ${item.projectMetadata?.name || item.submissionId} has been approved and will proceed to the next stage.`);
                            refreshQueue();
                        } else {
                            Alert.alert("Error", "Failed to approve project. Please check logs.");
                        }
                    }
                }
            ]
        );
    };

    const handleRequestInfo = (item) => {
        setRequestInfoModal(item);
        setFeedbackMessage('');
    };

    const submitRequestInfo = async () => {
        if (!feedbackMessage.trim()) {
            Alert.alert("Error", "Please enter a feedback message.");
            return;
        }

        const item = requestInfoModal;
        console.log("Requesting info for project:", item.submissionId, item.userId, "Message:", feedbackMessage);
        const success = await actions.adminAction(item.submissionId, item.userId, "ADMIN_REQUEST_INFO", feedbackMessage);

        if (success) {
            Alert.alert("📨 Info Requested", "User has been notified and will see your message on their Support Status screen.");
            setRequestInfoModal(null);
            setFeedbackMessage('');
            refreshQueue();
        } else {
            Alert.alert("Error", "Failed to send request. Please try again.");
        }
    };

    const handleStageClick = async (stageName, reasoningUrls) => {
        console.log("Stage clicked:", stageName, "URLs:", reasoningUrls);

        if (!reasoningUrls || Object.keys(reasoningUrls).length === 0) {
            Alert.alert("No Reasoning Available", "This stage has not been processed yet.");
            return;
        }

        const stageMapping = {
            'Intake': 'intake',
            'Risk': 'risk',
            'GIGC': 'gatekeeper',
            'Pilot': 'support',
            'Production': 'outcome',
            'Handover': 'outcome'
        };

        const searchPattern = stageMapping[stageName] || stageName.toLowerCase();
        const reasoningUrl = Object.entries(reasoningUrls).find(([key]) =>
            key.toLowerCase().includes(searchPattern)
        );

        if (!reasoningUrl) {
            Alert.alert("No Reasoning Available", `No reasoning found for ${stageName} stage.`);
            return;
        }

        setSelectedReasoning(stageName);
        setLoadingReasoning(true);

        try {
            const response = await fetch(reasoningUrl[1]);
            const text = await response.text();
            setReasoningContent(text);
        } catch (error) {
            console.error("Failed to fetch reasoning:", error);
            setReasoningContent("Failed to load reasoning content.");
        } finally {
            setLoadingReasoning(false);
        }
    };

    const toggleReasoningExpansion = (submissionId) => {
        setExpandedReasoningCards(prev => ({
            ...prev,
            [submissionId]: !prev[submissionId]
        }));
    };

    const calculateSLAStatus = (deadline) => {
        if (!deadline) return { daysRemaining: null, status: 'unknown', color: '#999' };

        const deadlineDate = new Date(deadline);
        const now = new Date();
        const diffTime = deadlineDate - now;
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let status = 'healthy';
        let color = '#28a745'; // green

        if (daysRemaining < 0) {
            status = 'breached';
            color = '#dc3545'; // red
        } else if (daysRemaining <= 3) {
            status = 'warning';
            color = '#ffc107'; // amber
        }

        return { daysRemaining, status, color };
    };

    const extractMissingArtifacts = (blockers) => {
        if (!blockers || blockers.length === 0) return [];

        const artifacts = [];
        blockers.forEach(blocker => {
            // POC Phase
            if (blocker.includes('Test Plan')) artifacts.push('POC: Test Plan');
            if (blocker.includes('Success Criteria')) artifacts.push('POC: Success Criteria');
            if (blocker.includes('Resource Estimate')) artifacts.push('POC: Resource Estimate');
            if (blocker.includes('Technical Approach')) artifacts.push('POC: Technical Approach');

            // Production Phase
            if (blocker.includes('KPI Measurements')) artifacts.push('PROD: KPI Metrics');
            if (blocker.includes('Cost Control')) artifacts.push('PROD: Cost Analysis');
            if (blocker.includes('Risk Assessment')) artifacts.push('PROD: Incremental Risk');
            if (blocker.includes('Outcome Report')) artifacts.push('PROD: Pilot Report');

            // Librarian/Standard
            if (blocker.includes('DataFlowDiagram')) artifacts.push('Data Flow Diagram');
            if (blocker.includes('IAM')) artifacts.push('IAM Specs');
            if (blocker.includes('Security')) artifacts.push('Security Review');
        });

        return [...new Set(artifacts)];
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <ResponsiveWrapper>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary }}>GIGC Admin Queue 🛡️</Text>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 4 }}>
                            Audit-Ready Governance Dashboard
                        </Text>
                    </View>
                    <TouchableOpacity onPress={refreshQueue} style={styles.refresh}>
                        <Text style={{ color: theme.colors.accent, fontWeight: '700' }}>🔄 REFRESH</Text>
                    </TouchableOpacity>
                </View>

                {queue.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>✅ No projects currently awaiting review.</Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 8 }}>All submissions are either approved or in progress.</Text>
                    </View>
                ) : (
                    <ScrollView>
                        {queue.map((item) => {
                            const projectName = item.artifacts?.intakeData?.projectName || item.projectMetadata?.name || "Untitled Project";
                            const description = item.artifacts?.intakeData?.description || "";
                            const currentStage = item.projectMetadata?.currentStage || "Intake";
                            const path = item.projectMetadata?.path || "Standard";
                            const status = item.governance?.status || "Draft";
                            const agentMessage = item.ui_overlay?.supportMessage || "";
                            const reasoningUrls = item.ui_overlay?.reasoningUrls || {};
                            const blockers = item.governance?.blockers || [];
                            const deadline = item.ui_overlay?.slaDisplay !== 'TBD' ? '2026-02-16' : null;
                            const slaStatus = calculateSLAStatus(deadline);
                            const missingArtifacts = extractMissingArtifacts(blockers);
                            const isExpanded = expandedReasoningCards[item.submissionId];
                            const previousVersionId = item.projectMetadata?.previousVersionId;
                            const userId = (item.userId && item.userId !== 'null') ? item.userId : "Unknown User";

                            return (
                                <View
                                    key={item.submissionId}
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor: theme.mode === 'dark' ? '#232F3E' : theme.colors.surface,
                                            borderColor: theme.colors.border
                                        }
                                    ]}
                                >
                                    <View style={styles.cardInfo}>
                                        {/* Project Header */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, fontSize: 20 }}>
                                                    {projectName}
                                                </Text>
                                                <View style={styles.metaRow}>
                                                    <View style={[styles.badge, { backgroundColor: getRiskColor(item.projectMetadata?.riskLevel, theme) }]}>
                                                        <Text style={styles.badgeText}>{item.projectMetadata?.riskLevel || "Low"} Risk</Text>
                                                    </View>
                                                    <View style={[styles.badge, { backgroundColor: getStatusColor(status, theme), marginLeft: 8 }]}>
                                                        <Text style={styles.badgeText}>{status}</Text>
                                                    </View>
                                                    <View style={[styles.badge, { backgroundColor: theme.colors.primary, marginLeft: 8 }]}>
                                                        <Text style={styles.badgeText}>{currentStage}</Text>
                                                    </View>
                                                    <View style={[styles.badge, { backgroundColor: '#6c757d', marginLeft: 8 }]}>
                                                        <Text style={styles.badgeText}>{path}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* SLA Health Indicator */}
                                            {slaStatus.daysRemaining !== null && (
                                                <View style={{ alignItems: 'flex-end', marginLeft: 16 }}>
                                                    <View style={[styles.slaIndicator, { backgroundColor: slaStatus.color }]}>
                                                        <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>
                                                            {slaStatus.daysRemaining}
                                                        </Text>
                                                        <Text style={{ color: '#FFF', fontSize: 10 }}>
                                                            {slaStatus.daysRemaining === 1 ? 'DAY' : 'DAYS'}
                                                        </Text>
                                                    </View>
                                                    <Text style={{ fontSize: 10, color: slaStatus.color, fontWeight: '700', marginTop: 4 }}>
                                                        {slaStatus.status === 'breached' ? 'SLA BREACHED' :
                                                            slaStatus.status === 'warning' ? 'URGENT' : 'ON TRACK'}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* User & Submission Info */}
                                        <View style={{ marginTop: 12, padding: 10, backgroundColor: theme.colors.background, borderRadius: 6 }}>
                                            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                                                <Text style={{ fontWeight: '700' }}>Submitted by:</Text> {userId} |
                                                <Text style={{ fontWeight: '700' }}> ID:</Text> {item.submissionId} |
                                                <Text style={{ fontWeight: '700' }}> Deadline:</Text> {deadline || 'TBD'}
                                            </Text>
                                        </View>

                                        {/* Project Description */}
                                        {description && (
                                            <View style={{ marginTop: 12, padding: 12, backgroundColor: theme.colors.background, borderRadius: 6, borderLeftWidth: 4, borderLeftColor: theme.colors.primary }}>
                                                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: 6 }}>
                                                    📋 PROJECT DESCRIPTION
                                                </Text>
                                                <Text style={{ ...theme.typography.caption, color: theme.colors.textPrimary, lineHeight: 18 }}>
                                                    {description}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Agent Reasoning - Expandable */}
                                        {!!agentMessage && (
                                            <View style={{ marginTop: 12 }}>
                                                <TouchableOpacity
                                                    onPress={() => toggleReasoningExpansion(item.submissionId)}
                                                    style={{
                                                        padding: 12,
                                                        backgroundColor: 'rgba(255, 165, 0, 0.1)',
                                                        borderRadius: 6,
                                                        borderLeftWidth: 4,
                                                        borderLeftColor: theme.colors.warning
                                                    }}
                                                >
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '700' }}>
                                                            🧠 VIEW AGENT REASONING
                                                        </Text>
                                                        <Text style={{ color: theme.colors.warning, fontSize: 18, fontWeight: '700' }}>
                                                            {isExpanded ? '−' : '+'}
                                                        </Text>
                                                    </View>
                                                    {isExpanded && (
                                                        <View style={{ marginTop: 12 }}>
                                                            <Text style={{ ...theme.typography.caption, color: theme.colors.textPrimary, lineHeight: 18, marginBottom: 8 }}>
                                                                {agentMessage}
                                                            </Text>

                                                            {/* Chain of Thought Summary */}
                                                            <View style={{ marginTop: 8, padding: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4 }}>
                                                                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: 4 }}>
                                                                    💭 DECISION LOGIC
                                                                </Text>
                                                                <Text style={{ ...theme.typography.caption, color: theme.colors.textPrimary, fontSize: 11, lineHeight: 16 }}>
                                                                    • Risk Agent: Flagged {item.projectMetadata?.riskLevel || 'Low'} Risk due to project scope and data sensitivity{'\n'}
                                                                    • Librarian: Identified {missingArtifacts.length} missing mandatory artifacts{'\n'}
                                                                    • Gatekeeper: Requires {path === 'Accelerator' ? 'expedited' : 'standard'} review path
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* Missing Artifacts Checklist */}
                                        {missingArtifacts.length > 0 && (
                                            <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(255, 0, 0, 0.05)', borderRadius: 6, borderLeftWidth: 4, borderLeftColor: theme.colors.error }}>
                                                <Text style={{ ...theme.typography.caption, color: theme.colors.error, fontWeight: '700', marginBottom: 8 }}>
                                                    ⚠️ MISSING MANDATORY ARTIFACTS ({missingArtifacts.length})
                                                </Text>
                                                {missingArtifacts.map((artifact, i) => (
                                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                        <Text style={{ color: theme.colors.error, marginRight: 8 }}>☐</Text>
                                                        <Text style={{ ...theme.typography.caption, color: theme.colors.textPrimary }}>
                                                            {artifact}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {/* Workflow Timeline */}
                                        <View style={{ marginTop: 16 }}>
                                            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>
                                                📊 WORKFLOW PROGRESS
                                            </Text>
                                            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontSize: 10, marginBottom: 12, fontStyle: 'italic' }}>
                                                💡 Click on any stage to view detailed LLM reasoning
                                            </Text>
                                            <Timeline
                                                currentStage={currentStage}
                                                theme={theme}
                                                reasoningUrls={reasoningUrls}
                                                onStageClick={handleStageClick}
                                            />
                                        </View>

                                        {/* General Blockers */}
                                        {blockers.length > 0 && (
                                            <View style={styles.blockerSection}>
                                                <Text style={{ ...theme.typography.caption, color: theme.colors.error, fontWeight: '700', marginBottom: 6 }}>
                                                    🚫 BLOCKERS ({blockers.length})
                                                </Text>
                                                {blockers.map((b, i) => (
                                                    <Text key={i} style={{ ...theme.typography.caption, color: theme.colors.textPrimary, marginTop: 4 }}>
                                                        • {b}
                                                    </Text>
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={styles.actions}>
                                        {!!previousVersionId && (
                                            <TouchableOpacity
                                                style={[styles.btn, { backgroundColor: '#6c757d', marginRight: 12 }]}
                                                onPress={() => handleViewDelta(item)}
                                            >
                                                <Text style={styles.btnText}>📊 VIEW DELTA</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            style={[styles.btn, { backgroundColor: theme.colors.success }]}
                                            onPress={() => handleApprove(item)}
                                        >
                                            <Text style={styles.btnText}>✅ APPROVE</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.btn, { backgroundColor: theme.colors.error, marginLeft: 12 }]}
                                            onPress={() => handleRequestInfo(item)}
                                        >
                                            <Text style={styles.btnText}>📨 REQUEST INFO</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Reasoning Modal */}
                <Modal
                    visible={selectedReasoning !== null}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setSelectedReasoning(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                            <View style={styles.modalHeader}>
                                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, fontSize: 18 }}>
                                    🧠 {selectedReasoning} Stage - LLM Chain of Thought
                                </Text>
                                <TouchableOpacity onPress={() => setSelectedReasoning(null)}>
                                    <Text style={{ color: theme.colors.error, fontSize: 28, fontWeight: '700' }}>×</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody}>
                                {loadingReasoning ? (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <ActivityIndicator size="large" color={theme.colors.primary} />
                                        <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>Loading reasoning...</Text>
                                    </View>
                                ) : (
                                    <Text style={{ ...theme.typography.caption, color: theme.colors.textPrimary, lineHeight: 20, fontFamily: 'monospace' }}>
                                        {reasoningContent}
                                    </Text>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* Request Info Modal */}
                <Modal
                    visible={requestInfoModal !== null}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setRequestInfoModal(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, maxHeight: '60%' }]}>
                            <View style={styles.modalHeader}>
                                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, fontSize: 18 }}>
                                    📨 Request Additional Information
                                </Text>
                                <TouchableOpacity onPress={() => setRequestInfoModal(null)}>
                                    <Text style={{ color: theme.colors.error, fontSize: 28, fontWeight: '700' }}>×</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ padding: 16 }}>
                                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 12 }}>
                                    Enter your feedback message. This will be displayed on the user's Support Status screen.
                                </Text>
                                <TextInput
                                    style={[styles.textArea, {
                                        backgroundColor: theme.colors.background,
                                        color: theme.colors.textPrimary,
                                        borderColor: theme.colors.border
                                    }]}
                                    multiline
                                    numberOfLines={6}
                                    value={feedbackMessage}
                                    onChangeText={setFeedbackMessage}
                                    placeholder="e.g., Please provide a detailed DataFlowDiagram showing how PII data flows through your system..."
                                    placeholderTextColor={theme.colors.textSecondary}
                                />

                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                                    <TouchableOpacity
                                        style={[styles.btn, { backgroundColor: '#6c757d', marginRight: 12 }]}
                                        onPress={() => setRequestInfoModal(null)}
                                    >
                                        <Text style={styles.btnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.btn, { backgroundColor: theme.colors.primary }]}
                                        onPress={submitRequestInfo}
                                    >
                                        <Text style={styles.btnText}>Send Request</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Delta Comparison Modal */}
                <Modal
                    visible={deltaModal !== null}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setDeltaModal(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                            <View style={styles.modalHeader}>
                                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, fontSize: 18 }}>
                                    📊 Incremental Changes (Delta View)
                                </Text>
                                <TouchableOpacity onPress={() => setDeltaModal(null)}>
                                    <Text style={{ color: theme.colors.error, fontSize: 28, fontWeight: '700' }}>×</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody}>
                                <View style={{ padding: 16 }}>
                                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 16 }}>
                                        Comparing current version with: {deltaModal?.projectMetadata?.previousVersionId || 'N/A'}
                                    </Text>

                                    {loadingDelta ? (
                                        <View style={{ padding: 40, alignItems: 'center' }}>
                                            <ActivityIndicator size="large" color={theme.colors.primary} />
                                            <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>Analysing changes...</Text>
                                        </View>
                                    ) : deltaDetails ? (
                                        <View style={{ padding: 12, backgroundColor: 'rgba(0, 123, 255, 0.1)', borderRadius: 6, borderLeftWidth: 4, borderLeftColor: '#007bff' }}>
                                            <Text style={{ ...theme.typography.caption, color: theme.colors.textPrimary, fontWeight: '700', marginBottom: 8 }}>
                                                📈 DELTA ANALYSIS
                                            </Text>
                                            <Text style={{ ...theme.typography.caption, color: theme.colors.textPrimary, lineHeight: 18, fontFamily: 'monospace' }}>
                                                {deltaDetails.formattedOutput || "No visual diff available."}
                                            </Text>
                                            <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' }}>
                                                <Text style={{ ...theme.typography.caption, color: deltaDetails.deltaDetails?.deltaPercentage > 15 ? theme.colors.error : theme.colors.success, fontWeight: '700' }}>
                                                    {deltaDetails.deltaDetails?.deltaPercentage > 15 ? '⚠️' : '✅'} Total Delta: {deltaDetails.deltaDetails?.deltaPercentage}%
                                                    {deltaDetails.deltaDetails?.deltaPercentage > 15 ? ' (Exceeds 15% threshold)' : ' (Within threshold)'}
                                                </Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <Text style={{ color: theme.colors.error }}>Failed to load delta details.</Text>
                                    )}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </View>
        </ResponsiveWrapper>
    );
};

const Timeline = ({ currentStage, theme, reasoningUrls, onStageClick }) => {
    const stages = [
        { name: 'Intake', key: 'Intake' },
        { name: 'POC', key: 'POC' },
        { name: 'Pilot', key: 'Pilot' },
        { name: 'Risk', key: 'Risk' },
        { name: 'GIGC', key: 'Gatekeeper' },
        { name: 'Prod', key: 'Production' },
        { name: 'Live', key: 'Handover' }
    ];

    let currentIndex = stages.findIndex(s => s.key === currentStage);

    if (currentIndex === -1) {
        currentIndex = stages.findIndex(s => s.name.toLowerCase() === currentStage.toLowerCase());
    }

    if (currentIndex === -1) {
        console.log(`Timeline: Stage "${currentStage}" not found, defaulting to Intake`);
        currentIndex = 0;
    }

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            {stages.map((stage, index) => {
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;

                return (
                    <React.Fragment key={stage.key}>
                        <TouchableOpacity
                            style={{ alignItems: 'center', minWidth: 50 }}
                            onPress={() => onStageClick(stage.name, reasoningUrls)}
                        >
                            <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: isActive
                                    ? theme.colors.primary
                                    : isCompleted
                                        ? theme.colors.success
                                        : theme.colors.border,
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: isActive ? 3 : 0,
                                borderColor: theme.colors.accent,
                                shadowColor: isActive ? theme.colors.primary : 'transparent',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: isActive ? 4 : 0
                            }}>
                                <Text style={{
                                    color: isActive || isCompleted ? '#FFF' : theme.colors.textSecondary,
                                    fontSize: 12,
                                    fontWeight: '700'
                                }}>
                                    {isCompleted ? '✓' : index + 1}
                                </Text>
                            </View>
                            <Text style={{
                                fontSize: 10,
                                marginTop: 6,
                                color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                                fontWeight: isActive ? '700' : '400',
                                textAlign: 'center'
                            }}>
                                {stage.name}
                            </Text>
                        </TouchableOpacity>
                        {index < stages.length - 1 && (
                            <View style={{
                                flex: 1,
                                height: 3,
                                backgroundColor: isCompleted ? theme.colors.success : theme.colors.border,
                                marginHorizontal: 4,
                                marginBottom: 24,
                                borderRadius: 2
                            }} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
};

const getRiskColor = (level, theme) => {
    switch (level) {
        case 'High': return theme.colors.error;
        case 'Med': return theme.colors.warning;
        default: return theme.colors.success;
    }
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
        case 'In-Review':
        case 'InReview':
        case 'Draft':
            return '#007bff';
        case 'Pending':
            return theme.colors.warning;
        case 'Pilot-Active':
            return theme.colors.accent;
        default: return '#6c757d';
    }
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 20,
        maxWidth: 1200,
        width: '100%',
        alignSelf: 'center'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 2,
        borderBottomColor: '#e0e0e0'
    },
    refresh: {
        padding: 12,
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        borderRadius: 8
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    empty: {
        padding: 60,
        alignItems: 'center',
        backgroundColor: 'rgba(40, 167, 69, 0.05)',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#28a745',
        borderStyle: 'dashed'
    },
    card: {
        padding: 24,
        borderRadius: 12,
        borderWidth: 2,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4
    },
    cardInfo: {
        flex: 1,
        marginBottom: 20
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        flexWrap: 'wrap'
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 4
    },
    badgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700'
    },
    slaIndicator: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3
    },
    blockerSection: {
        marginTop: 12,
        padding: 14,
        backgroundColor: 'rgba(255,0,0,0.05)',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#dc3545'
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        marginTop: 8
    },
    btn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 140,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2
    },
    btnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 13
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        width: '95%',
        maxWidth: 900,
        maxHeight: '85%',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 2,
        borderBottomColor: '#e0e0e0'
    },
    modalBody: {
        flex: 1
    },
    textArea: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        minHeight: 120,
        textAlignVertical: 'top'
    }
});

export default AdminQueue;

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import { useAiguState } from '../hooks/useAiguState';
import WorkflowProgress from '../components/WorkflowProgress';
import SupportAgent from '../components/SupportAgent';
import PromptManager from '../components/PromptManager';
import FileManager from '../components/FileManager';
import AgentCommandCenter from '../components/AgentCommandCenter';
import { getShadow } from '../utils/shadows';
import MarkdownText from '../components/MarkdownText';

/**
 * AdminDashboard Component - Desktop-Optimized Admin Interface
 * 
 * Matches the user dashboard style with:
 * - Left Sidebar: Queue filters and stats
 * - Center Panel: Project queue with details
 * - Right Sidebar: Support chat for asking questions about submissions
 */
const AdminDashboard = ({ userId, onLogout }) => {
    const { theme } = useAiguTheme();

    // Use real state hook for admin actions
    const { actions } = useAiguState('temp', userId);
    const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'prompts'

    // Queue Management
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');

    // Modals & Actions
    const [requestInfoModal, setRequestInfoModal] = useState(null);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [deltaModal, setDeltaModal] = useState(null);
    const [deltaDetails, setDeltaDetails] = useState(null);
    const [loadingDelta, setLoadingDelta] = useState(false);
    const [supportPanelOpen, setSupportPanelOpen] = useState(true);
    const [reasoningPanel, setReasoningPanel] = useState(true);

    useEffect(() => {
        refreshQueue();
    }, []);

    const refreshQueue = async () => {
        setLoading(true);
        const data = await actions.fetchAdminQueue();
        setQueue(data);

        // Auto-select first item if none selected
        if (data.length > 0 && !selectedProject) {
            setSelectedProject(data[0]);
        }
        setLoading(false);
    };

    const handleApprove = async (item) => {
        Alert.alert(
            "Confirm Approval",
            `Approve "${item.projectMetadata?.name || item.submissionId}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Approve",
                    onPress: async () => {
                        const success = await actions.adminAction(item.submissionId, item.userId, "ADMIN_APPROVE");
                        if (success) {
                            Alert.alert("✅ Approved", "Project approved and will proceed.");
                            refreshQueue();
                        } else {
                            Alert.alert("Error", "Failed to approve project.");
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

        const success = await actions.adminAction(
            requestInfoModal.submissionId,
            requestInfoModal.userId,
            "ADMIN_REQUEST_INFO",
            feedbackMessage
        );

        if (success) {
            Alert.alert("📨 Info Requested", "User has been notified.");
            setRequestInfoModal(null);
            setFeedbackMessage('');
            refreshQueue();
        } else {
            Alert.alert("Error", "Failed to send request.");
        }
    };

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

    const handleDelete = (item) => {
        // Use window.confirm for web compatibility instead of Alert.alert
        const confirmed = window.confirm(
            `⚠️ Confirm Deletion\n\nAre you sure you want to permanently delete "${item.projectMetadata?.name || item.submissionId}"?\n\nThis action cannot be undone.`
        );

        if (confirmed) {
            (async () => {
                try {
                    console.log(`Attempting to delete project: ${item.submissionId} for user: ${item.userId}`);
                    const success = await actions.deleteProject(item.submissionId, item.userId);
                    if (success) {
                        window.alert("✅ Deleted\n\nProject has been permanently removed.");
                        // Clear selection if deleted project was selected
                        if (selectedProject?.submissionId === item.submissionId) {
                            setSelectedProject(null);
                        }
                        refreshQueue();
                    } else {
                        window.alert("❌ Error\n\nFailed to delete project.");
                    }
                } catch (error) {
                    console.error("Delete failed:", error);
                    window.alert("❌ Error\n\nFailed to delete project: " + error.message);
                }
            })();
        }
    };

    // Filter queue
    const filteredQueue = queue.filter(item => {
        const matchesSearch = item.projectMetadata?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.submissionId.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === 'All' || item.governance?.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    // Get queue stats
    const stats = {
        total: queue.length,
        pending: queue.filter(q => q.governance?.status === 'In-Review' || q.governance?.status === 'Pending').length,
        blocked: queue.filter(q => q.governance?.status === 'Blocked').length,
        approved: queue.filter(q => q.governance?.status === 'Approved').length
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved': return theme.colors.success;
            case 'Blocked': return theme.colors.error;
            case 'In-Review':
            case 'Pending': return theme.colors.warning;
            case 'Draft': return theme.colors.primary;
            default: return theme.colors.textSecondary;
        }
    };

    const renderRightPanel = () => {
        if (!selectedProject) {
            return (
                <View style={styles.emptyPanel}>
                    <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary }}>
                        Select a project to view details
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView style={{ flex: 1, padding: 20 }}>
                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, marginBottom: 8 }}>
                    {selectedProject.projectMetadata?.name || 'Untitled Project'}
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 20 }}>
                    {selectedProject.submissionId}
                </Text>

                {/* Agent Reasoning */}
                {!!selectedProject.ui_overlay?.supportMessage && (
                    <View style={{
                        padding: 16,
                        backgroundColor: 'rgba(255, 165, 0, 0.1)',
                        borderRadius: 8,
                        borderLeftWidth: 4,
                        borderLeftColor: theme.colors.warning,
                        marginBottom: 24
                    }}>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>
                            🧠 AGENT REASONING & GUIDANCE
                        </Text>
                        <MarkdownText style={{ ...theme.typography.body, color: theme.colors.textPrimary, lineHeight: 20 }}>
                            {selectedProject.ui_overlay.supportMessage}
                        </MarkdownText>
                    </View>
                )}

                {/* Quick Actions */}
                <View style={styles.actionSection}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, marginBottom: 12 }}>
                        Quick Actions
                    </Text>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
                        onPress={() => handleApprove(selectedProject)}
                    >
                        <Text style={{ color: '#FFF', fontWeight: '700' }}>✓ APPROVE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.colors.warning, marginTop: 8 }]}
                        onPress={() => handleRequestInfo(selectedProject)}
                    >
                        <Text style={{ color: '#FFF', fontWeight: '700' }}>📨 REQUEST INFO</Text>
                    </TouchableOpacity>
                    {selectedProject.projectMetadata?.previousVersionId && (
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.accent, marginTop: 8 }]}
                            onPress={() => handleViewDelta(selectedProject)}
                        >
                            <Text style={{ color: '#FFF', fontWeight: '700' }}>📊 VIEW DELTA</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.colors.error, marginTop: 8 }]}
                        onPress={() => handleDelete(selectedProject)}
                    >
                        <Text style={{ color: '#FFF', fontWeight: '700' }}>🗑️ DELETE</Text>
                    </TouchableOpacity>
                </View>

                {/* Project Details */}
                <View style={{ marginTop: 24 }}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, marginBottom: 12 }}>
                        Project Details
                    </Text>
                    <DetailRow label="User" value={selectedProject.userId} theme={theme} />
                    <DetailRow label="Stage" value={selectedProject.projectMetadata?.currentStage || 'Intake'} theme={theme} />
                    <DetailRow label="Risk Level" value={selectedProject.projectMetadata?.riskLevel || 'Low'} theme={theme} />
                    <DetailRow label="Path" value={selectedProject.projectMetadata?.path || 'Standard'} theme={theme} />
                </View>

                {/* Blockers */}
                {selectedProject.governance?.blockers?.length > 0 && (
                    <View style={{ marginTop: 24 }}>
                        <Text style={{ ...theme.typography.subheader, color: theme.colors.error, marginBottom: 12 }}>
                            ⚠️ Blockers
                        </Text>
                        {selectedProject.governance.blockers.map((blocker, i) => (
                            <Text key={i} style={{ ...theme.typography.body, color: theme.colors.textPrimary, marginBottom: 6 }}>
                                • {blocker}
                            </Text>
                        ))}
                    </View>
                )}

                {/* Workflow */}
                <View style={{ marginTop: 24 }}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, marginBottom: 12 }}>
                        Workflow Progress
                    </Text>
                    <WorkflowProgress state={selectedProject} />
                </View>

                {/* Attachments */}
                <View style={{ marginTop: 24, paddingBottom: 40 }}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, marginBottom: 12 }}>
                        📎 Project Attachments
                    </Text>
                    <FileManager
                        submissionId={selectedProject.submissionId}
                        userId={selectedProject.userId}
                        actions={actions}
                    />
                </View>
            </ScrollView>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Left Sidebar - Filters & Stats */}
            <View style={[styles.sidebar, { backgroundColor: theme.colors.surface, borderRightColor: theme.colors.border }]}>
                <View style={styles.sidebarHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, overflow: 'hidden' }}>
                        <TouchableOpacity onPress={() => setActiveTab('queue')} style={{ marginRight: 10 }}>
                            <Text style={{
                                ...theme.typography.header,
                                color: activeTab === 'queue' ? theme.colors.primary : theme.colors.textSecondary,
                                fontSize: 18
                            }}>
                                Queue
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActiveTab('prompts')} style={{ marginRight: 10 }}>
                            <Text style={{
                                ...theme.typography.header,
                                color: activeTab === 'prompts' ? theme.colors.primary : theme.colors.textSecondary,
                                fontSize: 18
                            }}>
                                Prompts
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActiveTab('config')} style={{ minWidth: 70 }}>
                            <Text
                                numberOfLines={1}
                                style={{
                                    ...theme.typography.header,
                                    color: activeTab === 'config' ? theme.colors.primary : theme.colors.textSecondary,
                                    fontSize: 16
                                }}
                            >
                                Command
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={refreshQueue}>
                        <Text style={{ color: theme.colors.accent, fontSize: 20 }}>↻</Text>
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                    <StatCard label="Total" value={stats.total} color={theme.colors.primary} theme={theme} />
                    <StatCard label="Pending" value={stats.pending} color={theme.colors.warning} theme={theme} />
                    <StatCard label="Blocked" value={stats.blocked} color={theme.colors.error} theme={theme} />
                    <StatCard label="Approved" value={stats.approved} color={theme.colors.success} theme={theme} />
                </View>

                {/* Search */}
                <TextInput
                    style={[styles.searchInput, {
                        backgroundColor: theme.colors.background,
                        color: theme.colors.textPrimary,
                        borderColor: theme.colors.border
                    }]}
                    placeholder="Search projects..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                {/* Filter Buttons */}
                <View style={styles.filterContainer}>
                    {['All', 'In-Review', 'Blocked', 'Approved'].map(filter => (
                        <TouchableOpacity
                            key={filter}
                            style={[
                                styles.filterButton,
                                {
                                    backgroundColor: filterStatus === filter ? theme.colors.primary : 'transparent',
                                    borderColor: theme.colors.border
                                }
                            ]}
                            onPress={() => setFilterStatus(filter)}
                        >
                            <Text style={{
                                color: filterStatus === filter ? '#FFF' : theme.colors.textPrimary,
                                fontSize: 11,
                                fontWeight: '600'
                            }}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Queue List */}
                <ScrollView style={{ flex: 1 }}>
                    {loading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 20 }} />
                    ) : (
                        filteredQueue.map((item) => (
                            <TouchableOpacity
                                key={item.submissionId}
                                style={[
                                    styles.queueCard,
                                    {
                                        backgroundColor: selectedProject?.submissionId === item.submissionId
                                            ? theme.colors.primary + '20'
                                            : 'transparent',
                                        borderLeftColor: selectedProject?.submissionId === item.submissionId
                                            ? theme.colors.primary
                                            : 'transparent'
                                    }
                                ]}
                                onPress={() => setSelectedProject(item)}
                            >
                                <Text style={{
                                    ...theme.typography.body,
                                    color: theme.colors.textPrimary,
                                    fontWeight: selectedProject?.submissionId === item.submissionId ? '700' : '500'
                                }} numberOfLines={1}>
                                    {item.projectMetadata?.name || item.submissionId}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <View style={[styles.miniStatusDot, {
                                        backgroundColor: getStatusColor(item.governance?.status)
                                    }]} />
                                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontSize: 10 }}>
                                        {item.governance?.status || 'Draft'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>

                {/* Footer */}
                <View style={styles.sidebarFooter}>
                    <View style={[styles.userBadge, { backgroundColor: theme.colors.background }]}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: 11, fontWeight: '700' }}>
                            {userId}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onLogout}>
                        <Text style={{ color: theme.colors.error, fontSize: 11, fontWeight: '700' }}>LOGOUT</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Center/Right Panel - Project Details */}
            {/* Center/Right Panel - Project Details or Prompts */}
            <View style={styles.mainContent}>
                {activeTab === 'prompts' ? (
                    <PromptManager userId={userId} />
                ) : activeTab === 'config' ? (
                    <AgentCommandCenter actions={actions} />
                ) : (
                    renderRightPanel()
                )}
            </View>

            {/* Request Info Modal */}
            {requestInfoModal && (
                <Modal transparent visible={!!requestInfoModal} animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                            <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, marginBottom: 16 }}>
                                Request Additional Information
                            </Text>
                            <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary, marginBottom: 12 }}>
                                Project: {requestInfoModal.projectMetadata?.name || requestInfoModal.submissionId}
                            </Text>
                            <TextInput
                                style={[styles.feedbackInput, {
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.textPrimary,
                                    borderColor: theme.colors.border
                                }]}
                                placeholder="Enter your feedback or questions..."
                                placeholderTextColor={theme.colors.textSecondary}
                                value={feedbackMessage}
                                onChangeText={setFeedbackMessage}
                                multiline
                                numberOfLines={4}
                            />
                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.modalButton, { backgroundColor: theme.colors.border }]}
                                    onPress={() => setRequestInfoModal(null)}
                                >
                                    <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                                    onPress={submitRequestInfo}
                                >
                                    <Text style={{ color: '#FFF', fontWeight: '700' }}>Send Request</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Delta Modal */}
            {deltaModal && (
                <Modal transparent visible={!!deltaModal} animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, maxHeight: '80%' }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary }}>
                                    Delta Analysis
                                </Text>
                                <TouchableOpacity onPress={() => setDeltaModal(null)}>
                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 24 }}>×</Text>
                                </TouchableOpacity>
                            </View>
                            {loadingDelta ? (
                                <ActivityIndicator size="large" color={theme.colors.primary} />
                            ) : deltaDetails ? (
                                <ScrollView>
                                    <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary }}>
                                        {JSON.stringify(deltaDetails, null, 2)}
                                    </Text>
                                </ScrollView>
                            ) : (
                                <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary }}>
                                    No delta information available
                                </Text>
                            )}
                        </View>
                    </View>
                </Modal>
            )}

            {/* Right Sidebar - Support Agent */}
            {supportPanelOpen && selectedProject && (
                <View style={[styles.supportSidebar, {
                    backgroundColor: theme.colors.surface,
                    borderLeftColor: theme.colors.border
                }]}>
                    <SupportAgent
                        state={selectedProject}
                        onClose={() => setSupportPanelOpen(false)}
                    />
                </View>
            )}

            {!supportPanelOpen && (
                <TouchableOpacity
                    style={[styles.supportToggle, { backgroundColor: theme.colors.primary }]}
                    onPress={() => setSupportPanelOpen(true)}
                >
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 18 }}>💬</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

// Helper Components
const StatCard = ({ label, value, color, theme }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.textPrimary }}>{value}</Text>
        <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
);

const DetailRow = ({ label, value, theme }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>{label}:</Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary, fontWeight: '600' }}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row'
    },
    sidebar: {
        width: 280,
        borderRightWidth: 1,
        flexDirection: 'column'
    },
    sidebarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 12
    },
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 8
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        backgroundColor: 'rgba(0,0,0,0.02)'
    },
    searchInput: {
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        fontSize: 13
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 12,
        gap: 6
    },
    filterButton: {
        flex: 1,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center'
    },
    queueCard: {
        padding: 12,
        marginHorizontal: 8,
        marginVertical: 4,
        borderRadius: 6,
        borderLeftWidth: 3
    },
    miniStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 4
    },
    sidebarFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    userBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12
    },
    mainContent: {
        flex: 1
    },
    emptyPanel: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    actionSection: {
        marginTop: 20
    },
    actionButton: {
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        width: '90%',
        maxWidth: 500,
        padding: 24,
        borderRadius: 16,
        borderWidth: 1
    },
    feedbackInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        minHeight: 100,
        textAlignVertical: 'top'
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12
    },
    modalButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8
    },
    supportSidebar: {
        width: 360,
        borderLeftWidth: 1
    },
    supportToggle: {
        position: 'absolute',
        right: 0,
        top: '50%',
        width: 48,
        height: 48,
        borderTopLeftRadius: 24,
        borderBottomLeftRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        ...getShadow('#000', { width: -2, height: 0 }, 0.2, 4, 4)
    }
});

export default AdminDashboard;

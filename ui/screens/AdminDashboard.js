import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, useWindowDimensions, Platform } from 'react-native';
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
 * AdminDashboard Component - Responsive Admin Interface
 * 
 * "Cosmic Glass" Redesign:
 * - Top Navigation for Mobile
 * - Collapsible Sidebar for Tablet/Desktop
 * - Glassmorphism cards and panels
 */
const AdminDashboard = ({ userId, onLogout }) => {
    const { theme } = useAiguTheme();
    const { width } = useWindowDimensions();
    const isMobile = width < 768; // Tablet breakpoint
    const isLargeScreen = width > 1440; // 4k/Large Desktop

    // Use real state hook for admin actions
    const { actions } = useAiguState('temp', userId);
    const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'prompts'

    // Queue Management
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');

    // UI State
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

    useEffect(() => {
        setSidebarOpen(!isMobile);
    }, [isMobile]);

    // Modals & Actions
    const [requestInfoModal, setRequestInfoModal] = useState(null);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [deltaModal, setDeltaModal] = useState(null);
    const [deltaDetails, setDeltaDetails] = useState(null);
    const [loadingDelta, setLoadingDelta] = useState(false);
    const [supportPanelOpen, setSupportPanelOpen] = useState(!isMobile);

    useEffect(() => {
        refreshQueue();
    }, []);

    const refreshQueue = async () => {
        setLoading(true);
        const data = await actions.fetchAdminQueue();
        setQueue(data);

        // Auto-select first item if none selected and on desktop
        if (data.length > 0 && !selectedProject && !isMobile) {
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
            <View style={{ flex: 1, flexDirection: isLargeScreen ? 'row' : 'column', gap: 32, padding: isMobile ? 12 : 32 }}>

                {isMobile && (
                    <TouchableOpacity onPress={() => setSelectedProject(null)} style={{ marginBottom: 12 }}>
                        <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>← Back to Queue</Text>
                    </TouchableOpacity>
                )}

                {/* Main Feed - SCROLLABLE */}
                <ScrollView style={{ flex: 2 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, marginBottom: 8, fontSize: isLargeScreen ? 32 : 24 }}>
                        {selectedProject.projectMetadata?.name || 'Untitled Project'}
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 20 }}>
                        {selectedProject.submissionId}
                    </Text>

                    {/* Agent Reasoning */}
                    {(selectedProject.ui_overlay?.adminAnalysis || selectedProject.ui_overlay?.supportMessage) && (
                        <View style={{
                            padding: 20,
                            backgroundColor: theme.colors.surface,
                            ...theme.glass,
                            borderRadius: 12,
                            borderLeftWidth: 4,
                            borderLeftColor: selectedProject.ui_overlay?.adminAnalysis ? theme.colors.accent : theme.colors.warning,
                            marginBottom: 24
                        }}>
                            <Text style={{
                                ...theme.typography.caption,
                                color: selectedProject.ui_overlay?.adminAnalysis ? theme.colors.accent : theme.colors.warning,
                                fontWeight: '700',
                                marginBottom: 8,
                                letterSpacing: 1.2
                            }}>
                                {selectedProject.ui_overlay?.adminAnalysis ? '🔍 SME / ADMIN ANALYSIS' : '🧠 AIGU ANALYSIS'}
                            </Text>
                            <MarkdownText style={{ ...theme.typography.body, color: theme.colors.textPrimary, lineHeight: 24 }}>
                                {selectedProject.ui_overlay?.adminAnalysis || selectedProject.ui_overlay?.supportMessage}
                            </MarkdownText>
                        </View>
                    )}

                    {/* Project Details */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, marginBottom: 16 }}>
                            Project Details
                        </Text>
                        <View style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 12,
                            backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
                            padding: 16,
                            borderRadius: 12
                        }}>
                            <DetailBadge label="User" value={selectedProject.userId} theme={theme} />
                            <DetailBadge label="Stage" value={selectedProject.projectMetadata?.currentStage || 'Intake'} theme={theme} />
                            <DetailBadge label="Risk" value={selectedProject.projectMetadata?.riskLevel || 'Low'} theme={theme} />
                            <DetailBadge label="Path" value={selectedProject.projectMetadata?.path || 'Standard'} theme={theme} />
                        </View>
                    </View>

                    {/* Attachments */}
                    <View style={{ marginBottom: 40 }}>
                        <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, marginBottom: 12 }}>
                            📎 Project Attachments
                        </Text>
                        <FileManager
                            submissionId={selectedProject.submissionId}
                            userId={selectedProject.userId}
                            actions={actions}
                        />
                    </View>

                    {/* Workflow */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, marginBottom: 12 }}>
                            Workflow Progress
                        </Text>
                        <WorkflowProgress state={selectedProject} />
                    </View>
                </ScrollView>

                {/* Right Info Column (Desktop) - FIXED / INDEPENDENT SCROLL */}
                <View style={{ flex: 1, minWidth: isLargeScreen ? 300 : '100%' }}>

                    {/* Quick Actions */}
                    <View style={[styles.glassPanel, theme.glass, { padding: 20, marginBottom: 24, borderRadius: 12 }]}>
                        <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, marginBottom: 12 }}>
                            Actions
                        </Text>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.success + 'CC' }]}
                            onPress={() => handleApprove(selectedProject)}
                        >
                            <Text style={{ color: '#FFF', fontWeight: '700' }}>✓ APPROVE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.warning + 'CC', marginTop: 8 }]}
                            onPress={() => handleRequestInfo(selectedProject)}
                        >
                            <Text style={{ color: '#FFF', fontWeight: '700' }}>📨 REQUEST INFO</Text>
                        </TouchableOpacity>
                        {selectedProject.projectMetadata?.previousVersionId && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: theme.colors.accent + 'CC', marginTop: 8 }]}
                                onPress={() => handleViewDelta(selectedProject)}
                            >
                                <Text style={{ color: '#FFF', fontWeight: '700' }}>📊 VIEW DELTA</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.error + 'CC', marginTop: 8 }]}
                            onPress={() => handleDelete(selectedProject)}
                        >
                            <Text style={{ color: '#FFF', fontWeight: '700' }}>🗑️ DELETE</Text>
                        </TouchableOpacity>
                    </View>


                    {/* Blockers */}
                    {selectedProject.governance?.blockers?.length > 0 && (
                        <View style={{ marginTop: 24 }}>
                            <Text style={{ ...theme.typography.subheader, color: theme.colors.error, marginBottom: 12 }}>
                                ⚠️ Blockers
                            </Text>
                            {selectedProject.governance.blockers.map((blocker, i) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={{ color: theme.colors.error, marginRight: 8 }}>•</Text>
                                    <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary }}>
                                        {blocker}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Support Agent Chat (Embedded) */}
                    <View style={{ marginTop: 24, flex: 1, ...theme.glass, borderRadius: 12, overflow: 'hidden' }}>
                        <SupportAgent
                            state={selectedProject}
                            onClose={() => { }} // No close needed for embedded view
                        />
                    </View>

                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

            {/* Mobile Sidebar Toggle */}
            {isMobile && (
                <View style={[styles.mobileHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity onPress={() => setSidebarOpen(!sidebarOpen)} style={{ padding: 8 }}>
                        <Text style={{ fontSize: 24, color: theme.colors.primary }}>☰</Text>
                    </TouchableOpacity>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary }}>AIGU Admin</Text>
                    <View style={{ width: 40 }} />
                </View>
            )}

            {/* Main Layout */}
            <View style={{ flex: 1, flexDirection: 'row' }}>

                {/* Left Sidebar - Filters & Stats */}
                {/* Conditionally rendered or overlay on mobile */}
                {(sidebarOpen || !isMobile) && (
                    <View style={[
                        styles.sidebar,
                        {
                            backgroundColor: theme.colors.surface,
                            borderRightColor: theme.colors.border,
                            width: isMobile ? '100%' : 300,
                            position: isMobile ? 'absolute' : 'relative',
                            zIndex: 100,
                            height: '100%'
                        }
                    ]}>
                        <View style={styles.sidebarHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, overflow: 'hidden' }}>
                                <TabButton
                                    label="Queue"
                                    active={activeTab === 'queue'}
                                    onPress={() => setActiveTab('queue')}
                                    theme={theme}
                                />
                                <TabButton
                                    label="Prompts"
                                    active={activeTab === 'prompts'}
                                    onPress={() => setActiveTab('prompts')}
                                    theme={theme}
                                />
                                <TabButton
                                    label="Command"
                                    active={activeTab === 'config'}
                                    onPress={() => setActiveTab('config')}
                                    theme={theme}
                                />
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
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
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
                                            color: filterStatus === filter ? theme.colors.textInverted : theme.colors.textPrimary,
                                            fontSize: 11,
                                            fontWeight: '600'
                                        }}>
                                            {filter}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

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
                                        onPress={() => {
                                            setSelectedProject(item);
                                            if (isMobile) setSidebarOpen(false);
                                        }}
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
                )}

                {/* Center/Right Panel - Project Details or Prompts */}
                {/* On mobile, only show if sidebar is closed (or overlay behavior) */}
                <View style={styles.mainContent}>
                    {(!isMobile || !sidebarOpen) && (
                        <>
                            {activeTab === 'prompts' ? (
                                <PromptManager userId={userId} />
                            ) : activeTab === 'config' ? (
                                <AgentCommandCenter actions={actions} />
                            ) : (
                                renderRightPanel()
                            )}
                        </>
                    )}
                </View>
            </View>

            {/* Request Info Modal & Delta Modal (Keep existing logic) */}
            {/* Request Info Modal */}
            {requestInfoModal && (
                <Modal transparent visible={!!requestInfoModal} animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: '#1E1E1E', borderColor: theme.colors.border }]}>
                            <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, marginBottom: 16 }}>
                                Request Additional Information
                            </Text>
                            <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary, marginBottom: 12 }}>
                                Project: {requestInfoModal.projectMetadata?.name || requestInfoModal.submissionId}
                            </Text>
                            <TextInput
                                style={[styles.feedbackInput, {
                                    backgroundColor: 'rgba(0,0,0,0.2)',
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
                                    <Text style={{ color: theme.colors.textInverted, fontWeight: '700' }}>Send Request</Text>
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

            {/* Mobile Support Toggle (Desktop is now embedded) */}
            {isMobile && !supportPanelOpen && selectedProject && (
                <TouchableOpacity
                    style={[styles.supportToggle, { backgroundColor: theme.colors.primary }]}
                    onPress={() => setSupportPanelOpen(true)}
                >
                    <Text style={{ color: theme.colors.textInverted, fontWeight: '700', fontSize: 18 }}>💬</Text>
                </TouchableOpacity>
            )}

            {/* Mobile Support Sidebar Overlay */}
            {isMobile && supportPanelOpen && selectedProject && (
                <View style={[
                    styles.supportSidebar,
                    theme.glass,
                    {
                        borderLeftColor: theme.colors.border,
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '100%',
                        zIndex: 200,
                        backgroundColor: theme.colors.background
                    }
                ]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', padding: 8 }}>
                        <TouchableOpacity onPress={() => setSupportPanelOpen(false)} style={{ padding: 8 }}>
                            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>CLOSE CHAT ✕</Text>
                        </TouchableOpacity>
                    </View>
                    <SupportAgent
                        state={selectedProject}
                        onClose={() => setSupportPanelOpen(false)}
                    />
                </View>
            )}
        </View>
    );
};

// Helper Components
const StatCard = ({ label, value, color, theme }) => (
    <View style={[styles.statCard, { borderLeftColor: color, backgroundColor: 'rgba(255,255,255,0.05)' }]}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.textPrimary }}>{value}</Text>
        <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
);

const DetailBadge = ({ label, value, theme }) => (
    <View style={{
        flexDirection: 'column',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: theme.colors.background,
        borderRadius: 8,
        minWidth: 100
    }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontSize: 10, textTransform: 'uppercase' }}>{label}</Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary, fontWeight: '600' }}>{value}</Text>
    </View>
);

const TabButton = ({ label, active, onPress, theme }) => (
    <TouchableOpacity onPress={onPress} style={{ marginRight: 15, paddingBottom: 4, borderBottomWidth: 2, borderBottomColor: active ? theme.colors.primary : 'transparent' }}>
        <Text style={{
            ...theme.typography.header,
            color: active ? theme.colors.primary : theme.colors.textSecondary,
            fontSize: 14
        }}>
            {label}
        </Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column' // Changed to column to support mobile header
    },
    mobileHeader: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1
    },
    sidebar: {
        // width handled dynamically
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
        minWidth: '40%', // improved wrapping
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
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
    filterScroll: {
        marginBottom: 12,
        maxHeight: 40
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 6
    },
    filterButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
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
        flex: 1,
        overflow: 'hidden' // Ensure content doesn't bleed
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
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 2000, // Ensure it sits on top of everything
        elevation: 2000
    },
    modalContent: {
        width: '90%',
        maxWidth: 500,
        padding: 24,
        borderRadius: 16,
        zIndex: 2001,
        elevation: 2001,
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
        // width handled dynamically
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

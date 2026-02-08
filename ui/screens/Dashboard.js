import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import { useAiguState } from '../hooks/useAiguState';
import SupportAgent from '../components/SupportAgent';
import WorkflowProgress from '../components/WorkflowProgress';
import FileManager from '../components/FileManager';
import DiscoveryCanvas from './DiscoveryCanvas';
import LifecycleSubmission from './LifecycleSubmission';
import DeltaReview from './DeltaReview';
import LogViewer from './LogViewer';

/**
 * Dashboard Component - Desktop-Optimized Governance Workspace
 * 
 * Features:
 * - Left Sidebar: Project/Session Navigation
 * - Center Panel: Active Workflow & Forms
 * - Right Sidebar: Docked Support Agent Chat
 * - Bottom Panel: File Attachments & Uploads
 */
const Dashboard = ({ userId, isAdmin, onLogout }) => {
    const { theme } = useAiguTheme();

    // Session Management
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [activeState, setActiveState] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // UI State
    const [showLogs, setShowLogs] = useState(false);
    const [isRemediating, setIsRemediating] = useState(false);
    const [supportPanelOpen, setSupportPanelOpen] = useState(true);
    const [filePanelOpen, setFilePanelOpen] = useState(true);

    // Mock actions - replace with actual useAiguState hook
    const actions = {
        fetchSessions: async (uid) => {
            // TODO: Replace with actual API call
            return [
                { submissionId: 'proj-001', projectMetadata: { name: 'AI Chatbot MVP', currentStage: 'POC' }, governance: { status: 'Blocked' } },
                { submissionId: 'proj-002', projectMetadata: { name: 'Data Pipeline Upgrade', currentStage: 'Production' }, governance: { status: 'In-Review' } },
                { submissionId: 'proj-003', projectMetadata: { name: 'Customer Analytics Dashboard', currentStage: 'Intake' }, governance: { status: 'Draft' } }
            ];
        },
        refreshState: async () => { },
        initiateIntake: async () => { },
        submitPOC: async () => { },
        submitProduction: async () => { },
        fetchReasoning: async () => "Mock reasoning content"
    };

    // Real state management via hook for active project
    const { state: liveState, loading: liveLoading, actions: liveActions } = useAiguState(
        activeSessionId || 'temp',
        userId
    );

    // Sync liveState to activeState when it changes
    useEffect(() => {
        if (liveState && activeSessionId) {
            setActiveState(liveState);

            // Update the session in the list if the name changed
            setSessions(prev => prev.map(s =>
                s.submissionId === activeSessionId ? liveState : s
            ));
        }
    }, [liveState, activeSessionId]);

    // Load user's sessions on mount
    useEffect(() => {
        loadSessions();
    }, [userId]);

    const loadSessions = async () => {
        setLoading(true);
        const data = await liveActions.fetchSessions(userId);
        setSessions(data);

        // Auto-select first session if available
        if (data.length > 0 && !activeSessionId) {
            loadProjectState(data[0].submissionId);
        }
        setLoading(false);
    };

    const loadProjectState = async (projectId) => {
        setActiveSessionId(projectId);
        // Fetch full state for this project
        const session = sessions.find(s => s.submissionId === projectId);
        if (session) {
            setActiveState(session);
        } else {
            // If not found in sessions, it might be a new project
            // The activeState will be set by createNewProject
        }
    };

    const createNewProject = () => {
        // Use a temporary ID that will be replaced by the backend
        const tempId = `temp-${Date.now()}`;

        // Create a new project state object
        const newProject = {
            submissionId: tempId,
            projectMetadata: {
                name: 'New Project',
                currentStage: 'Intake',
                riskLevel: 'Low',
                path: 'Standard'
            },
            governance: {
                status: 'Draft',
                blockers: []
            },
            artifacts: {
                intakeData: {}
            },
            auditLog: [],
            chainOfThought: []
        };

        // Add to sessions list
        setSessions(prev => [newProject, ...prev]);

        // Set as active
        setActiveSessionId(tempId);
        setActiveState(newProject);
    };

    const filteredSessions = sessions.filter(s =>
        s.projectMetadata?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderMainContent = () => {
        if (!activeState) {
            return (
                <View style={styles.emptyState}>
                    <Text style={{ ...theme.typography.header, color: theme.colors.textSecondary }}>
                        Select a project or create a new one
                    </Text>
                </View>
            );
        }

        const stage = activeState.projectMetadata?.currentStage || 'Intake';
        const status = activeState.governance?.status || 'Draft';

        if (showLogs) {
            return (
                <View style={{ flex: 1 }}>
                    <TouchableOpacity
                        style={{ padding: 20 }}
                        onPress={() => setShowLogs(false)}
                    >
                        <Text style={{ color: theme.colors.accent, fontWeight: '700' }}>← BACK TO DASHBOARD</Text>
                    </TouchableOpacity>
                    <LogViewer
                        auditLog={activeState.auditLog}
                        fetchReasoning={liveActions.fetchReasoning}
                    />
                </View>
            );
        }

        // Stage-based routing
        if (stage === 'Intake' && (status === 'Draft' || status === 'New' || isRemediating)) {
            return (
                <DiscoveryCanvas
                    actions={liveActions}
                    isRemediation={isRemediating}
                    initialData={activeState.artifacts?.intakeData || {}}
                    setRemediating={setIsRemediating}
                />
            );
        }

        if (stage === 'POC' && status === 'Blocked') {
            return <LifecycleSubmission stage="POC" state={activeState} actions={liveActions} />;
        }

        if (stage === 'Production' && status === 'Blocked') {
            const isDeltaBlocked = activeState.governance?.blockers?.some(b =>
                b.includes("Delta") || b.includes("threshold")
            );
            if (isDeltaBlocked) {
                return <DeltaReview state={activeState} onSubmit={liveActions.submitDelta} />;
            }
            return <LifecycleSubmission stage="Production" state={activeState} actions={liveActions} />;
        }

        // Default: Status Dashboard
        return (
            <ScrollView style={{ flex: 1 }}>
                <View style={styles.contentPanel}>
                    <View style={styles.statusHeader}>
                        <View>
                            <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary }}>
                                {activeState.projectMetadata?.name || 'Untitled Project'}
                            </Text>
                            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 4 }}>
                                {activeState.artifacts?.intakeData?.description || 'No description'}
                            </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status, theme) }]}>
                            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                                {status}
                            </Text>
                        </View>
                    </View>

                    <WorkflowProgress state={activeState} />

                    {(activeState.governance?.blockers?.length > 0 || activeState.projectMetadata?.missingArtifacts?.length > 0) && (
                        <View style={[styles.alertBox, {
                            backgroundColor: theme.mode === 'dark' ? '#321c1c' : '#FFEBEB',
                            borderLeftColor: theme.colors.error
                        }]}>
                            <Text style={{ ...theme.typography.subheader, color: theme.colors.error, marginBottom: 8 }}>
                                ⚠️ Blockers & Missing Items
                            </Text>
                            {activeState.governance?.blockers?.map((b, i) => (
                                <Text key={`blocker-${i}`} style={{ ...theme.typography.body, color: theme.colors.textPrimary, marginVertical: 2 }}>
                                    • {b}
                                </Text>
                            ))}
                            {activeState.projectMetadata?.missingArtifacts?.map((m, i) => (
                                <Text key={`missing-${i}`} style={{ ...theme.typography.body, color: theme.colors.textSecondary, marginVertical: 2, fontWeight: '600' }}>
                                    • MISSING ARTIFACT: {m.replace(/([A-Z])/g, ' $1').trim()}
                                </Text>
                            ))}
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.colors.primary, marginTop: 24 }]}
                        onPress={() => setShowLogs(true)}
                    >
                        <Text style={{ color: '#FFF', fontWeight: '700' }}>View Full Audit Log</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Left Sidebar - Project Navigation */}
            <View style={[styles.sidebar, { backgroundColor: theme.colors.surface, borderRightColor: theme.colors.border }]}>
                <View style={styles.sidebarHeader}>
                    <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, fontSize: 18 }}>
                        Projects
                    </Text>
                    <TouchableOpacity
                        style={[styles.newProjectButton, { backgroundColor: theme.colors.primary }]}
                        onPress={createNewProject}
                    >
                        <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 20 }}>+</Text>
                    </TouchableOpacity>
                </View>

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

                <ScrollView style={{ flex: 1 }}>
                    {loading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 20 }} />
                    ) : (
                        filteredSessions.map((session) => (
                            <TouchableOpacity
                                key={session.submissionId}
                                style={[
                                    styles.projectCard,
                                    {
                                        backgroundColor: activeSessionId === session.submissionId
                                            ? theme.colors.primary + '20'
                                            : 'transparent',
                                        borderLeftColor: activeSessionId === session.submissionId
                                            ? theme.colors.primary
                                            : 'transparent'
                                    }
                                ]}
                                onPress={() => loadProjectState(session.submissionId)}
                            >
                                <Text style={{
                                    ...theme.typography.body,
                                    color: theme.colors.textPrimary,
                                    fontWeight: activeSessionId === session.submissionId ? '700' : '500'
                                }} numberOfLines={1}>
                                    {session.projectMetadata?.name || session.submissionId}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <View style={[styles.miniStatusDot, {
                                        backgroundColor: getStatusColor(session.governance?.status, theme)
                                    }]} />
                                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontSize: 10 }}>
                                        {session.projectMetadata?.currentStage || 'Intake'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>

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

            {/* Main Content Area */}
            <View style={styles.mainContent}>
                {renderMainContent()}

                {/* Bottom File Panel */}
                {filePanelOpen && activeState && (
                    <View style={[styles.filePanel, {
                        backgroundColor: theme.colors.surface,
                        borderTopColor: theme.colors.border
                    }]}>
                        <View style={styles.filePanelHeader}>
                            <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary }}>
                                📎 Attachments & Documents
                            </Text>
                            <TouchableOpacity onPress={() => setFilePanelOpen(false)}>
                                <Text style={{ color: theme.colors.textSecondary }}>−</Text>
                            </TouchableOpacity>
                        </View>
                        <FileManager
                            submissionId={activeSessionId}
                            userId={userId}
                        />
                    </View>
                )}

                {!filePanelOpen && activeState && (
                    <TouchableOpacity
                        style={[styles.expandButton, { backgroundColor: theme.colors.surface }]}
                        onPress={() => setFilePanelOpen(true)}
                    >
                        <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>📎 Show Files</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Right Sidebar - Support Agent */}
            {supportPanelOpen && (
                <View style={[styles.supportSidebar, {
                    backgroundColor: theme.colors.surface,
                    borderLeftColor: theme.colors.border
                }]}>
                    <SupportAgent
                        state={activeState}
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
        default:
            return '#6c757d';
    }
};

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
    newProjectButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center'
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
    projectCard: {
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
        flexDirection: 'column'
    },
    contentPanel: {
        padding: 32
    },
    statusHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24
    },
    statusBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6
    },
    alertBox: {
        padding: 20,
        borderRadius: 8,
        borderLeftWidth: 4,
        marginTop: 16
    },
    actionButton: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center'
    },
    filePanel: {
        height: 200,
        borderTopWidth: 1,
        padding: 16
    },
    filePanelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    expandButton: {
        padding: 12,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)'
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
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import { useAiguState } from '../hooks/useAiguState';
import SupportAgent from '../components/SupportAgent';
import WorkflowProgress from '../components/WorkflowProgress';
import DiscoveryCanvas from './DiscoveryCanvas';
import LifecycleSubmission from './LifecycleSubmission';
import DeltaReview from './DeltaReview';
import LogViewer from './LogViewer';
import AttachmentManager from '../components/AttachmentManager';
import { getShadow } from '../utils/shadows';

const defaultIntakeData = {};

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
    const [activeDraft, setActiveDraft] = useState(null);
    const [currentFiles, setCurrentFiles] = useState([]);

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

    const loadFiles = async () => {
        if (!activeSessionId || !liveActions.listFiles) return;
        try {
            const files = await liveActions.listFiles(activeSessionId);
            setCurrentFiles(files);
        } catch (e) {
            console.error("Failed to load files", e);
        }
    };

    useEffect(() => {
        if (activeSessionId) {
            loadFiles();
        }
    }, [activeSessionId]);

    const updateActiveSession = (id) => {
        console.log(`[Dashboard] setActiveSessionId: ${activeSessionId} -> ${id}`);
        setActiveSessionId(id);
    };

    const updateSessions = (updater) => {
        setSessions(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            console.log(`[Dashboard] setSessions update. Count ${prev.length} -> ${next.length}. IDs:`, next.map(s => s.submissionId));
            return next;
        });
    };

    // Sync liveState to activeState when it changes
    useEffect(() => {
        if (liveState && activeSessionId) {
            setActiveState(liveState);

            const currentId = activeSessionId;
            const newId = liveState.submissionId;

            // 1. Handle ID Change (Transition from Temp -> Real)
            const isUpgrade = currentId.startsWith('temp-') && newId && !newId.startsWith('temp');

            if (isUpgrade) {
                console.log(`[Dashboard] Project Upgrade: ${currentId} -> ${newId}`);

                updateSessions(prev => {
                    const tempIdLower = currentId.toLowerCase();
                    const realIdLower = newId.toLowerCase();
                    const existingReal = prev.find(s => s.submissionId?.toLowerCase() === realIdLower);

                    if (existingReal) {
                        return prev.filter(s => s.submissionId?.toLowerCase() !== tempIdLower).map(s => {
                            if (s.submissionId?.toLowerCase() === realIdLower) {
                                return { ...s, ...liveState, submissionId: newId };
                            }
                            return s;
                        });
                    } else {
                        return prev.map(s => {
                            if (s.submissionId?.toLowerCase() === tempIdLower) {
                                return { ...s, ...liveState, submissionId: newId };
                            }
                            return s;
                        });
                    }
                });

                updateActiveSession(newId);
            }
            // 2. Normal Metadata Update
            else if (newId?.toLowerCase() === currentId?.toLowerCase()) {
                updateSessions(prev => prev.map(s => {
                    if (s.submissionId?.toLowerCase() === currentId.toLowerCase()) {
                        return {
                            ...s,
                            ...liveState,
                            projectMetadata: {
                                ...(s.projectMetadata || {}),
                                ...(liveState.projectMetadata || {}),
                                name: liveState.projectMetadata?.name || s.projectMetadata?.name || s.submissionId
                            }
                        };
                    }
                    return s;
                }));
            }
        }
    }, [liveState, activeSessionId]);

    // Load user's sessions on mount
    useEffect(() => {
        if (userId) loadSessions();
    }, [userId]);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const data = await liveActions.fetchSessions(userId);

            updateSessions(prev => {
                const newList = [...(data || [])];

                if (activeSessionId) {
                    const searchId = activeSessionId.toLowerCase();
                    const isStillThere = newList.some(s => s.submissionId?.toLowerCase() === searchId);

                    if (!isStillThere) {
                        const activeMatch = prev.find(s => s.submissionId?.toLowerCase() === searchId);
                        if (activeMatch) {
                            newList.unshift(activeMatch);
                        }
                    }
                }
                return newList;
            });

            if (data && data.length > 0 && !activeSessionId) {
                loadProjectState(data[0].submissionId);
            }
        } catch (err) {
            console.error("[Dashboard] loadSessions failed", err);
        } finally {
            setLoading(false);
        }
    };

    const loadProjectState = async (projectId) => {
        updateActiveSession(projectId);

        const searchId = projectId.toLowerCase();
        const session = sessions.find(s => s.submissionId?.toLowerCase() === searchId);
        if (session) {
            setActiveState(session);
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
        updateSessions(prev => [newProject, ...prev]);

        // Set as active
        updateActiveSession(tempId);
        setActiveState(newProject);
    };

    const filteredSessions = sessions.filter(s => {
        const name = (s.projectMetadata?.name || s.submissionId || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });

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
                    initialData={activeState.artifacts?.intakeData || defaultIntakeData}
                    setRemediating={setIsRemediating}
                    projectMetadata={{ ...activeState.projectMetadata, submissionId: activeSessionId, userId }}
                    governance={activeState.governance || {}}
                    files={currentFiles}
                    onUploadSuccess={loadFiles}
                    onDraftUpdate={setActiveDraft}
                />
            );
        }

        if (stage === 'POC' && status === 'Blocked') {
            return (
                <LifecycleSubmission
                    stage="POC"
                    state={activeState}
                    actions={liveActions}
                    files={currentFiles}
                    onUploadSuccess={loadFiles}
                    userId={userId}
                />
            );
        }

        if (stage === 'Production' && status === 'Blocked') {
            const isDeltaBlocked = activeState.governance?.blockers?.some(b =>
                b.includes("Delta") || b.includes("threshold")
            );
            if (isDeltaBlocked) {
                return <DeltaReview state={activeState} onSubmit={liveActions.submitDelta} />;
            }
            return (
                <LifecycleSubmission
                    stage="Production"
                    state={activeState}
                    actions={liveActions}
                    files={currentFiles}
                    onUploadSuccess={loadFiles}
                    userId={userId}
                />
            );
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

                    {!!activeState.ui_overlay?.supportMessage && (
                        <View style={[styles.guidanceBox, {
                            backgroundColor: theme.mode === 'dark' ? '#1c2532' : '#EBF5FF',
                            borderLeftColor: theme.colors.primary
                        }]}>
                            <Text style={{ ...theme.typography.subheader, color: theme.colors.primary, marginBottom: 8 }}>
                                🧠 Assistant Guidance
                            </Text>
                            <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary, lineHeight: 20 }}>
                                {activeState.ui_overlay.supportMessage}
                            </Text>
                        </View>
                    )}

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

                    {status === 'Blocked' && (
                        <View style={{ marginTop: 24, padding: 20, borderRadius: 8, backgroundColor: theme.mode === 'dark' ? '#322d1c' : '#FFF9EB', borderLeftWidth: 4, borderLeftColor: theme.colors.warning }}>
                            <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary, fontWeight: '700', marginBottom: 8 }}>
                                ACTION REQUIRED: Re-Submission
                            </Text>
                            <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary, marginBottom: 16 }}>
                                Once you have addressed the blockers and updated any necessary artifacts, click below to re-submit your project for evaluation.
                            </Text>
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                                onPress={async () => {
                                    await liveActions.submitRevision();
                                }}
                            >
                                <Text style={{ color: '#FFF', fontWeight: '700' }}>🚀 SUBMIT REVISION</Text>
                            </TouchableOpacity>
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
                    <TouchableOpacity onPress={() => {
                        setActiveSessionId(null);
                        setActiveState(null);
                    }}>
                        <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, fontSize: 18 }}>
                            Projects
                        </Text>
                    </TouchableOpacity>
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
                                    fontWeight: activeSessionId?.toLowerCase() === session.submissionId?.toLowerCase() ? '700' : '500'
                                }} numberOfLines={1}>
                                    {session.projectMetadata?.name || session.submissionId || 'Unnamed Project'}
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

                        <AttachmentManager
                            submissionId={activeSessionId}
                            userId={userId}
                            files={currentFiles}
                            onUploadSuccess={loadFiles}
                            onDelete={liveActions.deleteArtifact}
                            getUploadUrl={liveActions.getUploadUrl}
                        />

                        {/* REMEDIATION ACTION */}
                        {activeState.governance?.status === 'Blocked' && (
                            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16 }}>
                                <Text style={{ ...theme.typography.body, color: theme.colors.error, marginBottom: 8 }}>
                                    Your project is blocked. Please address the issues above, manage your files, then click below to re-submit for review.
                                </Text>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                                    onPress={async () => {
                                        await liveActions.submitRevision();
                                        // Ideally, trigger a refresh/poll or optimistically update
                                    }}
                                >
                                    <Text style={{ color: '#FFF', fontWeight: '700' }}>🚀 SUBMIT REVISION for RE-EVALUATION</Text>
                                </TouchableOpacity>
                            </View>
                        )}
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
                        actions={liveActions}
                        onClose={() => setSupportPanelOpen(false)}
                        contextOverride={activeDraft}
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
    guidanceBox: {
        padding: 20,
        borderRadius: 8,
        borderLeftWidth: 4,
        marginTop: 16,
        ...getShadow('#000', { width: 0, height: 2 }, 0.05, 4, 1)
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
        ...getShadow('#000', { width: -2, height: 0 }, 0.2, 4, 4)
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default Dashboard;

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, StyleSheet } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import { getShadow } from '../utils/shadows';
import { Feather } from '@expo/vector-icons';
import { useAiguState, signedFetch } from '../hooks/useAiguState';
import LogViewer from './LogViewer';

const AgentCockpit = ({ route, navigation }) => {
    // Role comes from route params or context
    const { role } = route.params || { role: 'risk_triage' };
    const { theme } = useAiguTheme();
    const { actions } = useAiguState();

    // State
    const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'config' | 'analytics'
    const [projects, setProjects] = useState([]);
    const [configData, setConfigData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [overrideModalVisible, setOverrideModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [rightPanelOpen, setRightPanelOpen] = useState(true);

    // Override Form
    const [newStatus, setNewStatus] = useState('');
    const [newRisk, setNewRisk] = useState('');
    const [justification, setJustification] = useState('');

    // Load Data
    useEffect(() => {
        loadDashboard();
    }, [role]);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            // 1. Fetch Queue
            const allProjects = await signedFetch('/admin/list');
            console.log(`[Cockpit] Fetched ${allProjects.length} projects for role: ${role}`);

            let filtered = [];
            if (role === 'risk_triage') {
                // Risk users should see everything that is at the Risk stage OR is still a Draft
                filtered = allProjects.filter(p =>
                    p.projectMetadata?.currentStage === 'Risk' ||
                    p.governance?.status === 'Draft' ||
                    p.governance?.status === 'New' ||
                    !p.governance?.status
                );
            } else if (role === 'librarian') {
                filtered = allProjects.filter(p =>
                    p.governance?.status === 'Under Review' ||
                    p.projectMetadata?.currentStage === 'Librarian' ||
                    p.projectMetadata?.currentStage === 'Intake'
                );
            } else {
                filtered = allProjects;
            }
            console.log(`[Cockpit] Filtered to ${filtered.length} projects`);
            setProjects(filtered);

            // 2. Fetch Config
            const config = await signedFetch(`/config/${role}`);
            setConfigData(config);
        } catch (err) {
            console.error("Cockpit Load Error:", err);
            Alert.alert("Error", "Failed to load cockpit data.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        try {
            await signedFetch(`/config/${role}`, {
                method: 'POST',
                body: JSON.stringify(configData)
            });
            Alert.alert("Success", "Agent Configuration Updated.");
        } catch (err) {
            Alert.alert("Error", "Failed to save configuration.");
        }
    };

    const handleOverride = async () => {
        if (!selectedProject || !newStatus || !justification) {
            Alert.alert("Validation", "Status and Justification are required.");
            return;
        }

        try {
            await signedFetch('/governance/override', {
                method: 'POST',
                body: JSON.stringify({
                    submissionId: selectedProject.submissionId,
                    userId: selectedProject.userId,
                    newStatus,
                    newRiskLevel: newRisk || undefined,
                    justification
                })
            });
            setOverrideModalVisible(false);
            loadDashboard();
            Alert.alert("Success", "Project status overridden.");
        } catch (err) {
            Alert.alert("Error", "Override failed.");
        }
    };

    // --- SUB-COMPONENTS ---

    const renderSidebar = () => (
        <View style={[styles.sidebar, { backgroundColor: theme.colors.surface, borderRightColor: theme.colors.border }]}>
            <View style={styles.sidebarHeader}>
                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, fontSize: 18 }}>
                    AIGU {role === 'risk_triage' ? 'RISK' : 'LIB'}
                </Text>
                <View style={{ backgroundColor: theme.colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: theme.colors.primary, fontSize: 10, fontWeight: 'bold' }}>AGENT</Text>
                </View>
            </View>

            <View style={{ flex: 1, paddingVertical: 16 }}>
                <TouchableOpacity
                    style={[styles.navItem, activeTab === 'queue' && { backgroundColor: theme.colors.primary + '10', borderLeftColor: theme.colors.primary }]}
                    onPress={() => setActiveTab('queue')}
                >
                    <Feather name="list" size={18} color={activeTab === 'queue' ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={[styles.navText, { color: activeTab === 'queue' ? theme.colors.primary : theme.colors.textSecondary }]}>Queue</Text>
                    <View style={{ marginLeft: 'auto', backgroundColor: theme.colors.surface, borderRadius: 10, paddingHorizontal: 6 }}>
                        <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>{projects.length}</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navItem, activeTab === 'config' && { backgroundColor: theme.colors.primary + '10', borderLeftColor: theme.colors.primary }]}
                    onPress={() => setActiveTab('config')}
                >
                    <Feather name="settings" size={18} color={activeTab === 'config' ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={[styles.navText, { color: activeTab === 'config' ? theme.colors.primary : theme.colors.textSecondary }]}>Rules Engine</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navItem, activeTab === 'analytics' && { backgroundColor: theme.colors.primary + '10', borderLeftColor: theme.colors.primary }]}
                    onPress={() => setActiveTab('analytics')}
                >
                    <Feather name="bar-chart-2" size={18} color={activeTab === 'analytics' ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={[styles.navText, { color: activeTab === 'analytics' ? theme.colors.primary : theme.colors.textSecondary }]}>Analytics</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.sidebarFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>AI</Text>
                    </View>
                    <View>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: 'bold' }}>{role}</Text>
                        <Text style={{ color: theme.colors.success, fontSize: 10 }}>● Online</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={() => window.location.reload()} style={{ padding: 8, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>Wait, I'm a User (Switch)</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderProjectDetail = () => {
        if (!selectedProject) return <View style={styles.emptyState}><Text style={{ color: theme.colors.textSecondary }}>Select a project to inspect</Text></View>;

        return (
            <ScrollView style={{ flex: 1 }}>
                <View style={styles.detailHeader}>
                    <Text style={{ ...theme.typography.h2, color: theme.colors.textPrimary }}>{selectedProject.projectMetadata?.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedProject.governance?.status, theme) }]}>
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>{selectedProject.governance?.status}</Text>
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={styles.sectionTitle}>Logic Trace</Text>
                    {selectedProject.auditLog?.map((log, i) => (
                        <View key={i} style={{ marginBottom: 16, borderLeftWidth: 2, borderLeftColor: theme.colors.primary, paddingLeft: 12 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 10, marginBottom: 2 }}>{new Date(log.timestamp).toLocaleTimeString()}</Text>
                            <Text style={{ color: theme.colors.textPrimary, fontWeight: 'bold', fontSize: 12 }}>{log.action}</Text>
                            <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>{log.reason}</Text>
                        </View>
                    ))}
                    {(!selectedProject.auditLog || selectedProject.auditLog.length === 0) && (
                        <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic' }}>No audit history available.</Text>
                    )}
                </View>

                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, marginTop: 16 }]}>
                    <Text style={styles.sectionTitle}>Manual Controls</Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.colors.error }]}
                        onPress={() => {
                            setNewStatus(selectedProject.governance?.status);
                            setOverrideModalVisible(true);
                        }}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>INITIATE OVERRIDE</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    const renderMainContent = () => (
        <View style={styles.mainContent}>
            {/* Top Workspace Header */}
            <View style={[styles.workspaceHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={{ ...theme.typography.h3, color: theme.colors.textPrimary }}>
                    {activeTab === 'queue' ? 'Observation Queue' : activeTab === 'config' ? 'Agent Configuration' : 'System Analytics'}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                    <TextInput
                        placeholder="Search..."
                        placeholderTextColor={theme.colors.textSecondary}
                        style={[styles.searchBar, { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <TouchableOpacity onPress={loadDashboard} style={{ padding: 8, marginLeft: 8 }}>
                        <Feather name="refresh-cw" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content Body */}
            <View style={{ flex: 1, flexDirection: 'row' }}>
                {activeTab === 'queue' ? (
                    <>
                        {/* List Column */}
                        <View style={[styles.queueList, { borderRightColor: theme.colors.border }]}>
                            <ScrollView>
                                {projects.filter(p => (p.projectMetadata?.name || '').toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                                    <TouchableOpacity
                                        key={p.submissionId}
                                        style={[
                                            styles.queueItem,
                                            {
                                                backgroundColor: selectedProject?.submissionId === p.submissionId ? theme.colors.primary + '10' : 'transparent',
                                                borderBottomColor: theme.colors.border
                                            }
                                        ]}
                                        onPress={() => setSelectedProject(p)}
                                    >
                                        <Text style={{ color: theme.colors.textPrimary, fontWeight: 'bold' }}>{p.projectMetadata?.name || 'Untitled'}</Text>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                            <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>{p.userId}</Text>
                                            <Text style={{ color: role === 'risk_triage' ? theme.colors.error : theme.colors.primary, fontSize: 11, fontWeight: 'bold' }}>
                                                {p.projectMetadata?.riskLevel || 'Low Risk'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                        {/* Detail Column */}
                        <View style={styles.detailPanel}>
                            {renderProjectDetail()}
                        </View>
                    </>
                ) : activeTab === 'config' ? (
                    <ScrollView style={{ flex: 1, padding: 24 }}>
                        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                            <Text style={styles.sectionTitle}>Behavioral Configuration (JSON)</Text>
                            <TextInput
                                multiline
                                numberOfLines={20}
                                style={{
                                    fontFamily: 'monospace',
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.textPrimary,
                                    padding: 12,
                                    borderRadius: 4,
                                    borderWidth: 1,
                                    borderColor: theme.colors.border,
                                    minHeight: 400,
                                    textAlignVertical: 'top'
                                }}
                                value={JSON.stringify(configData, null, 2)}
                                onChangeText={(text) => {
                                    try { setConfigData(JSON.parse(text)); } catch (e) { }
                                }}
                            />
                            <TouchableOpacity
                                onPress={handleSaveConfig}
                                style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
                            >
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>DEPLOY CONFIGURATION</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.emptyState}>
                        <Feather name="bar-chart" size={48} color={theme.colors.textSecondary} />
                        <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>Analytics Module Coming Soon</Text>
                    </View>
                )}
            </View>
        </View>
    );

    const renderRightPanel = () => (
        <View style={[styles.rightSidebar, { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.border }]}>
            <View style={[styles.sidebarHeader, { borderBottomColor: theme.colors.border, borderBottomWidth: 1 }]}>
                <Text style={{ ...theme.typography.h4, color: theme.colors.textPrimary }}>System Logs</Text>
                <TouchableOpacity onPress={() => setRightPanelOpen(false)}>
                    <Feather name="x" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>
            <View style={{ flex: 1, padding: 12 }}>
                {/* Simplified Log View for Context Sidebar */}
                <Text style={{ color: theme.colors.textSecondary, marginBottom: 8, fontSize: 10 }}>LIVE AUDIT STREAM ({role})</Text>
                <ScrollView>
                    {projects.flatMap(p => p.auditLog || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10).map((log, i) => (
                        <View key={i} style={{ marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                            <Text style={{ color: theme.colors.primary, fontSize: 10, fontWeight: 'bold' }}>[{log.agent}]</Text>
                            <Text style={{ color: theme.colors.textPrimary, fontSize: 11 }}>{log.action}</Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 10, marginTop: 2 }}>{log.reason?.substring(0, 60)}...</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {renderSidebar()}
            {renderMainContent()}
            {rightPanelOpen && renderRightPanel()}

            {!rightPanelOpen && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => setRightPanelOpen(true)}
                >
                    <Feather name="activity" size={20} color={theme.colors.textPrimary} />
                </TouchableOpacity>
            )}

            {/* OVERRIDE MODAL */}
            <Modal visible={overrideModalVisible} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, ...getShadow('#000', { width: 0, height: 4 }, 0.25, 8, 4) }]}>
                        <Text style={{ ...theme.typography.h3, marginBottom: 16, color: theme.colors.textPrimary }}>Manual Intervention</Text>

                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>New Status</Text>

                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                            {['Approved', 'Under Review', 'Blocked'].map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    onPress={() => setNewStatus(status)}
                                    style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 12,
                                        borderRadius: 4,
                                        backgroundColor: newStatus === status ? getStatusColor(status, theme) : theme.colors.background,
                                        borderWidth: 1,
                                        borderColor: newStatus === status ? 'transparent' : theme.colors.border
                                    }}
                                >
                                    <Text style={{
                                        color: newStatus === status ? '#FFF' : theme.colors.textSecondary,
                                        fontSize: 12,
                                        fontWeight: 'bold'
                                    }}>
                                        {status === 'Approved' ? 'Next Stage' : status === 'Under Review' ? 'Regress' : 'Reject'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Risk Level (Optional)</Text>
                        <TextInput
                            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                            placeholder="e.g. High"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newRisk}
                            onChangeText={setNewRisk}
                        />

                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Justification (Mandatory)</Text>
                        <TextInput
                            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, minHeight: 80 }]}
                            multiline
                            value={justification}
                            onChangeText={setJustification}
                        />

                        <View style={{ flexDirection: 'row', justifySelf: 'flex-end', marginTop: 16 }}>
                            <TouchableOpacity onPress={() => setOverrideModalVisible(false)} style={{ marginRight: 16, padding: 12 }}>
                                <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleOverride} style={[styles.button, { backgroundColor: theme.colors.error }]}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>CONFIRM</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const getStatusColor = (status, theme) => {
    switch (status) {
        case 'Approved': return theme.colors.success;
        case 'Blocked': return theme.colors.error;
        case 'In-Review': return '#007bff';
        default: return '#6c757d';
    }
};

const styles = StyleSheet.create({
    container: { flex: 1, flexDirection: 'row' },
    sidebar: { width: 240, borderRightWidth: 1, flexDirection: 'column' },
    sidebarHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    navItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderLeftWidth: 3, borderLeftColor: 'transparent' },
    navText: { marginLeft: 12, fontSize: 14, fontWeight: '500' },
    sidebarFooter: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },

    mainContent: { flex: 1, flexDirection: 'column' },
    workspaceHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
    searchBar: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, width: 200 },

    queueList: { width: 300, borderRightWidth: 1 },
    queueItem: { padding: 16, borderBottomWidth: 1 },
    detailPanel: { flex: 1, padding: 24 },

    rightSidebar: { width: 300, borderLeftWidth: 1 },

    card: { padding: 16, borderRadius: 8, borderWidth: 1, marginBottom: 16 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase', opacity: 0.7 },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },

    button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' },
    input: { borderWidth: 1, borderRadius: 4, padding: 10, marginBottom: 12 },
    label: { fontSize: 12, marginBottom: 4 },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: 450, borderRadius: 8, padding: 24 },

    fab: { position: 'absolute', right: 20, bottom: 20, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1 }
});

export default AgentCockpit;

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAiguState } from '../hooks/useAiguState';
import { AIGU_THEME } from '../theme/ThemeConfig';

// Screens
import DiscoveryCanvas from '../screens/DiscoveryCanvas';
import SupportStatus from '../screens/SupportStatus';
import DeltaReview from '../screens/DeltaReview';
import AdminDashboard from '../screens/AdminDashboard';
import LogViewer from '../screens/LogViewer';
import DevConsole from '../screens/DevConsole';
import AdminQueue from '../screens/AdminQueue';
import LifecycleSubmission from '../screens/LifecycleSubmission';
import NavigationBreadcrumbs from '../components/NavigationBreadcrumbs';
import { TouchableOpacity } from 'react-native';

const RootNavigator = ({ submissionId, userId, isAdmin, onBackToLobby, onLogout }) => {
    // 1. Session Recovery & State Subscription via Hook
    const { state, loading, actions, computed, error } = useAiguState(submissionId, userId);
    const [showLogs, setShowLogs] = React.useState(false);
    const [showDevConsole, setShowDevConsole] = React.useState(false);
    const [isRemediating, setIsRemediating] = React.useState(false);

    const renderContent = () => {
        if (showDevConsole) {
            return <DevConsole actions={actions} onClose={() => setShowDevConsole(false)} />;
        }

        // 2. Admin Override - Priority
        if (isAdmin) {
            return <AdminQueue actions={actions} />;
        }

        if (!state && loading) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={AIGU_THEME.colors.primary} />
                    <Text style={{ marginTop: 16, color: AIGU_THEME.colors.textSecondary }}>Loading Workspace...</Text>
                </View>
            );
        }

        if (error || (!state && !loading)) {
            return (
                <View style={styles.centerContainer}>
                    <Text style={{ ...AIGU_THEME.typography.header, color: AIGU_THEME.colors.error }}>Connection Error</Text>
                    <Text style={{ marginBottom: 20, color: AIGU_THEME.colors.textPrimary }}>{error?.message || "Failed to load state."}</Text>
                    <TouchableOpacity
                        style={{ padding: 12, backgroundColor: AIGU_THEME.colors.primary, borderRadius: 6, marginBottom: 12 }}
                        onPress={() => setShowDevConsole(true)}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>UPDATE AWS CREDENTIALS</Text>
                    </TouchableOpacity>
                    <Text style={{ color: AIGU_THEME.colors.textSecondary }}>Check console for CORS or Network details.</Text>
                </View>
            );
        }

        // --- View Shared Log View (Priority) ---
        if (showLogs) {
            return (
                <View style={{ flex: 1 }}>
                    <TouchableOpacity
                        style={{ padding: 20, paddingTop: 40 }}
                        onPress={() => setShowLogs(false)}
                    >
                        <Text style={{ color: AIGU_THEME.colors.accent, fontWeight: '700' }}>← BACK TO DASHBOARD</Text>
                    </TouchableOpacity>
                    <LogViewer
                        auditLog={state.auditLog}
                        fetchReasoning={actions.fetchReasoning}
                    />
                </View>
            );
        }

        // 3. Stage-Based Navigation
        const stage = computed.currentStage;
        const status = state.governance?.status;

        // Routing Logic
        if (stage === 'Intake') {
            if (status === 'Draft' || status === 'New' || !status || isRemediating) {
                return (
                    <DiscoveryCanvas
                        actions={actions}
                        isRemediation={isRemediating}
                        initialData={state.artifacts?.intakeData || {}}
                        setRemediating={setIsRemediating}
                    />
                );
            }
        }

        // Blocking/Action Required Screens
        if (stage === 'POC' && status === 'Blocked') {
            return <LifecycleSubmission stage="POC" state={state} actions={actions} />;
        }

        if (stage === 'Production' && status === 'Blocked') {
            // Delta threshold block has priority UI
            if (computed.isDeltaBlocked) {
                return <DeltaReview state={state} onSubmit={actions.submitDelta} />;
            }
            return <LifecycleSubmission stage="Production" state={state} actions={actions} />;
        }

        // Default: Show Tracking Screen (SupportStatus)
        // This covers Pilot, Risk, Librarian, Gatekeeper, and Handover stages
        return <SupportStatus
            state={state}
            refresh={actions.refreshState}
            onViewLog={() => setShowLogs(true)}
            onRemediate={() => setIsRemediating(true)}
        />;
    };

    return (
        <View style={{ flex: 1 }}>
            <NavigationBreadcrumbs
                userId={userId}
                projectName={state?.projectMetadata?.name || state?.artifacts?.intakeData?.projectName}
                currentStage={computed.currentStage}
                isAdmin={isAdmin}
                onBackToLobby={onBackToLobby}
                onLogout={onLogout}
            />
            {renderContent()}
            {loading && !!state && (
                <View style={styles.overlay}>
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={AIGU_THEME.colors.accent} />
                        <Text style={styles.loadingText}>Syncing Brain State...</Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    overlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
    },
    loadingBox: {
        backgroundColor: '#FFF',
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5
    },
    loadingText: {
        marginTop: 16,
        fontWeight: '600',
        color: AIGU_THEME.colors.primary,
        fontSize: 14
    }
});

export default RootNavigator;

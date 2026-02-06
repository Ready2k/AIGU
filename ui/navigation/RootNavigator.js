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
import { TouchableOpacity } from 'react-native';

const RootNavigator = ({ submissionId, userId, isAdmin }) => {
    // 1. Session Recovery & State Subscription via Hook
    const { state, loading, actions, computed, error } = useAiguState(submissionId, userId);
    const [showLogs, setShowLogs] = React.useState(false);

    const renderContent = () => {
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
                    <Text style={{ color: AIGU_THEME.colors.textSecondary }}>Check console for CORS or Network details.</Text>
                </View>
            );
        }

        // 2. Admin Override
        if (isAdmin) {
            return <AdminDashboard actions={actions} />;
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

        // 3. Governance Blocking/Engagement Logic (Highest Priority)
        if (computed.isEngaged) {
            if (computed.isDeltaBlocked) {
                return <DeltaReview state={state} onSubmit={actions.submitDelta} />;
            }
            return <SupportStatus
                state={state}
                refresh={actions.refreshState}
                onViewLog={() => setShowLogs(true)}
            />;
        }

        // 4. Stage-Based Navigation
        switch (computed.currentStage) {
            case 'Intake':
                return <DiscoveryCanvas actions={actions} />;

            case 'Pilot':
                return (
                    <View style={{ flex: 1, padding: 20 }}>
                        <Text style={AIGU_THEME.typography.header}>Pilot Workspace</Text>
                        <Text style={{ ...AIGU_THEME.typography.caption, color: AIGU_THEME.colors.warning, marginBottom: 20 }}>
                            Risk Level: {computed.riskLevel}
                        </Text>
                        {/* Nested SupportStatus to show the timeline/logs while in Pilot */}
                        <SupportStatus
                            state={state}
                            refresh={actions.refreshState}
                            onViewLog={() => setShowLogs(true)}
                        />
                    </View>
                );

            case 'Production':
                return (
                    <View style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ ...AIGU_THEME.typography.header, color: AIGU_THEME.colors.success }}>
                            🚀 Production Live
                        </Text>
                        <Text style={{ color: AIGU_THEME.colors.textSecondary, marginTop: 8 }}>
                            Your project is now governed and active.
                        </Text>
                    </View>
                );

            default:
                return <DiscoveryCanvas actions={actions} />;
        }
    };

    return (
        <View style={{ flex: 1 }}>
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

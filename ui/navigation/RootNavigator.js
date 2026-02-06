import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAiguState } from '../hooks/useAiguState';
import { AIGU_THEME } from '../theme/ThemeConfig';

// Screens
import DiscoveryCanvas from '../screens/DiscoveryCanvas';
import SupportStatus from '../screens/SupportStatus';
import DeltaReview from '../screens/DeltaReview';
import AdminDashboard from '../screens/AdminDashboard';

const RootNavigator = ({ submissionId, userId, isAdmin }) => {
    // 1. Session Recovery & State Subscription via Hook
    const { state, loading, actions, computed } = useAiguState(submissionId, userId);

    if (loading || (!state && !state?.error)) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={AIGU_THEME.colors.primary} />
            </View>
        );
    }

    if (state?.error || (!state && !loading)) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Text style={{ ...AIGU_THEME.typography.header, color: AIGU_THEME.colors.error }}>Connection Error</Text>
                <Text style={{ marginBottom: 20 }}>{state?.error?.message || "Failed to load state."}</Text>
                <Text>Check console for CORS or Network details.</Text>
            </View>
        );
    }

    // 2. Admin Override
    if (isAdmin) {
        return <AdminDashboard actions={actions} />;
    }

    // 3. Governance Blocking Logic (Highest Priority)
    // Automatically routes to SupportStatus or DeltaReview if blocked
    if (computed.isBlocked) {
        if (computed.isDeltaBlocked) {
            // Live Delta Verification Route
            return <DeltaReview state={state} onSubmit={actions.submitDelta} />;
        }
        return <SupportStatus state={state} refresh={actions.refreshState} />;
    }

    // 4. Stage-Based Navigation
    switch (computed.currentStage) {
        case 'Intake':
            return <DiscoveryCanvas actions={actions} />;

        case 'Pilot':
            return (
                <View style={{ flex: 1, padding: 20 }}>
                    <Text style={AIGU_THEME.typography.header}>Pilot Workspace</Text>
                    <Text style={{ ...AIGU_THEME.typography.caption, color: AIGU_THEME.colors.warning }}>
                        Risk Level: {computed.riskLevel}
                    </Text>
                    {/* In a real app, AdvancedTechReview injected here if High Risk */}
                </View>
            );

        case 'Production':
            return (
                <View style={{ flex: 1, padding: 20 }}>
                    <Text style={{ ...AIGU_THEME.typography.header, color: AIGU_THEME.colors.success }}>
                        Production Live
                    </Text>
                </View>
            );

        default:
            return <DiscoveryCanvas actions={actions} />;
    }
};

export default RootNavigator;

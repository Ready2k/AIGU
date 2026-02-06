import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';
import WorkflowProgress from '../components/WorkflowProgress';

const SupportStatus = ({ state, onViewLog, refresh }) => {
    const { theme } = useAiguTheme();

    // Read-Only Status & Transparency
    const governance = state.governance || {};
    const status = governance.status || 'In-Review';
    const blockers = governance.blockers || [];
    const sla = governance.slaDeadline || 'TBD';

    // Derived Visual State
    let statusColor = theme.colors.accent;
    if (status === 'Blocked') statusColor = theme.colors.error;
    if (status === 'Approved') statusColor = theme.colors.success;
    if (status === 'In-Review') statusColor = theme.colors.warning;

    return (
        <ResponsiveWrapper>
            <View style={styles.container}>
                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <View style={styles.header}>
                        <View>
                            <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary }}>
                                Support & Insights
                            </Text>
                            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                                Live tracking of your governance workflow
                            </Text>
                        </View>
                        <TouchableOpacity onPress={refresh} style={styles.refreshButton}>
                            <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>Refresh</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.statusRow}>
                        <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary }}>Current Status: </Text>
                        <View style={[styles.badge, { backgroundColor: statusColor }]}>
                            <Text style={[theme.typography.caption, { color: '#FFF', fontWeight: '700' }]}>
                                {status.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {/* Dynamic Workflow Progress */}
                    <WorkflowProgress state={state} />

                    {status === 'Blocked' && (
                        <View style={[styles.alertBox, { backgroundColor: theme.mode === 'dark' ? '#321c1c' : '#FFEBEB', borderLeftColor: theme.colors.error }]}>
                            <Text style={{ ...theme.typography.subheader, color: theme.colors.error, marginBottom: 8 }}>
                                ⚠️ Blockers Detected
                            </Text>
                            {blockers.map((b, i) => (
                                <Text key={i} style={{ ...theme.typography.body, color: theme.colors.textPrimary, marginVertical: 2, fontWeight: '600' }}>
                                    • {b}
                                </Text>
                            ))}

                            {governance.remediation && (
                                <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(209, 50, 18, 0.2)' }}>
                                    <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary, fontWeight: '700', marginBottom: 4 }}>
                                        🛠️ How to Fix:
                                    </Text>
                                    <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary, fontStyle: 'italic' }}>
                                        {governance.remediation}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {status === 'In-Review' && (
                        <View style={[styles.alertBox, { backgroundColor: theme.mode === 'dark' ? '#2d2316' : '#FFF4E5', borderLeftColor: theme.colors.warning }]}>
                            <Text style={{ ...theme.typography.subheader, color: theme.colors.warning, marginBottom: 4 }}>
                                ⏳ SLA Target
                            </Text>
                            <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary }}>
                                Expected Completion: <Text style={{ fontWeight: '700' }}>{sla}</Text>
                            </Text>
                        </View>
                    )}

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.auditButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                            onPress={onViewLog}
                        >
                            <Text style={{ ...theme.typography.body, color: theme.colors.primary, fontWeight: '600' }}>
                                View Full Audit Log & Reasoning
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ResponsiveWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        maxWidth: 900,
        width: '100%',
        alignSelf: 'center',
    },
    card: {
        padding: 32,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 6
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 32
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        marginLeft: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2
    },
    alertBox: {
        padding: 20,
        borderRadius: 8,
        borderLeftWidth: 4,
        marginTop: 24,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1
    },
    footer: {
        marginTop: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(128,128,128,0.2)',
        paddingTop: 24
    },
    auditButton: {
        paddingVertical: 14,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    refreshButton: {
        padding: 8,
        borderRadius: 6
    }
});

export default SupportStatus;

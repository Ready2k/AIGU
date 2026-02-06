import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';

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

                    {/* Timeline Simulation */}
                    <View style={styles.timeline}>
                        <View style={[styles.timelineNode, { backgroundColor: theme.colors.surface, borderColor: status === 'Approved' ? theme.colors.success : theme.colors.border }]}>
                            <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
                            <Text style={{ ...theme.typography.body, fontWeight: '600', color: theme.colors.textPrimary }}>Intake Complete</Text>
                        </View>
                        <View style={[styles.timelineLine, { backgroundColor: theme.colors.border }]} />
                        <View style={[styles.timelineNode, { backgroundColor: theme.colors.surface, borderColor: statusColor, borderWidth: 2 }]}>
                            <View style={[styles.dot, { backgroundColor: statusColor }]} />
                            <Text style={{ ...theme.typography.body, fontWeight: '600', color: theme.colors.textPrimary }}>{status}</Text>
                        </View>
                    </View>

                    {status === 'Blocked' && (
                        <View style={[styles.alertBox, { backgroundColor: theme.mode === 'dark' ? '#321c1c' : '#FFEBEB', borderLeftColor: theme.colors.error }]}>
                            <Text style={{ ...theme.typography.subheader, color: theme.colors.error, marginBottom: 8 }}>
                                ⚠️ Blockers Detected
                            </Text>
                            {blockers.map((b, i) => (
                                <Text key={i} style={{ ...theme.typography.body, color: theme.colors.textPrimary, marginVertical: 2 }}>
                                    • {b}
                                </Text>
                            ))}
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
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3
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
        marginBottom: 40
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
        marginLeft: 8
    },
    timeline: {
        marginBottom: 40
    },
    timelineNode: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12
    },
    timelineLine: {
        width: 2,
        height: 24,
        marginLeft: 21,
    },
    alertBox: {
        padding: 20,
        borderRadius: 8,
        borderLeftWidth: 4,
        marginBottom: 32
    },
    footer: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: 32
    },
    auditButton: {
        paddingVertical: 14,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center'
    },
    refreshButton: {
        padding: 8
    }
});

export default SupportStatus;

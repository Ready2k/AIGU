import React from 'react';
import { View, Text } from 'react-native';
import { AIGU_THEME } from '../theme/ThemeConfig';

const SupportStatus = ({ state, onViewLog }) => {
    // Read-Only Status & Transparency
    const governance = state.governance || {};
    const status = governance.status;
    const blockers = governance.blockers || [];
    const sla = governance.slaDeadline;

    // Derived Visual State
    let statusColor = AIGU_THEME.colors.info;
    if (status === 'Blocked') statusColor = AIGU_THEME.colors.error;
    if (status === 'Approved') statusColor = AIGU_THEME.colors.success;
    if (status === 'In-Review') statusColor = AIGU_THEME.colors.warning;

    return (
        <View style={{ flex: 1, padding: AIGU_THEME.spacing.md, backgroundColor: '#FFF0F0' }}>
            {/* Note: Background override might be confusing if not state driven, but kept from original snippet context. 
                Ideally, the background should be neutral AIGU_THEME.colors.background 
                and we use cards for alerts. Let's fix that slightly for better UX. */}

            <View style={{
                backgroundColor: AIGU_THEME.colors.surface,
                padding: AIGU_THEME.spacing.lg,
                borderRadius: AIGU_THEME.borderRadius.md,
                ...AIGU_THEME.shadows.card
            }}>
                <Text style={{ ...AIGU_THEME.typography.header, color: AIGU_THEME.colors.textPrimary, marginBottom: AIGU_THEME.spacing.md }}>
                    Support & Insights
                </Text>

                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: AIGU_THEME.spacing.md
                }}>
                    <Text style={AIGU_THEME.typography.subheader}>Status: </Text>
                    <View style={{
                        backgroundColor: statusColor,
                        paddingHorizontal: AIGU_THEME.spacing.sm,
                        paddingVertical: AIGU_THEME.spacing.xs,
                        borderRadius: AIGU_THEME.borderRadius.sm
                    }}>
                        <Text style={{ ...AIGU_THEME.typography.caption, color: AIGU_THEME.colors.textInverted, fontWeight: '700' }}>
                            {status.toUpperCase()}
                        </Text>
                    </View>
                </View>

                {status === 'Blocked' && (
                    <View style={{
                        marginTop: AIGU_THEME.spacing.md,
                        padding: AIGU_THEME.spacing.md,
                        backgroundColor: '#FFEBEB', // Light red tint not in theme but standard for error bg
                        borderLeftWidth: 4,
                        borderLeftColor: AIGU_THEME.colors.error
                    }}>
                        <Text style={{ ...AIGU_THEME.typography.subheader, color: AIGU_THEME.colors.error }}>
                            ⚠️ Action Required
                        </Text>
                        {blockers.map((b, i) => (
                            <Text key={i} style={{ ...AIGU_THEME.typography.body, marginTop: AIGU_THEME.spacing.xs }}>
                                • {b}
                            </Text>
                        ))}
                    </View>
                )}

                {status === 'In-Review' && (
                    <View style={{
                        marginTop: AIGU_THEME.spacing.md,
                        padding: AIGU_THEME.spacing.md,
                        backgroundColor: '#FFF4E5', // Light orange tint
                        borderLeftWidth: 4,
                        borderLeftColor: AIGU_THEME.colors.warning
                    }}>
                        <Text style={{ ...AIGU_THEME.typography.subheader, color: AIGU_THEME.colors.warning }}>
                            ⏳ SLA Countdown
                        </Text>
                        <Text style={AIGU_THEME.typography.body}>
                            Expected Completion: {sla}
                        </Text>
                    </View>
                )}
                {/* View Reasoning / Audit Log Button */}
                <View style={{ marginTop: AIGU_THEME.spacing.lg, paddingTop: AIGU_THEME.spacing.md, borderTopWidth: 1, borderTopColor: '#EEE' }}>
                    <Button
                        title="View Governance Reasoning"
                        color={AIGU_THEME.colors.info}
                        onPress={() => onViewLog()}
                    />
                </View>
            </View>
        </View>
    );
};

export default SupportStatus;

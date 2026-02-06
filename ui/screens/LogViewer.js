import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { AIGU_THEME } from '../theme/ThemeConfig';

const LogViewer = ({ auditLog, fetchReasoning }) => {
    // Sort reverse chronological
    const sortedLog = [...(auditLog || [])].reverse();

    return (
        <ScrollView style={{ flex: 1, backgroundColor: AIGU_THEME.colors.background }}>
            <View style={{ padding: AIGU_THEME.spacing.lg }}>
                <Text style={{ ...AIGU_THEME.typography.header, marginBottom: AIGU_THEME.spacing.md }}>
                    Governance Audit Trail
                </Text>

                {sortedLog.map((entry, index) => (
                    <LogEntry
                        key={`${entry.timestamp}-${index}`}
                        entry={entry}
                        fetchReasoning={fetchReasoning}
                        isLast={index === sortedLog.length - 1}
                    />
                ))}

                {sortedLog.length === 0 && (
                    <Text style={AIGU_THEME.typography.caption}>No audit entries found.</Text>
                )}
            </View>
        </ScrollView>
    );
};

const LogEntry = ({ entry, fetchReasoning, isLast }) => {
    const [expanded, setExpanded] = useState(false);
    const [reasoning, setReasoning] = useState(null);
    const [loadingCoT, setLoadingCoT] = useState(false);

    const handleToggle = async () => {
        if (!expanded && !reasoning && entry.reasoningContext) {
            setLoadingCoT(true);
            const text = await fetchReasoning(entry.reasoningContext);
            setReasoning(text);
            setLoadingCoT(false);
        }
        setExpanded(!expanded);
    };

    const isBlockedAction = entry.action && entry.action.toLowerCase().includes("blocked");
    const nodeColor = isBlockedAction ? AIGU_THEME.colors.error : AIGU_THEME.colors.info;

    return (
        <View style={{ flexDirection: 'row', marginBottom: AIGU_THEME.spacing.xs }}>
            {/* Timeline Line */}
            <View style={{ alignItems: 'center', marginRight: AIGU_THEME.spacing.md }}>
                <View style={{
                    width: 12, height: 12, borderRadius: 6,
                    backgroundColor: nodeColor,
                    zIndex: 1
                }} />
                {!isLast && <View style={{ width: 2, flex: 1, backgroundColor: '#DDD', marginTop: -2 }} />}
            </View>

            {/* Content */}
            <View style={{ flex: 1, paddingBottom: AIGU_THEME.spacing.lg }}>
                <View style={{
                    backgroundColor: AIGU_THEME.colors.surface,
                    padding: AIGU_THEME.spacing.md,
                    borderRadius: AIGU_THEME.borderRadius.md,
                    ...AIGU_THEME.shadows.card
                }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ ...AIGU_THEME.typography.subheader, fontSize: 14 }}>{entry.agent}</Text>
                        <Text style={AIGU_THEME.typography.caption}>
                            {new Date(entry.timestamp).toLocaleTimeString()}
                        </Text>
                    </View>

                    {/* Action & Reason */}
                    <Text style={{ ...AIGU_THEME.typography.body, fontWeight: '600', marginBottom: 4 }}>
                        {entry.action}
                    </Text>
                    <Text style={{ ...AIGU_THEME.typography.body, color: AIGU_THEME.colors.textSecondary }}>
                        {entry.reason}
                    </Text>

                    {/* Verification & CoT Toggle */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: AIGU_THEME.spacing.sm }}>
                        {entry.signature && (
                            <Text style={{ ...AIGU_THEME.typography.caption, color: AIGU_THEME.colors.success }}>
                                ✓ Verified Immutable
                            </Text>
                        )}

                        {entry.reasoningContext && (
                            <TouchableOpacity onPress={handleToggle}>
                                <Text style={{ ...AIGU_THEME.typography.caption, color: AIGU_THEME.colors.secondary }}>
                                    {expanded ? "Hide Reasoning" : "View AI Logic"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Expandable CoT Panel */}
                    {expanded && (
                        <View style={{
                            marginTop: AIGU_THEME.spacing.md,
                            padding: AIGU_THEME.spacing.md,
                            backgroundColor: '#F8F9FA',
                            borderRadius: AIGU_THEME.borderRadius.sm
                        }}>
                            <Text style={{ ...AIGU_THEME.typography.caption, marginBottom: 8 }}>
                                CHAIN OF THOUGHT:
                            </Text>
                            <Text style={AIGU_THEME.typography.mono}>
                                {loadingCoT ? "Fetching from S3..." : reasoning}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

export default LogViewer;

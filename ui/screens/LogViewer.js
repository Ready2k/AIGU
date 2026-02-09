import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';
import { getShadow } from '../utils/shadows';

const LogViewer = ({ auditLog, fetchReasoning }) => {
    const { theme } = useAiguTheme();
    // Sort reverse chronological
    const sortedLog = [...(auditLog || [])].reverse();

    return (
        <ResponsiveWrapper>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary }}>
                        Governance Audit Trail
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 4 }}>
                        Immutable record of AI decisions and state transitions
                    </Text>
                </View>

                <View style={styles.list}>
                    {sortedLog.map((entry, index) => (
                        <LogEntry
                            key={`${entry.timestamp}-${index}`}
                            entry={entry}
                            theme={theme}
                            fetchReasoning={fetchReasoning}
                            isLast={index === sortedLog.length - 1}
                        />
                    ))}

                    {sortedLog.length === 0 && (
                        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                            <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary }}>
                                No audit entries found for this project.
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </ResponsiveWrapper>
    );
};

const LogEntry = ({ entry, theme, fetchReasoning, isLast }) => {
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
    const nodeColor = isBlockedAction ? theme.colors.error : theme.colors.accent;

    return (
        <View style={styles.entryRow}>
            {/* Timeline Segment */}
            <View style={styles.timelineSegment}>
                <View style={[styles.node, { backgroundColor: nodeColor, ...getShadow(nodeColor, { width: 0, height: 0 }, 0.5, 4, 0) }]} />
                {!isLast && <View style={[styles.line, { backgroundColor: theme.colors.border }]} />}
            </View>

            {/* Entry Card */}
            <View style={styles.contentContainer}>
                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    {/* Meta Header */}
                    <View style={styles.cardHeader}>
                        <View style={[styles.agentBadge, { backgroundColor: theme.colors.background }]}>
                            <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>
                                {entry.agent.toUpperCase()}
                            </Text>
                        </View>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Text>
                    </View>

                    {/* Action Title */}
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, fontSize: 16, marginBottom: 8 }}>
                        {entry.action}
                    </Text>

                    {/* Reason Text */}
                    <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary, lineHeight: 22 }}>
                        {entry.reason}
                    </Text>

                    {/* Verification & reasoning button */}
                    <View style={styles.cardFooter}>
                        <View style={styles.verificationRow}>
                            {entry.signature && (
                                <Text style={{ ...theme.typography.caption, color: theme.colors.success, fontWeight: '600' }}>
                                    ✓ HASH_SIGNED
                                </Text>
                            )}
                        </View>

                        {entry.reasoningContext && (
                            <TouchableOpacity onPress={handleToggle} style={styles.reasoningBtn}>
                                <Text style={{ ...theme.typography.caption, color: theme.colors.accent, fontWeight: '700' }}>
                                    {expanded ? "HIDE REASONING" : "VIEW AI LOGIC"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Expandable Panel */}
                    {expanded && (
                        <View style={[styles.cotPanel, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 12, fontWeight: '700' }]}>
                                🔍 CHAIN-OF-THOUGHT ANALYSIS
                            </Text>
                            <Text style={[theme.typography.mono, { color: theme.colors.textPrimary, fontSize: 12, lineHeight: 18 }]}>
                                {loadingCoT ? "Fetching from secure S3 vault..." : reasoning}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        maxWidth: 900,
        width: '100%',
        alignSelf: 'center',
    },
    header: {
        marginBottom: 40
    },
    list: {
        paddingLeft: 4
    },
    entryRow: {
        flexDirection: 'row',
    },
    timelineSegment: {
        alignItems: 'center',
        marginRight: 24,
        width: 12,
    },
    node: {
        width: 14,
        height: 14,
        borderRadius: 7,
        zIndex: 2,
        ...getShadow(undefined, { width: 0, height: 0 }, 0.5, 4, 0),
        marginTop: 6
    },
    line: {
        width: 2,
        flex: 1,
        marginTop: -2,
    },
    contentContainer: {
        flex: 1,
        paddingBottom: 32
    },
    card: {
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        ...getShadow('#000', { width: 0, height: 4 }, 0.03, 8, 2)
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    agentBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)'
    },
    verificationRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    reasoningBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8
    },
    cotPanel: {
        marginTop: 20,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    emptyState: {
        padding: 40,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center'
    }
});

export default LogViewer;

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';

const AdminQueue = ({ actions }) => {
    const { theme } = useAiguTheme();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);

    const refreshQueue = async () => {
        setLoading(true);
        const data = await actions.fetchAdminQueue();
        console.log("Admin queue data:", data);
        setQueue(data);
        setLoading(false);
    };

    useEffect(() => {
        refreshQueue();
    }, []);

    const handleApprove = async (item) => {
        console.log("Approving project:", item.submissionId, item.userId);
        const success = await actions.adminAction(item.submissionId, item.userId, "ADMIN_APPROVE");
        if (success) {
            Alert.alert("Success", `Project ${item.projectMetadata?.name || item.submissionId} Approved.`);
            refreshQueue();
        } else {
            Alert.alert("Error", "Failed to approve project.");
        }
    };

    const handleRequestInfo = async (item) => {
        console.log("Requesting info for project:", item.submissionId, item.userId);
        const success = await actions.adminAction(item.submissionId, item.userId, "ADMIN_REQUEST_INFO", "Please provide a detailed DataFlowDiagram.");
        if (success) {
            Alert.alert("Info Requested", "User has been notified of missing documentation.");
            refreshQueue();
        } else {
            Alert.alert("Error", "Failed to request information.");
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <ResponsiveWrapper>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary }}>GIGC Admin Queue 🛡️</Text>
                    <TouchableOpacity onPress={refreshQueue} style={styles.refresh}>
                        <Text style={{ color: theme.colors.accent, fontWeight: '700' }}>REFRESH</Text>
                    </TouchableOpacity>
                </View>

                {queue.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={{ color: theme.colors.textSecondary }}>No projects currently awaiting review.</Text>
                    </View>
                ) : (
                    <ScrollView>
                        {queue.map((item) => {
                            const description = item.artifacts?.intakeData?.description || "";
                            const currentStage = item.projectMetadata?.currentStage || "Intake";
                            const path = item.projectMetadata?.path || "Pending";
                            const status = item.governance?.status || "Draft";
                            const agentMessage = item.ui_overlay?.supportMessage || "";

                            return (
                                <View
                                    key={item.submissionId}
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor: theme.mode === 'dark' ? '#232F3E' : theme.colors.surface,
                                            borderColor: theme.colors.border
                                        }
                                    ]}
                                >
                                    <View style={styles.cardInfo}>
                                        <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary }}>
                                            {item.projectMetadata?.name || "Untitled Project"}
                                        </Text>

                                        <View style={styles.metaRow}>
                                            <View style={[styles.badge, { backgroundColor: getRiskColor(item.projectMetadata?.riskLevel, theme) }]}>
                                                <Text style={styles.badgeText}>{item.projectMetadata?.riskLevel || "Low"}</Text>
                                            </View>
                                            <View style={[styles.badge, { backgroundColor: theme.colors.accent, marginLeft: 8 }]}>
                                                <Text style={styles.badgeText}>{status}</Text>
                                            </View>
                                            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginLeft: 12 }}>
                                                {currentStage} • {path}
                                            </Text>
                                        </View>

                                        <View style={{ marginTop: 12 }}>
                                            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                                                <Text style={{ fontWeight: '700' }}>User:</Text> {item.userId || "Unknown"} | <Text style={{ fontWeight: '700' }}>ID:</Text> {item.submissionId}
                                            </Text>
                                        </View>

                                        {description && (
                                            <View style={{ marginTop: 12, padding: 12, backgroundColor: theme.colors.background, borderRadius: 6 }}>
                                                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: 4 }}>
                                                    📋 PROJECT DESCRIPTION
                                                </Text>
                                                <Text style={{ ...theme.typography.caption, color: theme.colors.textPrimary, lineHeight: 18 }}>
                                                    {description}
                                                </Text>
                                            </View>
                                        )}

                                        {agentMessage && (
                                            <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(255, 165, 0, 0.1)', borderRadius: 6, borderLeftWidth: 4, borderLeftColor: theme.colors.warning }}>
                                                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: 4 }}>
                                                    🤖 AGENT ASSESSMENT
                                                </Text>
                                                <Text style={{ ...theme.typography.caption, color: theme.colors.textPrimary, lineHeight: 18 }}>
                                                    {agentMessage}
                                                </Text>
                                            </View>
                                        )}

                                        <View style={{ marginTop: 16 }}>
                                            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: 12 }}>
                                                📊 WORKFLOW PROGRESS
                                            </Text>
                                            <Timeline currentStage={currentStage} theme={theme} />
                                        </View>

                                        {item.governance?.blockers?.length > 0 && (
                                            <View style={styles.blockerSection}>
                                                <Text style={{ ...theme.typography.caption, color: theme.colors.error, fontWeight: '700' }}>⚠️ BLOCKERS</Text>
                                                {item.governance.blockers.map((b, i) => (
                                                    <Text key={i} style={{ ...theme.typography.caption, color: theme.colors.textPrimary, marginTop: 4 }}>• {b}</Text>
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            style={[styles.btn, { backgroundColor: theme.colors.success }]}
                                            onPress={() => handleApprove(item)}
                                        >
                                            <Text style={styles.btnText}>APPROVE</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.btn, { backgroundColor: theme.colors.error, marginLeft: 12 }]}
                                            onPress={() => handleRequestInfo(item)}
                                        >
                                            <Text style={styles.btnText}>REQUEST INFO</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                )}
            </View>
        </ResponsiveWrapper>
    );
};

const Timeline = ({ currentStage, theme }) => {
    const stages = [
        { name: 'Intake', key: 'Intake' },
        { name: 'Risk', key: 'Risk' },
        { name: 'GIGC', key: 'Gatekeeper' },
        { name: 'Pilot', key: 'Pilot' },
        { name: 'Production', key: 'Production' },
        { name: 'Handover', key: 'Outcome' }
    ];

    let currentIndex = stages.findIndex(s => s.key === currentStage);

    // If stage not found, try matching by name (case-insensitive)
    if (currentIndex === -1) {
        currentIndex = stages.findIndex(s => s.name.toLowerCase() === currentStage.toLowerCase());
    }

    // If stage not found, default to first stage (Intake)
    if (currentIndex === -1) {
        console.log(`Timeline: Stage "${currentStage}" not found, defaulting to Intake`);
        currentIndex = 0;
    }

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            {stages.map((stage, index) => {
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;

                return (
                    <React.Fragment key={stage.key}>
                        <View style={{ alignItems: 'center', minWidth: 50 }}>
                            <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: isActive
                                    ? theme.colors.primary
                                    : isCompleted
                                        ? theme.colors.success
                                        : theme.colors.border,
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: isActive ? 3 : 0,
                                borderColor: theme.colors.accent,
                                shadowColor: isActive ? theme.colors.primary : 'transparent',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: isActive ? 4 : 0
                            }}>
                                <Text style={{
                                    color: isActive || isCompleted ? '#FFF' : theme.colors.textSecondary,
                                    fontSize: 12,
                                    fontWeight: '700'
                                }}>
                                    {isCompleted ? '✓' : index + 1}
                                </Text>
                            </View>
                            <Text style={{
                                fontSize: 10,
                                marginTop: 6,
                                color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                                fontWeight: isActive ? '700' : '400',
                                textAlign: 'center'
                            }}>
                                {stage.name}
                            </Text>
                        </View>
                        {index < stages.length - 1 && (
                            <View style={{
                                flex: 1,
                                height: 3,
                                backgroundColor: isCompleted ? theme.colors.success : theme.colors.border,
                                marginHorizontal: 4,
                                marginBottom: 24,
                                borderRadius: 2
                            }} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
};

const getRiskColor = (level, theme) => {
    switch (level) {
        case 'High': return theme.colors.error;
        case 'Med': return theme.colors.warning;
        default: return theme.colors.success;
    }
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 20,
        maxWidth: 1000,
        width: '100%',
        alignSelf: 'center'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    refresh: {
        padding: 8
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    empty: {
        padding: 40,
        alignItems: 'center'
    },
    card: {
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    cardInfo: {
        flex: 1,
        marginBottom: 16
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700'
    },
    blockerSection: {
        marginTop: 12,
        padding: 12,
        backgroundColor: 'rgba(255,0,0,0.05)',
        borderRadius: 6,
        borderLeftWidth: 4,
        borderLeftColor: '#ff0000'
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end'
    },
    btn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
        minWidth: 120,
        alignItems: 'center'
    },
    btnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 12
    }
});

export default AdminQueue;

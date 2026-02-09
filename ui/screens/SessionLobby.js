import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';
import { getShadow } from '../utils/shadows';

/**
 * SessionLobby Screen
 * 
 * Lists all previous governance sessions for the user.
 * Allows switching between projects or starting a new one.
 */
const SessionLobby = ({ userId, actions, onSelectSession, onNewSession }) => {
    const { theme } = useAiguTheme();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, [userId]);

    const loadSessions = async () => {
        setLoading(true);
        const data = await actions.fetchSessions(userId);
        // Sort by timestamp if available or ID
        const sorted = (data || []).sort((a, b) => {
            const dateA = a.projectMetadata?.createdAt || '';
            const dateB = b.projectMetadata?.createdAt || '';
            return dateB.localeCompare(dateA);
        });
        setSessions(sorted);
        setLoading(false);
    };

    const renderItem = ({ item }) => {
        const metadata = item.projectMetadata || {};
        const governance = item.governance || {};
        const status = governance.status || 'Draft';
        const stage = metadata.currentStage || 'Intake';
        const name = metadata.name || item.submissionId;

        return (
            <TouchableOpacity
                style={[styles.sessionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => onSelectSession(item.submissionId)}
            >
                <View style={styles.cardHeader}>
                    <Text style={[styles.projectName, { color: theme.colors.textPrimary }]}>{name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status, theme) }]}>
                        <Text style={styles.statusText}>{status}</Text>
                    </View>
                </View>

                <Text style={[styles.projectId, { color: theme.colors.textSecondary }]}>ID: {item.submissionId}</Text>

                <View style={styles.cardFooter}>
                    <Text style={[styles.stageLabel, { color: theme.colors.primary }]}>{stage.toUpperCase()}</Text>
                    <Text style={[styles.pathLabel, { color: theme.colors.textSecondary }]}>{metadata.path || 'In-Analysis'}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const getStatusColor = (status, theme) => {
        switch (status) {
            case 'Approved':
            case 'POC-Approved':
            case 'Production-Ready':
            case 'Live':
                return theme.colors.success;
            case 'Blocked':
                return theme.colors.error;
            case 'In-Review':
            case 'Pending':
                return theme.colors.warning;
            default: return theme.colors.border;
        }
    };

    return (
        <ResponsiveWrapper>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Project Lobby</Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Select an existing session for {userId}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.newButton, { backgroundColor: theme.colors.primary }]}
                        onPress={onNewSession}
                    >
                        <Text style={styles.newButtonText}>+ NEW PROJECT</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={sessions}
                        renderItem={renderItem}
                        keyExtractor={item => item.submissionId}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={{ color: theme.colors.textSecondary }}>No active sessions found.</Text>
                                <TouchableOpacity onPress={onNewSession} style={{ marginTop: 12 }}>
                                    <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Start your first project →</Text>
                                </TouchableOpacity>
                            </View>
                        }
                    />
                )}
            </View>
        </ResponsiveWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5
    },
    subtitle: {
        fontSize: 14,
        marginTop: 4
    },
    newButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        ...getShadow('#000', { width: 0, height: 2 }, 0.1, 4, 3)
    },
    newButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 13
    },
    listContent: {
        paddingBottom: 40
    },
    sessionCard: {
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        ...getShadow('#000', { width: 0, height: 2 }, 0.05, 8, 2)
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    projectName: {
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
        marginRight: 12
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6
    },
    statusText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    projectId: {
        fontSize: 12,
        fontFamily: 'monospace',
        marginBottom: 16
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(128,128,128,0.1)',
        paddingTop: 16
    },
    stageLabel: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1
    },
    pathLabel: {
        fontSize: 11,
        fontStyle: 'italic'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300
    },
    emptyContainer: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center'
    }
});

export default SessionLobby;

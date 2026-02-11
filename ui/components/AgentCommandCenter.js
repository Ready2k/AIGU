import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import RiskCockpit from './RiskCockpit';
import LibrarianCockpit from './LibrarianCockpit';

const AgentCommandCenter = ({ actions }) => {
    const { theme } = useAiguTheme();
    const [activeCockpit, setActiveCockpit] = useState('risk'); // 'risk' | 'librarian'
    const [configs, setConfigs] = useState({ risk: null, librarian: null });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAllConfigs();
    }, []);

    const fetchAllConfigs = async () => {
        setLoading(true);
        try {
            const riskConfig = await actions.fetchAgentConfig('risk_agent');
            const librarianConfig = await actions.fetchAgentConfig('librarian_agent');
            setConfigs({
                risk: riskConfig?.config || null,
                librarian: librarianConfig?.config || null
            });
        } catch (error) {
            console.error("Failed to load configs", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (agentId, data) => {
        setSaving(true);
        try {
            await actions.updateAgentConfig(agentId, data);
            // In a real app, we'd show a toast here. For now, we'll just refresh.
            await fetchAllConfigs();
            alert("✅ Configuration Updated Successfully");
        } catch (error) {
            console.error("Save failed", error);
            alert("❌ Failed to update configuration");
        } finally {
            setSaving(false);
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
        <View style={styles.container}>
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, fontSize: 22 }}>
                    🕹️ Agent Command Center
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 4 }}>
                    Tune agent logic and guardrails in real-time.
                </Text>
            </View>

            <View style={styles.content}>
                {/* Internal Sidebar */}
                <View style={[styles.miniSidebar, { backgroundColor: theme.colors.surface, borderRightColor: theme.colors.border }]}>
                    <TouchableOpacity
                        style={[styles.navItem, activeCockpit === 'risk' && { backgroundColor: theme.colors.primary + '15' }]}
                        onPress={() => setActiveCockpit('risk')}
                    >
                        <Text style={{
                            color: activeCockpit === 'risk' ? theme.colors.primary : theme.colors.textSecondary,
                            fontWeight: activeCockpit === 'risk' ? '700' : '500'
                        }}>
                            Risk Triage
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.navItem, activeCockpit === 'librarian' && { backgroundColor: theme.colors.primary + '15' }]}
                        onPress={() => setActiveCockpit('librarian')}
                    >
                        <Text style={{
                            color: activeCockpit === 'librarian' ? theme.colors.primary : theme.colors.textSecondary,
                            fontWeight: activeCockpit === 'librarian' ? '700' : '500'
                        }}>
                            Gov Librarian
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Cockpit View */}
                <ScrollView style={styles.cockpitView}>
                    {activeCockpit === 'risk' && (
                        <RiskCockpit
                            config={configs.risk}
                            onSave={(data) => handleSave('risk_agent', data)}
                            isLoading={saving}
                        />
                    )}
                    {activeCockpit === 'librarian' && (
                        <LibrarianCockpit
                            config={configs.librarian}
                            onSave={(data) => handleSave('librarian_agent', data)}
                            isLoading={saving}
                        />
                    )}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: 16,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    miniSidebar: {
        width: 180,
        borderRightWidth: 1,
        padding: 8,
    },
    navItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 4,
    },
    cockpitView: {
        flex: 1,
    }
});

export default AgentCommandCenter;

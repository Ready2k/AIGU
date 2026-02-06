import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';

const AdminDashboard = ({ actions }) => {
    const { theme, toggleTheme, isDark } = useAiguTheme();
    const { width } = useWindowDimensions();

    // Grid Logic
    const isDesktop = width >= 768;
    // On Desktop, cards take ~48% to fit 2 per row. On Mobile, 100%.
    const cardWidth = isDesktop ? '48%' : '100%';

    return (
        <ResponsiveWrapper>
            <View style={styles.headerRow}>
                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary }}>
                    Admin Dashboard
                </Text>

                {/* Theme Toggle in Header */}
                <View style={styles.toggleRow}>
                    <Text style={{ ...theme.typography.caption, marginRight: 8 }}>
                        {isDark ? 'Dark Mode' : 'Light Mode'}
                    </Text>
                    <Switch
                        value={isDark}
                        onValueChange={toggleTheme}
                        trackColor={{ false: '#767577', true: theme.colors.secondary }}
                        thumbColor={isDark ? theme.colors.textPrimary : '#f4f3f4'}
                    />
                </View>
            </View>

            <View style={[styles.gridContainer, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }]}>

                {/* 1. Tribe Rules Card */}
                <View style={[styles.card, { backgroundColor: theme.colors.surface, width: cardWidth, borderColor: theme.colors.border }]}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.primary, marginBottom: 12 }}>
                        Tribe Rules
                    </Text>
                    <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary }}>
                        Global compliance rules applied to all Intake workflows.
                    </Text>
                    <View style={styles.statRow}>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>Active Rules: 12</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.colors.accent }]}
                        onPress={() => alert("Manage Rules")}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Manage Rules</Text>
                    </TouchableOpacity>
                </View>

                {/* 2. Global Guardrails Card */}
                <View style={[styles.card, { backgroundColor: theme.colors.surface, width: cardWidth, borderColor: theme.colors.border }]}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.primary, marginBottom: 12 }}>
                        Global Guardrails
                    </Text>
                    <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary }}>
                        System-wide thresholds for Risk, Delta Analysis, and Budget.
                    </Text>
                    <View style={styles.statRow}>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>Delta Threshold: 15%</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.colors.accent }]}
                        onPress={() => alert("Update Guardrails")}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Update Guardrails</Text>
                    </TouchableOpacity>
                </View>

                {/* 3. System Health (Full Width on Mobile, Grid on Large) */}
                <View style={[styles.card, { backgroundColor: theme.colors.surface, width: '100%', marginTop: 24, borderColor: theme.colors.border }]}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.primary }}>
                        System Health
                    </Text>
                    <Text style={{ ...theme.typography.mono, color: theme.colors.textSecondary, marginTop: 8 }}>
                        Dependencies: All Systems Operational{'\n'}
                        Latency: 45ms (us-east-1)
                    </Text>
                </View>

            </View>
        </ResponsiveWrapper>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    gridContainer: {
        // FlexWrap is handled inline for dynamic width access
    },
    card: {
        padding: 20,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    statRow: {
        marginTop: 8,
        marginBottom: 16
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 4,
        alignSelf: 'flex-start'
    }
});

export default AdminDashboard;

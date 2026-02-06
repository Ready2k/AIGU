import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';

/**
 * NavigationBreadcrumbs Component
 * 
 * Provides a persistent breadcrumb trail for the application.
 * Allows users to navigate back to the Lobby or switch project context.
 */
const NavigationBreadcrumbs = ({ userId, projectName, currentStage, isAdmin, onBackToLobby, onLogout }) => {
    const { theme } = useAiguTheme();

    return (
        <View style={[styles.wrapper, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <View style={styles.container}>
                {/* Breadcrumb Trail */}
                <View style={styles.crumbRow}>
                    <TouchableOpacity onPress={onBackToLobby} style={styles.crumbItem}>
                        <Text style={[styles.crumbText, { color: theme.colors.primary }]}>Lobby</Text>
                    </TouchableOpacity>

                    <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>/</Text>

                    {isAdmin ? (
                        <View style={styles.crumbItem}>
                            <Text style={[styles.crumbText, { color: theme.colors.textPrimary, fontWeight: '700' }]}>
                                Admin Queue 🛡️
                            </Text>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity onPress={onBackToLobby} style={styles.crumbItem}>
                                <Text style={[styles.crumbText, { color: theme.colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                                    {projectName || 'Current Project'}
                                </Text>
                            </TouchableOpacity>

                            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>/</Text>

                            <View style={styles.crumbItem}>
                                <Text style={[styles.crumbText, { color: theme.colors.textSecondary }]}>
                                    {currentStage || 'Intake'}
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                {/* User Info & Logout */}
                <View style={styles.userSection}>
                    <View style={[styles.userBadge, { backgroundColor: theme.colors.background }]}>
                        <Text style={[styles.userText, { color: theme.colors.textPrimary }]}>
                            {userId}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
                        <Text style={{ color: theme.colors.error, fontSize: 12, fontWeight: '700' }}>LOGOUT</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        borderBottomWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 20,
        zIndex: 100
    },
    container: {
        maxWidth: 1200,
        width: '100%',
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    crumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    crumbItem: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4
    },
    crumbText: {
        fontSize: 14,
        fontWeight: '500'
    },
    separator: {
        fontSize: 14,
        marginHorizontal: 4
    },
    userSection: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    userBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)'
    },
    userText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    logoutButton: {
        padding: 6
    }
});

export default NavigationBreadcrumbs;

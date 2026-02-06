import React, { useState } from 'react';
import { View, Text, SafeAreaView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import RootNavigator from './navigation/RootNavigator';
import SessionLobby from './screens/SessionLobby';
import DevConsole from './screens/DevConsole';
import NavigationBreadcrumbs from './components/NavigationBreadcrumbs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAiguTheme } from './theme/ThemeContext';
import { useAiguState } from './hooks/useAiguState';

function AppContent() {
    const { theme } = useAiguTheme();

    const [submissionId, setSubmissionId] = useState(null);
    const [userId, setUserId] = useState('demo-user-123');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [showDevConsole, setShowDevConsole] = useState(false);

    const isAdmin = userId.toLowerCase() === 'admin';
    const { actions } = useAiguState(submissionId || 'temp', userId);

    if (showDevConsole) {
        return <DevConsole actions={actions} onClose={() => setShowDevConsole(false)} />;
    }

    const handleBackToLobby = () => setSubmissionId(null);
    const handleLogout = () => {
        setIsLoggedIn(false);
        setSubmissionId(null);
    };

    if (!isLoggedIn) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.card, {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderWidth: theme.mode === 'dark' ? 1.5 : 1
                }]}>
                    <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, textAlign: 'center' }}>
                        AIGU Workspace
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                        Secure Governance Environment
                    </Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>User Identity</Text>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: theme.mode === 'dark' ? theme.colors.background : '#F9FAFB',
                                color: theme.colors.textPrimary,
                                borderColor: theme.colors.border
                            }]}
                            value={userId}
                            onChangeText={setUserId}
                            placeholder="e.g. jcregeen or your name"
                            placeholderTextColor={theme.colors.textSecondary}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.colors.primary }]}
                        onPress={() => setIsLoggedIn(true)}
                    >
                        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Enter Workspace</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ marginTop: 16, alignItems: 'center' }}
                        onPress={() => setShowDevConsole(true)}
                    >
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>⚙️ CONFIGURE AWS CREDENTIALS</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (!submissionId && !isAdmin) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
                <NavigationBreadcrumbs
                    userId={userId}
                    projectName="Project Selection"
                    currentStage="Lobby"
                    isAdmin={false}
                    onBackToLobby={handleBackToLobby}
                    onLogout={handleLogout}
                />
                <SessionLobby
                    userId={userId}
                    actions={actions}
                    onSelectSession={(id) => setSubmissionId(id)}
                    onNewSession={() => setSubmissionId(`proj-${Date.now()}`)}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <RootNavigator
                submissionId={submissionId || 'admin-global'}
                userId={userId}
                isAdmin={isAdmin}
                onBackToLobby={handleBackToLobby}
                onLogout={handleLogout}
            />
        </SafeAreaView>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <SafeAreaProvider>
                <AppContent />
            </SafeAreaProvider>
        </ThemeProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: 400,
        padding: 40,
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5
    },
    inputGroup: {
        marginTop: 32,
        marginBottom: 24
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 14,
        marginBottom: 20,
        fontSize: 16
    },
    button: {
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center'
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16
    }
});

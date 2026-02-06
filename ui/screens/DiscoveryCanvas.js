import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';

const DiscoveryCanvas = ({ actions }) => {
    const { theme } = useAiguTheme();
    const [description, setDescription] = useState('');

    return (
        <ResponsiveWrapper>
            <View style={styles.formContainer}>
                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, marginBottom: theme.spacing.md }}>
                    Discovery Canvas
                </Text>

                <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
                    Describe your project idea below. AIGU will analyze keywords to determine the governance path and risk level.
                </Text>

                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.primary, marginBottom: theme.spacing.sm }}>
                        Project Description
                    </Text>

                    <TextInput
                        style={[styles.input, {
                            backgroundColor: theme.colors.background,
                            color: theme.colors.textPrimary,
                            borderColor: theme.colors.border,
                            ...theme.typography.body
                        }]}
                        placeholder="e.g. Implementing a new GenAI Accelerator for marketing..."
                        placeholderTextColor={theme.colors.textSecondary}
                        multiline
                        numberOfLines={6}
                        value={description}
                        onChangeText={setDescription}
                    />

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.colors.accent }]}
                        onPress={() => actions.initiateIntake({ description })}
                    >
                        <Text style={styles.buttonText}>Submit to AIGU</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ResponsiveWrapper>
    );
};

const styles = StyleSheet.create({
    formContainer: {
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    card: {
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 16,
        minHeight: 120,
        textAlignVertical: 'top',
        marginBottom: 24
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center'
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16
    }
});

export default DiscoveryCanvas;

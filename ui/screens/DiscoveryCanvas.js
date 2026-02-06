import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';

const DiscoveryCanvas = ({ actions, initialData = {}, isRemediation = false, setRemediating }) => {
    const { theme } = useAiguTheme();
    const [projectName, setProjectName] = useState(initialData.projectName || '');
    const [description, setDescription] = useState(initialData.description || '');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        // Validation
        if (!projectName.trim()) {
            Alert.alert('Missing Information', 'Please enter a project name.');
            return;
        }
        if (!description.trim()) {
            Alert.alert('Missing Information', 'Please enter a project description.');
            return;
        }

        setSubmitting(true);
        try {
            await actions.initiateIntake({
                projectName: projectName.trim(),
                description: description.trim()
            });
            if (setRemediating) setRemediating(false);
        } catch (error) {
            console.error('Failed to submit intake:', error);
            Alert.alert('Error', 'Failed to submit project. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ResponsiveWrapper>
            <View style={styles.formContainer}>
                <Text style={{ ...theme.typography.header, color: isRemediation ? theme.colors.error : theme.colors.textPrimary, marginBottom: theme.spacing.md }}>
                    {isRemediation ? '🛠️ Project Remediation' : 'Discovery Canvas'}
                </Text>

                <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
                    {isRemediation
                        ? 'Please update your project to align with corporate safety policies. Remove any references to unverified external services.'
                        : 'Describe your project idea below. AIGU will analyze it to determine the governance path and risk level.'}
                </Text>

                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    {/* Project Name Field */}
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.primary, marginBottom: theme.spacing.sm }}>
                        Project Name
                    </Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: theme.colors.background,
                            color: theme.colors.textPrimary,
                            borderColor: theme.colors.border,
                            ...theme.typography.body,
                            minHeight: 50
                        }]}
                        placeholder="e.g. Marketing GenAI Accelerator"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={projectName}
                        onChangeText={setProjectName}
                    />

                    {/* Project Description Field */}
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.primary, marginBottom: theme.spacing.sm, marginTop: 16 }}>
                        Project Description
                    </Text>

                    <TextInput
                        style={[styles.input, {
                            backgroundColor: theme.colors.background,
                            color: theme.colors.textPrimary,
                            borderColor: theme.colors.border,
                            ...theme.typography.body
                        }]}
                        placeholder="e.g. Implementing a new GenAI Accelerator for marketing content generation using Amazon Bedrock..."
                        placeholderTextColor={theme.colors.textSecondary}
                        multiline
                        numberOfLines={6}
                        value={description}
                        onChangeText={setDescription}
                    />

                    <TouchableOpacity
                        style={[styles.button, {
                            backgroundColor: submitting ? theme.colors.border : theme.colors.accent,
                            opacity: submitting ? 0.6 : 1
                        }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        <Text style={styles.buttonText}>
                            {submitting ? 'SUBMITTING...' : (isRemediation ? 'RE-SUBMIT FOR REVIEW' : 'Submit to AIGU')}
                        </Text>
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

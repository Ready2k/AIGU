import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';
import { saveCredentials, getCredentials } from '../utils/auth';

const DevConsole = ({ onClose, actions }) => {
    const { theme } = useAiguTheme();
    const [accessKey, setAccessKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [sessionToken, setSessionToken] = useState('');
    const [loading, setLoading] = useState(false);

    // Model Selection State
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [configLoading, setConfigLoading] = useState(false);

    useEffect(() => {
        loadExisting();
        if (actions?.fetchModels) {
            loadModels();
        }
    }, []);

    const loadExisting = async () => {
        const creds = await getCredentials();
        if (creds) {
            setAccessKey(creds.accessKeyId);
            setSecretKey(creds.secretAccessKey);
            setSessionToken(creds.sessionToken);
        }

        if (actions?.fetchConfig) {
            const config = await actions.fetchConfig();
            if (config.novaModelId) {
                setSelectedModel(config.novaModelId);
            }
        }
    };

    const loadModels = async () => {
        const modelList = await actions.fetchModels();
        setModels(modelList);
    };

    const handleSaveModel = async (modelId) => {
        setSelectedModel(modelId);
        setConfigLoading(true);
        await actions.updateConfig({ novaModelId: modelId });
        setConfigLoading(false);
        Alert.alert("Success", `Active model switched to ${modelId}`);
    };

    const handleSave = async () => {
        setLoading(true);
        const success = await saveCredentials({
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
            sessionToken: sessionToken
        });
        setLoading(false);

        if (success) {
            Alert.alert("Success", "AWS Session Credentials saved locally.");
            if (onClose) onClose();
        } else {
            Alert.alert("Error", "Failed to save credentials.");
        }
    };

    return (
        <ResponsiveWrapper>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary }}>
                        Developer Console 🛠️
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 8 }}>
                        Enter temporary AWS Landing Zone credentials to enable E2E testing.
                        These are stored securely in local storage and never synced.
                    </Text>
                </View>

                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, marginBottom: 24 }]}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.primary, marginBottom: 16 }}>
                        🧠 LLM BRAIN CONFIGURATION
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 20 }}>
                        Select the active Amazon Nova model for reasoning.
                    </Text>

                    <View style={styles.modelList}>
                        {models.map((m) => (
                            <TouchableOpacity
                                key={m.modelId}
                                style={[
                                    styles.modelItem,
                                    { borderColor: theme.colors.border },
                                    selectedModel === m.modelId && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                                ]}
                                onPress={() => handleSaveModel(m.modelId)}
                                disabled={configLoading}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={{ ...theme.typography.body, fontWeight: '700', color: theme.colors.textPrimary }}>
                                        {m.modelName}
                                    </Text>
                                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                                        {m.modelId}
                                    </Text>
                                </View>
                                {selectedModel === m.modelId && (
                                    <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>ACTIVE</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                        {models.length === 0 && (
                            <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic' }}>Loading available models...</Text>
                        )}
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.primary, marginBottom: 16 }}>
                        🔐 AWS GATEWAY CREDENTIALS
                    </Text>
                    <InputModule label="Access Key ID" value={accessKey} onChange={setAccessKey} theme={theme} />
                    <InputModule label="Secret Access Key" value={secretKey} onChange={setSecretKey} secure theme={theme} />
                    <InputModule label="Session Token" value={sessionToken} onChange={setSessionToken} multiline theme={theme} />

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.colors.secondary }]}
                            onPress={handleSave}
                        >
                            <Text style={styles.buttonText}>{loading ? "Saving..." : "Save Credentials"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.closeButton, { borderColor: theme.colors.border }]}
                            onPress={onClose}
                        >
                            <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Close Console</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ResponsiveWrapper>
    );
};

const InputModule = ({ label, value, onChange, secure, multiline, theme }) => (
    <View style={styles.inputContainer}>
        <Text style={{ ...theme.typography.subheader, fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>
            {label.toUpperCase()}
        </Text>
        <TextInput
            style={[styles.input, {
                backgroundColor: theme.colors.background,
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
                ...theme.typography.mono,
                height: multiline ? 120 : 50
            }]}
            value={value}
            onChangeText={onChange}
            secureTextEntry={secure}
            multiline={multiline}
            placeholder={`Enter ${label}`}
            placeholderTextColor={theme.colors.textSecondary + '80'}
            textAlignVertical={multiline ? 'top' : 'center'}
        />
    </View>
);

const styles = StyleSheet.create({
    container: {
        maxWidth: 650,
        width: '100%',
        alignSelf: 'center',
    },
    header: {
        marginBottom: 32
    },
    card: {
        padding: 32,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3
    },
    inputContainer: {
        marginBottom: 20
    },
    modelList: {
        marginTop: 8
    },
    modelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12
    },
    input: {
        borderWidth: 1,
        borderRadius: 6,
        padding: 14,
    },
    actions: {
        marginTop: 24
    },
    saveButton: {
        paddingVertical: 14,
        borderRadius: 6,
        alignItems: 'center',
        marginBottom: 12
    },
    closeButton: {
        paddingVertical: 14,
        borderRadius: 6,
        borderWidth: 1,
        alignItems: 'center'
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16
    }
});

export default DevConsole;

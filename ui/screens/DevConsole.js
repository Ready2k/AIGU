import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, ScrollView, Alert } from 'react-native';
import { AIGU_THEME } from '../theme/ThemeConfig';
import { saveCredentials, getCredentials } from '../utils/auth';

const DevConsole = ({ onClose }) => {
    const [accessKey, setAccessKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [sessionToken, setSessionToken] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadExisting();
    }, []);

    const loadExisting = async () => {
        const creds = await getCredentials();
        if (creds) {
            setAccessKey(creds.accessKeyId);
            setSecretKey(creds.secretAccessKey);
            setSessionToken(creds.sessionToken);
        }
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
        <ScrollView style={{ flex: 1, padding: AIGU_THEME.spacing.lg, backgroundColor: AIGU_THEME.colors.background }}>
            <View style={{ marginBottom: AIGU_THEME.spacing.xl }}>
                <Text style={{ ...AIGU_THEME.typography.header, color: AIGU_THEME.colors.primary }}>
                    Developer Console 🛠️
                </Text>
                <Text style={AIGU_THEME.typography.caption}>
                    Enter temporary AWS Landing Zone credentials to enable E2E testing.
                    These are stored securely in local storage and never synced.
                </Text>
            </View>

            <InputModule label="Access Key ID" value={accessKey} onChange={setAccessKey} />
            <InputModule label="Secret Access Key" value={secretKey} onChange={setSecretKey} secure />
            <InputModule label="Session Token" value={sessionToken} onChange={setSessionToken} multiline />

            <View style={{ marginTop: AIGU_THEME.spacing.lg }}>
                <Button
                    title={loading ? "Saving..." : "Save Credentials"}
                    onPress={handleSave}
                    color={AIGU_THEME.colors.secondary}
                />
            </View>

            <View style={{ marginTop: AIGU_THEME.spacing.md }}>
                <Button
                    title="Close"
                    onPress={onClose}
                    color={AIGU_THEME.colors.textSecondary}
                />
            </View>
        </ScrollView>
    );
};

const InputModule = ({ label, value, onChange, secure, multiline }) => (
    <View style={{ marginBottom: AIGU_THEME.spacing.md }}>
        <Text style={{ ...AIGU_THEME.typography.subheader, fontSize: 14, marginBottom: AIGU_THEME.spacing.sm }}>
            {label}
        </Text>
        <TextInput
            style={{
                backgroundColor: AIGU_THEME.colors.surface,
                padding: AIGU_THEME.spacing.md,
                borderRadius: AIGU_THEME.borderRadius.sm,
                ...AIGU_THEME.shadows.card,
                height: multiline ? 100 : 50
            }}
            value={value}
            onChangeText={onChange}
            secureTextEntry={secure}
            multiline={multiline}
            placeholder={`Enter ${label}`}
            placeholderTextColor="#999"
        />
    </View>
);

export default DevConsole;

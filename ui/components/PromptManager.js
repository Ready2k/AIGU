import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import { useAiguState } from '../hooks/useAiguState';

const PromptManager = ({ userId }) => {
    const { theme } = useAiguTheme();
    // Use 'admin-prompts' as dummy ID to initialize hook without fetching valid project state
    const { actions } = useAiguState('admin-prompts', userId);

    // UI State
    const [prompts, setPrompts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedPrompt, setSelectedPrompt] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [saving, setSaving] = useState(false);

    const loadPrompts = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await actions.fetchPrompts();
            if (Array.isArray(data)) {
                setPrompts(data);
            } else {
                // If API returns error object
                setError(data?.error || "Failed to load prompts.");
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPrompts();
    }, []);

    const handleSelectPrompt = (prompt) => {
        setSelectedPrompt(prompt);
        setEditedContent(prompt.content);
        setEditMode(false);
        setError(null);
    };

    const handleSave = async () => {
        if (!selectedPrompt) return;
        setSaving(true);
        try {
            await actions.updatePrompt(selectedPrompt.name, editedContent, selectedPrompt.tags);
            Alert.alert("Success", "Prompt updated successfully.");
            setEditMode(false);

            // Update local state to reflect changes immediately
            const updatedPrompt = { ...selectedPrompt, content: editedContent };
            setSelectedPrompt(updatedPrompt);

            // Refresh full list in background
            const list = await actions.fetchPrompts();
            if (Array.isArray(list)) setPrompts(list);

        } catch (e) {
            Alert.alert("Error", "Failed to save prompt: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    // Render List
    const renderList = () => (
        <ScrollView style={styles.list}>
            {prompts.map((prompt, index) => (
                <TouchableOpacity
                    key={index}
                    style={[styles.card, {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border
                    }]}
                    onPress={() => handleSelectPrompt(prompt)}
                >
                    <View style={styles.cardHeader}>
                        <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary }}>
                            {prompt.name}
                        </Text>
                        <View style={[styles.tag, { backgroundColor: theme.colors.success }]}>
                            <Text style={{ color: '#fff', fontSize: 10 }}>
                                v{prompt.version || '1'}
                            </Text>
                        </View>
                    </View>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                        Type: {prompt.type || 'text'}
                    </Text>
                </TouchableOpacity>
            ))}
            {prompts.length === 0 && !loading && (
                <Text style={{ color: theme.colors.textSecondary, marginTop: 20, textAlign: 'center' }}>
                    No prompts found. Ensure backend is synced with LangFuse.
                </Text>
            )}
        </ScrollView>
    );

    // Render Detail
    const renderDetail = () => (
        <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
                <TouchableOpacity onPress={() => setSelectedPrompt(null)} style={{ paddingRight: 10 }}>
                    <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
                </TouchableOpacity>
                <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, flex: 1 }}>
                    {selectedPrompt.name}
                </Text>
                {!editMode ? (
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => setEditMode(true)}
                    >
                        <Text style={{ color: '#fff' }}>Edit</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.border, marginRight: 8 }]}
                            onPress={() => { setEditMode(false); setEditedContent(selectedPrompt.content); }}
                        >
                            <Text style={{ color: theme.colors.textPrimary }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff' }}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {editMode ? (
                <View style={[styles.editorContainer, { backgroundColor: theme.colors.background }]}>
                    <TextInput
                        style={[styles.editorInput, { color: theme.colors.textPrimary, fontFamily: 'monospace' }]}
                        multiline
                        value={editedContent}
                        onChangeText={setEditedContent}
                    />
                </View>
            ) : (
                <ScrollView style={[styles.previewContainer, { backgroundColor: theme.colors.background }]}>
                    <Text style={{ color: theme.colors.textSecondary, fontFamily: 'monospace' }}>
                        {selectedPrompt.content}
                    </Text>
                </ScrollView>
            )}

            <View style={{ marginTop: 16 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                    LangFuse Tags: {(selectedPrompt.tags || []).join(', ')} | Version: {selectedPrompt.version}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary }}>
                    System Prompts (LangFuse)
                </Text>
                {!selectedPrompt && (
                    <TouchableOpacity
                        style={[styles.syncButton, { backgroundColor: theme.colors.primary }]}
                        onPress={loadPrompts}
                    >
                        {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Sync</Text>}
                    </TouchableOpacity>
                )}
            </View>

            {error && <Text style={{ color: theme.colors.error, marginBottom: 10 }}>{error}</Text>}

            {selectedPrompt ? renderDetail() : renderList()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    syncButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
    list: { flex: 1 },
    card: { padding: 16, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    tag: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
    detailContainer: { flex: 1 },
    detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'space-between' },
    actionButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    previewContainer: { flex: 1, padding: 16, borderRadius: 8 },
    editorContainer: { flex: 1, padding: 16, borderRadius: 8 },
    editorInput: { flex: 1, textAlignVertical: 'top' },
});

export default PromptManager;

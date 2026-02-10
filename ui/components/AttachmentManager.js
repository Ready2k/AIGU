
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import { getShadow } from '../utils/shadows';

export const AttachmentManager = ({ projectId, files, artifacts, onUploadSuccess, onDelete, userId, submissionId, getUploadUrl }) => {
    const { theme } = useAiguTheme();
    const [deleting, setDeleting] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Support both array (system standard) and object (user request legacy)
    let displayList = [];
    if (Array.isArray(files)) {
        displayList = files.map(f => ({ name: f.name, url: f.presignedUrl }));
    } else if (artifacts) {
        displayList = Object.entries(artifacts).map(([k, v]) => ({ name: k, url: v }));
    }

    const handleDelete = async (filename) => {
        if (!onDelete) {
            Alert.alert("Error", "Delete function not provided.");
            return;
        }

        setDeleting(filename);
        try {
            await onDelete(filename);

            // Hydrate parent state
            if (onUploadSuccess) {
                onUploadSuccess();
            }
            Alert.alert("Success", "File removed.");

        } catch (e) {
            Alert.alert("Error", e.message);
        } finally {
            setDeleting(null);
        }
    };

    const handleUpload = async (file) => {
        if (!getUploadUrl) {
            Alert.alert("Error", "Upload function not provided.");
            return;
        }

        setUploading(true);
        try {
            // 1. Get Pre-Signed URL
            const uploadData = await getUploadUrl({
                fileName: file.name,
                fileType: file.type,
                submissionId: submissionId,
                userId: userId
            });

            // 2. Upload to S3
            const formData = new FormData();
            Object.keys(uploadData.fields).forEach(key => {
                formData.append(key, uploadData.fields[key]);
            });
            formData.append('file', file);

            const response = await fetch(uploadData.url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error("Upload to S3 failed.");
            }

            // 3. Notify Parent to Refresh
            Alert.alert("Success", "File uploaded.");
            if (onUploadSuccess) onUploadSuccess();

        } catch (e) {
            Alert.alert("Error", e.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <View style={styles.container}>
            {displayList.length === 0 ? (
                <View style={[styles.emptyContainer, { borderColor: theme.colors.border }]}>
                    <Text style={{ color: theme.colors.textSecondary }}>No attachments yet.</Text>
                </View>
            ) : (
                displayList.map(({ name, url }) => (
                    <View key={name} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={styles.fileInfo}>
                            <Text style={styles.icon}>📄</Text>
                            <TouchableOpacity onPress={() => url ? Linking.openURL(url) : null}>
                                <Text style={[styles.link, { color: theme.colors.primary }]}>{name}</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={() => handleDelete(name)}
                            disabled={deleting === name}
                            style={styles.deleteBtn}
                        >
                            {deleting === name ? (
                                <ActivityIndicator size="small" color={theme.colors.error} />
                            ) : (
                                <Text style={styles.deleteIcon}>🗑️</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ))
            )}

            {/* Upload Button */}
            <View style={styles.uploadContainer}>
                {uploading ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                    <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.primary }]}>
                        <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>+ Upload New Artifact</Text>
                        <input
                            type="file"
                            style={{
                                position: 'absolute',
                                opacity: 0,
                                width: '100%',
                                height: '100%',
                                cursor: 'pointer',
                                top: 0,
                                left: 0
                            }}
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    handleUpload(e.target.files[0]);
                                }
                            }}
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 10,
    },
    emptyContainer: {
        padding: 20,
        borderWidth: 1,
        borderRadius: 8,
        borderStyle: 'dashed',
        alignItems: 'center',
        marginBottom: 10
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        ...getShadow('#000', { width: 0, height: 2 }, 0.05, 4, 2)
    },
    fileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    icon: {
        marginRight: 10,
        fontSize: 16
    },
    link: {
        fontSize: 14,
        textDecorationLine: 'underline'
    },
    deleteBtn: {
        padding: 8
    },
    deleteIcon: {
        fontSize: 16
    },
    uploadContainer: {
        marginTop: 10
    },
    uploadButton: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
    }
});

export default AttachmentManager;

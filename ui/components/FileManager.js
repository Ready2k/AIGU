import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import { useAiguState } from '../hooks/useAiguState';

/**
 * FileManager Component - S3 Upload & Gallery
 * 
 * Features:
 * - Drag-and-Drop upload zone
 * - File gallery with thumbnails
 * - Pre-signed URL viewing
 * - Support for PDFs, Images, and Diagrams
 */
const FileManager = ({ submissionId, userId }) => {
    const { theme } = useAiguTheme();
    const { actions } = useAiguState(submissionId, userId);
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load files on mount
    useEffect(() => {
        loadFiles();
    }, [submissionId]);

    const loadFiles = async () => {
        try {
            setLoading(true);
            const fileList = await actions.listFiles(submissionId);
            setFiles(fileList);
        } catch (error) {
            console.error('Failed to load files:', error);
        } finally {
            setLoading(false);
        }
    };

    // Handle file drop
    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const droppedFiles = Array.from(e.dataTransfer?.files || []);
        if (droppedFiles.length > 0) {
            await uploadFiles(droppedFiles);
        }
    }, [submissionId, userId]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    }, []);

    // Upload files to S3
    const uploadFiles = async (fileList) => {
        setUploading(true);

        try {
            for (const file of fileList) {
                // 1. Get pre-signed POST URL from backend
                const uploadData = await actions.getUploadUrl({
                    fileName: file.name,
                    fileType: file.type,
                    submissionId: submissionId
                });

                // 2. Upload directly to S3
                const formData = new FormData();
                Object.keys(uploadData.fields).forEach(key => {
                    formData.append(key, uploadData.fields[key]);
                });
                formData.append('file', file);

                const uploadResponse = await fetch(uploadData.url, {
                    method: 'POST',
                    body: formData
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Upload failed: ${uploadResponse.statusText}`);
                }

                console.log(`Successfully uploaded: ${file.name}`);
            }

            Alert.alert('Success', `${fileList.length} file(s) uploaded successfully`);

            // 3. Refresh file list
            await loadFiles();
        } catch (error) {
            console.error('Upload failed:', error);
            Alert.alert('Error', `Failed to upload files: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    // Handle file input change (fallback for non-drag browsers)
    const handleFileInput = (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            uploadFiles(selectedFiles);
        }
    };

    // View file in new tab
    const viewFile = async (file) => {
        if (file.presignedUrl) {
            window.open(file.presignedUrl, '_blank');
        } else {
            Alert.alert('Error', 'File URL not available');
        }
    };

    // Delete file
    const deleteFile = async (fileId) => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this file?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // TODO: Delete from S3 and DynamoDB
                        setFiles(prev => prev.filter(f => f.id !== fileId));
                    }
                }
            ]
        );
    };

    const getFileIcon = (type) => {
        if (type?.includes('pdf')) return '📄';
        if (type?.includes('image')) return '🖼️';
        if (type?.includes('diagram') || type?.includes('draw')) return '📊';
        return '📎';
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <View style={styles.container}>
            {/* Drag-and-Drop Zone */}
            <View
                style={[
                    styles.dropZone,
                    {
                        backgroundColor: dragActive
                            ? theme.colors.primary + '20'
                            : theme.colors.background,
                        borderColor: dragActive
                            ? theme.colors.primary
                            : theme.colors.border
                    }
                ]}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                {uploading ? (
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                ) : (
                    <>
                        <Text style={{ fontSize: 32, marginBottom: 8 }}>📁</Text>
                        <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary, fontWeight: '600' }}>
                            Drag & Drop files here
                        </Text>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 4 }}>
                            or click to browse
                        </Text>
                        <input
                            type="file"
                            multiple
                            onChange={handleFileInput}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                opacity: 0,
                                cursor: 'pointer'
                            }}
                        />
                    </>
                )}
            </View>

            {/* File Gallery */}
            {files.length > 0 && (
                <ScrollView horizontal style={styles.gallery}>
                    {files.map((file) => (
                        <View
                            key={file.id}
                            style={[styles.fileCard, {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.border
                            }]}
                        >
                            <TouchableOpacity
                                style={styles.filePreview}
                                onPress={() => viewFile(file)}
                            >
                                <Text style={{ fontSize: 40 }}>{getFileIcon(file.type)}</Text>
                            </TouchableOpacity>

                            <View style={styles.fileInfo}>
                                <Text
                                    style={{ ...theme.typography.caption, color: theme.colors.textPrimary, fontWeight: '600' }}
                                    numberOfLines={1}
                                >
                                    {file.name}
                                </Text>
                                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontSize: 10 }}>
                                    {formatFileSize(file.size)}
                                </Text>
                            </View>

                            <View style={styles.fileActions}>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                                    onPress={() => viewFile(file)}
                                >
                                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>VIEW</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
                                    onPress={() => deleteFile(file.id)}
                                >
                                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>DELETE</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            {files.length === 0 && !uploading && (
                <View style={styles.emptyState}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                        No files uploaded yet
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    dropZone: {
        height: 120,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginBottom: 16
    },
    gallery: {
        flex: 1
    },
    fileCard: {
        width: 140,
        marginRight: 12,
        borderRadius: 8,
        borderWidth: 1,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    filePreview: {
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.03)',
        marginBottom: 8
    },
    fileInfo: {
        marginBottom: 8
    },
    fileActions: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    actionButton: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: 4,
        alignItems: 'center',
        marginHorizontal: 2
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20
    }
});

export default FileManager;

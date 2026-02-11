import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';

const LibrarianCockpit = ({ config, onSave, isLoading }) => {
    const { theme } = useAiguTheme();

    const ARTIFACT_OPTIONS = [
        "intakeData",
        "technicalDesign",
        "complianceStatus",
        "securityReview",
        "dataFlowDiagram",
        "DPIA",
        "legalApproval"
    ];

    const [matrix, setMatrix] = useState(config?.required_artifacts || {
        High: ["intakeData", "technicalDesign", "DPIA", "securityReview", "complianceStatus"],
        Medium: ["intakeData", "technicalDesign", "complianceStatus"],
        Low: ["intakeData", "technicalDesign"]
    });

    useEffect(() => {
        if (config?.required_artifacts) {
            setMatrix(config.required_artifacts);
        }
    }, [config]);

    const toggleRequirement = (level, artifact) => {
        const current = matrix[level] || [];
        let updated;
        if (current.includes(artifact)) {
            updated = current.filter(a => a !== artifact);
        } else {
            updated = [...current, artifact];
        }
        setMatrix({ ...matrix, [level]: updated });
    };

    const handleSave = () => {
        onSave({ required_artifacts: matrix });
    };

    return (
        <View style={styles.container}>
            <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, fontSize: 18, marginBottom: 12 }}>
                Governance Librarian Cockpit
            </Text>

            <View style={styles.section}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 16 }}>
                    REQUIREMENT MATRIX (ARTIFACTS PER RISK LEVEL)
                </Text>

                <View style={styles.matrixContainer}>
                    {/* Header */}
                    <View style={styles.row}>
                        <View style={styles.cellLabel} />
                        {['Low', 'Medium', 'High'].map(level => (
                            <View key={level} style={styles.cellHeader}>
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                                    {level.toUpperCase()}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Rows */}
                    {ARTIFACT_OPTIONS.map(art => (
                        <View key={art} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
                            <View style={styles.cellLabel}>
                                <Text style={{ color: theme.colors.textPrimary, fontSize: 13 }}>{art}</Text>
                            </View>
                            {['Low', 'Medium', 'High'].map(level => {
                                const isSelected = (matrix[level] || []).includes(art);
                                return (
                                    <TouchableOpacity
                                        key={level}
                                        style={styles.cellCheck}
                                        onPress={() => toggleRequirement(level, art)}
                                    >
                                        <View style={[
                                            styles.checkbox,
                                            {
                                                borderColor: theme.colors.primary,
                                                backgroundColor: isSelected ? theme.colors.primary : 'transparent'
                                            }
                                        ]}>
                                            {isSelected && <Text style={{ color: '#FFF', fontSize: 10 }}>✓</Text>}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </View>
            </View>

            <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.success }]}
                onPress={handleSave}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>SAVE CONFIGURATION</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    matrixContainer: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        borderRadius: 8,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    cellLabel: {
        flex: 2,
        paddingLeft: 16,
    },
    cellHeader: {
        flex: 1,
        alignItems: 'center',
    },
    cellCheck: {
        flex: 1,
        alignItems: 'center',
        height: '100%',
        justifyContent: 'center',
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButton: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
    }
});

export default LibrarianCockpit;

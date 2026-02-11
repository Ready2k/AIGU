import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';

const RiskCockpit = ({ config, onSave, isLoading }) => {
    const { theme } = useAiguTheme();
    const [keywords, setKeywords] = useState(config?.high_risk_keywords || []);
    const [newKeyword, setNewKeyword] = useState('');
    const [slaThresholds, setSlaThresholds] = useState(config?.sla_thresholds || { High: 10, Medium: 7, Low: 3 });

    useEffect(() => {
        if (config) {
            setKeywords(config.high_risk_keywords || []);
            setSlaThresholds(config.sla_thresholds || { High: 10, Medium: 7, Low: 3 });
        }
    }, [config]);

    const addKeyword = () => {
        if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
            setKeywords([...keywords, newKeyword.trim()]);
            setNewKeyword('');
        }
    };

    const removeKeyword = (kw) => {
        setKeywords(keywords.filter(k => k !== kw));
    };

    const updateSla = (level, val) => {
        setSlaThresholds({ ...slaThresholds, [level]: parseInt(val) || 0 });
    };

    const handleSave = () => {
        onSave({ high_risk_keywords: keywords, sla_thresholds: slaThresholds });
    };

    return (
        <View style={styles.container}>
            <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary, fontSize: 18, marginBottom: 12 }}>
                Risk & Triage Agent Config
            </Text>

            {/* Keyword Manager */}
            <View style={styles.section}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 8 }}>
                    HIGH RISK KEYWORDS (TAG INPUT)
                </Text>
                <View style={styles.tagContainer}>
                    {keywords.map(kw => (
                        <View key={kw} style={[styles.tag, { backgroundColor: theme.colors.primary + '20' }]}>
                            <Text style={{ color: theme.colors.primary, fontSize: 13 }}>{kw}</Text>
                            <TouchableOpacity onPress={() => removeKeyword(kw)} style={{ marginLeft: 6 }}>
                                <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>×</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                    <TextInput
                        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                        placeholder="Add keyword..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={newKeyword}
                        onChangeText={setNewKeyword}
                        onSubmitEditing={addKeyword}
                    />
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
                        onPress={addKeyword}
                    >
                        <Text style={{ color: '#FFF', fontWeight: '700' }}>ADD</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* SLA Sliders (Simplified as Number Inputs for now per React Native constraints) */}
            <View style={styles.section}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 16 }}>
                    SLA THRESHOLDS (DAYS)
                </Text>

                {['High', 'Medium', 'Low'].map(level => (
                    <View key={level} style={styles.slaRow}>
                        <Text style={{ ...theme.typography.body, color: theme.colors.textPrimary, width: 80 }}>{level} Risk</Text>
                        <TextInput
                            style={[styles.numInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                            value={String(slaThresholds[level])}
                            onChangeText={(v) => updateSla(level, v)}
                            keyboardType="numeric"
                        />
                        <Text style={{ color: theme.colors.textSecondary, marginLeft: 8 }}>days</Text>
                    </View>
                ))}
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
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 12,
        height: 40,
    },
    addButton: {
        marginLeft: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        justifyContent: 'center',
    },
    slaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    numInput: {
        width: 60,
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 8,
        height: 36,
        textAlign: 'center',
    },
    saveButton: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
    }
});

export default RiskCockpit;

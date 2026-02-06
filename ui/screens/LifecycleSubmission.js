import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';

/**
 * LifecycleSubmission Screen
 * 
 * Handles multi-stage artifact submission for POC and Production phases.
 */
const LifecycleSubmission = ({ stage, state, actions }) => {
    const { theme } = useAiguTheme();
    const isPOC = stage === 'POC';

    // POC State
    const [testPlan, setTestPlan] = useState('');
    const [successCriteria, setSuccessCriteria] = useState('');
    const [resourceEstimate, setResourceEstimate] = useState('');
    const [techApproach, setTechApproach] = useState('');

    // Production State
    const [kpiMetrics, setKpiMetrics] = useState('');
    const [costAnalysis, setCostAnalysis] = useState('');
    const [incrementalRisk, setIncrementalRisk] = useState('');
    const [outcomeReport, setOutcomeReport] = useState('');
    const [prevVersion, setPrevVersion] = useState(state.projectMetadata?.previousVersionId || '');

    const handleSubmit = () => {
        if (isPOC) {
            actions.submitPOC({
                testPlan,
                successCriteria,
                resourceEstimate,
                technicalApproach: techApproach
            });
        } else {
            actions.submitProduction({
                kpiMetrics: { summary: kpiMetrics },
                costAnalysis: { summary: costAnalysis },
                incrementalRisk,
                outcomeReport
            }, prevVersion);
        }
    };

    const renderPOCFields = () => (
        <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>🧪 POC VALIDATION REQUIREMENTS</Text>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Test Plan & Scope</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    placeholder="Describe how you will validate the technical feasibility..."
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    value={testPlan}
                    onChangeText={setTestPlan}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Success Criteria</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    placeholder="What metrics define a successful POC?"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={successCriteria}
                    onChangeText={setSuccessCriteria}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Resource Estimate</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    placeholder="Required budget, engineers, and infrastructure..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={resourceEstimate}
                    onChangeText={setResourceEstimate}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Detailed Technical Approach</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    placeholder="Architectural diagram summary and data sources..."
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    value={techApproach}
                    onChangeText={setTechApproach}
                />
            </View>
        </View>
    );

    const renderProductionFields = () => (
        <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>🚀 PRODUCTION READINESS CONTROLS</Text>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Previous Version ID (for Delta Review)</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    placeholder="e.g. project-x-pilot-v1"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={prevVersion}
                    onChangeText={setPrevVersion}
                />
                <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>Used to calculate change percentage from Pilot phase.</Text>
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Benefits and KPI Measurements</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    placeholder="Actual results vs planned KPIs..."
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    value={kpiMetrics}
                    onChangeText={setKpiMetrics}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Cost Control Documentation</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    placeholder="Total cost of ownership and budget adherence..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={costAnalysis}
                    onChangeText={setCostAnalysis}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Incremental Risk Assessment</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    placeholder="Any new risks discovered during Pilot?"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={incrementalRisk}
                    onChangeText={setIncrementalRisk}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Pilot Outcome Report</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    placeholder="Summary of findings and production recommendation..."
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    value={outcomeReport}
                    onChangeText={setOutcomeReport}
                />
            </View>
        </View>
    );

    return (
        <ResponsiveWrapper>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, marginBottom: 8 }}>
                        {isPOC ? 'POC Submission' : 'Production Submission'}
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 24 }}>
                        Submission ID: {state.submissionId} | Lifecycle Phase: {stage}
                    </Text>

                    {isPOC ? renderPOCFields() : renderProductionFields()}

                    <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
                        onPress={handleSubmit}
                    >
                        <Text style={styles.submitButtonText}>SUBMIT ARTIFACTS TO GIGC</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => actions.refreshState()}
                    >
                        <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ResponsiveWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 20,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    card: {
        padding: 32,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 24,
        marginTop: 8
    },
    inputGroup: {
        marginBottom: 20
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        textAlignVertical: 'top'
    },
    helperText: {
        fontSize: 11,
        marginTop: 4,
        fontStyle: 'italic'
    },
    submitButton: {
        marginTop: 32,
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    submitButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 0.5
    },
    cancelButton: {
        marginTop: 16,
        paddingVertical: 8,
        alignItems: 'center'
    }
});

export default LifecycleSubmission;

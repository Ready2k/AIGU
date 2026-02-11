import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';
import { getShadow } from '../utils/shadows';
import AttachmentManager from '../components/AttachmentManager';

const DiscoveryCanvas = ({ actions, initialData = {}, isRemediation = false, setRemediating, projectMetadata = {}, governance = {}, files, onUploadSuccess, onDraftUpdate, onCancel }) => {
    const { theme } = useAiguTheme();
    const [description, setDescription] = useState(initialData.description || '');
    const [submitting, setSubmitting] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Structured fields
    // Structured fields initialized with empty strings to avoid uncontrolled component warnings
    const [formData, setFormData] = useState({
        projectName: '', owner: '', businessArea: '', problemStatement: '', solutionBrief: '',
        timelines: '', sponsorship: '', lifecycleStatus: '', successCriteria: '',
        technicalApproach: '', resources: '', businessValue: '', financialBenefits: '',
        funding: '', raids: '', architectureVision: ''
    });

    const lastSyncedData = useRef(null);
    const lastDraftShared = useRef(null);

    // Sync AI-extracted data into form state when it arrives
    useEffect(() => {
        // Prevent re-syncing if the data hasn't actually changed
        const dataKey = JSON.stringify(initialData);
        if (lastSyncedData.current === dataKey) return;
        lastSyncedData.current = dataKey;

        setFormData(prev => ({
            ...prev,
            projectName: initialData.projectName || prev.projectName || '',
            owner: initialData.owner || prev.owner || '',
            businessArea: initialData.businessArea || prev.businessArea || '',
            problemStatement: initialData.problemStatement || prev.problemStatement || '',
            solutionBrief: initialData.solutionBrief || prev.solutionBrief || '',
            timelines: initialData.timelines || prev.timelines || '',
            sponsorship: initialData.sponsorship || prev.sponsorship || '',
            lifecycleStatus: initialData.lifecycleStatus || prev.lifecycleStatus || '',
            successCriteria: initialData.successCriteria || prev.successCriteria || '',
            technicalApproach: initialData.technicalApproach || prev.technicalApproach || '',
            resources: initialData.resources || prev.resources || '',
            businessValue: initialData.businessValue || prev.businessValue || '',
            financialBenefits: initialData.financialBenefits || prev.financialBenefits || '',
            funding: initialData.funding || prev.funding || '',
            raids: initialData.raids || prev.raids || '',
            architectureVision: initialData.architectureVision || prev.architectureVision || ''
        }));
        if (initialData.description && !description) {
            setDescription(initialData.description);
        }
    }, [initialData]);

    // Notify parent of draft updates for context injection
    useEffect(() => {
        if (!onDraftUpdate) return;

        const draft = { ...formData, description };
        const draftKey = JSON.stringify(draft);

        // Prevent sharing the same draft back to the parent to avoid loops
        if (lastDraftShared.current === draftKey) return;
        lastDraftShared.current = draftKey;

        onDraftUpdate(draft);
    }, [formData, description, onDraftUpdate]);

    const fieldLabels = {
        projectName: "Use Case Name (Project Title)",
        owner: "Use Case Owner (Raiser of the ticket)",
        businessArea: "Business Area",
        problemStatement: "Problem Statement",
        solutionBrief: "Solution Brief",
        timelines: "Indicative Timelines",
        sponsorship: "Sponsorship",
        lifecycleStatus: "Lifecycle Status",
        successCriteria: "POC/Pilot success criteria",
        technicalApproach: "Technical Approach & Experiment",
        resources: "Resources",
        businessValue: "Primary Business Value",
        financialBenefits: "Financial & Non-Financial Benefits",
        funding: "Funding",
        raids: "RAIDs",
        architectureVision: "Architecture Vision"
    };

    // Critical fields from backend logic
    const criticalFields = ["projectName", "owner", "funding", "problemStatement", "businessArea"];

    const missingFields = projectMetadata.missingIntakeFields || [];
    const validationErrors = projectMetadata.validationErrors || [];
    const contextualHelp = projectMetadata.contextualHelp || {};
    const hasGaps = missingFields.length > 0 || validationErrors.length > 0;

    const handleUpdateField = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    // Check if critical fields are provided for the "Gate" logic
    // If it's the first submission (no gaps), only require Name & Description
    // If gaps exist, enforce ALL critical fields
    const isGateClosed = hasGaps
        ? criticalFields.some(f => !formData[f]?.trim())
        : (!formData.projectName?.trim() || !description?.trim());

    const handleSubmit = async () => {
        if (isGateClosed) {
            Alert.alert('Incomplete', 'Please fill in all critical fields highlighted with *');
            return;
        }

        setSubmitting(true);
        try {
            await actions.initiateIntake({
                ...formData,
                description: description.trim()
            });

            // If this was a remediation for a blocked project, trigger the revision loop
            if (isRemediation && actions.submitRevision) {
                await actions.submitRevision();
            }

            if (setRemediating) setRemediating(false);
        } catch (error) {
            console.error('Failed to submit intake:', error);
            Alert.alert('Error', 'Failed to submit. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ResponsiveWrapper>
            <View style={styles.formContainer}>
                <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, marginBottom: theme.spacing.md }}>
                    {isRemediation ? '🛠️ Project Remediation' : 'Discovery Canvas'}
                </Text>

                {/* ADD FILE MANAGER FOR REMEDIATION */}
                {isRemediation && (
                    <View style={{ marginBottom: 20, padding: 16, backgroundColor: theme.colors.background, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.primary }}>
                        <Text style={{ fontWeight: '700', color: theme.colors.primary, marginBottom: 8 }}>📎 Manage Supporting Documents</Text>
                        <AttachmentManager
                            submissionId={projectMetadata.submissionId}
                            userId={projectMetadata.userId}
                            files={files}
                            onUploadSuccess={onUploadSuccess}
                            onDelete={actions.deleteArtifact}
                            getUploadUrl={actions.getUploadUrl}
                        />
                    </View>
                )}

                {validationErrors.length > 0 && (
                    <View style={[styles.errorBox, { borderColor: theme.colors.error }]}>
                        <Text style={{ ...theme.typography.subheader, color: theme.colors.error, marginBottom: 4 }}>
                            ⚠️ Validation Issues
                        </Text>
                        {validationErrors.map((err, i) => (
                            <Text key={i} style={{ color: theme.colors.textPrimary, fontSize: 13 }}>• {err}</Text>
                        ))}
                    </View>
                )}

                <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
                    {hasGaps
                        ? "AIGU needs a few more details to complete your intake review. Fields marked with * are critical."
                        : "Describe your project idea. AIGU will analyze it to determine the governance path and risk level."}
                </Text>

                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    {/* Project Name Field */}
                    <Text style={styles.label}>{fieldLabels.projectName} *</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                        placeholder="e.g. Marketing GenAI Accelerator"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={formData.projectName}
                        onChangeText={(v) => handleUpdateField('projectName', v)}
                        editable={governance.status !== 'Cancelled'}
                    />

                    {!hasGaps && (
                        <>
                            <Text style={styles.label}>Initial Brief / Description</Text>
                            <TextInput
                                style={[styles.textArea, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                                placeholder="Describe your use case..."
                                placeholderTextColor={theme.colors.textSecondary}
                                multiline
                                numberOfLines={8}
                                value={description}
                                onChangeText={setDescription}
                                editable={governance.status !== 'Cancelled'}
                            />

                            <TouchableOpacity onPress={() => setShowAdvanced(!showAdvanced)} style={{ marginVertical: 10 }}>
                                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                                    {showAdvanced ? '− Hide Details' : '+ Add Specific Details Manually'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {(showAdvanced || hasGaps || isRemediation) && (
                        <View style={styles.detailsContainer}>
                            {Object.keys(fieldLabels).map(key => {
                                if (key === 'projectName') return null;
                                const isMissing = missingFields.includes(key);
                                const isCritical = criticalFields.includes(key);
                                const help = contextualHelp[key];

                                if (!showAdvanced && !isMissing && !isCritical && !formData[key]) return null;

                                return (
                                    <View key={key} style={styles.fieldWrapper}>
                                        <Text style={[styles.label, isCritical && { color: theme.colors.primary }]}>
                                            {fieldLabels[key]} {isCritical && '*'}
                                        </Text>

                                        {help && (
                                            <View style={styles.helpBox}>
                                                <Text style={styles.helpText}>{help.helpText}</Text>
                                                <Text style={styles.helpExample}>Example: {help.contextualExample}</Text>
                                            </View>
                                        )}

                                        <TextInput
                                            style={[styles.input, {
                                                backgroundColor: theme.colors.background,
                                                color: theme.colors.textPrimary,
                                                borderColor: isMissing ? theme.colors.warning : theme.colors.border
                                            }]}
                                            placeholder={`Enter ${fieldLabels[key].toLowerCase()}...`}
                                            placeholderTextColor={theme.colors.textSecondary}
                                            multiline={key !== 'owner' && key !== 'businessArea'}
                                            value={formData[key]}
                                            onChangeText={(v) => handleUpdateField(key, v)}
                                            editable={governance.status !== 'Cancelled'}
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {projectMetadata.riskLevel && (
                        <View style={[styles.complianceCard, { backgroundColor: theme.mode === 'dark' ? '#1c2532' : '#F0F7FF', borderColor: theme.colors.primary }]}>
                            <Text style={styles.complianceHeader}>📋 Compliance Outlook (Heads Up)</Text>
                            <Text style={styles.complianceSub}>Preliminary Risk: {projectMetadata.riskLevel}</Text>
                            <View style={styles.docList}>
                                {(governance.requiredDocsPreview || []).map((doc, i) => (
                                    <Text key={i} style={styles.docItem}>• {doc}</Text>
                                ))}
                            </View>
                            <Text style={styles.complianceNote}>Note: Mandatory sections will be finalized by the Librarian later.</Text>
                        </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                        {onCancel && (
                            <TouchableOpacity
                                style={[styles.button, {
                                    flex: 1,
                                    backgroundColor: 'transparent',
                                    borderWidth: 1,
                                    borderColor: theme.colors.error,
                                    marginTop: 0
                                }]}
                                onPress={() => {
                                    const msg = isRemediation
                                        ? "Exit remediation? Any unsaved changes will be lost."
                                        : "Are you sure you want to cancel this submission?";
                                    if (confirm(msg)) {
                                        onCancel();
                                    }
                                }}
                            >
                                <Text style={[styles.buttonText, { color: theme.colors.error }]}>
                                    {isRemediation ? 'CANCEL EDITS' : 'CANCEL SUBMISSION'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.button, {
                                flex: 2,
                                backgroundColor: submitting || isGateClosed || governance.status === 'Cancelled' ? theme.colors.border : theme.colors.primary,
                                opacity: submitting || isGateClosed || governance.status === 'Cancelled' ? 0.6 : 1,
                                marginTop: 0
                            }]}
                            onPress={handleSubmit}
                            disabled={submitting || isGateClosed || governance.status === 'Cancelled'}
                        >
                            <Text style={styles.buttonText}>
                                {governance.status === 'Cancelled' ? 'PROJECT CANCELLED' : (isGateClosed ? 'COMPLETE REQUIRED FIELDS' : (submitting ? 'PROCESSING...' : (isRemediation ? 'UPDATE & RESUBMIT' : 'SUBMIT TO AIGU')))}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ResponsiveWrapper>
    );
};

const styles = StyleSheet.create({
    scrollContainer: { flex: 1 },
    contentContainer: { paddingVertical: 40 },
    formContainer: { maxWidth: 800, width: '100%', alignSelf: 'center', paddingHorizontal: 20 },
    card: { padding: 32, borderRadius: 16, borderWidth: 1, ...getShadow('#000', { width: 0, height: 4 }, 0.1, 12, 5) },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 15, marginBottom: 8 },
    textArea: { borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 15, minHeight: 180, textAlignVertical: 'top', marginBottom: 16 },
    detailsContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    fieldWrapper: { marginBottom: 16 },
    errorBox: { padding: 16, borderRadius: 8, borderWidth: 1, marginBottom: 20, backgroundColor: 'rgba(255,0,0,0.05)' },
    helpBox: { padding: 10, backgroundColor: 'rgba(0,123,255,0.05)', borderRadius: 6, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#007bff' },
    helpText: { fontSize: 12, color: '#666', fontStyle: 'italic' },
    helpExample: { fontSize: 12, color: '#007bff', marginTop: 2, fontWeight: '600' },
    complianceCard: { marginTop: 20, padding: 16, borderRadius: 10, borderWidth: 1, borderStyle: 'dotted' },
    complianceHeader: { fontSize: 14, fontWeight: '700', color: '#007bff', marginBottom: 4 },
    complianceSub: { fontSize: 12, fontWeight: '600', marginBottom: 8, opacity: 0.8 },
    docList: { marginBottom: 10 },
    docItem: { fontSize: 13, marginBottom: 2, fontWeight: '500' },
    complianceNote: { fontSize: 11, fontStyle: 'italic', opacity: 0.6 },
    button: { paddingVertical: 18, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', marginTop: 24 },
    buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 1 }
});

export default DiscoveryCanvas;

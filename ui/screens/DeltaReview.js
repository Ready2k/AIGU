import React from 'react';
import { View, Text, Button } from 'react-native';
import { AIGU_THEME } from '../theme/ThemeConfig';

const DeltaReview = ({ state, onSubmit }) => {
    // Diff Logic and Acknowledge button
    return (
        <View style={{ flex: 1, padding: AIGU_THEME.spacing.md, backgroundColor: '#FFFBE6' }}>
            <View style={{
                backgroundColor: AIGU_THEME.colors.surface,
                padding: AIGU_THEME.spacing.lg,
                borderRadius: AIGU_THEME.borderRadius.md,
                ...AIGU_THEME.shadows.card
            }}>
                <Text style={{ ...AIGU_THEME.typography.header, color: AIGU_THEME.colors.error, marginBottom: AIGU_THEME.spacing.md }}>
                    Incremental Delta Review
                </Text>

                <Text style={{ ...AIGU_THEME.typography.body, marginBottom: AIGU_THEME.spacing.lg }}>
                    Scope Change detected exceeds threshold.
                </Text>

                {/* Diff visualization placeholder styled */}
                <View style={{
                    padding: AIGU_THEME.spacing.md,
                    backgroundColor: AIGU_THEME.colors.background,
                    marginBottom: AIGU_THEME.spacing.lg,
                    borderRadius: AIGU_THEME.borderRadius.sm
                }}>
                    <Text style={AIGU_THEME.typography.mono}>- Users: 100</Text>
                    <Text style={{ ...AIGU_THEME.typography.mono, color: AIGU_THEME.colors.error }}>+ Users: 10,000</Text>
                </View>

                {/* Styled Button (Simulated via standard Button color prop as React Native Button is limited) */}
                <Button
                    title="Acknowledge & Re-submit"
                    color={AIGU_THEME.colors.primary}
                    onPress={() => onSubmit({ scopeAck: true })}
                />
            </View>
        </View>
    );
};

export default DeltaReview;

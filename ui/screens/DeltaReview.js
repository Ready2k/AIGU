import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import ResponsiveWrapper from '../components/ResponsiveWrapper';

const DeltaReview = ({ state, onSubmit }) => {
    const { theme } = useAiguTheme();

    return (
        <ResponsiveWrapper>
            <View style={styles.container}>
                {/* Warning Banner */}
                <View style={[styles.banner, { backgroundColor: theme.colors.error }]}>
                    <Text style={[styles.bannerText, { color: theme.colors.textInverted }]}>
                        ⚠️ GOVERNANCE BLOCK: Scope Change Detected
                    </Text>
                </View>

                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={{ ...theme.typography.header, color: theme.colors.textPrimary, marginBottom: theme.spacing.md }}>
                        Incremental Delta Review
                    </Text>

                    <Text style={{ ...theme.typography.body, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
                        Your project has transitioned from Pilot to Production, but the delta threshold (15%) has been exceeded. Manual acknowledgement of the increased risk is required.
                    </Text>

                    {/* Diff Visualization */}
                    <View style={[styles.diffCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                        <View style={styles.diffLine}>
                            <Text style={[theme.typography.mono, { color: theme.colors.textSecondary }]}>- Users (Scheduled): 100</Text>
                        </View>
                        <View style={styles.diffLine}>
                            <Text style={[theme.typography.mono, { color: theme.colors.error, fontWeight: '700' }]}>+ Users (Actual): 10,000</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                        <Text style={[theme.typography.caption, { color: theme.colors.error, marginTop: 8 }]}>
                            Deviation: +9,900% (Limit: 15%)
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.colors.primary }]}
                        onPress={() => onSubmit({ scopeAck: true })}
                    >
                        <Text style={styles.buttonText}>Acknowledge & Re-submit</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ResponsiveWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    banner: {
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    },
    bannerText: {
        fontSize: 16,
        fontWeight: '700',
    },
    card: {
        padding: 32,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    diffCard: {
        padding: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        marginBottom: 32
    },
    diffLine: {
        marginVertical: 4
    },
    divider: {
        height: 1,
        marginTop: 12
    },
    button: {
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center'
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16
    }
});

export default DeltaReview;

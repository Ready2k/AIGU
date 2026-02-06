/**
 * AIGU Theme Configuration
 * Governs the visual language of the A2UI components.
 * Standardized for AWS-native branding and accessibility.
 */

export const AIGU_THEME = {
    colors: {
        // Brand Identity
        primary: '#232F3E',    // AWS Deep Navy
        secondary: '#FF9900',  // AWS Squid Ink / Accent Orange
        background: '#F2F3F3', // Light Grey Canvas
        surface: '#FFFFFF',    // Card/Module White

        // State-Driven Semantics
        success: '#1D8102',    // Approved / Accelerator Path
        warning: '#D45B07',    // In-Review / 7-10 Day SLA
        error: '#D13212',      // Blocked / Delta Threshold Exceeded
        info: '#0073BB',       // Support Agent / Insights

        // Typography
        textPrimary: '#16191F',
        textSecondary: '#545B64',
        textInverted: '#FFFFFF',
    },

    typography: {
        header: { fontSize: 24, fontWeight: '700', letterSpacing: 0.5 },
        subheader: { fontSize: 18, fontWeight: '600' },
        body: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
        caption: { fontSize: 12, fontWeight: '400', color: '#545B64' },
        mono: { fontFamily: 'Courier New', fontSize: 13 }, // For the "Audit Log"
    },

    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
    },

    borderRadius: {
        sm: 4,
        md: 8,
        lg: 16,
        full: 999,
    },

    shadows: {
        card: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        }
    }
};

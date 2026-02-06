import { Platform } from 'react-native';

/**
 * AIGU Theme Configuration
 * Governs the visual language of the A2UI components.
 * Standardized for AWS-native branding and accessibility.
 */

// Shared Configuration (Typography, Spacing, Shadows)
const TYPOGRAPHY = {
    header: { fontSize: 24, fontWeight: '700', letterSpacing: 0.5 },
    subheader: { fontSize: 18, fontWeight: '600' },
    body: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400', color: '#545B64' },
    mono: { fontFamily: Platform.select({ web: 'Courier New', default: 'monospace' }), fontSize: 13 },
};

const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

const BORDER_RADIUS = {
    sm: 4,
    md: 8,
    lg: 16,
    full: 999,
};

const SHADOWS = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    }
};

// 1. Light Mode Palette (Default Enterprise Look)
export const LightPalette = {
    mode: 'light',
    colors: {
        background: '#F2F3F3', // Light Grey Canvas
        surface: '#FFFFFF',    // Card White
        primary: '#232F3E',    // AWS Deep Navy
        secondary: '#FF9900',  // AWS Accent Orange
        accent: '#0073BB',     // AWS Blue
        success: '#1D8102',
        warning: '#D45B07',
        error: '#D13212',
        textPrimary: '#16191F',
        textSecondary: '#545B64',
        textInverted: '#FFFFFF',
        border: '#D5DBDB'
    },
    typography: TYPOGRAPHY,
    spacing: SPACING,
    borderRadius: BORDER_RADIUS,
    shadows: SHADOWS
};

// 2. Dark Mode Palette (Premium Onyx/Navy)
export const DarkPalette = {
    mode: 'dark',
    colors: {
        background: '#0F111A', // Deep Midnight
        surface: '#1B1E2E',    // Slate Navy Surface
        primary: '#3E7BFA',    // Vibrant Primary Blue
        secondary: '#F59E0B',  // Vibrant Amber
        accent: '#8B5CF6',     // Premium Violet
        success: '#10B981',    // Emerald
        warning: '#F59E0B',    // Amber
        error: '#EF4444',      // Rose
        textPrimary: '#F8FAFC', // Slate 50
        textSecondary: '#94A3B8', // Slate 400
        textInverted: '#FFFFFF', // White text on colored backgrounds
        border: '#2D324D'      // Muted border
    },
    typography: {
        ...TYPOGRAPHY,
        caption: { ...TYPOGRAPHY.caption, color: '#94A3B8' }
    },
    spacing: SPACING,
    borderRadius: BORDER_RADIUS,
    shadows: {
        card: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 8,
        }
    }
};

// Legacy Export for backward compatibility during migration
export const AIGU_THEME = LightPalette;

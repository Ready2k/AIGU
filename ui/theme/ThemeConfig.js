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

// 2. Dark Mode Palette (AWS Console Dark)
export const DarkPalette = {
    mode: 'dark',
    colors: {
        background: '#16191F', // AWS Deep Black
        surface: '#232F3E',    // AWS Navy Surface
        primary: '#FFFFFF',    // White Text on Dark
        secondary: '#FF9900',  // AWS Accent Orange (Kept consistent)
        accent: '#879596',     // Muted Blue/Grey
        success: '#2E8B57',    // Softer Green
        warning: '#F08C00',    // Softer Orange
        error: '#EF5350',      // Softer Red
        textPrimary: '#FFFFFF',
        textSecondary: '#AAB7B8',
        textInverted: '#16191F',
        border: '#545B64'
    },
    typography: {
        ...TYPOGRAPHY,
        caption: { ...TYPOGRAPHY.caption, color: '#AAB7B8' }
    },
    spacing: SPACING,
    borderRadius: BORDER_RADIUS,
    shadows: SHADOWS // Shadows are less visible in dark mode but kept for structure
};

// Legacy Export for backward compatibility during migration
export const AIGU_THEME = LightPalette;

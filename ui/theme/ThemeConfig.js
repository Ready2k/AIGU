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
    card: Platform.select({
        web: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
            elevation: 3,
        },
        default: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        }
    })
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

// 2. Dark Mode Palette (Premium Cosmic Glass)
export const DarkPalette = {
    mode: 'dark',
    colors: {
        background: '#050511', // Deep Space Black/Blue
        surface: 'rgba(30, 32, 50, 0.7)', // Glassy Surface
        primary: '#00F0FF',    // Neon Cyan
        secondary: '#bf00ff',  // Electric Purple
        accent: '#FF0055',     // Neon Pink
        success: '#00FF9D',    // Neon Green
        warning: '#FFB800',    // Neon Orange
        error: '#FF2E2E',      // Bright Red
        textPrimary: '#F0F4F8', // Ice White
        textSecondary: '#94A3B8', // Muted Blue-Grey
        textInverted: '#000000', // Black text on neon backgrounds
        border: 'rgba(255, 255, 255, 0.1)' // Subtle glass border
    },
    typography: {
        ...TYPOGRAPHY,
        caption: { ...TYPOGRAPHY.caption, color: '#94A3B8' }
    },
    spacing: SPACING,
    borderRadius: BORDER_RADIUS,
    shadows: {
        card: Platform.select({
            web: {
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            },
            default: {
                shadowColor: '#00F0FF', // Neon Glow
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 10,
                elevation: 8,
            }
        })
    },
    // Glassmorphism Utility
    glass: {
        backgroundColor: 'rgba(30, 32, 50, 0.6)',
        backdropFilter: 'blur(12px)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
    }
};

// Legacy Export for backward compatibility during migration
export const AIGU_THEME = LightPalette;

import { Platform } from 'react-native';

/**
 * Generates cross-platform shadow styles.
 * @param {string} color - Shadow color (e.g. '#000')
 * @param {object} offset - { width: number, height: number }
 * @param {number} opacity - 0 to 1
 * @param {number} radius - Blur radius
 * @param {number} elevation - Android elevation
 */
export const getShadow = (color, offset, opacity, radius, elevation) => {
    return Platform.select({
        web: {
            boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`,
            elevation: elevation
        },
        default: {
            shadowColor: color,
            shadowOffset: offset,
            shadowOpacity: opacity,
            shadowRadius: radius,
            elevation: elevation
        }
    });
};

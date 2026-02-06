import React from 'react';
import { View, useWindowDimensions, ScrollView, Platform } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';

const ResponsiveWrapper = ({ children, scrollable = true }) => {
    const { width } = useWindowDimensions();
    const { theme } = useAiguTheme();

    // Responsive Logic
    const isDesktop = width >= 768;
    const containerWidth = isDesktop ? Math.min(width, 1200) : '100%';
    const paddingHorizontal = isDesktop ? 24 : 16; // Comfortable padding
    const paddingTop = isDesktop ? 40 : 16;

    const Content = (
        <View style={{
            width: containerWidth,
            alignSelf: 'center',
            paddingHorizontal: paddingHorizontal,
            paddingTop: paddingTop,
            paddingBottom: 40,
            flexGrow: 1
        }}>
            {children}
        </View>
    );

    // Apply background color to the absolute root to prevent "white flashes" on resizing
    const RootStyle = {
        flex: 1,
        backgroundColor: theme.colors.background
    };

    if (scrollable) {
        return (
            <View style={RootStyle}>
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={Platform.OS === 'web'}>
                    {Content}
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={RootStyle}>
            {Content}
        </View>
    );
};

export default ResponsiveWrapper;

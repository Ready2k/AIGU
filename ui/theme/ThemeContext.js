import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { LightPalette, DarkPalette } from './ThemeConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext({
    theme: LightPalette,
    isDark: false,
    toggleTheme: () => { }
});

export const ThemeProvider = ({ children }) => {
    // 1. Detect System Preference
    const systemScheme = useColorScheme();
    const [isDark, setIsDark] = useState(systemScheme === 'dark');

    // 2. Load Persisted Preference on Mount
    useEffect(() => {
        const loadTheme = async () => {
            const savedTheme = await AsyncStorage.getItem('AIGU_THEME_PREF');
            if (savedTheme) {
                setIsDark(savedTheme === 'dark');
            }
        };
        loadTheme();
    }, []);

    // 3. Toggle Logic
    const toggleTheme = async () => {
        const newMode = !isDark;
        setIsDark(newMode);
        await AsyncStorage.setItem('AIGU_THEME_PREF', newMode ? 'dark' : 'light');
    };

    const theme = isDark ? DarkPalette : LightPalette;

    return (
        <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useAiguTheme = () => useContext(ThemeContext);

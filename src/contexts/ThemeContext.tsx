import React, {createContext, useState, useEffect, useContext} from 'react';
import {useColorScheme} from 'react-native';
import {readingPreferencesService, type AppTheme} from '../services/readingPreferencesService';

export type ResolvedTheme = 'light' | 'dark';

export const themeColors = {
  light: {
    background: '#F7F5F0',
    headerBackground: '#F7F5F0',
    cardBackground: '#FAF8F3',
    cardBorder: '#E8DDD0',
    text: '#2c3e50',
    textMuted: '#8A8171',
    textInverse: '#fff',
    segmentBg: '#F0EBE3',
    segmentActive: '#6B8E73',
    segmentText: '#3D5A46',
    segmentTextActive: '#fff',
    accent: '#6B8E73',
    chipBg: '#F0EBE3',
    chipBgActive: '#6B8E73',
    signOutBg: '#F5E6E3',
    signOutBorder: '#E8D0CC',
    signOutText: '#C05050',
    emailText: '#A3B5A7',
  },
  dark: {
    background: '#1a1a1a',
    headerBackground: '#1a1a1a',
    cardBackground: '#2d2d2d',
    cardBorder: '#404040',
    text: '#e8e8e8',
    textMuted: '#9ca3af',
    textInverse: '#1a1a1a',
    segmentBg: '#333',
    segmentActive: '#4a7c59',
    segmentText: '#9ca3af',
    segmentTextActive: '#fff',
    accent: '#6B8E73',
    chipBg: '#404040',
    chipBgActive: '#4a7c59',
    signOutBg: '#3d2d2d',
    signOutBorder: '#5c4040',
    signOutText: '#e88a8a',
    emailText: '#6b7280',
  },
};

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => Promise<void>;
  resolvedTheme: ResolvedTheme;
  colors: (typeof themeColors)['light'];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<AppTheme>('light');

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : theme;
  const colors = themeColors[resolvedTheme];

  useEffect(() => {
    readingPreferencesService.getAppTheme().then(setThemeState);
  }, []);

  const setTheme = async (value: AppTheme) => {
    setThemeState(value);
    await readingPreferencesService.setAppTheme(value);
  };

  return (
    <ThemeContext.Provider value={{theme, setTheme, resolvedTheme, colors}}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};

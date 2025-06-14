import React, { createContext, useContext, useEffect, useState } from 'react';
import { API } from '../utils/api';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always use dark theme
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Always set dark theme, ignore config
    setTheme('dark');
  }, []);

  useEffect(() => {
    // Apply theme class to root element
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add('dark'); // Always dark
  }, [theme]);

  const toggleTheme = async () => {
    // No-op - theme switching disabled
    // Keeping function to preserve API compatibility
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
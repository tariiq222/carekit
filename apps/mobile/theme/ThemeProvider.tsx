import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { buildTheme, type AppTheme } from './tokens';
import type { BrandingConfig } from '@carekit/shared/types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5100/api/v1';

interface ThemeContextValue {
  theme: AppTheme;
  isRTL: boolean;
  language: 'ar' | 'en';
  branding?: BrandingConfig | null;
}

const defaultTheme = buildTheme();

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  isRTL: true,
  language: 'ar',
  branding: null,
});

interface ThemeProviderProps {
  children: ReactNode;
  language?: 'ar' | 'en';
}

export function ThemeProvider({ children, language = 'ar' }: ThemeProviderProps) {
  const isRTL = language === 'ar';
  const [appTheme, setAppTheme] = useState<AppTheme>(defaultTheme);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  useEffect(() => {
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
  }, [isRTL]);

  useEffect(() => {
    fetch(`${API_BASE}/public/branding`)
      .then((r) => r.json())
      .then((body) => {
        const data: BrandingConfig = body.data ?? body;
        setBranding(data);
        setAppTheme(buildTheme(data));
      })
      .catch(() => {
        // keep defaults on failure
      });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: appTheme, isRTL, language, branding }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

import { colors } from './colors';

export interface WhiteLabelTheme {
  brand: {
    name: string;
    nameAr: string;
    logoUrl: string;
    logoLightUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    fontArabic?: string;
    fontEnglish?: string;
  };
  config: {
    defaultLanguage: 'ar' | 'en';
    timezone: string;
    sessionDuration: number;
    reminderBeforeMinutes: number;
  };
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
    addressAr?: string;
  };
  social?: {
    twitter?: string;
    instagram?: string;
    snapchat?: string;
    tiktok?: string;
    whatsapp?: string;
  };
}

export const defaultWhiteLabelTheme: WhiteLabelTheme = {
  brand: {
    name: 'CareKit',
    nameAr: 'كيركيت',
    logoUrl: '/logo.svg',
    primaryColor: colors.primary[600],
    secondaryColor: colors.secondary[500],
    accentColor: colors.accent[500],
  },
  config: {
    defaultLanguage: 'ar',
    timezone: 'Asia/Riyadh',
    sessionDuration: 60,
    reminderBeforeMinutes: 30,
  },
};

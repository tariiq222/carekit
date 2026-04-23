export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5100/api/v1';

export const APP_NAME = 'CareKit';
export const APP_SCHEME = 'carekit';

export const DEFAULT_LANGUAGE = 'ar';
export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

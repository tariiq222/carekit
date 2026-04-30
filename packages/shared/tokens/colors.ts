/**
 * Deqah Design System — Color Tokens
 * Source of truth: Deqah-DesignSystem.jsx
 *
 * Primary: Royal Blue   #1D4ED8 (dark: #0037B0)
 * Secondary: Apple Green #84CC16 (dark: #65A30D)
 * Text: #191C1E — never pure black
 * Shadows: #001551 tinted — never pure black
 */
export const colors = {
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#1D4ED8',
    600: '#1D4ED8',
    700: '#0037B0',
    800: '#1E3A8A',
    900: '#1E3163',
  },
  secondary: {
    50: '#F7FEE7',
    100: '#ECFCCB',
    200: '#D9F99D',
    300: '#BEF264',
    400: '#A3E635',
    500: '#84CC16',
    600: '#65A30D',
    700: '#365314',
    800: '#1A2E05',
    900: '#0F1A03',
  },
  accent: {
    500: '#FF6B35',
  },
  gray: {
    50: '#F7F9FB',
    100: '#F2F4F6',
    200: '#E6E8EA',
    300: '#C4C5D7',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#191C1E',
  },
  success: '#059669',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#0EA5E9',
  purple: '#7C3AED',
  teal: '#0D9488',
  white: '#FFFFFF',
  black: '#191C1E',
  background: '#F7F9FB',
  surface: '#F7F9FB',
  surfaceLow: '#F2F4F6',
  surfaceHigh: '#E6E8EA',
  border: '#E6E8EA',
  textPrimary: '#191C1E',
  textSecondary: '#64748B',
  textMuted: '#C4C5D7',
  status: {
    pending: '#F59E0B',
    confirmed: '#059669',
    completed: '#1D4ED8',
    cancelled: '#DC2626',
    pendingCancellation: '#F97316',
  },
  payment: {
    pending: '#F59E0B',
    paid: '#059669',
    refunded: '#7C3AED',
    failed: '#DC2626',
  },
} as const;

export type ColorToken = typeof colors;

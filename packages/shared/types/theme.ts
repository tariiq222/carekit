export interface ClinicTheme {
  colorPrimary: string;
  colorPrimaryLight: string;
  colorPrimaryDark: string;
  colorAccent: string;
  colorAccentDark: string;
  colorBackground: string;
  fontFamily: string;
  fontUrl: string | null;
  logoUrl: string | null;
  productName: string;
  productTagline: string;
}

export interface DerivedTokens {
  colorPrimaryGlow: string;
  colorPrimaryUltra: string;
  colorAccentGlow: string;
  colorAccentUltra: string;
}

export const DEFAULT_THEME: ClinicTheme = {
  colorPrimary:      '#354FD8',
  colorPrimaryLight: '#5B72E8',
  colorPrimaryDark:  '#2438B0',
  colorAccent:       '#82CC17',
  colorAccentDark:   '#5A9010',
  colorBackground:   '#EEF1F8',
  fontFamily:        'IBM Plex Sans Arabic',
  fontUrl:           'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap',
  logoUrl:           null,
  productName:       'CareKit',
  productTagline:    'إدارة العيادة',
}

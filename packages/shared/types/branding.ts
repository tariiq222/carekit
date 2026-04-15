/**
 * BrandingConfig — the canonical shape returned by GET /public/branding/:tenantId.
 * All apps (dashboard, mobile) consume this type.
 */
export interface BrandingConfig {
  // Identity
  systemName:        string;
  systemNameAr:      string;
  productTagline:    string | null;
  // Assets
  logoUrl:           string | null;
  faviconUrl:        string | null;
  // Colors
  colorPrimary:      string;
  colorPrimaryLight: string;
  colorPrimaryDark:  string;
  colorAccent:       string;
  colorAccentDark:   string;
  colorBackground:   string;
  // Typography
  fontFamily:        string;
  fontUrl:           string | null;
}

export interface DerivedTokens {
  colorPrimaryGlow:  string;
  colorPrimaryUltra: string;
  colorAccentGlow:   string;
  colorAccentUltra:  string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  systemName:        'CareKit',
  systemNameAr:      'كيركيت',
  productTagline:    'إدارة العيادة',
  logoUrl:           null,
  faviconUrl:        null,
  colorPrimary:      '#354FD8',
  colorPrimaryLight: '#5B72E8',
  colorPrimaryDark:  '#2438B0',
  colorAccent:       '#82CC17',
  colorAccentDark:   '#5A9010',
  colorBackground:   '#EEF1F8',
  fontFamily:        'IBM Plex Sans Arabic',
  fontUrl:           'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap',
};

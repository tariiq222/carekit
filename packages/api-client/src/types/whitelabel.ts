export interface WhitelabelConfig {
  organizationName: string
  organizationNameAr: string
  logoUrl: string
  faviconUrl: string
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  domain: string | null
  direction: 'rtl' | 'ltr'
  locale: 'ar' | 'en'
}

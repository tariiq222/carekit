export interface UpsertBrandingDto {
  tenantId: string;
  clinicNameAr: string;
  clinicNameEn?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  customCss?: string;
}

export interface GetBrandingDto {
  tenantId: string;
}

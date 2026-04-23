import api from './api';

export interface BrandingConfig {
  primaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  clinicName: string | null;
}

export const brandingService = {
  async getBranding(): Promise<BrandingConfig | null> {
    try {
      const response = await api.get<{ success: boolean; data: BrandingConfig }>('/public/branding');
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch {
      return null;
    }
  },
};

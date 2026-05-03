import { adminRequest } from '@/lib/api-client';

export interface PlatformBrand {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  locale: {
    default: string;
    rtlDefault: boolean;
    dateFormat: string;
    currencyFormat: string;
  };
}

export async function getPlatformBrand(): Promise<PlatformBrand> {
  return adminRequest<PlatformBrand>('/settings/brand');
}

export async function updatePlatformBrand(
  body: Partial<PlatformBrand> & { locale?: Partial<PlatformBrand['locale']> },
): Promise<void> {
  return adminRequest<void>('/settings/brand', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

import { apiRequest } from '../client.js'

export interface ClinicSettings {
  id: string
  companyNameAr: string | null
  companyNameEn: string | null
  businessRegistration: string | null
  vatRegistrationNumber: string | null
  vatRate: number | null
  sellerAddress: string | null
  clinicCity: string | null
  postalCode: string | null
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  socialMedia: Record<string, string> | null
  aboutAr: string | null
  aboutEn: string | null
  privacyPolicyAr: string | null
  privacyPolicyEn: string | null
  termsAr: string | null
  termsEn: string | null
  cancellationPolicyAr: string | null
  cancellationPolicyEn: string | null
  defaultLanguage: string | null
  timezone: string | null
  weekStartDay: string | null
  dateFormat: string | null
  timeFormat: string | null
  emailHeaderShowLogo: boolean
  emailHeaderShowName: boolean
  emailFooterPhone: string | null
  emailFooterWebsite: string | null
  emailFooterInstagram: string | null
  emailFooterTwitter: string | null
  emailFooterSnapchat: string | null
  emailFooterTiktok: string | null
  emailFooterLinkedin: string | null
  emailFooterYoutube: string | null
  sessionDuration: number | null
  reminderBeforeMinutes: number | null
  createdAt: string
  updatedAt: string
}

export type UpdateClinicSettingsPayload = Partial<
  Omit<ClinicSettings, 'id' | 'createdAt' | 'updatedAt'>
>

export async function get(): Promise<ClinicSettings> {
  return apiRequest<ClinicSettings>('/clinic-settings')
}

export async function update(payload: UpdateClinicSettingsPayload): Promise<ClinicSettings> {
  return apiRequest<ClinicSettings>('/clinic-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

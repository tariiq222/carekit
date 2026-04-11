export interface FeatureFlags {
  bookings: boolean
  patients: boolean
  practitioners: boolean
  services: boolean
  branches: boolean
  reports: boolean
  users: boolean
  clinicSettings: boolean
  activityLog: boolean
  groupSessions: boolean
  payments: boolean
  invoices: boolean
  coupons: boolean
  giftCards: boolean
  zatca: boolean
  intakeForms: boolean
  chatbot: boolean
  whitelabel: boolean
  ratings: boolean
  notifications: boolean
  integrations: boolean
  emailTemplates: boolean
  departments: boolean
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  bookings: true,
  patients: true,
  practitioners: true,
  services: true,
  branches: true,
  reports: true,
  users: true,
  clinicSettings: true,
  activityLog: true,
  groupSessions: true,
  payments: true,
  invoices: true,
  coupons: true,
  giftCards: true,
  zatca: true,
  intakeForms: true,
  chatbot: true,
  whitelabel: true,
  ratings: true,
  notifications: true,
  integrations: true,
  emailTemplates: true,
  departments: true,
}

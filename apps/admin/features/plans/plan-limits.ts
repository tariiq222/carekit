export interface PlanLimits {
  maxBranches: number;
  maxEmployees: number;
  maxServices: number;
  maxBookingsPerMonth: number;
  maxClients: number;
  maxStorageMB: number;
  overageRateBookings: number;
  overageRateClients: number;
  overageRateStorageGB: number;
  recurring_bookings: boolean;
  waitlist: boolean;
  group_sessions: boolean;
  ai_chatbot: boolean;
  email_templates: boolean;
  coupons: boolean;
  advanced_reports: boolean;
  intake_forms: boolean;
  zatca: boolean;
  custom_roles: boolean;
  activity_log: boolean;
}

export const QUOTA_FIELDS = [
  { key: 'maxBranches', label: 'Max branches', hint: '-1 = unlimited' },
  { key: 'maxEmployees', label: 'Max employees', hint: '-1 = unlimited' },
  { key: 'maxServices', label: 'Max services', hint: '-1 = unlimited' },
  { key: 'maxBookingsPerMonth', label: 'Bookings / month', hint: '-1 = unlimited' },
  { key: 'maxClients', label: 'Max clients', hint: '-1 = unlimited' },
  { key: 'maxStorageMB', label: 'Storage (MB)', hint: '-1 = unlimited' },
] as const satisfies ReadonlyArray<{ key: keyof PlanLimits; label: string; hint: string }>;

export const OVERAGE_FIELDS = [
  { key: 'overageRateBookings', label: 'Overage — per booking (SAR)' },
  { key: 'overageRateClients', label: 'Overage — per client (SAR)' },
  { key: 'overageRateStorageGB', label: 'Overage — per GB storage (SAR)' },
] as const satisfies ReadonlyArray<{ key: keyof PlanLimits; label: string }>;

export const FEATURE_FIELDS = [
  { key: 'recurring_bookings', label: 'Recurring bookings' },
  { key: 'waitlist', label: 'Waitlist' },
  { key: 'group_sessions', label: 'Group sessions' },
  { key: 'ai_chatbot', label: 'AI chatbot' },
  { key: 'email_templates', label: 'Email templates' },
  { key: 'coupons', label: 'Coupons' },
  { key: 'advanced_reports', label: 'Advanced reports' },
  { key: 'intake_forms', label: 'Intake forms' },
  { key: 'zatca', label: 'ZATCA e-invoicing' },
  { key: 'custom_roles', label: 'Custom roles' },
  { key: 'activity_log', label: 'Activity log' },
] as const satisfies ReadonlyArray<{ key: keyof PlanLimits; label: string }>;

export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  maxBranches: 1,
  maxEmployees: 5,
  maxServices: -1,
  maxBookingsPerMonth: -1,
  maxClients: -1,
  maxStorageMB: 1024,
  overageRateBookings: 0,
  overageRateClients: 0,
  overageRateStorageGB: 0,
  recurring_bookings: false,
  waitlist: false,
  group_sessions: false,
  ai_chatbot: false,
  email_templates: false,
  coupons: false,
  advanced_reports: false,
  intake_forms: false,
  zatca: false,
  custom_roles: false,
  activity_log: false,
};

export function hydrateLimits(raw: Record<string, unknown> | undefined): PlanLimits {
  const out = { ...DEFAULT_PLAN_LIMITS };
  if (!raw) return out;
  for (const key of Object.keys(out) as Array<keyof PlanLimits>) {
    const v = raw[key];
    if (typeof out[key] === 'boolean' && typeof v === 'boolean') {
      (out[key] as boolean) = v;
    } else if (typeof out[key] === 'number' && typeof v === 'number') {
      (out[key] as number) = v;
    }
  }
  return out;
}

export function mergeLimits(
  raw: Record<string, unknown> | undefined,
  edited: PlanLimits,
): Record<string, unknown> {
  return { ...(raw ?? {}), ...edited };
}

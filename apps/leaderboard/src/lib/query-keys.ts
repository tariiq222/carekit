export const QUERY_KEYS = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  featureFlags: {
    map: ['feature-flags', 'map'] as const,
  },
  whitelabel: {
    config: ['whitelabel', 'config'] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    list: (params: Record<string, unknown>) => ['bookings', 'list', params] as const,
    stats: ['bookings', 'stats'] as const,
    detail: (id: string) => ['bookings', id] as const,
  },
  patients: {
    all: ['patients'] as const,
    list: (params: Record<string, unknown>) => ['patients', 'list', params] as const,
    stats: ['patients', 'stats'] as const,
    detail: (id: string) => ['patients', id] as const,
  },
  practitioners: {
    all: ['practitioners'] as const,
    list: (params: Record<string, unknown>) => ['practitioners', 'list', params] as const,
    stats: ['practitioners', 'stats'] as const,
    detail: (id: string) => ['practitioners', id] as const,
    availability: (id: string) => ['practitioners', id, 'availability'] as const,
    ratings: (id: string, params: Record<string, unknown>) =>
      ['practitioners', id, 'ratings', params] as const,
  },
  services: {
    all: ['services'] as const,
    list: (params: Record<string, unknown>) => ['services', 'list', params] as const,
    stats: ['services', 'stats'] as const,
    detail: (id: string) => ['services', id] as const,
  },
  branches: {
    all: ['branches'] as const,
    list: (params: Record<string, unknown>) => ['branches', 'list', params] as const,
    stats: ['branches', 'stats'] as const,
    detail: (id: string) => ['branches', id] as const,
  },
  departments: {
    all: ['departments'] as const,
    list: (params: Record<string, unknown>) => ['departments', 'list', params] as const,
    stats: ['departments', 'stats'] as const,
    detail: (id: string) => ['departments', id] as const,
  },
  specialties: {
    all: ['specialties'] as const,
    list: (params: Record<string, unknown>) => ['specialties', 'list', params] as const,
    stats: ['specialties', 'stats'] as const,
    detail: (id: string) => ['specialties', id] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: (params: Record<string, unknown>) => ['payments', 'list', params] as const,
    stats: ['payments', 'stats'] as const,
    detail: (id: string) => ['payments', id] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (params: Record<string, unknown>) => ['invoices', 'list', params] as const,
    stats: ['invoices', 'stats'] as const,
    detail: (id: string) => ['invoices', id] as const,
  },
  coupons: {
    all: ['coupons'] as const,
    list: (params: Record<string, unknown>) => ['coupons', 'list', params] as const,
    stats: ['coupons', 'stats'] as const,
    detail: (id: string) => ['coupons', id] as const,
  },
  giftCards: {
    all: ['gift-cards'] as const,
    list: (params: Record<string, unknown>) => ['gift-cards', 'list', params] as const,
    stats: ['gift-cards', 'stats'] as const,
    detail: (id: string) => ['gift-cards', id] as const,
  },
} as const

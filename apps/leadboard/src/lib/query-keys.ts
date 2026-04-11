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
  },
  services: {
    all: ['services'] as const,
    list: (params: Record<string, unknown>) => ['services', 'list', params] as const,
    detail: (id: string) => ['services', id] as const,
  },
  branches: {
    all: ['branches'] as const,
    list: (params: Record<string, unknown>) => ['branches', 'list', params] as const,
    detail: (id: string) => ['branches', id] as const,
  },
} as const

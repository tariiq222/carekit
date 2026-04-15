import type { BrandingConfig } from '@carekit/shared/types'

export type UpdateBrandingPayload = Partial<Omit<BrandingConfig, 'id' | 'createdAt' | 'updatedAt'>>

export type { BrandingConfig }

"use client"

/**
 * useTerminology — Fetches vertical-specific terminology tokens from the
 * public endpoint and exposes a locale-aware lookup function.
 *
 * `verticalSlug` must be supplied by the caller. The current auth session
 * (AuthUser) and OrganizationSettings do not yet carry the vertical slug —
 * this will be populated in Plan 07. Until then, pass the slug from your
 * nearest source (e.g. a server-side prop or a config fetch).
 *
 * Example:
 *   const { t } = useTerminology('clinic')
 *   t('client') // → "مريض" or "Patient" depending on locale
 */

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useLocale } from "@/components/locale-provider"

/* ─── Types ─── */

export interface TerminologyToken {
  ar: string
  en: string
}

export type TerminologyPack = Record<string, TerminologyToken>

/* ─── Query Key ─── */

export const terminologyQueryKey = (slug: string | undefined) =>
  ["terminology", slug] as const

/* ─── Hook ─── */

export function useTerminology(verticalSlug: string | undefined) {
  const { locale } = useLocale()

  const query = useQuery<TerminologyPack>({
    queryKey: terminologyQueryKey(verticalSlug),
    queryFn: () =>
      api.get<TerminologyPack>(`/public/verticals/${verticalSlug}/terminology`),
    enabled: !!verticalSlug,
    staleTime: 30 * 60 * 1000, // 30 min — vertical terminology rarely changes
  })

  /**
   * Resolve a terminology key to a localised string.
   * Falls back to the key itself when the pack hasn't loaded yet or the
   * key is absent from the pack.
   */
  const t = (key: string): string => {
    const token = query.data?.[key]
    if (!token) return key
    return token[locale] ?? token.ar ?? key
  }

  return {
    t,
    isLoading: query.isLoading,
    pack: query.data,
  }
}

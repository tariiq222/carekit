import { useQuery } from '@tanstack/react-query'
import { themeApi } from '@carekit/api-client'
import { DEFAULT_THEME } from '@carekit/shared/types'

export const THEME_QUERY_KEY = ['clinic-theme'] as const

export function useTheme() {
  return useQuery({
    queryKey: THEME_QUERY_KEY,
    queryFn: () => themeApi.getTheme(),
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    retry: 1,
    placeholderData: DEFAULT_THEME,
  })
}

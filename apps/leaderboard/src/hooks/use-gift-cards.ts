import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { giftCardsApi } from '@carekit/api-client'
import type {
  CreateGiftCardPayload,
  GiftCardListQuery,
  UpdateGiftCardPayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useGiftCards(query: GiftCardListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.giftCards.list(query as Record<string, unknown>),
    queryFn: () => giftCardsApi.list(query),
  })
}

export function useGiftCard(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.giftCards.detail(id),
    queryFn: () => giftCardsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateGiftCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateGiftCardPayload) => giftCardsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.giftCards.all })
    },
  })
}

export function useUpdateGiftCard(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateGiftCardPayload) =>
      giftCardsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.giftCards.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.giftCards.all })
    },
  })
}

export function useDeactivateGiftCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => giftCardsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.giftCards.all })
    },
  })
}

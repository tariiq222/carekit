import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { couponsApi } from '@carekit/api-client'
import type {
  CouponListQuery,
  CreateCouponPayload,
  UpdateCouponPayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useCoupons(query: CouponListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.coupons.list(query as Record<string, unknown>),
    queryFn: () => couponsApi.list(query),
  })
}

export function useCoupon(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.coupons.detail(id),
    queryFn: () => couponsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCouponPayload) => couponsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.coupons.all })
    },
  })
}

export function useUpdateCoupon(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateCouponPayload) => couponsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.coupons.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.coupons.all })
    },
  })
}

export function useDeleteCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => couponsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.coupons.all })
    },
  })
}

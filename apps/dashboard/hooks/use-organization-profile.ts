"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { fetchOrgProfile, updateOrgProfile } from "@/lib/api/organization-profile"
import type { UpdateOrgProfilePayload } from "@/lib/types/organization-profile"
import { ApiError } from "@/lib/api"

export function useOrganizationProfile() {
  return useQuery({
    queryKey: queryKeys.organization.profile(),
    queryFn: fetchOrgProfile,
    staleTime: 10 * 60 * 1000,
  })
}

export function useUpdateOrganizationProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateOrgProfilePayload) => updateOrgProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organization.all })
      toast.success("تم حفظ الملف")
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "فشل حفظ الملف"
      if (message === "SLUG_TAKEN") {
        toast.error("هذا المعرّف مستخدم")
      } else {
        toast.error(message)
      }
    },
  })
}
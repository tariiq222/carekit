"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchEmailTemplates,
  updateEmailTemplate,
} from "@/lib/api/email-templates"
import type {
  UpdateEmailTemplatePayload,
} from "@/lib/types/email-template"

/* ─── List ─── */

export function useEmailTemplates() {
  return useQuery({
    queryKey: queryKeys.emailTemplates.list(),
    queryFn: fetchEmailTemplates,
    staleTime: 30 * 60 * 1000,
  })
}

/* ─── Mutations ─── */

export function useEmailTemplateMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateEmailTemplatePayload) =>
      updateEmailTemplate(id, payload),
    onSuccess: invalidate,
  })

  // previewMut stub — TODO: no backend endpoint for email preview
  const previewMut = useMutation({
    mutationFn: async (_args: { slug: string; context: Record<string, string>; lang: "ar" | "en" }) => {
      return null as unknown as { subject: string; body: string }
    },
  })

  return { updateMut, previewMut }
}

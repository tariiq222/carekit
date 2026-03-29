"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchIntakeForms,
  fetchIntakeForm,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
} from "@/lib/api/intake-forms"
import type {
  IntakeFormListQuery,
  CreateIntakeFormApiPayload,
  UpdateIntakeFormApiPayload,
  SetFieldsApiPayload,
} from "@/lib/types/intake-form-api"

/* ─── List Hook ─── */

export function useIntakeForms(initialQuery?: IntakeFormListQuery) {
  const [query, setQuery] = useState<IntakeFormListQuery>(initialQuery ?? {})

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.intakeForms.list(query),
    queryFn: () => fetchIntakeForms(query),
  })

  return {
    forms: data ?? [],
    isLoading,
    error: error?.message ?? null,
    query,
    setQuery,
    refetch,
  }
}

/* ─── Detail Hook ─── */

export function useIntakeForm(formId: string | null) {
  return useQuery({
    queryKey: queryKeys.intakeForms.detail(formId ?? ""),
    queryFn: () => fetchIntakeForm(formId!),
    enabled: !!formId,
  })
}

/* ─── Mutations Hook ─── */

export function useIntakeFormMutations() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.intakeForms.all })

  const createMut = useMutation({
    mutationFn: (payload: CreateIntakeFormApiPayload) =>
      createIntakeForm(payload),
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({
      formId,
      payload,
    }: {
      formId: string
      payload: UpdateIntakeFormApiPayload
    }) => updateIntakeForm(formId, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (formId: string) => deleteIntakeForm(formId),
    onSuccess: invalidate,
  })

  const setFieldsMut = useMutation({
    mutationFn: ({
      formId,
      payload,
    }: {
      formId: string
      payload: SetFieldsApiPayload
    }) => setIntakeFields(formId, payload),
    onSuccess: (_, { formId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.intakeForms.detail(formId),
      })
      invalidate()
    },
  })

  return {
    create: createMut.mutate,
    createAsync: createMut.mutateAsync,
    createLoading: createMut.isPending,

    update: updateMut.mutate,
    updateAsync: updateMut.mutateAsync,
    updateLoading: updateMut.isPending,

    delete: deleteMut.mutate,
    deleteLoading: deleteMut.isPending,

    setFields: setFieldsMut.mutate,
    setFieldsAsync: setFieldsMut.mutateAsync,
    setFieldsLoading: setFieldsMut.isPending,
  }
}

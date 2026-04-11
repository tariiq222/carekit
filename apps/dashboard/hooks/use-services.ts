"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchServices,
  fetchServicesListStats,
  fetchCategories,
  createService,
  updateService,
  deleteService,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchDurationOptions,
  setDurationOptions,
  fetchServiceBookingTypes,
  setServiceBookingTypes,
  fetchIntakeForms,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
  fetchServiceEmployees,
  setServiceBranches,
  clearServiceBranches,
} from "@/lib/api/services"
import { assignService } from "@/lib/api/employees"
import type { AssignServicePayload } from "@/lib/types/employee"
import type {
  ServiceListQuery,
  SetServiceBranchesPayload,
} from "@/lib/types/service"
import type {
  SetDurationOptionsPayload,
  SetServiceBookingTypesPayload,
  CreateIntakeFormPayload,
  UpdateIntakeFormPayload,
  SetFieldsPayload,
} from "@/lib/types/service-payloads"

/* ─── Services List ─── */

export function useServices() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [isActive, setIsActive] = useState<boolean | undefined>()
  const [branchId, setBranchId] = useState<string | undefined>()

  const query: ServiceListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    categoryId,
    isActive,
    includeHidden: true, // Admin dashboard shows all services
    branchId,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services.list(query),
    queryFn: () => fetchServices(query),
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setCategoryId(undefined)
    setIsActive(undefined)
    setBranchId(undefined)
    setPage(1)
  }, [])

  return {
    services: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    categoryId,
    setCategoryId: (id: string | undefined) => { setCategoryId(id); setPage(1) },
    isActive,
    setIsActive: (v: boolean | undefined) => { setIsActive(v); setPage(1) },
    branchId,
    setBranchId: (id: string | undefined) => { setBranchId(id); setPage(1) },
    resetFilters,
    refetch,
  }
}

/* ─── Services List Stats ─── */

export function useServicesListStats() {
  return useQuery({
    queryKey: queryKeys.services.listStats(),
    queryFn: fetchServicesListStats,
    staleTime: 30 * 1000,
  })
}

/* ─── Categories ─── */

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.services.categories(),
    queryFn: fetchCategories,
    staleTime: 30 * 60 * 1000, // 30 min — categories rarely change
  })
}

/* ─── Service Mutations ─── */

export function useServiceMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.services.all, refetchType: "all" })

  const createMut = useMutation({
    mutationFn: createService,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateService>[1]) =>
      updateService(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteService,
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}

/* ─── Category Mutations ─── */

export function useCategoryMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.services.categories() })

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateCategory>[1]) =>
      updateCategory(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}


/* ─── Duration Options ─── */

export function useDurationOptions(serviceId: string | null) {
  return useQuery({
    queryKey: queryKeys.services.durationOptions(serviceId ?? ""),
    queryFn: () => fetchDurationOptions(serviceId!),
    enabled: !!serviceId,
  })
}

export function useDurationOptionsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: string; payload: SetDurationOptionsPayload }) =>
      setDurationOptions(serviceId, payload),
    onSuccess: (_data, { serviceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.durationOptions(serviceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all })
    },
  })
}

/* ─── Booking Types ─── */

export function useServiceBookingTypes(serviceId: string | null) {
  return useQuery({
    queryKey: queryKeys.services.bookingTypes(serviceId!),
    queryFn: () => fetchServiceBookingTypes(serviceId!),
    enabled: !!serviceId,
  })
}

export function useServiceBookingTypesMutation(serviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SetServiceBookingTypesPayload) =>
      setServiceBookingTypes(serviceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.bookingTypes(serviceId) })
    },
  })
}

/* ─── Intake Forms ─── */

export function useIntakeForms(serviceId: string | null) {
  return useQuery({
    queryKey: queryKeys.services.intakeForms(serviceId ?? ""),
    queryFn: () => fetchIntakeForms(serviceId!),
    enabled: !!serviceId,
  })
}

export function useIntakeFormMutations(serviceId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.services.intakeForms(serviceId) })

  const createMut = useMutation({
    mutationFn: (payload: CreateIntakeFormPayload) =>
      createIntakeForm(serviceId, payload),
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ formId, payload }: { formId: string; payload: UpdateIntakeFormPayload }) =>
      updateIntakeForm(formId, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteIntakeForm,
    onSuccess: invalidate,
  })

  const setFieldsMut = useMutation({
    mutationFn: ({ formId, payload }: { formId: string; payload: SetFieldsPayload }) =>
      setIntakeFields(formId, payload),
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut, setFieldsMut }
}

/* ─── Service Employees Hook ─── */

export function useServiceEmployees(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.services.employees(serviceId),
    queryFn: () => fetchServiceEmployees(serviceId),
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Assign Employees to Service ─── */

export function useAssignEmployeesToService(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (employeeIds: string[]) =>
      Promise.all(
        employeeIds.map((employeeId) =>
          assignService(employeeId, {
            serviceId,
            availableTypes: ["in_person", "online"],
            isActive: true,
          } satisfies AssignServicePayload),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.services.employees(serviceId),
      })
    },
  })
}

/* ─── Service Branch Mutations ─── */

export function useSetServiceBranches(serviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SetServiceBranchesPayload) =>
      setServiceBranches(serviceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(serviceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all })
    },
  })
}

export function useClearServiceBranches(serviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => clearServiceBranches(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(serviceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all })
    },
  })
}

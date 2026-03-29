"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  fetchBranchPractitioners,
  assignBranchPractitioners,
  removeBranchPractitioner,
} from "@/lib/api/branches"
import type { BranchListQuery } from "@/lib/types/branch"

/* ─── Branches List ─── */

export function useBranches() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  const query: BranchListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.branches.list(query),
    queryFn: () => fetchBranches(query),
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    branches: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    isActive,
    setIsActive: (v: boolean | undefined) => { setIsActive(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

/* ─── Branch Mutations ─── */

export function useBranchMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.branches.all })

  const createMut = useMutation({
    mutationFn: createBranch,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateBranch>[1]) =>
      updateBranch(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteBranch,
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}

/* ─── Branch Practitioners ─── */

export function useBranchPractitioners(branchId: string | null) {
  return useQuery({
    queryKey: queryKeys.branches.practitioners(branchId ?? ""),
    queryFn: () => fetchBranchPractitioners(branchId!),
    enabled: !!branchId,
  })
}

export function useBranchPractitionerMutations() {
  const queryClient = useQueryClient()

  const assignMut = useMutation({
    mutationFn: ({ branchId, practitionerIds }: { branchId: string; practitionerIds: string[] }) =>
      assignBranchPractitioners(branchId, practitionerIds),
    onSuccess: (_data, { branchId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.practitioners(branchId) })
    },
  })

  const removeMut = useMutation({
    mutationFn: ({ branchId, practitionerId }: { branchId: string; practitionerId: string }) =>
      removeBranchPractitioner(branchId, practitionerId),
    onSuccess: (_data, { branchId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.practitioners(branchId) })
    },
  })

  return { assignMut, removeMut }
}

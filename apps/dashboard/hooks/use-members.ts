/**
 * Members & Invitations Hooks — CareKit Dashboard
 */

"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchMembers,
  inviteMember,
  updateMemberRole,
  deactivateMember,
  fetchInvitations,
  revokeInvitation,
} from "@/lib/api/members"
import type {
  MemberListQuery,
  MembershipRole,
} from "@/lib/types/members"
import { ApiError } from "@/lib/api"

export function useMembers() {
  const [page, setPage] = useState(1)
  const [role, setRole] = useState<MembershipRole | undefined>()
  const [isActive, setIsActive] = useState<boolean | undefined>()

  const query: MemberListQuery = {
    page,
    limit: 20,
    ...(role && { role }),
    ...(isActive !== undefined && { isActive }),
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["members", query],
    queryFn: () => fetchMembers(query),
  })

  const resetFilters = useCallback(() => {
    setRole(undefined)
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    members: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    role,
    setRole: (r: MembershipRole | undefined) => { setRole(r); setPage(1) },
    isActive,
    setIsActive: (a: boolean | undefined) => { setIsActive(a); setPage(1) },
    resetFilters,
    refetch,
  }
}

export function useInvitations() {
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["invitations", page],
    queryFn: () => fetchInvitations({ page, limit: 20 }),
  })

  return {
    invitations: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    refetch,
  }
}

export function useMemberMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["members"] })
    queryClient.invalidateQueries({ queryKey: ["invitations"] })
  }

  const inviteMut = useMutation({
    mutationFn: (data: { email: string; role: MembershipRole }) => inviteMember(data),
    onSuccess: () => {
      toast.success("Invitation sent")
      invalidate()
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to send invitation"
      if (msg === "ALREADY_MEMBER") {
        toast.error("User is already a member")
      } else {
        toast.error(msg)
      }
    },
  })

  const updateRoleMut = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: MembershipRole }) =>
      updateMemberRole(membershipId, { role }),
    onSuccess: () => {
      toast.success("Role updated")
      invalidate()
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to update role"
      if (msg === "CANNOT_CHANGE_SOLE_OWNER") {
        toast.error("Cannot change role of the sole owner")
      } else {
        toast.error(msg)
      }
    },
  })

  const deactivateMut = useMutation({
    mutationFn: (membershipId: string) => deactivateMember(membershipId),
    onSuccess: () => {
      toast.success("Member deactivated")
      invalidate()
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to deactivate member"
      if (msg === "CANNOT_DEACTIVATE_SELF") {
        toast.error("You cannot deactivate yourself")
      } else if (msg === "CANNOT_DEACTIVATE_SOLE_OWNER") {
        toast.error("Cannot deactivate the sole owner")
      } else {
        toast.error(msg)
      }
    },
  })

  const revokeMut = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onSuccess: () => {
      toast.success("Invitation revoked")
      invalidate()
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to revoke invitation"
      toast.error(msg)
    },
  })

  return { inviteMut, updateRoleMut, deactivateMut, revokeMut }
}
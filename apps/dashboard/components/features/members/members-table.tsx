"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ShieldKeyIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Badge } from "@carekit/ui"
import { EmptyState } from "@/components/features/empty-state"
import { useLocale } from "@/components/locale-provider"
import { useMembers, useMemberMutations } from "@/hooks/use-members"
import type { Member, MembershipRole } from "@/lib/types/members"

const ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  RECEPTIONIST: "Receptionist",
  ACCOUNTANT: "Accountant",
  EMPLOYEE: "Employee",
}

const ROLE_BADGE_VARIANT: Record<MembershipRole, "default" | "secondary" | "outline"> = {
  OWNER: "default",
  ADMIN: "secondary",
  RECEPTIONIST: "outline",
  ACCOUNTANT: "outline",
  EMPLOYEE: "outline",
}

export function MembersTable() {
  const { t } = useLocale()
  const { members, meta, isLoading, page, setPage } = useMembers()
  const { updateRoleMut, deactivateMut } = useMemberMutations()
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)

  const columns: ColumnDef<Member>[] = [
    {
      accessorKey: "userId",
      header: t("members.userId"),
      cell: ({ row }) => (
        <span className="font-mono text-xs" dir="ltr">{row.original.userId}</span>
      ),
    },
    {
      accessorKey: "role",
      header: t("members.role"),
      cell: ({ row }) => (
        <Badge variant={ROLE_BADGE_VARIANT[row.original.role]}>
          {ROLE_LABELS[row.original.role]}
        </Badge>
      ),
    },
    {
      accessorKey: "isActive",
      header: t("members.status"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? t("members.active") : t("members.inactive")}
        </Badge>
      ),
    },
    {
      accessorKey: "acceptedAt",
      header: t("members.joinedAt"),
      cell: ({ row }) =>
        row.original.acceptedAt
          ? new Date(row.original.acceptedAt).toLocaleDateString("ar-SA")
          : "—",
    },
    {
      accessorKey: "createdAt",
      header: t("members.invitedAt"),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("ar-SA"),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedMember(row.original)
              setShowRoleDialog(true)
            }}
          >
            <HugeiconsIcon icon={ShieldKeyIcon} size={16} />
            {t("members.changeRole")}
          </Button>
          {row.original.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedMember(row.original)
                setShowDeactivateDialog(true)
              }}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              {t("members.deactivate")}
            </Button>
          )}
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: members,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: meta?.totalPages ?? 1,
    state: { pagination: { pageIndex: page - 1, pageSize: 20 } },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function"
        ? updater({ pageIndex: page - 1, pageSize: 20 })
        : updater
      setPage(next.pageIndex + 1)
    },
  })

  if (!isLoading && members.length === 0) {
    return (
      <EmptyState
        title={t("members.empty.title")}
        description={t("members.empty.description")}
      />
    )
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage}
            onClick={() => setPage(page - 1)}
          >
            {t("common.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNextPage}
            onClick={() => setPage(page + 1)}
          >
            {t("common.next")}
          </Button>
        </div>
      )}

      {/* Role Change Dialog */}
      {showRoleDialog && selectedMember && (
        <RoleChangeDialog
          member={selectedMember}
          open={showRoleDialog}
          onOpenChange={setShowRoleDialog}
          onSave={(role) => {
            updateRoleMut.mutate(
              { membershipId: selectedMember.id, role },
              {
                onSuccess: () => setShowRoleDialog(false),
              },
            )
          }}
          isPending={updateRoleMut.isPending}
        />
      )}

      {/* Deactivate Dialog */}
      {showDeactivateDialog && selectedMember && (
        <DeactivateDialog
          member={selectedMember}
          open={showDeactivateDialog}
          onOpenChange={setShowDeactivateDialog}
          onConfirm={() => {
            deactivateMut.mutate(selectedMember.id, {
              onSuccess: () => setShowDeactivateDialog(false),
            })
          }}
          isPending={deactivateMut.isPending}
        />
      )}
    </>
  )
}

/* ─── Role Change Dialog ─── */

interface RoleChangeDialogProps {
  member: Member
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (role: MembershipRole) => void
  isPending: boolean
}

function RoleChangeDialog({ member, onOpenChange, onSave, isPending }: RoleChangeDialogProps) {
  const { t } = useLocale()
  const [selectedRole, setSelectedRole] = useState<MembershipRole>(member.role)

  const roles: MembershipRole[] = ["OWNER", "ADMIN", "RECEPTIONIST", "ACCOUNTANT", "EMPLOYEE"]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{t("members.changeRole")}</h2>
        <div className="space-y-3">
          {roles.map((role) => (
            <label key={role} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted">
              <input
                type="radio"
                name="role"
                value={role}
                checked={selectedRole === role}
                onChange={() => setSelectedRole(role)}
                className="accent-primary"
              />
              <span>{ROLE_LABELS[role]}</span>
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={isPending || selectedRole === member.role}
            onClick={() => onSave(selectedRole)}
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Deactivate Dialog ─── */

interface DeactivateDialogProps {
  member: Member
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}

function DeactivateDialog({ onOpenChange, onConfirm, isPending }: DeactivateDialogProps) {
  const { t } = useLocale()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold">{t("members.deactivate")}</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {t("members.deactivateConfirm")}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? t("common.saving") : t("members.deactivate")}
          </Button>
        </div>
      </div>
    </div>
  )
}
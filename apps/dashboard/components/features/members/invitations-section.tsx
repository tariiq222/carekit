"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
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
import { useLocale } from "@/components/locale-provider"
import { useInvitations, useMemberMutations } from "@/hooks/use-members"

export function InvitationsSection() {
  const { t } = useLocale()
  const { invitations, meta, isLoading, page, setPage } = useInvitations()
  const { revokeMut } = useMemberMutations()

  if (!isLoading && invitations.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t("members.invitations.title")}</h3>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("members.email")}</TableHead>
              <TableHead>{t("members.role")}</TableHead>
              <TableHead>{t("members.status")}</TableHead>
              <TableHead>{t("members.expiresAt")}</TableHead>
              <TableHead>{t("members.invitedAt")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell dir="ltr">{inv.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{inv.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={inv.status === "PENDING" ? "default" : "secondary"}>
                    {t(`members.status.${inv.status.toLowerCase()}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(inv.expiresAt).toLocaleDateString("ar-SA")}
                </TableCell>
                <TableCell>
                  {new Date(inv.createdAt).toLocaleDateString("ar-SA")}
                </TableCell>
                <TableCell>
                  {inv.status === "PENDING" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revokeMut.isPending}
                      onClick={() => revokeMut.mutate(inv.id)}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} />
                      {t("members.revoke")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage}
            onClick={() => setPage(page - 1)}
          >
            {t("common.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {meta.totalPages}</span>
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
    </div>
  )
}
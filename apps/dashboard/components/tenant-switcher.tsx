"use client"

/**
 * TenantSwitcher — SaaS-06
 *
 * App-shell dropdown that lets a user with multiple active memberships
 * switch their organization context. Hides itself when the caller has
 * ≤ 1 membership (the overwhelmingly common case today).
 *
 * On click → mutation → fresh JWT → full TanStack Query cache flush +
 * router refresh. The currently-active org is marked disabled.
 */

import { toast } from "sonner"
import { useIsMutating, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useMemberships, type Membership } from "@/hooks/use-memberships"
import { useSwitchOrganization } from "@/hooks/use-switch-organization"
import { useAuth } from "@/components/providers/auth-provider"

/* ─── Helpers ─── */

function displayName(
  m: Pick<Membership, "organization">,
  locale: "ar" | "en",
): string {
  if (locale === "en") {
    return m.organization.nameEn ?? m.organization.nameAr
  }
  return m.organization.nameAr
}

/* ─── Component ─── */

export function TenantSwitcher() {
  const { locale, t } = useLocale()
  const { isAuthenticated, user } = useAuth()
  const { data: memberships, isLoading } = useMemberships()
  const switchOrg = useSwitchOrganization()
  const queryClient = useQueryClient()
  // In-flight mutation safety: while any TanStack mutation is pending, lock
  // the switcher. Switching mid-flight risks the prior request resolving with
  // the new tenant's JWT, leaking writes across orgs. The button stays visible
  // but disabled, with a localized hint that work is in progress.
  const pendingMutations = useIsMutating()
  const hasPendingWrites = pendingMutations > 0

  // Hide entirely when unauthenticated, loading, or user has ≤1 org.
  if (!isAuthenticated) return null
  if (isLoading) return null
  if (!memberships || memberships.length <= 1) return null

  // Match the active org against AuthUser.organizationId (resolved from the
  // JWT's active membership in get-current-user.handler). Fall back to the
  // first entry only for legacy sessions where organizationId is null.
  const active =
    memberships.find((m) => m.organizationId === user?.organizationId) ??
    memberships[0]

  const handleSelect = (target: Membership) => {
    if (target.organizationId === active?.organizationId) return
    if (hasPendingWrites) {
      toast.error(t("tenantSwitcher.pendingWrites"))
      return
    }
    // Cancel any in-flight queries before clearing the cache so their
    // resolutions cannot land in the new tenant's keyspace. The mutation
    // itself triggers a queryClient.clear() + router.refresh() on success.
    queryClient.cancelQueries()
    switchOrg.mutate(target.organizationId, {
      onError: () => toast.error(t("tenantSwitcher.switchFailed")),
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-[12rem] truncate"
          disabled={switchOrg.isPending || hasPendingWrites}
          title={hasPendingWrites ? t("tenantSwitcher.pendingWrites") : undefined}
        >
          {switchOrg.isPending
            ? t("tenantSwitcher.switching")
            : active
              ? displayName(active, locale)
              : t("tenantSwitcher.selectOrg")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel>{t("tenantSwitcher.switchOrg")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.organizationId}
            onClick={() => handleSelect(m)}
            disabled={m.organizationId === active?.organizationId}
          >
            {displayName(m, locale)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

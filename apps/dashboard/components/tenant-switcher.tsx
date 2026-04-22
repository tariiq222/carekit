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
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@carekit/ui"
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
  const { isAuthenticated } = useAuth()
  const { data: memberships, isLoading } = useMemberships()
  const switchOrg = useSwitchOrganization()

  // Hide entirely when unauthenticated, loading, or user has ≤1 org.
  if (!isAuthenticated) return null
  if (isLoading) return null
  if (!memberships || memberships.length <= 1) return null

  // The first membership matches the org the current JWT targets,
  // because the backend orders by role/createdAt (same ordering as login).
  // We don't have the current org on the AuthUser yet (Plan 07), so we
  // treat the first entry as the active one for now.
  const active = memberships[0]

  const handleSelect = (target: Membership) => {
    if (target.organizationId === active?.organizationId) return
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
          disabled={switchOrg.isPending}
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

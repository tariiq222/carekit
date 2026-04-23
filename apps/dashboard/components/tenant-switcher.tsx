"use client"

/**
 * TenantSwitcher — SaaS-06
 *
 * Shows the active organization name in the app-shell header.
 * - Single org: renders a static badge (read-only).
 * - Multi-org: renders a dropdown to switch between organizations.
 * Hides when unauthenticated or while loading.
 *
 * On switch → mutation → fresh JWT → full TanStack Query cache flush +
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

  if (!isAuthenticated || isLoading || !memberships?.length) return null

  // The first membership matches the org the current JWT targets,
  // because the backend orders by role/createdAt (same ordering as login).
  const active = memberships[0]

  // Single-org: show org name as a static read-only badge.
  if (memberships.length === 1) {
    return (
      <span className="hidden sm:inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-primary/8 text-primary max-w-[12rem] truncate">
        {displayName(active, locale)}
      </span>
    )
  }

  // Multi-org: full dropdown switcher.
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

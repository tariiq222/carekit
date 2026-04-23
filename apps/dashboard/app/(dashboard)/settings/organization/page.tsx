"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"
import { OrganizationProfileForm } from "@/components/features/settings/organization-profile-form"
import { useOrganizationProfile, useUpdateOrganizationProfile } from "@/hooks/use-organization-profile"

export default function OrganizationProfilePage() {
  const { t } = useLocale()
  const { data: profile, isLoading } = useOrganizationProfile()
  const updateProfile = useUpdateOrganizationProfile()

  return (
    <ListPageShell>
      <Breadcrumbs
        items={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("nav.settings"), href: "/settings" },
          { label: t("settings.organization.title") },
        ]}
      />
      <PageHeader
        title={t("settings.organization.title")}
        description={t("settings.organization.description")}
      />
      <OrganizationProfileForm
        profile={profile ?? null}
        isLoading={isLoading}
        onSave={(data) => updateProfile.mutate(data)}
        isPending={updateProfile.isPending}
      />
    </ListPageShell>
  )
}
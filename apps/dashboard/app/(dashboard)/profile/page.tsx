"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deqah/ui"

import { PageHeader } from "@/components/features/page-header"
import { useLocale } from "@/components/locale-provider"
import { AccountTab } from "@/components/features/profile/account-tab"
import { MembershipTab } from "@/components/features/profile/membership-tab"

/**
 * Profile page — split into:
 *   - "حسابي" (Account): global User fields + password
 *   - "ملفي في {org}" (Membership): per-org displayName/jobTitle/avatar
 */
export default function ProfilePage() {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("profile.title")} description={t("profile.description")} />
      <Tabs defaultValue="account" className="w-full">
        <TabsList>
          <TabsTrigger value="account">{t("profile.tab.account")}</TabsTrigger>
          <TabsTrigger value="membership">{t("profile.tab.membership")}</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="mt-6">
          <AccountTab />
        </TabsContent>
        <TabsContent value="membership" className="mt-6">
          <MembershipTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

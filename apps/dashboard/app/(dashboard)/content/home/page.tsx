"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { HeroForm } from "@/components/features/content/hero-form"
import { useSiteSettings } from "@/hooks/use-site-settings"

export default function ContentHomePage() {
  const { data, isLoading } = useSiteSettings("home.")

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title="الصفحة الرئيسية"
        description="نصوص Hero وبطاقاته العائمة — تنعكس على الموقع خلال 60 ثانية"
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <HeroForm rows={data ?? []} />
      )}
    </ListPageShell>
  )
}

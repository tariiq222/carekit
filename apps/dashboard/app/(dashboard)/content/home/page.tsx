"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HeroForm } from "@/components/features/content/hero-form"
import { SectionIntrosForm } from "@/components/features/content/section-intros-form"
import { useSiteSettings } from "@/hooks/use-site-settings"

export default function ContentHomePage() {
  const { data, isLoading } = useSiteSettings("home.")
  const rows = data ?? []

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title="الصفحة الرئيسية"
        description="محرّر محتوى الصفحة الرئيسية — التعديلات تنعكس على الموقع خلال 60 ثانية"
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="hero">
          <TabsList>
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="intros">عناوين الأقسام</TabsTrigger>
          </TabsList>
          <TabsContent value="hero" className="pt-6">
            <HeroForm rows={rows} />
          </TabsContent>
          <TabsContent value="intros" className="pt-6">
            <SectionIntrosForm rows={rows} />
          </TabsContent>
        </Tabs>
      )}
    </ListPageShell>
  )
}

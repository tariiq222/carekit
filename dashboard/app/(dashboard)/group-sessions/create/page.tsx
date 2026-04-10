"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { SessionTabs } from "@/components/features/group-sessions/session-tabs"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { useLocale } from "@/components/locale-provider"
import { createGroupSessionSchema, type CreateGroupSessionFormValues } from "@/lib/schemas/group-sessions.schema"

export default function CreateGroupSessionPage() {
  const router = useRouter()
  const { t } = useLocale()
  const { createSessionMut } = useGroupSessionsMutations()

  const form = useForm<CreateGroupSessionFormValues>({
    resolver: zodResolver(createGroupSessionSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      practitionerId: "",
      minParticipants: 2,
      maxParticipants: 10,
      pricePerPersonHalalat: 0,
      durationMinutes: 60,
      paymentDeadlineHours: 48,
      schedulingMode: "fixed_date",
      isPublished: false,
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createSessionMut.mutateAsync(data)
      toast.success(t("groupSessions.sessionCreated"))
      router.push("/services?tab=group-sessions")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"))
    }
  })

  return (
    <ListPageShell>
      <Breadcrumbs items={[
        { label: t("groupSessions.title"), href: "/services?tab=group-sessions" },
        { label: t("groupSessions.addSession") },
      ]} />

      <PageHeader
        title={t("groupSessions.addSession")}
        description={t("groupSessions.description")}
      />

      <SessionTabs
        form={form}
        onSubmit={onSubmit}
        onCancel={() => router.push("/services?tab=group-sessions")}
        isPending={createSessionMut.isPending}
      />
    </ListPageShell>
  )
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { useUserMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import { fetchUser } from "@/lib/api/users"
import { queryKeys } from "@/lib/query-keys"
import { UserFormFields } from "./user-form-fields"
import {
  userCreateSchema,
  userEditSchema,
  type UserCreateFormData,
} from "@/lib/schemas/user.schema"

/* ─── Types ─── */

type Props =
  | { mode: "create" }
  | { mode: "edit"; userId: string }

type FormData = UserCreateFormData

/* ─── User Form Page ─── */

export function UserFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const userId = isEdit ? props.userId : undefined

  const router = useRouter()
  const { t } = useLocale()
  const { createMut, updateMut } = useUserMutations()
  const isPending = isEdit ? updateMut.isPending : createMut.isPending

  const { data: user, isLoading } = useQuery({
    queryKey: queryKeys.users.detail(userId ?? ""),
    queryFn: () => fetchUser(userId!),
    enabled: isEdit,
  })

  const form = useForm<FormData>({
    resolver: zodResolver(isEdit ? userEditSchema : userCreateSchema) as never,
    defaultValues: { email: "", password: "", name: "", phone: "", role: "RECEPTIONIST" },
  })

  useEffect(() => {
    if (!user) return
    form.reset({
      email: user.email,
      name: user.name,
      phone: user.phone ?? "",
      gender: user.gender ?? undefined,
      role: user.role,
    })
  }, [user, form])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (isEdit) {
        const { password: _pw, ...editData } = data as FormData
        await updateMut.mutateAsync({ id: userId!, ...editData, phone: editData.phone || undefined })
        toast.success(t("users.edit.success"))
      } else {
        await createMut.mutateAsync({ ...(data as UserCreateFormData), phone: data.phone || undefined })
        toast.success(t("users.create.success"))
      }
      router.push("/users")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(isEdit ? "users.edit.error" : "users.create.error"))
    }
  })

  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      </ListPageShell>
    )
  }

  const title = isEdit ? t("users.edit.title") : t("users.create.title")
  const description = isEdit ? (user?.name ?? "") : t("users.create.description")
  const submitLabel = isPending
    ? t(isEdit ? "users.edit.submitting" : "users.create.submitting")
    : t(isEdit ? "users.edit.submit" : "users.create.submit")

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={title} description={description} />
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <UserFormFields form={form} isEdit={isEdit} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/users")}>
            {t(isEdit ? "users.edit.cancel" : "users.create.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>{submitLabel}</Button>
        </div>
      </form>
    </ListPageShell>
  )
}

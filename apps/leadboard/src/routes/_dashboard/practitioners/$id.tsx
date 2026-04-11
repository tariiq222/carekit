import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UpdatePractitionerPayload } from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  usePractitioner,
  useUpdatePractitioner,
  useDeletePractitioner,
} from '@/hooks/use-practitioners'
import {
  updatePractitionerSchema,
  type UpdatePractitionerFormValues,
} from '@/lib/schemas/practitioner.schema'

export const Route = createFileRoute('/_dashboard/practitioners/$id')({
  component: PractitionerDetailPage,
})

function PractitionerDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: practitioner, isLoading } = usePractitioner(id)
  const updatePractitioner = useUpdatePractitioner(id)
  const deletePractitioner = useDeletePractitioner()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePractitionerFormValues>({
    resolver: zodResolver(updatePractitionerSchema),
    values: {
      experience: practitioner?.experience,
      bio: practitioner?.bio ?? '',
      bioAr: practitioner?.bioAr ?? '',
      isActive: practitioner?.isActive,
    },
  })

  if (isLoading) return <SkeletonPage />

  if (!practitioner) {
    return (
      <p className="text-[var(--muted)] p-6">الممارس غير موجود</p>
    )
  }

  const fullName = `${practitioner.user.firstName} ${practitioner.user.lastName}`

  const onSubmit = handleSubmit(async (values) => {
    const payload: UpdatePractitionerPayload = {
      ...(values.experience !== undefined
        ? { experience: values.experience }
        : {}),
      ...(values.bio && values.bio.trim() !== '' ? { bio: values.bio } : {}),
      ...(values.bioAr && values.bioAr.trim() !== ''
        ? { bioAr: values.bioAr }
        : {}),
    }
    await updatePractitioner.mutateAsync(payload)
  })

  const onDelete = () => {
    if (confirm(`هل أنت متأكد من حذف ${fullName}؟`)) {
      deletePractitioner.mutate(id, {
        onSuccess: () => navigate({ to: '/practitioners' }),
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        description={`${practitioner.specialty.nameAr} · ★ ${practitioner.rating.toFixed(1)}`}
        actions={
          <Link to="/practitioners">
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <form
        onSubmit={onSubmit}
        className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="experience">سنوات الخبرة</Label>
          <Input
            id="experience"
            type="number"
            min={0}
            max={50}
            {...register('experience', { valueAsNumber: true })}
          />
          {errors.experience && (
            <p className="text-xs text-[var(--error,#dc2626)]">
              {errors.experience.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">نبذة بالإنجليزية</Label>
          <Input id="bio" {...register('bio')} />
          {errors.bio && (
            <p className="text-xs text-[var(--error,#dc2626)]">
              {errors.bio.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bioAr">نبذة بالعربية</Label>
          <Input id="bioAr" {...register('bioAr')} />
          {errors.bioAr && (
            <p className="text-xs text-[var(--error,#dc2626)]">
              {errors.bioAr.message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            حفظ التغييرات
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            disabled={deletePractitioner.isPending}
            className="text-[var(--error,#dc2626)] border-[color:var(--error,#dc2626)]/30 hover:bg-[color:var(--error,#dc2626)]/10"
          >
            حذف الممارس
          </Button>
        </div>
      </form>
    </div>
  )
}

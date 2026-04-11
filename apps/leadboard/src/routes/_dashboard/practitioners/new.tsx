import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreatePractitionerPayload } from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreatePractitioner } from '@/hooks/use-practitioners'
import {
  createPractitionerSchema,
  type CreatePractitionerFormValues,
} from '@/lib/schemas/practitioner.schema'

export const Route = createFileRoute('/_dashboard/practitioners/new')({
  component: NewPractitionerPage,
})

function NewPractitionerPage() {
  const navigate = useNavigate()
  const createPractitioner = useCreatePractitioner()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePractitionerFormValues>({
    resolver: zodResolver(createPractitionerSchema),
    defaultValues: { experience: 0 },
  })

  const onSubmit = handleSubmit(async (values) => {
    const payload: CreatePractitionerPayload = {
      userId: values.userId,
      specialtyId: values.specialtyId,
      experience: values.experience,
      ...(values.bio && values.bio.trim() !== '' ? { bio: values.bio } : {}),
      ...(values.bioAr && values.bioAr.trim() !== ''
        ? { bioAr: values.bioAr }
        : {}),
    }
    await createPractitioner.mutateAsync(payload)
    navigate({ to: '/practitioners' })
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="ممارس جديد"
        description="إضافة ممارس صحي للعيادة"
      />

      <form
        onSubmit={onSubmit}
        className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="userId">معرف المستخدم *</Label>
          <Input
            id="userId"
            placeholder="معرف المستخدم"
            {...register('userId')}
          />
          {errors.userId && (
            <p className="text-xs text-[var(--error,#dc2626)]">
              {errors.userId.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="specialtyId">معرف التخصص *</Label>
          <Input
            id="specialtyId"
            placeholder="معرف التخصص"
            {...register('specialtyId')}
          />
          {errors.specialtyId && (
            <p className="text-xs text-[var(--error,#dc2626)]">
              {errors.specialtyId.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="experience">سنوات الخبرة *</Label>
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
            إضافة الممارس
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/practitioners' })}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

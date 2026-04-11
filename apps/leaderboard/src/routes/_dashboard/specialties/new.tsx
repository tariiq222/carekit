import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateSpecialtyPayload } from '@carekit/api-client'
import { useCreateSpecialty } from '@/hooks/use-specialties'
import {
  createSpecialtySchema,
  type CreateSpecialtyFormValues,
} from '@/lib/schemas/specialty.schema'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/specialties/new')({
  component: NewSpecialtyPage,
})

function NewSpecialtyPage() {
  const navigate = useNavigate()
  const mutation = useCreateSpecialty()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSpecialtyFormValues>({
    resolver: zodResolver(createSpecialtySchema),
    defaultValues: {
      nameAr: '',
      nameEn: '',
      descriptionAr: '',
      descriptionEn: '',
      iconUrl: '',
    },
  })

  const onSubmit = (values: CreateSpecialtyFormValues) => {
    const payload: CreateSpecialtyPayload = {
      nameAr: values.nameAr,
      nameEn: values.nameEn,
      descriptionAr: values.descriptionAr?.trim() || undefined,
      descriptionEn: values.descriptionEn?.trim() || undefined,
      iconUrl: values.iconUrl?.trim() || undefined,
      sortOrder: values.sortOrder,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/specialties' }),
    })
  }

  const errorClass = 'text-xs text-[var(--error,#dc2626)] mt-1'

  return (
    <div className="space-y-6">
      <PageHeader
        title="تخصص جديد"
        description="إضافة تخصص ممارس جديد"
        actions={
          <Link to="/specialties">
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nameAr">الاسم (عربي) *</Label>
            <Input id="nameAr" {...register('nameAr')} />
            {errors.nameAr && <p className={errorClass}>{errors.nameAr.message}</p>}
          </div>
          <div>
            <Label htmlFor="nameEn">الاسم (إنجليزي) *</Label>
            <Input id="nameEn" {...register('nameEn')} />
            {errors.nameEn && <p className={errorClass}>{errors.nameEn.message}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="descriptionAr">الوصف (عربي)</Label>
          <Input id="descriptionAr" {...register('descriptionAr')} />
        </div>

        <div>
          <Label htmlFor="descriptionEn">الوصف (إنجليزي)</Label>
          <Input id="descriptionEn" {...register('descriptionEn')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="iconUrl">رابط الأيقونة</Label>
            <Input id="iconUrl" placeholder="https://..." {...register('iconUrl')} />
            {errors.iconUrl && (
              <p className={errorClass}>{errors.iconUrl.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="sortOrder">الترتيب</Label>
            <Input id="sortOrder" type="number" min="0" {...register('sortOrder')} />
          </div>
        </div>

        {mutation.isError && (
          <p className={errorClass}>
            {(mutation.error as Error)?.message ?? 'حدث خطأ غير متوقع'}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جاري الحفظ...' : 'إنشاء التخصص'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/specialties' })}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

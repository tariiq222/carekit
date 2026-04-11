import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UpdateDepartmentPayload } from '@carekit/api-client'
import { useDepartment, useUpdateDepartment } from '@/hooks/use-departments'
import {
  updateDepartmentSchema,
  type UpdateDepartmentFormValues,
} from '@/lib/schemas/department.schema'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/departments/$id')({
  component: DepartmentDetailPage,
})

function DepartmentDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: department, isLoading } = useDepartment(id)
  const mutation = useUpdateDepartment(id)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateDepartmentFormValues>({
    resolver: zodResolver(updateDepartmentSchema),
    values: {
      nameAr: department?.nameAr,
      nameEn: department?.nameEn,
      descriptionAr: department?.descriptionAr ?? '',
      descriptionEn: department?.descriptionEn ?? '',
      icon: department?.icon ?? '',
      sortOrder: department?.sortOrder,
      isActive: department?.isActive,
    },
  })

  if (isLoading) return <SkeletonPage />
  if (!department)
    return <p className="text-[var(--muted)] p-6">القسم غير موجود</p>

  const onSubmit = (values: UpdateDepartmentFormValues) => {
    const payload: UpdateDepartmentPayload = {
      nameAr: values.nameAr,
      nameEn: values.nameEn,
      descriptionAr: values.descriptionAr?.trim() || undefined,
      descriptionEn: values.descriptionEn?.trim() || undefined,
      icon: values.icon?.trim() || undefined,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/departments' }),
    })
  }

  const errorClass = 'text-xs text-[var(--error,#dc2626)] mt-1'

  return (
    <div className="space-y-6">
      <PageHeader
        title={department.nameAr}
        description={department.nameEn}
        actions={
          <Link to="/departments">
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
            <Label htmlFor="nameAr">الاسم (عربي)</Label>
            <Input id="nameAr" {...register('nameAr')} />
            {errors.nameAr && <p className={errorClass}>{errors.nameAr.message}</p>}
          </div>
          <div>
            <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
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
            <Label htmlFor="icon">الأيقونة</Label>
            <Input id="icon" {...register('icon')} />
          </div>
          <div>
            <Label htmlFor="sortOrder">الترتيب</Label>
            <Input id="sortOrder" type="number" min="0" {...register('sortOrder')} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
          <input type="checkbox" {...register('isActive')} />
          نشط
        </label>

        {mutation.isError && (
          <p className={errorClass}>
            {(mutation.error as Error)?.message ?? 'حدث خطأ غير متوقع'}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/departments' })}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

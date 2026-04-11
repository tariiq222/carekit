import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UpdateServicePayload } from '@carekit/api-client'
import { useService, useUpdateService } from '@/hooks/use-services'
import {
  updateServiceSchema,
  type UpdateServiceFormValues,
} from '@/lib/schemas/service.schema'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/services/$id')({
  component: ServiceDetailPage,
})

function ServiceDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: service, isLoading } = useService(id)
  const mutation = useUpdateService(id)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateServiceFormValues>({
    resolver: zodResolver(updateServiceSchema),
    values: {
      nameAr: service?.nameAr,
      nameEn: service?.nameEn,
      descriptionAr: service?.descriptionAr ?? '',
      descriptionEn: service?.descriptionEn ?? '',
      categoryId: service?.categoryId,
      price: service?.price,
      duration: service?.duration,
      isActive: service?.isActive,
    },
  })

  if (isLoading) return <SkeletonPage />
  if (!service) return <p className="text-[var(--muted)] p-6">الخدمة غير موجودة</p>

  const onSubmit = (values: UpdateServiceFormValues) => {
    const payload: UpdateServicePayload = {
      nameAr: values.nameAr,
      nameEn: values.nameEn,
      descriptionAr: values.descriptionAr?.trim() || undefined,
      descriptionEn: values.descriptionEn?.trim() || undefined,
      categoryId: values.categoryId,
      price: values.price,
      duration: values.duration,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/services' }),
    })
  }

  const errorClass = 'text-xs text-[var(--error,#dc2626)] mt-1'

  return (
    <div className="space-y-6">
      <PageHeader
        title={service.nameAr}
        description={service.nameEn}
        actions={
          <Link to="/services">
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
          <Label htmlFor="categoryId">معرف التصنيف</Label>
          <Input id="categoryId" {...register('categoryId')} />
          {errors.categoryId && (
            <p className={errorClass}>{errors.categoryId.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price">السعر (هللات)</Label>
            <Input id="price" type="number" min="0" {...register('price')} />
          </div>
          <div>
            <Label htmlFor="duration">المدة (دقيقة)</Label>
            <Input id="duration" type="number" min="1" {...register('duration')} />
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
            onClick={() => navigate({ to: '/services' })}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

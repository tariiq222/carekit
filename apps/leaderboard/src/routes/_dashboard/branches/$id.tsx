import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UpdateBranchPayload } from '@carekit/api-client'
import { useBranch, useUpdateBranch } from '@/hooks/use-branches'
import {
  updateBranchSchema,
  type UpdateBranchFormValues,
} from '@/lib/schemas/branch.schema'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/branches/$id')({
  component: BranchDetailPage,
})

function BranchDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: branch, isLoading } = useBranch(id)
  const mutation = useUpdateBranch(id)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateBranchFormValues>({
    resolver: zodResolver(updateBranchSchema),
    values: {
      nameAr: branch?.nameAr,
      nameEn: branch?.nameEn,
      address: branch?.address ?? '',
      phone: branch?.phone ?? '',
      email: branch?.email ?? '',
      timezone: branch?.timezone ?? '',
      isMain: branch?.isMain,
      isActive: branch?.isActive,
    },
  })

  if (isLoading) return <SkeletonPage />
  if (!branch) return <p className="text-[var(--muted)] p-6">الفرع غير موجود</p>

  const onSubmit = (values: UpdateBranchFormValues) => {
    const payload: UpdateBranchPayload = {
      nameAr: values.nameAr,
      nameEn: values.nameEn,
      address: values.address?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() || undefined,
      timezone: values.timezone?.trim() || undefined,
      isMain: values.isMain,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/branches' }),
    })
  }

  const errorClass = 'text-xs text-[var(--error,#dc2626)] mt-1'

  return (
    <div className="space-y-6">
      <PageHeader
        title={branch.nameAr}
        description={branch.nameEn}
        actions={
          <Link to="/branches">
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
          <Label htmlFor="address">العنوان</Label>
          <Input id="address" {...register('address')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">الهاتف</Label>
            <Input id="phone" {...register('phone')} />
            {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
          </div>
          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className={errorClass}>{errors.email.message}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="timezone">المنطقة الزمنية</Label>
          <Input id="timezone" {...register('timezone')} />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
            <input type="checkbox" {...register('isMain')} />
            فرع رئيسي
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
            <input type="checkbox" {...register('isActive')} />
            نشط
          </label>
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
            onClick={() => navigate({ to: '/branches' })}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateBranchPayload } from '@carekit/api-client'
import { useCreateBranch } from '@/hooks/use-branches'
import {
  createBranchSchema,
  type CreateBranchFormValues,
} from '@/lib/schemas/branch.schema'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/branches/new')({
  component: NewBranchPage,
})

function NewBranchPage() {
  const navigate = useNavigate()
  const mutation = useCreateBranch()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBranchFormValues>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: {
      nameAr: '',
      nameEn: '',
      address: '',
      phone: '',
      email: '',
      timezone: '',
      isMain: false,
      isActive: true,
    },
  })

  const onSubmit = (values: CreateBranchFormValues) => {
    const payload: CreateBranchPayload = {
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
        title="فرع جديد"
        description="إضافة فرع جديد للعيادة"
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
          <Label htmlFor="address">العنوان</Label>
          <Input id="address" {...register('address')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">الهاتف</Label>
            <Input id="phone" placeholder="+966..." {...register('phone')} />
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
          <Input id="timezone" placeholder="Asia/Riyadh" {...register('timezone')} />
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
            {mutation.isPending ? 'جاري الحفظ...' : 'إنشاء الفرع'}
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

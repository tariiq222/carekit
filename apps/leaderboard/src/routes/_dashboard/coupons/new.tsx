import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateCouponPayload } from '@carekit/api-client/types/coupon'
import { useCreateCoupon } from '@/hooks/use-coupons'
import {
  couponFormSchema,
  type CouponFormValues,
} from '@/lib/schemas/coupon.schema'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/coupons/new')({
  component: NewCouponPage,
})

function NewCouponPage() {
  const navigate = useNavigate()
  const mutation = useCreateCoupon()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      code: '',
      discountType: 'percentage',
      discountValue: 10,
      isActive: true,
    },
  })

  const onSubmit = (values: CouponFormValues) => {
    const payload: CreateCouponPayload = {
      code: values.code.toUpperCase(),
      descriptionAr: values.descriptionAr || undefined,
      descriptionEn: values.descriptionEn || undefined,
      discountType: values.discountType,
      discountValue: values.discountValue,
      minAmount: values.minAmount,
      maxUses: Number.isFinite(values.maxUses) ? values.maxUses : undefined,
      maxUsesPerUser: Number.isFinite(values.maxUsesPerUser)
        ? values.maxUsesPerUser
        : undefined,
      expiresAt: values.expiresAt || undefined,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/coupons' }),
    })
  }

  const errorClass = 'text-xs text-[var(--error,#dc2626)] mt-1'

  return (
    <div className="space-y-6">
      <PageHeader
        title="كوبون جديد"
        description="إنشاء كوبون خصم جديد"
        actions={
          <Link to="/coupons">
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-4"
      >
        <div>
          <Label htmlFor="code">الكود *</Label>
          <Input id="code" placeholder="SUMMER25" {...register('code')} />
          {errors.code && <p className={errorClass}>{errors.code.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="discountType">النوع *</Label>
            <select
              id="discountType"
              {...register('discountType')}
              className="w-full h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
            >
              <option value="percentage">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت (هللات)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="discountValue">القيمة *</Label>
            <Input
              id="discountValue"
              type="number"
              {...register('discountValue')}
            />
            {errors.discountValue && (
              <p className={errorClass}>{errors.discountValue.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minAmount">أدنى مبلغ (هللات)</Label>
            <Input id="minAmount" type="number" {...register('minAmount')} />
          </div>
          <div>
            <Label htmlFor="expiresAt">ينتهي في</Label>
            <Input id="expiresAt" type="date" {...register('expiresAt')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="maxUses">الحد الأقصى للاستخدام</Label>
            <Input id="maxUses" type="number" {...register('maxUses')} />
          </div>
          <div>
            <Label htmlFor="maxUsesPerUser">حد كل مستخدم</Label>
            <Input
              id="maxUsesPerUser"
              type="number"
              {...register('maxUsesPerUser')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="descriptionAr">وصف بالعربية</Label>
          <Input id="descriptionAr" {...register('descriptionAr')} />
        </div>
        <div>
          <Label htmlFor="descriptionEn">وصف بالإنجليزية</Label>
          <Input id="descriptionEn" {...register('descriptionEn')} />
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('isActive')} />
          <span className="text-sm text-[var(--fg)]">فعال</span>
        </label>

        {mutation.isError && (
          <p className={errorClass}>
            {(mutation.error as Error)?.message ?? 'حدث خطأ غير متوقع'}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جاري الحفظ...' : 'إنشاء الكوبون'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/coupons' })}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateCouponPayload } from '@carekit/api-client'
import { useCreateCoupon } from '@/hooks/use-coupons'
import {
  couponFormSchema,
  type CouponFormValues,
} from '@/lib/schemas/coupon.schema'
import { FormShell, FormField, FormSection, FormToggle } from '@/components/shared/form-shell'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_dashboard/coupons/new')({
  component: NewCouponPage,
})

function NewCouponPage() {
  const navigate = useNavigate()
  const mutation = useCreateCoupon()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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

  const discountType = watch('discountType')
  const isActive = watch('isActive')

  const onSubmit = handleSubmit((values) => {
    const payload: CreateCouponPayload = {
      code: values.code.toUpperCase(),
      descriptionAr: values.descriptionAr || undefined,
      descriptionEn: values.descriptionEn || undefined,
      discountType: values.discountType,
      discountValue: values.discountValue,
      minAmount: values.minAmount,
      maxUses: Number.isFinite(values.maxUses) ? values.maxUses : undefined,
      maxUsesPerUser: Number.isFinite(values.maxUsesPerUser) ? values.maxUsesPerUser : undefined,
      expiresAt: values.expiresAt || undefined,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/coupons' }),
    })
  })

  return (
    <FormShell
      title="كوبون جديد"
      description="إنشاء كوبون خصم للمرضى"
      backTo="/coupons"
      submitLabel="إنشاء الكوبون"
      isPending={mutation.isPending}
      error={(mutation.error as Error)?.message}
      onSubmit={onSubmit}
    >
      {/* Code */}
      <FormSection label="الكود">
        <FormField label="كود الكوبون" required error={errors.code?.message} hint="حروف إنجليزية وأرقام وشرطات فقط">
          <Input
            placeholder="SUMMER25"
            dir="ltr"
            className="uppercase"
            {...register('code')}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase()
              register('code').onChange(e)
            }}
          />
        </FormField>
      </FormSection>

      {/* Discount */}
      <FormSection label="قيمة الخصم">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="نوع الخصم" required error={errors.discountType?.message}>
            <Select
              value={discountType}
              onValueChange={(v) => setValue('discountType', v as CouponFormValues['discountType'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                <SelectItem value="fixed">مبلغ ثابت (هللات)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label={discountType === 'percentage' ? 'نسبة الخصم (%)' : 'مبلغ الخصم (هللات)'}
            required
            error={errors.discountValue?.message}
          >
            <Input
              type="number"
              min="1"
              placeholder={discountType === 'percentage' ? '10' : '5000'}
              {...register('discountValue')}
            />
          </FormField>
        </div>

        <FormField
          label="الحد الأدنى للطلب"
          hint="اختياري — بالهللات"
          error={errors.minAmount?.message}
        >
          <Input
            type="number"
            min="0"
            placeholder="0"
            className="max-w-[200px]"
            {...register('minAmount')}
          />
        </FormField>
      </FormSection>

      {/* Limits */}
      <FormSection label="حدود الاستخدام" description="اختياري — اتركها فارغة للاستخدام غير المحدود">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الحد الأقصى الكلي" error={errors.maxUses?.message}>
            <Input type="number" min="1" placeholder="∞" {...register('maxUses')} />
          </FormField>
          <FormField label="الحد لكل مستخدم" error={errors.maxUsesPerUser?.message}>
            <Input type="number" min="1" placeholder="∞" {...register('maxUsesPerUser')} />
          </FormField>
        </div>

        <FormField label="تاريخ انتهاء الصلاحية">
          <Input type="date" className="max-w-[200px]" {...register('expiresAt')} />
        </FormField>
      </FormSection>

      {/* Description */}
      <FormSection label="الوصف" description="اختياري — يظهر للمريض عند تطبيق الكوبون">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الوصف بالعربية">
            <Input placeholder="خصم موسم الصيف..." dir="rtl" {...register('descriptionAr')} />
          </FormField>
          <FormField label="الوصف بالإنجليزية">
            <Input placeholder="Summer discount..." dir="ltr" {...register('descriptionEn')} />
          </FormField>
        </div>
      </FormSection>

      {/* Status */}
      <FormToggle label="فعال" description="يمكن للمرضى استخدامه فور الإنشاء">
        <Switch
          checked={isActive ?? true}
          onCheckedChange={(v) => setValue('isActive', v)}
        />
      </FormToggle>
    </FormShell>
  )
}

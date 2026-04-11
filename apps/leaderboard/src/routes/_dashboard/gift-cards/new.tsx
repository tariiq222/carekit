import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateGiftCardPayload } from '@carekit/api-client'
import { useCreateGiftCard } from '@/hooks/use-gift-cards'
import {
  giftCardFormSchema,
  type GiftCardFormValues,
} from '@/lib/schemas/gift-card.schema'
import { FormShell, FormField, FormSection, FormToggle } from '@/components/shared/form-shell'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export const Route = createFileRoute('/_dashboard/gift-cards/new')({
  component: NewGiftCardPage,
})

function NewGiftCardPage() {
  const navigate = useNavigate()
  const mutation = useCreateGiftCard()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GiftCardFormValues>({
    resolver: zodResolver(giftCardFormSchema),
    defaultValues: { code: '', initialAmount: 50000, isActive: true },
  })

  const isActive = watch('isActive')

  const onSubmit = handleSubmit((values) => {
    const payload: CreateGiftCardPayload = {
      code: values.code?.trim().toUpperCase() || undefined,
      initialAmount: values.initialAmount,
      expiresAt: values.expiresAt || undefined,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/gift-cards' }),
    })
  })

  return (
    <FormShell
      title="بطاقة إهداء جديدة"
      description="إنشاء بطاقة إهداء قابلة للاستخدام في الحجوزات"
      backTo="/gift-cards"
      submitLabel="إنشاء البطاقة"
      isPending={mutation.isPending}
      error={(mutation.error as Error)?.message}
      onSubmit={onSubmit}
    >
      {/* Value */}
      <FormSection label="القيمة">
        <FormField
          label="القيمة الأصلية"
          required
          error={errors.initialAmount?.message}
          hint="بالهللات — 50000 = 500 ريال"
        >
          <Input
            type="number"
            min="1"
            placeholder="50000"
            className="max-w-[200px]"
            {...register('initialAmount')}
          />
        </FormField>
      </FormSection>

      {/* Code & Expiry */}
      <FormSection label="الكود والصلاحية" description="اختياري">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="الكود"
            error={errors.code?.message}
            hint="يُولد تلقائيًا إذا تُرك فارغاً"
          >
            <Input placeholder="GC-VIP2026" dir="ltr" {...register('code')} />
          </FormField>
          <FormField label="تاريخ انتهاء الصلاحية">
            <Input type="date" {...register('expiresAt')} />
          </FormField>
        </div>
      </FormSection>

      {/* Status */}
      <FormToggle label="فعالة" description="يمكن استخدامها في الحجوزات فور الإنشاء">
        <Switch
          checked={isActive ?? true}
          onCheckedChange={(v) => setValue('isActive', v)}
        />
      </FormToggle>
    </FormShell>
  )
}

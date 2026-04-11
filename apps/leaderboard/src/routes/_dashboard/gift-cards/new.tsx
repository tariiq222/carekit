import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateGiftCardPayload } from '@carekit/api-client/types/gift-card'
import { useCreateGiftCard } from '@/hooks/use-gift-cards'
import {
  giftCardFormSchema,
  type GiftCardFormValues,
} from '@/lib/schemas/gift-card.schema'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/gift-cards/new')({
  component: NewGiftCardPage,
})

function NewGiftCardPage() {
  const navigate = useNavigate()
  const mutation = useCreateGiftCard()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GiftCardFormValues>({
    resolver: zodResolver(giftCardFormSchema),
    defaultValues: {
      code: '',
      initialAmount: 50000,
      isActive: true,
    },
  })

  const onSubmit = (values: GiftCardFormValues) => {
    const payload: CreateGiftCardPayload = {
      code: values.code ? values.code.toUpperCase() : undefined,
      initialAmount: values.initialAmount,
      expiresAt: values.expiresAt || undefined,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/gift-cards' }),
    })
  }

  const errorClass = 'text-xs text-[var(--error,#dc2626)] mt-1'

  return (
    <div className="space-y-6">
      <PageHeader
        title="بطاقة إهداء جديدة"
        description="إنشاء بطاقة إهداء جديدة"
        actions={
          <Link to="/gift-cards">
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-4"
      >
        <div>
          <Label htmlFor="code">الكود (اختياري — يُولد تلقائيًا)</Label>
          <Input id="code" placeholder="GC-VIP2026" {...register('code')} />
          {errors.code && <p className={errorClass}>{errors.code.message}</p>}
        </div>

        <div>
          <Label htmlFor="initialAmount">القيمة الأصلية (هللات) *</Label>
          <Input
            id="initialAmount"
            type="number"
            {...register('initialAmount')}
          />
          {errors.initialAmount && (
            <p className={errorClass}>{errors.initialAmount.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="expiresAt">ينتهي في</Label>
          <Input id="expiresAt" type="date" {...register('expiresAt')} />
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('isActive')} />
          <span className="text-sm text-[var(--fg)]">فعالة</span>
        </label>

        {mutation.isError && (
          <p className={errorClass}>
            {(mutation.error as Error)?.message ?? 'حدث خطأ غير متوقع'}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جاري الحفظ...' : 'إنشاء البطاقة'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/gift-cards' })}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UpdateGiftCardPayload } from '@carekit/api-client/types/gift-card'
import { useGiftCard, useUpdateGiftCard } from '@/hooks/use-gift-cards'
import {
  giftCardFormSchema,
  type GiftCardFormValues,
} from '@/lib/schemas/gift-card.schema'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/gift-cards/$id')({
  component: GiftCardDetailPage,
})

function formatHalalat(halalat: number): string {
  const sar = halalat / 100
  return `${sar.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`
}

function GiftCardDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: card, isLoading } = useGiftCard(id)
  const mutation = useUpdateGiftCard(id)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GiftCardFormValues>({
    resolver: zodResolver(giftCardFormSchema),
    values: card
      ? {
          code: card.code,
          initialAmount: card.initialAmount,
          expiresAt: card.expiresAt ? card.expiresAt.slice(0, 10) : '',
          isActive: card.isActive,
        }
      : undefined,
  })

  if (isLoading) return <SkeletonPage />
  if (!card) return <p className="text-[var(--muted)] p-6">البطاقة غير موجودة</p>

  const onSubmit = (values: GiftCardFormValues) => {
    // Backend update only accepts: expiresAt, isActive, purchasedBy, redeemedBy
    const payload: UpdateGiftCardPayload = {
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
        title={`بطاقة ${card.code}`}
        description={`الرصيد: ${formatHalalat(card.balance)} من ${formatHalalat(card.initialAmount)}`}
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
          <Label htmlFor="code">الكود</Label>
          <Input id="code" disabled {...register('code')} />
          <p className="text-xs text-[var(--muted)] mt-1">
            لا يمكن تعديل الكود بعد الإنشاء
          </p>
        </div>

        <div>
          <Label htmlFor="initialAmount">القيمة الأصلية (هللات)</Label>
          <Input
            id="initialAmount"
            type="number"
            disabled
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
            {mutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
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

      {card.transactions && card.transactions.length > 0 && (
        <div className="glass rounded-[var(--radius)] p-6 max-w-2xl">
          <h3 className="text-sm font-semibold text-[var(--fg)] mb-3">
            آخر المعاملات
          </h3>
          <ul className="space-y-2">
            {card.transactions.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between text-sm border-b border-[var(--border-soft)] pb-2 last:border-0"
              >
                <span className="text-[var(--muted)]">
                  {new Date(t.createdAt).toLocaleDateString('ar-SA')}
                </span>
                <span
                  className={
                    t.amount >= 0 ? 'text-[var(--success)]' : 'text-[var(--error,#dc2626)]'
                  }
                >
                  {t.amount >= 0 ? '+' : ''}
                  {formatHalalat(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

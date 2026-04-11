import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { z } from 'zod'
import { ArrowRight, ArrowLeft, Check, UserPlus, X, User, Stethoscope, CalendarDays, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CreateBookingPayload } from '@carekit/api-client'
import { useCreateBooking } from '@/hooks/use-bookings'
import { usePatients, useCreateWalkIn } from '@/hooks/use-patients'
import { usePractitioners } from '@/hooks/use-practitioners'
import { useServices } from '@/hooks/use-services'
import { useBranches } from '@/hooks/use-branches'
import {
  createBookingSchema,
  type CreateBookingFormValues,
} from '@/lib/schemas/booking.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/form-shell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ChevronsUpDown } from 'lucide-react'

export const Route = createFileRoute('/_dashboard/bookings/new')({
  component: NewBookingPage,
})

// ─── Walk-in schema ──────────────────────────────────────────────────────────
const walkInSchema = z.object({
  firstName: z.string().min(1, 'الاسم الأول مطلوب'),
  lastName: z.string().min(1, 'اسم العائلة مطلوب'),
  phone: z.string().regex(/^\+?[0-9]{9,15}$/, 'رقم غير صحيح').optional().or(z.literal('')),
  gender: z.enum(['male', 'female']).optional(),
})
type WalkInValues = z.infer<typeof walkInSchema>

function stripEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined || v === null) continue
    out[k] = v
  }
  return out as T
}

// ─── Combobox ────────────────────────────────────────────────────────────────
interface ComboboxProps {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
  placeholder: string
  searchPlaceholder?: string
  isLoading?: boolean
}

function Combobox({ value, onChange, options, placeholder, searchPlaceholder, isLoading }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-sm h-10 border-border bg-surface hover:bg-surface-muted"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 shadow-md border-border"
        align="end"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? 'بحث...'} className="text-sm h-9 border-b border-border" />
          <CommandList className="max-h-52">
            {isLoading ? (
              <CommandEmpty className="text-sm text-muted-foreground py-6">جارٍ التحميل...</CommandEmpty>
            ) : options.length === 0 ? (
              <CommandEmpty className="text-sm text-muted-foreground py-6">لا توجد نتائج</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.label}
                    onSelect={() => { onChange(opt.id); setOpen(false) }}
                    className={cn(
                      'text-sm cursor-pointer flex items-center gap-2 px-3 py-2',
                      value === opt.id ? 'bg-primary/8 text-primary font-medium' : 'text-foreground',
                    )}
                  >
                    <Check className={cn('h-3.5 w-3.5 shrink-0 text-primary', value === opt.id ? 'opacity-100' : 'opacity-0')} />
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Walk-in inline form ──────────────────────────────────────────────────────
interface WalkInFormProps {
  onCreated: (id: string, label: string) => void
  onCancel: () => void
}

function WalkInForm({ onCreated, onCancel }: WalkInFormProps) {
  const createWalkIn = useCreateWalkIn()
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<WalkInValues>({
    resolver: zodResolver(walkInSchema),
  })
  const gender = watch('gender')

  const onSubmit = handleSubmit((values) => {
    createWalkIn.mutate(stripEmpty(values) as Parameters<typeof createWalkIn.mutate>[0], {
      onSuccess: (p) => onCreated(p.id, `${p.firstName} ${p.lastName}`),
    })
  })

  return (
    <div className="mt-3 p-4 rounded-lg bg-surface border border-primary/20 ring-1 ring-primary/10 space-y-3">
      <p className="text-xs font-semibold text-primary">تسجيل زائر جديد</p>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="الاسم الأول" required error={errors.firstName?.message}>
          <Input placeholder="محمد" {...register('firstName')} />
        </FormField>
        <FormField label="اسم العائلة" required error={errors.lastName?.message}>
          <Input placeholder="العمري" {...register('lastName')} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="الجوال" error={errors.phone?.message}>
          <Input placeholder="+966..." dir="ltr" {...register('phone')} />
        </FormField>
        <FormField label="الجنس">
          <Select value={gender ?? ''} onValueChange={(v) => setValue('gender', v as 'male' | 'female')}>
            <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">ذكر</SelectItem>
              <SelectItem value="female">أنثى</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      {createWalkIn.isError && (
        <p className="text-xs text-error">{(createWalkIn.error as Error).message}</p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onSubmit} disabled={createWalkIn.isPending}>
          {createWalkIn.isPending ? 'جارٍ التسجيل...' : 'تسجيل الزائر'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEPS = [
  { id: 'patient', label: 'المريض', icon: User },
  { id: 'service', label: 'الخدمة', icon: Stethoscope },
  { id: 'datetime', label: 'الموعد', icon: CalendarDays },
  { id: 'confirm', label: 'التأكيد', icon: ClipboardCheck },
]

interface StepBarProps {
  current: number
}

function StepBar({ current }: StepBarProps) {
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < current
        const active = i === current
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300',
                done && 'bg-primary border-primary text-primary-foreground',
                active && 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/15',
                !done && !active && 'bg-surface border-border text-muted-foreground',
              )}>
                {done ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={cn(
                'text-xs font-medium whitespace-nowrap',
                active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-px mx-3 mb-5 transition-colors duration-500', done ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Summary row ──────────────────────────────────────────────────────────────
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function NewBookingPage() {
  const navigate = useNavigate()
  const createMutation = useCreateBooking()
  const [step, setStep] = useState(0)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [walkInLabel, setWalkInLabel] = useState<string | null>(null)

  const { data: patientsData, isLoading: patientsLoading } = usePatients({ perPage: 200 })
  const { data: practitionersData, isLoading: practitionersLoading } = usePractitioners({ perPage: 200 })
  const { data: servicesData, isLoading: servicesLoading } = useServices({ perPage: 200 })
  const { data: branchesData, isLoading: branchesLoading } = useBranches({ perPage: 200 })

  const patientOptions = (patientsData?.items ?? []).map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName}` }))
  const practitionerOptions = (practitionersData?.items ?? []).map((p) => ({ id: p.id, label: `${p.user.firstName} ${p.user.lastName}` }))
  const serviceOptions = (servicesData?.items ?? []).map((s) => ({ id: s.id, label: s.nameAr }))
  const branchOptions = (branchesData?.items ?? []).map((b) => ({ id: b.id, label: b.nameAr }))

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CreateBookingFormValues>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: { type: 'in_person' },
  })

  const patientId = watch('patientId') ?? ''
  const practitionerId = watch('practitionerId') ?? ''
  const serviceId = watch('serviceId') ?? ''
  const branchId = watch('branchId') ?? ''
  const date = watch('date') ?? ''
  const startTime = watch('startTime') ?? ''
  const type = watch('type')
  const notes = watch('notes') ?? ''

  const patientLabel = walkInLabel ?? patientOptions.find((p) => p.id === patientId)?.label
  const practitionerLabel = practitionerOptions.find((p) => p.id === practitionerId)?.label
  const serviceLabel = serviceOptions.find((s) => s.id === serviceId)?.label
  const branchLabel = branchOptions.find((b) => b.id === branchId)?.label
  const typeLabels: Record<string, string> = { in_person: 'حضوري', online: 'أونلاين', walk_in: 'بدون موعد' }

  // Step validation before advancing
  const canAdvance = () => {
    if (step === 0) return true // patient optional
    if (step === 1) return !!practitionerId && !!serviceId
    if (step === 2) return !!date && !!startTime
    return true
  }

  const onSubmit = handleSubmit((values) => {
    const payload = stripEmpty(values) as unknown as CreateBookingPayload
    createMutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/bookings' }),
    })
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 bg-surface border border-border rounded-lg shadow-sm px-6 py-4">
        <button
          type="button"
          onClick={() => navigate({ to: '/bookings' })}
          className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-surface hover:bg-surface-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">حجز جديد</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إنشاء حجز جديد للمريض</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="glass rounded-lg p-6 max-w-2xl space-y-8">
        {/* Step bar */}
        <StepBar current={step} />

        {/* ── Step 0: Patient ──────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">المريض</h2>
              <p className="text-sm text-muted-foreground">ابحث عن مريض مسجّل أو سجّل زائراً جديداً. يمكن تركه فارغاً للحجز العام.</p>
            </div>

            {patientId && !showWalkIn ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-primary/30 bg-primary/5 text-sm">
                <User className="w-4 h-4 text-primary shrink-0" />
                <span className="flex-1 text-foreground font-medium">{patientLabel}</span>
                <button
                  type="button"
                  onClick={() => { setValue('patientId', '', { shouldValidate: true }); setWalkInLabel(null) }}
                  className="text-muted-foreground hover:text-error transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : !showWalkIn ? (
              <div className="space-y-2">
                <FormField label="بحث عن مريض" error={errors.patientId?.message}>
                  <Combobox
                    value={patientId}
                    onChange={(v) => setValue('patientId', v, { shouldValidate: true })}
                    options={patientOptions}
                    placeholder="ابحث عن مريض مسجّل..."
                    searchPlaceholder="اكتب الاسم..."
                    isLoading={patientsLoading}
                  />
                </FormField>
                <button
                  type="button"
                  onClick={() => setShowWalkIn(true)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  تسجيل زائر جديد
                </button>
              </div>
            ) : null}

            {showWalkIn && (
              <WalkInForm
                onCreated={(id, label) => { setValue('patientId', id, { shouldValidate: true }); setWalkInLabel(label); setShowWalkIn(false) }}
                onCancel={() => setShowWalkIn(false)}
              />
            )}
          </div>
        )}

        {/* ── Step 1: Service & Practitioner ──────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">الخدمة والممارس</h2>
              <p className="text-sm text-muted-foreground">اختر الخدمة المطلوبة ثم الممارس الذي سيقدّمها.</p>
            </div>

            <FormField label="الخدمة" required error={errors.serviceId?.message}>
              <Combobox
                value={serviceId}
                onChange={(v) => setValue('serviceId', v, { shouldValidate: true })}
                options={serviceOptions}
                placeholder="اختر خدمة..."
                isLoading={servicesLoading}
              />
            </FormField>

            <FormField label="الممارس" required error={errors.practitionerId?.message}>
              <Combobox
                value={practitionerId}
                onChange={(v) => setValue('practitionerId', v, { shouldValidate: true })}
                options={practitionerOptions}
                placeholder="اختر ممارساً..."
                isLoading={practitionersLoading}
              />
            </FormField>

            <FormField label="الفرع">
              <Combobox
                value={branchId}
                onChange={(v) => setValue('branchId', v, { shouldValidate: true })}
                options={branchOptions}
                placeholder="اختر فرعاً (اختياري)..."
                isLoading={branchesLoading}
              />
            </FormField>
          </div>
        )}

        {/* ── Step 2: Date, Time & Type ────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">التاريخ والوقت</h2>
              <p className="text-sm text-muted-foreground">حدد موعد الحجز ونوعه.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="التاريخ" required error={errors.date?.message}>
                <Input type="date" {...register('date')} />
              </FormField>
              <FormField label="الوقت" required error={errors.startTime?.message}>
                <Input type="time" {...register('startTime')} />
              </FormField>
            </div>

            <FormField label="نوع الحجز" required error={errors.type?.message}>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'in_person', label: 'حضوري', desc: 'زيارة للعيادة' },
                  { value: 'online', label: 'أونلاين', desc: 'استشارة عن بُعد' },
                  { value: 'walk_in', label: 'بدون موعد', desc: 'حضور مباشر' },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setValue('type', t.value as CreateBookingFormValues['type'], { shouldValidate: true })}
                    className={cn(
                      'text-center p-3 rounded-lg border transition-all',
                      type === t.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-surface hover:bg-surface-muted',
                    )}
                  >
                    <p className={cn('text-sm font-medium', type === t.value ? 'text-primary' : 'text-foreground')}>{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="ملاحظات">
              <Input placeholder="أي ملاحظات خاصة بالحجز..." {...register('notes')} />
            </FormField>
          </div>
        )}

        {/* ── Step 3: Confirm ──────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">مراجعة وتأكيد</h2>
              <p className="text-sm text-muted-foreground">تحقق من التفاصيل قبل إنشاء الحجز.</p>
            </div>

            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <SummaryRow label="المريض" value={patientLabel ?? '— غير محدد'} />
              <SummaryRow label="الخدمة" value={serviceLabel ?? '—'} />
              <SummaryRow label="الممارس" value={practitionerLabel ?? '—'} />
              {branchLabel && <SummaryRow label="الفرع" value={branchLabel} />}
              <SummaryRow label="التاريخ" value={date ? new Date(date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
              <SummaryRow label="الوقت" value={startTime || '—'} />
              <SummaryRow label="النوع" value={typeLabels[type] ?? '—'} />
              {notes && <SummaryRow label="ملاحظات" value={notes} />}
            </div>

            {createMutation.isError && (
              <p className="text-sm text-error bg-error/8 border border-error/20 rounded-md px-3 py-2">
                {(createMutation.error as Error)?.message ?? 'حدث خطأ أثناء الحفظ'}
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => step > 0 ? setStep(step - 1) : navigate({ to: '/bookings' })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {step === 0 ? 'إلغاء' : 'السابق'}
          </button>

          {step < 3 ? (
            <Button
              type="button"
              onClick={() => { if (canAdvance()) setStep(step + 1) }}
              disabled={!canAdvance()}
            >
              التالي
              <ArrowRight className="w-4 h-4 ms-1.5 rtl:rotate-180" />
            </Button>
          ) : (
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'جارٍ الحفظ...' : 'تأكيد الحجز'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

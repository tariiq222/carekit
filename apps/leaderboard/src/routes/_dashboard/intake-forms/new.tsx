import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { FormScope, FormType, CreateIntakeFormPayload } from '@carekit/api-client'
import { useCreateIntakeForm } from '@/hooks/use-intake-forms'
import { useBranches } from '@/hooks/use-branches'
import { useServices } from '@/hooks/use-services'
import { usePractitioners } from '@/hooks/use-practitioners'
import { FormShell, FormField, FormSection } from '@/components/shared/form-shell'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_dashboard/intake-forms/new')({
  component: NewIntakeFormPage,
})

const intakeFormSchema = z.object({
  nameAr: z.string().min(2, 'الاسم بالعربية مطلوب'),
  nameEn: z.string().min(2, 'الاسم بالإنجليزية مطلوب'),
  type: z.enum(['pre_booking', 'pre_session', 'post_session', 'registration']),
  scope: z.enum(['global', 'service', 'practitioner', 'branch']),
  serviceId: z.string().optional().or(z.literal('')),
  practitionerId: z.string().optional().or(z.literal('')),
  branchId: z.string().optional().or(z.literal('')),
})
type IntakeFormValues = z.infer<typeof intakeFormSchema>

const FORM_TYPES: { value: FormType; label: string; description: string }[] = [
  { value: 'pre_booking', label: 'قبل الحجز', description: 'يُعرض للمريض لحظة إنشاء الحجز' },
  { value: 'pre_session', label: 'قبل الجلسة', description: 'يُعرض عند تسجيل الحضور' },
  { value: 'post_session', label: 'بعد الجلسة', description: 'يُعرض عند إتمام الجلسة' },
  { value: 'registration', label: 'التسجيل', description: 'يُعرض عند تسجيل المريض أول مرة' },
]

const FORM_SCOPES: { value: FormScope; label: string; description: string }[] = [
  { value: 'global', label: 'عام', description: 'يُطبَّق على جميع الحجوزات' },
  { value: 'service', label: 'خدمة محددة', description: 'يُطبَّق على خدمة واحدة فقط' },
  { value: 'practitioner', label: 'ممارس محدد', description: 'يُطبَّق على ممارس واحد فقط' },
  { value: 'branch', label: 'فرع محدد', description: 'يُطبَّق على فرع واحد فقط' },
]

function NewIntakeFormPage() {
  const navigate = useNavigate()
  const mutation = useCreateIntakeForm()

  const { data: servicesData } = useServices({ perPage: 200 })
  const { data: practitionersData } = usePractitioners({ perPage: 200 })
  const { data: branchesData } = useBranches({ perPage: 200 })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      nameAr: '',
      nameEn: '',
      type: 'pre_booking',
      scope: 'global',
    },
  })

  const scope = watch('scope')
  const type = watch('type')

  const onSubmit = handleSubmit((values) => {
    const payload: CreateIntakeFormPayload = {
      nameAr: values.nameAr.trim(),
      nameEn: values.nameEn.trim(),
      type: values.type,
      scope: values.scope,
      serviceId: values.scope === 'service' ? values.serviceId || undefined : undefined,
      practitionerId: values.scope === 'practitioner' ? values.practitionerId || undefined : undefined,
      branchId: values.scope === 'branch' ? values.branchId || undefined : undefined,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/intake-forms' }),
    })
  })

  const serviceOptions = (servicesData?.items ?? []).map((s) => ({ id: s.id, label: s.nameAr }))
  const practitionerOptions = (practitionersData?.items ?? []).map((p) => ({
    id: p.id,
    label: `${p.user.firstName} ${p.user.lastName}`,
  }))
  const branchOptions = (branchesData?.items ?? []).map((b) => ({ id: b.id, label: b.nameAr }))

  return (
    <FormShell
      title="نموذج استقبال جديد"
      description="إنشاء نموذج يُعرض للمريض في نقاط محددة من رحلته"
      backTo="/intake-forms"
      submitLabel="إنشاء النموذج"
      isPending={mutation.isPending}
      error={(mutation.error as Error)?.message}
      onSubmit={onSubmit}
    >
      {/* Name */}
      <FormSection label="اسم النموذج">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الاسم بالعربية" required error={errors.nameAr?.message}>
            <Input placeholder="نموذج ما قبل الزيارة" dir="rtl" {...register('nameAr')} />
          </FormField>
          <FormField label="الاسم بالإنجليزية" required error={errors.nameEn?.message}>
            <Input placeholder="Pre-visit Form" dir="ltr" {...register('nameEn')} />
          </FormField>
        </div>
      </FormSection>

      {/* Timing */}
      <FormSection label="وقت الظهور" description="متى يُعرض هذا النموذج للمريض؟">
        <div className="grid grid-cols-2 gap-3">
          {FORM_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setValue('type', t.value)}
              className={`text-start p-3 rounded-lg border transition-all ${
                type === t.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-surface hover:bg-surface-muted'
              }`}
            >
              <p className={`text-sm font-medium ${type === t.value ? 'text-primary' : 'text-foreground'}`}>
                {t.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>
      </FormSection>

      {/* Scope */}
      <FormSection label="نطاق التطبيق" description="على من يُطبَّق هذا النموذج؟">
        <div className="grid grid-cols-2 gap-3">
          {FORM_SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setValue('scope', s.value)}
              className={`text-start p-3 rounded-lg border transition-all ${
                scope === s.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-surface hover:bg-surface-muted'
              }`}
            >
              <p className={`text-sm font-medium ${scope === s.value ? 'text-primary' : 'text-foreground'}`}>
                {s.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
            </button>
          ))}
        </div>

        {/* Conditional target selection */}
        {scope === 'service' && (
          <FormField label="اختر الخدمة" error={errors.serviceId?.message}>
            <Select onValueChange={(v) => setValue('serviceId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر خدمة..." />
              </SelectTrigger>
              <SelectContent>
                {serviceOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {scope === 'practitioner' && (
          <FormField label="اختر الممارس" error={errors.practitionerId?.message}>
            <Select onValueChange={(v) => setValue('practitionerId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر ممارساً..." />
              </SelectTrigger>
              <SelectContent>
                {practitionerOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {scope === 'branch' && (
          <FormField label="اختر الفرع" error={errors.branchId?.message}>
            <Select onValueChange={(v) => setValue('branchId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر فرعاً..." />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
      </FormSection>
    </FormShell>
  )
}

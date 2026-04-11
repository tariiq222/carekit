import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { UpdateClinicSettingsPayload } from '@carekit/api-client'
import { useClinicSettings, useUpdateClinicSettings } from '@/hooks/use-clinic-settings'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HIcon } from '@/components/shared/hicon'

export const Route = createFileRoute('/_dashboard/settings/clinic/')({
  component: ClinicSettingsPage,
})

const schema = z.object({
  companyNameAr: z.string().max(255).optional(),
  companyNameEn: z.string().max(255).optional(),
  businessRegistration: z.string().max(50).optional(),
  vatRegistrationNumber: z.string().max(15).optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  sellerAddress: z.string().max(500).optional(),
  clinicCity: z.string().max(100).optional(),
  postalCode: z.string().max(10).optional(),
  contactPhone: z.string().max(20).optional(),
  contactEmail: z.string().email().max(255).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  aboutAr: z.string().max(10000).optional(),
  aboutEn: z.string().max(10000).optional(),
  privacyPolicyAr: z.string().max(10000).optional(),
  privacyPolicyEn: z.string().max(10000).optional(),
  termsAr: z.string().max(10000).optional(),
  termsEn: z.string().max(10000).optional(),
  cancellationPolicyAr: z.string().max(5000).optional(),
  cancellationPolicyEn: z.string().max(5000).optional(),
  defaultLanguage: z.string().optional(),
  timezone: z.string().optional(),
  weekStartDay: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  emailHeaderShowLogo: z.boolean().optional(),
  emailHeaderShowName: z.boolean().optional(),
  emailFooterPhone: z.string().max(500).optional(),
  emailFooterWebsite: z.string().max(500).optional(),
  emailFooterInstagram: z.string().max(500).optional(),
  emailFooterTwitter: z.string().max(500).optional(),
  emailFooterSnapchat: z.string().max(500).optional(),
  emailFooterTiktok: z.string().max(500).optional(),
  emailFooterLinkedin: z.string().max(500).optional(),
  emailFooterYoutube: z.string().max(500).optional(),
  sessionDuration: z.coerce.number().min(5).max(480).optional(),
  reminderBeforeMinutes: z.coerce.number().min(0).max(1440).optional(),
})

type FormValues = z.infer<typeof schema>

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-[var(--radius-lg)] shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border-soft)]">
        <div className="flex items-center justify-center size-8 rounded-[var(--radius-sm)] bg-[var(--primary-ultra)]">
          <HIcon name={icon} className="text-[var(--primary)] text-base" />
        </div>
        <h2 className="text-sm font-semibold text-[var(--fg)]">{title}</h2>
      </div>
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>
    </div>
  )
}

function Field({
  label,
  children,
  full,
  error,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
  error?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'md:col-span-2' : ''}`}>
      <Label className="text-xs font-medium text-[var(--fg-2)]">{label}</Label>
      {children}
      {error && <p className="text-xs text-[var(--error)]">{error}</p>}
    </div>
  )
}

function ClinicSettingsPage() {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const { data: settings, isLoading } = useClinicSettings()
  const update = useUpdateClinicSettings()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!settings) return
    const nullToUndefined = (v: string | null | undefined) => v ?? undefined
    reset({
      companyNameAr: nullToUndefined(settings.companyNameAr),
      companyNameEn: nullToUndefined(settings.companyNameEn),
      businessRegistration: nullToUndefined(settings.businessRegistration),
      vatRegistrationNumber: nullToUndefined(settings.vatRegistrationNumber),
      vatRate: settings.vatRate ?? undefined,
      sellerAddress: nullToUndefined(settings.sellerAddress),
      clinicCity: nullToUndefined(settings.clinicCity),
      postalCode: nullToUndefined(settings.postalCode),
      contactPhone: nullToUndefined(settings.contactPhone),
      contactEmail: nullToUndefined(settings.contactEmail),
      address: nullToUndefined(settings.address),
      aboutAr: nullToUndefined(settings.aboutAr),
      aboutEn: nullToUndefined(settings.aboutEn),
      privacyPolicyAr: nullToUndefined(settings.privacyPolicyAr),
      privacyPolicyEn: nullToUndefined(settings.privacyPolicyEn),
      termsAr: nullToUndefined(settings.termsAr),
      termsEn: nullToUndefined(settings.termsEn),
      cancellationPolicyAr: nullToUndefined(settings.cancellationPolicyAr),
      cancellationPolicyEn: nullToUndefined(settings.cancellationPolicyEn),
      defaultLanguage: nullToUndefined(settings.defaultLanguage),
      timezone: nullToUndefined(settings.timezone),
      weekStartDay: nullToUndefined(settings.weekStartDay),
      dateFormat: nullToUndefined(settings.dateFormat),
      timeFormat: nullToUndefined(settings.timeFormat),
      emailHeaderShowLogo: settings.emailHeaderShowLogo,
      emailHeaderShowName: settings.emailHeaderShowName,
      emailFooterPhone: nullToUndefined(settings.emailFooterPhone),
      emailFooterWebsite: nullToUndefined(settings.emailFooterWebsite),
      emailFooterInstagram: nullToUndefined(settings.emailFooterInstagram),
      emailFooterTwitter: nullToUndefined(settings.emailFooterTwitter),
      emailFooterSnapchat: nullToUndefined(settings.emailFooterSnapchat),
      emailFooterTiktok: nullToUndefined(settings.emailFooterTiktok),
      emailFooterLinkedin: nullToUndefined(settings.emailFooterLinkedin),
      emailFooterYoutube: nullToUndefined(settings.emailFooterYoutube),
      sessionDuration: settings.sessionDuration ?? undefined,
      reminderBeforeMinutes: settings.reminderBeforeMinutes ?? undefined,
    })
  }, [settings, reset])

  const onSubmit = async (values: FormValues) => {
    const payload: UpdateClinicSettingsPayload = {}
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== '') {
        ;(payload as Record<string, unknown>)[k] = v
      }
    }
    try {
      await update.mutateAsync(payload)
      setFeedback({ type: 'success', msg: 'تم حفظ الإعدادات بنجاح' })
      setTimeout(() => setFeedback(null), 3000)
    } catch {
      setFeedback({ type: 'error', msg: 'فشل حفظ الإعدادات، يرجى المحاولة مرة أخرى' })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-[68px] bg-[var(--surface)] border border-[var(--border-soft)] rounded-[var(--radius-lg)] animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-48 bg-[var(--surface)] border border-[var(--border-soft)] rounded-[var(--radius-lg)] animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <PageHeader
        title="إعدادات العيادة"
        description="بيانات العيادة، السياسات، ووقت العمل"
        actions={
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? (
              <HIcon name="hgi-loading-03" className="me-2 animate-spin" />
            ) : (
              <HIcon name="hgi-checkmark-circle-02" className="me-2" />
            )}
            حفظ التغييرات
          </Button>
        }
      />

      {feedback && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-[var(--success-bg)] text-[var(--success)] border-[color:var(--success)]/30'
              : 'bg-[var(--error-bg)] text-[var(--error)] border-[color:var(--error)]/30'
          }`}
        >
          <HIcon
            name={feedback.type === 'success' ? 'hgi-checkmark-circle-02' : 'hgi-alert-02'}
          />
          {feedback.msg}
        </div>
      )}

      {/* Identity */}
      <SectionCard icon="hgi-building-03" title="هوية العيادة">
        <Field label="الاسم بالعربية" error={errors.companyNameAr?.message}>
          <Input {...register('companyNameAr')} placeholder="مثال: عيادة الرعاية" />
        </Field>
        <Field label="الاسم بالإنجليزية" error={errors.companyNameEn?.message}>
          <Input {...register('companyNameEn')} placeholder="e.g. CareKit Clinic" />
        </Field>
        <Field label="رقم السجل التجاري" error={errors.businessRegistration?.message}>
          <Input {...register('businessRegistration')} placeholder="1234567890" />
        </Field>
        <Field label="رقم تسجيل الضريبة (VAT)" error={errors.vatRegistrationNumber?.message}>
          <Input {...register('vatRegistrationNumber')} placeholder="300xxxxxxxxxx" />
        </Field>
        <Field label="نسبة الضريبة (%)" error={errors.vatRate?.message}>
          <Input type="number" step="0.01" {...register('vatRate')} placeholder="15" />
        </Field>
        <Field label="المدينة" error={errors.clinicCity?.message}>
          <Input {...register('clinicCity')} placeholder="الرياض" />
        </Field>
        <Field label="الرمز البريدي" error={errors.postalCode?.message}>
          <Input {...register('postalCode')} placeholder="12345" />
        </Field>
        <Field label="العنوان (للفاتورة)" error={errors.sellerAddress?.message}>
          <Input {...register('sellerAddress')} placeholder="حي، شارع، مبنى" />
        </Field>
        <Field label="العنوان التفصيلي" error={errors.address?.message} full>
          <Input {...register('address')} placeholder="العنوان الكامل" />
        </Field>
      </SectionCard>

      {/* Contact */}
      <SectionCard icon="hgi-phone-01" title="بيانات التواصل">
        <Field label="رقم الهاتف" error={errors.contactPhone?.message}>
          <Input {...register('contactPhone')} placeholder="+966 5x xxx xxxx" />
        </Field>
        <Field label="البريد الإلكتروني" error={errors.contactEmail?.message}>
          <Input type="email" {...register('contactEmail')} placeholder="info@clinic.sa" />
        </Field>
      </SectionCard>

      {/* Preferences */}
      <SectionCard icon="hgi-settings-02" title="التفضيلات">
        <Field label="اللغة الافتراضية">
          <Select
            value={watch('defaultLanguage') ?? ''}
            onValueChange={(v) => setValue('defaultLanguage', v, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر اللغة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="المنطقة الزمنية">
          <Select
            value={watch('timezone') ?? ''}
            onValueChange={(v) => setValue('timezone', v, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر المنطقة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Asia/Riyadh">الرياض (UTC+3)</SelectItem>
              <SelectItem value="Asia/Dubai">دبي (UTC+4)</SelectItem>
              <SelectItem value="Africa/Cairo">القاهرة (UTC+2)</SelectItem>
              <SelectItem value="UTC">UTC</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="أول يوم في الأسبوع">
          <Select
            value={watch('weekStartDay') ?? ''}
            onValueChange={(v) => setValue('weekStartDay', v, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر اليوم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sunday">الأحد</SelectItem>
              <SelectItem value="monday">الاثنين</SelectItem>
              <SelectItem value="saturday">السبت</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="صيغة التاريخ">
          <Select
            value={watch('dateFormat') ?? ''}
            onValueChange={(v) => setValue('dateFormat', v, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر الصيغة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="صيغة الوقت">
          <Select
            value={watch('timeFormat') ?? ''}
            onValueChange={(v) => setValue('timeFormat', v, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر الصيغة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12h">12 ساعة (AM/PM)</SelectItem>
              <SelectItem value="24h">24 ساعة</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="مدة الجلسة (دقيقة)" error={errors.sessionDuration?.message}>
          <Input type="number" {...register('sessionDuration')} placeholder="30" />
        </Field>
        <Field label="التذكير قبل الموعد (دقيقة)" error={errors.reminderBeforeMinutes?.message}>
          <Input type="number" {...register('reminderBeforeMinutes')} placeholder="60" />
        </Field>
      </SectionCard>

      {/* Email Footer */}
      <SectionCard icon="hgi-mail-01" title="إعدادات البريد الإلكتروني">
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between py-3 border-b border-[var(--border-soft)]">
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">إظهار الشعار في الهيدر</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">يظهر شعار العيادة في رأس الإيميل</p>
            </div>
            <Switch
              checked={watch('emailHeaderShowLogo') ?? false}
              onCheckedChange={(v) => setValue('emailHeaderShowLogo', v, { shouldDirty: true })}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">إظهار اسم العيادة في الهيدر</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">يظهر اسم العيادة في رأس الإيميل</p>
            </div>
            <Switch
              checked={watch('emailHeaderShowName') ?? false}
              onCheckedChange={(v) => setValue('emailHeaderShowName', v, { shouldDirty: true })}
            />
          </div>
        </div>
        <Field label="هاتف الفوتر" error={errors.emailFooterPhone?.message}>
          <Input {...register('emailFooterPhone')} placeholder="+966 5x xxx xxxx" />
        </Field>
        <Field label="الموقع الإلكتروني" error={errors.emailFooterWebsite?.message}>
          <Input {...register('emailFooterWebsite')} placeholder="https://clinic.sa" />
        </Field>
        <Field label="إنستغرام" error={errors.emailFooterInstagram?.message}>
          <Input {...register('emailFooterInstagram')} placeholder="@username" />
        </Field>
        <Field label="تويتر (X)" error={errors.emailFooterTwitter?.message}>
          <Input {...register('emailFooterTwitter')} placeholder="@username" />
        </Field>
        <Field label="سناب شات" error={errors.emailFooterSnapchat?.message}>
          <Input {...register('emailFooterSnapchat')} placeholder="@username" />
        </Field>
        <Field label="تيك توك" error={errors.emailFooterTiktok?.message}>
          <Input {...register('emailFooterTiktok')} placeholder="@username" />
        </Field>
        <Field label="لينكد إن" error={errors.emailFooterLinkedin?.message}>
          <Input {...register('emailFooterLinkedin')} placeholder="url أو @username" />
        </Field>
        <Field label="يوتيوب" error={errors.emailFooterYoutube?.message}>
          <Input {...register('emailFooterYoutube')} placeholder="url أو @username" />
        </Field>
      </SectionCard>

      {/* Policies */}
      <SectionCard icon="hgi-file-02" title="السياسات والمحتوى">
        <Field label="عن العيادة (عربي)" full error={errors.aboutAr?.message}>
          <Textarea {...register('aboutAr')} rows={4} placeholder="نبذة عن العيادة..." />
        </Field>
        <Field label="عن العيادة (إنجليزي)" full error={errors.aboutEn?.message}>
          <Textarea {...register('aboutEn')} rows={4} placeholder="About the clinic..." />
        </Field>
        <Field label="سياسة الخصوصية (عربي)" full error={errors.privacyPolicyAr?.message}>
          <Textarea {...register('privacyPolicyAr')} rows={5} placeholder="سياسة الخصوصية..." />
        </Field>
        <Field label="سياسة الخصوصية (إنجليزي)" full error={errors.privacyPolicyEn?.message}>
          <Textarea {...register('privacyPolicyEn')} rows={5} placeholder="Privacy policy..." />
        </Field>
        <Field label="الشروط والأحكام (عربي)" full error={errors.termsAr?.message}>
          <Textarea {...register('termsAr')} rows={5} placeholder="الشروط والأحكام..." />
        </Field>
        <Field label="الشروط والأحكام (إنجليزي)" full error={errors.termsEn?.message}>
          <Textarea {...register('termsEn')} rows={5} placeholder="Terms and conditions..." />
        </Field>
        <Field label="سياسة الإلغاء (عربي)" full error={errors.cancellationPolicyAr?.message}>
          <Textarea
            {...register('cancellationPolicyAr')}
            rows={4}
            placeholder="سياسة الإلغاء..."
          />
        </Field>
        <Field label="سياسة الإلغاء (إنجليزي)" full error={errors.cancellationPolicyEn?.message}>
          <Textarea
            {...register('cancellationPolicyEn')}
            rows={4}
            placeholder="Cancellation policy..."
          />
        </Field>
      </SectionCard>

      {/* Sticky save bar */}
      {isDirty && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-50 pointer-events-none">
          <div className="glass border border-[var(--border-soft)] rounded-[var(--radius-lg)] px-6 py-3 flex items-center gap-4 shadow-lg pointer-events-auto">
            <p className="text-sm text-[var(--fg-2)]">لديك تغييرات غير محفوظة</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => reset()}
              disabled={update.isPending}
            >
              تراجع
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending && (
                <HIcon name="hgi-loading-03" className="me-2 animate-spin" />
              )}
              حفظ
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}

import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import type { FormScope, FormType } from '@carekit/api-client'
import { useCreateIntakeForm } from '@/hooks/use-intake-forms'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/intake-forms/new')({
  component: NewIntakeFormPage,
})

const FORM_TYPE_OPTIONS: { value: FormType; label: string }[] = [
  { value: 'pre_booking', label: 'قبل الحجز' },
  { value: 'pre_session', label: 'قبل الجلسة' },
  { value: 'post_session', label: 'بعد الجلسة' },
  { value: 'registration', label: 'تسجيل' },
]

const FORM_SCOPE_OPTIONS: { value: FormScope; label: string }[] = [
  { value: 'global', label: 'عام' },
  { value: 'service', label: 'خدمة' },
  { value: 'practitioner', label: 'ممارس' },
  { value: 'branch', label: 'فرع' },
]

const inputClass =
  'w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40'
const errorClass = 'text-xs text-[var(--error,#dc2626)] mt-1'

function NewIntakeFormPage() {
  const navigate = useNavigate()
  const mutation = useCreateIntakeForm()

  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [type, setType] = useState<FormType>('pre_booking')
  const [scope, setScope] = useState<FormScope>('global')
  const [serviceId, setServiceId] = useState('')
  const [practitionerId, setPractitionerId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [errors, setErrors] = useState<{ nameAr?: string; nameEn?: string }>({})

  const validate = () => {
    const e: { nameAr?: string; nameEn?: string } = {}
    if (!nameAr.trim()) e.nameAr = 'الاسم بالعربية مطلوب'
    if (!nameEn.trim()) e.nameEn = 'الاسم بالإنجليزية مطلوب'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    mutation.mutate(
      {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        type,
        scope,
        serviceId: scope === 'service' ? serviceId || undefined : undefined,
        practitionerId: scope === 'practitioner' ? practitionerId || undefined : undefined,
        branchId: scope === 'branch' ? branchId || undefined : undefined,
      },
      { onSuccess: () => navigate({ to: '/intake-forms' }) },
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="نموذج جديد"
        description="إضافة نموذج استقبال جديد"
        actions={
          <Link to="/intake-forms">
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nameAr">الاسم (عربي) *</Label>
            <input
              id="nameAr"
              dir="rtl"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className={inputClass}
            />
            {errors.nameAr && <p className={errorClass}>{errors.nameAr}</p>}
          </div>
          <div>
            <Label htmlFor="nameEn">الاسم (إنجليزي) *</Label>
            <input
              id="nameEn"
              dir="ltr"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className={inputClass}
            />
            {errors.nameEn && <p className={errorClass}>{errors.nameEn}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">النوع</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as FormType)}
              className={inputClass}
            >
              {FORM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="scope">النطاق</Label>
            <select
              id="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as FormScope)}
              className={inputClass}
            >
              {FORM_SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {scope === 'service' && (
          <div>
            <Label htmlFor="serviceId">معرف الخدمة</Label>
            <input
              id="serviceId"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="UUID"
              className={inputClass}
            />
          </div>
        )}
        {scope === 'practitioner' && (
          <div>
            <Label htmlFor="practitionerId">معرف الممارس</Label>
            <input
              id="practitionerId"
              value={practitionerId}
              onChange={(e) => setPractitionerId(e.target.value)}
              placeholder="UUID"
              className={inputClass}
            />
          </div>
        )}
        {scope === 'branch' && (
          <div>
            <Label htmlFor="branchId">معرف الفرع</Label>
            <input
              id="branchId"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder="UUID"
              className={inputClass}
            />
          </div>
        )}

        {mutation.isError && (
          <p className={errorClass}>
            {(mutation.error as Error)?.message ?? 'حدث خطأ غير متوقع'}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جاري الحفظ...' : 'إنشاء النموذج'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/intake-forms' })}>
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

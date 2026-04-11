import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import type { FormScope, FormType, IntakeFormField } from '@carekit/api-client'
import { useIntakeForm, useUpdateIntakeForm, useDeleteIntakeForm } from '@/hooks/use-intake-forms'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_dashboard/intake-forms/$id')({
  component: IntakeFormDetailPage,
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

const FIELD_TYPE_LABELS: Record<IntakeFormField['type'], string> = {
  text: 'نص قصير',
  textarea: 'نص طويل',
  select: 'قائمة منسدلة',
  checkbox: 'مربع اختيار',
  radio: 'اختيار واحد',
  date: 'تاريخ',
}

const inputClass =
  'w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40'
const errorClass = 'text-xs text-[var(--danger)] mt-1'

function IntakeFormDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const formQuery = useIntakeForm(id)
  const updateMutation = useUpdateIntakeForm(id)
  const deleteMutation = useDeleteIntakeForm()

  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [type, setType] = useState<FormType>('pre_booking')
  const [scope, setScope] = useState<FormScope>('global')
  const [serviceId, setServiceId] = useState('')
  const [practitionerId, setPractitionerId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<{ nameAr?: string; nameEn?: string }>({})

  useEffect(() => {
    const d = formQuery.data
    if (!d) return
    setNameAr(d.nameAr)
    setNameEn(d.nameEn)
    setType(d.type)
    setScope(d.scope)
    setServiceId(d.serviceId ?? '')
    setPractitionerId(d.practitionerId ?? '')
    setBranchId(d.branchId ?? '')
    setIsActive(d.isActive)
  }, [formQuery.data])

  if (formQuery.isLoading) return <SkeletonPage />
  if (!formQuery.data) return <p className="text-[var(--muted)] p-6">النموذج غير موجود</p>

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
    updateMutation.mutate(
      {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        type,
        scope,
        isActive,
        serviceId: scope === 'service' ? serviceId || undefined : undefined,
        practitionerId: scope === 'practitioner' ? practitionerId || undefined : undefined,
        branchId: scope === 'branch' ? branchId || undefined : undefined,
      },
      { onSuccess: () => navigate({ to: '/intake-forms' }) },
    )
  }

  const handleDelete = async () => {
    if (!confirm('حذف هذا النموذج نهائياً؟')) return
    try {
      await deleteMutation.mutateAsync(id)
      navigate({ to: '/intake-forms' })
    } catch {
      // deleteMutation.isError handles UI feedback
    }
  }

  const fields = formQuery.data.fields ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={formQuery.data.nameAr}
        description={formQuery.data.nameEn}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <i className="hgi-stroke hgi-delete-02 me-2" />
              حذف
            </Button>
            <Link to="/intake-forms">
              <Button variant="outline">رجوع</Button>
            </Link>
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nameAr">الاسم (عربي) *</Label>
            <input id="nameAr" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={inputClass} />
            {errors.nameAr && <p className={errorClass}>{errors.nameAr}</p>}
          </div>
          <div>
            <Label htmlFor="nameEn">الاسم (إنجليزي) *</Label>
            <input id="nameEn" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={inputClass} />
            {errors.nameEn && <p className={errorClass}>{errors.nameEn}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">النوع</Label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as FormType)} className={inputClass}>
              {FORM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="scope">النطاق</Label>
            <select id="scope" value={scope} onChange={(e) => setScope(e.target.value as FormScope)} className={inputClass}>
              {FORM_SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {scope === 'service' && (
          <div>
            <Label htmlFor="serviceId">معرف الخدمة</Label>
            <input id="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} placeholder="UUID" className={inputClass} />
          </div>
        )}
        {scope === 'practitioner' && (
          <div>
            <Label htmlFor="practitionerId">معرف الممارس</Label>
            <input id="practitionerId" value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} placeholder="UUID" className={inputClass} />
          </div>
        )}
        {scope === 'branch' && (
          <div>
            <Label htmlFor="branchId">معرف الفرع</Label>
            <input id="branchId" value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="UUID" className={inputClass} />
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            id="isActive"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 rounded border-[var(--border)] accent-[var(--primary)]"
          />
          <Label htmlFor="isActive">نشط</Label>
        </div>

        {updateMutation.isError && (
          <p className={errorClass}>{(updateMutation.error as Error)?.message ?? 'حدث خطأ غير متوقع'}</p>
        )}
        {deleteMutation.isError && (
          <p className={errorClass}>حدث خطأ أثناء الحذف. حاول مرة أخرى.</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/intake-forms' })}>
            إلغاء
          </Button>
        </div>
      </form>

      {fields.length > 0 && (
        <div className="glass rounded-[var(--radius)] p-6 max-w-2xl">
          <h2 className="text-sm font-medium text-[var(--fg)] mb-4">حقول النموذج ({fields.length})</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className="text-start pb-2 text-[var(--muted)] font-medium">التسمية</th>
                <th className="text-start pb-2 text-[var(--muted)] font-medium">النوع</th>
                <th className="text-start pb-2 text-[var(--muted)] font-medium">مطلوب</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id} className="border-b border-[var(--border-soft)] last:border-0">
                  <td className="py-2 text-[var(--fg)]">{f.labelAr}</td>
                  <td className="py-2 text-[var(--muted)]">{FIELD_TYPE_LABELS[f.type] ?? f.type}</td>
                  <td className="py-2">
                    {f.required ? (
                      <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs bg-[var(--success-bg)] text-[var(--success)] border border-[color:var(--success)]/30">نعم</span>
                    ) : (
                      <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs bg-[var(--surface)] text-[var(--muted)] border border-[var(--border-soft)]">لا</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

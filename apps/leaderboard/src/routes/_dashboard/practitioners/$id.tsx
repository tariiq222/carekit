import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UpdatePractitionerPayload } from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HIcon } from '@/components/shared/hicon'
import {
  usePractitioner,
  useUpdatePractitioner,
  useDeletePractitioner,
} from '@/hooks/use-practitioners'
import {
  updatePractitionerSchema,
  type UpdatePractitionerFormValues,
} from '@/lib/schemas/practitioner.schema'
import { PractitionerServicesTab } from '@/components/features/practitioners/practitioner-services-tab'
import { PractitionerVacationsTab } from '@/components/features/practitioners/practitioner-vacations-tab'
import { PractitionerBreaksTab } from '@/components/features/practitioners/practitioner-breaks-tab'

export const Route = createFileRoute('/_dashboard/practitioners/$id')({
  component: PractitionerDetailPage,
})

type Tab = 'info' | 'services' | 'vacations' | 'breaks'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'info', label: 'البيانات الأساسية', icon: 'hgi-user-02' },
  { id: 'services', label: 'الخدمات والتسعيرة', icon: 'hgi-medical-mask' },
  { id: 'vacations', label: 'الإجازات', icon: 'hgi-calendar-02' },
  { id: 'breaks', label: 'الاستراحات', icon: 'hgi-clock-02' },
]

function PractitionerDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('info')

  const { data: practitioner, isLoading } = usePractitioner(id)
  const updatePractitioner = useUpdatePractitioner(id)
  const deletePractitioner = useDeletePractitioner()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePractitionerFormValues>({
    resolver: zodResolver(updatePractitionerSchema),
    values: {
      experience: practitioner?.experience,
      bio: practitioner?.bio ?? '',
      bioAr: practitioner?.bioAr ?? '',
      isActive: practitioner?.isActive,
    },
  })

  if (isLoading) return <SkeletonPage />
  if (!practitioner) return <p className="text-[var(--muted)] p-6">الممارس غير موجود</p>

  const fullName = `${practitioner.user.firstName} ${practitioner.user.lastName}`

  const onSubmit = handleSubmit(async (values) => {
    const payload: UpdatePractitionerPayload = {
      ...(values.experience !== undefined ? { experience: values.experience } : {}),
      ...(values.bio && values.bio.trim() !== '' ? { bio: values.bio } : {}),
      ...(values.bioAr && values.bioAr.trim() !== '' ? { bioAr: values.bioAr } : {}),
    }
    await updatePractitioner.mutateAsync(payload)
  })

  const onDelete = () => {
    if (confirm(`هل أنت متأكد من حذف ${fullName}؟`)) {
      deletePractitioner.mutate(id, {
        onSuccess: () => navigate({ to: '/practitioners' }),
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        description={`${practitioner.specialty.nameAr} · ★ ${practitioner.rating.toFixed(1)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/practitioners/$id/availability" params={{ id }}>
              <Button variant="outline" size="sm">
                <HIcon name="hgi-clock-01" className="me-1" />
                أوقات العمل
              </Button>
            </Link>
            <Link to="/practitioners">
              <Button variant="outline" size="sm">رجوع</Button>
            </Link>
          </div>
        }
      />

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            ].join(' ')}
          >
            <HIcon name={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <form onSubmit={onSubmit} className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-5">
          <div className="space-y-2">
            <Label htmlFor="experience">سنوات الخبرة</Label>
            <Input
              id="experience"
              type="number"
              min={0}
              max={50}
              className="max-w-[120px]"
              {...register('experience', { valueAsNumber: true })}
            />
            {errors.experience && (
              <p className="text-xs text-[var(--error,#dc2626)]">{errors.experience.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bioAr">نبذة بالعربية</Label>
            <Input id="bioAr" dir="rtl" {...register('bioAr')} />
            {errors.bioAr && (
              <p className="text-xs text-[var(--error,#dc2626)]">{errors.bioAr.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">نبذة بالإنجليزية</Label>
            <Input id="bio" dir="ltr" {...register('bio')} />
            {errors.bio && (
              <p className="text-xs text-[var(--error,#dc2626)]">{errors.bio.message}</p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>حفظ التغييرات</Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDelete}
              disabled={deletePractitioner.isPending}
              className="text-[var(--error,#dc2626)] border-[color:var(--error,#dc2626)]/30 hover:bg-[color:var(--error,#dc2626)]/10"
            >
              حذف الممارس
            </Button>
          </div>
        </form>
      )}

      {activeTab === 'services' && <PractitionerServicesTab practitionerId={id} />}
      {activeTab === 'vacations' && <PractitionerVacationsTab practitionerId={id} />}
      {activeTab === 'breaks' && <PractitionerBreaksTab practitionerId={id} />}
    </div>
  )
}

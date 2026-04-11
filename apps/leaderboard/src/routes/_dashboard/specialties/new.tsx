import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateSpecialtyPayload } from '@carekit/api-client'
import { useCreateSpecialty } from '@/hooks/use-specialties'
import {
  createSpecialtySchema,
  type CreateSpecialtyFormValues,
} from '@/lib/schemas/specialty.schema'
import { FormShell, FormField, FormSection } from '@/components/shared/form-shell'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/_dashboard/specialties/new')({
  component: NewSpecialtyPage,
})

function NewSpecialtyPage() {
  const navigate = useNavigate()
  const mutation = useCreateSpecialty()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSpecialtyFormValues>({
    resolver: zodResolver(createSpecialtySchema),
    defaultValues: { nameAr: '', nameEn: '', descriptionAr: '', descriptionEn: '', iconUrl: '' },
  })

  const onSubmit = handleSubmit((values) => {
    const payload: CreateSpecialtyPayload = {
      nameAr: values.nameAr,
      nameEn: values.nameEn,
      descriptionAr: values.descriptionAr?.trim() || undefined,
      descriptionEn: values.descriptionEn?.trim() || undefined,
      iconUrl: values.iconUrl?.trim() || undefined,
      sortOrder: values.sortOrder,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/specialties' }),
    })
  })

  return (
    <FormShell
      title="تخصص جديد"
      description="إضافة تخصص ممارس جديد"
      backTo="/specialties"
      submitLabel="إنشاء التخصص"
      isPending={mutation.isPending}
      error={(mutation.error as Error)?.message}
      onSubmit={onSubmit}
    >
      {/* Names */}
      <FormSection label="الاسم">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الاسم بالعربية" required error={errors.nameAr?.message}>
            <Input placeholder="طب الأسنان" dir="rtl" {...register('nameAr')} />
          </FormField>
          <FormField label="الاسم بالإنجليزية" required error={errors.nameEn?.message}>
            <Input placeholder="Dentistry" dir="ltr" {...register('nameEn')} />
          </FormField>
        </div>
      </FormSection>

      {/* Descriptions */}
      <FormSection label="الوصف" description="اختياري">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الوصف بالعربية">
            <Textarea
              placeholder="وصف مختصر..."
              dir="rtl"
              rows={3}
              {...register('descriptionAr')}
            />
          </FormField>
          <FormField label="الوصف بالإنجليزية">
            <Textarea
              placeholder="Short description..."
              dir="ltr"
              rows={3}
              {...register('descriptionEn')}
            />
          </FormField>
        </div>
      </FormSection>

      {/* Meta */}
      <FormSection label="الأيقونة والترتيب" description="اختياري">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="رابط الأيقونة"
            error={errors.iconUrl?.message}
            hint="رابط صورة SVG أو PNG"
          >
            <Input placeholder="https://..." dir="ltr" {...register('iconUrl')} />
          </FormField>
          <FormField label="ترتيب العرض" hint="رقم أصغر = يظهر أولاً">
            <Input type="number" min="0" placeholder="0" {...register('sortOrder')} />
          </FormField>
        </div>
      </FormSection>
    </FormShell>
  )
}

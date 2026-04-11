import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateDepartmentPayload } from '@carekit/api-client'
import { useCreateDepartment } from '@/hooks/use-departments'
import {
  createDepartmentSchema,
  type CreateDepartmentFormValues,
} from '@/lib/schemas/department.schema'
import { FormShell, FormField, FormSection, FormToggle } from '@/components/shared/form-shell'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

export const Route = createFileRoute('/_dashboard/departments/new')({
  component: NewDepartmentPage,
})

function NewDepartmentPage() {
  const navigate = useNavigate()
  const mutation = useCreateDepartment()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateDepartmentFormValues>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      nameAr: '',
      nameEn: '',
      descriptionAr: '',
      descriptionEn: '',
      icon: '',
      isActive: true,
    },
  })

  const isActive = watch('isActive')

  const onSubmit = handleSubmit((values) => {
    const payload: CreateDepartmentPayload = {
      nameAr: values.nameAr,
      nameEn: values.nameEn,
      descriptionAr: values.descriptionAr?.trim() || undefined,
      descriptionEn: values.descriptionEn?.trim() || undefined,
      icon: values.icon?.trim() || undefined,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/departments' }),
    })
  })

  return (
    <FormShell
      title="قسم جديد"
      description="إضافة قسم طبي للعيادة"
      backTo="/departments"
      submitLabel="إنشاء القسم"
      isPending={mutation.isPending}
      error={(mutation.error as Error)?.message}
      onSubmit={onSubmit}
    >
      {/* Names */}
      <FormSection label="الاسم">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الاسم بالعربية" required error={errors.nameAr?.message}>
            <Input placeholder="قسم الأسنان" dir="rtl" {...register('nameAr')} />
          </FormField>
          <FormField label="الاسم بالإنجليزية" required error={errors.nameEn?.message}>
            <Input placeholder="Dental Department" dir="ltr" {...register('nameEn')} />
          </FormField>
        </div>
      </FormSection>

      {/* Descriptions */}
      <FormSection label="الوصف" description="اختياري">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الوصف بالعربية">
            <Textarea placeholder="وصف مختصر..." dir="rtl" rows={3} {...register('descriptionAr')} />
          </FormField>
          <FormField label="الوصف بالإنجليزية">
            <Textarea placeholder="Short description..." dir="ltr" rows={3} {...register('descriptionEn')} />
          </FormField>
        </div>
      </FormSection>

      {/* Meta */}
      <FormSection label="الأيقونة والترتيب" description="اختياري">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الأيقونة" hint="مثال: hgi-stroke-tooth">
            <Input placeholder="hgi-stroke-..." {...register('icon')} />
          </FormField>
          <FormField label="ترتيب العرض" hint="رقم أصغر = يظهر أولاً">
            <Input type="number" min="0" placeholder="0" {...register('sortOrder')} />
          </FormField>
        </div>
      </FormSection>

      {/* Status */}
      <FormToggle label="نشط" description="يظهر القسم للمرضى والممارسين">
        <Switch
          checked={isActive ?? true}
          onCheckedChange={(v) => setValue('isActive', v)}
        />
      </FormToggle>
    </FormShell>
  )
}

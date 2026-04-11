import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateServicePayload } from '@carekit/api-client'
import { useCreateService, useServiceCategories } from '@/hooks/use-services'
import {
  createServiceSchema,
  type CreateServiceFormValues,
} from '@/lib/schemas/service.schema'
import { FormShell, FormField, FormSection, FormToggle } from '@/components/shared/form-shell'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_dashboard/services/new')({
  component: NewServicePage,
})

function NewServicePage() {
  const navigate = useNavigate()
  const mutation = useCreateService()
  const { data: categoriesData } = useServiceCategories()
  const categoryOptions = (categoriesData ?? []).map((c) => ({ id: c.id, label: c.nameAr }))

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateServiceFormValues>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      nameAr: '',
      nameEn: '',
      descriptionAr: '',
      descriptionEn: '',
      categoryId: '',
      isActive: true,
    },
  })

  const isActive = watch('isActive')

  const onSubmit = handleSubmit((values) => {
    const payload: CreateServicePayload = {
      nameAr: values.nameAr,
      nameEn: values.nameEn,
      descriptionAr: values.descriptionAr?.trim() || undefined,
      descriptionEn: values.descriptionEn?.trim() || undefined,
      categoryId: values.categoryId,
      price: values.price,
      duration: values.duration,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/services' }),
    })
  })

  return (
    <FormShell
      title="خدمة جديدة"
      description="إضافة خدمة إلى كتالوج العيادة"
      backTo="/services"
      submitLabel="إنشاء الخدمة"
      isPending={mutation.isPending}
      error={(mutation.error as Error)?.message}
      onSubmit={onSubmit}
    >
      {/* Names */}
      <FormSection label="اسم الخدمة">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الاسم بالعربية" required error={errors.nameAr?.message}>
            <Input placeholder="تنظيف الأسنان" dir="rtl" {...register('nameAr')} />
          </FormField>
          <FormField label="الاسم بالإنجليزية" required error={errors.nameEn?.message}>
            <Input placeholder="Teeth Cleaning" dir="ltr" {...register('nameEn')} />
          </FormField>
        </div>

        <FormField label="التصنيف" required error={errors.categoryId?.message}>
          <Select
            value={watch('categoryId') ?? ''}
            onValueChange={(v) => setValue('categoryId', v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر تصنيفاً..." />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>

      {/* Pricing & Duration */}
      <FormSection label="السعر والمدة" description="اختياري">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="السعر"
            hint="بالهللات — 10000 = 100 ريال"
            error={errors.price?.message}
          >
            <Input type="number" min="0" placeholder="10000" {...register('price')} />
          </FormField>
          <FormField
            label="مدة الجلسة"
            hint="بالدقائق"
            error={errors.duration?.message}
          >
            <Input type="number" min="1" placeholder="30" {...register('duration')} />
          </FormField>
        </div>
      </FormSection>

      {/* Descriptions */}
      <FormSection label="الوصف" description="اختياري">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الوصف بالعربية">
            <Textarea placeholder="وصف الخدمة..." dir="rtl" rows={3} {...register('descriptionAr')} />
          </FormField>
          <FormField label="الوصف بالإنجليزية">
            <Textarea placeholder="Service description..." dir="ltr" rows={3} {...register('descriptionEn')} />
          </FormField>
        </div>
      </FormSection>

      {/* Status */}
      <FormToggle label="نشطة" description="تظهر الخدمة في الكتالوج وتقبل الحجوزات">
        <Switch
          checked={isActive ?? true}
          onCheckedChange={(v) => setValue('isActive', v)}
        />
      </FormToggle>
    </FormShell>
  )
}

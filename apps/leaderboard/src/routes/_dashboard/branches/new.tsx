import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateBranchPayload } from '@carekit/api-client'
import { useCreateBranch } from '@/hooks/use-branches'
import {
  createBranchSchema,
  type CreateBranchFormValues,
} from '@/lib/schemas/branch.schema'
import { FormShell, FormField, FormSection, FormToggle } from '@/components/shared/form-shell'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export const Route = createFileRoute('/_dashboard/branches/new')({
  component: NewBranchPage,
})

function NewBranchPage() {
  const navigate = useNavigate()
  const mutation = useCreateBranch()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateBranchFormValues>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: {
      nameAr: '',
      nameEn: '',
      address: '',
      phone: '',
      email: '',
      timezone: '',
      isMain: false,
      isActive: true,
    },
  })

  const isMain = watch('isMain')
  const isActive = watch('isActive')

  const onSubmit = handleSubmit((values) => {
    const payload: CreateBranchPayload = {
      nameAr: values.nameAr,
      nameEn: values.nameEn,
      address: values.address?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() || undefined,
      timezone: values.timezone?.trim() || undefined,
      isMain: values.isMain,
      isActive: values.isActive,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/branches' }),
    })
  })

  return (
    <FormShell
      title="فرع جديد"
      description="إضافة فرع جديد للعيادة"
      backTo="/branches"
      submitLabel="إنشاء الفرع"
      isPending={mutation.isPending}
      error={(mutation.error as Error)?.message}
      onSubmit={onSubmit}
    >
      {/* Names */}
      <FormSection label="اسم الفرع">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الاسم بالعربية" required error={errors.nameAr?.message}>
            <Input placeholder="الفرع الرئيسي" dir="rtl" {...register('nameAr')} />
          </FormField>
          <FormField label="الاسم بالإنجليزية" required error={errors.nameEn?.message}>
            <Input placeholder="Main Branch" dir="ltr" {...register('nameEn')} />
          </FormField>
        </div>
      </FormSection>

      {/* Contact */}
      <FormSection label="معلومات التواصل" description="اختياري">
        <FormField label="العنوان">
          <Input placeholder="الرياض، حي النزهة..." {...register('address')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="رقم الهاتف" error={errors.phone?.message}>
            <Input placeholder="+966..." dir="ltr" {...register('phone')} />
          </FormField>
          <FormField label="البريد الإلكتروني" error={errors.email?.message}>
            <Input type="email" placeholder="branch@clinic.com" dir="ltr" {...register('email')} />
          </FormField>
        </div>
        <FormField label="المنطقة الزمنية" hint="مثال: Asia/Riyadh">
          <Input placeholder="Asia/Riyadh" dir="ltr" {...register('timezone')} />
        </FormField>
      </FormSection>

      {/* Settings */}
      <FormSection label="إعدادات الفرع">
        <FormToggle label="فرع رئيسي" description="يُعرض كفرع افتراضي للعيادة">
          <Switch
            checked={isMain ?? false}
            onCheckedChange={(v) => setValue('isMain', v)}
          />
        </FormToggle>
        <FormToggle label="نشط" description="يقبل الحجوزات ويظهر للمرضى">
          <Switch
            checked={isActive ?? true}
            onCheckedChange={(v) => setValue('isActive', v)}
          />
        </FormToggle>
      </FormSection>
    </FormShell>
  )
}

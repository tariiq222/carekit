import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateWalkInPayload } from '@carekit/api-client'
import { useCreateWalkIn } from '@/hooks/use-patients'
import {
  createWalkInSchema,
  type CreateWalkInFormValues,
} from '@/lib/schemas/patient.schema'
import { FormShell, FormField, FormSection, FormToggle } from '@/components/shared/form-shell'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export const Route = createFileRoute('/_dashboard/patients/new')({
  component: NewPatientPage,
})

function NewPatientPage() {
  const navigate = useNavigate()
  const mutation = useCreateWalkIn()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateWalkInFormValues>({
    resolver: zodResolver(createWalkInSchema),
    defaultValues: { firstName: '', lastName: '', phone: '', dateOfBirth: '' },
  })

  const genderValue = watch('gender')

  const onSubmit = handleSubmit((values) => {
    const payload: CreateWalkInPayload = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone?.trim() || undefined,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth?.trim() || undefined,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/patients' }),
    })
  })

  return (
    <FormShell
      title="مريض جديد"
      description="تسجيل مريض حضور مباشر"
      backTo="/patients"
      submitLabel="تسجيل المريض"
      isPending={mutation.isPending}
      error={(mutation.error as Error)?.message}
      onSubmit={onSubmit}
    >
      {/* Name */}
      <FormSection label="الاسم الكامل">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="الاسم الأول" required error={errors.firstName?.message}>
            <Input placeholder="محمد" {...register('firstName')} />
          </FormField>
          <FormField label="اسم العائلة" required error={errors.lastName?.message}>
            <Input placeholder="العمري" {...register('lastName')} />
          </FormField>
        </div>
      </FormSection>

      {/* Contact & Info */}
      <FormSection label="البيانات الشخصية">
        <FormField
          label="رقم الجوال"
          error={errors.phone?.message}
          hint="اختياري — +966xxxxxxxxx"
        >
          <Input placeholder="+966500000000" dir="ltr" {...register('phone')} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="الجنس" error={errors.gender?.message}>
            <Select
              value={genderValue ?? ''}
              onValueChange={(v) => setValue('gender', v as 'male' | 'female')}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">ذكر</SelectItem>
                <SelectItem value="female">أنثى</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="تاريخ الميلاد" error={errors.dateOfBirth?.message}>
            <Input type="date" {...register('dateOfBirth')} />
          </FormField>
        </div>
      </FormSection>
    </FormShell>
  )
}

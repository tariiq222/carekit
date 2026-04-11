import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreatePractitionerPayload } from '@carekit/api-client'
import { useCreatePractitioner } from '@/hooks/use-practitioners'
import { useSpecialties } from '@/hooks/use-specialties'
import { useUsers } from '@/hooks/use-users'
import {
  createPractitionerSchema,
  type CreatePractitionerFormValues,
} from '@/lib/schemas/practitioner.schema'
import { FormShell, FormField, FormSection } from '@/components/shared/form-shell'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_dashboard/practitioners/new')({
  component: NewPractitionerPage,
})

function NewPractitionerPage() {
  const navigate = useNavigate()
  const mutation = useCreatePractitioner()
  const { data: specialtiesData } = useSpecialties()
  const { data: usersData } = useUsers({ perPage: 200 })

  const specialtyOptions = (specialtiesData ?? []).map((s) => ({ id: s.id, label: s.nameAr }))
  const userOptions = (usersData?.items ?? []).map((u) => ({
    id: u.id,
    label: `${u.firstName} ${u.lastName} — ${u.email}`,
  }))

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePractitionerFormValues>({
    resolver: zodResolver(createPractitionerSchema),
    defaultValues: { experience: 0 },
  })

  const onSubmit = handleSubmit(async (values) => {
    const payload: CreatePractitionerPayload = {
      userId: values.userId,
      specialtyId: values.specialtyId,
      experience: values.experience,
      bio: values.bio?.trim() || undefined,
      bioAr: values.bioAr?.trim() || undefined,
    }
    await mutation.mutateAsync(payload)
    navigate({ to: '/practitioners' })
  })

  return (
    <FormShell
      title="ممارس جديد"
      description="ربط مستخدم موجود بملف ممارس صحي"
      backTo="/practitioners"
      submitLabel="إضافة الممارس"
      isPending={mutation.isPending}
      error={(mutation.error as Error)?.message}
      onSubmit={onSubmit}
    >
      {/* Identity */}
      <FormSection label="الهوية">
        <FormField label="المستخدم" required error={errors.userId?.message}>
          <Select
            value={watch('userId') ?? ''}
            onValueChange={(v) => setValue('userId', v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر مستخدماً..." />
            </SelectTrigger>
            <SelectContent>
              {userOptions.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="التخصص" required error={errors.specialtyId?.message}>
          <Select
            value={watch('specialtyId') ?? ''}
            onValueChange={(v) => setValue('specialtyId', v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر تخصصاً..." />
            </SelectTrigger>
            <SelectContent>
              {specialtyOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>

      {/* Experience */}
      <FormSection label="الخبرة">
        <FormField
          label="سنوات الخبرة"
          required
          error={errors.experience?.message}
          hint="من 0 إلى 50 سنة"
        >
          <Input
            type="number"
            min={0}
            max={50}
            placeholder="5"
            className="max-w-[120px]"
            {...register('experience', { valueAsNumber: true })}
          />
        </FormField>
      </FormSection>

      {/* Bio */}
      <FormSection label="النبذة التعريفية" description="اختياري — تظهر لدى المرضى">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="النبذة بالعربية" error={errors.bioAr?.message}>
            <Textarea
              placeholder="طبيب متخصص في..."
              dir="rtl"
              rows={4}
              {...register('bioAr')}
            />
          </FormField>
          <FormField label="النبذة بالإنجليزية" error={errors.bio?.message}>
            <Textarea
              placeholder="Specialist in..."
              dir="ltr"
              rows={4}
              {...register('bio')}
            />
          </FormField>
        </div>
      </FormSection>
    </FormShell>
  )
}

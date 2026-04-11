import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UpdatePatientPayload } from '@carekit/api-client'
import { usePatient, useUpdatePatient } from '@/hooks/use-patients'
import {
  updatePatientSchema,
  type UpdatePatientFormValues,
} from '@/lib/schemas/patient.schema'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_dashboard/patients/$id')({
  component: PatientDetailPage,
})

function PatientDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: patient, isLoading } = usePatient(id)
  const mutation = useUpdatePatient(id)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UpdatePatientFormValues>({
    resolver: zodResolver(updatePatientSchema),
    values: {
      firstName: patient?.firstName,
      lastName: patient?.lastName,
      phone: patient?.phone ?? '',
      email: patient?.email ?? '',
      gender: patient?.gender ?? undefined,
      dateOfBirth: patient?.dateOfBirth ?? '',
    },
  })

  if (isLoading) {
    return <SkeletonPage />
  }

  if (!patient) {
    return <p className="text-[var(--muted)] p-6">المريض غير موجود</p>
  }

  const onSubmit = (values: UpdatePatientFormValues) => {
    const payload: UpdatePatientPayload = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone?.trim() ? values.phone : undefined,
      email: values.email?.trim() ? values.email : undefined,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth?.trim() ? values.dateOfBirth : undefined,
    }
    mutation.mutate(payload, {
      onSuccess: () => navigate({ to: '/patients' }),
    })
  }

  const errorClass = 'text-xs text-[var(--error,#dc2626)] mt-1'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        description={`${patient.totalBookings} حجز`}
        actions={
          <Link to="/patients">
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">الاسم الأول</Label>
            <Input id="firstName" {...register('firstName')} />
            {errors.firstName && (
              <p className={errorClass}>{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="lastName">اسم العائلة</Label>
            <Input id="lastName" {...register('lastName')} />
            {errors.lastName && (
              <p className={errorClass}>{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="phone">الهاتف</Label>
          <Input id="phone" placeholder="+966..." {...register('phone')} />
          {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
        </div>

        <div>
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className={errorClass}>{errors.email.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>الجنس</Label>
            <Select
              defaultValue={patient.gender ?? undefined}
              onValueChange={(v) =>
                setValue('gender', v as 'male' | 'female')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">ذكر</SelectItem>
                <SelectItem value="female">أنثى</SelectItem>
              </SelectContent>
            </Select>
            {errors.gender && (
              <p className={errorClass}>{errors.gender.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="dateOfBirth">تاريخ الميلاد</Label>
            <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
            {errors.dateOfBirth && (
              <p className={errorClass}>{errors.dateOfBirth.message}</p>
            )}
          </div>
        </div>

        {mutation.isError && (
          <p className={errorClass}>
            {(mutation.error as Error)?.message ?? 'حدث خطأ غير متوقع'}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/patients' })}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

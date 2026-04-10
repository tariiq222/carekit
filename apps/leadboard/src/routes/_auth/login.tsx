import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLogin } from '@/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth.store'

const schema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
})
type FormValues = z.infer<typeof schema>

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
})

function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/" replace />

  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormValues) => login.mutate(data)

  return (
    <div className="min-h-screen flex items-center justify-center relative z-10">
      <div className="glass rounded-[var(--radius-lg)] p-8 w-full max-w-sm shadow-lg">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--primary)] flex items-center justify-center mx-auto mb-4">
            <i className="hgi hgi-clinic text-white text-xl" />
          </div>
          <h1 className="text-xl font-bold text-[var(--fg)]">تسجيل الدخول</h1>
          <p className="text-sm text-[var(--muted)] mt-1">مرحباً بك في لوحة التحكم</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--fg-2)] mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              placeholder="admin@clinic.com"
            />
            {errors.email && (
              <p className="text-xs text-[var(--error)] mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--fg-2)] mb-1.5">
              كلمة المرور
            </label>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-xs text-[var(--error)] mt-1">{errors.password.message}</p>
            )}
          </div>

          {login.isError && (
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--error-bg)] border border-[var(--error-border)]">
              <p className="text-xs text-[var(--error)]">
                {login.error instanceof Error ? login.error.message : 'حدث خطأ، حاول مرة أخرى'}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full h-10 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-dark)] disabled:opacity-60 transition-colors"
          >
            {login.isPending ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  )
}

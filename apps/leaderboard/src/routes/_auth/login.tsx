import { useState } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { whitelabelApi } from '@carekit/api-client'
import {
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  CalendarCheck2,
  Activity,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useLogin } from '@/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  remember: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
})

function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/" replace />

  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const { data: whitelabel } = useQuery({
    queryKey: ['whitelabel', 'public'],
    queryFn: () => whitelabelApi.getWhitelabelConfig(),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormValues) => login.mutate(data)
  const devLogin = () =>
    login.mutate({ email: 'admin@carekit-test.com', password: 'Adm!nP@ss123' })

  const clinicName = whitelabel?.clinicNameAr || whitelabel?.clinicName || 'CareKit'
  const logoUrl = whitelabel?.logoUrl

  return (
    <div className="min-h-screen w-full flex relative z-10">
      {/* Brand panel — hidden on mobile, shows on lg+ */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-[#1a2a8a]" />
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(ellipse_60%_50%_at_20%_20%,rgba(130,204,23,0.25),transparent_60%),radial-gradient(ellipse_50%_50%_at_80%_80%,rgba(91,114,232,0.35),transparent_65%)]" />
        <div className="absolute -top-24 -start-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -end-16 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full text-white">
          {/* Logo + clinic name */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center overflow-hidden shadow-lg">
              {logoUrl ? (
                <img src={logoUrl} alt={clinicName} className="h-10 w-10 object-contain" />
              ) : (
                <Activity className="h-6 w-6 text-white" />
              )}
            </div>
            <div className="leading-tight">
              <div className="text-lg font-semibold">{clinicName}</div>
              <div className="text-xs text-white/70">لوحة التحكم</div>
            </div>
          </div>

          {/* Hero content */}
          <div className="space-y-8 max-w-md">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              نظام إدارة العيادة الذكي
            </div>
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
              أدر عيادتك
              <br />
              <span className="bg-gradient-to-r from-white to-accent bg-clip-text text-transparent">
                بذكاء وأناقة
              </span>
            </h2>
            <p className="text-base text-white/75 leading-relaxed">
              منصة متكاملة لإدارة الحجوزات، المرضى، المدفوعات والتقارير — في مكان واحد
              بواجهة حديثة وسرعة استثنائية.
            </p>

            <ul className="space-y-3 pt-2">
              {[
                { icon: CalendarCheck2, text: 'حجوزات لحظية وجدولة ذكية' },
                { icon: ShieldCheck, text: 'أمان على مستوى المؤسسات' },
                { icon: Activity, text: 'تقارير وتحليلات في الوقت الحقيقي' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                  <span className="h-8 w-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-accent" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="text-xs text-white/60">
            © {new Date().getFullYear()} {clinicName} — جميع الحقوق محفوظة
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center overflow-hidden shadow-lg shadow-primary/25">
              {logoUrl ? (
                <img src={logoUrl} alt={clinicName} className="h-12 w-12 object-contain" />
              ) : (
                <Activity className="h-7 w-7 text-white" />
              )}
            </div>
            <div className="mt-3 text-base font-semibold text-foreground">{clinicName}</div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              تسجيل الدخول
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              مرحباً بعودتك، سجّل الدخول للمتابعة إلى لوحة التحكم
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                البريد الإلكتروني
              </Label>
              <div className="relative" dir="ltr">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="admin@clinic.com"
                  className="ps-10 h-11"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-error mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  كلمة المرور
                </Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:text-primary-dark transition-colors cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative" dir="ltr">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="ps-10 pe-10 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute end-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-sm"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-error mt-1">{errors.password.message}</p>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                {...register('remember')}
                className="h-4 w-4 rounded-sm border border-border-mid accent-primary cursor-pointer"
              />
              <span className="text-sm text-foreground-2">تذكرني</span>
            </label>

            {login.isError && (
              <div className="p-3 rounded-md bg-error-bg border border-error-border">
                <p className="text-xs text-error">
                  {login.error instanceof Error
                    ? login.error.message
                    : 'حدث خطأ، حاول مرة أخرى'}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={login.isPending}
              className="w-full h-11 text-sm font-semibold cursor-pointer shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
            >
              {login.isPending ? 'جاري الدخول...' : 'دخول'}
            </Button>

            {import.meta.env.DEV && (
              <Button
                type="button"
                variant="outline"
                onClick={devLogin}
                disabled={login.isPending}
                className="w-full h-10 text-xs border-dashed cursor-pointer"
              >
                دخول كسوبر أدمن (تطوير)
              </Button>
            )}
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            بتسجيل الدخول، أنت توافق على{' '}
            <a className="text-primary hover:underline cursor-pointer">شروط الاستخدام</a>{' '}
            و{' '}
            <a className="text-primary hover:underline cursor-pointer">سياسة الخصوصية</a>
          </p>
        </div>
      </main>
    </div>
  )
}

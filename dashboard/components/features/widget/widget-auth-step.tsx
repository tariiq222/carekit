"use client"

/**
 * Widget Auth Step — Inline patient login / register
 *
 * Uses the existing AuthProvider context.
 * If already authenticated, auto-advances to next step.
 */

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/providers/auth-provider"
import { widgetLogin, widgetRegister } from "@/lib/api/widget"
import { setAccessToken } from "@/lib/api"

type AuthMode = "login" | "register"

/* ─── Schemas ─── */

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(9),
  password: z.string().min(8),
})

type LoginFields = z.infer<typeof loginSchema>
type RegisterFields = z.infer<typeof registerSchema>

/* ─── Props ─── */

interface Props {
  locale: "ar" | "en"
  onAuthComplete: () => void
}

export function WidgetAuthStep({ locale, onAuthComplete }: Props) {
  const { isAuthenticated, loading } = useAuth()
  const [mode, setMode] = useState<AuthMode>("login")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRtl = locale === "ar"

  /* ─── If already logged in, skip ─── */
  useEffect(() => {
    if (!loading && isAuthenticated) {
      onAuthComplete()
    }
  }, [isAuthenticated, loading, onAuthComplete])

  /* ─── Login form ─── */
  const loginForm = useForm<LoginFields>({ resolver: zodResolver(loginSchema) })
  const registerForm = useForm<RegisterFields>({ resolver: zodResolver(registerSchema) })

  async function handleLogin(data: LoginFields) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await widgetLogin(data.email, data.password)
      setAccessToken(res.accessToken)
      onAuthComplete()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(isRtl ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegister(data: RegisterFields) {
    setSubmitting(true)
    setError(null)
    try {
      await widgetRegister(data)
      onAuthComplete()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(isRtl ? "حدث خطأ أثناء إنشاء الحساب" : msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isRtl
          ? "سجّل دخولك لإكمال الحجز"
          : "Sign in to complete your booking"}
      </p>

      {/* Mode tabs */}
      <div className="flex rounded-xl overflow-hidden border border-border/60 p-0.5 gap-0.5 bg-muted/30">
        {(["login", "register"] as AuthMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === m
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "login"
              ? isRtl ? "دخول" : "Sign In"
              : isRtl ? "حساب جديد" : "Register"}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Login form */}
      {mode === "login" && (
        <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{isRtl ? "البريد الإلكتروني" : "Email"}</Label>
            <Input
              type="email"
              autoComplete="email"
              dir="ltr"
              {...loginForm.register("email")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isRtl ? "كلمة المرور" : "Password"}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                dir="ltr"
                {...loginForm.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 end-3 flex items-center text-muted-foreground"
              >
                <HugeiconsIcon icon={showPassword ? ViewOffSlashIcon : ViewIcon} size={16} />
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <HugeiconsIcon icon={Loading03Icon} size={16} className="me-2" />}
            {isRtl ? "دخول" : "Sign In"}
          </Button>
        </form>
      )}

      {/* Register form */}
      {mode === "register" && (
        <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{isRtl ? "الاسم الأول" : "First Name"}</Label>
              <Input {...registerForm.register("firstName")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isRtl ? "الاسم الأخير" : "Last Name"}</Label>
              <Input {...registerForm.register("lastName")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isRtl ? "البريد الإلكتروني" : "Email"}</Label>
            <Input type="email" dir="ltr" {...registerForm.register("email")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isRtl ? "رقم الجوال" : "Phone"}</Label>
            <Input type="tel" dir="ltr" {...registerForm.register("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isRtl ? "كلمة المرور" : "Password"}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                dir="ltr"
                {...registerForm.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 end-3 flex items-center text-muted-foreground"
              >
                <HugeiconsIcon icon={showPassword ? ViewOffSlashIcon : ViewIcon} size={16} />
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <HugeiconsIcon icon={Loading03Icon} size={16} className="me-2" />}
            {isRtl ? "إنشاء حساب" : "Create Account"}
          </Button>
        </form>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState, useRef } from "react"
import type HCaptcha from "@hcaptcha/react-hcaptcha"
import { Button } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"
import { CaptchaField } from "@/components/features/shared/captcha-field"
import { HugeiconsIcon } from "@hugeicons/react"
import { EyeIcon, ScanEyeIcon } from "@hugeicons/core-free-icons"

export function LoginForm() {
  const { t } = useLocale()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)
  const captchaRef = useRef<HCaptcha>(null)

  useEffect(() => {
    const reason = sessionStorage.getItem("carekit_auth_reason")
    if (reason === "ORG_SUSPENDED") {
      setNotice(t("login.orgSuspended"))
      sessionStorage.removeItem("carekit_auth_reason")
    }
  }, [t])

  const isDev = process.env.NODE_ENV === "development"
  const devEmail = process.env.NEXT_PUBLIC_DEV_EMAIL
  const devPassword = process.env.NEXT_PUBLIC_DEV_PASSWORD
  const showDevLogin = isDev && devEmail && devPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hcaptchaToken) return
    setError("")
    setLoading(true)
    try {
      await login(email, password, hcaptchaToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials")
      captchaRef.current?.resetCaptcha()
      setHcaptchaToken(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDevLogin = async () => {
    setError("")
    setLoading(true)
    try {
      await login(devEmail!, devPassword!, hcaptchaToken ?? "dev-token")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dev login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">

      {/* Card */}
      <div
        className="login-card relative z-10 w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-card"
      >
        {/* Grid pattern — top section inside card only */}
        <div aria-hidden className="login-grid-pattern pointer-events-none absolute inset-x-0 top-0 h-72" />
        {/* Blob — top center inside card */}
        <div aria-hidden className="login-blob pointer-events-none absolute inset-x-0 top-0 h-72" />

        <div className="relative p-8">
        {/* Logo + heading */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">

          {/* Brand icon */}
          <div className="login-brand-icon flex h-14 w-14 items-center justify-center rounded-2xl">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
              {/* Cloud-like logo shape */}
              <path
                d="M22 18H8a5 5 0 1 1 .93-9.9 7 7 0 0 1 13.56 2.26A4.5 4.5 0 1 1 22 18z"
                fill="white"
                fillOpacity="0.95"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("login.welcome")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("login.subtitle")}
            </p>
          </div>
        </div>

        {/* Notice (e.g. suspended organization) */}
        {notice && !error && (
          <div className="mb-4 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            {notice}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              {t("login.emailLabel")}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="h-11 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              {t("login.passwordLabel")}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="h-11 pe-11 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
              >
                <HugeiconsIcon
                  icon={showPassword ? ScanEyeIcon : EyeIcon}
                  size={18}
                />
              </button>
            </div>
          </div>

          <div className="flex justify-center py-2">
            <CaptchaField
              ref={captchaRef}
              onVerify={(token) => setHcaptchaToken(token)}
              onExpire={() => setHcaptchaToken(null)}
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !hcaptchaToken}
            className="mt-1 h-11 w-full text-sm font-semibold shadow-primary"
          >
            {loading ? t("login.signingIn") : t("login.signIn")}
          </Button>

          {showDevLogin && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleDevLogin}
              className="h-10 w-full text-sm"
            >
              Dev Admin Login
            </Button>
          )}
        </form>
        </div>
      </div>
    </div>
  )
}

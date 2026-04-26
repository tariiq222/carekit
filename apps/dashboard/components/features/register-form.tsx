"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Input, Label } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { registerTenant } from "@/lib/api/auth"
import { registerSchema, type RegisterFormValues } from "@/lib/schemas/register.schema"

export function RegisterForm() {
  const { t } = useLocale()
  const { loginWithTokens } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError("")
    try {
      const res = await registerTenant(values)
      loginWithTokens(res)
      router.push("/onboarding")
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.toLowerCase().includes("already")) {
        setServerError(t("register.error.emailTaken"))
      } else {
        setServerError(t("register.error.generic"))
      }
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <h1 className="mb-1 text-2xl font-bold text-foreground">{t("register.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("register.subtitle")}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Name */}
        <div className="space-y-1">
          <Label htmlFor="name">{t("register.fields.name")}</Label>
          <Input id="name" {...register("name")} autoComplete="name" />
          {errors.name && <p className="text-xs text-error">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <Label htmlFor="email">{t("register.fields.email")}</Label>
          <Input id="email" type="email" {...register("email")} autoComplete="email" />
          {errors.email && <p className="text-xs text-error">{errors.email.message}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <Label htmlFor="phone">{t("register.fields.phone")}</Label>
          <Input id="phone" type="tel" {...register("phone")} autoComplete="tel" />
          {errors.phone && <p className="text-xs text-error">{errors.phone.message}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <Label htmlFor="password">{t("register.fields.password")}</Label>
          <Input id="password" type="password" {...register("password")} autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">{t("register.fields.passwordHint")}</p>
          {errors.password && <p className="text-xs text-error">{errors.password.message}</p>}
        </div>

        {/* Business Name AR */}
        <div className="space-y-1">
          <Label htmlFor="businessNameAr">{t("register.fields.businessNameAr")}</Label>
          <Input id="businessNameAr" {...register("businessNameAr")} />
          {errors.businessNameAr && <p className="text-xs text-error">{errors.businessNameAr.message}</p>}
        </div>

        {/* Business Name EN */}
        <div className="space-y-1">
          <Label htmlFor="businessNameEn">{t("register.fields.businessNameEn")}</Label>
          <Input id="businessNameEn" {...register("businessNameEn")} />
        </div>

        {serverError && <p className="text-sm text-error">{serverError}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("register.loading") : t("register.cta")}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          {t("register.signIn")}
        </Link>
      </p>
    </div>
  )
}

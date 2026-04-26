"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { OnboardingStep1Business, type Step1Data } from "@/components/features/onboarding/onboarding-step-1-business"
import { OnboardingStep2Branding, type Step2Data } from "@/components/features/onboarding/onboarding-step-2-branding"
import { OnboardingStep3Branch, defaultStep3Data, type Step3Data } from "@/components/features/onboarding/onboarding-step-3-branch"
import { OnboardingStep4Confirm } from "@/components/features/onboarding/onboarding-step-4-confirm"
import { getAccessToken } from "@/lib/api"
import { useLocale } from "@/components/locale-provider"

const API = process.env.NEXT_PUBLIC_API_URL

async function call(path: string, init: RequestInit) {
  const res = await fetch(`${API}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${res.status} ${path}: ${text || res.statusText}`)
  }
  return res
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useLocale()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const [step1, setStep1] = useState<Step1Data>({ businessNameAr: "", businessNameEn: "", verticalSlug: "" })
  const [step2, setStep2] = useState<Step2Data>({ primaryColor: "#354FD8", logoUrl: "" })
  const [step3, setStep3] = useState<Step3Data>(defaultStep3Data)

  useEffect(() => {
    if (!user) router.replace("/")
  }, [user, router])

  if (!user) return null

  const authHeader = {
    Authorization: `Bearer ${getAccessToken() ?? ""}`,
    "Content-Type": "application/json",
  }

  const handleStep1Next = async () => {
    setIsLoading(true)
    setError("")
    try {
      await call(`/api/v1/dashboard/organization/branding`, {
        method: "POST",
        headers: authHeader,
        credentials: "include",
        body: JSON.stringify({
          organizationNameAr: step1.businessNameAr,
          organizationNameEn: step1.businessNameEn || undefined,
        }),
      })
      if (step1.verticalSlug) {
        await call(`/api/v1/dashboard/organization/seed-vertical`, {
          method: "POST",
          headers: authHeader,
          credentials: "include",
          body: JSON.stringify({ verticalSlug: step1.verticalSlug }),
        })
      }
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.error.generic"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStep2Next = async () => {
    setIsLoading(true)
    setError("")
    try {
      await call(`/api/v1/dashboard/organization/branding`, {
        method: "POST",
        headers: authHeader,
        credentials: "include",
        body: JSON.stringify({
          organizationNameAr: step1.businessNameAr,
          organizationNameEn: step1.businessNameEn || undefined,
          colorPrimary: step2.primaryColor,
          logoUrl: step2.logoUrl || undefined,
        }),
      })
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.error.generic"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStep3Next = async () => {
    setIsLoading(true)
    setError("")
    try {
      const branchRes = await call(`/api/v1/dashboard/organization/branches`, {
        method: "POST",
        headers: authHeader,
        credentials: "include",
        body: JSON.stringify({ nameAr: step3.branchName, city: step3.city, isMain: true }),
      })
      const branch = (await branchRes.json()) as { id: string }
      const items = Object.entries(step3.hours)
        .filter(([, h]) => h.enabled)
        .map(([day, h]) => ({ dayOfWeek: Number(day), startTime: h.open, endTime: h.close, isClosed: false }))
      if (items.length > 0) {
        await call(`/api/v1/dashboard/organization/hours`, {
          method: "POST",
          headers: authHeader,
          credentials: "include",
          body: JSON.stringify({ branchId: branch.id, items }),
        })
      }
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.error.generic"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStart = async () => {
    setIsLoading(true)
    setError("")
    try {
      await call(`/api/v1/dashboard/organization/mark-onboarded`, {
        method: "PATCH",
        headers: authHeader,
        credentials: "include",
      })
      router.push("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.error.generic"))
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-2 w-8 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {error && (
            <div className="mb-4 rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">
              {error}
            </div>
          )}
          {step === 1 && (
            <OnboardingStep1Business data={step1} onChange={setStep1} onNext={handleStep1Next} />
          )}
          {step === 2 && (
            <OnboardingStep2Branding data={step2} onChange={setStep2} onNext={handleStep2Next} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <OnboardingStep3Branch data={step3} onChange={setStep3} onNext={handleStep3Next} onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <OnboardingStep4Confirm onStart={handleStart} onBack={() => setStep(3)} isLoading={isLoading} />
          )}
        </div>
      </div>
    </main>
  )
}

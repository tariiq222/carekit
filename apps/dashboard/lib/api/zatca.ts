/**
 * ZATCA API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  ZatcaConfig,
  OnboardingStatus,
  SandboxStats,
  ZatcaOnboardPayload,
} from "@/lib/types/zatca"

// TODO: no backend endpoint in dashboard controllers — needs dashboard/zatca controller
export async function fetchZatcaConfig(): Promise<ZatcaConfig> {
  return api.get<ZatcaConfig>("/zatca/config")
}

// TODO: no backend endpoint in dashboard controllers — needs dashboard/zatca controller
export async function onboardZatca(
  payload: ZatcaOnboardPayload,
): Promise<unknown> {
  return api.post<unknown>("/zatca/onboard", payload)
}

// TODO: no backend endpoint in dashboard controllers — needs dashboard/zatca controller
export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  return api.get<OnboardingStatus>(
    "/zatca/onboarding/status",
  )
}

// TODO: no backend endpoint in dashboard controllers — needs dashboard/zatca controller
export async function fetchSandboxStats(): Promise<SandboxStats> {
  return api.get<SandboxStats>("/zatca/sandbox/stats")
}

// TODO: no backend endpoint in dashboard controllers — needs dashboard/zatca controller
export async function reportToSandbox(invoiceId: string): Promise<unknown> {
  return api.post<unknown>(
    `/zatca/sandbox/report/${invoiceId}`,
  )
}

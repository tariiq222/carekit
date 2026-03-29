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

export async function fetchZatcaConfig(): Promise<ZatcaConfig> {
  return api.get<ZatcaConfig>("/zatca/config")
}

export async function onboardZatca(
  payload: ZatcaOnboardPayload,
): Promise<unknown> {
  return api.post<unknown>("/zatca/onboard", payload)
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  return api.get<OnboardingStatus>(
    "/zatca/onboarding/status",
  )
}

export async function fetchSandboxStats(): Promise<SandboxStats> {
  return api.get<SandboxStats>("/zatca/sandbox/stats")
}

export async function reportToSandbox(invoiceId: string): Promise<unknown> {
  return api.post<unknown>(
    `/zatca/sandbox/report/${invoiceId}`,
  )
}

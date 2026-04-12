/**
 * ZATCA API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  ZatcaConfig,
  ZatcaOnboardPayload,
} from "@/lib/types/zatca"

export async function fetchZatcaConfig(): Promise<ZatcaConfig> {
  return api.get<ZatcaConfig>("/dashboard/finance/zatca/config")
}

export async function onboardZatca(
  payload: ZatcaOnboardPayload,
): Promise<ZatcaConfig> {
  return api.post<ZatcaConfig>("/dashboard/finance/zatca/onboard", payload)
}

export async function fetchOnboardingStatus(): Promise<ZatcaConfig> {
  return api.get<ZatcaConfig>("/dashboard/finance/zatca/config")
}

export async function reportToSandbox(invoiceId: string): Promise<unknown> {
  return api.post<unknown>("/dashboard/finance/zatca/submit", { invoiceId })
}

/**
 * Clinic Integrations API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  ClinicIntegrations,
  UpdateClinicIntegrationsPayload,
} from "@/lib/types/clinic-integrations"

/* ─── Queries ─── */

export async function fetchClinicIntegrations(): Promise<ClinicIntegrations> {
  return api.get<ClinicIntegrations>("/clinic-integrations")
}

/* ─── Mutations ─── */

export async function updateClinicIntegrations(
  data: UpdateClinicIntegrationsPayload,
): Promise<ClinicIntegrations> {
  return api.put<ClinicIntegrations>("/clinic-integrations", data)
}

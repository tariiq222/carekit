/**
 * Clinic Integrations API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  OrganizationIntegrations,
  UpdateOrganizationIntegrationsPayload,
} from "@/lib/types/organization-integrations"

/* ─── Queries ─── */

export async function fetchOrganizationIntegrations(): Promise<OrganizationIntegrations> {
  return api.get<OrganizationIntegrations>("/dashboard/platform/integrations")
}

/* ─── Mutations ─── */

export async function updateOrganizationIntegrations(
  data: UpdateOrganizationIntegrationsPayload,
): Promise<OrganizationIntegrations> {
  return api.post<OrganizationIntegrations>("/dashboard/platform/integrations", data)
}

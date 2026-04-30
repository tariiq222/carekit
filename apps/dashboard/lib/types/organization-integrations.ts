/**
 * Organization Integrations Types — Deqah Dashboard
 */

export interface OrganizationIntegrations {
  id: string
  moyasarPublishableKey: string | null
  moyasarSecretKey: string | null
  bankName: string | null
  bankIban: string | null
  bankAccountHolder: string | null
  zoomClientId: string | null
  zoomClientSecret: string | null
  zoomAccountId: string | null
  emailProvider: string | null
  emailApiKey: string | null
  emailFrom: string | null
  openrouterApiKey: string | null
  firebaseConfig: Record<string, unknown> | null
  zatcaPhase: string
  zatcaCsid: string | null
  zatcaSecret: string | null
  zatcaPrivateKey: string | null
  zatcaRequestId: string | null
  createdAt: string
  updatedAt: string
}

export type UpdateOrganizationIntegrationsPayload = Partial<
  Omit<OrganizationIntegrations, "id" | "createdAt" | "updatedAt">
>

import { useMemberships, type Membership } from "@/hooks/use-memberships"

/**
 * Returns the currently active organization (the first membership,
 * which matches the JWT's organizationId as returned by the backend).
 */
export function useCurrentOrganization(): Membership | undefined {
  const { data: memberships } = useMemberships()
  return memberships?.[0]
}

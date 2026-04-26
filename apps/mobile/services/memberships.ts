import api from './api';

/**
 * Mirrors the backend `MembershipSummary` shape returned by
 * `GET /auth/memberships` (apps/backend/src/modules/identity/list-memberships).
 */
export interface MembershipSummary {
  id: string;
  organizationId: string;
  role: string;
  isActive: boolean;
  organization: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    status: string;
  };
}

/**
 * Token pair returned by `POST /auth/switch-org`. The backend extends the
 * raw `TokenPair` with `expiresIn` (seconds) computed from
 * `JWT_ACCESS_TTL`.
 */
export interface SwitchOrgTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const membershipsService = {
  async list(): Promise<MembershipSummary[]> {
    const { data } = await api.get<MembershipSummary[]>('/auth/memberships');
    return data;
  },

  async switchOrganization(organizationId: string): Promise<SwitchOrgTokens> {
    const { data } = await api.post<SwitchOrgTokens>('/auth/switch-org', {
      organizationId,
    });
    return data;
  },
};

/** Backwards-compatible function exports for direct callers. */
export const listMemberships = (): Promise<MembershipSummary[]> =>
  membershipsService.list();
export const switchOrganization = (
  organizationId: string,
): Promise<SwitchOrgTokens> => membershipsService.switchOrganization(organizationId);

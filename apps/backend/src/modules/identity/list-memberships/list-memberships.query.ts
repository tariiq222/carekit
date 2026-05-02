export interface ListMembershipsQuery {
  userId: string;
}

export interface MembershipSummary {
  id: string;
  organizationId: string;
  role: string;
  isActive: boolean;
  // Per-membership display profile (overrides User defaults within this org).
  displayName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  organization: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    status: string;
  };
}

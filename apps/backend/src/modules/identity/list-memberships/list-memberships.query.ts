export interface ListMembershipsQuery {
  userId: string;
}

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

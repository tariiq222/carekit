// Shared types for the organizations feature cluster. Each slice imports
// only what it needs.

export interface OrganizationRow {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  status: string;
  verticalId: string | null;
  trialEndsAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  subscription: {
    status: string;
    plan: { slug: string; nameEn: string };
  } | null;
}

export interface OrganizationDetail extends OrganizationRow {
  stats: {
    memberCount: number;
    bookingCount30d: number;
    totalRevenue: number | string;
  };
}

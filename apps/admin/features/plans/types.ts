export interface PlanRow {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  priceMonthly: string | number;
  priceAnnual: string | number;
  currency: string;
  isActive: boolean;
  isVisible: boolean;
  sortOrder: number;
  limits: Record<string, unknown>;
  createdAt: string;
  _count: { subscriptions: number };
}

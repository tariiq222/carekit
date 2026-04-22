export interface VerticalRow {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  templateFamily: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  iconUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

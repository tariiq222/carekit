export interface CreateCategoryDto {
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  departmentId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryDto {
  tenantId: string;
  categoryId: string;
  nameAr?: string;
  nameEn?: string;
  departmentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ListCategoriesDto {
  tenantId: string;
  departmentId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface GetCategoryDto {
  tenantId: string;
  categoryId: string;
}

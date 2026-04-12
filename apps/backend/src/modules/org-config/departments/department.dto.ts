export interface CreateDepartmentDto {
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  isVisible?: boolean;
  sortOrder?: number;
}

export interface UpdateDepartmentDto {
  tenantId: string;
  departmentId: string;
  nameAr?: string;
  nameEn?: string;
  isVisible?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ListDepartmentsDto {
  tenantId: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface GetDepartmentDto {
  tenantId: string;
  departmentId: string;
}

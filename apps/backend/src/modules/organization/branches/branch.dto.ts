export interface CreateBranchDto {
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  phone?: string;
  addressAr?: string;
  addressEn?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateBranchDto {
  tenantId: string;
  branchId: string;
  nameAr?: string;
  nameEn?: string;
  phone?: string;
  addressAr?: string;
  addressEn?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
}

export interface ListBranchesDto {
  tenantId: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface GetBranchDto {
  tenantId: string;
  branchId: string;
}

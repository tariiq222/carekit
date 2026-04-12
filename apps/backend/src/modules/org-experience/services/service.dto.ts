export interface CreateServiceDto {
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  durationMins: number;
  price: number;
  currency?: string;
  imageUrl?: string;
}

export interface UpdateServiceDto {
  tenantId: string;
  serviceId: string;
  nameAr?: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  durationMins?: number;
  price?: number;
  currency?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface ListServicesDto {
  tenantId: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ArchiveServiceDto {
  tenantId: string;
  serviceId: string;
}

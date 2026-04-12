export interface CreateIntakeFormDto {
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  fields?: Array<{
    labelAr: string;
    labelEn?: string;
    fieldType: string;
    isRequired?: boolean;
    options?: string[];
    position?: number;
  }>;
}

export interface UpdateIntakeFormDto {
  tenantId: string;
  formId: string;
  nameAr?: string;
  nameEn?: string;
  isActive?: boolean;
}

export interface AddFieldDto {
  tenantId: string;
  formId: string;
  labelAr: string;
  labelEn?: string;
  fieldType: string;
  isRequired?: boolean;
  options?: string[];
  position?: number;
}

export interface RemoveFieldDto {
  tenantId: string;
  fieldId: string;
}

export interface GetIntakeFormDto {
  tenantId: string;
  formId: string;
}

export interface ListIntakeFormsDto {
  tenantId: string;
  isActive?: boolean;
}

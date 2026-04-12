export interface SetBusinessHoursDto {
  tenantId: string;
  branchId: string;
  // Full weekly schedule — upserts all days provided
  schedule: Array<{
    dayOfWeek: number; // 0=Sunday … 6=Saturday
    startTime: string; // "HH:mm"
    endTime: string;   // "HH:mm"
    isOpen: boolean;
  }>;
}

export interface GetBusinessHoursDto {
  tenantId: string;
  branchId: string;
}

export interface AddHolidayDto {
  tenantId: string;
  branchId: string;
  date: string; // ISO date "YYYY-MM-DD"
  nameAr: string;
  nameEn?: string;
}

export interface RemoveHolidayDto {
  tenantId: string;
  holidayId: string;
}

export interface ListHolidaysDto {
  tenantId: string;
  branchId: string;
  year?: number;
}

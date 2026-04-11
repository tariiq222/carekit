export interface SubmitRatingDto {
  tenantId: string;
  bookingId: string;
  clientId: string;
  employeeId: string;
  score: number; // 1–5
  comment?: string;
  isPublic?: boolean;
}

export interface ListRatingsDto {
  tenantId: string;
  employeeId?: string;
  clientId?: string;
  page?: number;
  limit?: number;
}

import type { ProblemReportStatus, ProblemReportType } from '../enums/rating';

export interface Rating {
  id: string;
  bookingId: string;
  patientId: string | null;
  practitionerId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface ProblemReport {
  id: string;
  bookingId: string;
  patientId: string | null;
  type: ProblemReportType;
  description: string | null;
  status: ProblemReportStatus;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRatingRequest {
  bookingId: string;
  stars: number;
  comment?: string;
}

export interface CreateProblemReportRequest {
  bookingId: string;
  type: ProblemReportType;
  description?: string;
}

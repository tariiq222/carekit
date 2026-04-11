/**
 * Problem Report Types -- CareKit Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Enums ─── */

export type ProblemReportType =
  | "wait_time"
  | "staff_behavior"
  | "cleanliness"
  | "billing"
  | "no_call"
  | "late"
  | "technical"
  | "other"

export type ProblemReportStatus =
  | "open"
  | "in_review"
  | "resolved"
  | "dismissed"

/* ─── Entities ─── */

export interface ProblemReport {
  id: string
  bookingId: string
  patientId: string
  type: ProblemReportType
  description: string
  status: ProblemReportStatus
  adminNotes: string | null
  resolvedById: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  booking?: {
    date: string
    startTime: string
    type: string
  }
  patient?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  resolvedBy?: {
    id: string
    firstName: string
    lastName: string
  } | null
}

/* ─── Query ─── */

export interface ProblemReportListQuery extends PaginatedQuery {
  status?: ProblemReportStatus
  patientId?: string
}

/* ─── DTOs ─── */

export interface ResolveProblemReportPayload {
  status: "resolved" | "dismissed"
  adminNotes?: string
}

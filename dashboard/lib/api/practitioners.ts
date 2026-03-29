/**
 * Practitioners API — CareKit Dashboard
 */

export * from "./practitioners-schedule"

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Practitioner,
  PractitionerListQuery,
  CreatePractitionerPayload,
  UpdatePractitionerPayload,
  OnboardPractitionerPayload,
  OnboardPractitionerResponse,
} from "@/lib/types/practitioner"

/* ─── Queries ─── */

export async function fetchPractitioners(
  query: PractitionerListQuery = {},
): Promise<PaginatedResponse<Practitioner>> {
  const res = await api.get<PaginatedResponse<RawPractitioner>>("/practitioners", {
    page: query.page,
    perPage: query.perPage,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    search: query.search,
    specialty: query.specialty,
    minRating: query.minRating,
    isActive: query.isActive,
  })
  return {
    items: res.items.map(mapPractitioner),
    meta: res.meta,
  }
}

/** Backend returns specialty as object {id, nameEn, nameAr} + rating/reviewCount fields */
type RawPractitioner = Omit<Practitioner, "averageRating" | "_count" | "specialty"> & {
  specialty: { id: string; nameEn: string; nameAr: string } | string | null
  rating?: number
  reviewCount?: number
  _count?: Practitioner["_count"]
  averageRating?: number
}

function mapPractitioner(raw: RawPractitioner): Practitioner {
  const specialty =
    raw.specialty == null
      ? ""
      : typeof raw.specialty === "string"
        ? raw.specialty
        : raw.specialty.nameEn

  const specialtyAr =
    raw.specialty == null || typeof raw.specialty === "string"
      ? (raw.specialtyAr ?? null)
      : (raw.specialty.nameAr ?? null)

  return {
    ...raw,
    specialty,
    specialtyAr,
    averageRating: raw.averageRating ?? raw.rating ?? undefined,
    _count: raw._count ?? {
      bookings: 0,
      ratings: raw.reviewCount ?? 0,
    },
  }
}

export async function fetchPractitioner(id: string): Promise<Practitioner> {
  const res = await api.get<RawPractitioner>(`/practitioners/${id}`)
  return mapPractitioner(res)
}

/* ─── CRUD ─── */

export async function createPractitioner(
  payload: CreatePractitionerPayload,
): Promise<Practitioner> {
  return api.post<Practitioner>("/practitioners", payload)
}

export async function onboardPractitioner(
  payload: OnboardPractitionerPayload,
): Promise<OnboardPractitionerResponse> {
  return api.post<OnboardPractitionerResponse>("/practitioners/onboard", payload)
}

export async function updatePractitioner(
  id: string,
  payload: UpdatePractitionerPayload,
): Promise<Practitioner> {
  return api.patch<Practitioner>(`/practitioners/${id}`, payload)
}

export async function deletePractitioner(id: string): Promise<void> {
  await api.delete(`/practitioners/${id}`)
}

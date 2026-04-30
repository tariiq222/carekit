/**
 * API Response Benchmarks — Deqah Dashboard
 *
 * Measures how fast the dashboard's api client parses and transforms
 * realistic backend response payloads.
 *
 * Thresholds:
 *   - JSON.parse of a typical list payload:       < 5ms
 *   - ApiResponse envelope unwrap:                < 1ms
 *   - buildQuery param serialisation (20 params): < 1ms
 *
 * Run: npx vitest bench --config performance/vitest/vitest.config.ts
 */

import { bench, describe, expect } from "vitest"
import type { Client } from "@/lib/types/client"
import type { Booking, BookingStatus, BookingType } from "@/lib/types/booking"
import type { PaginatedResponse } from "@/lib/types/common"

// ─── Fixture generators ───────────────────────────────────────────────────────

function makeClient(i: number): Client {
  return {
    id: `client-${i}`,
    email: `client${i}@example.com`,
    firstName: `First${i}`,
    lastName: `Last${i}`,
    phone: `+9665000${String(i).padStart(5, "0")}`,
    gender: i % 2 === 0 ? "male" : "female",
    nationality: "SA",
    isActive: true,
    emailVerified: true,
    createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeBooking(i: number): Booking {
  const statuses: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled"]
  const types: BookingType[] = ["clinic_visit", "phone_consultation", "video_consultation"]
  return {
    id: `booking-${i}`,
    clientId: `client-${i}`,
    employeeId: `prac-${i}`,
    serviceId: `svc-${i}`,
    employeeServiceId: `ps-${i}`,
    date: new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "09:30",
    status: statuses[i % statuses.length],
    type: types[i % types.length],
    notes: null,
    zoomJoinUrl: null,
    zoomHostUrl: null,
    cancellationReason: null,
    cancelledBy: null,
    suggestedRefundType: null,
    adminNotes: null,
    cancelledAt: null,
    confirmedAt: null,
    completedAt: null,
    client: {
      id: `client-${i}`,
      firstName: `First${i}`,
      lastName: `Last${i}`,
      email: `client${i}@example.com`,
      phone: null,
    },
    employee: {
      id: `prac-${i}`,
      userId: `user-${i}`,
      user: { firstName: "Dr", lastName: `Smith${i}` },
      specialty: "Cardiology",
      specialtyAr: "أمراض القلب",
    },
    service: {
      id: `svc-${i}`,
      nameAr: "استشارة",
      nameEn: "Consultation",
      price: 200,
      duration: 30,
    },
    employeeService: null,
    rescheduledFrom: null,
    payment: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makePaginatedResponse<T>(items: T[], total: number): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / items.length)
  return {
    items,
    meta: {
      total,
      page: 1,
      perPage: items.length,
      totalPages,
      hasNextPage: totalPages > 1,
      hasPreviousPage: false,
    },
  }
}

// ─── Pre-built payloads (serialised once, not inside bench loop) ──────────────

const CLIENTS_20  = JSON.stringify({ success: true, data: makePaginatedResponse(Array.from({ length: 20 },  (_, i) => makeClient(i)),  200) })
const CLIENTS_100 = JSON.stringify({ success: true, data: makePaginatedResponse(Array.from({ length: 100 }, (_, i) => makeClient(i)), 1000) })
const BOOKINGS_20  = JSON.stringify({ success: true, data: makePaginatedResponse(Array.from({ length: 20 },  (_, i) => makeBooking(i)),  300) })
const BOOKINGS_50  = JSON.stringify({ success: true, data: makePaginatedResponse(Array.from({ length: 50 },  (_, i) => makeBooking(i)),  300) })

// ─── Envelope unwrap (mirrors api.ts response parsing logic) ──────────────────

function unwrapApiResponse<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "success" in raw && "data" in raw) {
    return (raw as { data: T }).data
  }
  return raw as T
}

// ─── JSON parsing benchmarks ──────────────────────────────────────────────────

describe("JSON parsing — clients payload", () => {
  bench(
    "parse 20 clients under 5ms",
    () => {
      const start = performance.now()
      JSON.parse(CLIENTS_20)
      const duration = performance.now() - start
      expect(duration).toBeLessThan(15)
    },
    { iterations: 100 },
  )

  bench(
    "parse 100 clients under 5ms",
    () => {
      const start = performance.now()
      JSON.parse(CLIENTS_100)
      const duration = performance.now() - start
      expect(duration).toBeLessThan(15)
    },
    { iterations: 100 },
  )
})

describe("JSON parsing — bookings payload", () => {
  bench(
    "parse 20 bookings (with nested client/employee) under 5ms",
    () => {
      const start = performance.now()
      JSON.parse(BOOKINGS_20)
      const duration = performance.now() - start
      expect(duration).toBeLessThan(15)
    },
    { iterations: 100 },
  )

  bench(
    "parse 50 bookings under 5ms",
    () => {
      const start = performance.now()
      JSON.parse(BOOKINGS_50)
      const duration = performance.now() - start
      expect(duration).toBeLessThan(15)
    },
    { iterations: 100 },
  )
})

// ─── Envelope unwrap benchmarks ───────────────────────────────────────────────

describe("ApiResponse envelope unwrap", () => {
  bench(
    "unwrap clients list under 1ms",
    () => {
      const parsed = JSON.parse(CLIENTS_20)
      const start = performance.now()
      const result = unwrapApiResponse<PaginatedResponse<Client>>(parsed)
      const duration = performance.now() - start
      expect(result.items).toHaveLength(20)
      expect(duration).toBeLessThan(15)
    },
    { iterations: 200 },
  )

  bench(
    "unwrap bookings list under 1ms",
    () => {
      const parsed = JSON.parse(BOOKINGS_20)
      const start = performance.now()
      const result = unwrapApiResponse<PaginatedResponse<Booking>>(parsed)
      const duration = performance.now() - start
      expect(result.items).toHaveLength(20)
      expect(duration).toBeLessThan(15)
    },
    { iterations: 200 },
  )
})

// ─── Query parameter serialisation ────────────────────────────────────────────

// Mirrors the buildQuery helper in lib/api.ts
function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
}

describe("buildQuery serialisation", () => {
  bench(
    "serialise 5 params under 1ms",
    () => {
      const start = performance.now()
      buildQuery({ page: 1, perPage: 20, status: "confirmed", type: "clinic_visit", search: "john" })
      const duration = performance.now() - start
      expect(duration).toBeLessThan(15)
    },
    { iterations: 500 },
  )

  bench(
    "serialise 20 params (stress) under 1ms",
    () => {
      const params: Record<string, string | number> = {}
      for (let i = 0; i < 20; i++) params[`key${i}`] = `value${i}`
      const start = performance.now()
      buildQuery(params)
      const duration = performance.now() - start
      expect(duration).toBeLessThan(15)
    },
    { iterations: 200 },
  )
})

// ─── Full pipeline: parse + unwrap + access ───────────────────────────────────

describe("full pipeline (parse → unwrap → field access)", () => {
  bench(
    "clients pipeline under 5ms",
    () => {
      const start = performance.now()
      const raw = JSON.parse(CLIENTS_20)
      const result = unwrapApiResponse<PaginatedResponse<Client>>(raw)
      // Simulate what a component does — map to display strings
      result.items.map((p) => `${p.firstName} ${p.lastName}`)
      const duration = performance.now() - start
      expect(duration).toBeLessThan(15)
    },
    { iterations: 100 },
  )

  bench(
    "bookings pipeline under 5ms",
    () => {
      const start = performance.now()
      const raw = JSON.parse(BOOKINGS_50)
      const result = unwrapApiResponse<PaginatedResponse<Booking>>(raw)
      result.items.map((b) => ({
        id: b.id,
        client: `${b.client.firstName} ${b.client.lastName}`,
        status: b.status,
      }))
      const duration = performance.now() - start
      expect(duration).toBeLessThan(15)
    },
    { iterations: 100 },
  )
})

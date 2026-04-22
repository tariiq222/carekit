/**
 * useMemberships — unit tests (SaaS-06)
 *
 * Covers:
 *  1. Fires GET /auth/memberships with the correct query key
 *  2. Returns the response array
 *  3. Exposes loading state
 */

import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"
import React from "react"

const mockApiGet = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api", () => ({
  api: { get: mockApiGet },
}))

import { useMemberships, membershipsQueryKey } from "@/hooks/use-memberships"

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return Wrapper
}

describe("useMemberships", () => {
  beforeEach(() => {
    mockApiGet.mockReset()
  })

  it("calls /auth/memberships and returns the response", async () => {
    const rows = [
      {
        id: "m1",
        organizationId: "org-a",
        role: "OWNER",
        isActive: true,
        organization: {
          id: "org-a",
          slug: "clinic-a",
          nameAr: "العيادة أ",
          nameEn: "Clinic A",
          status: "ACTIVE",
        },
      },
    ]
    mockApiGet.mockResolvedValueOnce(rows)

    const { result } = renderHook(() => useMemberships(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiGet).toHaveBeenCalledWith("/auth/memberships")
    expect(result.current.data).toEqual(rows)
  })

  it("exposes the canonical query key", () => {
    expect(membershipsQueryKey).toEqual(["me", "memberships"])
  })
})

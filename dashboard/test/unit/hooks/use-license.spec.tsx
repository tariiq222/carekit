import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  fetchLicense,
  fetchLicenseFeatures,
  updateLicense,
} = vi.hoisted(() => ({
  fetchLicense: vi.fn(),
  fetchLicenseFeatures: vi.fn(),
  updateLicense: vi.fn(),
}))

vi.mock("@/lib/api/license", () => ({
  fetchLicense,
  fetchLicenseFeatures,
  updateLicense,
}))

import { useLicense, useLicenseFeatures, useUpdateLicense } from "@/hooks/use-license"

describe("useLicense", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches license config", async () => {
    const config = { plan: "pro", expiresAt: "2026-12-31" }
    fetchLicense.mockResolvedValueOnce(config)

    const { result } = renderHook(() => useLicense(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchLicense).toHaveBeenCalled()
    expect(result.current.data).toEqual(config)
  })
})

describe("useLicenseFeatures", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches license features", async () => {
    const features = [{ key: "chatbot", enabled: true, status: "active" }]
    fetchLicenseFeatures.mockResolvedValueOnce(features)

    const { result } = renderHook(() => useLicenseFeatures(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchLicenseFeatures).toHaveBeenCalled()
    expect(result.current.data).toEqual(features)
  })
})

describe("useUpdateLicense", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls updateLicense with payload", async () => {
    updateLicense.mockResolvedValueOnce({ plan: "enterprise" })

    const { result } = renderHook(() => useUpdateLicense(), { wrapper: createWrapper() })

    result.current.mutate({ plan: "enterprise" } as Parameters<typeof updateLicense>[0])

    await waitFor(() => expect(updateLicense).toHaveBeenCalled())
  })
})

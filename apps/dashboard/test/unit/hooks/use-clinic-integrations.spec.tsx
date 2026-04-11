import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  fetchClinicIntegrations,
  updateClinicIntegrations,
} = vi.hoisted(() => ({
  fetchClinicIntegrations: vi.fn(),
  updateClinicIntegrations: vi.fn(),
}))

vi.mock("@/lib/api/clinic-integrations", () => ({
  fetchClinicIntegrations,
  updateClinicIntegrations,
}))

import {
  useClinicIntegrations,
  useUpdateClinicIntegrations,
} from "@/hooks/use-clinic-integrations"

describe("useClinicIntegrations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches clinic integrations", async () => {
    const integrations = { smsEnabled: true, emailEnabled: true }
    fetchClinicIntegrations.mockResolvedValueOnce(integrations)

    const { result } = renderHook(() => useClinicIntegrations(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchClinicIntegrations).toHaveBeenCalled()
    expect(result.current.data).toEqual(integrations)
  })
})

describe("useUpdateClinicIntegrations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls updateClinicIntegrations with payload", async () => {
    updateClinicIntegrations.mockResolvedValueOnce({ smsEnabled: false })

    const { result } = renderHook(() => useUpdateClinicIntegrations(), { wrapper: createWrapper() })

    result.current.mutate({ smsEnabled: false } as Parameters<typeof updateClinicIntegrations>[0])

    await waitFor(() => expect(updateClinicIntegrations).toHaveBeenCalledWith({ smsEnabled: false }))
  })
})

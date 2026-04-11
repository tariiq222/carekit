import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  fetchOrganizationIntegrations,
  updateOrganizationIntegrations,
} = vi.hoisted(() => ({
  fetchOrganizationIntegrations: vi.fn(),
  updateOrganizationIntegrations: vi.fn(),
}))

vi.mock("@/lib/api/organization-integrations", () => ({
  fetchOrganizationIntegrations,
  updateOrganizationIntegrations,
}))

import {
  useOrganizationIntegrations,
  useUpdateOrganizationIntegrations,
} from "@/hooks/use-organization-integrations"

describe("useOrganizationIntegrations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches organization integrations", async () => {
    const integrations = { smsEnabled: true, emailEnabled: true }
    fetchOrganizationIntegrations.mockResolvedValueOnce(integrations)

    const { result } = renderHook(() => useOrganizationIntegrations(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchOrganizationIntegrations).toHaveBeenCalled()
    expect(result.current.data).toEqual(integrations)
  })
})

describe("useUpdateOrganizationIntegrations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls updateOrganizationIntegrations with payload", async () => {
    updateOrganizationIntegrations.mockResolvedValueOnce({ smsEnabled: false })

    const { result } = renderHook(() => useUpdateOrganizationIntegrations(), { wrapper: createWrapper() })

    result.current.mutate({ smsEnabled: false } as Parameters<typeof updateOrganizationIntegrations>[0])

    await waitFor(() => expect(updateOrganizationIntegrations).toHaveBeenCalledWith({ smsEnabled: false }))
  })
})

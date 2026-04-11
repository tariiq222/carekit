import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, put: putMock },
}))

import { fetchOrganizationIntegrations, updateOrganizationIntegrations } from "@/lib/api/organization-integrations"

describe("organization-integrations api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchOrganizationIntegrations calls /organization-integrations", async () => {
    getMock.mockResolvedValueOnce({ smsEnabled: true })
    await fetchOrganizationIntegrations()
    expect(getMock).toHaveBeenCalledWith("/organization-integrations")
  })

  it("updateOrganizationIntegrations puts to /organization-integrations", async () => {
    putMock.mockResolvedValueOnce({ smsEnabled: false })
    await updateOrganizationIntegrations({ smsEnabled: false } as Parameters<typeof updateOrganizationIntegrations>[0])
    expect(putMock).toHaveBeenCalledWith("/organization-integrations", expect.anything())
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock },
}))

import { fetchOrganizationIntegrations, updateOrganizationIntegrations } from "@/lib/api/organization-integrations"

describe("organization-integrations api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchOrganizationIntegrations calls /dashboard/platform/integrations", async () => {
    getMock.mockResolvedValueOnce({ smsEnabled: true })
    await fetchOrganizationIntegrations()
    expect(getMock).toHaveBeenCalledWith("/dashboard/platform/integrations")
  })

  it("updateOrganizationIntegrations posts to /dashboard/platform/integrations", async () => {
    postMock.mockResolvedValueOnce({ smsEnabled: false })
    await updateOrganizationIntegrations({ smsEnabled: false } as Parameters<typeof updateOrganizationIntegrations>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/platform/integrations", expect.anything())
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, put: putMock },
}))

import { fetchClinicIntegrations, updateClinicIntegrations } from "@/lib/api/clinic-integrations"

describe("clinic-integrations api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchClinicIntegrations calls /clinic-integrations", async () => {
    getMock.mockResolvedValueOnce({ smsEnabled: true })
    await fetchClinicIntegrations()
    expect(getMock).toHaveBeenCalledWith("/clinic-integrations")
  })

  it("updateClinicIntegrations puts to /clinic-integrations", async () => {
    putMock.mockResolvedValueOnce({ smsEnabled: false })
    await updateClinicIntegrations({ smsEnabled: false } as Parameters<typeof updateClinicIntegrations>[0])
    expect(putMock).toHaveBeenCalledWith("/clinic-integrations", expect.anything())
  })
})

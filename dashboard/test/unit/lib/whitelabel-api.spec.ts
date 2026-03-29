import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
}))

import {
  fetchConfig,
  fetchConfigMap,
  fetchConfigByKey,
  updateConfig,
  deleteConfig,
} from "@/lib/api/whitelabel"

describe("whitelabel api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchConfig calls /whitelabel/config", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchConfig()
    expect(getMock).toHaveBeenCalledWith("/whitelabel/config")
  })

  it("fetchConfigMap calls /whitelabel/config/map", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchConfigMap()
    expect(getMock).toHaveBeenCalledWith("/whitelabel/config/map")
  })

  it("fetchConfigByKey calls /whitelabel/config/:key", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchConfigByKey("clinic_name")
    expect(getMock).toHaveBeenCalledWith("/whitelabel/config/clinic_name")
  })

  it("updateConfig puts to /whitelabel/config", async () => {
    putMock.mockResolvedValueOnce([])
    await updateConfig({ updates: [] } as Parameters<typeof updateConfig>[0])
    expect(putMock).toHaveBeenCalledWith("/whitelabel/config", expect.anything())
  })

  it("deleteConfig deletes /whitelabel/config/:key", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteConfig("clinic_name")
    expect(deleteMock).toHaveBeenCalledWith("/whitelabel/config/clinic_name")
  })
})

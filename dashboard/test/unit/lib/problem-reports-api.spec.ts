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
  fetchProblemReports,
  fetchProblemReport,
  resolveProblemReport,
} from "@/lib/api/problem-reports"

describe("problem-reports api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchProblemReports calls /problem-reports", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })
    await fetchProblemReports()
    expect(getMock).toHaveBeenCalledWith("/problem-reports", expect.anything())
  })

  it("fetchProblemReport calls /problem-reports/:id", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchProblemReport("pr-1")
    expect(getMock).toHaveBeenCalledWith("/problem-reports/pr-1")
  })

  it("resolveProblemReport patches /problem-reports/:id/resolve", async () => {
    patchMock.mockResolvedValueOnce({})
    await resolveProblemReport("pr-1", { status: "resolved" } as Parameters<typeof resolveProblemReport>[1])
    expect(patchMock).toHaveBeenCalledWith("/problem-reports/pr-1/resolve", expect.anything())
  })
})

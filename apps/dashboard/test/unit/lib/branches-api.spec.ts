import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock },
}))

import {
  fetchBranches,
  fetchBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  fetchBranchPractitioners,
  assignBranchPractitioners,
  removeBranchPractitioner,
} from "@/lib/api/branches"

describe("branches api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBranches calls /branches with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchBranches({ page: 1, search: "main" })
    expect(getMock).toHaveBeenCalledWith("/branches", expect.objectContaining({ search: "main" }))
  })

  it("fetchBranch calls /branches/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "br-1" })
    await fetchBranch("br-1")
    expect(getMock).toHaveBeenCalledWith("/branches/br-1")
  })

  it("createBranch posts to /branches", async () => {
    postMock.mockResolvedValueOnce({ id: "br-1" })
    await createBranch({ nameAr: "الرئيسي" } as Parameters<typeof createBranch>[0])
    expect(postMock).toHaveBeenCalledWith("/branches", expect.objectContaining({ nameAr: "الرئيسي" }))
  })

  it("updateBranch patches /branches/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "br-1" })
    await updateBranch("br-1", { nameAr: "updated" } as Parameters<typeof updateBranch>[1])
    expect(patchMock).toHaveBeenCalledWith("/branches/br-1", expect.anything())
  })

  it("deleteBranch deletes /branches/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteBranch("br-1")
    expect(deleteMock).toHaveBeenCalledWith("/branches/br-1")
  })

  it("fetchBranchPractitioners calls /branches/:id/practitioners", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchBranchPractitioners("br-1")
    expect(getMock).toHaveBeenCalledWith("/branches/br-1/practitioners")
  })

  it("assignBranchPractitioners patches /branches/:id/practitioners", async () => {
    patchMock.mockResolvedValueOnce([])
    await assignBranchPractitioners("br-1", ["p-1", "p-2"])
    expect(patchMock).toHaveBeenCalledWith("/branches/br-1/practitioners", { practitionerIds: ["p-1", "p-2"] })
  })

  it("removeBranchPractitioner deletes /branches/:branchId/practitioners/:practitionerId", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeBranchPractitioner("br-1", "p-1")
    expect(deleteMock).toHaveBeenCalledWith("/branches/br-1/practitioners/p-1")
  })
})

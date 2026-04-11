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
  fetchBranchEmployees,
  assignBranchEmployees,
  removeBranchEmployee,
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

  it("fetchBranchEmployees calls /branches/:id/employees", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchBranchEmployees("br-1")
    expect(getMock).toHaveBeenCalledWith("/branches/br-1/employees")
  })

  it("assignBranchEmployees patches /branches/:id/employees", async () => {
    patchMock.mockResolvedValueOnce([])
    await assignBranchEmployees("br-1", ["p-1", "p-2"])
    expect(patchMock).toHaveBeenCalledWith("/branches/br-1/employees", { employeeIds: ["p-1", "p-2"] })
  })

  it("removeBranchEmployee deletes /branches/:branchId/employees/:employeeId", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeBranchEmployee("br-1", "p-1")
    expect(deleteMock).toHaveBeenCalledWith("/branches/br-1/employees/p-1")
  })
})

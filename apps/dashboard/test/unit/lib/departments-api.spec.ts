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
  fetchDepartments,
  fetchDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/api/departments"

describe("departments api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchDepartments calls /departments with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchDepartments({ page: 1, search: "cardio" })
    expect(getMock).toHaveBeenCalledWith("/departments", expect.objectContaining({ search: "cardio" }))
  })

  it("fetchDepartment calls /departments/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "d-1", nameAr: "قلبية" })
    await fetchDepartment("d-1")
    expect(getMock).toHaveBeenCalledWith("/departments/d-1")
  })

  it("createDepartment posts to /departments", async () => {
    postMock.mockResolvedValueOnce({ id: "d-1", nameAr: "جلدية" })
    await createDepartment({ nameAr: "جلدية" } as Parameters<typeof createDepartment>[0])
    expect(postMock).toHaveBeenCalledWith("/departments", expect.objectContaining({ nameAr: "جلدية" }))
  })

  it("updateDepartment patches /departments/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "d-1", nameAr: "updated" })
    await updateDepartment("d-1", { nameAr: "updated" } as Parameters<typeof updateDepartment>[1])
    expect(patchMock).toHaveBeenCalledWith("/departments/d-1", expect.anything())
  })

  it("deleteDepartment deletes /departments/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteDepartment("d-1")
    expect(deleteMock).toHaveBeenCalledWith("/departments/d-1")
  })
})

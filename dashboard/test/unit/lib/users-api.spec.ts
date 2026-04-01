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
  fetchUsers,
  fetchUser,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  assignRole,
  removeRole,
  fetchRoles,
  createRole,
  deleteRole,
  assignPermission,
  removePermission,
  fetchPermissions,
} from "@/lib/api/users"

describe("users api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches user list with query params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchUsers({ page: 1, perPage: 20, search: "أحمد", role: "admin" })
    expect(getMock).toHaveBeenCalledWith("/users", expect.objectContaining({ page: 1, search: "أحمد", role: "admin" }))
  })

  it("fetches single user by id", async () => {
    getMock.mockResolvedValueOnce({ id: "u-1" })
    await fetchUser("u-1")
    expect(getMock).toHaveBeenCalledWith("/users/u-1")
  })

  it("creates a user via POST /users", async () => {
    postMock.mockResolvedValueOnce({ id: "u-2" })
    await createUser({ firstName: "سارة", lastName: "المطيري", email: "sara@clinic.com", phone: "+966500000001", password: "Pass123!", roleSlug: "receptionist" })
    expect(postMock).toHaveBeenCalledWith("/users", expect.objectContaining({ email: "sara@clinic.com" }))
  })

  it("updates a user via PATCH /users/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "u-1" })
    await updateUser("u-1", { firstName: "نورة" })
    expect(patchMock).toHaveBeenCalledWith("/users/u-1", { firstName: "نورة" })
  })

  it("deletes a user via DELETE /users/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteUser("u-1")
    expect(deleteMock).toHaveBeenCalledWith("/users/u-1")
  })

  it("activates user via PATCH /users/:id/activate", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    await activateUser("u-1")
    expect(patchMock).toHaveBeenCalledWith("/users/u-1/activate")
  })

  it("deactivates user via PATCH /users/:id/deactivate", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    await deactivateUser("u-1")
    expect(patchMock).toHaveBeenCalledWith("/users/u-1/deactivate")
  })

  it("assigns role to user via POST /users/:id/roles", async () => {
    postMock.mockResolvedValueOnce(undefined)
    await assignRole("u-1", { roleId: "r-1" })
    expect(postMock).toHaveBeenCalledWith("/users/u-1/roles", { roleId: "r-1" })
  })

  it("removes role from user via DELETE /users/:id/roles/:roleId", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeRole("u-1", "r-1")
    expect(deleteMock).toHaveBeenCalledWith("/users/u-1/roles/r-1")
  })

  it("fetches all roles via GET /roles", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchRoles()
    expect(getMock).toHaveBeenCalledWith("/roles")
  })

  it("creates a role via POST /roles", async () => {
    postMock.mockResolvedValueOnce({ id: "r-2" })
    await createRole({ name: "receptionist", description: "Front desk" })
    expect(postMock).toHaveBeenCalledWith("/roles", expect.objectContaining({ name: "receptionist" }))
  })

  it("deletes a role via DELETE /roles/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteRole("r-1")
    expect(deleteMock).toHaveBeenCalledWith("/roles/r-1")
  })

  it("assigns permission to role via POST /roles/:id/permissions", async () => {
    postMock.mockResolvedValueOnce(undefined)
    await assignPermission("r-1", { module: "patients", action: "read" })
    expect(postMock).toHaveBeenCalledWith("/roles/r-1/permissions", { module: "patients", action: "read" })
  })

  it("removes permission from role via DELETE /roles/:id/permissions", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removePermission("r-1", { module: "patients", action: "read" })
    expect(deleteMock).toHaveBeenCalledWith("/roles/r-1/permissions", { data: { module: "patients", action: "read" } })
  })

  it("fetches all permissions via GET /permissions", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchPermissions()
    expect(getMock).toHaveBeenCalledWith("/permissions")
  })
})

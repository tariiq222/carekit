import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchUsers,
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
} = vi.hoisted(() => ({
  fetchUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  activateUser: vi.fn(),
  deactivateUser: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
  fetchRoles: vi.fn(),
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  assignPermission: vi.fn(),
  removePermission: vi.fn(),
  fetchPermissions: vi.fn(),
}))

vi.mock("@/lib/api/users", () => ({
  fetchUsers,
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
}))

import { useUserMutations, useRoleMutations } from "@/hooks/use-users"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useUserMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createUser", async () => {
    createUser.mockResolvedValueOnce({ id: "u-new" })

    const { result } = renderHook(() => useUserMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({ name: "New User", email: "u@test.com" } as Parameters<typeof createUser>[0])
    })

    await waitFor(() => expect(createUser).toHaveBeenCalled())
  })

  it("updateMut calls updateUser with id and payload", async () => {
    updateUser.mockResolvedValueOnce({ id: "u-1" })

    const { result } = renderHook(() => useUserMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMut.mutate({ id: "u-1", name: "Updated" } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith("u-1", expect.objectContaining({ name: "Updated" })))
  })

  it("deleteMut calls deleteUser with id", async () => {
    deleteUser.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useUserMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteMut.mutate("u-1") })

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith("u-1", expect.anything()))
  })

  it("activateMut calls activateUser", async () => {
    activateUser.mockResolvedValueOnce({ id: "u-1" })

    const { result } = renderHook(() => useUserMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.activateMut.mutate("u-1") })

    await waitFor(() => expect(activateUser).toHaveBeenCalledWith("u-1", expect.anything()))
  })

  it("deactivateMut calls deactivateUser", async () => {
    deactivateUser.mockResolvedValueOnce({ id: "u-1" })

    const { result } = renderHook(() => useUserMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deactivateMut.mutate("u-1") })

    await waitFor(() => expect(deactivateUser).toHaveBeenCalledWith("u-1", expect.anything()))
  })

  it("assignRoleMut calls assignRole with userId and payload", async () => {
    assignRole.mockResolvedValueOnce({ id: "u-1" })

    const { result } = renderHook(() => useUserMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.assignRoleMut.mutate({ userId: "u-1", roleId: "r-1" } as Parameters<typeof result.current.assignRoleMut.mutate>[0])
    })

    await waitFor(() => expect(assignRole).toHaveBeenCalledWith("u-1", expect.objectContaining({ roleId: "r-1" })))
  })

  it("removeRoleMut calls removeRole with userId and roleId", async () => {
    removeRole.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useUserMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.removeRoleMut.mutate({ userId: "u-1", roleId: "r-1" })
    })

    await waitFor(() => expect(removeRole).toHaveBeenCalledWith("u-1", "r-1"))
  })
})

describe("useRoleMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createRole", async () => {
    createRole.mockResolvedValueOnce({ id: "r-new" })

    const { result } = renderHook(() => useRoleMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({ name: "editor" } as Parameters<typeof createRole>[0])
    })

    await waitFor(() => expect(createRole).toHaveBeenCalled())
  })

  it("deleteMut calls deleteRole with id", async () => {
    deleteRole.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useRoleMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteMut.mutate("r-1") })

    await waitFor(() => expect(deleteRole).toHaveBeenCalledWith("r-1", expect.anything()))
  })

  it("assignPermMut calls assignPermission with roleId and payload", async () => {
    assignPermission.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useRoleMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.assignPermMut.mutate({ roleId: "r-1", permissionId: "perm-1", module: "clients", action: "read" } as Parameters<typeof result.current.assignPermMut.mutate>[0])
    })

    await waitFor(() =>
      expect(assignPermission).toHaveBeenCalledWith("r-1", expect.objectContaining({ module: "clients", action: "read" })),
    )
  })

  it("removePermMut calls removePermission with roleId and payload", async () => {
    removePermission.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useRoleMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.removePermMut.mutate({ roleId: "r-1", permissionId: "perm-1", module: "clients", action: "read" } as Parameters<typeof result.current.removePermMut.mutate>[0])
    })

    await waitFor(() =>
      expect(removePermission).toHaveBeenCalledWith("r-1", expect.objectContaining({ module: "clients", action: "read" })),
    )
  })
})

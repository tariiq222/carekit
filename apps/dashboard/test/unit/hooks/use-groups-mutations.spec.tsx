import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("@/lib/api/groups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/groups")>()
  return {
    ...actual,
    resendEnrollmentPayment: vi.fn(),
    confirmEnrollmentAttendance: vi.fn(),
  }
})

import { useGroupsMutations } from "@/hooks/use-groups-mutations"
import * as groupsApi from "@/lib/api/groups"

const resendEnrollmentPayment = vi.mocked(groupsApi.resendEnrollmentPayment)
const confirmEnrollmentAttendance = vi.mocked(groupsApi.confirmEnrollmentAttendance)

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useGroupsMutations — resendPaymentMut", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls resendEnrollmentPayment with groupId and enrollmentId", async () => {
    resendEnrollmentPayment.mockResolvedValueOnce(undefined as Awaited<ReturnType<typeof groupsApi.resendEnrollmentPayment>>)

    const { result } = renderHook(() => useGroupsMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.resendPaymentMut.mutate({
        groupId: "group-1",
        enrollmentId: "enrollment-1",
      })
    })

    await waitFor(() =>
      expect(resendEnrollmentPayment).toHaveBeenCalledWith("group-1", "enrollment-1"),
    )
  })

  it("does not call resendEnrollmentPayment before mutation", () => {
    const { result } = renderHook(() => useGroupsMutations(), { wrapper: makeWrapper() })

    // Access the mutation but don't trigger it
    expect(resendEnrollmentPayment).not.toHaveBeenCalled()
  })
})

describe("useGroupsMutations — confirmAttendanceMut", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls confirmEnrollmentAttendance with groupId and payload", async () => {
    confirmEnrollmentAttendance.mockResolvedValueOnce({ id: "enrollment-1" } as Awaited<ReturnType<typeof groupsApi.confirmEnrollmentAttendance>>)

    const { result } = renderHook(() => useGroupsMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.confirmAttendanceMut.mutate({
        groupId: "group-1",
        enrollmentId: "enrollment-1",
        attended: true,
      })
    })

    await waitFor(() =>
      expect(confirmEnrollmentAttendance).toHaveBeenCalledWith("group-1", {
        enrollmentId: "enrollment-1",
        attended: true,
      }),
    )
  })

  it("forwards the full payload to confirmEnrollmentAttendance", async () => {
    confirmEnrollmentAttendance.mockResolvedValueOnce({ id: "enrollment-2" } as Awaited<ReturnType<typeof groupsApi.confirmEnrollmentAttendance>>)

    const { result } = renderHook(() => useGroupsMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.confirmAttendanceMut.mutate({
        groupId: "group-2",
        enrollmentId: "enrollment-2",
        attended: false,
      })
    })

    await waitFor(() =>
      expect(confirmEnrollmentAttendance).toHaveBeenCalledWith("group-2", {
        enrollmentId: "enrollment-2",
        attended: false,
      }),
    )
  })
})

import { renderHook, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  createGroupSession,
  updateGroupSession,
  deleteGroupSession,
  cancelGroupSession,
  completeGroupSession,
  enrollPatient,
  removeEnrollment,
} = vi.hoisted(() => ({
  createGroupSession: vi.fn(),
  updateGroupSession: vi.fn(),
  deleteGroupSession: vi.fn(),
  cancelGroupSession: vi.fn(),
  completeGroupSession: vi.fn(),
  enrollPatient: vi.fn(),
  removeEnrollment: vi.fn(),
}))

vi.mock("@/lib/api/group-sessions", () => ({
  createGroupSession,
  updateGroupSession,
  deleteGroupSession,
  cancelGroupSession,
  completeGroupSession,
  enrollPatient,
  removeEnrollment,
}))

import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"

describe("useGroupSessionsMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createSessionMut calls createGroupSession", async () => {
    createGroupSession.mockResolvedValueOnce({ id: "gs-new" })

    const { result } = renderHook(() => useGroupSessionsMutations(), { wrapper: createWrapper() })

    act(() => {
      result.current.createSessionMut.mutate({ name: "Yoga" } as Parameters<typeof createGroupSession>[0])
    })

    await waitFor(() => expect(createGroupSession).toHaveBeenCalled())
  })

  it("updateSessionMut calls updateGroupSession with id and payload", async () => {
    updateGroupSession.mockResolvedValueOnce({ id: "gs-1" })

    const { result } = renderHook(() => useGroupSessionsMutations(), { wrapper: createWrapper() })

    act(() => {
      result.current.updateSessionMut.mutate({ id: "gs-1", name: "Updated" } as Parameters<typeof result.current.updateSessionMut.mutate>[0])
    })

    await waitFor(() => expect(updateGroupSession).toHaveBeenCalledWith("gs-1", expect.objectContaining({ name: "Updated" })))
  })

  it("deleteSessionMut calls deleteGroupSession with id", async () => {
    deleteGroupSession.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useGroupSessionsMutations(), { wrapper: createWrapper() })

    act(() => { result.current.deleteSessionMut.mutate("gs-1") })

    await waitFor(() => expect(deleteGroupSession).toHaveBeenCalledWith("gs-1", expect.anything()))
  })

  it("cancelSessionMut calls cancelGroupSession with id", async () => {
    cancelGroupSession.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useGroupSessionsMutations(), { wrapper: createWrapper() })

    act(() => { result.current.cancelSessionMut.mutate("gs-1") })

    await waitFor(() => expect(cancelGroupSession).toHaveBeenCalledWith("gs-1", expect.anything()))
  })

  it("completeSessionMut calls completeGroupSession", async () => {
    completeGroupSession.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useGroupSessionsMutations(), { wrapper: createWrapper() })

    act(() => {
      result.current.completeSessionMut.mutate({
        id: "gs-1",
        attendedPatientIds: [],
      } as unknown as Parameters<typeof result.current.completeSessionMut.mutate>[0])
    })

    await waitFor(() => expect(completeGroupSession).toHaveBeenCalled())
  })

  it("enrollPatientMut calls enrollPatient", async () => {
    enrollPatient.mockResolvedValueOnce({ id: "enr-1" })

    const { result } = renderHook(() => useGroupSessionsMutations(), { wrapper: createWrapper() })

    act(() => {
      result.current.enrollPatientMut.mutate({ sessionId: "gs-1", patientId: "pat-1" })
    })

    await waitFor(() => expect(enrollPatient).toHaveBeenCalledWith("gs-1", "pat-1"))
  })

  it("removeEnrollmentMut calls removeEnrollment", async () => {
    removeEnrollment.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useGroupSessionsMutations(), { wrapper: createWrapper() })

    act(() => {
      result.current.removeEnrollmentMut.mutate({ sessionId: "gs-1", enrollmentId: "enr-1" })
    })

    await waitFor(() => expect(removeEnrollment).toHaveBeenCalledWith("gs-1", "enr-1"))
  })
})

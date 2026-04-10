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
  fetchGroupSessions,
  fetchGroupSession,
  createGroupSession,
  updateGroupSession,
  deleteGroupSession,
  cancelGroupSession,
  completeGroupSession,
  enrollPatient,
  removeEnrollment,
} from "@/lib/api/group-sessions"

describe("group-sessions api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchGroupSessions calls /group-sessions with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchGroupSessions({ page: 1, search: "yoga" })
    expect(getMock).toHaveBeenCalledWith("/group-sessions", expect.objectContaining({ search: "yoga" }))
  })

  it("fetchGroupSession calls /group-sessions/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "gs-1", name: "Yoga Class" })
    await fetchGroupSession("gs-1")
    expect(getMock).toHaveBeenCalledWith("/group-sessions/gs-1")
  })

  it("createGroupSession posts to /group-sessions", async () => {
    postMock.mockResolvedValueOnce({ id: "gs-1" })
    await createGroupSession({ name: "Yoga" } as unknown as Parameters<typeof createGroupSession>[0])
    expect(postMock).toHaveBeenCalledWith("/group-sessions", expect.objectContaining({ name: "Yoga" }))
  })

  it("updateGroupSession patches /group-sessions/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "gs-1" })
    await updateGroupSession("gs-1", { name: "Updated" } as Parameters<typeof updateGroupSession>[1])
    expect(patchMock).toHaveBeenCalledWith("/group-sessions/gs-1", expect.anything())
  })

  it("deleteGroupSession deletes /group-sessions/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteGroupSession("gs-1")
    expect(deleteMock).toHaveBeenCalledWith("/group-sessions/gs-1")
  })

  it("cancelGroupSession patches /group-sessions/:id/cancel", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    await cancelGroupSession("gs-1")
    expect(patchMock).toHaveBeenCalledWith("/group-sessions/gs-1/cancel", {})
  })

  it("completeGroupSession patches /group-sessions/:id/complete with payload", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    await completeGroupSession("gs-1", { attendedPatientIds: [] } as unknown as Parameters<typeof completeGroupSession>[1])
    expect(patchMock).toHaveBeenCalledWith("/group-sessions/gs-1/complete", expect.anything())
  })

  it("enrollPatient posts to /group-sessions/:sessionId/enroll", async () => {
    postMock.mockResolvedValueOnce({ id: "enr-1" })
    await enrollPatient("gs-1", "pat-1")
    expect(postMock).toHaveBeenCalledWith("/group-sessions/gs-1/enroll", { patientId: "pat-1" })
  })

  it("removeEnrollment deletes /group-sessions/:sessionId/enrollments/:enrollmentId", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeEnrollment("gs-1", "enr-1")
    expect(deleteMock).toHaveBeenCalledWith("/group-sessions/gs-1/enrollments/enr-1")
  })
})

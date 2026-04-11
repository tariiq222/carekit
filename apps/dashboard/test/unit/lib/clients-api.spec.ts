import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock,
    patch: patchMock,
  },
}))

import {
  activatePatient,
  createWalkInPatient,
  deactivatePatient,
  fetchPatient,
  fetchPatients,
  fetchPatientStats,
  updatePatient,
} from "@/lib/api/patients"

describe("patients api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches patient list with pagination and search params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    await fetchPatients({ page: 2, perPage: 10, search: "محمد" })

    expect(getMock).toHaveBeenCalledWith("/patients", {
      page: 2,
      perPage: 10,
      search: "محمد",
    })
  })

  it("fetches patient detail by id", async () => {
    getMock.mockResolvedValueOnce({ id: "patient-1" })

    await fetchPatient("patient-1")

    expect(getMock).toHaveBeenCalledWith("/patients/patient-1")
  })

  it("normalizes stats from backend scenario shape", async () => {
    getMock.mockResolvedValueOnce({
      totalBookings: 12,
      byStatus: { COMPLETED: 8, CANCELLED: 2 },
      totalPaid: 420,
      completedPayments: 7,
    })

    const result = await fetchPatientStats("patient-1")

    expect(getMock).toHaveBeenCalledWith("/patients/patient-1/stats")
    expect(result).toEqual({
      totalBookings: 12,
      completedBookings: 8,
      cancelledBookings: 2,
      totalSpent: 420,
      totalPaid: 420,
      completedPayments: 7,
      lastVisit: null,
      byStatus: { COMPLETED: 8, CANCELLED: 2 },
    })
  })

  it("posts walk-in patient payload to the correct endpoint", async () => {
    postMock.mockResolvedValueOnce({ id: "walkin-1", isExisting: false })

    await createWalkInPatient({
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      emergencyPhone: "+966500000111",
      bloodType: "O_NEG",
    })

    expect(postMock).toHaveBeenCalledWith("/patients/walk-in", {
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      emergencyPhone: "+966500000111",
      bloodType: "O_NEG",
    })
  })

  it("patches patient updates to the correct endpoint", async () => {
    patchMock.mockResolvedValueOnce({ id: "patient-1" })

    await updatePatient("patient-1", {
      firstName: "أحمد",
      phone: "+966500000222",
      allergies: "Dust",
    })

    expect(patchMock).toHaveBeenCalledWith("/patients/patient-1", {
      firstName: "أحمد",
      phone: "+966500000222",
      allergies: "Dust",
    })
  })

  it("toggles patient activity state through patch requests", async () => {
    patchMock.mockResolvedValue({ id: "patient-1" })

    await activatePatient("patient-1")
    await deactivatePatient("patient-1")

    expect(patchMock).toHaveBeenNthCalledWith(1, "/patients/patient-1", {
      isActive: true,
    })
    expect(patchMock).toHaveBeenNthCalledWith(2, "/patients/patient-1", {
      isActive: false,
    })
  })
})

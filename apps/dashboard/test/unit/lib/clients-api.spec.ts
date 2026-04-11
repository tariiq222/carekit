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
  activateClient,
  createWalkInClient,
  deactivateClient,
  fetchClient,
  fetchClients,
  fetchClientStats,
  updateClient,
} from "@/lib/api/clients"

describe("clients api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches client list with pagination and search params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    await fetchClients({ page: 2, perPage: 10, search: "محمد" })

    expect(getMock).toHaveBeenCalledWith("/clients", {
      page: 2,
      perPage: 10,
      search: "محمد",
    })
  })

  it("fetches client detail by id", async () => {
    getMock.mockResolvedValueOnce({ id: "client-1" })

    await fetchClient("client-1")

    expect(getMock).toHaveBeenCalledWith("/clients/client-1")
  })

  it("normalizes stats from backend scenario shape", async () => {
    getMock.mockResolvedValueOnce({
      totalBookings: 12,
      byStatus: { COMPLETED: 8, CANCELLED: 2 },
      totalPaid: 420,
      completedPayments: 7,
    })

    const result = await fetchClientStats("client-1")

    expect(getMock).toHaveBeenCalledWith("/clients/client-1/stats")
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

  it("posts walk-in client payload to the correct endpoint", async () => {
    postMock.mockResolvedValueOnce({ id: "walkin-1", isExisting: false })

    await createWalkInClient({
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      emergencyPhone: "+966500000111",
      bloodType: "O_NEG",
    })

    expect(postMock).toHaveBeenCalledWith("/clients/walk-in", {
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      emergencyPhone: "+966500000111",
      bloodType: "O_NEG",
    })
  })

  it("patches client updates to the correct endpoint", async () => {
    patchMock.mockResolvedValueOnce({ id: "client-1" })

    await updateClient("client-1", {
      firstName: "أحمد",
      phone: "+966500000222",
      allergies: "Dust",
    })

    expect(patchMock).toHaveBeenCalledWith("/clients/client-1", {
      firstName: "أحمد",
      phone: "+966500000222",
      allergies: "Dust",
    })
  })

  it("toggles client activity state through patch requests", async () => {
    patchMock.mockResolvedValue({ id: "client-1" })

    await activateClient("client-1")
    await deactivateClient("client-1")

    expect(patchMock).toHaveBeenNthCalledWith(1, "/clients/client-1", {
      isActive: true,
    })
    expect(patchMock).toHaveBeenNthCalledWith(2, "/clients/client-1", {
      isActive: false,
    })
  })
})

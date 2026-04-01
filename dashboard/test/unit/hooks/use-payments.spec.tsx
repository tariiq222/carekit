import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchPayments,
  fetchPaymentStats,
  refundPayment,
  updatePaymentStatus,
  verifyBankTransfer,
  reviewReceipt,
} = vi.hoisted(() => ({
  fetchPayments: vi.fn(),
  fetchPaymentStats: vi.fn(),
  refundPayment: vi.fn(),
  updatePaymentStatus: vi.fn(),
  verifyBankTransfer: vi.fn(),
  reviewReceipt: vi.fn(),
}))

vi.mock("@/lib/api/payments", () => ({
  fetchPayments,
  fetchPaymentStats,
  refundPayment,
  updatePaymentStatus,
  verifyBankTransfer,
  reviewReceipt,
}))

import {
  usePayments,
  usePaymentStats,
  usePaymentMutations,
} from "@/hooks/use-payments"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("usePayments", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches payments and returns items", async () => {
    const items = [{ id: "pay-1", amount: 500 }]
    fetchPayments.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchPayments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.payments).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchPayments.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.payments).toEqual([])
  })

  it("hasFilters is false when no filters are applied", async () => {
    fetchPayments.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasFilters).toBe(false)
  })

  it("hasFilters is true when status filter is applied", async () => {
    fetchPayments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("paid") })

    await waitFor(() => expect(result.current.hasFilters).toBe(true))
  })

  it("resetFilters clears status and method", async () => {
    fetchPayments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("paid") })
    await waitFor(() => expect(result.current.status).toBe("paid"))

    act(() => { result.current.resetFilters() })
    await waitFor(() => expect(result.current.status).toBe("all"))
    expect(result.current.method).toBe("all")
    expect(result.current.hasFilters).toBe(false)
  })

  it("passes search to api and resets page", async () => {
    fetchPayments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("ref-001") })

    await waitFor(() =>
      expect(fetchPayments).toHaveBeenCalledWith(
        expect.objectContaining({ search: "ref-001", page: 1 }),
      ),
    )
  })
})

describe("usePaymentStats", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches payment stats", async () => {
    const stats = { totalRevenue: 50000, count: 120 }
    fetchPaymentStats.mockResolvedValueOnce(stats)

    const { result } = renderHook(() => usePaymentStats(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchPaymentStats).toHaveBeenCalled()
    expect(result.current.data).toEqual(stats)
  })

  it("returns loading state initially", () => {
    fetchPaymentStats.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => usePaymentStats(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
  })
})

describe("usePaymentMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("refundMut calls refundPayment with id and payload", async () => {
    refundPayment.mockResolvedValueOnce({ id: "pay-1" })

    const { result } = renderHook(() => usePaymentMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.refundMut.mutate({ id: "pay-1", reason: "duplicate" } as Parameters<typeof result.current.refundMut.mutate>[0])
    })

    await waitFor(() => expect(refundPayment).toHaveBeenCalledWith("pay-1", { reason: "duplicate" }))
  })

  it("statusMut calls updatePaymentStatus", async () => {
    updatePaymentStatus.mockResolvedValueOnce({ id: "pay-1" })

    const { result } = renderHook(() => usePaymentMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.statusMut.mutate({ id: "pay-1", status: "paid" } as Parameters<typeof result.current.statusMut.mutate>[0])
    })

    await waitFor(() => expect(updatePaymentStatus).toHaveBeenCalledWith("pay-1", { status: "paid" }))
  })

  it("verifyMut calls verifyBankTransfer", async () => {
    verifyBankTransfer.mockResolvedValueOnce({ id: "pay-1" })

    const { result } = renderHook(() => usePaymentMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.verifyMut.mutate({ id: "pay-1", verified: true, action: "approve" } as Parameters<typeof result.current.verifyMut.mutate>[0])
    })

    await waitFor(() => expect(verifyBankTransfer).toHaveBeenCalledWith("pay-1", { verified: true }))
  })

  it("reviewMut calls reviewReceipt", async () => {
    reviewReceipt.mockResolvedValueOnce({ receiptId: "r-1" })

    const { result } = renderHook(() => usePaymentMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.reviewMut.mutate({ receiptId: "r-1", approved: true } as Parameters<typeof result.current.reviewMut.mutate>[0])
    })

    await waitFor(() => expect(reviewReceipt).toHaveBeenCalledWith("r-1", { approved: true }))
  })
})

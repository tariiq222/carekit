import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchInvoices, fetchInvoiceStats, createInvoice, markInvoiceAsSent } = vi.hoisted(() => ({
  fetchInvoices: vi.fn(),
  fetchInvoiceStats: vi.fn(),
  createInvoice: vi.fn(),
  markInvoiceAsSent: vi.fn(),
}))

vi.mock("@/lib/api/invoices", () => ({
  fetchInvoices,
  fetchInvoiceStats,
  createInvoice,
  markInvoiceAsSent,
}))

import { useInvoices, useInvoiceStats, useInvoiceMutations } from "@/hooks/use-invoices"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useInvoices", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches invoices and returns items", async () => {
    const items = [{ id: "inv-1", number: "INV-001" }]
    fetchInvoices.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useInvoices(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.invoices).toEqual(items)
  })

  it("returns empty list while loading", () => {
    fetchInvoices.mockReturnValueOnce(new Promise(() => undefined))
    const { result } = renderHook(() => useInvoices(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.invoices).toEqual([])
  })

  it("passes search filter to api", async () => {
    fetchInvoices.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useInvoices(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    result.current.setSearch("INV-002")

    await waitFor(() =>
      expect(fetchInvoices).toHaveBeenCalledWith(
        expect.objectContaining({ search: "INV-002", page: 1 }),
      ),
    )
  })

  it("resetFilters clears all filters", async () => {
    fetchInvoices.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useInvoices(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    result.current.setSearch("test")
    await waitFor(() => expect(result.current.search).toBe("test"))

    result.current.resetFilters()
    await waitFor(() => expect(result.current.search).toBe(""))
    expect(result.current.hasFilters).toBe(false)
  })
})

describe("useInvoiceStats", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches and returns invoice stats", async () => {
    const stats = { total: 100, paid: 80, pending: 20 }
    fetchInvoiceStats.mockResolvedValueOnce(stats)

    const { result } = renderHook(() => useInvoiceStats(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchInvoiceStats).toHaveBeenCalled()
    expect(result.current.data).toEqual(stats)
  })
})

describe("useInvoiceMutations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("createMut calls createInvoice with payload", async () => {
    createInvoice.mockResolvedValueOnce({ id: "inv-1" })

    const { result } = renderHook(() => useInvoiceMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({} as Parameters<typeof createInvoice>[0])
    })

    await waitFor(() => expect(createInvoice).toHaveBeenCalled())
  })

  it("sendMut calls markInvoiceAsSent with id", async () => {
    markInvoiceAsSent.mockResolvedValueOnce({ id: "inv-1" })

    const { result } = renderHook(() => useInvoiceMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.sendMut.mutate("inv-1") })

    await waitFor(() => expect(markInvoiceAsSent).toHaveBeenCalledWith("inv-1", expect.anything()))
  })
})

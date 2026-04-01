import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchGiftCards,
  fetchGiftCard,
  createGiftCard,
  updateGiftCard,
  deactivateGiftCard,
  addGiftCardCredit,
} = vi.hoisted(() => ({
  fetchGiftCards: vi.fn(),
  fetchGiftCard: vi.fn(),
  createGiftCard: vi.fn(),
  updateGiftCard: vi.fn(),
  deactivateGiftCard: vi.fn(),
  addGiftCardCredit: vi.fn(),
}))

vi.mock("@/lib/api/gift-cards", () => ({
  fetchGiftCards,
  fetchGiftCard,
  createGiftCard,
  updateGiftCard,
  deactivateGiftCard,
  addGiftCardCredit,
}))

import { useGiftCards, useGiftCard, useGiftCardMutations } from "@/hooks/use-gift-cards"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useGiftCards", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches gift cards and returns items", async () => {
    const items = [{ id: "gc-1", code: "GIFT100" }]
    fetchGiftCards.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useGiftCards(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchGiftCards).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.giftCards).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchGiftCards.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useGiftCards(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.giftCards).toEqual([])
  })

  it("returns empty list when api returns no items", async () => {
    fetchGiftCards.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useGiftCards(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.giftCards).toEqual([])
  })

  it("passes search to api and resets page", async () => {
    fetchGiftCards.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useGiftCards(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("GIFT") })

    await waitFor(() =>
      expect(fetchGiftCards).toHaveBeenCalledWith(
        expect.objectContaining({ search: "GIFT", page: 1 }),
      ),
    )
  })

  it("passes status filter to api and resets page", async () => {
    fetchGiftCards.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useGiftCards(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("active") })

    await waitFor(() =>
      expect(fetchGiftCards).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", page: 1 }),
      ),
    )
  })

  it("resetFilters clears search and status", async () => {
    fetchGiftCards.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useGiftCards(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("inactive") })
    await waitFor(() => expect(result.current.status).toBe("inactive"))

    act(() => { result.current.resetFilters() })
    await waitFor(() => expect(result.current.status).toBeUndefined())
    expect(result.current.search).toBe("")
    expect(result.current.page).toBe(1)
  })
})

describe("useGiftCard", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches a single gift card by id", async () => {
    const card = { id: "gc-1", code: "GIFT100", balance: 100 }
    fetchGiftCard.mockResolvedValueOnce(card)

    const { result } = renderHook(() => useGiftCard("gc-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchGiftCard).toHaveBeenCalledWith("gc-1")
    expect(result.current.data).toEqual(card)
  })

  it("does not fetch when id is null", () => {
    renderHook(() => useGiftCard(null), { wrapper: makeWrapper() })
    expect(fetchGiftCard).not.toHaveBeenCalled()
  })
})

describe("useGiftCardMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createGiftCard", async () => {
    createGiftCard.mockResolvedValueOnce({ id: "gc-new" })

    const { result } = renderHook(() => useGiftCardMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({ amount: 200 } as Parameters<typeof createGiftCard>[0])
    })

    await waitFor(() => expect(createGiftCard).toHaveBeenCalled())
  })

  it("updateMut calls updateGiftCard with id and payload", async () => {
    updateGiftCard.mockResolvedValueOnce({ id: "gc-1" })

    const { result } = renderHook(() => useGiftCardMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMut.mutate({ id: "gc-1", amount: 300 } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() => expect(updateGiftCard).toHaveBeenCalledWith("gc-1", expect.objectContaining({ amount: 300 })))
  })

  it("deactivateMut calls deactivateGiftCard with id", async () => {
    deactivateGiftCard.mockResolvedValueOnce({ id: "gc-1" })

    const { result } = renderHook(() => useGiftCardMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deactivateMut.mutate("gc-1") })

    await waitFor(() => expect(deactivateGiftCard).toHaveBeenCalledWith("gc-1", expect.anything()))
  })

  it("addCreditMut calls addGiftCardCredit with id and payload", async () => {
    addGiftCardCredit.mockResolvedValueOnce({ id: "gc-1" })

    const { result } = renderHook(() => useGiftCardMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.addCreditMut.mutate({ id: "gc-1", amount: 50 } as Parameters<typeof result.current.addCreditMut.mutate>[0])
    })

    await waitFor(() => expect(addGiftCardCredit).toHaveBeenCalledWith("gc-1", { amount: 50 }))
  })
})

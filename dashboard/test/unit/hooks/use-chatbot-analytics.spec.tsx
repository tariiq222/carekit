import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchChatbotAnalytics, fetchTopQuestions } = vi.hoisted(() => ({
  fetchChatbotAnalytics: vi.fn(),
  fetchTopQuestions: vi.fn(),
}))

vi.mock("@/lib/api/chatbot", () => ({
  fetchChatbotAnalytics,
  fetchTopQuestions,
}))

import {
  useChatbotAnalytics,
  useTopQuestions,
} from "@/hooks/use-chatbot-analytics"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useChatbotAnalytics", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns null stats while pending", () => {
    fetchChatbotAnalytics.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useChatbotAnalytics(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.stats).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it("fetches analytics and exposes stats", async () => {
    const mockStats = { totalSessions: 42, handedOff: 5 }
    fetchChatbotAnalytics.mockResolvedValueOnce(mockStats)

    const { result } = renderHook(() => useChatbotAnalytics(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.stats).toEqual(mockStats)
    expect(result.current.error).toBeNull()
    expect(fetchChatbotAnalytics).toHaveBeenCalledWith({})
  })

  it("passes query params to the API call", async () => {
    fetchChatbotAnalytics.mockResolvedValueOnce({ totalSessions: 10 })

    const { result } = renderHook(
      () => useChatbotAnalytics({ from: "2026-01-01", to: "2026-03-27" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchChatbotAnalytics).toHaveBeenCalledWith({
      from: "2026-01-01",
      to: "2026-03-27",
    })
  })

  it("surfaces error message on fetch failure", async () => {
    fetchChatbotAnalytics.mockRejectedValueOnce(new Error("network error"))

    const { result } = renderHook(() => useChatbotAnalytics(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.error).toBe("network error"))
    expect(result.current.stats).toBeNull()
  })
})

describe("useTopQuestions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns empty array while pending", () => {
    fetchTopQuestions.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useTopQuestions(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.questions).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it("fetches top questions and returns them", async () => {
    const mockQuestions = [{ question: "كيف أحجز؟", count: 12 }]
    fetchTopQuestions.mockResolvedValueOnce(mockQuestions)

    const { result } = renderHook(() => useTopQuestions(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.questions).toHaveLength(1))

    expect(result.current.questions).toEqual(mockQuestions)
    expect(fetchTopQuestions).toHaveBeenCalledWith(undefined)
  })

  it("passes limit param to the API", async () => {
    fetchTopQuestions.mockResolvedValueOnce([])

    const { result } = renderHook(() => useTopQuestions(5), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchTopQuestions).toHaveBeenCalledWith(5)
  })
})

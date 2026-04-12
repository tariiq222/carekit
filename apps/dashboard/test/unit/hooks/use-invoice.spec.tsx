import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { createInvoice } = vi.hoisted(() => ({
  createInvoice: vi.fn(),
}))

vi.mock("@/lib/api/invoices", () => ({
  createInvoice,
}))

import { useInvoiceMutations } from "@/hooks/use-invoices"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

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
})

import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"

const { createInvoice } = vi.hoisted(() => ({ createInvoice: vi.fn() }))

vi.mock("@/lib/api/invoices", () => ({ createInvoice }))

import { useInvoiceMutations } from "@/hooks/use-invoices"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

describe("useInvoiceMutations", () => {
  beforeEach(() => { createInvoice.mockReset() })

  it("calls createInvoice with the given payload", async () => {
    createInvoice.mockResolvedValue({ id: "inv-1" })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useInvoiceMutations(), { wrapper: Wrapper })
    await result.current.createMut.mutateAsync({ paymentId: "pay-1" })
    // TanStack v5 passes a { client, meta, mutationKey } context as the 2nd arg
    // when mutationFn is used directly (no arrow wrapper).
    expect(createInvoice).toHaveBeenCalledWith({ paymentId: "pay-1" }, expect.anything())
  })

  it("invalidates the invoices.all cache on success", async () => {
    createInvoice.mockResolvedValue({ id: "inv-1" })
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useInvoiceMutations(), { wrapper: Wrapper })
    await result.current.createMut.mutateAsync({ paymentId: "pay-1" })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["invoices"] })
  })

  it("propagates errors to the caller", async () => {
    createInvoice.mockRejectedValue(new Error("duplicate"))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useInvoiceMutations(), { wrapper: Wrapper })
    await expect(result.current.createMut.mutateAsync({ paymentId: "x" })).rejects.toThrow("duplicate")
  })
})

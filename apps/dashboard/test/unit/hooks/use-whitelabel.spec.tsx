import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  fetchWhitelabel,
  updateWhitelabel,
} = vi.hoisted(() => ({
  fetchWhitelabel: vi.fn(),
  updateWhitelabel: vi.fn(),
}))

vi.mock("@/lib/api/whitelabel", () => ({
  fetchWhitelabel,
  updateWhitelabel,
}))

import { useWhitelabel, useUpdateWhitelabel } from "@/hooks/use-whitelabel"

describe("useWhitelabel", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches whitelabel config", async () => {
    const config = { colorPrimary: "#354FD8", logoUrl: "https://example.com/logo.png" }
    fetchWhitelabel.mockResolvedValueOnce(config)

    const { result } = renderHook(() => useWhitelabel(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchWhitelabel).toHaveBeenCalled()
    expect(result.current.data).toEqual(config)
  })
})

describe("useUpdateWhitelabel", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls updateWhitelabel with payload", async () => {
    updateWhitelabel.mockResolvedValueOnce({ colorPrimary: "#000000" })

    const { result } = renderHook(() => useUpdateWhitelabel(), { wrapper: createWrapper() })

    result.current.mutate({ colorPrimary: "#000000" } as Parameters<typeof updateWhitelabel>[0])

    await waitFor(() => expect(updateWhitelabel).toHaveBeenCalled())
  })
})
